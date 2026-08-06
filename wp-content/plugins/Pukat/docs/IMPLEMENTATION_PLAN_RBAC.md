# Implementation Plan: Role-Based Access Control (RBAC) Management

Status: Draft
Date: 2026-08-06
PRD: `docs/PRD_RBAC.md`

## 1. Ringkasan

Rencana ini memecah `docs/PRD_RBAC.md` jadi fase kecil yang bisa direview dan di-merge satu-satu, mengikuti pola rollout yang sudah dipakai untuk `docs/IMPLEMENTATION_PLAN_FRONTEND_REUSE_AND_SERVER_DRIVEN_TABLE.md`. Urutan fase sengaja dimulai dari yang tidak mengubah behavior existing (schema + registry kosong efeknya), baru menyentuh controller satu per satu dari blast radius terkecil ke terbesar, dan frontend paling akhir setelah backend granular selesai.

## 2. Current State

### 2.1 Backend

- Role: 3 WP role hardcoded di `includes/Core/Activator.php::add_roles()` (`pukat_admin`, `pukat_operator`, `pukat_viewer`), plus WP `administrator` yang otomatis dapat semua Pukat capability.
- Capability: 4 saja — `pukat_manage_campaigns`, `pukat_view_reports`, `pukat_manage_users`, `pukat_manage_settings`.
- Gate generik di `includes/Api/RestController.php`: `permission_read()` (login + `pukat_view_reports`/`pukat_manage_campaigns`/`administrator`), `permission_manage()` (login + `pukat_manage_campaigns`), `permission_admin()` (login + `pukat_manage_settings`).
- **Inventori pemakaian gate generik di seluruh controller** (hasil grep aktual, bukan estimasi):

| Controller | `permission_read` | `permission_manage` | `permission_admin` | Lainnya | Total route |
|---|---|---|---|---|---|
| `ReportController.php` | 6 | — | — | — | 6 |
| `TableController.php` | 2 | — | — | — | 2 |
| `SettingsController.php` | — | — | 2 | — | 2 |
| `UserController.php` | — | — | 3 | — | 3 |
| `PlaybookController.php` | 2 | 4 | — | — | 6 |
| `PlaybookMasterController.php` | 2 | 6 (termasuk `/approve`) | — | — | 8 |
| `QuizController.php` | 1 | 3 | — | 1 (`__return_true`, public quiz link) | 5 |
| `CampaignController.php` | 4 | 5 | — | — | 9 |
| `CampaignRunController.php` | 4 | 7 | — | — | 11 |
| `GoPhishProxy.php` | 4 | 8 | 6 (5 baru diubah 2026-08-06, lihat memory `pukat-sending-profile-admin-only`) | — | 18 |
| `MasterComponentController.php` | 10 | 20 (termasuk 2× `/approve`) | — | — | 30 |

Total ±100 route registration yang perlu ditinjau. Ini alasan Phase 3 (§7) dipecah per-controller, bukan sekali jalan.

- Approval yang sudah ada dan berfungsi hari ini (tidak perlu dibangun ulang, hanya di-gate ulang): `PlaybookMasterController::approve()` → `PlaybookMasterService`, `MasterComponentController::approve_email_template_version()`/`approve_landing_page_version()` → `MasterComponentService`. Kolom `approved_by`/`approved_at` sudah ada di schema.
- `Admin/Users.jsx` sudah punya tab "User Roles" (assign role tetap ke user) dan "Audit Log" — akan diperluas dengan tab "Roles" baru, bukan dibangun dari nol.
- `AuditLogService::log()` sudah dipakai luas (`user.role_updated`, `master.email_template_version.approved`, dll) — action baru RBAC tinggal ditambahkan ke pola yang sama.

### 2.2 Frontend

- `pukat-app/src/config/appRoutes.jsx`: `adminRoutes`/`frontendRoutes` (dipakai `<Route>` di `AppAdmin.jsx`/`AppFrontend.jsx`) dan `adminNavGroups`/`frontendNavGroups` (dipakai sidebar) — keduanya array statis, tidak ada logic filter permission sama sekali hari ini.
- `pukat-app/src/utils/roles.js`: `ROLE_VALUES`, `canManagePukat()`, `canOperatePukat()` — dipakai tersebar di banyak halaman (`entityAssignmentHelpers.js`, halaman own-asset seperti `Simulation/EmailTemplates.jsx`/`LandingPages.jsx`) untuk cek role secara hardcoded per komponen.
- Tidak ada route guard component sama sekali — `<Route path="..." element={...} />` langsung merender elemennya tanpa cek apa pun di level routing.
- `useAppStore` (Zustand, `pukat-app/src/store/useAppStore.js`) sudah menyimpan `user` object yang dipakai luas (`state.user`) — tempat natural untuk menambah `permissions` tanpa mengubah pola store yang ada.

## 3. Target Architecture

```text
WP native role storage (wp_user_roles option)
  add_role($slug, $label, $caps)        <- dipanggil dari RoleController saat create role
  $role->add_cap()/remove_cap()         <- dipanggil dari RoleController saat update permission

Permission Registry (includes/Services/PermissionRegistry.php, PHP array statis)
  key: 'sending_profiles.create' -> capability: 'pukat_sending_profiles_create'
  key: 'sending_profiles.view'   -> capability: 'pukat_sending_profiles_view'
  ...

wp_pukat_role_meta (tabel baru)
  role_slug | display_name | description | is_system_role | created_by | created_at | updated_by | updated_at

RestController (existing 3 gate generik TETAP ADA, dipakai sebagai baseline auth check)
  + method baru per controller: cek current_user_can('pukat_<key>') sesuai Permission Registry
```

Prinsip migrasi: **additive dulu, replace kemudian.** Fase 1-2 membangun infrastruktur registry/role tanpa mengubah satu pun `permission_callback` yang sudah ada — sistem lama dan baru hidup berdampingan sampai Phase 3 mulai migrasi controller satu per satu. Ini membuat setiap PR revert-able secara independen tanpa mematikan RBAC lama di tengah jalan.

## 4. Phase 0: Baseline and Guardrails

- Tambahkan `docs/PRD_RBAC.md` dan `docs/IMPLEMENTATION_PLAN_RBAC.md` ke daftar dokumen active/next-phase di `AGENTS.md` §2.
- Catat baseline: jalankan inventori §2.1 sekali lagi tepat sebelum Phase 1 mulai untuk pastikan tidak ada controller baru yang masuk sejak PRD ditulis.
- Tidak ada perubahan kode di fase ini — docs-only, validasi sesuai `AGENTS.md` §7.3.

## 5. Phase 1: Schema and Permission Registry

- Migration baru: tabel `wp_pukat_role_meta` (kolom sesuai §9 PRD). Pola migration mengikuti `Activator.php` (cek `dbDelta`/versi existing sebelum tabel lain dibuat).
- `includes/Services/PermissionRegistry.php` — array statis berisi seluruh entry dari PRD §7 (Draft Katalog), method `all(): array`, `capability_for(string $key): string`, `keys_for_group(string $group): array`. Pola sama seperti `TableRegistry.php` (whitelist statis, bukan dari database).
- Seed migration: buat 4 row `wp_pukat_role_meta` (Admin/Operator/Reviewer-Approver/Viewer) dengan `is_system_role = true`, dan panggil `add_cap()` pada 3 WP role existing supaya capability granular barunya identik dengan behavior `permission_manage`/`permission_admin`/`permission_read` mereka hari ini (lihat mapping di §8 PRD). WP role `pukat_reviewer` baru dibuat kosong (belum ada capability create/edit, hanya view + approve).
- **Tidak ada controller yang diubah di fase ini.** Registry dan capability baru ada tapi belum dipakai gate mana pun — murni infrastruktur.
- Validasi: `php -l` pada file baru, unit test `PermissionRegistry` (semua key unik, semua capability string unik, tidak ada key tanpa capability), migration idempotent-check (jalan dua kali tidak duplikat row).

## 6. Phase 2: Backend Role Management API

- `includes/Api/RoleController.php` baru — route sesuai PRD §10 (`GET/POST /roles`, `PUT/DELETE /roles/{slug}`, `GET /permissions/registry`, `GET /me/permissions`).
- Semua route (kecuali `/me/permissions`) gate dengan capability baru `pukat_manage_roles` (dipetakan dari key `users.manage_roles`) — capability ini di-assign ke role Admin di seed migration Phase 1.
- `DELETE /roles/{slug}`: tolak 400 kalau `is_system_role`, tolak 409 kalau masih ada `get_users(['role' => $slug])` yang tidak kosong.
- `POST/PUT /roles`: validasi permission key yang dikirim ada di `PermissionRegistry::all()` — tolak 422 untuk key yang tidak dikenal (whitelist enforcement, konsisten dengan aturan `AGENTS.md` §5.2 untuk sort/filter/table key).
- Audit log: `role.created`/`role.updated`/`role.deleted`/`role.permission_granted`/`role.permission_revoked` via `AuditLogService::log()`.
- Registrasi route di `includes/Core/Plugin.php` (pola yang sama seperti controller lain).
- Validasi: REST smoke test (pola `tools/smoke-table-api.php`/`tools/smoke-playbook-master.php` yang sudah ada) — permission-denied case (non-`pukat_manage_roles` user kena 403), invalid permission key (422), delete system role (400), delete role in use (409), success case penuh (create → grant → assign ke user test → revoke → delete).

## 7. Phase 3: Migrate Controllers to Granular Capabilities

Per-controller, urutan dari blast radius terkecil ke terbesar (berdasarkan tabel §2.1). **Setiap controller = satu PR terpisah**, supaya kalau ada regression gampang di-bisect.

1. `SettingsController.php` (2 route, sudah admin-only) — ganti `permission_admin` jadi cek `pukat_settings_edit`, fallback ke `pukat_manage_settings` capability yang sama persis secara nilai (WP role Admin sudah punya keduanya dari seed Phase 1) supaya tidak ada regression behavior.
2. `TableController.php` (2 route, read-only) — per `table_key`, cek `<table_key>.view` bukan blanket `permission_read`.
3. `UserController.php` (3 route) — `/users` dan `/audit-logs` tetap admin-only konsisten (`users.view`), `/users/{id}/role` tetap `users.assign_role`.
4. `QuizController.php` (5 route) — hati-hati dengan 1 route `__return_true` (public quiz link via email, BUKAN permission gap, jangan disentuh).
5. `PlaybookController.php` (6 route).
6. `PlaybookMasterController.php` (8 route) — **kecuali** route `/approve`, itu ditangani terpisah di Phase 4 supaya self-approval guard di-review sebagai unit sendiri.
7. `ReportController.php` (6 route, semua read).
8. `CampaignController.php` (9 route).
9. `CampaignRunController.php` (11 route).
10. `GoPhishProxy.php` (18 route) — termasuk mengganti hardcode `permission_admin` sending-profile mutation (dari perubahan 2026-08-06) menjadi permission granular `sending_profiles.create`/`.edit`/`.delete`/`.test`/`.assign_entity`, yang di seed Phase 1 semuanya hanya di-grant ke role Admin — **hasil akhirnya sama persis dengan behavior hari ini**, cuma sekarang configurable, bukan hardcode.
11. `MasterComponentController.php` (30 route, terbesar) — **kecuali** 2 route `/approve`, ditangani di Phase 4.

Setiap PR: gate lama TIDAK dihapus dari `RestController.php` (masih dipakai controller yang belum di-migrasi), hanya route di controller tersebut yang pindah ke capability granular. Regression check wajib per PR: bandingkan hasil REST smoke test sebelum/sesudah untuk ke-3 role existing (Admin/Operator/Viewer) — tidak boleh ada endpoint yang berubah izinnya secara tidak sengaja.

## 8. Phase 4: Approval Capability Split and Self-Approval Guard

- `PlaybookMasterController::approve()` dan `MasterComponentController::approve_email_template_version()`/`approve_landing_page_version()` — ganti gate jadi `<resource>.approve` (bukan `.manage`).
- Tambahkan guard clause self-approval di ketiga method tersebut (PRD §12/§18): bandingkan `created_by`/`updated_by` row yang di-approve dengan `get_current_user_id()`, tolak 403 `self_approval_forbidden` kalau sama.
- Seed: role Operator kehilangan `.approve` (sesuai PRD §8), role Reviewer/Approver baru mendapat `.approve` tanpa `.create`/`.edit`/`.delete`.
- Validasi: REST smoke test khusus — user dengan role Operator (creator) approve draft sendiri → 403 baru (`self_approval_forbidden`); user Reviewer approve draft Operator lain → 200; user Reviewer coba `POST` create draft baru → 403 (`rest_forbidden`, tidak pernah punya `.create`).

## 9. Phase 5: Frontend — Permission Bootstrap, Nav Filtering, Route Guard

- `pukat-app/src/hooks/queries/usePermissionQueries.js` baru — `useMyPermissions()`, fetch `/me/permissions` sekali per session (staleTime panjang, ini bukan data yang sering berubah dalam satu sesi user).
- `useAppStore` diperluas: `permissions` array/set, di-set setelah `useMyPermissions()` resolve saat bootstrap (`main.jsx`, tempat yang sama seperti `data-initial-route` dibaca — lihat commit `567af42c18`).
- `appRoutes.jsx`: `adminNavGroups`/`frontendNavGroups` tetap array statis (definisi menu tidak berubah), tapi konsumer-nya (`Layout.jsx`/`FrontendLayout.jsx` sidebar renderer) filter item yang permission key-nya tidak ada di `useAppStore(state => state.permissions)` sebelum render.
- `<PermissionRoute permission="...">` baru, membungkus tiap `<Route>` di `AppAdmin.jsx`/`AppFrontend.jsx` — redirect ke `/dashboard` kalau permission tidak dimiliki.
- `roles.js`: `canManagePukat()`/`canOperatePukat()` **tidak dihapus** di fase ini (masih dipakai entity-scoping logic di `entityAssignmentHelpers.js`, di luar scope RBAC per PRD §4) — hanya dipakai lagi di halaman-halaman yang page-level access-nya sekarang datang dari `useMyPermissions()`, bukan role-check manual.
- Validasi: `npm run lint`/`build`/`test`, lalu **browser test wajib** (`run` skill atau Playwright manual seperti sesi sebelumnya) untuk minimal 3 role berbeda — pastikan nav dan route guard benar-benar berubah sesuai permission, bukan cuma lolos type-check.

## 10. Phase 6: Roles Management UI

- Tab baru "Roles" di `Admin/Users.jsx` (atau halaman terpisah `#/admin/roles` kalau matrix-nya terlalu lebar untuk tab) — list role, create/edit/delete, permission matrix (checkbox grid dikelompokkan per menu group sesuai §18 PRD, bukan flat list).
- `useRoleQueries.js`/`useRoleMutations.js` baru, mengikuti pola `useUserQueries.js`/`useUserMutations.js` yang sudah ada.
- Halaman ini sendiri di-gate `users.manage_roles` lewat `<PermissionRoute>` dari Phase 5.
- Validasi: sama seperti Phase 5, plus manual QA: buat role baru dari UI, assign ke user test, login sebagai user itu, verifikasi sidebar dan akses sesuai.

## 11. Phase 7: Testing and QA

- Unit test `PermissionRegistry` (Phase 1) dan self-approval guard (Phase 4) — sudah disebut di fase masing-masing, dikonsolidasi di sini sebagai checklist akhir.
- REST smoke test penuh lintas semua controller yang sudah dimigrasi (Phase 3-4) untuk 4 role default × sample endpoint per controller — regression matrix, bukan cuma endpoint baru.
- Frontend test: `useMyPermissions`/nav filter/route guard — smoke-render seperti pola `DataTable.test.jsx` (`renderToStaticMarkup`, tidak ada RTL/jsdom di project ini, lihat memory `project-pukat`).
- Manual QA matrix minimal: 4 role default × (lihat sidebar sesuai, akses halaman by URL langsung sesuai, action button sesuai, endpoint REST langsung via curl/Postman sesuai) — dijalankan di Docker environment yang sama seperti verifikasi sending-profile-admin-only (`wordpress_app`/`wordpress_db`).
- Lockout test eksplisit: pastikan role Admin tidak bisa kehilangan `users.manage_roles` miliknya sendiri lewat endpoint mana pun (PRD §13).

## 12. Phase 8: Documentation and Handoff

- Update `AGENTS.md` §2 (sudah dilakukan di Phase 0, verifikasi masih akurat).
- Tambahkan satu baris forward-reference di `docs/PRD.md` §5 yang mengarah ke `docs/PRD_RBAC.md` (diusulkan di PRD §18, dieksekusi di sini kalau user setuju saat itu).
- Update memory project (`pukat-sending-profile-admin-only` perlu dicatat "sekarang jadi default seed permission, bukan hardcode lagi" setelah Phase 3 GoPhishProxy selesai).

## 13. Suggested Implementation Order by PR

Setiap PR harus lulus validasi (`AGENTS.md` §7) sebelum PR berikutnya mulai — tidak ada PR yang menumpuk di atas PR yang belum divalidasi.

### PR 1 — Docs and Baseline (Phase 0)
### PR 2 — Schema and Permission Registry (Phase 1)
### PR 3 — Role Management API (Phase 2)
### PR 4 — Controller Migration Batch A: Settings, Table, User, Quiz (Phase 3.1-3.4)
### PR 5 — Controller Migration Batch B: Playbook, PlaybookMaster (non-approve), Report (Phase 3.5-3.7)
### PR 6 — Controller Migration Batch C: Campaign, CampaignRun (Phase 3.8-3.9)
### PR 7 — Controller Migration Batch D: GoPhishProxy, MasterComponent (non-approve) (Phase 3.10-3.11) — PR terbesar, boleh dipecah lagi jadi 2 PR per controller kalau diff-nya terlalu besar untuk direview sekali jalan
### PR 8 — Approval Capability Split and Self-Approval Guard (Phase 4)
### PR 9 — Frontend Permission Bootstrap, Nav Filtering, Route Guard (Phase 5)
### PR 10 — Roles Management UI (Phase 6)
### PR 11 — End-to-End Hardening and Docs Handoff (Phase 7-8)
