# PRD: RBAC Coverage Completion

Status: Implemented (PR 1-5, 2026-10-20)
Date: 2026-10-20
Owner: Pukat Product and Engineering
Related area: `includes/Services/PermissionRegistry.php`, `includes/Admin/AdminMenu.php`, `includes/Admin/AdminPage.php`, `current_user_can_admin_assets()` di 8 service/controller, `includes/Core/Activator.php` (seed + migration), `pukat-app/src/pages/Admin/Roles.jsx`
Implementation plan: `docs/IMPLEMENTATION_PLAN_RBAC_COVERAGE_COMPLETION.md`
Lanjutan dari: `docs/PRD_RBAC.md` (semua fase di `docs/IMPLEMENTATION_PLAN_RBAC.md` sudah selesai)

## 1. Ringkasan

RBAC dari `docs/PRD_RBAC.md` sudah terpasang: 22 menu / 77 permission key di `PermissionRegistry`, semua halaman SPA punya route guard, dan semua REST controller sudah pakai `require_capability()` dengan key registry. Tapi audit terhadap kode (2026-10-20) menemukan masih ada keputusan akses yang **tidak lewat registry**, sehingga tidak bisa di-setup dari halaman `/wp-admin/admin.php?page=pukat_dashboard#/admin/roles`:

1. Akses ke panel wp-admin itu sendiri masih dijaga capability legacy `pukat_manage_settings`/`pukat_manage_users`.
2. Hak "kelola aset General / lintas entity" masih dijaga `pukat_manage_settings`, diduplikasi di 8 tempat.
3. Ada 4 toggle di UI Roles yang tidak dibaca backend sama sekali (toggle mati).

Akibat paling nyata dari (1): role custom yang dibuat dari halaman Roles hanya mendapat capability `read` + capability registry (`RoleController.php:156-159`), jadi **walau dicentang seluruh 77 permission, role itu tetap tidak bisa membuka panel wp-admin** — termasuk halaman Roles, Master Library, dan Settings. Panel wp-admin efektif masih milik `pukat_admin`/`administrator` saja, persis kondisi pra-RBAC.

PRD ini menutup ketiga celah itu dengan menarik semua keputusan akses yang tersisa ke dalam Permission Registry, **tanpa mengubah akses efektif siapa pun** saat migrasi (lihat §11).

## 2. Latar Belakang (temuan audit)

Semua temuan di bawah dari pembacaan kode, bukan estimasi.

### 2.1 Panel wp-admin tidak diatur registry

- `includes/Admin/AdminMenu.php:37` — `add_menu_page()` top-level pakai capability `pukat_manage_settings`.
- `includes/Admin/AdminMenu.php:53-59` — 7 submenu: 6 pakai `pukat_manage_settings`, 1 (`users`) pakai `pukat_manage_users`.
- `includes/Admin/AdminPage.php:39` — `render_standalone()` cek ulang `pukat_manage_settings`.
- Keempat lokasi itu memakai capability yang **tidak ada** di `PermissionRegistry::MENUS`, jadi tidak muncul sebagai toggle apa pun di halaman Roles dan tidak pernah di-grant oleh `RoleController`.
- Konsekuensi lanjutan: slug submenu yang dipakai URL di judul PRD ini (`page=pukat_dashboard`) adalah submenu `dashboard`, yang gate-nya `pukat_manage_settings`.

### 2.2 Hak lintas entity / aset General tidak diatur registry

`private function current_user_can_admin_assets(): bool { return current_user_can( 'pukat_manage_settings' ) || current_user_can( 'administrator' ); }` diduplikasi **8 kali** dengan isi identik:

| Lokasi | Dipakai untuk |
|---|---|
| `includes/Services/MasterComponentService.php:1984` | `enforce_write_entity()`/`enforce_existing_row_editable()` — tulis aset master lintas entity & General |
| `includes/Services/PlaybookService.php:364` | edit playbook General / entity lain |
| `includes/Services/PlaybookMasterService.php:885` | idem untuk Playbook Master |
| `includes/Services/CampaignRunService.php:2458` | akses campaign run lintas entity |
| `includes/Services/CampaignGroupService.php:472` | akses campaign group lintas entity |
| `includes/Services/EntityProfileService.php:832` | oversight profil entity (public method, dipakai service lain) |
| `includes/Services/TableQueryService.php:652` | filter baris table lintas entity |
| `includes/Api/GoPhishProxy.php:933` | aset GoPhish live lintas entity |

Ini sesuai pembagian ortogonal di `docs/PRD_RBAC.md` §4 (role = fitur, entity = baris data), **tapi** satu sisi dari pembagian itu — "siapa yang boleh menembus batas entity" — tetap sebuah keputusan role yang hari ini tidak bisa dikonfigurasi.

### 2.3 Toggle mati di halaman Roles

Key ada di registry dan muncul sebagai checkbox, tapi tidak ada satu pun `require_capability()`/`current_user_can()` yang membacanya:

| Key | Status sebenarnya |
|---|---|
| `master_email_templates.assign_entity` | Reassign entity aset master email template dijalankan lewat `update` biasa → `enforce_write_entity()` → `current_user_can_admin_assets()`. Key-nya tidak pernah dibaca. |
| `master_landing_pages.assign_entity` | Idem untuk landing page master. |
| `domains.authorize` | `authorization_status` domain (`pending`/`authorized`/`rejected`/`expired`, `MasterComponentService.php:1768-1772`) ikut `domains.edit`; tidak ada gate terpisah. |
| `guardrails.view` | Menu `guardrails` memang tidak punya halaman (registry-only, sama kelas dengan key `bypass`-nya), tapi `PermissionRegistry::all()` selalu memancarkan `.view` untuk setiap menu, jadi lahir satu key yang tidak punya arti. |

Catatan: `monitoring.view` dan `calendar.view` juga tidak dibaca backend, tapi itu **by design** dan sudah didokumentasikan panjang di `PermissionRegistry.php` (halaman mockup tanpa data fetching, key-nya murni untuk nav/route guard frontend). Dua key ini **bukan** bagian dari PRD ini.

### 2.4 Hal yang sudah benar (tidak disentuh PRD ini)

- 8 table key di `TableRegistry` seluruhnya termap di `TableController::TABLE_KEY_PERMISSIONS`.
- Semua route REST punya `permission_callback` berbasis registry, kecuali 3 yang sengaja: `/quiz/submit` dan `/public/report-contact` (publik, dipakai target lewat email) serta `/me*` (cukup login).
- `Admin/Users.jsx` sudah membaca daftar role dinamis dari `useRoles()`, jadi role custom tetap bisa di-assign ke user.

## 3. Tujuan

- Panel wp-admin (top-level menu, setiap submenu, dan `AdminPage::render_standalone()`) dijaga capability dari Permission Registry, sehingga role custom bisa diberi akses panel tanpa deploy kode.
- Hak lintas entity/aset General menjadi satu permission key tunggal di registry, dengan satu implementasi bersama alih-alih 8 duplikat.
- Tidak ada lagi toggle mati di halaman Roles: setiap key yang tampil di UI benar-benar dibaca backend, atau dihapus dari registry (beserta pembersihan capability string-nya).
- Halaman admin yang hari ini hanya bisa dicapai lewat hash URL (Domains, Entities, Flag categories, Roles, My Profile) punya entri submenu wp-admin, masing-masing dengan gate registry-nya sendiri.
- **Akses efektif setiap user existing tidak berubah** setelah migrasi — PRD ini mengubah *di mana* keputusan dibuat, bukan *apa* hasilnya.

## 4. Non-Tujuan

- Tidak mengubah model entity-scoping itu sendiri (`docs/PRD_ASSET_ACCESS_AND_VERSIONING.md`). Yang berubah hanya *capability mana* yang menandai "boleh lintas entity", bukan aturan barisnya.
- Tidak memecah bundel permission yang ada sekarang. Yang tetap satu toggle: Manage campaigns / Preparation / Socialization ikut `campaigns.view`; Quiz / Coaching / Next planning ikut `post_sim.view`; Reports hanya punya `.view` (export ikut view). Memecahnya adalah penambahan key yang murni additive dan bisa dikerjakan belakangan kalau memang diminta — lihat §16.
- Tidak mengubah `monitoring.view`/`calendar.view` menjadi gate backend (lihat §2.3) — selama dua halaman itu masih mockup tanpa data, tidak ada resource untuk dijaga.
- Tidak menghapus 4 capability legacy (`pukat_manage_campaigns`, `pukat_view_reports`, `pukat_manage_users`, `pukat_manage_settings`) dari seed `Activator::add_roles()` di v1 ini. Yang dihapus hanya *ketergantungan* padanya. Pembersihan seed-nya dibahas di §15 sebagai fase opsional terakhir.
- Tidak membangun UI baru di halaman Roles. Key baru otomatis muncul karena `Roles.jsx` merender apa pun yang dikembalikan `GET /permissions/registry`.
- Tidak menambah tabel database baru.

## 5. Permission Registry — Entry Baru

| Group | Key | Gate seed | Dibaca oleh |
|---|---|---|---|
| Admin | `admin_panel.view` | `admin` | `AdminMenu::register()` (top-level), `AdminPage::render_standalone()` |
| Governance | `asset_governance.manage_all` | `admin` | `current_user_can_admin_assets()` bersama (§7) |

Dua-duanya adalah menu registry-only (tidak punya halaman SPA sendiri), jadi:

- `admin_panel` hanya memancarkan `.view` dan tidak punya `actions`.
- `asset_governance` hanya memancarkan `.manage_all` dan **tidak boleh** memancarkan `.view` — lihat §6.

### 5.1 `admin_panel.view` adalah prasyarat, bukan pengganti

`admin_panel.view` hanya membuka pintu panel wp-admin. Halaman di dalamnya tetap dijaga key masing-masing (`settings.view`, `users.view`, `master_*.view`, dst). Karena WordPress menyembunyikan seluruh submenu kalau capability top-level tidak dimiliki, role tanpa `admin_panel.view` tidak akan melihat submenu apa pun walau punya `settings.view`. Label di registry harus menyebut ini eksplisit (mis. `Admin Panel (wp-admin)` + deskripsi "prasyarat semua halaman wp-admin") supaya admin yang mengisi matrix tidak salah duga.

## 6. Dukungan Menu Tanpa Halaman di Registry

`PermissionRegistry::all()` sekarang selalu membuat `"{$menu}.view"` untuk setiap menu. Ditambahkan flag opsional per menu, default `true`:

```php
'asset_governance' => [
    'label'    => 'Asset Governance',
    'group'    => 'Governance',
    'has_view' => false,
    'actions'  => [ 'manage_all' => 'admin' ],
],
```

Menu dengan `'has_view' => false` tidak punya `view_gate` dan tidak memancarkan key `.view`. Diterapkan ke `asset_governance` (baru) dan `guardrails` (existing) — yang terakhir menghapus key mati `guardrails.view` sekaligus (§8).

## 7. Perubahan Gate per Lokasi

| Lokasi | Dari | Menjadi |
|---|---|---|
| `AdminMenu.php:37` top-level | `pukat_manage_settings` | `capability_for('admin_panel.view')` |
| `AdminMenu.php:53` submenu `dashboard` | `pukat_manage_settings` | `capability_for('dashboard.view')` |
| submenu `master_playbooks`/`master_smtp`/`master_emails`/`master_landings` | `pukat_manage_settings` | `capability_for('master_playbooks.view')` / `master_sending_profiles.view` / `master_email_templates.view` / `master_landing_pages.view` |
| submenu `users` | `pukat_manage_users` | `capability_for('users.view')` |
| submenu `settings` | `pukat_manage_settings` | `capability_for('settings.view')` |
| submenu `Open Front Page` | `read` | `read` (tidak diubah — hanya redirect ke `/pukat`) |
| `AdminPage.php:39` | `pukat_manage_settings` | `capability_for('admin_panel.view')` |
| 8× `current_user_can_admin_assets()` | `pukat_manage_settings \|\| administrator` | `capability_for('asset_governance.manage_all') \|\| administrator` |

Submenu baru (§3), masing-masing dengan gate-nya sendiri: Domains (`domains.view`), Entities (`master_entities.oversee`), Flag categories (`flags.edit`), Roles (`users.manage_roles`), My Profile (`read`). Gate-nya sengaja disamakan dengan `permission` route SPA-nya di `appRoutes.jsx` supaya submenu tidak pernah muncul untuk halaman yang route guard-nya akan menolak.

`|| current_user_can('administrator')` tetap dipertahankan di semua lokasi sebagai jaring pengaman anti-lockout, konsisten dengan `docs/PRD_RBAC.md` §13.

## 8. Toggle Mati — Keputusan per Key

| Key | Keputusan | Cara |
|---|---|---|
| `master_email_templates.assign_entity` | **Diaktifkan** | `MasterComponentService::enforce_write_entity()` menerima parameter `?string $assign_key`; early-return-nya menjadi `current_user_can_admin_assets() \|\| ( $assign_key && current_user_can( capability_for( $assign_key ) ) )`. Caller email template master mengirim key ini. |
| `master_landing_pages.assign_entity` | **Diaktifkan** | Idem, dari caller landing page master. |
| `domains.authorize` | **Diaktifkan** | Perubahan `authorization_status` pada update domain butuh `domains.authorize`; kalau user hanya punya `domains.edit`, field itu dipertahankan apa adanya (bukan 403 untuk seluruh request) supaya alur edit biasa tidak pecah. |
| `guardrails.view` | **Dihapus** | Lewat `'has_view' => false` (§6), plus `remove_cap( 'pukat_guardrails_view' )` di migration (§9). |

Catatan untuk `*.assign_entity`: `master_sending_profiles.assign_entity` **sudah** dibaca hari ini (`GoPhishProxy.php:239-240`), dan `GoPhishProxy` sengaja memakai `.edit` untuk reassign aset non-master (lihat doc comment-nya di `GoPhishProxy.php:165`). Dua keputusan itu tidak diubah.

**Revisi 2026-10-20 (ditemukan saat implementasi PR 4)**: dua key `assign_entity` yang diaktifkan ini ter-seed dengan gate `operator`, sementara perilaku yang digantikannya admin-only (`enforce_write_entity()` menolak semua non-admin). Mengaktifkannya apa adanya berarti Operator mendapat hak lintas entity yang sebelumnya tidak pernah dia punya — melanggar §3. Gate keduanya dipindah ke `admin`, sejajar dengan sibling-nya yang sudah ditegakkan (`master_sending_profiles.assign_entity`, gate `admin`), dan capability-nya dicabut dari semua role selain Admin/administrator di migration (§9). Admin tetap bisa memberikannya ke role mana pun dari halaman Roles — bedanya sekarang itu keputusan sadar, bukan warisan seed.

`domains.authorize` tidak perlu perlakuan serupa: sebelum PR 4 field `authorization_status` tidak dijaga apa pun, jadi siapa pun dengan `domains.edit` sudah bisa mengubahnya. Mengaktifkan key-nya adalah **pengetatan** bagi role yang tidak memegangnya, dan netral bagi Operator yang memang di-seed memegangnya.

## 9. Migration Requirement

- `pukat_db_version` naik ke `1.25.0` (terakhir `1.24.0`, `Activator.php:925`) untuk PR 1, lalu `1.26.0` untuk PR 4 (re-seed + cabut dua capability `assign_entity` dari semua role selain Admin/administrator, mengikuti revisi di §8).
- Blok itu: `self::seed_rbac_defaults()` (additive — grant `pukat_admin_panel_view` + `pukat_asset_governance_manage_all` ke role ber-gate `admin`: `pukat_admin` dan `administrator`), lalu `remove_cap( 'pukat_guardrails_view' )` untuk semua role (pola identik dengan blok `1.7.2`/`1.9.0` yang sudah ada — `add_cap()` additive, penghapusan key wajib eksplisit).
- Tidak ada perubahan skema tabel.
- Kesetaraan akses (inti §3): hari ini pemegang `pukat_manage_settings` = `pukat_admin` + `administrator` (`Activator::add_roles()`), dan gate seed `admin` di `grant_rbac_capabilities()` memberi capability ke tepat dua role itu juga. Jadi `admin_panel.view` dan `asset_governance.manage_all` mendarat di himpunan user yang persis sama. Reviewer/Operator/Viewer hari ini tidak bisa membuka panel wp-admin dan tetap tidak bisa setelahnya.
- `Activator::activate()` saat ini menulis `pukat_db_version = '1.9.0'` (`Activator.php:39`) dan mengandalkan `maybe_upgrade()` untuk menyusul — tidak diubah di PRD ini, hanya dicatat supaya tidak dikira regresi saat verifikasi install baru.

## 10. API Requirement

Tidak ada endpoint baru dan tidak ada perubahan kontrak:

- `GET /permissions/registry` otomatis mengembalikan 2 key baru dan kehilangan `guardrails.view` (shape responsnya tidak berubah).
- `GET /me/permissions` otomatis ikut.
- `POST/PUT /roles` otomatis menerima key baru karena validasinya sudah whitelist terhadap `PermissionRegistry::has_key()`.

Total key registry: 77 → 78 (`+admin_panel.view`, `+asset_governance.manage_all`, `−guardrails.view`).

## 11. Backward Compatibility

- Tidak ada user existing yang kehilangan atau mendapat akses saat upgrade (§9).
- Role custom yang sudah dibuat sebelum rilis ini tidak otomatis mendapat `admin_panel.view` — admin harus mencentangnya sendiri. Ini memang perubahan perilaku yang diinginkan (sebelumnya mencentang apa pun tidak berefek pada panel wp-admin), dan harus disebut di catatan rilis.
- `pukat_manage_settings`/`pukat_manage_users` tetap di-grant oleh `add_roles()` (§4) — jadi kalau ada kode luar (hook/snippet milik user) yang masih mengandalkannya, tidak langsung pecah.

## 12. Security Requirement

- Backend tetap satu-satunya enforcement; submenu wp-admin yang tersembunyi dan route guard SPA tetap murni UX.
- Anti-lockout: `administrator` tetap dapat semua capability Pukat lewat `grant_rbac_capabilities()`, dan tetap lolos semua pengecekan `|| current_user_can('administrator')` di §7. Role `pukat_admin` tetap `is_system_role` (tidak bisa dihapus).
- Anti privilege escalation: `admin_panel.view` tidak memberi hak apa pun selain memuat shell panel; semua halaman di dalamnya tetap punya gate sendiri, dan `/roles/*` tetap satu-satunya jalur mengubah grant (gated `users.manage_roles`).
- `asset_governance.manage_all` adalah capability dengan blast radius besar (menembus batas entity di 8 tempat). Harus diseed hanya ke gate `admin`, dan deskripsinya di registry harus menyatakan efeknya secara eksplisit.

## 13. Audit Requirement

Tidak ada action audit baru. Perubahan grant pada key baru sudah tercakup `role.permission_granted`/`role.permission_revoked` yang ada.

## 14. Acceptance Criteria

1. Buat role custom dari `#/admin/roles` dengan `admin_panel.view` + `settings.view`, assign ke user test → user itu bisa membuka `/wp-admin/admin.php?page=pukat_dashboard`, melihat submenu Settings, dan **tidak** melihat submenu Master/User Access.
2. Role custom tanpa `admin_panel.view` (tapi dengan semua key lain dicentang) → menu Pukat tidak muncul di wp-admin dan akses langsung ke `?page=pukat_dashboard` ditolak.
3. Role dengan `asset_governance.manage_all` bisa mengedit Playbook Master ber-entity `General`; role tanpa key itu ditolak 403 dengan pesan entity yang sudah ada sekarang.
4. Role dengan `master_email_templates.edit` tapi tanpa `.assign_entity` tidak bisa memindahkan email template master ke entity lain; dengan `.assign_entity` bisa.
5. Role dengan `domains.edit` tapi tanpa `domains.authorize` tidak bisa mengubah `authorization_status`; request update lainnya tetap sukses.
6. `guardrails.view` tidak lagi muncul di halaman Roles, dan `pukat_guardrails_view` tidak lagi ada di role mana pun setelah upgrade.
7. Regresi: user `pukat_admin`, `pukat_operator`, `pukat_reviewer`, `pukat_viewer`, dan `administrator` punya akses yang identik sebelum vs sesudah upgrade (matrix REST smoke test + buka panel wp-admin).
8. `npm run lint`/`build`/`test` clean; `php -l` clean untuk semua file yang diubah — sesuai `AGENTS.md` §7.

## 15. Implementation Phasing (indikatif)

Rincian per PR ada di `docs/IMPLEMENTATION_PLAN_RBAC_COVERAGE_COMPLETION.md`.

1. Registry: flag `has_view`, 2 key baru, hapus `guardrails.view`, migration `1.25.0`.
2. Panel wp-admin: `AdminMenu`/`AdminPage` pindah ke capability registry + submenu baru.
3. `asset_governance.manage_all`: satu helper bersama, 8 call site ikut.
4. Aktifkan 3 toggle mati (`*.assign_entity` ×2, `domains.authorize`).
5. QA regresi lintas role + dokumentasi/memory.
6. (Opsional) Hapus 3 gate generik mati di `RestController.php` (`permission_read`/`permission_manage`/`permission_admin` — sudah nol consumer) dan seed capability legacy.

## 16. Decisions (previously Open Questions)

Default pragmatis supaya implementation plan tidak terblokir; silakan koreksi sebelum/selama implementasi.

- **Satu `admin_panel.view` vs satu key per submenu**: pilih satu key prasyarat + reuse key halaman yang sudah ada. Satu key per submenu akan menduplikasi `settings.view`/`users.view` yang sudah mengontrol halaman yang sama di SPA, dan membuat dua sumber kebenaran untuk hal yang sama.
- **`asset_governance.manage_all` satu key global vs per resource** (`master_playbooks.manage_all`, `campaigns.manage_all`, dst): pilih satu key global. Delapan `current_user_can_admin_assets()` hari ini isinya identik, jadi memecahnya berarti *menambah* perbedaan perilaku baru yang belum pernah diminta — itu perubahan produk, bukan refactor akses. Pemecahan per resource tetap mungkin belakangan secara additive.
- **`domains.authorize` diaktifkan vs dihapus**: diaktifkan. Field `authorization_status` nyata ada dan kelasnya governance (siapa yang menyatakan sebuah domain sah dipakai), jadi layak punya toggle sendiri; mode "pertahankan nilai lama" dipilih daripada 403 supaya operator tanpa hak authorize tetap bisa mengedit field domain lainnya.
- **Memecah bundel `campaigns.view`/`post_sim.view`**: tidak di v1 (§4). Alasan: 6 halaman terdampak dan semuanya saat ini bergantung pada key bundel di backend juga, jadi pemecahannya butuh keputusan produk per halaman (mis. apakah Coaching boleh tanpa Quiz) yang belum pernah dibahas.
- **Menghapus capability legacy sekarang**: tidak. Dipisah ke fase opsional terakhir (§15.6) supaya PR-PR utama tetap bisa direvert sendiri-sendiri tanpa menyentuh seed role.

## 17. Catatan Rilis

Untuk ditempel ke catatan rilis versi yang membawa perubahan ini.

**Satu-satunya perubahan perilaku yang terlihat user:**

- Role custom yang dibuat **sebelum** rilis ini tidak otomatis mendapat permission baru **Admin Panel (wp-admin)**. Tanpa permission itu, role tersebut tidak bisa membuka `/wp-admin/admin.php?page=pukat_*` — sama seperti sebelumnya, karena sebelum rilis ini role custom memang tidak pernah bisa membukanya. Centang permission itu di **Roles** untuk memberi akses.
- Dua permission **Assign entity** (Master Email Templates dan Master Landing Pages) sekarang benar-benar berfungsi dan menjadi admin-only. Kalau sebelumnya pernah dicentang untuk sebuah role, centangnya dicabut oleh migration — grant itu tidak punya efek apa pun saat dibuat. Centang ulang kalau memang diinginkan.
- Permission **Authorize** pada Domains sekarang ditegakkan: role yang hanya punya **Edit** masih bisa mengubah field domain lainnya, tapi tidak bisa mengubah status otorisasi.
- Permission **Guardrails → View** hilang dari halaman Roles (menu Guardrails tidak punya halaman; hanya aksi **Bypass**-nya yang berarti).

**Tambahan, bukan perubahan:** panel wp-admin kini punya submenu untuk Entities, Flag Categories, Domains, My Profile, dan Roles — halaman yang sebelumnya hanya bisa dibuka dengan mengetik URL hash-nya manual.

Role bawaan (Admin, Operator, Reviewer/Approver, Viewer) dan user WP `administrator` tidak mengalami perubahan akses apa pun.
