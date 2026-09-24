# PRD: Flag Example Library & Report Contact Info

Status: Draft
Date: 2026-09-23
Owner: Pukat Product and Engineering
Related area: Entity scoping (`docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md`), `SettingsController.php`
Implementation plan: `docs/IMPLEMENTATION_PLAN_AWARENESS_FLAGS_AND_REPORT_CONTACT.md`

**Catatan revisi (2026-09-23):** Versi PRD ini mengganti desain versi 2026-09-22 secara signifikan. Draft sebelumnya memodelkan Flag sebagai taksonomi teks generik (label + `education_text`) yang ditempel ke Email Template lalu dirender otomatis ke target lewat halaman awareness pasca-submit. Diskusi lanjutan mengoreksi ini: **Flag yang sebenarnya diinginkan adalah galeri contoh gambar (screenshot ber-anotasi dari email sungguhan) yang di-upload manual per-entity**, bukan teks generik — dan mekanisme *bagaimana* contoh-contoh ini nanti ditampilkan ke target dibahas terpisah, di luar cakupan PRD ini (lihat §4, §12). PRD ini sekarang fokus murni pada bagian "personalize": model data dan alur upload/kelola galeri contoh Flag per entity.

**Catatan revisi (2026-09-25):** Requirement Report Contact dikoreksi — sebelumnya didesain sebagai satu kontak **global** (§11 versi lama), ternyata seharusnya **per-entity**, dikelola mandiri oleh user entity itu sendiri (sama seperti alasan Flag Example sudah entity-scoped sejak awal: yang tahu info ini adalah entity itu sendiri, bukan admin pusat). §5.3, §7, §8, §9, §10 di bawah sudah diperbarui; §11 (dulu "Non-Goal: Report Contact Tidak Per-Entity") dibalik jadi per-entity dan modelnya sekarang konsisten dengan `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md` (create governance tetap admin, edit/isi kontak self-service per entity). Bagian Flag Example Library **tidak berubah** — sudah entity-scoped sejak draft ini pertama ditulis.

## 1. Ringkasan

PRD ini menambahkan dua kapabilitas yang tidak saling bergantung: (1) **Flag Example Library** — galeri contoh gambar (screenshot email asli yang sudah dianotasi di luar sistem oleh pengguna) yang dikelompokkan per kategori Flag (Phishing/Scam/External/Spoofing, dst.) dan **dimiliki per entity** — user dari entity mana pun bisa meng-upload beberapa contoh untuk flag yang relevan bagi lingkungan email mereka sendiri; dan (2) **Report Contact** — info kontak (nama/telepon/email call center) yang disimpan di Pukat untuk dikonsumsi oleh add-in "Report" yang direncanakan dibangun terpisah di Outlook.

## 2. Latar Belakang

### 2.1 Flag: tidak ada taksonomi maupun galeri gambar apa pun hari ini

Satu-satunya field yang mendekati adalah `category VARCHAR(100)` di `pukat_email_template_masters`/`pukat_landing_page_masters` (`Activator.php:119,163`) — single value bebas ketik untuk pengelompokan tampilan Master (`EmailTemplateTableRepository.php:87`), tidak berkaitan dengan edukasi target. Tidak ada tabel taksonomi, tidak ada mekanisme upload gambar/attachment di controller manapun (`grep` untuk `wp_handle_upload`/`get_file_params`/`media_sideload` di seluruh `includes/` tidak menemukan hasil) — **fitur upload file belum pernah dibangun di plugin ini sama sekali**. Ini bukan hanya menambah tabel, tapi memperkenalkan pola baru (REST file upload) ke codebase.

### 2.2 Kenapa galeri, bukan satu gambar per taksonomi

Kebutuhan yang dikonfirmasi: setiap entity punya lingkungan email berbeda (tampilan Outlook/Gmail perusahaan masing-masing berbeda, ciri-ciri phishing yang relevan juga bisa berbeda), sehingga contoh yang bermakna untuk satu entity belum tentu relevan untuk entity lain. Karena itu Flag Example bersifat **entity-scoped**, dan satu entity bisa mengumpulkan **banyak** contoh gambar per kategori Flag dari waktu ke waktu (bukan satu gambar tetap yang dikelola terpusat oleh admin platform).

### 2.3 Di luar cakupan PRD ini: bagaimana contoh ini nanti ditampilkan ke target

Sesuai arahan diskusi, desain "bagaimana galeri contoh Flag ini dipakai/dirender ke target simulasi" (mis. dikaitkan ke Campaign Run tertentu, ditampilkan di halaman pasca-klik, dsb.) **sengaja tidak dibahas di PRD ini** — akan jadi PRD/pembahasan terpisah setelah kapabilitas personalize (upload & kelola galeri) ini berdiri. Lihat §4 dan §12 untuk batasan cakupan ini secara eksplisit.

### 2.4 Report Contact: belum ada konsep sama sekali

Tidak ditemukan referensi "call center"/kontak pelaporan di kode manapun. Draft awal PRD ini sempat mengasumsikan satu kontak global lewat `SettingsController.php`'s `PUBLIC_SETTINGS` — **dikoreksi** (lihat catatan revisi di atas): kontak pelaporan yang benar adalah **per-entity**, karena entity yang beda punya call center/PIC pelaporan yang beda pula, dan itu informasi yang diketahui entity itu sendiri, bukan admin pusat. Ini butuh tabel baru (§8), bukan cukup WP option seperti asumsi awal. Add-in Outlook yang akan mengonsumsi data ini **belum dibangun** (dikonfirmasi saat diskusi) — PRD ini hanya menyiapkan data & endpoint-nya, bukan membangun add-in itu sendiri.

## 3. Tujuan

- Setiap entity (lewat user yang punya akses ke entity itu) dapat meng-upload beberapa contoh gambar per kategori Flag, disertai keterangan singkat opsional (judul/label file, bukan paragraf edukasi — anotasi/penjelasan sudah ada di dalam gambar itu sendiri).
- User hanya bisa melihat/mengelola contoh Flag milik entity-nya sendiri; Admin bisa melihat/mengelola semua entity (pola akses identik entity-scoping yang sudah ada di `current_user_can_access_entity()`).
- Kategori Flag (Phishing/Scam/External/Spoofing) tetap satu taksonomi bersama yang dikelola terpusat (bisa ditambah admin), sementara **isi galerinya** (gambar) murni kontribusi tiap entity.
- Setiap entity dapat mengisi/mengelola kontak pelaporannya sendiri (nama, telepon, email call center) — self-service, bukan admin pusat yang mengisi untuk mereka — dan info itu bisa diambil lewat endpoint publik read-only untuk dikonsumsi kelak oleh add-in Outlook.

## 4. Non-Tujuan

- **Tidak** membangun mekanisme menampilkan/mengaitkan contoh Flag ke Campaign Run, Email Template, atau halaman awareness target — itu keputusan desain terpisah yang sengaja ditunda (§2.3). PRD ini berhenti di "entity berhasil mengumpulkan galeri contoh yang tersimpan rapi", bukan "target melihat galeri ini".
- **Tidak** membangun editor anotasi gambar di dalam Pukat (tidak ada UI gambar panah/kotak/teks di atas gambar) — anotasi dilakukan pengguna di tool eksternal sebelum upload; Pukat hanya menyimpan dan menampilkan file jadi.
- **Tidak** membangun add-in Outlook itu sendiri — di luar cakupan proyek WordPress plugin ini. PRD ini berhenti di menyediakan data + endpoint Report Contact.
- **Tidak** membangun sistem autentikasi API key/OAuth penuh untuk konsumen eksternal Report Contact — endpoint publik di §8 read-only dan berisi data non-sensitif, sehingga cukup dibuka publik tanpa auth untuk v1 (lihat §9 untuk mitigasi risiko yang tetap diterapkan).
- **Tidak** membangun sistem notifikasi/dashboard call center — hanya data kontak statis, bukan tiket/ticketing.
- **Tidak** membatasi jumlah entity yang boleh dimiliki satu contoh — setiap contoh dimiliki tepat satu entity (lihat §5.2), tidak ada berbagi lintas entity di v1.

## 5. Definisi

### 5.1 Flag (kategori — tidak berubah dari taksonomi, definisinya menyempit)
Satu baris taksonomi tetap (mis. "Spoofing"): `key`, `label`, warna/ikon opsional untuk UI. **Tidak lagi punya field teks edukasi** — teks/penjelasan kini sepenuhnya melekat di dalam gambar tiap contoh (§5.2), bukan di level kategori. Dikelola admin dari UI (bisa ditambah kategori baru, tidak hardcode di kode — beda dari Permission Registry yang sengaja whitelist-kode, karena Flag adalah taksonomi konten, bukan kunci keamanan).

### 5.2 Flag Example (baru — inti PRD ini)
Satu baris galeri: satu file gambar yang di-upload seorang user, terhubung ke satu kategori Flag dan **dimiliki oleh satu entity** (entity diambil dari entity milik uploader saat upload, bukan dari input klien — pola identik `CampaignGroupService::create()` di `docs/IMPLEMENTATION_PLAN_CAMPAIGN_GROUP_MONITORING.md` §6). Boleh punya `caption` singkat (label, bukan paragraf edukasi). Satu entity boleh punya banyak Flag Example untuk kategori Flag yang sama.

### 5.3 Report Contact *(direvisi — sekarang per-entity, lihat catatan revisi 2026-09-25)*
Info kontak pelaporan phishing milik satu entity (nama, telepon, email), dikelola mandiri oleh user entity itu sendiri — bukan pengaturan global. Satu entity punya nol atau satu baris kontak (bukan galeri seperti Flag Example — cukup satu kontak resmi per entity).

## 6. Functional Requirements — Flag Example Library

- **FR-1**: Admin CRUD kategori Flag (taksonomi bersama): `key` (slug unik), `label`, `color` opsional, `is_active`. Tidak ada field teks edukasi lagi (§5.1).
- **FR-2**: User dengan akses ke suatu entity (lihat §9 untuk gate permission-nya) dapat meng-upload gambar (PNG/JPG/WEBP) sebagai Flag Example untuk kategori Flag tertentu, dengan `caption` opsional. Entity contoh tersebut otomatis diisi dari entity milik user yang upload — tidak bisa dipilih manual/dispoof dari klien.
- **FR-3**: User dapat melihat daftar Flag Example **milik entity-nya sendiri saja**, dikelompokkan per kategori Flag (galeri). Admin dapat melihat dan memfilter seluruh entity.
- **FR-4**: User yang meng-upload (atau Admin) dapat menghapus Flag Example — non-admin hanya boleh menghapus milik entity-nya sendiri.
- **FR-5**: Satu kategori Flag untuk satu entity boleh punya nol atau banyak Flag Example (galeri, bukan slot tunggal) — sesuai kebutuhan "setiap user bisa memberikan contoh beberapa".

## 7. Functional Requirements — Report Contact *(direvisi 2026-09-25 — per-entity)*

- **FR-6**: User dengan akses ke suatu entity dapat mengisi/mengubah kontak pelaporan entity itu (`contact_name`, `contact_phone`, `contact_email`) dari halaman Master Entities (`docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md`) — bukan halaman terpisah, supaya satu tempat untuk semua data self-service per entity. Scope akses **identik** dengan `EntityProfileService::enforce_entity_editable()`: non-admin hanya entity miliknya sendiri, dan General tidak bisa diedit non-admin. Membuat entity baru tetap admin-only, tapi mengisi kontaknya adalah edit biasa.
- **FR-7**: `GET /wp-json/pukat/v1/public/report-contact?entity=<entity_name>` — endpoint publik read-only, menerima `entity_name` sebagai parameter wajib, mengembalikan kontak entity itu (kosong kalau belum diisi). Ditujukan untuk dikonsumsi add-in Outlook yang akan dibangun kelak (§4) — **bagaimana add-in itu tahu entity mana yang relevan** (mis. dari domain email si pelapor, dicocokkan ke allow-list domain email entity di `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md`) belum didesain di PRD ini, dicatat sebagai Open Question (§13).

## 8. Data Model

**Tabel baru 1 — `pukat_flags`** (taksonomi bersama, disederhanakan dari draft sebelumnya — kolom `education_text` dihapus dari desain):

```sql
CREATE TABLE {prefix}flags (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    flag_key        VARCHAR(100)    NOT NULL,
    label           VARCHAR(255)    NOT NULL,
    color           VARCHAR(20)     DEFAULT NULL,
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    created_by      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY flag_key (flag_key)
) $charset_collate;
```

**Tabel baru 2 — `pukat_flag_examples`** (baru, inti PRD ini — menggantikan `pukat_email_template_flags` dari draft sebelumnya, yang dibatalkan bersama konsep attach-ke-template):

```sql
CREATE TABLE {prefix}flag_examples (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    flag_id        BIGINT UNSIGNED NOT NULL,
    entity_name    VARCHAR(255)    NOT NULL,
    attachment_id  BIGINT UNSIGNED NOT NULL,
    caption        VARCHAR(255)    DEFAULT NULL,
    uploaded_by    BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY flag_id (flag_id),
    KEY entity_name (entity_name)
) $charset_collate;
```

`attachment_id` mengacu ke WP Media Library (`wp_posts` post type `attachment`) — file disimpan lewat pipeline upload native WP (§9), bukan folder kustom, supaya dapat semua penanganan bawaan WP (validasi mime, thumbnail, `wp_delete_attachment()` saat Flag Example dihapus).

**Tabel baru 3 — `pukat_report_contacts`** *(baru — pengganti pendekatan WP option global di draft sebelumnya, sekarang per-entity, lihat catatan revisi 2026-09-25)*:

```sql
CREATE TABLE {prefix}report_contacts (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_name    VARCHAR(255)    NOT NULL,
    contact_name   VARCHAR(255)    DEFAULT NULL,
    contact_phone  VARCHAR(50)     DEFAULT NULL,
    contact_email  VARCHAR(255)    DEFAULT NULL,
    updated_by     BIGINT UNSIGNED DEFAULT NULL,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY entity_name (entity_name)
) $charset_collate;
```

Satu baris per entity (`UNIQUE KEY entity_name`) — bukan galeri seperti `pukat_flag_examples`. Tidak ada FK ke `pukat_entity_profiles.id`, match by string `entity_name`, konsisten dengan pola yang sama di seluruh dokumen seri ini.

## 9. API & Security Requirement

```http
GET    /wp-json/pukat/v1/flags                                    — list kategori Flag (semua role yang login)
POST   /wp-json/pukat/v1/flags                                    — buat kategori Flag (admin)
PUT    /wp-json/pukat/v1/flags/{id}                                — update (admin)
DELETE /wp-json/pukat/v1/flags/{id}                                — hapus (tolak 409 kalau masih punya Flag Example, mirip pola tolak-kalau-dipakai di dokumen lain)

GET    /wp-json/pukat/v1/flag-examples?flag_id=&entity=            — list Flag Example (non-admin: entity dipaksa ke entity milik sendiri, parameter `entity` diabaikan/divalidasi; admin: bebas filter entity)
POST   /wp-json/pukat/v1/flag-examples                             — upload gambar baru (multipart/form-data: file + flag_id + caption)
DELETE /wp-json/pukat/v1/flag-examples/{id}                        — hapus (non-admin hanya kalau entity_name milik contoh itu sama dengan entity dirinya)

GET    /wp-json/pukat/v1/entities/by-name/{entity_name}/report-contact    — ambil kontak entity (view scope, sama dengan Entity Profile)
PUT    /wp-json/pukat/v1/entities/by-name/{entity_name}/report-contact    — isi/ubah kontak entity (edit scope — enforce_entity_editable(), FR-6)

GET    /wp-json/pukat/v1/public/report-contact?entity=<entity_name>      — PUBLIK, no auth, wajib parameter entity (FR-7)
```

Dua route pertama didaftarkan di `EntityController.php` yang sudah ada (`docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md`), bukan controller baru — mengikuti pola `.../email-domains` yang sudah dibangun di sana, sama-sama data pelengkap Entity Profile dengan scope akses identik.

- **Entity pada `POST /flag-examples` selalu diisi dari `current_user_entity( $user_id )` di backend, tidak pernah dari body request** — mencegah user entity A mendaftarkan contoh atas nama entity B (pola identik keputusan di `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md` §10 dan `CampaignGroupService::create()`).
- **Validasi upload**: mime type dibatasi whitelist gambar (`image/png`, `image/jpeg`, `image/webp`), ukuran file dibatasi (mis. 5MB) sebelum diteruskan ke `wp_handle_upload()` — jangan percaya `Content-Type` dari klien mentah-mentah, validasi ulang lewat `wp_check_filetype_and_ext()` (fungsi WP native) sebelum insert attachment, konsisten dengan aturan §5.1 `AGENTS.md` ("backend harus validasi ulang semua mutation").
- `GET /flag-examples`: non-admin yang mengirim parameter `entity` milik entity lain **tidak mengembalikan 403**, cukup mengembalikan data entity-nya sendiri (query selalu dipaksa `WHERE entity_name = current_user_entity()` untuk non-admin, parameter klien diabaikan) — konsisten dengan pola read-scoping entity yang sudah ada di `current_user_can_access_run()` dkk., bukan pola reject eksplisit.
- `DELETE /flag-examples/{id}`: backend mengecek ulang kepemilikan entity di server (bukan mengandalkan tombol hapus disembunyikan di frontend untuk entity lain) — menghapus baris DB **dan** `wp_delete_attachment( $attachment_id, true )` supaya file fisik ikut terhapus, bukan orphan di Media Library.
- Endpoint publik Report Contact **wajib** hanya mengembalikan field yang eksplisit di-whitelist (§7) — tidak pernah passthrough row/option lain. Tidak ditemukan `entity_name` yang cocok → kembalikan objek kosong dengan status 200 (bukan 404), sama seperti alasan `docs/IMPLEMENTATION_PLAN_AWARENESS_FLAGS_AND_REPORT_CONTACT.md` §6 lama: jangan bocorkan ke pengunjung anonim apakah suatu entity ada.
- Flag (kategori) CRUD digate capability baru `flags.view/.create/.edit/.delete` di Permission Registry (view: `shared`, create/edit/delete: `admin` — kategori adalah taksonomi bersama lintas entity, beda dari Flag Example yang per-entity). Flag Example CRUD digate capability baru `flag_examples.view/.upload/.delete` (seed `operator` — siapa pun dengan akses entity boleh berkontribusi contoh, bukan cuma admin, sesuai kebutuhan "biarkan user per entity yang upload").
- Report Contact (FR-6) **tidak** memakai capability baru — reuse `master_entities.view`/`master_entities.edit` yang sudah ada di `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md` (data ini secara konseptual adalah bagian dari Entity Profile, bukan resource terpisah), dan `EntityProfileService::enforce_entity_editable()` yang sama dipakai ulang untuk validasi PUT-nya (termasuk aturan General tidak bisa diedit non-admin).

## 10. Acceptance Criteria

- Admin membuat kategori Flag "Spoofing".
- User dari entity "Finance" meng-upload 2 gambar contoh untuk kategori "Spoofing"; user dari entity "HR" hanya melihat 0 contoh di kategori itu (galeri miliknya sendiri kosong), tidak melihat 2 contoh milik "Finance".
- User "Finance" tidak bisa menghapus contoh yang di-upload user "HR" (kalaupun tahu ID-nya, request ditolak).
- Admin bisa melihat dan menghapus Flag Example dari entity mana pun.
- Upload file non-gambar (mis. `.exe`/`.php` yang diubah ekstensinya jadi `.png`) ditolak oleh validasi `wp_check_filetype_and_ext()`, bukan lolos ke Media Library.
- Menghapus Flag Example juga menghapus attachment fisiknya dari Media Library (tidak orphan).
- Menghapus kategori Flag yang masih punya Flag Example ditolak (409) sampai seluruh contoh di kategori itu dihapus dulu.
- User non-admin entity "Finance" mengisi Report Contact untuk "Finance" lewat halaman Master Entities; user non-admin entity "HR" tidak bisa mengisi/mengubah kontak "Finance" (403 `entity_forbidden`, reuse `enforce_entity_editable()`).
- `GET /public/report-contact?entity=Finance` (tanpa auth) mengembalikan kontak "Finance" yang baru diisi; dengan `entity` yang tidak ada profile-nya mengembalikan objek kosong berstatus 200, bukan 404.
- `npm run lint`/`build`/`test` clean, `php -l` clean, smoke test endpoint publik dan admin (permission-denied/wrong-entity/invalid-file-type/success case) sesuai `AGENTS.md` §7.

## 11. Report Contact Per-Entity *(dulu "Non-Goal: Report Contact Tidak Per-Entity" — dibalik oleh revisi 2026-09-25)*

Report Contact di PRD ini **per-entity** (satu baris kontak per entity di `pukat_report_contacts`), bukan satu kontak global — draft sebelumnya (2026-09-23) memutuskan global sebagai "default pragmatis", tapi itu keliru: alasan yang sama dengan Flag Example (§2.2 — informasi ini yang tahu adalah entity itu sendiri) berlaku juga di sini. Konsisten dengan `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md`: mengisi/mengubah kontak adalah edit biasa (self-service, entity-scoped), bukan governance — beda dari membuat Entity Profile baru yang tetap admin-only.

## 12. Decisions

- **Gambar sepenuhnya menggantikan teks edukasi** (keputusan eksplisit hasil diskusi) — `pukat_flags.education_text` dari draft sebelumnya dihapus total dari desain, bukan dipertahankan sebagai field opsional. `caption` yang ada di Flag Example murni label singkat (nama file/judul singkat), bukan tempat menaruh penjelasan panjang.
- **Anotasi dibuat di luar sistem, Pukat hanya menyimpan file jadi** — tidak ada editor gambar built-in di v1 (§4). Ini mengurangi scope implementasi secara signifikan dibanding membangun canvas anotasi sendiri; bisa jadi perluasan additive nanti kalau tim konten merasa perlu.
- **Flag Example dimiliki per entity, bukan galeri global bersama** — konsisten dengan alasan §2.2: lingkungan email tiap entity berbeda, jadi galeri yang relevan juga harus berbeda per entity, bukan satu galeri yang dipakai bersama semua entity.
- **Mekanisme delivery ke target ditunda ke pembahasan terpisah** (§2.3, §4) — PRD ini sengaja berhenti di "personalize" (upload & kelola galeri) tanpa mendesain bagaimana galeri ini nanti dipakai di alur simulasi/awareness. Konsekuensinya: **PRD ini TIDAK lagi menyentuh arsitektur landing page GoPhish** yang jadi pertimbangan besar di draft sebelumnya — pertimbangan itu relevan lagi begitu pembahasan delivery dimulai, dicatat sebagai referensi di riwayat draft PRD ini (lihat catatan revisi di bagian atas dokumen) supaya tidak perlu ditemukan ulang dari nol nanti.
- **WP Media Library dipakai apa adanya untuk penyimpanan file** (`wp_handle_upload()`/`wp_insert_attachment()`), bukan folder storage kustom — konsisten dengan prinsip tidak membangun infrastruktur baru kalau primitive WP native sudah cukup (pola yang sama dipakai keputusan role management di `docs/PRD_RBAC.md` §6 untuk WP native role).
- **Endpoint publik Report Contact tanpa auth untuk v1** — pragmatis karena add-in Outlook konsumennya belum ada dan datanya non-sensitif. Tambahkan API key sederhana nanti kalau add-in mulai dibangun dan butuh jaminan lebih. Tetap berlaku setelah dikoreksi jadi per-entity — cuma tambah parameter `entity`, tidak mengubah keputusan soal auth.
- **Report Contact reuse `EntityController.php`/`master_entities.*`, bukan controller atau capability baru** (koreksi 2026-09-25) — data ini secara konseptual bagian dari Entity Profile (kontak entity), jadi ikut pola akses yang sama persis (§9/§10) daripada membuat sistem permission paralel untuk hal yang sama.

## 13. Open Questions

- Kategori Flag (`pukat_flags`) di FR-1 tetap dikelola terpusat oleh admin (satu taksonomi bersama semua entity). Apakah ini benar yang diinginkan, atau kategori juga perlu bisa ditambah bebas per entity (mis. entity "Finance" ingin kategori "Invoice Fraud" yang tidak relevan untuk entity lain)? Diasumsikan **tetap satu taksonomi bersama** untuk v1 karena Phishing/Scam/External/Spoofing yang disebutkan di awal diskusi terdengar generik lintas organisasi — silakan dikoreksi kalau keliru, ini tidak mahal untuk diubah sebelum implementasi mulai (cukup ubah FR-1 dan tambah kolom `entity_name` opsional di `pukat_flags`).
- Batas jumlah/ukuran upload per entity (kuota) belum didefinisikan — v1 diasumsikan tanpa kuota (hanya dibatasi ukuran per-file di §9), silakan dikoreksi kalau perlu pembatasan.
- **Bagaimana add-in Outlook menentukan `entity` yang relevan** saat memanggil `GET /public/report-contact?entity=...` (FR-7) belum didesain — kandidat yang disebutkan saat diskusi: cocokkan domain email pelapor terhadap allow-list domain email entity (`docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md` §7.3), tapi itu menyiratkan endpoint publik baru (`GET /public/entity-by-domain?domain=...`) yang belum ada di PRD manapun. Ditunda sampai pembangunan add-in Outlook benar-benar dimulai — di luar cakupan PRD ini (§4).
