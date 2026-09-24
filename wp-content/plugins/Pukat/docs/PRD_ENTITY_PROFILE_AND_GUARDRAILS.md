# PRD: Entity Profile & Guardrails (Landing Domain, Target Email Domain)

Status: Draft
Date: 2026-09-22
Owner: Pukat Product and Engineering
Related area: Entity scoping di seluruh `includes/Services/CampaignRunService.php`, `pukat_dynamic_domains`/`Admin/MasterDomains.jsx`, RBAC (`docs/PRD_RBAC.md`)
Implementation plan: `docs/IMPLEMENTATION_PLAN_ENTITY_PROFILE_AND_GUARDRAILS.md`

**Catatan revisi (2026-09-25):** Versi awal PRD ini (dan implementasinya) salah model akses — seluruh fitur (Entity Profile, guardrail domain email) di-gate admin-only (`master_entities.*` semua `admin`). Koreksi requirement: informasi ini (kontak entity, domain email resmi entity) **yang tahu adalah user dari entity itu sendiri**, bukan admin pusat — jadi fitur ini harus bisa dikelola mandiri oleh user non-admin, di-scope ke entity miliknya sendiri (pola yang sama seperti Campaign Group: `current_user_can_access_entity()` — admin bebas akses semua entity, non-admin hanya entity miliknya). §7.1, §9, §10, §12 di bawah sudah diperbarui mengikuti koreksi ini; §13 mencatat keputusan akses yang sudah dikonfirmasi.

**Catatan revisi kedua (2026-09-25):** Susulan dari koreksi di atas — lokasi UI juga salah. Pengelolaan mandiri (Entity Profile, kedua Guardrail) seharusnya ada di halaman **My Profile** (`#/my-profile`, `docs/PRD_USER_PROFILE.md`) sebagai tab tambahan — bukan di halaman admin `Master Entities` terpisah, karena ini memang data milik user/entity yang login, bukan sesuatu yang perlu "dicari di menu admin lain". Halaman `Master Entities` yang sudah dibangun **berubah peran** jadi dashboard **oversight/monitoring untuk admin** atas Guardrails (§14). §14 baru menjelaskan detail perubahan IA ini — dan sekaligus temuan penting: **domain landing page (`pukat_dynamic_domains`/Master Domains) ternyata sudah entity-scoped di backend sejak awal** (`MasterComponentService::enforce_write_entity()`/`current_user_can_access_row()`, bagian dari `docs/PRD_ASSET_ACCESS_AND_VERSIONING.md`) — jadi FR-4 (guardrail landing domain) yang PRD ini tambahkan sebelumnya adalah penguatan di atas fondasi yang memang sudah self-service, bukan fitur admin-only yang perlu dikoreksi seperti Entity Profile/email domain guardrail.

## 1. Ringkasan

Pukat sudah punya konsep "Entity" (tenant/organisasi/departemen) yang dipakai luas untuk scoping akses data, tapi Entity hari ini **cuma string bebas** — tidak ada tempat mengelola daftar entity, deskripsinya, atau kontaknya. PRD ini menambahkan **Entity Profile**: tabel metadata baru yang mendeskripsikan tiap entity (nama, deskripsi, kontak, status), **tanpa mengubah struktur data entity yang sudah ada** (keputusan eksplisit — lihat §6). PRD ini juga menambahkan **Guardrails**: (1) memperjelas dan memperkuat enforcement domain landing page yang sebagian sudah ada, dan (2) domain email perusahaan yang sepenuhnya baru — allow-list untuk memvalidasi domain email target/recipient campaign, supaya simulasi tidak bisa mengarah ke penerima di luar domain resmi organisasi.

## 2. Latar Belakang

### 2.1 Entity hari ini: string bebas, tersebar di banyak tempat, tidak ada pengelolaan terpusat

- Disimpan sebagai **WP user meta** (3 key fallback: `meta_entity` → `entity` → `pukat_entity`) — `UserController.php:196-210` (`get_user_entity()`), duplikat logic di `CampaignRunService.php:2207-2219` (`current_user_entity()`), dan backfill di `Activator.php:891-902`. Tiga implementasi terpisah untuk hal yang sama — risiko drift kalau salah satu diubah tanpa mengubah yang lain.
- Disimpan sebagai kolom `VARCHAR(255) DEFAULT 'General'` (`entity` atau `owner_entity`) di hampir semua tabel aset: `pukat_playbooks`, `pukat_email_template_masters`, `pukat_landing_page_masters`, `pukat_sending_profile_refs`, `pukat_dynamic_domains` (`owner_entity`), `pukat_playbook_masters`, `pukat_campaign_runs`, `pukat_campaign_groups`.
- **Tidak ada CRUD/UI** untuk mendefinisikan entity yang valid — string apa pun bisa diketik di field `entity` pada form Master (mis. `MasterDomains.jsx:49` `ownerEntity: 'General'`), termasuk typo yang secara diam-diam membuat data itu jadi entity baru yang terisolasi.
- **Enforcement akses**: `current_user_can_access_entity()` (`CampaignRunService.php:2147-2159`) — admin bypass, `'General'` terbuka untuk semua, selain itu case-insensitive string match. `docs/PRD_RBAC.md` §39 menegaskan Entity dan RBAC-role **ortogonal**: role = fitur apa, entity = baris data mana. PRD ini tidak mengubah model itu.

### 2.2 Guardrail domain landing page: sebagian besar SUDAH ADA

`pukat_dynamic_domains` (`Activator.php:228-250`) + `Admin/MasterDomains.jsx` sudah mengelola domain infrastruktur (landing/sending/both) dengan `authorization_status` (pending/authorized/rejected/expired), `dns_status`, `tls_status`, `owner_entity`. Saat playbook divalidasi siap dipakai (`CampaignRunService.php:1998-2007`), domain default playbook itu **sudah dicek** `status === 'active'` dan `authorization_status === 'authorized'` — domain yang belum authorized tidak bisa dipakai membuat Campaign Run. Yang **belum ada**: pengecekan eksplisit bahwa `owner_entity` domain itu cocok dengan entity user/playbook saat domain dipilih (hari ini scoping entity untuk domain hanya transitif lewat playbook, tidak divalidasi langsung di titik pemilihan domain).

### 2.3 Guardrail domain email perusahaan (target/recipient): belum ada sama sekali

Target/recipient campaign disimpan sebagai snapshot bebas: `CampaignRunService::snapshot_targets()` (baris 1742-1758) cuma memvalidasi `is_email()` (format email valid) terhadap tiap `target.targets[].email` — **tidak ada validasi domain apa pun**. Artinya hari ini operator bisa memasukkan email dengan domain apa saja sebagai target simulasi, termasuk domain yang bukan milik perusahaan. Sesuai keputusan diskusi (lihat `docs/PRD_USER_PROFILE.md` untuk konteks seri dokumen ini), tujuan guardrail ini adalah **validasi target/recipient** — bukan deteksi domain lookalike/spoofing (itu di luar scope PRD ini).

## 3. Tujuan

- Admin dapat mengelola daftar Entity (buat/edit/nonaktifkan) beserta profilnya (deskripsi, kontak) dari satu halaman Master baru.
- Form yang selama ini punya field `entity`/`owner_entity` bebas ketik mendapat **autocomplete/dropdown** dari daftar Entity Profile yang ada — tanpa mengubah bahwa field itu tetap string bebas di backend (§6).
- Domain landing page yang dipakai campaign divalidasi eksplisit terhadap `owner_entity`-nya saat dipilih, bukan hanya transitif lewat playbook.
- Ada allow-list domain email perusahaan per entity; membuat/mengunci Campaign Run dengan target di luar domain yang diizinkan ditolak dengan pesan jelas, kecuali dilewati eksplisit oleh Admin.

## 4. Non-Tujuan

- **Tidak** mengubah kolom `entity`/`owner_entity` yang sudah ada di tabel manapun menjadi foreign key ke tabel Entity baru — keputusan eksplisit hasil diskusi (lihat §6), untuk menghindari migrasi berisiko terhadap data production yang sudah ada di banyak tabel.
- **Tidak** membangun deteksi domain lookalike/typosquatting/spoofing otomatis — guardrail domain email di PRD ini murni allow-list ya/tidak untuk target, bukan analisis kemiripan string domain.
- **Tidak** mengubah model RBAC (`docs/PRD_RBAC.md`) — Entity Profile murni metadata deskriptif tambahan, bukan pengganti role.
- **Tidak** membangun ulang `pukat_dynamic_domains`/`MasterDomains.jsx` — guardrail landing domain di PRD ini adalah penguatan kecil (§7.2), bukan rombak.
- **Tidak** membangun hard-block yang tidak bisa dilewati sama sekali — Admin tetap harus punya jalur override untuk kasus darurat/data lama (lihat §11).

## 5. Definisi

### 5.1 Entity (tidak berubah)
String bebas yang sudah ada — identitas tenant/organisasi/departemen, dibaca dari user meta atau kolom `entity`/`owner_entity` di tabel aset. Tetap sumber kebenaran untuk scoping akses.

### 5.2 Entity Profile (baru)
Baris metadata deskriptif di tabel baru `pukat_entity_profiles`, di-key oleh `entity_name` (dibandingkan case-insensitive, konsisten dengan `current_user_can_access_entity()`). **Tidak mem-validasi atau membatasi** nilai string entity yang dipakai di tempat lain — kalau user mengetik entity yang belum punya profile, sistem tetap menerimanya seperti hari ini (tanpa error), hanya saja tidak akan muncul di dropdown/autocomplete dan tidak dapat menu tambahan (guardrail, kontak, dsb.) sampai profile-nya dibuat.

### 5.3 Guardrail
Aturan validasi yang menolak (atau memberi peringatan, tergantung jenis — lihat §7) suatu aksi kalau data yang dipakai berada di luar batas yang diizinkan untuk entity tersebut.

## 6. Keputusan Skema Entity (mengapa tanpa migrasi struktural)

**Keputusan**: `pukat_entity_profiles` adalah tabel **lookup independen**, bukan tabel induk dengan FK dari tabel-tabel existing. Alasan:

- Entity tersebar di 8+ tabel dan 3 lokasi pembacaan user meta (§2.1) — mengubah semuanya jadi FK adalah migrasi besar dengan blast radius tinggi terhadap data production yang sudah berjalan, di luar kebutuhan nyata yang diminta (yang diminta adalah *profil* entity, bukan normalisasi skema).
- Karena tidak ada FK, **tidak ada validasi hard constraint** bahwa entity yang dipakai di tabel lain harus punya baris di `pukat_entity_profiles`. Ini konsekuensi yang diterima sadar, bukan kelalaian: form-form existing tetap boleh menerima entity yang belum punya profile (backward compatible dengan data lama), UI hanya menyediakan dropdown sebagai *convenience*, bukan enforcement (lihat §9).
- Pencocokan nama tetap case-insensitive string match, sama seperti `current_user_can_access_entity()` — `"finance"` dan `"Finance"` dianggap entity yang sama. Untuk konsistensi ini, `entity_name` disimpan dengan constraint `UNIQUE` case-insensitive (kolom collation yang sudah dipakai default `utf8mb4_unicode_520_ci`/setara sudah case-insensitive di MySQL, tidak perlu perlakuan khusus).

## 7. Functional Requirements

### 7.1 Entity Profile CRUD

- **FR-1**: **Membuat** Entity Profile baru (kerangka: `entity_name` wajib unik case-insensitive) tetap **admin-only** — ini keputusan governance (nama resmi entity, mencegah duplikasi/typo entity baru), bukan konten yang diketahui non-admin.
- **FR-1a** *(baru — koreksi requirement)*: **Mengedit** Entity Profile yang sudah ada (`description`, `contact_name`, `contact_email`, `contact_phone`, `status`) boleh dilakukan **non-admin, tapi hanya untuk entity miliknya sendiri** — user dengan entity meta `"Finance"` hanya bisa mengedit profile `"Finance"`, ditolak 403 kalau mencoba mengedit profile entity lain. Admin tetap bisa mengedit entity mana pun. Ini karena kontak/deskripsi entity adalah informasi yang justru **user entity itu sendiri** yang tahu paling akurat, bukan admin pusat.
- **FR-2**: Entity Profile dengan `status = inactive` tetap muncul di data lama (tidak menghapus histori), tapi tidak muncul lagi di dropdown pemilihan entity baru pada form-form Master.
- **FR-3**: Menghapus Entity Profile **tetap admin-only** (governance, sama seperti FR-1) dan **tidak menghapus atau mengubah** baris manapun di tabel lain yang kebetulan memakai string entity itu (konsekuensi langsung dari §6) — hanya menghapus baris metadata itu sendiri. Dialog konfirmasi hapus wajib menyebutkan ini secara eksplisit ke admin.
- **FR-3a** *(baru)*: **Melihat** daftar Entity Profile: admin melihat semua entity; non-admin hanya melihat profile entity miliknya sendiri (satu baris, bukan daftar semua entity) — mencegah user entity A melihat data kontak entity B yang bukan urusannya.

### 7.2 Guardrail — Domain Landing Page (penguatan, bukan baru)

- **FR-4**: Saat domain dipilih untuk playbook/Campaign Run (bukan hanya saat playbook divalidasi siap pakai seperti hari ini), backend memvalidasi `owner_entity` domain tersebut cocok dengan entity milik pembuat/playbook (admin bypass, `"General"` domain terbuka untuk semua — pola identik `current_user_can_access_entity()`). Ini melengkapi validasi `authorization_status`/`status` yang sudah ada (`CampaignRunService.php:1998-2007`), bukan menggantikannya.

### 7.3 Guardrail — Domain Email Perusahaan (baru)

- **FR-5**: Setiap Entity Profile bisa punya nol atau lebih domain email yang diizinkan (mis. `perusahaan.co.id`, `perusahaan.com`).
- **FR-6**: Saat Campaign Run dibuat/target diperbarui (`CampaignRunService::create()`/`snapshot_targets()`), setiap email target divalidasi: domain (bagian setelah `@`) harus ada di allow-list milik entity target tersebut. Entity `"General"` **tidak otomatis membuka semua domain** untuk guardrail ini (beda dari guardrail lain) — kalau entity belum punya satu pun domain terdaftar di allow-list-nya, guardrail ini **tidak aktif** untuk entity itu (fail-open untuk entity yang belum dikonfigurasi, supaya tidak memblokir seluruh alur existing secara tiba-tiba saat fitur ini dirilis — lihat §11).
- **FR-7**: Target yang domainnya ditolak dikembalikan sebagai daftar per-baris (email mana yang bermasalah), bukan menggagalkan seluruh request tanpa keterangan — konsisten dengan pola `bulk_complete()` yang mengembalikan hasil per-item (`docs/IMPLEMENTATION_PLAN_CAMPAIGN_GROUP_MONITORING.md` §7).
- **FR-8**: Admin (capability `guardrails.bypass`, lihat §10) bisa melewati guardrail ini per Campaign Run dengan flag eksplisit di request — dicatat di Audit Log dengan daftar email yang di-bypass.
- **FR-9** *(baru — koreksi requirement)*: Mengelola allow-list domain email (lihat/tambah/hapus) untuk suatu entity mengikuti scope akses yang sama dengan FR-1a — non-admin hanya bisa mengelola allow-list entity miliknya sendiri, admin bisa mengelola semua entity. Ini konsisten dengan alasan FR-1a: domain email resmi suatu entity adalah informasi yang diketahui user entity itu sendiri.

## 8. Data Model

**Tabel baru 1 — `pukat_entity_profiles`:**

```sql
CREATE TABLE {prefix}entity_profiles (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_name    VARCHAR(255)    NOT NULL,
    description    TEXT            DEFAULT NULL,
    contact_name   VARCHAR(255)    DEFAULT NULL,
    contact_email  VARCHAR(255)    DEFAULT NULL,
    contact_phone  VARCHAR(50)     DEFAULT NULL,
    status         VARCHAR(20)     NOT NULL DEFAULT 'active',
    created_by     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_by     BIGINT UNSIGNED DEFAULT NULL,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY entity_name (entity_name),
    KEY status (status)
) $charset_collate;
```

**Tabel baru 2 — `pukat_target_email_domains`:**

```sql
CREATE TABLE {prefix}target_email_domains (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_name    VARCHAR(255)    NOT NULL,
    domain         VARCHAR(255)    NOT NULL,
    status         VARCHAR(20)     NOT NULL DEFAULT 'active',
    created_by     BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY entity_domain (entity_name, domain),
    KEY entity_name (entity_name)
) $charset_collate;
```

Tidak ada FK ke `pukat_entity_profiles.id` — tetap match by string `entity_name`, konsisten dengan §6.

## 9. API Requirement

Controller baru `includes/Api/EntityController.php`:

```http
GET    /wp-json/pukat/v1/entities                          — list Entity Profile (dipakai juga untuk populate dropdown di form Master lain)
POST   /wp-json/pukat/v1/entities                          — buat Entity Profile
PUT    /wp-json/pukat/v1/entities/{id}                     — update
DELETE /wp-json/pukat/v1/entities/{id}                     — hapus (lihat FR-3, tidak cascade)
GET    /wp-json/pukat/v1/entities/{entity_name}/email-domains    — list domain email allow-list milik entity
POST   /wp-json/pukat/v1/entities/{entity_name}/email-domains    — tambah domain
DELETE /wp-json/pukat/v1/entities/{entity_name}/email-domains/{id} — hapus domain
```

Gate capability baru `master_entities.view`/`.create`/`.edit`/`.delete` di Permission Registry — **bukan admin-only semua** (koreksi dari draft awal):

| Key | Seed gate | Alasan |
|---|---|---|
| `master_entities.view` | `shared` | Semua role login boleh lihat — tapi lihat FR-3a: non-admin cuma lihat entity-nya sendiri (di-scope di service, bukan di RBAC) |
| `master_entities.create` | `admin` | Governance — buat entity baru tetap admin-only (FR-1) |
| `master_entities.edit` | `operator` | Non-admin boleh edit — tapi hanya entity miliknya sendiri (FR-1a, di-scope di service). Dipakai juga untuk endpoint email-domains (FR-9) |
| `master_entities.delete` | `admin` | Governance — hapus entity tetap admin-only (FR-3) |

Endpoint email-domains (list/add/remove) pakai `master_entities.view`/`master_entities.edit` yang sama seperti di atas — RBAC hanya menentukan APAKAH role ini boleh menyentuh fitur ini sama sekali; entity mana yang boleh disentuh ditentukan oleh entity-scoping di service layer (§10), sama seperti pola ortogonal role-vs-entity yang sudah dipakai di seluruh codebase ini (`docs/PRD_RBAC.md` §39).

Perubahan pada endpoint existing:

- `CampaignRunService::create()`/method terkait target: tambah pemanggilan `validate_target_email_domains( array $targets, string $entity ): array` (return daftar error per-email, kosong kalau lolos) sebelum menyimpan/mengunci snapshot.

## 10. RBAC & Security Requirement

- Capability baru: `master_entities.view` (seed `shared`), `.create`/`.delete` (seed `admin`), `.edit` (seed `operator`), `guardrails.bypass` (seed `admin` saja — dipakai FR-8). Lihat tabel §9.
- **Entity-scoping di service layer, bukan cuma RBAC** (koreksi requirement, FR-1a/FR-3a/FR-9): `EntityProfileService` menambah helper `current_user_can_access_entity( string $entity_name ): bool` — pola identik yang sudah dipakai `CampaignRunService`/`CampaignGroupService` (admin bypass, non-admin harus entity meta-nya cocok case-insensitive dengan `entity_name` target). Dipakai di:
  - `list()` — non-admin hanya menerima balik profile entity miliknya sendiri (bukan 403, cukup filter hasil).
  - `get( id )`/`update( id, ... )` — non-admin yang menargetkan entity lain ditolak 403 `entity_forbidden`.
  - `list_email_domains()`/`add_email_domain()`/`remove_email_domain()` — sama, di-scope ke `entity_name` di path.
  - `create()`/`delete()` **tidak** memakai entity-scoping ini — sudah cukup digate admin-only oleh RBAC (§9), tidak ada "entity milik sendiri" yang relevan untuk aksi governance ini.
- `entity_name` yang dikirim ke `POST /entities` disanitasi (`sanitize_text_field`), dicek duplikat case-insensitive sebelum insert (query `WHERE LOWER(entity_name) = LOWER(%s)`).
- Domain yang dikirim ke `.../email-domains` dinormalisasi lowercase dan divalidasi format domain dasar sebelum disimpan (menghindari data kotor seperti domain dengan skema `http://` ikut tersimpan).
- Endpoint bypass guardrail (FR-8) wajib audit log dengan payload daftar email yang di-bypass — bukan sekadar boolean flag, supaya tetap bisa diaudit siapa mem-bypass untuk target siapa. Bypass **tetap admin-only** (`guardrails.bypass` seed `admin`) — tidak dikoreksi, ini override validasi data, beda kelas dari mengelola konten profil/allow-list milik sendiri.

## 11. Migration & Rollout Requirement

- **Fail-open by default** (FR-6): fitur ini dirilis tanpa mengisi satu pun domain di `pukat_target_email_domains` untuk entity manapun — guardrail baru **tidak memblokir apa pun** sampai admin entity terkait secara aktif mengisi allow-list-nya. Ini keputusan sadar supaya rilis fitur ini tidak tiba-tiba memblokir seluruh campaign yang sedang berjalan.
- Tidak ada backfill data dari kolom `entity`/`owner_entity` existing ke `pukat_entity_profiles` — tabel baru dimulai kosong, admin mengisi manual (opsional: seed satu baris `"General"` dengan `status = active` supaya langsung muncul di dropdown, tanpa domain email apa pun).

## 12. Acceptance Criteria

- Admin membuat Entity Profile baru "Finance" dengan kontak lengkap; entity itu muncul sebagai opsi dropdown (bukan cuma text field) di form Master Domains/Email Template/dst.
- User non-admin ber-entity "Finance" bisa mengedit profile "Finance" (kontak, deskripsi) dan mengelola allow-list domain email "Finance" sendiri, **tanpa** butuh capability admin.
- User non-admin ber-entity "Finance" mencoba mengedit profile "HR" (lewat REST langsung, bukan cuma UI) ditolak 403 `entity_forbidden`.
- User non-admin ber-entity "Finance" memanggil `GET /entities` hanya menerima balik profile "Finance", tidak melihat profile entity lain.
- User non-admin **tidak bisa** membuat Entity Profile baru atau menghapus Entity Profile (tetap 403 — governance, FR-1/FR-3), meskipun dia punya `master_entities.edit`.
- Menghapus Entity Profile "Finance" (oleh admin) tidak mengubah satu pun baris di `pukat_playbooks`/`pukat_email_template_masters` yang sebelumnya ber-`entity = 'Finance'`.
- Domain landing page dengan `owner_entity = 'Finance'` gagal dipilih oleh user non-admin ber-entity `'HR'` dengan pesan error jelas (bukan generic 500).
- Entity "Finance" yang sudah diisi allow-list `finance.perusahaan.co.id`: membuat Campaign Run dengan target `orang@gmail.com` ditolak, menyebutkan email mana yang bermasalah; target `orang@finance.perusahaan.co.id` lolos.
- Entity yang **belum** mengisi allow-list apa pun: Campaign Run dengan target domain apa pun tetap berhasil dibuat (fail-open, §11).
- Admin dengan `guardrails.bypass` bisa melewati guardrail domain email untuk kasus tertentu, tercatat di Audit Log.
- `npm run lint`/`build`/`test` clean, `php -l` clean, smoke test REST baru (permission-denied/duplicate-entity/invalid-domain/success case) sesuai `AGENTS.md` §7.

## 13. Decisions

- **Model akses dikoreksi dari admin-only jadi self-service entity-scoped** (2026-09-25) — konfirmasi eksplisit dari diskusi: (a) membuat entity baru tetap admin-only (governance), (b) mengedit profile/allow-list entity yang sudah ada boleh non-admin tapi dibatasi ke entity miliknya sendiri (pola sama seperti Campaign Group), (c) Report Contact di `docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md` juga dikoreksi jadi per-entity dengan alasan yang sama — lihat catatan revisi di dokumen itu.
- **Skema Entity tetap string bebas tanpa FK** — keputusan eksplisit hasil diskusi (§6), diprioritaskan di atas normalisasi skema yang "lebih benar" secara akademis, karena blast radius migrasi FK terhadap data production tidak sepadan dengan kebutuhan yang diminta (profil deskriptif, bukan integritas relasional).
- **Guardrail domain email fail-open untuk entity yang belum dikonfigurasi** — default pragmatis supaya rilis tidak jadi breaking change diam-diam terhadap seluruh campaign existing. Silakan dikoreksi ke fail-closed (semua target ditolak sampai entity eksplisit mengisi allow-list) kalau ternyata itu yang diinginkan sebelum implementasi mulai — ini bukan keputusan mahal untuk dibalik di fase awal.
- **Guardrail domain landing page (FR-4) adalah penguatan kecil, bukan rombak** — karena `authorization_status`/`status` sudah tervalidasi transitif lewat playbook (§2.2), risiko regresi dari perubahan ini kecil, tapi tetap perlu smoke test terhadap alur pembuatan Campaign Run yang sudah ada supaya tidak ada domain "General" existing yang tiba-tiba tertolak.

## 14. Information Architecture — My Profile (self-service) vs Master Entities (oversight admin)

*(Ditambahkan 2026-09-25, revisi kedua — lihat catatan revisi di atas.)*

### 14.1 My Profile (`#/my-profile`) — tempat user entity mengelola data entity-nya sendiri

Halaman My Profile (`docs/PRD_USER_PROFILE.md`) diperluas jadi beberapa tab:

| Tab | Isi | Backend |
|---|---|---|
| **Akun Saya** | Profil pribadi + ganti password (sudah ada) | `ProfileController.php` |
| **Entity Profile** | Deskripsi & kontak entity milik user | `EntityController.php` — `PUT /entities/{id}`, scope `enforce_entity_editable()` |
| **Guardrails → Domain Landing Page** | CRUD domain landing page milik entity user (termasuk tambah domain baru sendiri — keputusan diskusi) | `MasterComponentController.php` `/master/dynamic-domains/*` yang **sudah ada** — sudah entity-scoped, tidak butuh perubahan backend |
| **Guardrails → Domain Email Perusahaan** | Allow-list domain email target milik entity user | `EntityController.php` `.../email-domains`, scope `enforce_entity_editable()` |
| **Flag** | Galeri contoh Flag milik entity | Belum dibangun — `docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md` |
| **Call Center Report** | Kontak pelaporan milik entity | Belum dibangun — `docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md` |

Tab Entity Profile & Guardrails hanya tampil kalau user punya entity (bukan kosong) — user tanpa entity meta tidak punya "entity miliknya sendiri" untuk dikelola. Tab untuk entity **General** tetap tampil tapi read-only untuk non-admin (sama dengan aturan `enforce_entity_editable()`).

### 14.2 Master Entities — oversight admin

Halaman `Master Entities` (admin) berubah dari "tempat mengedit" jadi "tempat memantau":

- **Tetap bisa**: buat & hapus entity (governance, tidak berubah dari §7.1 FR-1/FR-3).
- **Monitoring Guardrails lintas semua entity**: per entity terlihat berapa domain landing page & domain email yang terdaftar beserta statusnya.
- **Enable/disable** (keputusan diskusi — bukan full edit): admin bisa menonaktifkan/mengaktifkan domain email yang didaftarkan suatu entity tanpa menghapus datanya (`PATCH .../email-domains/{id}` — status `active`/`inactive`; guardrail di `CampaignRunService` hanya memakai domain `active`, jadi menonaktifkan = mengeluarkan domain itu dari allow-list tanpa kehilangan jejaknya). Untuk domain landing page, enable/disable & authorize sudah tersedia lewat halaman Master Domains yang ada (`status`, `authorization_status`, capability `domains.authorize`) — tidak diduplikasi di Master Entities, cukup ditautkan.
- **Tidak lagi** jadi tempat utama mengedit kontak/deskripsi entity — itu pindah ke My Profile milik entity itu. Admin tetap *bisa* mengedit lewat API (bypass entity-scoping, §10), tapi UI-nya tidak lagi diarahkan ke sana.
