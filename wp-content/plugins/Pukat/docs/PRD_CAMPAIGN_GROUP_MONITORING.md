# PRD: Campaign Group & Monitoring — Status, Lifecycle Actions, and Reporting

Status: Draft
Date: 2026-09-02
Owner: Pukat Product and Engineering
Related area: Backend Campaign Run lifecycle (`includes/Services/CampaignRunService.php`, `includes/Api/CampaignRunController.php`), new Campaign Group entity, React frontend Monitoring/Manage pages
Related PRD:
- `docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md` (Campaign Run is the entity this PRD builds on — the legacy `pukat_campaigns` table is out of scope here, see §2.1)

## 1. Ringkasan

Setelah PIC (person in charge) mengirim campaign berbasis Playbook, PIC butuh:

1. Melihat status real-time dari campaign yang ia kirim.
2. Mengakhiri campaign yang sedang berjalan lewat **satu tombol yang sama** — baik karena mau dihentikan lebih awal (cancel/recall) maupun karena memang sudah selesai (complete). Lihat §7.1 — awalnya dirancang dua aksi terpisah, digabung jadi satu setelah diskusi karena secara teknis efeknya ke GoPhish memang identik.
3. Memonitor hasil campaign — baik per campaign individual, maupun teragregasi per **Campaign Group**: sebuah pengelompokan campaign berdasarkan project/periode pengetesan awareness tertentu.
4. Mengubah status banyak campaign sekaligus (bulk) atau sebagian (partial) dalam satu Campaign Group, tanpa harus membuka satu-satu.
5. Mengunduh hasil monitoring dalam format PDF.

Campaign Group ada supaya PIC tidak perlu melacak setiap pengiriman campaign satu per satu — satu Campaign Group merepresentasikan satu periode/project pengetesan (mis. "Awareness Wave Q3 2026") yang berisi banyak campaign send, dan bisa dikelola/dilaporkan sebagai satu kesatuan.

## 2. Latar Belakang

### 2.1 Entity dasar: Campaign Run, bukan Campaign legacy

Codebase punya dua model campaign yang paralel:

- `pukat_campaigns` (legacy, `CampaignController.php`) — sudah tidak dipakai wizard sejak `docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`, hanya dipertahankan untuk backward compatibility.
- `pukat_campaign_runs` (`CampaignRunService.php`/`CampaignRunController.php`) — entity yang benar-benar dikirim ke GoPhish lewat wizard Playbook-first. **Ini yang jadi dasar PRD ini.**

### 2.2 Lifecycle Campaign Run yang sudah ada

`pukat_campaign_runs.status` sudah berjalan lewat state: `draft_run → ready_for_sync → synced → running/scheduled → completed/cancelled`. Endpoint yang sudah ada di baseline (`CampaignRunController.php`):

- `POST /campaign-runs/{id}/cancel` — sudah ada, gated `campaigns.cancel`. Memanggil GoPhish `complete_campaign()` API (satu-satunya aksi terminal yang GoPhish sediakan) lalu set `status = 'cancelled'`. Ini yang paling dekat dengan kebutuhan "cancel/recall" di §1.
- **Belum ada** endpoint "complete" yang terpisah dari cancel — `status = 'completed'` saat ini hanya pernah di-set otomatis oleh `sync_results()` ketika data hasil dari GoPhish menunjukkan campaign sudah selesai secara alami. Tidak ada aksi manual "tandai selesai".
- `GET /campaign-runs/{id}/report` — sudah mengembalikan funnel stats asli (`total`, `email_sent`, `email_opened`, `clicked`, `submitted_data`, rate masing-masing) untuk **satu** Campaign Run, dari `metrics_json` yang di-cache saat sync.

### 2.3 Tidak ada konsep "Campaign Group"

Satu-satunya "group" yang ada di kode adalah GoPhish *target group* (daftar recipient email) — beda total dari pengelompokan project/periode yang dimaksud PRD ini. Belum ada tabel, service, atau UI untuk mengelompokkan Campaign Run.

### 2.4 Monitoring & Reports masih dummy

`/monitoring`, tab Monitoring di workspace campaign, dan `/reports` semuanya masih data statis di setiap layer frontend — tidak ada yang memanggil `GET /campaign-runs/{id}/report` yang sudah nyata di §2.2.

### 2.5 Belum ada kapabilitas PDF maupun bulk action

- Tidak ada library PDF di `composer.json` (backend) atau `package.json` (frontend) — export sejauh ini hanya CSV (`rows` + `filename` JSON, dirender jadi file di sisi klien).
- `DataTable` frontend sudah punya skeleton `bulk_actions`/`onBulkAction`, tapi belum pernah dipakai untuk aksi lifecycle (cancel/complete) — baru pernah dirancang untuk export.

### 2.6 Catatan housekeeping

Migrasi database `pukat_campaign_groups` beserta kolom `campaign_group_id`/`archived_at` di `pukat_campaign_runs` sempat dijalankan di environment dev pada eksplorasi sebelumnya dan **belum di-rollback** (opsi `pukat_db_version` di DB sudah tercatat `1.8.0`), walau source code migrasinya sendiri sudah tidak ada lagi. PRD ini akan mendefinisikan ulang struktur data yang dibutuhkan dari nol — implementasi nanti perlu memverifikasi/menyelaraskan state DB dev ini (lihat §10 Risks) sebelum menulis migrasi baru dengan version number yang sama.

## 3. Tujuan

- PIC dapat melihat status real-time setiap Campaign Run yang relevan baginya.
- PIC dapat mengakhiri campaign yang sedang berjalan lewat satu aksi — mencakup makna cancel/recall maupun complete (lihat §7.1).
- PIC dapat membuat dan mengelola Campaign Group untuk merepresentasikan satu project/periode pengetesan awareness, dan menetapkan campaign ke dalamnya.
- PIC dapat memonitor hasil agregat per Campaign Group (utamanya yang berstatus aktif) atau per campaign individual.
- PIC dapat mengubah status banyak campaign sekaligus (bulk) maupun sebagian (partial) dalam satu Campaign Group — tanpa membuka satu-satu.
- PIC dapat mengunduh hasil monitoring dalam format PDF.

## 4. Non-Tujuan

- Membangun ulang breakdown per-departemen, live event feed, grafik per-jam dengan data asli — backend aggregation untuk itu belum ada dan di luar scope PRD ini kecuali dinyatakan lain di §11.
- Redesain halaman `/reports` yang sudah ada (`Reports.jsx`) — export PDF di PRD ini spesifik untuk halaman Monitoring/Campaign Group, bukan `/reports`.
- "Recall" dalam arti menarik kembali email yang sudah terkirim ke inbox penerima — GoPhish tidak punya API untuk itu. "Cancel/Recall/Complete" di PRD ini semuanya berarti menghentikan/mengakhiri campaign supaya tidak melanjutkan pengiriman/tracking, bukan unsend email yang sudah delivered.
- Legacy `pukat_campaigns`/`CampaignController` — tidak disentuh, tetap compatibility-only.
- Notifikasi otomatis (email/Slack) saat status campaign berubah — tidak diminta, di luar scope.

## 5. Scope

### 5.1 In Scope

Backend:

```text
includes/Core/Activator.php                          — tabel pukat_campaign_groups + kolom baru di pukat_campaign_runs
includes/Repositories/CampaignGroupRepository.php     — CRUD Campaign Group
includes/Repositories/Table/CampaignRunTableRepository.php — list/filter/sort Campaign Run server-driven table
includes/Services/CampaignGroupService.php            — validasi, agregasi report per group/per status aktif
includes/Services/CampaignRunService.php              — retarget method `cancel()` supaya hasilnya `status = 'completed'` (lihat §6.4/FR-2), tambah bulk_complete()
includes/Api/CampaignGroupController.php              — REST CRUD + report + bulk endpoint
includes/Api/CampaignRunController.php                — tambah bulk-complete endpoint; rename route `/cancel` → `/complete` (lihat §8)
includes/Services/TableRegistry.php                   — table_key baru untuk Campaign Run list
```

Frontend:

```text
pukat-app/src/features/campaigns/Manage/*             — halaman kelola Campaign Group + bulk action UI
pukat-app/src/features/campaigns/Views/MonitoringView.jsx — status real-time, funnel per campaign/group, export PDF
pukat-app/src/api/campaignGroupApi.js, campaignApi.js — endpoint baru
pukat-app/src/hooks/**                                 — query/mutation hooks terkait
```

### 5.2 Out of Scope

```text
pukat-app/src/pages/Simulation/Reports.jsx dan turunannya (ReportView, ReportPane, dst.)
Breakdown per-departemen, live event feed, grafik per-jam dengan data asli
Legacy pukat_campaigns / CampaignController.php
Notifikasi otomatis perubahan status
```

## 6. Definisi

### 6.1 PIC (Person In Charge)

User yang mengirim/mengelola campaign — dalam RBAC yang ada, dipetakan ke role `pukat_operator` (kapabilitas `campaigns.create/edit/delete/launch/cancel`) atau `pukat_admin`.

### 6.2 Campaign Run

Instance campaign yang benar-benar dikirim ke GoPhish lewat wizard Playbook. Satu Campaign Run = satu pengiriman (satu jadwal, satu snapshot target/template).

### 6.3 Campaign Group

Pengelompokan sejumlah Campaign Run ke dalam satu project/periode pengetesan awareness. Satu Campaign Run masuk ke paling banyak satu Campaign Group (folder-style, bukan tag). Punya status sendiri (lihat §7.2) yang independen dari status masing-masing Campaign Run di dalamnya, dan punya `entity` sendiri yang otomatis mengikuti entity pembuatnya (lihat FR-6a) — bukan field yang dipilih manual saat membuat group.

### 6.4 Complete (keputusan final — sebelumnya Cancel/Recall dan Complete dua aksi terpisah)

**Satu aksi tunggal, diberi label "Complete"**, untuk mengakhiri Campaign Run yang sedang berjalan — dipakai baik untuk menghentikan lebih awal (cancel/recall) maupun untuk menandai sudah selesai secara normal. Bukan berarti menarik kembali email yang sudah terkirim (lihat §4). Hasil akhirnya selalu **`status = 'completed'`** — bukan `'cancelled'` seperti rancangan sebelumnya.

Secara teknis ini berarti method/endpoint `cancel` yang sudah ada di baseline (`/campaign-runs/{id}/cancel`, lihat §2.2) **diretarget** supaya menyetel `status = 'completed'`, bukan `'cancelled'`. Karena nama endpoint yang lama sudah tidak mencerminkan hasilnya, PRD ini merekomendasikan endpoint & permission-nya di-rename mengikuti (`/cancel` → `/complete`, capability `campaigns.cancel` → `campaigns.complete`) — detail migrasi untuk role yang sudah punya capability lama diputuskan di implementation plan (lihat §8, §10).

**Konsekuensi penting:** status `cancelled` — yang sebelumnya bagian dari state machine di §2.2 — menjadi status yang **tidak pernah tercapai lagi** lewat aksi manual manapun setelah perubahan ini (lihat risiko di §10).

### 6.5 Bulk vs Partial

*Bulk* = memilih banyak/semua Campaign Run dalam satu Campaign Group lalu menjalankan Complete sekaligus. *Partial* = memilih sebagian saja (tidak harus semua anggota group) untuk aksi yang sama.

## 7. Functional Requirements

### 7.1 Status & lifecycle actions per Campaign Run

- FR-1: PIC dapat melihat status Campaign Run (draft_run/ready_for_sync/synced/scheduled/running/completed/cancelled) dan funnel stats real (sent/opened/clicked/submitted) dari `GET /campaign-runs/{id}/report` yang sudah ada.
- **FR-2 (keputusan final — awalnya dirancang FR-2 "cancel" + FR-3 "complete" terpisah):** PIC dapat menjalankan **"Complete"** pada satu Campaign Run yang sedang `synced/scheduled/running` — dipakai untuk kedua use case, baik menghentikan lebih awal maupun menandai sudah selesai (lihat §6.4). Hasil akhir selalu `status = 'completed'`. **Tidak ada tombol/endpoint "Cancel" terpisah.** UI menampilkan konfirmasi sebelum eksekusi (aksi ireversibel terhadap GoPhish).

### 7.2 Campaign Group

- FR-4: PIC dapat membuat, mengubah nama/deskripsi, dan menghapus Campaign Group. Menghapus group tidak menghapus campaign di dalamnya — campaign menjadi "Ungrouped".
- **FR-5 (keputusan — sebelumnya open question):** Campaign Group **tidak punya field status tersimpan sendiri** — status `Active`/`Selesai` **dihitung otomatis** dari status Campaign Run anggotanya, dengan aturan:
  - **Active**: minimal ada satu Campaign Run anggota yang belum mencapai status akhir (yaitu belum `completed` atau `cancelled` — termasuk `draft_run`, `ready_for_sync`, `synced`, `scheduled`, `running`). Ini menjawab pertanyaan "bagaimana kalau status campaign berbeda-beda" — selama masih ada satu saja yang jalan, Group tetap Active.
  - **Selesai**: hanya kalau **semua** Campaign Run anggota sudah `completed` atau `cancelled` (dan minimal ada 1 anggota).
  - Group kosong (belum ada Campaign Run sama sekali) dianggap **Active** secara default.
  - Karena status ini dihitung, bukan disimpan, tidak ada tombol "Close group" manual — kalau PIC menambahkan Campaign Run baru ke Group yang statusnya sudah "Selesai", Group otomatis kembali jadi "Active" (tidak ada restriksi menambah campaign ke group yang "Selesai").
- FR-6: PIC dapat menetapkan (assign) satu Campaign Run ke satu Campaign Group, atau memindahkannya ke group lain / melepasnya jadi "Ungrouped" — dibatasi ke Campaign Group yang entity-nya sama dengan entity Campaign Run tersebut (lihat FR-6a), kecuali oleh admin.
- **FR-6a (keputusan — sebelumnya open question):** `entity` Campaign Group **diisi otomatis dari entity user yang membuatnya** (`current_user_entity()`, mekanisme yang sama dipakai `CampaignRunService`), bukan field yang dipilih manual di form create. Visibility Campaign Group memakai pola yang persis sama dengan `current_user_can_access_playbook()` yang sudah ada: admin melihat semua group; non-admin hanya melihat group yang `entity`-nya sama dengan entity dirinya sendiri. Konsekuensinya: agregasi report per Campaign Group (FR-7/FR-8) otomatis ikut ter-scope ke entity yang sama, karena hanya berisi Campaign Run yang entity playbook-nya cocok dengan entity group (ditegakkan lewat FR-6).

### 7.3 Monitoring & aggregasi

- FR-7: Halaman Monitoring menampilkan funnel stats teragregasi (jumlah + rate sent/opened/clicked/submitted) untuk: satu Campaign Group tertentu, seluruh Campaign Group berstatus Active (dihitung sesuai aturan FR-5), atau satu Campaign Run individual — dipilih lewat selector.
- FR-8: Aggregasi dihitung dari `metrics_json` yang sudah tersimpan per Campaign Run (bukan live call ke GoPhish per request) — konsisten dengan cara `report()` yang sudah ada bekerja.

### 7.4 Bulk/partial status change

- **FR-9 (keputusan — sebelumnya open question):** Di halaman kelola Campaign Group, PIC dapat memilih beberapa Campaign Run (checkbox, sebagian atau seluruhnya) dalam satu group lalu menjalankan **Complete** (FR-2) untuk semua yang dipilih sekaligus — satu aksi bulk saja, sesuai keputusan penggabungan di §6.4. Archive dan pindah-group **tidak** termasuk aksi bulk di fase ini (tetap per-campaign satu-satu).
- FR-10: Hasil bulk action menampilkan ringkasan per item (berhasil/gagal + alasan) — bukan silent all-or-nothing, karena tiap Campaign Run bisa berada di status berbeda (mis. satu sudah `completed` sebelumnya, tidak valid untuk di-complete lagi).

### 7.5 Export PDF

- **FR-11 (keputusan — sebelumnya open question):** PIC dapat mengunduh hasil monitoring (funnel stats + daftar campaign yang jadi sumber agregasi) dalam format PDF **asli, digenerate oleh backend** (bukan browser print-to-PDF), untuk cakupan yang sedang ditampilkan (satu group / seluruh group aktif / satu campaign). Ini menambah dependency PHP baru ke `composer.json` (belum pernah ada library PDF sebelumnya di project ini) — **disetujui eksplisit oleh user**, sesuai aturan `AGENTS.md` §3 yang mewajibkan persetujuan untuk dependency baru. Kandidat library: `dompdf/dompdf` (pure-PHP, tanpa binary/dependency sistem eksternal, umum dipakai di plugin WordPress) — pemilihan final di implementation plan.

## 8. API Impact

| Endpoint | Perubahan |
|---|---|
| `POST /campaign-runs/bulk-complete` | **Baru.** Body `{ ids: number[] }` — jalankan aksi Complete (FR-2) untuk tiap id, balikan per-item hasil (FR-10). Tidak ada parameter `action` karena cuma satu aksi (FR-2/FR-9). |
| `POST /campaign-runs/{id}/assign-group` | **Baru.** Body `{ campaign_group_id: number\|null }`. |
| `GET/POST /campaign-groups`, `GET/PUT/DELETE /campaign-groups/{id}` | **Baru.** CRUD Campaign Group, termasuk field `status`. `entity` **tidak** diterima dari body request — selalu diisi backend dari `current_user_entity()` milik pembuat (FR-6a), supaya tidak bisa dipalsukan dari klien. |
| `GET /campaign-groups/{id}/report`, `GET /campaign-groups/active/report` | **Baru.** Aggregasi funnel stats — per group tertentu atau seluruh group yang lolos aturan "Active" di FR-5 (dihitung saat request, bukan `WHERE status = 'active'` karena tidak ada kolom status tersimpan). |
| `GET /campaign-groups/{id}/report/export`, `GET /campaign-groups/active/report/export`, `GET /campaign-runs/{id}/report/export` | **Baru.** Balikan file PDF (bukan JSON `rows`+`filename` seperti export CSV yang sudah ada) — response `Content-Type: application/pdf`, di-generate backend saat request (FR-11). |
| `GET /campaign-runs/{id}/report` | Tidak berubah — dipakai ulang sebagai sumber data agregasi. |
| `POST /campaign-runs/{id}/cancel` → **direkomendasikan rename jadi** `POST /campaign-runs/{id}/complete` | **Behavior berubah**: sebelumnya set `status = 'cancelled'`, sekarang set `status = 'completed'` (FR-2/§6.4). Permission capability `campaigns.cancel` direkomendasikan ikut di-rename jadi `campaigns.complete` — perlu langkah re-seed RBAC untuk role existing (pola sama seperti migrasi permission key sebelumnya di `Activator::maybe_upgrade()`). |
| `GET /tables/campaign_runs/{schema,rows}` | **Baru.** Table server-driven untuk list Campaign Run (search/filter/sort/pagination), mengikuti pola `TableRegistry`/`TableQueryService` yang sudah ada untuk tabel lain. |

## 9. Acceptance Criteria

- PIC (role operator/admin, entity yang sesuai) bisa melihat status dan funnel stats real dari Campaign Run yang ia kirim, tanpa data dummy.
- Klik "Complete" pada campaign yang sedang berjalan menghasilkan status `completed` dan campaign berhenti di GoPhish — tombol yang sama dipakai baik untuk menghentikan lebih awal maupun menandai selesai (tidak ada tombol/status "Cancel" manual terpisah).
- Membuat Campaign Group baru, menetapkan beberapa Campaign Run ke dalamnya, lalu membuka Monitoring dengan filter group tersebut menampilkan funnel stats yang benar-benar merupakan jumlah dari campaign run anggotanya saja.
- Memilih 2+ campaign dalam satu group lalu menjalankan bulk "Complete" menghasilkan status `completed` untuk semua yang valid, dan pesan error yang jelas untuk yang tidak valid (mis. sudah `completed` sebelumnya).
- Tombol export PDF menghasilkan file yang berisi funnel stats dan daftar campaign sumber agregasi yang sedang ditampilkan.
- Tidak ada regresi pada `npm run lint`, `npm run build`, `npm run test`, dan `php -l` untuk file yang diubah.

## 10. Risks

- **State DB dev sudah mendahului source code** (lihat §2.6) — migrasi lama yang sempat jalan (`pukat_db_version = 1.8.0`) perlu diverifikasi/diselaraskan dulu sebelum menulis migrasi baru, supaya tidak terjadi tabrakan version number atau skema yang berbeda dari yang diasumsikan source code baru.
- **Campaign yang diakhiri manual lebih awal dan yang memang selesai normal tercatat status yang sama** (`completed`, akibat penggabungan tombol di §6.4) — data tidak lagi membedakan "PIC menghentikan paksa" vs "PIC menutup campaign yang sudah selesai wajar". Kalau nanti dibutuhkan pembeda untuk audit/pelaporan, perlu field tambahan (mis. `ended_reason`) — di luar scope PRD ini kecuali dinyatakan lain.
- **Status `cancelled` jadi dead state** — sebelum keputusan ini, `cancelled` adalah bagian resmi dari state machine Campaign Run (§2.2). Setelah aksi manual diretarget untuk selalu menghasilkan `completed` (§6.4), tidak ada jalur manapun (manual atau otomatis lewat `sync_results()`) yang akan pernah menghasilkan `cancelled` lagi — nilai itu tetap ada di skema/enum tapi tidak akan pernah terisi data baru. Perlu diputuskan di implementation plan: dibiarkan sebagai legacy value, atau dibersihkan dari kode (badge/filter status yang masih menyebut `cancelled`).
- **Rename endpoint & permission `cancel` → `complete`** (§8) — kalau ada role existing yang sudah punya capability `campaigns.cancel`, perlu langkah migrasi RBAC eksplisit (re-seed) supaya operator yang sebelumnya bisa cancel tidak kehilangan akses begitu capability-nya di-rename.
- **Bulk action pada campaign dengan status campuran** — perlu desain UX yang jelas untuk partial failure (FR-10), supaya PIC tidak mengira aksi gagal total padahal sebagian berhasil.
- **Export PDF menambah dependency PHP baru** (keputusan FR-11, disetujui user) — perlu dipilih library yang ringan dan tidak butuh binary/extension sistem tambahan (mis. `dompdf/dompdf`) supaya tidak menyulitkan deployment; perlu dicek kompatibilitas dengan PHP 8.1+ (persyaratan minimum `composer.json` saat ini) dan diuji generate PDF dengan data funnel stats + tabel campaign sebelum dianggap selesai.
- **Menghitung "Active" Campaign Group on-the-fly** (FR-5) — karena bukan kolom tersimpan, filter "group aktif" di listing/report harus menghitung status semua Campaign Run anggota tiap kali di-query. Perlu dipastikan query-nya efisien (tidak N+1) kalau jumlah Campaign Group dan Campaign Run bertambah banyak.
- **Entity-based visibility scoping** (keputusan FR-6a) mewarisi keterbatasan yang sudah ada di `CampaignRunService::current_user_can_access_run()` — PIC dalam entity yang sama bisa saling melihat/mengelola Campaign Group dan Campaign Run satu sama lain, bukan hanya yang dia buat sendiri.
- **Campaign Run pindah entity setelah dibuat** — kalau `entity` Playbook Master sumber sebuah Campaign Run berubah setelah campaign itu di-assign ke sebuah Campaign Group, group tersebut bisa berisi campaign yang entity-nya sudah tidak cocok lagi. FR-6 mencegah ini saat assignment terjadi, tapi tidak ada mekanisme re-validasi berkelanjutan — perlu diputuskan apakah ini risiko yang diterima atau perlu guard tambahan (mis. `entity` Playbook Master di-lock setelah dipakai Campaign Run manapun — di luar scope PRD ini kalau iya).

## 11. Open Questions

Semua poin di bagian ini sudah diputuskan lewat diskusi (ditandai **Resolved**) dan sudah dituliskan ke FR terkait — tidak ada open question tersisa dari sisi requirement.

- ~~Lingkup visibility PIC~~ — **Resolved**: per-entity/departemen, mengikuti pola RBAC entity-based yang sudah ada (`CampaignRunService::current_user_can_access_run()`), bukan hanya campaign yang dibuat sendiri (`created_by`).
- ~~Entity Campaign Group~~ — **Resolved**: otomatis mengikuti entity pembuatnya, tidak dipilih manual (FR-6a).
- ~~Status Campaign Group~~ — **Resolved**: tidak ada field status tersimpan, dihitung otomatis dari status Campaign Run anggotanya (FR-5) — Active kalau minimal satu anggota belum di status akhir, Selesai kalau semua sudah `completed`.
- ~~Pendekatan export PDF~~ — **Resolved**: PDF asli digenerate backend, bukan browser print (FR-11). Menambah dependency PHP baru — sudah disetujui.
- ~~Cakupan aksi bulk~~ — **Resolved**: satu aksi "Complete" saja (FR-9). Archive dan pindah-group tetap per-campaign satu-satu.
- ~~"Cancel" vs "Complete" sebagai dua endpoint terpisah~~ — **Resolved**: digabung jadi satu aksi/tombol berlabel **"Complete"** (§6.4/FR-2), hasil akhir selalu `status = 'completed'`. Endpoint `cancel` yang lama direkomendasikan di-rename jadi `complete` (§8) mengikuti behavior barunya.
- ~~Istilah "Recall"~~ — **Resolved**: bagian dari aksi tunggal "Complete" (§6.4) — berarti menghentikan/mengakhiri campaign, bukan menarik kembali email yang sudah terkirim (§4).
