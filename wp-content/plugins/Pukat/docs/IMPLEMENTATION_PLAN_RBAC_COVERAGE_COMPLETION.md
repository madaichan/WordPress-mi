# Implementation Plan: RBAC Coverage Completion

Status: Draft
Date: 2026-10-20
PRD: `docs/PRD_RBAC_COVERAGE_COMPLETION.md`
Lanjutan dari: `docs/IMPLEMENTATION_PLAN_RBAC.md` (selesai)

## 1. Ringkasan

Rencana ini memecah `docs/PRD_RBAC_COVERAGE_COMPLETION.md` jadi 5 PR utama + 1 PR opsional. Urutannya mengikuti pola `docs/IMPLEMENTATION_PLAN_RBAC.md`: **additive dulu, ganti call site kemudian.** PR 1 hanya menambah key + migration (belum ada gate yang berubah), PR 2-4 memindahkan call site satu kelompok per PR, PR 5 QA regresi. Setiap PR bisa direvert sendiri tanpa mematikan RBAC yang sudah jalan.

Risiko utama sepanjang rencana ini cuma satu: **lockout**. PR 2 mengubah capability yang menentukan apakah panel wp-admin bisa dibuka. Mitigasinya ada di §4 (urutan wajib: seed dulu di PR 1, baru pindah gate di PR 2) dan §9.

## 2. Current State (verifikasi ulang sebelum mulai)

Jalankan ulang inventori ini tepat sebelum PR 1 — kalau angkanya berbeda, ada perubahan yang masuk setelah PRD ditulis dan PRD perlu di-update dulu.

```bash
# 1. Jumlah key registry (harapan: 77)
docker exec plugindev_wordpress php wp-content/plugins/Pukat/tools/smoke-permission-registry.php

# 2. Call site capability legacy (harapan: 8 helper + 3 lokasi admin panel)
grep -rn "pukat_manage_settings\|pukat_manage_users" wp-content/plugins/Pukat/includes/

# 3. Key registry yang tidak dibaca backend (harapan: 6 — 4 mati + monitoring/calendar by design)
grep -rhoE "'[a-z_]+\.[a-z_]+'" wp-content/plugins/Pukat/includes/ | sort -u
```

Kondisi yang sudah terverifikasi (2026-10-20):

- `pukat_db_version` terakhir: `1.24.0` (`includes/Core/Activator.php:925`).
- `PermissionRegistry::MENUS`: 22 menu, 77 key.
- `RestController::permission_read()/permission_manage()/permission_admin()` masih ada tapi **nol consumer** (`grep -rn "'permission_read'\|'permission_manage'\|'permission_admin'" includes/` kosong) — ini bahan PR 6 opsional.
- `current_user_can_admin_assets()` diduplikasi 8× (daftar lengkap di PRD §2.2).
- Smoke test yang relevan dan sudah ada: `tools/smoke-permission-registry.php` (standalone, tanpa WP), `tools/smoke-rbac-seed.php`, `tools/smoke-role-controller.php`, `tools/smoke-phase3-regression.php`, `tools/smoke-phase7-qa.php`.

## 3. Target Architecture

```text
PermissionRegistry::MENUS
  + 'admin_panel'      => has_view: true,  view_gate: admin, actions: []
  + 'asset_governance' => has_view: false, actions: [ 'manage_all' => 'admin' ]
  ~ 'guardrails'       => has_view: false  (key `guardrails.view` hilang)

AdminMenu / AdminPage         -> capability_for('admin_panel.view') + key halaman per submenu
8× current_user_can_admin_assets() -> capability_for('asset_governance.manage_all') || administrator
MasterComponentService::enforce_write_entity($data, $key, $existing, $assign_key)
MasterComponentService domain update -> authorization_status butuh domains.authorize
```

Capability legacy (`pukat_manage_settings`/`pukat_manage_users`) tetap di-grant `Activator::add_roles()` sampai PR 6 opsional — jadi selama PR 1-5, sistem lama dan baru hidup berdampingan dan tidak ada titik di mana panel wp-admin kehilangan penjaga.

## 4. PR 1 — Registry + Migration (tanpa perubahan gate)

File: `includes/Services/PermissionRegistry.php`, `includes/Core/Activator.php`, `tools/smoke-permission-registry.php`.

1. `PermissionRegistry::all()` — dukung flag `has_view` (default `true`): kalau `false`, skip pembuatan entry `.view` dan jangan baca `view_gate`.
2. Tambah menu `admin_panel` (group `Admin`, `view_gate` `admin`, `actions` kosong) dengan label yang menyebut statusnya sebagai prasyarat (PRD §5.1).
3. Tambah menu `asset_governance` (group `Governance`, `has_view` `false`, action `manage_all` gate `admin`) + doc comment yang menyebut 8 call site-nya dan blast radius-nya (PRD §12).
4. Set `'has_view' => false` pada menu `guardrails` existing, hapus `view_gate`-nya.
5. `maybe_upgrade()` blok baru `1.25.0`: `self::seed_rbac_defaults();` lalu loop `remove_cap( 'pukat_guardrails_view' )` untuk semua role di `wp_roles()`. Doc comment-nya merujuk pola blok `1.7.2`/`1.9.0` (add_cap additive, penghapusan harus eksplisit).
6. Perluas `tools/smoke-permission-registry.php`: menu `has_view:false` tidak memancarkan `.view`; `admin_panel.view` dan `asset_governance.manage_all` ada; `guardrails.view` tidak ada; total key = 78.

**Belum ada satu pun `permission_callback`/`current_user_can()` yang berubah di PR ini.** Capability baru sudah ada di role Admin/administrator, tapi belum dibaca siapa pun.

Validasi:

```bash
php wp-content/plugins/Pukat/tools/smoke-permission-registry.php   # standalone, bisa di luar container
docker exec plugindev_wordpress php wp-content/plugins/Pukat/tools/smoke-rbac-seed.php
docker exec plugindev_wordpress php -l wp-content/plugins/Pukat/includes/Services/PermissionRegistry.php
docker exec plugindev_wordpress php -l wp-content/plugins/Pukat/includes/Core/Activator.php
```

Plus cek manual: `pukat_admin` dan `administrator` punya `pukat_admin_panel_view` + `pukat_asset_governance_manage_all`; `pukat_operator`/`pukat_reviewer`/`pukat_viewer` tidak punya; tidak ada role yang masih punya `pukat_guardrails_view`.

**Gate PR berikutnya**: PR 2 tidak boleh mulai sebelum verifikasi capability di atas lulus di environment yang akan dipakai QA. Kalau seed belum mendarat lalu PR 2 masuk, pemegang `pukat_admin` kehilangan panel wp-admin.

## 5. PR 2 — Panel wp-admin ke Capability Registry

File: `includes/Admin/AdminMenu.php`, `includes/Admin/AdminPage.php`.

1. `AdminMenu::register()` top-level: `pukat_manage_settings` → `PermissionRegistry::capability_for( 'admin_panel.view' )`.
2. Array `$submenus`: setiap entri pakai `capability_for()` sesuai tabel PRD §7. Submenu `Open Front Page` tetap `read`.
3. Tambah 5 submenu baru sesuai PRD §7: Domains, Entities, Flag categories, Roles, My Profile — hash dan gate-nya **harus** sama dengan `permission` route di `pukat-app/src/config/appRoutes.jsx` (`domains.view`, `master_entities.oversee`, `flags.edit`, `users.manage_roles`, `read`).
4. `AdminPage::render_standalone()`: cek `capability_for( 'admin_panel.view' )`.
5. Perbarui doc comment top-level di `AdminMenu.php:28-33` — alasan "capability admin-only" sekarang jadi "capability dari registry, configurable lewat halaman Roles".
6. **Guard registrasi submenu** (ditemukan saat implementasi, tidak ada di draft awal rencana ini): loop `$submenus` hanya dijalankan kalau user punya `admin_panel.view`. Tanpa ini PR 2 justru *melebarkan* akses — sebagian besar key halaman (`dashboard.view`, `master_*.view`, `domains.view`) ber-gate `shared` sehingga dipegang juga oleh Operator/Viewer/Reviewer, dan WordPress hanya menghapus menu top-level kalau user tidak punya capability induk **dan** tidak ada satu pun submenu yang bisa diakses (`wp-admin/includes/menu.php`, loop "Remove menus that have no accessible submenus"). Hasilnya menu Pukat akan muncul untuk ketiga role itu dengan semua item mentok di redirect `AdminPage`. Sebelum PR 2 efek ini tertutup secara implisit karena semua submenu memakai `pukat_manage_settings`. Submenu `Open Front Page` tetap di luar guard — itu satu-satunya item yang memang dilihat role tanpa akses panel, sama seperti sekarang.

Validasi: `php -l` dua file, lalu manual di browser untuk 3 user:

| User | Harapan |
|---|---|
| `administrator` | panel terbuka, semua submenu (termasuk 5 yang baru) muncul |
| `pukat_operator` | menu Pukat tidak muncul; `?page=pukat_dashboard` ditolak |
| role custom baru: `admin_panel.view` + `settings.view` saja | panel terbuka, hanya submenu Settings + Open Front Page; `?page=pukat_users` ditolak |

Baris ke-3 adalah inti dari PRD ini (acceptance criteria §14.1) — jangan skip.

## 6. PR 3 — `asset_governance.manage_all`

File: 7 service + `includes/Api/GoPhishProxy.php` (daftar lengkap PRD §2.2).

1. Ganti isi ke-8 `current_user_can_admin_assets()`:
   `return current_user_can( PermissionRegistry::capability_for( 'asset_governance.manage_all' ) ) || current_user_can( 'administrator' );`
2. Tambah `use Pukat\Services\PermissionRegistry;` di file yang belum punya.
3. **Jangan** ekstrak jadi trait/helper baru di PR ini. Isinya sekarang satu baris dan sudah identik di 8 tempat; memindahkannya ke lokasi baru membuat diff PR ini bercampur antara perubahan perilaku dan refactor struktur — dedup bisa jadi PR terpisah setelah QA lewat. (Kalau reviewer minta sebaliknya, pindahkan ke satu method publik di `UserContextService` yang sudah ada, bukan trait baru.)
4. Jaga `EntityProfileService::current_user_can_admin_assets()` tetap `public` — dipanggil dari luar kelasnya.

Validasi: `php -l` per file, lalu smoke test write-path lintas entity:

```bash
docker exec plugindev_wordpress php wp-content/plugins/Pukat/tools/smoke-phase3-regression.php
docker exec plugindev_wordpress php wp-content/plugins/Pukat/tools/smoke-playbook-master.php
```

Manual: role custom dengan `master_playbooks.edit` + `asset_governance.manage_all` bisa edit Playbook Master ber-entity `General`; tanpa key itu kena 403 dengan pesan entity yang sudah ada. **Uji tulis hanya pada baris throwaway yang dibuat oleh test itu sendiri, jangan pada data nyata.**

## 7. PR 4 — Aktifkan 3 Toggle Mati

File: `includes/Services/MasterComponentService.php` (+ caller-nya di file yang sama).

1. `enforce_write_entity( array &$data, string $entity_key, ?array $existing = null, ?string $assign_key = null )` — early-return menjadi:
   `if ( $this->current_user_can_admin_assets() || ( null !== $assign_key && current_user_can( PermissionRegistry::capability_for( $assign_key ) ) ) ) { return null; }`
2. Caller email template master (`:107`, `:157`, `:220`) kirim `'master_email_templates.assign_entity'`; caller landing page master (`:449`, `:499`, `:562`) kirim `'master_landing_pages.assign_entity'`. Caller lain (sending profile refs, dll) tidak diubah — tetap `null`, perilakunya sama seperti sekarang.
3. Update domain: kalau `authorization_status` yang diminta berbeda dari nilai existing dan user tidak punya `domains.authorize`, pertahankan nilai existing (jangan 403 seluruh request) — PRD §8. Implementasinya satu guard di sekitar `authorization_status_value()` (`:1767`), plus doc comment yang menyebut kenapa bukan 403.
4. Catat di doc comment `enforce_write_entity()` bahwa `master_sending_profiles.assign_entity` punya jalur sendiri di `GoPhishProxy.php:239` dan sengaja tidak lewat sini.

Validasi: `php -l`, lalu smoke test khusus (boleh tambah skenario ke `tools/smoke-phase3-regression.php` atau file baru `tools/smoke-rbac-coverage.php`):

- `master_email_templates.edit` tanpa `.assign_entity` → tulis dengan `entity` lain ditolak 403.
- dengan `.assign_entity` → sukses.
- `domains.edit` tanpa `domains.authorize` → `authorization_status` tidak berubah, field lain tersimpan, response 200.
- dengan `domains.authorize` → `authorization_status` berubah.

Semua pada baris throwaway buatan test.

## 8. PR 5 — QA Regresi + Dokumentasi

1. Matrix regresi 5 role × (buka panel wp-admin, sidebar SPA, akses hash URL langsung, 1 endpoint REST per controller) untuk `administrator`, `pukat_admin`, `pukat_operator`, `pukat_reviewer`, `pukat_viewer` — bandingkan dengan hasil sebelum PR 1. Tidak boleh ada satu sel pun berubah (PRD §14.7).
2. Jalankan `tools/smoke-phase7-qa.php` dan `tools/smoke-role-controller.php` penuh.
3. Frontend: `cd pukat-app && npm run lint && npm run build && npm run test`. `appRoutes.test.js` mungkin perlu kasus baru kalau submenu baru di PR 2 memunculkan kebutuhan assert konsistensi gate submenu ↔ route (opsional, tapi itu satu-satunya tempat yang bisa menangkap drift di antara keduanya secara otomatis).
4. Catatan rilis: role custom yang dibuat sebelum rilis ini **tidak** otomatis dapat `admin_panel.view` (PRD §11) — harus disebut, ini satu-satunya perubahan perilaku yang terlihat user.
5. Update memory project kalau ada (status "panel wp-admin sekarang registry-gated").
6. Tandai `docs/PRD_RBAC_COVERAGE_COMPLETION.md` + rencana ini jadi `Status: Implemented`.

## 9. Rollback Plan

- PR 1 direvert sendirian: capability baru hilang dari registry, tapi `pukat_db_version` sudah `1.25.0` sehingga blok migration tidak jalan lagi. Kalau PR 2-4 sudah masuk, **revert PR 1 terakhir, bukan pertama** — urutan revert harus kebalikan urutan merge.
- PR 2 adalah satu-satunya PR yang bisa menyebabkan lockout panel wp-admin. Jalan keluar tanpa deploy: `administrator` selalu lolos (`grant_rbac_capabilities()` memberi semua capability ke role `administrator`), jadi akun admin WP tetap bisa masuk dan memperbaiki grant dari halaman Roles.
- Kalau `pukat_guardrails_view` perlu dikembalikan (mis. ada konsumer luar tak terduga), cukup kembalikan `view_gate` di registry dan bump satu versi migration baru — jangan ubah blok `1.25.0` yang sudah jalan di install mana pun.

## 10. PR 6 (Opsional) — Cleanup Capability & Gate Legacy

Dikerjakan hanya setelah PR 5 lulus, dan hanya kalau disetujui saat itu.

1. Hapus `permission_read()`/`permission_manage()`/`permission_admin()` dari `includes/Api/RestController.php` — verifikasi ulang nol consumer tepat sebelum hapus:
   ```bash
   grep -rn "permission_read\|permission_manage\|permission_admin" wp-content/plugins/Pukat/includes/
   ```
   (yang tersisa harus hanya nama method milik controller lain seperti `permission_manage_roles`/`permission_manage_quiz` — itu method berbeda, jangan ikut dihapus.)
2. `Activator::add_roles()`: hentikan grant 4 capability legacy. Perlu blok migration baru + `remove_cap()` eksplisit, dan **harus** dipastikan tidak ada hook/snippet milik user yang masih bergantung padanya — ini satu-satunya langkah di seluruh rencana yang bisa memecahkan kode di luar plugin, karena itu dipisah dan opsional.

## 11. Urutan PR

Setiap PR lulus validasinya sendiri sebelum PR berikutnya mulai (`AGENTS.md` §7).

### PR 1 — Registry, flag `has_view`, 2 key baru, migration 1.25.0
### PR 2 — AdminMenu/AdminPage ke capability registry + 5 submenu baru
### PR 3 — `asset_governance.manage_all` di 8 call site
### PR 4 — Aktifkan `master_*.assign_entity` ×2 dan `domains.authorize`
### PR 5 — QA regresi lintas role, frontend validation, docs
### PR 6 (opsional) — Hapus gate generik mati + capability legacy
