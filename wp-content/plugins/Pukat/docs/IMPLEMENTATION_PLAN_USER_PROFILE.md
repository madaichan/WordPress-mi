# Implementation Plan: User Profile (Self-Service)

Status: Draft
Date: 2026-09-22
Related PRD: `docs/PRD_USER_PROFILE.md`

## 1. Ringkasan

Menambahkan satu controller baru (`ProfileController.php`), satu meta field baru (`pukat_phone`), dan satu halaman SPA baru (`MyProfile.jsx`). Tidak ada migrasi tabel — paling sederhana dari tiga inisiatif yang sedang disusun, cocok dikerjakan sebagai satu PR tunggal (tidak perlu dipecah fase seperti RBAC/Campaign Group).

## 2. Dependency Order

```text
Phase 1: Backend — ProfileController.php (GET/PUT /me, POST /me/change-password)
   |
Phase 2: Frontend — hooks (useMyProfile/useUpdateProfile/useChangePassword)
   |
Phase 3: Frontend — halaman MyProfile.jsx + nav entry
   |
Phase 4: Audit log wiring + QA end-to-end
```

Phase 1 tidak bergantung ke apa pun yang sedang berjalan (RBAC & Entity Profile PRD lain) — aman dikerjakan paralel dengan dua inisiatif lain.

## 3. Phase 1: Backend

**File baru:** `includes/Api/ProfileController.php`, extends `RestController`.

```php
register_rest_route( $this->namespace, '/me', [
    [ 'methods' => 'GET', 'callback' => [ $this, 'get_me' ], 'permission_callback' => [ $this, 'permission_logged_in' ] ],
    [ 'methods' => 'PUT', 'callback' => [ $this, 'update_me' ], 'permission_callback' => [ $this, 'permission_logged_in' ] ],
] );
register_rest_route( $this->namespace, '/me/change-password', [
    'methods' => 'POST', 'callback' => [ $this, 'change_password' ], 'permission_callback' => [ $this, 'permission_logged_in' ],
] );
```

- `permission_logged_in()`: sama seperti pola `permission_view_settings()`/`permission_read()` yang sudah ada — cek `is_user_logged_in()` saja, kembalikan `WP_Error 401` kalau tidak.
- `get_me()`: `get_current_user_id()` → `get_userdata()` + `get_user_meta( $id, 'pukat_phone', true )` + `current_user_entity()` (reuse method dari `CampaignRunService`, atau extract ke helper statis kalau dianggap lebih bersih — lihat catatan duplikasi di `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md` §2 yang juga menyentuh 3 lokasi bacaan entity yang sama) + role dari `$user->roles[0]`. `avatar_url` dari `get_avatar_url( $id )` (WP native, Gravatar-based).
- `update_me()`: baca `$request->get_json_params()`, **whitelist ketat** — hanya proses key `display_name`, `email`, `phone`; key lain di payload diabaikan (PRD §10). `email` divalidasi `is_email()` + `email_exists()` (tolak kalau dipakai user lain, kecuali email sama dengan email sendiri). `wp_update_user( [ 'ID' => $id, 'display_name' => ..., 'user_email' => ... ] )`, lalu `update_user_meta( $id, 'pukat_phone', sanitize_text_field(...) )`. Panggil `AuditLogService::log( 'user.profile_updated', ['user_id' => $id], $id )` di akhir.
- `change_password()`: ambil `current_password`/`new_password` dari body. `$user = wp_get_current_user();` lalu `wp_check_password( $current_password, $user->user_pass, $user->ID )` — kalau gagal, `WP_Error( 'invalid_current_password', ..., [ 'status' => 401 ] )`. Kalau `new_password` kosong, `WP_Error 422`. Sukses: `wp_set_password( $new_password, $user->ID )` lalu `AuditLogService::log( 'user.password_changed', [], $user->ID )`. **Catatan penting**: `wp_set_password()` menghancurkan semua auth cookie session termasuk session yang sedang request ini — frontend harus redirect ke halaman login setelah sukses, bukan mengharapkan session lanjut jalan.
- Registrasi controller baru di `includes/Core/Plugin.php` (daftar controller yang di-`register_routes()` saat `rest_api_init`), pola identik controller lain.

**Acceptance Criteria:** `php -l` bersih; `GET /me` mengembalikan data user login; `PUT /me` dengan `role` di body tidak mengubah role (verifikasi query DB langsung); `POST /me/change-password` dengan password lama salah → 401; dengan benar → user bisa login pakai password baru.

## 4. Phase 2: Frontend — Data Layer

- `pukat-app/src/api/profile.js` — wrapper axios: `getMe()`, `updateMe(payload)`, `changePassword(payload)`.
- `pukat-app/src/hooks/queries/useMyProfile.js` — `useQuery(['me'], getMe)`.
- `pukat-app/src/hooks/mutations/useUpdateProfile.js` — `useMutation(updateMe)`, `onSuccess` invalidate `['me']` (dan `['me', 'permissions']` kalau nama tampil di topbar/header).
- `pukat-app/src/hooks/mutations/useChangePassword.js` — `useMutation(changePassword)`, `onSuccess` redirect ke halaman login WP (`window.location.href = '/wp-login.php'`) karena session dihancurkan (lihat catatan Phase 1).

## 5. Phase 3: Frontend — Halaman

- `pukat-app/src/pages/Admin/MyProfile.jsx` — dua `Card` (pola `components/UI/Card`): "Informasi Profil" (display_name/email/phone + tombol Simpan, pakai `Input`/`Label`/`Button` existing) dan "Ganti Password" (current/new/confirm, validasi confirm === new di client sebelum submit). Badge read-only role & entity di header halaman (reuse `Badge`).
- Tambah entry di `adminNavGroups` (`pukat-app/src/config/appRoutes.jsx`) — **tidak** dibungkus `<PermissionRoute permission="...">` karena halaman ini valid untuk semua role yang login (beda dari pola nav item lain yang selalu permission-gated, tandai dengan komentar singkat di kode kenapa item ini berbeda supaya tidak dianggap bug oleh reviewer berikutnya).

**Acceptance Criteria:** halaman render untuk keempat role bawaan (Admin/Operator/Reviewer/Viewer); submit form sukses menampilkan toast dan data ter-refresh tanpa reload manual.

## 6. Phase 4: QA & Audit Wiring

- Tambah dua action baru (`user.profile_updated`, `user.password_changed`) ke daftar action yang sudah dikenal `AuditLogService` (kalau ada allowlist action di sana — cek pola `role.created`/`role.updated` dari `docs/IMPLEMENTATION_PLAN_RBAC.md` §14 sebelum menambah).
- Regression check: pastikan `PUT /me`/`POST /me/change-password` tidak bisa dipanggil dengan `user_id` user lain di body (coba kirim `user_id` orang lain — harus tetap memakai `get_current_user_id()`, bukan value dari body).
- `npm run lint && npm run build && npm run test` dari folder `pukat-app`.

## 7. Out of Scope untuk Plan Ini

Sesuai PRD §4 — avatar upload custom, 2FA, integrasi native `profile.php`, notifikasi preferensi. Tidak ada pekerjaan terkait itu di plan ini.
