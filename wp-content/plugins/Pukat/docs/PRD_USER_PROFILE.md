# PRD: User Profile (Self-Service)

Status: Draft
Date: 2026-09-22
Owner: Pukat Product and Engineering
Related area: `includes/Api/UserController.php`, `pukat-app/src/pages/Admin/Users.jsx`, WP native `wp-admin/profile.php`
Implementation plan: `docs/IMPLEMENTATION_PLAN_USER_PROFILE.md`

## 1. Ringkasan

Pukat saat ini tidak punya halaman "profil saya" sama sekali. Yang ada hanya layar admin `Admin/Users.jsx` yang menampilkan daftar user lain untuk keperluan assign role (`UserController.php`) — bukan untuk user mengelola datanya sendiri. PRD ini menambahkan satu halaman self-service di dalam Pukat admin SPA supaya setiap user (Admin/Operator/Reviewer/Viewer) bisa melihat dan mengubah datanya sendiri (nama tampilan, email, nomor HP, foto profil, password) tanpa perlu izin `users.manage_roles` dan tanpa bergantung pada layar native WordPress `profile.php`.

## 2. Latar Belakang

Temuan konkret dari kode yang ada:

- `UserController.php` cuma expose `GET /pukat/v1/users` (list semua user, admin-gated) dan `PUT /pukat/v1/users/{id}/role` (ubah role user lain). Tidak ada endpoint `GET/PUT /me`.
- `Admin/Users.jsx` merender username, nama, email, entity (read-only badge, lihat `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md`), dan `<select>` role — murni tabel manajemen admin, bukan form self-service.
- Tidak ada hook `show_user_profile`/`personal_options`/`edit_user_profile_update` di mana pun di `includes/` — Pukat tidak menambah field kustom apa pun ke layar native WP `profile.php`, dan sebaliknya tidak menarik data dari sana juga.
- User yang login ke Pukat SPA (Admin/Operator/Reviewer/Viewer) adalah WP user asli yang punya akses `wp-admin` (berbeda dengan target simulasi phishing yang berinteraksi lewat GoPhish tracking link tanpa login WP). Native `profile.php` karena itu **memang bisa mereka akses**, tapi terpisah total dari Pukat SPA — ganti nama di sana tidak sinkron dengan apa pun yang Pukat tampilkan, dan mengubah password di sana tidak tercatat di Audit Log Pukat (`AuditLogService`).

## 3. Tujuan

- User yang login bisa lihat dan ubah: nama tampilan, email, nomor HP (field baru), foto profil.
- User bisa ganti password sendiri dari dalam Pukat SPA, dengan verifikasi password lama.
- Role dan Entity user ditampilkan read-only di halaman ini (sumber kebenarannya tetap `UserController.php`/RBAC — lihat Non-Tujuan).
- Semua perubahan self-service tercatat di Audit Log, terpisah dari log admin (`user.role_updated`).

## 4. Non-Tujuan

- **Tidak** membangun manajemen role/permission — itu domain `docs/PRD_RBAC.md` yang sudah selesai diimplementasikan.
- **Tidak** membangun data profil organisasi/entity (kontak, deskripsi, dsb.) — itu domain `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md`.
- **Tidak** membangun infrastruktur upload file sendiri untuk foto profil. Foto profil pakai Gravatar (hash MD5 dari email, konsisten dengan `get_avatar()` WP native) — user cukup mengubah foto Gravatar-nya di gravatar.com. Upload avatar custom bisa jadi perluasan additive nanti kalau dibutuhkan.
- **Tidak** membangun 2FA/SSO.
- **Tidak** membangun preferensi notifikasi (belum ada sistem notifikasi in-app di Pukat sama sekali hari ini).
- **Tidak** mengganti atau menyembunyikan layar native `wp-admin/profile.php` — keduanya tetap ada berdampingan; §13 mencatat ini sebagai keputusan sadar, bukan kelalaian.

## 5. Definisi

### 5.1 Self Profile
Endpoint dan halaman yang hanya bisa membaca/mengubah data milik user yang sedang login (`get_current_user_id()`), tidak menerima parameter user ID dari klien.

### 5.2 Admin User Management (existing, tidak berubah)
`UserController.php`/`Admin/Users.jsx` — mengelola user LAIN, gated `users.manage_roles`. PRD ini tidak menyentuhnya.

## 6. Functional Requirements

- **FR-1**: `GET /me` mengembalikan `display_name`, `email`, `phone`, `avatar_url` (dari Gravatar), `role` (read-only), `entity` (read-only, lihat `current_user_entity()` di `CampaignRunService.php:2207`).
- **FR-2**: `PUT /me` menerima `display_name`, `email`, `phone` — memvalidasi email unik (WP sudah reject email duplikat di `email_exists()`), menolak field `role`/`entity`/`capabilities` kalau dikirim (diabaikan, bukan error, supaya request lama tidak pecah — dicatat di §10).
- **FR-3**: `POST /me/change-password` menerima `current_password`, `new_password` — verifikasi `wp_check_password( $current_password, $user->user_pass, $user_id )` sebelum `wp_set_password()`. Minimal panjang password mengikuti kebijakan WP core yang berlaku (tidak menambah aturan kompleksitas baru).
- **FR-4**: Halaman "My Profile" baru di Pukat admin SPA, dapat diakses semua role yang login (tidak digate permission registry — ini murni data milik sendiri).

## 7. Data Model

Tidak ada tabel baru. Field baru disimpan sebagai WP user meta:

- `pukat_phone` (VARCHAR, single meta) — nomor HP, field baru satu-satunya yang tidak ada representasi WP native-nya.
- `display_name`/`user_email` — pakai kolom native `wp_users`, lewat `wp_update_user()`.

## 8. API Requirement

Controller baru `includes/Api/ProfileController.php`:

```http
GET  /wp-json/pukat/v1/me                — profil milik user yang login
PUT  /wp-json/pukat/v1/me                — update display_name/email/phone milik sendiri
POST /wp-json/pukat/v1/me/change-password — ganti password milik sendiri
```

Permission callback ketiganya cukup `is_user_logged_in()` — tidak ada capability Permission Registry baru, karena scope-nya intrinsik ke `get_current_user_id()`, sama seperti pola `GET /permissions/registry`'s sibling `GET /me/permissions` yang sudah ada di `docs/PRD_RBAC.md` §10 (cukup login, tidak butuh capability tambahan).

## 9. Frontend Requirement

- Halaman baru `pukat-app/src/pages/Admin/MyProfile.jsx` — form display_name/email/phone, tombol simpan; section terpisah untuk ganti password (current + new + confirm); badge read-only untuk role & entity (reuse komponen `Badge` yang sudah dipakai di `Users.jsx:61,77`).
- Entry baru di `adminNavGroups` (`appRoutes.jsx`) — selalu tampil untuk semua role yang login, tidak lewat `<PermissionRoute>` gate (murni `is_user_logged_in()`).
- Hook baru `hooks/queries/useMyProfile.js`, `hooks/mutations/useUpdateProfile.js`, `useChangePassword.js` — pola TanStack Query yang sama dengan hook existing lain di codebase ini.
- Setelah update email/display_name sukses, invalidate query yang sama dipakai `useMyPermissions()`/nav header (kalau nama tampil di header/topbar) supaya UI langsung sinkron.

## 10. Security Requirement

- `PUT /me` **wajib mengabaikan** (bukan menolak dengan error, supaya tidak jadi footgun untuk klien yang tetap kirim field lama) field `role`, `entity`, `capabilities`, `user_id` kalau ada di body — backend hanya membaca `display_name`/`email`/`phone` dari payload, field lain di luar whitelist ini tidak pernah diproses. Ini mencegah privilege escalation lewat endpoint self-service (konsisten dengan prinsip §13 `docs/PRD_RBAC.md`: role hanya bisa diubah lewat `/roles`/`UserController`, tidak ada jalur lain).
- `POST /me/change-password` menolak kalau `current_password` salah (401/`invalid_current_password`), tidak membocorkan apakah email/username valid.
- Endpoint ini tidak pernah menerima `user_id` dari request body/query — selalu `get_current_user_id()`, mencegah IDOR (user A mengubah profil user B lewat parameter yang dimanipulasi).

## 11. Audit Requirement

Action baru di `AuditLogService`, mengikuti pola existing:

```text
user.profile_updated
user.password_changed
```

Dipisahkan dari `user.role_updated` (admin action) supaya log tetap jelas membedakan "user mengubah dirinya sendiri" vs "admin mengubah user lain".

## 12. Acceptance Criteria

- User login role apa pun bisa membuka "My Profile", melihat data dirinya sendiri, dan berhasil mengubah nama/email/nomor HP.
- Mengirim `PUT /me` dengan payload berisi `role: "pukat_admin"` tidak mengubah role user tersebut (diverifikasi lewat `GET /me/permissions` tidak berubah).
- Ganti password dengan `current_password` salah ditolak; dengan `current_password` benar berhasil dan user bisa login ulang dengan password baru.
- `GET /me`/`PUT /me`/`POST /me/change-password` terhadap request tanpa login ditolak 401.
- Perubahan profil/password muncul di Audit Log dengan action `user.profile_updated`/`user.password_changed`.
- `npm run lint`/`build`/`test` clean, `php -l` clean, smoke test REST endpoint baru (success/permission-denied/invalid-input case) sesuai `AGENTS.md` §7.

## 13. Decisions

- **Native `wp-admin/profile.php` dibiarkan apa adanya, tidak diintegrasikan.** Menambah field kustom ke layar native lewat `show_user_profile` hook berarti dua UI berbeda (WP native + Pukat SPA) sama-sama bisa mengubah data yang sama, berisiko drift dan bug sinkronisasi. Default pragmatis: Pukat SPA jadi satu-satunya tempat resmi mengelola profil Pukat-related (`pukat_phone`, dan nanti apa pun field baru); layar native tetap ada untuk hal generik WP (mis. reset password lewat email, admin color scheme) yang di luar cakupan Pukat. Bisa dikoreksi kalau nanti ada kebutuhan spesifik untuk sinkron dua arah.
- **Avatar pakai Gravatar, bukan upload custom.** Menghindari kebutuhan storage/CDN baru untuk kasus yang belum diminta eksplisit — lihat §4.
