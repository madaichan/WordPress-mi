# Implementation Plan: Campaign Group & Monitoring — Status, Lifecycle Actions, and Reporting

Status: Draft
Date: 2026-09-04
Owner: Pukat Product and Engineering
Related PRD: `docs/PRD_CAMPAIGN_GROUP_MONITORING.md` (all open questions resolved — this plan implements it as final, no further requirement decisions expected)

## 1. Ringkasan

PRD ini menambahkan: (1) satu aksi lifecycle terpadu **Complete** untuk Campaign Run (menggabungkan cancel/recall/complete jadi satu tombol, satu status akhir `completed`), (2) entity baru **Campaign Group** (folder pengelompokan Campaign Run per project/periode, entity-scoped otomatis ke pembuatnya, status Active/Selesai dihitung — bukan disimpan), (3) bulk complete dalam satu group, (4) monitoring teragregasi per group/seluruh group aktif, (5) export PDF asli via backend.

## 2. Current State (hasil investigasi kode, bukan asumsi)

### 2.1 Campaign Run — lifecycle sudah ada, tinggal disambung/diretarget

`CampaignRunService.php`/`CampaignRunController.php` sudah punya lifecycle penuh (`draft_run → ready_for_sync → synced → running/scheduled → completed/cancelled`), termasuk `create()`, `lock_snapshot()`, `sync()`, `launch()`, `cancel()`, `results()`, `sync_results()`, `report()` — semua sudah live-verified sebelumnya (lihat `docs/IMPLEMENTATION_PLAN_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`). `report()` sudah mengembalikan `metrics_json.stats` asli (`total`, `email_sent`, `email_opened`, `clicked`, `submitted_data`, rate masing-masing) — ini sumber data untuk semua agregasi di plan ini, tidak perlu live call ke GoPhish per request.

Entity-based access control **sudah ada dan terbukti bekerja** (dipakai ulang, bukan dibangun baru): `current_user_can_access_run()`, `current_user_can_access_playbook()`, `enforce_existing_run_editable()`, `current_user_entity()` (baca `user_meta` `meta_entity`/`entity`/`pukat_entity`), `current_user_can_admin_assets()`. **Catatan penting dari pengalaman sebelumnya**: `enforce_existing_run_editable()` menolak non-admin mengedit Campaign Run yang playbook sumbernya ber-`entity` `"General"` — bukan bug, tapi jangan kaget kalau smoke test pakai role operator gagal dengan `entity_forbidden` di data fixture yang playbook-nya General; gunakan role admin untuk uji aksi mutasi terhadap fixture semacam itu.

### 2.2 Belum ada sama sekali: Campaign Group, Complete standalone, PDF, bulk action

Tidak ada tabel/kelas/route untuk Campaign Group. `cancel()` yang ada saat ini set `status = 'cancelled'`, bukan `'completed'`. Tidak ada `POST .../complete`. Tidak ada library PDF di `composer.json`. `DataTable` frontend punya skeleton `bulk_actions`/`onBulkAction` tapi belum pernah dipakai untuk lifecycle action.

### 2.3 Pola server-driven table sudah mapan — dipakai ulang, bukan dibangun baru

`TableRegistry.php` (whitelist `table_key` → repository class, `search_fields`, `sortable`, `filters`, `columns`, `row_actions`, `bulk_actions`), `TableQueryService.php` (validasi input + dispatch ke `decorate_<table>_row()` per table_key untuk `row_actions` per-baris dengan `disabled`/`reason`), `TableController.php` (`TABLE_KEY_PERMISSIONS` map). Pola ini **harus diikuti persis** untuk Campaign Run list, bukan dibuat ulang — lihat `CampaignTableRepository.php` (legacy `campaigns` table) sebagai referensi struktur `count()`/`rows()`/`where()`.

**Temuan penting dari eksplorasi sebelumnya (frontend):** filter dengan `'type' => 'select'` di skema otomatis dirender jadi `<select>` oleh `DataTableToolbar.jsx` memakai `filter.options` dari registry — tapi Campaign Group bersifat dinamis (dibuat user), tidak bisa punya `options` statis. Solusi yang sudah terbukti jalan: beri filter `campaign_group_id` `'type' => 'hidden'` (bukan `'select'`) di `TableRegistry.php` supaya tidak dirender otomatis oleh toolbar generik, lalu halaman Manage bikin picker sendiri (pills/dropdown terisi dari `GET /campaign-groups`) yang mengirim value-nya lewat `filters.campaign_group_id` secara manual — `TableQueryService::validate_filters()` cuma mengecek *key* terdaftar di registry, tidak pernah memvalidasi value terhadap `options`, jadi ini aman dipakai.

### 2.4 Housekeeping wajib sebelum Phase 1

Migrasi database dari eksplorasi sebelumnya (`pukat_campaign_groups`, kolom `campaign_group_id`/`archived_at` di `pukat_campaign_runs`) sempat berjalan di DB dev dan **`pukat_db_version` option di DB sudah tercatat `1.8.0`**, padahal source code migrasinya sudah tidak ada (revert). Sebelum Phase 1 mulai:

```sql
-- Jalankan di DB dev sebelum mulai (lewat wp-cli/phpMyAdmin/php -r), BUKAN migration code:
SHOW TABLES LIKE '%pukat_campaign_groups%';
SHOW COLUMNS FROM wp_pukat_campaign_runs LIKE 'archived_at';
```

Kalau tabel/kolom lama masih ada tapi skemanya beda dari yang didesain Phase 1 (lihat §5), **drop manual** dulu (tabel ini belum pernah dipakai data produksi nyata — cuma pernah diisi data uji coba yang sudah dibersihkan sebelumnya) dan reset `pukat_db_version` ke versi sebelum `1.8.0` (`update_option('pukat_db_version', '1.7.3')`) supaya migration baru di Phase 1 berjalan bersih. **Ini langkah operasional manual satu kali, bukan kode.**

## 3. Dependency Order

```text
Phase 0: Housekeeping DB dev (lihat §2.4) — manual, bukan kode
   |
Phase 1: Schema — tabel pukat_campaign_groups + kolom campaign_group_id
   |
   +-- Phase 2: Complete action (retarget cancel -> complete) + RBAC rename   [independen dari Phase 1]
   |
Phase 3: Campaign Group CRUD + entity auto-assign + visibility + computed status  (butuh Phase 1)
   |
Phase 4: Assign-to-group + bulk-complete endpoint   (butuh Phase 2 + Phase 3)
   |
Phase 5: Campaign Run server-driven table (list/filter/sort untuk halaman Manage)  (butuh Phase 2 + Phase 3 + Phase 4, untuk row_actions yang benar)
   |
Phase 6: Aggregate report per-group + seluruh group aktif   (butuh Phase 3)
   |
Phase 7: PDF export (dompdf)   (butuh Phase 6)
   |
Phase 8: Frontend API/query/mutation layer   (butuh Phase 2-7 selesai di backend)
   |
   +-- Phase 9: Frontend Manage Campaigns page   [bisa paralel dengan Phase 10]
   +-- Phase 10: Frontend Monitoring page
   |
Phase 11: QA end-to-end (Docker + GoPhish nyata)
```

Phase 1 dan Phase 2 independen satu sama lain (file berbeda, tidak saling bergantung) — bisa dikerjakan paralel. Phase 9 dan 10 sama-sama cuma bergantung ke Phase 8, bisa paralel.

## 4. Phase 1: Schema

**Tujuan:** Fondasi data Campaign Group, tanpa kolom `status` (dihitung, bukan disimpan — lihat PRD §7.2 FR-5).

**Pekerjaan (`includes/Core/Activator.php`):**

- `CREATE TABLE IF NOT EXISTS {prefix}campaign_groups`: `id`, `name VARCHAR(255) NOT NULL`, `description TEXT NULL`, **`entity VARCHAR(255) NOT NULL`** (diisi backend saat create, lihat Phase 3 — bukan nullable, setiap group wajib py entity), `created_by BIGINT UNSIGNED`, `created_at`, `updated_at`. **Tidak ada kolom `status`** (keputusan final PRD §7.2 FR-5). Index di `entity`.
- Migration baru `ensure_campaign_runs_campaign_group_column()` (pola identik `ensure_campaign_runs_follow_up_column()` yang sudah ada) — `ALTER TABLE {prefix}campaign_runs ADD campaign_group_id BIGINT UNSIGNED DEFAULT NULL`, plus index. **Tidak ada kolom `archived_at`** kali ini — archive bukan bagian PRD ini (lihat PRD §5.2 Out of Scope tersirat dari FR yang ada).
- Panggil kedua hal di atas dari `create_tables()` dan tambah blok versi baru di `maybe_upgrade()` (`pukat_db_version` naik satu step dari versi saat ini — cek `update_option('pukat_version', ...)` terakhir di `activate()` untuk tahu angka berikutnya, ikuti pola numbering yang sudah ada, misal `1.8.0` kalau sudah bersih dari housekeeping §2.4).

**Acceptance Criteria:** `php -l` bersih; migration idempoten (jalankan `maybe_upgrade()` dua kali, tidak error); tabel/kolom baru muncul di DB dev setelah dijalankan.

## 5. Phase 2: Complete Action + RBAC Rename

**Tujuan:** Satu aksi manual `Complete`, hasil akhir selalu `status = 'completed'` (PRD §6.4/§7.1 FR-2).

**Pekerjaan backend:**

- `CampaignRunService.php`: rename method `cancel()` → `complete()` (isi method sama persis — panggil GoPhish `complete_campaign()` kalau `gophish_campaign_id` ada, lalu update — **ubah** `'status' => 'cancelled'` jadi `'status' => 'completed'`; ubah nama audit log action dari `campaign_run.cancelled` jadi `campaign_run.completed`).
- `CampaignRunController.php`: rename route `POST /campaign-runs/{id}/cancel` → `POST /campaign-runs/{id}/complete`, method handler & permission callback ikut (`permission_cancel_campaign_run` → `permission_complete_campaign_run`, capability key `campaigns.cancel` → `campaigns.complete`).
- `PermissionRegistry.php`: di menu `campaigns.actions`, rename key `cancel` → `complete` (`'complete' => 'operator'`).
- `Activator.php::maybe_upgrade()`: tambah blok versi baru — untuk tiap role yang punya capability `pukat_campaigns_cancel`, `add_cap('pukat_campaigns_complete')` lalu `remove_cap('pukat_campaigns_cancel')` (pola identik migrasi cap lama di blok versi `1.7.2`/`1.7.3` yang sudah ada — re-seed lewat `seed_rbac_defaults()` plus eksplisit add/remove untuk role yang sudah ada, supaya operator yang sebelumnya bisa cancel tidak kehilangan akses).

**Acceptance Criteria:** `POST /campaign-runs/{id}/complete` terhadap run `synced/scheduled/running` menghasilkan `status = 'completed'` (bukan `'cancelled'`), audit log tercatat `campaign_run.completed`; role yang sebelumnya punya `campaigns.cancel` otomatis dapat `campaigns.complete` setelah `maybe_upgrade()` jalan.

## 6. Phase 3: Campaign Group CRUD + Entity + Computed Status

**Tujuan:** CRUD Campaign Group dengan entity otomatis dan status dihitung (PRD §6.3, §7.2 FR-4/5/6a).

**Pekerjaan (baru semua):**

- `includes/Repositories/CampaignGroupRepository.php` — `all()`, `find()`, `create()`, `update()`, `delete()`, `ungroup_members(int $id)` (set `campaign_group_id = NULL` di semua Campaign Run anggota — dipanggil sebelum delete, FR-4).
- `includes/Services/CampaignGroupService.php`:
  - `create(array $params, int $user_id)`: validasi `name` wajib; **`entity` diisi dari `current_user_entity()` milik `$user_id`, tidak pernah dari `$params`** (PRD §8 — cegah spoofing dari klien).
  - `list()`/`get()`: filter visibility — admin lihat semua, non-admin cuma group yang `entity`-nya sama (pola identik `current_user_can_access_playbook()`, extract ke helper baru `current_user_can_access_group()` kalau perlu dipakai di lebih dari satu tempat).
  - `compute_status(array $group, array $memberRuns): string` — helper murni (tidak query database sendiri, terima daftar run yang sudah di-fetch caller) yang menerapkan aturan PRD FR-5: `'active'` kalau ada run non-terminal, `'completed'` kalau semua run sudah `completed`/`cancelled` dan minimal 1 anggota, `'active'` kalau kosong. Dipakai di `list()`/`get()` untuk menambahkan field `status` yang dihitung ke response (bukan dari DB), dan di Phase 6 untuk filter "active groups" tanpa N+1 (lihat §9).
  - `update()`/`delete()`: `delete()` panggil `ungroup_members()` dulu.

- `includes/Api/CampaignGroupController.php` — `GET/POST /campaign-groups`, `GET/PUT/DELETE /campaign-groups/{id}`, permission reuse `campaigns.view`/`campaigns.edit`/`campaigns.delete` (tidak ada capability baru — PRD tidak minta menu RBAC terpisah untuk Campaign Group).

**Acceptance Criteria:** Create group sebagai user entity "Finance" menghasilkan `entity = 'Finance'` walau field itu dikirim beda dari body request (harus diabaikan). Non-admin dari entity "HR" mendapat 404/list kosong untuk group "Finance". Group baru (kosong) tampil `status: 'active'`.

## 7. Phase 4: Assign-to-Group + Bulk Complete

**Tujuan:** PRD §7.2 FR-6 dan §7.4 FR-9/10.

**Pekerjaan:**

- `CampaignRunService.php::assign_group(int $id, ?int $campaignGroupId, int $userId)` — validasi seperti method lifecycle lain (`find`, `enforce_existing_run_editable`), **plus validasi entity**: kalau `$campaignGroupId` bukan null dan user bukan admin, entity Campaign Group tujuan harus sama dengan entity playbook sumber Campaign Run (kalau tidak, `WP_Error` 422 dengan pesan jelas). Route baru `POST /campaign-runs/{id}/assign-group`, body `{ campaign_group_id: number|null }`.
- `CampaignRunService.php::bulk_complete(array $ids, int $userId): array` — loop tiap id, panggil `complete()`, tangkap sukses/gagal per item (jangan biarkan satu kegagalan menghentikan yang lain — PRD FR-10). Return array `[{ id, success, error? }]`.
- `CampaignRunController.php` route baru `POST /campaign-runs/bulk-complete`, body `{ ids: number[] }`, permission sama seperti `complete` tunggal.

**Acceptance Criteria:** Assign campaign entity Finance ke group entity HR ditolak untuk non-admin dengan pesan jelas, diizinkan untuk admin. Bulk complete atas 3 id (satu di antaranya sudah `completed` sebelumnya) menghasilkan 2 sukses + 1 gagal dengan alasan, bukan exception yang menghentikan semuanya.

## 8. Phase 5: Campaign Run Server-Driven Table

**Tujuan:** List/filter/sort/pagination Campaign Run untuk halaman Manage, mengikuti pola `TableRegistry` yang sudah mapan (§2.3).

**Pekerjaan:**

- `includes/Repositories/Table/CampaignRunTableRepository.php` (baru) — copy struktur `CampaignTableRepository.php` persis (`count()`/`rows()`/`where()`), kolom termasuk `campaign_group_id` + `LEFT JOIN` ke `pukat_campaign_groups` untuk `campaign_group_name`, korelasi `target_count` dari `pukat_targets.campaign_run_id`. Filter `campaign_group_id`: `0`/kosong → `IS NULL` (bucket "Ungrouped"), angka → exact match.
- `TableRegistry.php`: entry baru `campaign_runs` — `search_fields: ['name']`, `sortable: ['name','status','launched_at','created_at']`, filters `status` (`type: select`, enum status asli) + `campaign_group_id` (**`type: hidden`**, lihat catatan §2.3 — jangan pakai `select`), `row_actions: ['assign_group','complete']` (**cuma dua ini** — tidak ada `archive`/`unarchive`/`delete`/`export`, di luar scope PRD ini), `bulk_actions: ['complete']`.
- `TableController.php`: tambah `'campaign_runs' => 'campaigns.view'` ke `TABLE_KEY_PERMISSIONS`.
- `TableQueryService.php`: tambah `decorate_campaign_run_row()` + dispatch case — `complete` disabled kalau status sudah `completed` (reason: "Campaign sudah selesai"); `assign_group` selalu enabled.

**Acceptance Criteria:** `GET /tables/campaign_runs/schema` dan `/rows` lolos smoke test generik yang sudah ada (`tools/smoke-table-api.php` — table_key baru otomatis ikut ter-cover karena test itu iterasi `TableRegistry::keys()`, tidak perlu file smoke baru untuk ini). Row yang statusnya `completed` menampilkan tombol Complete dalam kondisi disabled dengan reason.

## 9. Phase 6: Aggregate Report — Per Group & Seluruh Group Aktif

**Tujuan:** PRD §7.3 FR-7/8, dengan perhatian khusus ke risiko N+1 yang sudah diidentifikasi di PRD §10.

**Pekerjaan (`CampaignGroupService.php`):**

- `report(?int $groupId): array` — sum `metrics_json.stats` dari seluruh Campaign Run anggota group (query semua run sekali, filter di PHP — bukan N+1 query). `null` = bucket "Ungrouped".
- `report_active(): array` — **satu query** `CampaignRunRepository::all()` + satu query groups, lalu di memori: group per `campaign_group_id`, hitung `compute_status()` (dari Phase 3) tiap group, jumlahkan `stats` cuma dari group yang hasilnya `'active'`. **Jangan** query per-group di dalam loop — inilah mitigasi risiko N+1 yang dicatat di PRD.
- Response format konsisten dengan `CampaignRunService::report()` yang sudah ada (`stats` object + daftar `campaign_runs` sumber, ditambah `generated_at`) supaya frontend (Phase 10) dan PDF renderer (Phase 7) bisa pakai shape yang sama untuk laporan per-run maupun per-group.
- Route baru: `GET /campaign-groups/{id}/report`, `GET /campaign-groups/active/report`.

**Acceptance Criteria:** Report untuk group berisi 3 Campaign Run (2 `completed` stats masing-masing 100 email_sent, 1 `running` belum ada stats) menjumlahkan dengan benar. `report_active()` cuma menghitung total 1 query ke tabel campaign_runs + 1 ke campaign_groups terlepas dari jumlah group (verifikasi lewat query log/profiling sederhana, bukan cuma baca kode).

## 10. Phase 7: PDF Export

**Tujuan:** PRD §7.5 FR-11 — PDF asli dari backend.

**Pekerjaan:**

1. **Dependency:** `composer require dompdf/dompdf` di root plugin (update `composer.json` + `composer.lock` + commit `vendor/` seperti dependency lain di project ini — cek `require: { "php": ">=8.1" }` cukup untuk dompdf versi terbaru). **Langkah operasional, bukan cuma edit file** — jalankan composer sungguhan, verifikasi autoload jalan.
2. `includes/Services/CampaignReportPdfService.php` (baru) — terima payload shape yang sama dengan output Phase 6/`CampaignRunService::report()`, render ke HTML sederhana (judul, entity/nama group atau nama campaign, tanggal generate, tabel ringkasan stats, tabel daftar Campaign Run sumber), lalu `Dompdf::render()` → return string biner PDF.
3. Route baru di `CampaignGroupController.php`/`CampaignRunController.php`: `GET /campaign-groups/{id}/report/export`, `GET /campaign-groups/active/report/export`, `GET /campaign-runs/{id}/report/export`. Response bukan lewat `RestController::success()` (yang bungkus JSON) — kembalikan `WP_REST_Response` dengan header `Content-Type: application/pdf` dan `Content-Disposition: attachment; filename=...` berisi binary PDF, atau (kalau REST API WP mempersulit binary response) endpoint custom non-REST dengan nonce check manual — putuskan pendekatan konkret saat coding berdasarkan mana yang lebih mulus dengan `RestController` yang ada, dicoba dulu lewat REST biasa.

**Acceptance Criteria:** Request ke endpoint export menghasilkan file yang benar-benar bisa dibuka sebagai PDF (bukan cuma response 200 dengan body yang diklaim PDF) — verifikasi dengan buka file hasil download di viewer PDF sungguhan, bukan cuma cek `Content-Type` header.

## 11. Phase 8: Frontend API / Query / Mutation Layer

**Tujuan:** Sambungkan semua endpoint Phase 2-7 ke frontend.

**Pekerjaan:**

- `pukat-app/src/api/campaignGroupApi.js` (baru) — `list/get/create/update/delete/report(id|'active')`, plus `exportPdf(id|'active')` yang **tidak** lewat `client.js` axios wrapper biasa (itu unwrap JSON envelope) — pakai `fetch`/axios dengan `responseType: 'blob'` supaya binary PDF tidak dirusak interceptor, lalu trigger download lewat `URL.createObjectURL` (pola mirip util CSV yang sudah ada di eksplorasi sebelumnya, tinggal disesuaikan untuk blob PDF alih-alih string CSV).
- `pukat-app/src/api/campaignApi.js` — tambah `runComplete`, `runBulkComplete`, `runAssignGroup`, `runReportExportPdf`.
- `pukat-app/src/api/queryKeys.js` — tambah namespace `campaignGroups`.
- `pukat-app/src/hooks/queries/useCampaignGroupQueries.js`, `pukat-app/src/hooks/mutations/useCampaignGroupMutations.js`, tambahan di `useCampaignMutations.js` — pola triad query+mutation yang sudah konsisten dipakai di seluruh project (contoh terdekat: `useRoleQueries.js`/`useRoleMutations.js`).

**Acceptance Criteria:** `npm run lint`/`build`/`test` bersih.

## 12. Phase 9: Frontend — Manage Campaigns Page

**Tujuan:** Halaman untuk PIC mengelola Campaign Group dan menjalankan Complete (single/bulk).

**Pekerjaan:**

- Route baru `/manage-campaigns` + entri sidebar (ikuti pola `appRoutes.jsx` yang sudah ada: `frontendRoutes`, `frontendNavGroups`, `routeMeta`).
- Halaman baru (`pukat-app/src/pages/Simulation/ManageCampaigns.jsx` + `pukat-app/src/features/campaigns/Manage/ManageView.jsx`) — halaman berdiri sendiri, bukan tab di dalam workspace `/campaigns` manapun (`/campaigns` sekarang murni wizard "New campaign" saja, tidak ada workspace tab lagi).
- Group picker (pills/dropdown, bukan filter `select` otomatis dari schema — lihat catatan §2.3) menampilkan nama group + status terhitung (Active/Selesai) dari response API.
- `DataTable` dengan `tableKey="campaign_runs"`, checkbox selection aktif (`onSelectionChange`), bulk action bar memakai `onBulkAction` yang sudah ada di komponen `DataTable` (tinggal disambung, infrastrukturnya sudah ada).
- Row action `complete` → `AlertConfirmation` sebelum eksekusi (PRD FR-2 "UI menampilkan konfirmasi"). Row action `assign_group` → picker sederhana (drawer/modal kecil).

**Acceptance Criteria:** Buat group baru, assign 2+ campaign, pilih keduanya lewat checkbox, jalankan bulk Complete, lihat hasil per-item (bukan cuma satu toast generik).

## 13. Phase 10: Frontend — Monitoring Page

**Tujuan:** PRD §7.3 FR-7, funnel stats nyata + PDF.

**Pekerjaan:**

- `pukat-app/src/features/campaigns/Views/MonitoringView.jsx` — ganti selector campaign statis dengan selector nyata: "Semua group aktif" (default, panggil `report_active()`), per-group tertentu, atau per-Campaign Run individual (reuse `GET /campaign-runs/{id}/report` yang sudah ada sejak baseline).
- Stat card + funnel section dari `stats` response asli (pola sama seperti card di halaman Manage).
- Tombol "Export PDF" memanggil `exportPdf` (Phase 8), bukan CSV.
- **Di luar scope** (PRD §4 Non-Tujuan): breakdown per-departemen, live event feed, grafik per-jam — biarkan sebagai placeholder ilustratif kalau sudah ada dari sebelumnya, atau tidak usah dibangun kalau belum ada.

**Acceptance Criteria:** Ganti pilihan dari "Semua group aktif" ke satu group spesifik mengubah angka funnel sesuai anggota group itu saja. Klik Export PDF mengunduh file PDF asli.

## 14. Phase 11: QA End-to-End (Docker + GoPhish nyata)

```text
Buat 2+ Campaign Run lewat wizard existing (di luar scope plan ini, sudah berfungsi)
Buat Campaign Group, assign campaign-campaign itu ke dalamnya
Cek entity group otomatis sama dengan entity pembuat, tidak bisa diisi manual
Complete satu campaign -> cek status jadi 'completed', bukan 'cancelled'
Bulk complete sisa campaign di group -> cek hasil per-item
Cek status group berubah dari Active ke Selesai setelah semua anggota completed
Buka Monitoring, pilih group tsb -> cek funnel stats sesuai jumlah anggota
Export PDF -> buka file hasil, pastikan benar-benar valid PDF berisi data yang sesuai
Ulangi dengan role non-admin dari entity berbeda -> pastikan tidak bisa lihat/assign ke group entity lain
```

## 15. Files Expected to Change

### Backend — baru

```text
includes/Repositories/CampaignGroupRepository.php
includes/Repositories/Table/CampaignRunTableRepository.php
includes/Services/CampaignGroupService.php
includes/Services/CampaignReportPdfService.php
includes/Api/CampaignGroupController.php
```

### Backend — diedit

```text
includes/Core/Activator.php
includes/Core/Plugin.php                        (registrasi controller baru)
includes/Services/CampaignRunService.php         (rename cancel->complete, assign_group, bulk_complete)
includes/Api/CampaignRunController.php           (route rename + baru)
includes/Services/PermissionRegistry.php         (rename capability key)
includes/Services/TableRegistry.php
includes/Services/TableQueryService.php
includes/Api/TableController.php
composer.json, composer.lock, vendor/**          (dompdf)
```

### Frontend — baru

```text
pukat-app/src/api/campaignGroupApi.js
pukat-app/src/hooks/queries/useCampaignGroupQueries.js
pukat-app/src/hooks/mutations/useCampaignGroupMutations.js
pukat-app/src/pages/Simulation/ManageCampaigns.jsx
pukat-app/src/features/campaigns/Manage/ManageView.jsx (+ subkomponen picker/drawer)
pukat-app/src/utils/downloadBlob.js              (atau nama serupa — util download PDF)
```

### Frontend — diedit

```text
pukat-app/src/api/campaignApi.js
pukat-app/src/api/queryKeys.js
pukat-app/src/hooks/mutations/useCampaignMutations.js
pukat-app/src/config/appRoutes.jsx
pukat-app/src/features/campaigns/Views/MonitoringView.jsx
```

## 16. Testing and Verification Matrix

### Backend

```text
php -l untuk setiap file yang diubah/baru
Migration idempotency check (jalankan maybe_upgrade() dua kali)
RBAC migration check: role dengan capability lama (campaigns.cancel) otomatis dapat capability baru (campaigns.complete)
Smoke test baru (tools/smoke-campaign-groups.php, pola sama seperti smoke-role-controller.php):
  - permission boundary (admin vs operator vs viewer, lintas entity)
  - CRUD Campaign Group + entity auto-assign
  - assign-to-group dengan entity mismatch (harus ditolak untuk non-admin)
  - complete + bulk-complete (termasuk kasus partial failure)
  - report per-group dan report_active()
Smoke test generik yang sudah ada (tools/smoke-table-api.php) otomatis meng-cover table_key campaign_runs baru — jalankan ulang, harus tetap 100% pass
```

### Frontend

```text
npm run lint
npm run build
npm run test
```

### End-to-end

Lihat §14 Phase 11.

## 17. Rollout Strategy

- Phase 1-2 (schema + rename Complete) adalah **behavior change** pada endpoint yang sudah dipakai (`/cancel` jadi `/complete`, hasil status berubah) — kalau ada frontend lain (di luar plan ini) yang masih memanggil `/cancel` lama, itu akan patah. Grep seluruh `pukat-app/src` untuk `runCancel`/`/cancel` sebelum deploy Phase 2 untuk pastikan tidak ada pemanggil yang terlewat.
- Phase 3-7 (backend Campaign Group + PDF) bersifat additive murni — aman dideploy sebelum frontend-nya (Phase 9-10) selesai, tidak ada yang memanggilnya sampai UI-nya ada.
- Phase 9-10 (frontend) baru dideploy setelah backend Phase 2-8 selesai dan smoke test hijau — jangan deploy frontend yang menunjuk endpoint yang belum ada.

## 18. Risks and Mitigations

Sudah didokumentasikan lengkap di `docs/PRD_CAMPAIGN_GROUP_MONITORING.md` §10 — daftar ini cuma menambah mitigasi teknis konkret per risiko:

- **Rename `/cancel` → `/complete` mematahkan pemanggil lama.** Mitigasi: grep menyeluruh (§17), dan deploy Phase 2 sebagai satu unit (backend + tidak ada frontend lama yang masih manggil `/cancel`).
- **Migrasi RBAC capability kalau salah urutan bisa mencabut akses operator tanpa memberi gantinya.** Mitigasi: urutan wajib `add_cap` baru **sebelum** `remove_cap` lama di blok migrasi yang sama (§5), jangan pernah kebalik.
- **N+1 di `report_active()`.** Mitigasi konkret sudah di §9 — satu query run + satu query group, agregasi di PHP.
- **dompdf gagal render kalau versi PHP/extension tidak cocok.** Mitigasi: cek requirement dompdf (butuh ext `mbstring`, `dom`) tersedia di environment sebelum Phase 7 dianggap selesai — kalau tidak tersedia di server produksi user, ini blocking, harus dikomunikasikan sebelum lanjut.
- **Status `cancelled` jadi dead value** — tidak perlu mitigasi aktif di plan ini (keputusan PRD sudah final menerima ini), cukup dicatat di code comment tempat enum status didefinisikan supaya developer berikutnya tidak bingung kenapa nilai itu tidak pernah muncul di data baru.

## 19. Open Decisions

Tidak ada — PRD §11 sudah menyatakan semua open question resolved. Satu keputusan teknis kecil yang masih perlu dikonfirmasi **saat coding** (bukan blocking desain, cuma detail implementasi): pendekatan response binary PDF lewat REST API WordPress vs endpoint custom (§10 Phase 7 poin 3) — dicoba REST biasa dulu, baru dialihkan ke custom endpoint kalau ada hambatan teknis nyata.

## 20. MVP Completion Criteria

- Satu aksi "Complete" (bukan dua tombol) mengakhiri Campaign Run, hasil selalu `status = 'completed'`.
- Campaign Group bisa dibuat, entity-nya otomatis dari pembuat, tidak bisa dipilih manual atau dipalsukan dari klien.
- Status Campaign Group (Active/Selesai) selalu dihitung real-time dari anggotanya, tidak pernah stale karena tidak disimpan.
- Assign campaign ke group lintas entity ditolak untuk non-admin.
- Bulk complete berjalan dengan pelaporan hasil per-item, bukan all-or-nothing.
- Monitoring menampilkan funnel stats nyata per group / seluruh group aktif / per campaign, berubah sesuai pilihan.
- Export PDF menghasilkan file PDF yang benar-benar valid dan terbuka.
- `npm run lint/build/test`, `php -l`, dan seluruh smoke test (baru + yang sudah ada) hijau.
