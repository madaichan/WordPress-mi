# Implementation Plan: Flag Example Library & Report Contact Info

Status: Draft
Date: 2026-09-25 (disusun ulang — menggantikan versi 2026-09-22 dan 2026-09-23)
Related PRD: `docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md`

**Kenapa disusun ulang:** dua koreksi requirement setelah versi sebelumnya ditulis — (1) Report Contact per-entity, bukan global lewat `SettingsController`; (2) semua data self-service entity dikelola dari **tab di My Profile**, admin hanya mengelola kategori Flag dan memantau lewat Master Entities (`docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md` §14). Plan ini mengikuti pola yang sudah terbukti di Entity Profile & Guardrails: `EntityController`/`EntityProfileService` untuk data per-entity, `enforce_entity_editable()`/`current_user_can_view_entity()` untuk scoping, tab di `MyProfile.jsx` untuk UI.

## 1. Urutan

```text
Bagian A — Call Center Report (kecil, pola identik Entity Profile)
  A1 Schema pukat_report_contacts
  A2 Backend: endpoint per-entity + endpoint publik + kolom oversight
  A3 Frontend: tab "Call Center Report" di My Profile + kolom di Master Entities
  A4 QA

Bagian B — Flag Example Library (lebih berisiko: upload file lewat REST pertama di plugin ini)
  B1 Schema pukat_flags + pukat_flag_examples, seed 4 kategori default
  B2 Backend kategori Flag (admin) + RBAC
  B3 Backend Flag Example: upload/list/delete per-entity
  B4 Frontend: tab "Flags" di My Profile + halaman admin kategori Flag
  B5 QA
```

Bagian A dikerjakan dulu karena kecil dan tidak punya risiko teknis baru; bagian B bisa dimulai setelah A selesai di-commit.

## 2. Bagian A — Call Center Report

### A1. Schema

`includes/Core/Activator.php`: `CREATE TABLE IF NOT EXISTS {prefix}report_contacts` persis PRD §8 (`entity_name` UNIQUE, `contact_name`, `contact_phone`, `contact_email`, `updated_by`, timestamps). Blok `maybe_upgrade()` baru (1.16.0) → `create_tables()`. Tidak ada capability baru (PRD §9: reuse `master_entities.*`), jadi tidak perlu re-seed RBAC.

### A2. Backend

- `EntityProfileRepository`: `find_report_contact( $entity_name )` (case-insensitive), `upsert_report_contact( $entity_name, $data )` (insert kalau belum ada, update kalau sudah — satu baris per entity), dan hitungan "kontak terisi" per entity di `guardrail_counts()` (satu query grouped, bukan N+1).
- `EntityProfileService`:
  - `get_report_contact( $entity_name )` — scope `current_user_can_view_entity()`; entity yang tidak terlihat → objek kosong (bukan 403, konsisten dengan `list_email_domains()`).
  - `save_report_contact( $entity_name, $params, $user_id )` — scope `enforce_entity_editable()` (General & entity lain ditolak untuk non-admin), sanitasi (`sanitize_text_field`, `sanitize_email` + `is_email()`), audit `entity_profile.report_contact_updated`.
  - `guardrails_overview()` — tambah `report_contact_filled` (bool) per baris.
- `EntityController`: `GET`/`PUT /entities/by-name/{entity_name}/report-contact` (gate `master_entities.view` / `.edit`).
- `includes/Api/PublicController.php` (baru): `GET /public/report-contact?entity=<name>` — `permission_callback` selalu `true` (publik, docblock menjelaskan alasannya — PRD §12), hanya mengembalikan `entity_name`/`contact_name`/`contact_phone`/`contact_email`; entity kosong/tidak dikenal → objek kosong status 200, bukan 404. Didaftarkan di `Plugin.php`.

### A3. Frontend

- `entityApi`: `getReportContact(entityName)`, `saveReportContact(entityName, data)`, `publicReportContact` tidak perlu di frontend.
- Hooks: `useEntityReportContact(entityName)`, `useSaveEntityReportContactMutation()` (invalidate kontak entity itu + `entities.overview`).
- `features/entities/EntityReportContactForm.jsx` — form nama/telepon/email, read-only kalau `!canEdit`.
- `MyProfile.jsx`: tab `report` memakai form itu (menggantikan placeholder), `canEdit` sama dengan `canEditEntity` yang sudah ada.
- `MasterEntities.jsx`: kolom "Report contact" (terisi/belum) di tabel oversight.

### A4. QA

`php -l`; smoke test sebagai `pukatopr` (isi/ubah kontak entity sendiri; ditolak untuk General & entity lain; endpoint publik tanpa login mengembalikan kontak yang benar dan objek kosong untuk entity tak dikenal; response publik hanya berisi 4 field whitelist); `npm run lint/build/test`.

## 3. Bagian B — Flag Example Library

### B1. Schema

`pukat_flags` dan `pukat_flag_examples` persis PRD §8, blok migrasi baru. Seed 4 kategori default yang disebutkan di requirement awal — **Phishing, Scam, External, Spoofing** — kalau belum ada (idempoten, cek `flag_key`).

### B2. Kategori Flag (admin)

`FlagController`/`FlagRepository`/`FlagService`: CRUD kategori, `delete` ditolak 409 kalau masih punya contoh. RBAC menu `flags` (view `shared`, create/edit/delete `admin`) + re-seed. Halaman admin kecil `Admin/MasterFlags.jsx`.

### B3. Flag Example (per-entity, upload)

`FlagExampleController`/`FlagExampleService`/`FlagExampleRepository`, RBAC `flag_examples` (view `shared`, upload/delete `operator`), scoping memakai pola yang sama dengan Entity Profile (view: entity sendiri + General; tulis: entity sendiri, General hanya admin). Titik rawan upload (PRD §9):

- `multipart/form-data` → `$request->get_file_params()['file']`.
- `require_once ABSPATH . 'wp-admin/includes/file.php'` (+ `image.php`, `media.php`) sebelum `wp_handle_upload()` — tidak otomatis ter-load di konteks REST.
- Validasi ukuran (maks. 5MB) dan tipe lewat `wp_check_filetype_and_ext()` (isi file, bukan ekstensi/header klien) — hanya png/jpeg/webp.
- `entity_name` selalu dari server (`current_user_entity()`), tidak pernah dari body.
- Hapus = hapus baris **dan** `wp_delete_attachment( $id, true )`.
- Frontend: kirim `FormData`; pastikan header `Content-Type: application/json` default di `client.js` tidak memaksa request upload (axios harus mengisi boundary sendiri) — verifikasi di request nyata.

### B4. Frontend

- Tab `flags` di My Profile: pilih kategori → galeri thumbnail milik entity sendiri, upload + caption, hapus.
- Oversight admin: jumlah contoh per entity di Master Entities (opsional, kalau ringan).

### B5. QA

Selain standar `AGENTS.md` §7: upload file bukan gambar yang di-rename `.png` harus ditolak; hapus contoh menghapus file fisik; user entity lain tidak bisa melihat/menghapus contoh entity lain; tes di environment yang merepresentasikan production untuk batas `upload_max_filesize`/`post_max_size`.

## 4. Di luar cakupan

Sesuai PRD §4 dan §13: cara galeri Flag ditampilkan ke target simulasi, cara add-in Outlook menentukan entity pelapor, dan editor anotasi gambar di dalam Pukat.
