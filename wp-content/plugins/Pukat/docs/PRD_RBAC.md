# PRD: Role-Based Access Control (RBAC) Management

Status: Draft
Date: 2026-08-06
Owner: Pukat Product and Engineering
Related area: User Access (`Admin/Users.jsx`), Admin Menu, Frontend Navigation, seluruh REST `permission_callback` di `includes/Api/*`, approval workflow Playbook Master & Master Component
Implementation plan: `docs/IMPLEMENTATION_PLAN_RBAC.md` (belum dibuat — menyusul setelah PRD ini disepakati)

## 1. Ringkasan

Pukat saat ini hanya punya 3 role tetap (`pukat_admin`, `pukat_operator`, `pukat_viewer`) yang di-hardcode di kode PHP dan JS. Menambah atau mengubah role berarti edit kode dan reaktivasi plugin — tidak ada UI untuk itu. Permission juga sangat kasar: hanya 4 capability (`pukat_manage_campaigns`, `pukat_view_reports`, `pukat_manage_users`, `pukat_manage_settings`) yang menggerakkan seluruh REST API lewat 3 gate generik (`permission_read`/`permission_manage`/`permission_admin`). Tidak ada kontrol per menu sidebar, dan sidebar sendiri tidak difilter oleh permission sama sekali.

PRD ini mendefinisikan sistem RBAC baru: Admin dapat membuat role dengan nama bebas dari UI, menentukan permission granular per menu (visibility sidebar + akses halaman) dan per action penting dalam suatu fitur (create/edit/delete/approve/dll), dengan backend REST API sebagai source of truth enforcement — bukan sekadar UI yang disembunyikan.

## 2. Latar Belakang

Temuan konkret dari kode yang ada saat ini:

- **Role hardcoded di 3 tempat terpisah**: `includes/Core/Activator.php` (registrasi WP role + capability grant, jalan sekali saat plugin activation), `includes/Api/UserController.php` (`PUKAT_ROLES` const array), dan `pukat-app/src/utils/roles.js` (`ROLE_VALUES`). Ketiganya harus selalu sinkron manual.
- **Hanya 4 capability kasar** yang menggerakkan seluruh REST API lewat 3 gate generik di `includes/Api/RestController.php` (`permission_read`, `permission_manage`, `permission_admin`). Tidak ada capability per halaman/menu atau per action granular.
- **Sidebar frontend 100% statis** (`adminNavGroups`/`frontendNavGroups` di `pukat-app/src/config/appRoutes.jsx`) — tidak difilter oleh role. Backend tetap benar sebagai source of truth untuk enforcement API, tapi user melihat semua menu walau actionnya nanti gagal 403.
- **Tidak ada route guard di frontend.** User yang tahu hash URL langsung (mis. `#/admin/settings`) bisa membuka halaman itu walau menunya tersembunyi — baru gagal saat hit API.
- **`docs/PRD.md` §5 sudah mendefinisikan 4 aktor** (Admin, Operator, Reviewer/Approver, Viewer) tapi kode hanya pernah mengimplementasikan 3 role — Reviewer/Approver tidak pernah dibangun sebagai role terpisah.
- **Endpoint approve SUDAH ADA dan berfungsi**, ini bukan fitur baru: `POST /playbook-masters/{id}/approve` (`PlaybookMasterController`), `POST /master/email-template-versions/{id}/approve` dan `POST /master/landing-page-versions/{id}/approve` (`MasterComponentController`) — semuanya sudah menyimpan `approved_by`/`approved_at` di database (`PlaybookMasterService`, `MasterComponentService`). Tapi `permission_callback` untuk endpoint approve ini sama persis dengan create/edit/delete: `permission_manage`. Artinya siapa pun dengan `pukat_manage_campaigns` (termasuk Operator yang membuat draft-nya sendiri) bisa meng-approve draft miliknya sendiri. Tidak ada pemisahan tugas (segregation of duties) yang sebenarnya sudah diniatkan sejak awal di `docs/PRD.md` §5.3.
- **Preseden langsung**: pada 2026-08-06, sending profile mutation baru saja di-restrict jadi admin-only dengan cara hardcode `permission_callback` menjadi `permission_admin` di `includes/Api/GoPhishProxy.php` (lihat memory `pukat-sending-profile-admin-only`), karena belum ada mekanisme permission granular untuk membuat itu configurable. Ini contoh nyata kebutuhan RBAC: kalau nanti dibutuhkan role lain yang boleh mengelola sending profile tapi bukan full admin, harus edit kode lagi.

## 3. Tujuan

- Admin dapat membuat, mengedit, menghapus, dan menonaktifkan role dengan nama bebas dari UI, tanpa deploy kode.
- Setiap role punya permission granular: per menu (visibility sidebar + akses halaman) dan per action penting dalam halaman itu (create/edit/delete/test/approve/assign/dll, sesuai kebutuhan masing-masing fitur).
- Permission adalah source of truth di backend (REST `permission_callback`), konsisten dengan prinsip "backend tetap source of truth" yang sudah berlaku di seluruh codebase — bukan sekadar UI yang disembunyikan.
- Sidebar frontend otomatis menyesuaikan dengan permission role user yang login.
- Route di frontend di-guard — akses langsung ke hash URL yang tidak diizinkan diblokir/redirect, bukan cuma hilang dari menu.
- Menghidupkan role Reviewer/Approver: endpoint approve yang sudah ada dipisahkan capability-nya dari create/edit/delete biasa, sehingga bisa dibuat role yang HANYA bisa approve, tidak bisa create/edit.
- Role lama (`pukat_admin`/`pukat_operator`/`pukat_viewer`) tetap berjalan tanpa breaking existing user — dimigrasikan menjadi role dinamis default saat fitur ini rilis, dengan permission grant yang identik dengan behavior mereka hari ini.

## 4. Non-Tujuan

- RBAC ini **tidak** mengambil alih entity-scoping (own vs general asset) yang sudah distabilkan di `docs/PRD_ASSET_ACCESS_AND_VERSIONING.md`. Dua sistem ini tetap ortogonal: **role** menentukan FITUR apa yang bisa diakses, **entity** menentukan BARIS DATA mana yang bisa disentuh di dalam fitur itu. Menggabungkan keduanya berisiko mengubah model asset access yang baru saja distabilkan.
- Tidak membangun review-queue/dashboard UI baru untuk approval. Tabel master (Email Template, Landing Page, Playbook) sudah punya filter status (`draft`/`review`/`approved`/`active`/...) lewat `DataTable` (lihat `TableRegistry.php`) — reviewer tinggal filter `status=review`. Yang baru hanya capability `*.approve` yang terpisah dari `*.manage`.
- Tidak membangun row-level/field-level permission (mis. "role X hanya boleh lihat kolom Y saja").
- Tidak membangun multi-tenant/organization-level RBAC (di luar konteks single-site WordPress).
- Tidak mengubah keputusan sending-profile-admin-only yang baru dibuat — begitu RBAC ini rilis, keputusan itu tinggal jadi default permission grant di seed data role Admin, menggantikan hardcode `permission_admin` di `GoPhishProxy.php`.
- Tidak membangun UI builder permission generik yang memungkinkan admin membuat permission key baru sembarangan (lihat §5.2) — katalog permission tetap dikontrol developer.
- Tidak membangun soft-disable role (state "nonaktif tapi konfigurasi dipertahankan"). Role hanya ada atau dihapus — lihat §18.

## 5. Definisi

### 5.1 Role

Baris data dinamis (bukan konstanta kode) dengan nama bebas, dibuat/diedit/dihapus dari UI. Setiap role adalah kumpulan permission grant terhadap Permission Registry (§5.2). Dipetakan 1:1 ke WP role native di baliknya (lihat §6).

### 5.2 Permission Registry

Katalog **tetap**, didefinisikan di kode (mirip `TableRegistry`/`actionRegistry` yang sudah ada di codebase ini) berisi semua permission key yang valid. Admin **tidak** bisa mengetik permission key bebas — hanya toggle on/off dari yang sudah terdaftar. Registry-nya sendiri extensible oleh developer: menambah fitur baru = menambah entry baru di registry, konsisten dengan prinsip whitelist yang sudah dipakai di seluruh backend (table key, sort key, filter key, action key). Dua jenis entry:

- **Menu permission** — satu per item sidebar (mis. `sending_profiles.view`). Mengontrol visibility menu DAN akses halaman/route.
- **Action permission** — satu per action penting dalam suatu fitur (mis. `sending_profiles.create`, `sending_profiles.delete`, `sending_profiles.test`, `playbook_master.approve`).

### 5.3 Permission Grant

Relasi role ↔ permission key, boolean on/off.

### 5.4 Reviewer/Approver

Bukan lagi konsep abstrak di `docs/PRD.md` §5.3 — menjadi role dinamis default yang di-seed saat fitur ini rilis, dengan grant `*.view` untuk resource yang relevan plus `*.approve`, tanpa grant `*.create`/`*.edit`/`*.delete`.

### 5.5 System Role

Role bawaan yang di-seed plugin (Admin, Operator, Reviewer/Approver, Viewer). Bisa diedit permission-nya, tapi tidak bisa dihapus, dan role Admin secara khusus tidak bisa kehilangan capability `roles.manage` miliknya sendiri (lihat §13, cegah lockout).

## 6. Role Model & Technical Approach

**Keputusan**: role dinamis dibangun **di atas primitive WP native** (`add_role()`/`remove_role()`, `$wp_role->add_cap()`/`remove_cap()`), bukan authorization engine terpisah dari nol.

Alasan:
- Seluruh REST API sudah pakai `current_user_can()` lewat `permission_read`/`permission_manage`/`permission_admin` di `RestController.php`. Mempertahankan `current_user_can()` sebagai primitive berarti migrasi jadi soal **menambah capability key baru dan mengganti gate di tiap controller**, bukan menulis ulang authorization dari nol di setiap endpoint.
- WP native role storage (`wp_user_roles` option) sudah mendukung role dibuat/dihapus saat runtime — "dinamis" di sini tidak butuh tabel kustom terpisah untuk role itu sendiri, hanya butuh layer manajemen (UI + REST) di atasnya.
- Konsisten dengan pola whitelist yang sudah dipakai di seluruh codebase ini (table registry, action registry) — permission KEY tetap dari katalog tetap, hanya kombinasi grant-nya yang dinamis.

Konsekuensi teknis:
- Setiap permission key di Permission Registry (§7) dipetakan 1:1 ke satu WP capability string (mis. `sending_profiles.create` → `pukat_sending_profiles_create`).
- Membuat role baru dari UI = memanggil `add_role($slug, $label, $caps)` dengan capability set sesuai grant yang dipilih admin.
- Mengubah permission role = `$role->add_cap()`/`remove_cap()` pada role yang sudah ada.
- `RestController.php` perlu diperluas: `permission_read`/`permission_manage`/`permission_admin` generik yang sekarang ada **tetap dipakai untuk gate autentikasi dasar** (login check), tapi setiap controller perlu method baru yang cek capability granular sesuai Permission Registry-nya masing-masing (lihat §10).

## 7. Permission Registry (Draft Katalog)

Draf awal, dipetakan dari menu yang benar-benar ada hari ini di `AdminMenu.php` dan `appRoutes.jsx`, plus action yang benar-benar ada di REST controller terkait. Ini draft untuk didiskusikan, bukan final.

| Group | Menu key | Actions | Sumber saat ini |
|---|---|---|---|
| Dashboard | `dashboard.view` | — | selalu terbuka (cap `read`) |
| Master Playbooks | `master_playbooks.view` | `.create`, `.edit`, `.delete`, `.approve` | `PlaybookMasterController`, gate `pukat_manage_settings` |
| Master Sending Profiles | `master_sending_profiles.view` | `.create`, `.edit`, `.delete`, `.test`, `.assign_entity` | `GoPhishProxy` (baru saja diubah ke `permission_admin`, lihat §2) |
| Master Email Templates | `master_email_templates.view` | `.create`, `.edit`, `.delete`, `.approve`, `.assign_entity` | `MasterComponentController` |
| Master Landing Pages | `master_landing_pages.view` | `.create`, `.edit`, `.delete`, `.approve`, `.assign_entity` | `MasterComponentController` |
| Sending Profile References | `sending_profile_references.view` | `.create`, `.edit`, `.delete`, `.validate` | `MasterComponentController` (`/master/sending-profiles/*`) — added during Phase 3.11 implementation, not in the original draft; see note below |
| Domains | `domains.view` | `.create`, `.edit`, `.delete`, `.validate`, `.authorize` | `DynamicDomainTableRepository`/domain controller |
| User Access | `users.view` | `.assign_role`, `.manage_roles` | `UserController` (`permission_admin`, gate `pukat_manage_users`) |
| Settings | `settings.view` | `.edit` (GoPhish config, dll) | `SettingsController` (`permission_admin`) |
| Campaigns | `campaigns.view` | `.create`, `.edit`, `.delete`, `.launch`, `.cancel` | `CampaignController` |
| Playbooks (non-master) | `playbooks.view` | `.use` | frontend `/playbooks` |
| Sending/Email/Landing (non-master) | `sending_profiles.view`, `email_templates.view`, `landing_pages.view` | own-asset `.create`/`.edit`/`.delete` per `docs/PRD_ASSET_ACCESS_AND_VERSIONING.md` | tetap tunduk entity-scoping, RBAC hanya gate visibility fitur ini secara umum |
| Reports | `reports.view` | — | `ReportController` |
| Quiz / Coaching / Next Planning | `post_sim.view` | `.manage` | `QuizController` dll |
| Audit Log | `audit_logs.view` | — | `UserController::get_audit_logs` |

Catatan: baris "Sending/Email/Landing (non-master)" sengaja tetap dua lapis — RBAC menentukan apakah role ini boleh menyentuh fitur itu SAMA SEKALI, entity-scoping (tidak berubah) menentukan baris data mana yang boleh disentuh begitu masuk.

Catatan tambahan (ditemukan saat implementasi Phase 3.11, `MasterComponentController`): draft awal tabel ini keliru mengasumsikan "Master Sending Profiles" hanya satu resource (`GoPhishProxy`'s live GoPhish SMTP CRUD). Ternyata `MasterComponentController` punya `/master/sending-profiles/*` sendiri yang mengelola tabel referensi WordPress (`wp_pukat_sending_profile_refs`, tanpa credential) — resource yang benar-benar berbeda, masih dipakai operator hari ini lewat alur pembuatan Playbook Master. Kalau baris ini dipetakan ke `master_sending_profiles.*` (admin-only sejak keputusan 2026-08-06), operator akan kehilangan akses nyata secara tidak sengaja. Ditambahkan key baru `sending_profile_references.*` (shared/operator-gated, sama persis dengan behavior `permission_read`/`permission_manage` sebelumnya) — bukan reuse `master_sending_profiles.*`. Registry tumbuh dari 59 ke 64 key; tidak ada key existing yang berubah gate-nya.

## 8. Default Seeded Roles

Role bawaan (`is_system_role = true`) yang di-seed saat fitur ini rilis, menggantikan 3 role hardcoded + menambah 1 role baru:

| Role | Berdasarkan | Permission |
|---|---|---|
| Admin | `pukat_admin` (existing) | Semua permission di registry, termasuk `users.manage_roles` |
| Operator | `pukat_operator` (existing) | Sama seperti hak akses Operator hari ini (`pukat_manage_campaigns` scope) **minus** semua `.approve` |
| Reviewer/Approver | **baru** — dari `docs/PRD.md` §5.3, belum pernah diimplementasikan | `*.view` untuk Playbook/Email Template/Landing Page + `*.approve`, tanpa `.create`/`.edit`/`.delete` |
| Viewer | `pukat_viewer` (existing) | `*.view` saja, sesuai `pukat_view_reports` hari ini |

Setelah rilis, Admin bebas membuat role tambahan di luar 4 ini.

## 9. Data Model

- **Role itu sendiri**: WP native (`wp_user_roles` option via `add_role`) — tidak perlu tabel kustom untuk role/capability grant, sesuai §6.
- **Role metadata** (yang tidak didukung WP native): tabel baru `wp_pukat_role_meta` — `role_slug`, `display_name`, `description`, `is_system_role`, `created_by`, `created_at`, `updated_by`, `updated_at`. Dibutuhkan supaya UI tahu role mana yang tidak boleh dihapus (§5.5) dan siapa yang membuat/mengubahnya (audit).
- **Permission Registry**: tidak disimpan di database — tetap array PHP statis di kode (`includes/Services/PermissionRegistry.php`, pola yang sama seperti `TableRegistry.php`), supaya konsisten dengan whitelist-di-kode yang sudah jadi standar codebase ini dan tidak butuh migrasi setiap kali fitur baru menambah permission key.
- **User ↔ role**: tidak berubah — tetap WP native (`$user->add_role()`/`remove_role()`), sama seperti `UserController::update_role()` hari ini.

## 10. API Requirement

Route baru, di controller baru `includes/Api/RoleController.php`:

```http
GET    /wp-json/pukat/v1/roles                    — list semua role + permission grant-nya
POST   /wp-json/pukat/v1/roles                    — buat role baru
PUT    /wp-json/pukat/v1/roles/{slug}              — update display_name/description/permission grant
DELETE /wp-json/pukat/v1/roles/{slug}              — hapus role (tolak jika is_system_role atau masih ada user memakainya)
GET    /wp-json/pukat/v1/permissions/registry      — daftar Permission Registry lengkap (untuk render UI matrix)
GET    /wp-json/pukat/v1/me/permissions            — permission key yang dimiliki user yang sedang login (untuk frontend nav + route guard)
```

Semua endpoint di atas gate dengan capability baru `pukat_manage_roles` (dipetakan ke permission key `users.manage_roles`), kecuali `GET /me/permissions` yang cukup login (dipakai semua role untuk bootstrap nav mereka sendiri).

Setiap controller existing (`GoPhishProxy`, `MasterComponentController`, `PlaybookMasterController`, `CampaignController`, dll) perlu route registration-nya diperbarui: gate generik `permission_manage`/`permission_admin` diganti capability granular sesuai Permission Registry (mis. `create_sending_profile` → cek `pukat_sending_profiles_create`, bukan lagi `pukat_manage_settings` blanket). Ini pekerjaan migrasi terbesar dari PRD ini — perlu dipecah per controller di implementation plan (§17), bukan sekali jalan.

## 11. Frontend Requirement

- `useMyPermissions()` hook baru — fetch `/me/permissions` sekali saat bootstrap SPA (admin & frontend context), simpan di store global (Zustand), dipakai di seluruh app.
- `adminNavGroups`/`frontendNavGroups` (`appRoutes.jsx`) di-filter oleh permission user sebelum di-render di sidebar — item tanpa `*.view` yang sesuai tidak muncul.
- **Route guard**: wrapper baru (mis. `<PermissionRoute permission="master_sending_profiles.view">`) membungkus setiap `<Route>` di `AppAdmin.jsx`/`AppFrontend.jsx` — akses hash URL langsung ke route yang tidak diizinkan di-redirect ke Dashboard (atau halaman "Access Denied"), bukan mencoba render lalu gagal di tengah jalan.
- Action button per halaman (New/Edit/Delete/Test/Approve, dll) tetap dikirim `permission` boolean sebagai props dari page ke reusable component (pola yang sudah dipakai — `canCreateProfiles`, `canUserEditAsset`, dll di halaman-halaman existing) — bedanya sekarang sumbernya dari `useMyPermissions()`, bukan hardcoded role-check function seperti `canManagePukat()`/`canOperatePukat()`.
- Halaman baru `Admin/Roles.jsx` (tab baru di `Users.jsx` atau halaman terpisah `#/admin/roles`) — CRUD role + permission matrix (checkbox grid: role × permission key), dibangun dari `GET /permissions/registry`.

## 12. Approval Workflow Changes

- `PlaybookMasterController`: route `/playbook-masters/{id}/approve` — ganti gate dari `permission_manage` menjadi capability `pukat_master_playbooks_approve`.
- `MasterComponentController`: route `/master/email-template-versions/{id}/approve` dan `/master/landing-page-versions/{id}/approve` — ganti gate dari `permission_manage` menjadi capability sesuai resource (`pukat_master_email_templates_approve`/`pukat_master_landing_pages_approve`).
- Tidak ada perubahan pada `PlaybookMasterService`/`MasterComponentService` — logic approve, status transition (`draft → review → approved → active`), dan kolom `approved_by`/`approved_at` sudah benar dan tidak disentuh, hanya lapisan permission-nya yang diperketat.
- **Self-approval check baru** (lihat §18): sebelum mengeksekusi approve, tiga handler ini bandingkan `created_by`/`updated_by` milik draft dengan user yang sedang login. Kalau sama, tolak dengan 403 `self_approval_forbidden` walau user itu punya capability `.approve` — ditambahkan sebagai satu guard clause di awal masing-masing `approve_*` method, tidak perlu skema baru.

## 13. Security Requirement

- Backend REST `permission_callback` tetap satu-satunya enforcement yang dipercaya — frontend nav/route guard di §11 murni UX, bukan security boundary (konsisten dengan aturan existing di seluruh codebase ini).
- **Cegah lockout**: minimal harus selalu ada satu role dengan capability `pukat_manage_roles` yang tidak bisa dihapus/di-revoke habis (role Admin, `is_system_role = true`), dan WP `administrator` tetap otomatis mendapat semua Pukat capability seperti hari ini (`Activator::add_roles()`) sebagai jaring pengaman kalau RBAC UI ter-misconfigure.
- **Cegah privilege escalation**: role tanpa `users.manage_roles` tidak bisa memberi dirinya sendiri (atau role lain) permission tambahan lewat endpoint manapun — endpoint `/roles/*` satu-satunya jalur mengubah permission grant, dan itu sendiri sudah gated oleh `users.manage_roles`.
- Menghapus role yang masih dipakai user harus ditolak (400/409), bukan silently orphan user tersebut ke "no role".
- Semua perubahan role/permission wajib tercatat di `AuditLogService` (lihat §14) — governance-sensitive, sama seperti audit yang sudah wajib untuk create/update/approve/sync/launch/cancel/archive di `docs/PRD.md` §12.

## 14. Audit Requirement

Action baru di `AuditLogService`, menyusul pola yang sudah ada (`user.role_updated`, `master.email_template_version.approved`, dll):

```text
role.created
role.updated
role.deleted
role.permission_granted
role.permission_revoked
```

## 15. Migration Requirement

- **Seed migration** (jalan sekali saat plugin diupdate ke versi ini, mirip `Activator::add_roles()`): buat 4 row `wp_pukat_role_meta` untuk Admin/Operator/Reviewer-Approver/Viewer, isi capability WP role existing (`pukat_admin`/`pukat_operator`/`pukat_viewer`) supaya identik dengan behavior hari ini — **tidak ada user existing yang kehilangan akses** saat migrasi ini jalan.
- Role `pukat_admin`/`pukat_operator`/`pukat_viewer` (WP role slug) **tidak diganti nama** — tetap dipakai sebagai slug di balik layar untuk 3 role bawaan itu, supaya user yang sudah punya role ini di `wp_usermeta` tidak perlu di-migrate assignment-nya.
- Role Reviewer/Approver baru (`pukat_reviewer`) dibuat kosong (belum ada user) — Admin assign manual setelah rilis.
- Legacy const `UserController::PUKAT_ROLES` dan frontend `roles.js::ROLE_VALUES` — setelah role jadi dinamis, dua tempat ini harus baca dari `wp_pukat_role_meta`/`/roles` endpoint, bukan const hardcoded lagi.

## 16. Acceptance Criteria

- Admin bisa membuat role baru dari UI, assign ke user, dan user tersebut login lalu melihat sidebar yang sesuai (menu di luar permission-nya tidak muncul).
- User dengan role yang tidak punya `master_sending_profiles.view` yang mengetik `#/master/sending-profiles` langsung di address bar tetap diblokir (redirect), bukan melihat halaman kosong/error.
- User dengan role Reviewer/Approver bisa approve Playbook Master/Email Template/Landing Page tapi request create/edit/delete-nya ditolak 403 oleh backend (dicoba lewat REST langsung, bukan cuma lewat UI).
- User existing dengan role `pukat_admin`/`pukat_operator`/`pukat_viewer` tidak kehilangan akses apa pun setelah migrasi (regression check terhadap behavior sebelum RBAC).
- Mencoba menghapus role Admin (system role) ditolak. Mencoba menghapus role yang masih dipakai user ditolak.
- Semua perubahan role/permission muncul di Audit Log.
- `npm run lint`/`build`/`test` clean, `php -l` clean pada semua file yang diubah, REST smoke test permission-denied/success case untuk role/permission endpoint baru — mengikuti standar validasi §7 di `AGENTS.md`.

## 17. Implementation Phasing (indikatif)

Draft kasar untuk didiskusikan — rencana rinci disusun di `docs/IMPLEMENTATION_PLAN_RBAC.md` setelah PRD ini disepakati, dipecah jadi PR kecil yang bisa direview satu-satu (konsisten dengan pola rollout `IMPLEMENTATION_PLAN_FRONTEND_REUSE_AND_SERVER_DRIVEN_TABLE.md` yang sudah dipakai untuk DataTable).

1. **Schema & Permission Registry**: `wp_pukat_role_meta` table, `PermissionRegistry.php` (katalog awal dari §7), seed migration 4 role default.
2. **Backend role management API**: `RoleController.php` (`/roles`, `/permissions/registry`, `/me/permissions`), capability granular per key di-generate dari registry.
3. **Migrasi controller existing satu per satu**: ganti gate `permission_manage`/`permission_admin` di tiap controller jadi capability granular — mulai dari yang paling kecil blast radius-nya (mis. Domains) sebelum yang besar (Campaign, Playbook Master).
4. **Approval capability split**: pisahkan `.approve` dari `.manage` di `PlaybookMasterController`/`MasterComponentController` (§12).
5. **Frontend**: `useMyPermissions()`, nav filtering, `<PermissionRoute>` guard, halaman `Admin/Roles.jsx`.
6. **QA & hardening**: lockout prevention test, privilege escalation test, regression test seluruh role existing.

## 18. Decisions (previously Open Questions)

Diputuskan supaya implementation plan (§17, `docs/IMPLEMENTATION_PLAN_RBAC.md`) tidak terblokir. Ditandai jelas sebagai default pragmatis, bukan keputusan yang sudah didiskusikan mendalam — silakan koreksi kapan saja sebelum atau selama implementasi, ini bukan keputusan yang mahal untuk diubah di fase awal.

- **Self-approval pada dual-role user**: **Ditolak by default.** Kalau user yang membuat/mengedit draft (`created_by`/`updated_by`) sama dengan user yang memanggil endpoint `.approve`, backend menolak dengan 403 (`self_approval_forbidden`) meskipun dia punya capability `.approve` — segregation of duties yang sebenarnya jadi tujuan utama menghidupkan role Reviewer/Approver akan percuma kalau operator bisa approve draft sendiri hanya karena kebetulan dual-role. Ini best-practice standar (four-eyes principle), bukan spekulasi. Pertanyaan `docs/PRD.md` baris 769 (approval wajib di level Campaign Run juga atau tidak) **tetap terbuka** — di luar scope RBAC ini, itu soal workflow Campaign Run, bukan soal permission model.
- **Batas granularity permission matrix**: Tidak dibatasi jumlah menu/action secara artifisial — registry (§7) mengikuti jumlah fitur yang benar-benar ada (~13 group hari ini). Mitigasi kompleksitas UI ada di lapisan presentasi (grouping per section di `Admin/Roles.jsx`, bukan flat checkbox list), bukan dengan mengurangi granularity yang sudah disepakati di §5.2 (menu-level + action-level).
- **Soft-disable role**: **Tidak dibangun di v1** — non-goal eksplisit ditambahkan ke §4. Role hanya punya dua state: ada (dengan permission apa pun, termasuk semua-off yang efeknya setara "disabled") atau dihapus (ditolak kalau masih dipakai user, lihat §13). Alasan: state ketiga ("disabled tapi konfigurasi dipertahankan") menambah kompleksitas data model dan UI tanpa use case konkret yang diminta — bisa ditambah belakangan sebagai perluasan additive kalau ternyata dibutuhkan.
- **Update `docs/PRD.md` §5**: **Tidak diubah sebagai bagian dari PRD ini.** `docs/PRD.md` adalah baseline Playbook Master yang sudah diimplementasikan (lihat `AGENTS.md` §2) — mengedit baseline itu di luar scope kerja RBAC. §5-nya tetap valid sebagai deskripsi konseptual 4 aktor; PRD ini (§8) memetakan mereka jadi 4 default seeded role di sistem yang sekarang generik. Kalau nanti dianggap perlu, `docs/PRD.md` bisa ditambah satu baris forward-reference ke PRD ini — diusulkan, bukan dieksekusi di sini.
