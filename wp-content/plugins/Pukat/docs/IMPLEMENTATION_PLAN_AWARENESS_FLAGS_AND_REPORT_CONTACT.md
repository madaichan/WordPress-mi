# Implementation Plan: Flag Example Library & Report Contact Info

Status: Draft
Date: 2026-09-23
Related PRD: `docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md`

**Catatan revisi (2026-09-23):** Plan ini menggantikan versi 2026-09-22 yang didesain untuk PRD lama (Flag = teks edukasi + delivery ke Awareness Page via redirect GoPhish). PRD sudah dikoreksi jadi galeri contoh gambar per-entity; plan ini disusun ulang total mengikuti PRD baru. Fase "validasi asumsi GoPhish redirect" dan "Awareness Page publik" dari plan lama **dihapus** — bukan bagian dari scope saat ini (lihat PRD §2.3/§4/§12), akan disusun sebagai plan terpisah kalau pembahasan delivery dimulai.

**Catatan revisi (2026-09-25):** PRD-nya baru saja dikoreksi lagi — Report Contact yang sebelumnya didesain global (WP option lewat `SettingsController`) sekarang per-entity (tabel baru `pukat_report_contacts`, reuse `EntityController.php`/`master_entities.*` dari `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md` — lihat PRD §5.3/§7/§8/§9/§11 terbaru). Plan Phase 4 & 6 di bawah (yang masih menyebut `SettingsController`) **belum diperbarui** mengikuti koreksi ini — akan disusun ulang saat implementasi PRD ini benar-benar dimulai, jangan diikuti apa adanya. Fase lain (Flag Example Library) tidak terpengaruh, sudah entity-scoped sejak awal.

## 1. Ringkasan

Dua tabel baru (`pukat_flags`, `pukat_flag_examples`), satu controller Flag (taksonomi, admin-managed), satu controller Flag Example (upload/list/delete, entity-scoped, memperkenalkan pola REST file upload yang belum pernah ada di plugin ini), satu controller publik kecil untuk Report Contact, dan dua halaman frontend (kelola kategori Flag untuk admin, galeri upload untuk semua user).

## 2. Dependency Order

```text
Phase 1: Schema — pukat_flags, pukat_flag_examples
   |
   +-- Phase 2: Backend Flag (taksonomi) CRUD — FlagController.php           [butuh Phase 1]
   |
   +-- Phase 3: Backend Flag Example upload/list/delete — FlagExampleController.php   [butuh Phase 1 + Phase 2]
   |
Phase 4: Report Contact — extend SettingsController + PublicController::report_contact()   [independen]
   |
Phase 5: RBAC — capability flags.*, flag_examples.*                          [butuh Phase 2 + 3]
   |
   +-- Phase 6: Frontend admin — Master Flags (kelola kategori)              [butuh Phase 2 + 5]
   +-- Phase 7: Frontend — galeri upload Flag Example (semua user)           [butuh Phase 3 + 5, bisa paralel dengan Phase 6]
   |
Phase 8: QA end-to-end
```

Phase 4 sepenuhnya independen — bisa dikerjakan kapan saja.

## 3. Phase 1: Schema

**File:** `includes/Core/Activator.php` — dua `CREATE TABLE IF NOT EXISTS` (SQL persis PRD §8) + blok `maybe_upgrade()` baru untuk instalasi existing.

**Acceptance Criteria:** `php -l` bersih; migration idempoten; kedua tabel muncul di DB dev.

## 4. Phase 2: Backend — Flag (Taksonomi) CRUD

**File baru:** `includes/Api/FlagController.php`, `includes/Repositories/FlagRepository.php`, `includes/Services/FlagService.php` (pola 3-layer standar di codebase ini).

- `FlagService::create()`: validasi `flag_key` unik (`sanitize_title()`), `label` wajib.
- `FlagService::delete( int $id )`: cek dulu `SELECT COUNT(*) FROM pukat_flag_examples WHERE flag_id = %d` — kalau > 0, return `WP_Error( 'flag_in_use', ..., [ 'status' => 409 ] )` (PRD §10).
- Route: `GET/POST /flags`, `PUT/DELETE /flags/{id}` — daftar persis PRD §9, didaftarkan di `includes/Core/Plugin.php`.

**Acceptance Criteria:** CRUD kategori Flag lewat REST berhasil; hapus kategori yang masih punya Flag Example ditolak 409.

## 5. Phase 3: Backend — Flag Example (Upload, Galeri Entity-Scoped)

**File baru:** `includes/Api/FlagExampleController.php`, `includes/Repositories/FlagExampleRepository.php`, `includes/Services/FlagExampleService.php`.

Ini fase paling berisiko di plan ini karena memperkenalkan pola baru (file upload lewat REST) — tidak ada precedent yang bisa langsung disalin dari controller lain di codebase ini (lihat PRD §2.1).

- `FlagExampleController::upload()`:
  - Ambil file dari `$request->get_file_params()['file']` (bukan `get_json_params()` — endpoint ini `multipart/form-data`).
  - Validasi ukuran (`$file['size']` terhadap batas mis. 5MB) dan tipe: panggil `wp_check_filetype_and_ext( $file['tmp_name'], $file['name'] )` (fungsi WP native yang membaca *actual* file signature, bukan cuma ekstensi/`Content-Type` klien) — tolak kalau hasilnya bukan salah satu `image/png`/`image/jpeg`/`image/webp` (PRD §9, mencegah upload file berbahaya yang disamarkan jadi gambar).
  - Butuh `require_once ABSPATH . 'wp-admin/includes/file.php';` (dan `image.php`/`media.php`) sebelum memanggil `wp_handle_upload()` — file-file ini biasanya tidak ter-load di konteks REST API request, beda dari konteks wp-admin biasa. **Cek ini secara eksplisit saat implementasi**, gagal require ini adalah penyebab umum fatal error "call to undefined function" untuk fungsi upload WP di luar wp-admin.
  - `wp_handle_upload( $file, [ 'test_form' => false ] )` → dapat path lokal → `wp_insert_attachment()` → `wp_generate_attachment_metadata()` + `wp_update_attachment_metadata()` (supaya thumbnail otomatis ter-generate, berguna kalau nanti frontend perlu preview kecil).
  - `flag_id` dan `caption` dari `$request->get_param()` (form field biasa, tetap terbaca meski request `multipart/form-data`).
  - `entity_name` **selalu** dari `current_user_entity( get_current_user_id() )` — parameter itu, kalau ada di body, diabaikan total (PRD §9, cegah spoofing entity).
  - Insert baris `pukat_flag_examples` dengan `attachment_id` hasil `wp_insert_attachment()`.
- `FlagExampleService::list( array $filters, int $user_id, bool $is_admin )`: non-admin — paksa `WHERE entity_name = current_user_entity( $user_id )` di query, abaikan parameter `entity` dari klien kalau ada (bukan reject, cukup diabaikan — PRD §9). Admin — boleh filter `entity`/`flag_id` bebas.
- `FlagExampleService::delete( int $id, int $user_id, bool $is_admin )`: `find()` dulu, kalau `! $is_admin && $row['entity_name'] !== current_user_entity( $user_id )` → `WP_Error 403`. Sukses: `wp_delete_attachment( $row['attachment_id'], true )` (hard delete file fisik) baru hapus baris DB.
- Route: `GET/POST /flag-examples`, `DELETE /flag-examples/{id}` — daftar persis PRD §9.

**Acceptance Criteria:** upload gambar valid berhasil, file muncul di Media Library dan baris `pukat_flag_examples` tercipta dengan `entity_name` sesuai uploader (coba kirim `entity_name` lain di body — harus tetap terisi entity uploader yang sebenarnya); upload file `.php` yang di-rename `.png` ditolak; non-admin hanya melihat/menghapus contoh entity-nya sendiri; hapus contoh juga menghapus attachment fisik dari Media Library.

## 6. Phase 4: Report Contact

**File:** `includes/Api/SettingsController.php`, `includes/Api/PublicController.php` (baru, kecil — kalau sudah ada dari kebutuhan lain di codebase, reuse; kalau belum, buat baru khusus menampung endpoint publik non-auth).

- Tambah `pukat_report_contact_name`, `pukat_report_contact_phone`, `pukat_report_contact_email` ke `SettingsController::PUBLIC_SETTINGS` dan `update_settings()`'s `$plain_keys` (pola identik field string lain yang sudah ada, mis. `pukat_org_name`).
- `PublicController::report_contact()` — `GET /pukat/v1/public/report-contact`, `permission_callback` selalu `true`, return tiga `get_option()` di atas saja (whitelist eksplisit).

**Acceptance Criteria:** admin isi Report Contact di halaman Settings existing, tersimpan dan terbaca kembali; `GET /public/report-contact` tanpa login mengembalikan tiga field itu.

## 7. Phase 5: RBAC

**File:** `includes/Services/PermissionRegistry.php`.

- Menu `flags` (taksonomi) — `view_gate: 'shared'`, actions `create`/`edit`/`delete` semua seed `'admin'` (taksonomi bersama lintas entity, governance-sensitive).
- Menu/action `flag_examples` — `view_gate: 'shared'` (dibatasi entity di level query, bukan di level RBAC — lihat Phase 3), actions `upload` seed `'operator'`, `delete` seed `'operator'` (backend tetap mengecek kepemilikan entity terpisah dari RBAC, lihat Phase 3 — RBAC di sini hanya menentukan role apa yang punya akses ke fitur ini SAMA SEKALI, bukan baris mana, konsisten dengan prinsip ortogonal role vs entity di `docs/PRD_RBAC.md` §39).
- Endpoint publik Report Contact **tidak** didaftarkan di Permission Registry — di luar sistem RBAC karena memang publik.

**Acceptance Criteria:** role Viewer bisa lihat galeri Flag Example (miliknya sendiri) tapi tidak bisa upload; role Operator bisa upload dan hapus miliknya sendiri.

## 8. Phase 6: Frontend Admin — Kelola Kategori Flag

- `pukat-app/src/pages/Admin/MasterFlags.jsx` — CRUD sederhana kategori Flag (label, warna, aktif/nonaktif) — tanpa versioning/approval karena bukan asset yang perlu draft/review.
- `pukat-app/src/api/flags.js`, `hooks/queries/useFlags.js`, `hooks/mutations/useFlagMutations.js`.

**Acceptance Criteria:** admin CRUD kategori Flag dari UI; hapus kategori yang masih punya contoh menampilkan pesan error yang jelas (bukan silent fail).

## 9. Phase 7: Frontend — Galeri Upload Flag Example

- Halaman baru `pukat-app/src/pages/Admin/FlagExamples.jsx` (dapat diakses semua role yang login, tidak hanya admin — lihat Phase 5) — pilih kategori Flag dari dropdown (`useFlags()`), tampilkan galeri thumbnail milik entity user (grid gambar + caption), tombol upload (`<input type="file">` + form data ke endpoint upload) dan tombol hapus per gambar (hanya tampil untuk gambar yang memang milik entity sendiri — meski begitu backend tetap validasi ulang, ini murni UX per §4.3 `AGENTS.md`).
- `pukat-app/src/api/flagExamples.js` — wrapper upload pakai `FormData`, bukan JSON (`client.js` axios wrapper existing perlu dicek apakah default header `Content-Type: application/json`-nya perlu di-override jadi `multipart/form-data` untuk request ini — axios otomatis set boundary yang benar kalau body-nya `FormData` dan header `Content-Type` **tidak** di-set manual, jadi pastikan wrapper ini tidak memaksa header JSON default untuk endpoint upload).
- Nav entry baru (grup "Master Library" atau grup baru — sesuaikan saat implementasi), gated `<PermissionRoute permission="flag_examples.view">`.

**Acceptance Criteria:** user bisa upload gambar dan langsung melihatnya di galeri; user tidak melihat opsi hapus untuk gambar entity lain (meski secara teori tidak akan pernah menerima data entity lain dari API, lihat Phase 3 scoping query).

## 10. Phase 8: QA

- `npm run lint && npm run build && npm run test` dari `pukat-app`.
- REST smoke test: upload valid/invalid file type/oversize, list dengan entity scoping (dua user beda entity saling tidak melihat galeri satu sama lain), delete oleh pemilik vs bukan pemilik vs admin.
- Regression check ringan: pastikan menambahkan dua tabel baru tidak mengubah `pukat_db_version` handling yang dipakai fitur lain (jalankan `maybe_upgrade()` dua kali, pastikan idempoten — pola pengecekan yang sama seperti di `docs/IMPLEMENTATION_PLAN_CAMPAIGN_GROUP_MONITORING.md` §2.4).

## 11. Risiko

- **File upload lewat REST API adalah pola baru** (§5) — kemungkinan ada isu konfigurasi server (`upload_max_filesize`/`post_max_size` di PHP, batas body size di web server/reverse proxy) yang tidak relevan untuk endpoint JSON biasa. Perlu dites di environment yang representasikan production, bukan cuma local dev, sebelum dianggap selesai.
- Kalau `wp-admin/includes/file.php` tidak ter-require dengan benar di konteks REST API, `wp_handle_upload()` akan fatal error — ini risiko implementasi konkret yang disebutkan eksplisit di Phase 3, bukan sekadar catatan umum.
- Scope "bagaimana galeri ini nanti dipakai untuk delivery ke target" sengaja tidak dikerjakan di plan ini (PRD §2.3) — pastikan tidak ada pekerjaan diam-diam merambat ke sana sebelum pembahasan terpisah itu terjadi (`AGENTS.md`: "Jangan memperluas scope PRD secara diam-diam").
