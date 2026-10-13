# PRD: Flag Education Pages

Status: **Tahap 1 implemented** (2026-10-12) — Tahap 2 (integrasi GoPhish) belum dibangun
Date: 2026-10-09 (terakhir diselaraskan dengan kode 2026-10-12)
Owner: Pukat Product and Engineering
Related area: My Profile tab Flags (`docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md`), wizard Campaign Run (`docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`), integrasi GoPhish (`docs/api_campaignnew.md`)
Implementation plan: `docs/IMPLEMENTATION_PLAN_FLAG_EDUCATION_PAGES.md`

> **Catatan sinkronisasi (2026-10-12):** dokumen ini diselaraskan dari kode yang sudah jalan (tab Flags di My Profile). Tahap 1 — menyusun, mempratinjau, mem-publish Education Page di Pukat — sudah selesai dan tervalidasi (`php -l`, `npm run lint`/`test`). "Published" saat ini hanya menyimpan versi resmi di Pukat (tabel lokal `pukat_flag_pages`); belum dikirim ke GoPhish — itu Tahap 2 (§11).

## 1. Ringkasan

Pukat adalah platform security awareness: karyawan menerima simulasi, lalu yang terpancing perlu langsung mendapat materi pembelajaran. PRD ini menambahkan **Education Page** — satu halaman materi edukasi per entity — yang disusun dari tab **Flags** di My Profile dengan editor yang sama seperti editor landing page (kode HTML + pratinjau browser).

Ini adalah lanjutan dari bagian yang sengaja ditunda di `docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md` §2.3 ("bagaimana contoh Flag ditampilkan ke karyawan").

Pekerjaan dibagi dua tahap:

- **Tahap 1 (cakupan PRD ini, SELESAI 2026-10-12):** entity menyusun, mempratinjau, dan mem-publish Education Page di Pukat. Belum ada hubungan ke GoPhish.
- **Tahap 2 (garis besar saja di §11, butuh keputusan dulu):** halaman yang sudah publish dihubungkan ke master campaign `education` di GoPhish, dipilih di wizard Campaign Run, dan kedatangan karyawan dicatat.

## 2. Latar Belakang

### 2.1 Galeri Flag sudah ada, tetapi belum sampai ke karyawan

Tab Flags hari ini hanya menyimpan galeri gambar contoh per kategori (`pukat_flag_examples`), dan hanya bisa dilihat user Pukat yang login. Tidak ada halaman yang bisa dibuka karyawan setelah simulasi.

### 2.2 GoPhish kini punya master campaign untuk edukasi

`docs/api_campaignnew.md` Rilis 2 menambahkan `campaign_type=education` dan `is_master=true`: satu campaign yang tetap hidup, menerima peserta lewat `POST /api/campaigns/{id}/recipients`, dan mencatat tiap kedatangan sebagai entry tersendiri. **Rilis 3** menambahkan `next_campaign_id` (rantai simulation → education → quiz): saat target submit, GoPhish otomatis mendaftarkan + redirect ke master berikutnya, tanpa orchestrator memanggil `recipients`. Master tetap **wajib** punya landing page — Education Page dari PRD ini yang akan mengisi peran tersebut di Tahap 2.

### 2.3 Editor landing page sudah ada dan bisa dipakai ulang

`HtmlCodeEditor`, `AssetEditorLayout`, dan `BrowserPreview` sudah dipakai di `MasterLandingPages.jsx`. Education Page memakai komponen yang sama, sehingga pengalaman menyusunnya identik dengan membuat landing page dan tidak perlu editor baru.

## 3. Tujuan

- User entity dapat menyusun satu Education Page milik entity-nya (satu per entity), berupa HTML bebas, dari tab Flags di My Profile.
- Gambar contoh yang sudah di-upload di galeri Flag dapat disisipkan ke halaman tanpa menyalin URL secara manual.
- Halaman punya dua keadaan yang jelas: **draft** (sedang dikerjakan) dan **published** (versi yang boleh dilihat karyawan). Menyimpan draft tidak pernah mengubah versi published.
- User hanya dapat melihat dan mengubah halaman entity-nya sendiri; admin dapat melihat dan mengubah semua entity.

## 4. Non-Tujuan

- **Tidak** membangun integrasi GoPhish, pilihan di wizard, maupun pencatatan kedatangan di Tahap 1 (lihat §11).
- **Tidak** membangun fitur Quiz — dibahas sebagai fitur tersendiri.
- **Tidak** membangun editor visual drag-and-drop; editor tetap berbasis kode HTML seperti landing page.
- **Tidak** ada riwayat versi, alur approval admin, maupun assignment ke user lain. Ini konten milik entity sendiri, bukan aset bersama seperti Master Landing Page.
- **Tidak** mengubah cara kerja galeri Flag Example yang sudah ada (upload, hapus, scoping).

## 5. Definisi

### 5.1 Education Page

Satu halaman HTML milik satu entity — **satu halaman per entity** (bukan per kategori). Satu halaman bisa memuat materi banyak flag sekaligus (mis. Beware + Sender + External dalam satu halaman, seperti template nyata). Kategori Flag tetap ada hanya sebagai taksonomi gambar contoh (§5 PRD_AWARENESS), bukan pemilik halaman.

*(Revisi 2026-10-12: sebelumnya satu halaman per kategori — dibalik jadi satu per entity. Lihat §12.)*

### 5.2 Draft dan Published

- **Draft** — isi editor yang terakhir disimpan. Hanya terlihat di Pukat.
- **Published** — salinan draft pada saat tombol Publish ditekan. Inilah satu-satunya versi yang nanti dikirim ke GoPhish dan dilihat karyawan.
- **Perubahan belum di-publish** — draft berbeda dari versi published. Ditandai di UI supaya user tahu karyawan masih melihat versi lama.

## 6. Functional Requirements

- **FR-1**: Tab Flags punya sub-tab **Education Page** (satu editor halaman per entity) dan **Images** (galeri gambar contoh per kategori, yang sudah ada). Tidak ada lagi pemilih/switcher kategori untuk halaman — halaman hanya satu per entity.
- **FR-2**: Editor menampilkan judul halaman, editor kode HTML, dan pratinjau browser (desktop/tablet/mobile) dari isi yang sedang diketik.
- **FR-3**: **Save draft** menyimpan judul dan HTML. Halaman dibuat saat pertama kali disimpan; entity yang belum punya halaman terbuka sebagai halaman kosong (`id: null`), bukan error.
- **FR-4**: **Publish** menyalin draft tersimpan menjadi versi published. **Unpublish** mengembalikan halaman ke draft dan mengosongkan versi published.
- **FR-5**: Tombol **Use starter template** mengisi editor dengan halaman siap pakai hasil adaptasi `docs/prototypes/education-page.html` — bilingual ID/EN (toggle bahasa), 3 kartu red flag dengan pertanyaan, banner himbauan, dan field capture `{{.RId}}` GoPhish. Slot gambar dibuat sebagai `.image-box` kosong (placeholder) yang diisi user lewat sisip base64 (FR-6b), bukan path file relatif. Konfirmasi diminta bila editor sudah berisi.
- **FR-6**: HTML halaman **bebas-bentuk** — user boleh menempel template GoPhish-nya sendiri; fitur tidak mengunci struktur apa pun (jumlah kartu, slot, bahasa). `docs/prototypes/education-page.html` hanyalah contoh.
- **FR-6a (pemilih gambar multi-select + sisip di kursor)**: Di tab Education Page ada **pemilih gambar** (menggantikan "PILIH KATEGORI FLAG" yang dulu switcher kategori) berisi gambar contoh milik entity, dikelompokkan per kategori. Gambar bisa dipilih **multiple** (diberi nomor 1, 2, 3… sesuai urutan klik). Tombol **Insert at cursor** menyisipkan gambar-gambar terpilih, dalam urutan itu, di posisi kursor pada HTML. Tiap gambar disisipkan sebagai `<figure data-pukat-img="{id}"><img><figcaption>`. Setelah disisipkan jadi HTML biasa milik user. UI harus jelas: user tahu gambar masuk **di posisi kursor** dan langsung melihat hasilnya di Live Preview.
- **FR-6b (identitas kode + base64 saat export)**: Tiap gambar yang disisipkan membawa **identitas kode** `data-pukat-img="{flag_example_id}"` pada `<figure>`-nya. Di draft (dan preview), `img src` memakai **URL** gambar contoh — HTML tetap ringan dan terbaca. **base64 bukan disimpan di draft**: saat halaman **di-export/sync ke GoPhish** (Tahap 2), transform menyapu seluruh HTML, menemukan tiap `data-pukat-img`, lalu mengganti `src`-nya dengan **data URI base64** dari rendition yang di-downscale (endpoint `/data-uri`), supaya landing page GoPhish mandiri. Gambar yang user ketik sendiri (tanpa `data-pukat-img`) dibiarkan apa adanya.
- **FR-7**: Status halaman (belum ada, draft, published, published dengan perubahan belum di-publish) ditampilkan di panel editor, beserta tautan **Unpublish** saat published.
- **FR-8**: Perubahan belum disimpan memicu peringatan saat menutup/meninggalkan tab browser (`beforeunload`). Berpindah antar sub-tab Education Page ↔ Images **tidak** menghilangkan draft (editor tetap ter-mount). Tombol **Cancel** membuang perubahan dan mengembalikan ke draft terakhir.
- **FR-9**: User tanpa hak ubah melihat halaman dalam mode baca saja (pratinjau tanpa tombol simpan/publish/insert).
- **FR-10**: *(dibatalkan)* — karena halaman tidak lagi per kategori, menghapus kategori Flag tidak menyentuh Education Page. Guard "kategori punya halaman" tidak berlaku. (Guard "kategori punya Flag Example" di PRD_AWARENESS tetap.)
- **FR-11 (fullscreen editing)**: Baris tab HTML Code / Live Preview punya tombol **Fullscreen** yang membuka overlay layar penuh (lewat `Portal`) berisi tab + editor/preview setinggi viewport, plus aksi **Use starter template**, **Insert at cursor** (bila ada gambar terpilih), **Save Draft**, dan **Exit**. **Escape** keluar; scroll body dikunci selama fullscreen; tinggi editor mengikuti resize.
- **FR-12 (Launch URL + sync master saat Publish)**: Editor punya dropdown **Launch URL** (dari `dynamic_domains`, kolom `launch_url`). Saat **Publish**: (a) HTML published disync jadi GoPhish Landing Page `pukat-edu-<entity>`, lalu (b) bila Launch URL terisi, **master education GoPhish dibuat/di-refresh** (`campaign_type=education`, `is_master`, `url=launch_url`, In progress, aset dummy per entity). Master di-**recreate tiap Publish** karena GoPhish men-snapshot halaman saat create (terverifikasi). Status sync & master dikembalikan ke UI; gagal di salah satunya tidak membatalkan publish lokal.
- **FR-13 (kunci edit saat simulasi aktif)**: Selama ada simulation yang **chained** ke master education entity ini (`next_campaign_id`) dan **belum Completed**, halaman edukasi **terkunci** — save/publish/unpublish ditolak **409 `education_locked`** (backend enforce), dan editor menampilkan banner + menonaktifkan kontrol. Begitu simulasi selesai/dihentikan, halaman bisa diedit lagi. Ini mencegah snapshot master basi di tengah kampanye aktif.

## 7. Data Model

**Tabel baru — `pukat_flag_pages`**

```sql
CREATE TABLE {prefix}flag_pages (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_name     VARCHAR(191)    NOT NULL,
    title           VARCHAR(255)    NOT NULL DEFAULT '',
    html_body       LONGTEXT        NOT NULL,
    published_html  LONGTEXT        DEFAULT NULL,
    status          VARCHAR(50)     NOT NULL DEFAULT 'draft',
    created_by      BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_by      BIGINT UNSIGNED DEFAULT NULL,
    published_by    BIGINT UNSIGNED DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at    DATETIME        DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY entity_name (entity_name)
) $charset_collate;
```

- `html_body` = draft; `published_html` = versi published (NULL bila belum pernah publish atau sudah di-unpublish).
- `UNIQUE (entity_name)` menjamin **satu halaman per entity**; menyimpan berarti upsert. Tidak ada `flag_id` — halaman tidak lagi milik satu kategori. Gambar yang disisipkan menyimpan asalnya sendiri lewat `data-pukat-img` di HTML (FR-6b).
- `entity_name` dicocokkan sebagai string (tanpa FK), konsisten dengan tabel entity-scoped lain.

## 8. API & Security Requirement

```http
GET  /wp-json/pukat/v1/flag-page?entity=            — halaman edukasi entity (kosong bila belum ada)
PUT  /wp-json/pukat/v1/flag-page                     — simpan draft (title, html_body); entity dari server
POST /wp-json/pukat/v1/flag-page/publish             — publish draft tersimpan
POST /wp-json/pukat/v1/flag-page/unpublish           — kembali ke draft

GET  /wp-json/pukat/v1/flag-examples/{id}/data-uri   — base64 (downscaled) satu gambar contoh, dipakai saat export/sync ke GoPhish (FR-6b)
```

Satu halaman per entity, jadi endpoint tunggal (`/flag-page`) tanpa `{flag_id}`. Admin memilih entity lewat `?entity=`; non-admin selalu entity-nya sendiri.

- **Permission**: resource baru `flag_pages` di Permission Registry — `view` (gate `shared`), `edit` dan `publish` (seed `operator`).
- **Entity selalu ditentukan server.** Non-admin selalu memakai entity miliknya; parameter `entity` hanya dihormati untuk admin. Pola identik `FlagExampleService`.
- **Hak tulis** melewati `EntityProfileService::enforce_entity_editable()`: non-admin hanya entity sendiri, dan General hanya bisa diubah admin.
- **Hak baca**: non-admin yang meminta entity lain tidak mendapat 403, melainkan data entity-nya sendiri.
- **`GET /flag-page` mengembalikan satu halaman** (detail, termasuk HTML) — bukan endpoint list, jadi membawa HTML memang diperlukan. Tidak ada endpoint list ringkasan karena hanya satu halaman per entity.
- **Validasi**: entity ditentukan server (bukan dari body); nama entity ≤ 191 karakter (batas kolom UNIQUE `VARCHAR(191)`); `html_body` wajib string dengan batas ukuran **4 MB** (longgar untuk menampung template HTML besar yang di-paste user — `FlagPageService::MAX_HTML_BYTES`); `title` maksimal 255 karakter; publish ditolak (422) bila belum ada draft tersimpan atau draft kosong.
- **`/data-uri`**: gate `flag_examples.view`; hanya mengembalikan base64 untuk gambar contoh milik entity yang boleh dilihat user (scoping `current_user_can_view_entity()`); rendition di-downscale sebelum di-encode, bukan file 2560px penuh.
- **HTML disimpan apa adanya**, sama seperti landing page (`MasterComponentService::html_value()`), karena halaman ini memang halaman web utuh. Konsekuensinya: Pukat **tidak pernah** merender HTML ini di luar iframe ber-sandbox (`BrowserPreview`), dan hak `flag_pages.edit` harus diperlakukan setara dengan hak mengubah landing page.
- **Audit**: `flag_page.saved`, `flag_page.published`, `flag_page.unpublished`.

## 9. UI

Tab Flags di `MyProfile.jsx`:

```text
( Education Page | Images )          ← satu halaman per entity, tanpa switcher kategori

Education Page:
  Create/Edit Education Page                      [Cancel] [Save Draft] [Publish]   ← header
  ┌ panel atas ──────────────────────────────────────────────────────────────┐
  │ NAMA TEMPLATE * [__________________________]                              │
  │ PILIH GAMBAR            (kolom per kategori, berderet ke kanan,           │
  │   Phishing  External  Spoofing  Scam           [Insert at cursor (2)]      │
  │   [1 img]   [2 img]   [ img]    [ img]          ↑ nomor = urutan sisip     │
  │   [ img ]   (tiap kolom scroll vertikal sendiri; deret kolom scroll →)     │
  │ Status: Published · ada perubahan belum di-publish   [Unpublish]          │
  └───────────────────────────────────────────────────────────────────────────┘
  ( HTML Code | Live Preview )              [Use starter template] [Fullscreen]
  ┌ editor HTML (template bebas milik user) ┐
  │  ... taruh kursor di sini ...            │
  │  <figure data-pukat-img="123"> ... </figure>   ← hasil sisip (src = URL)   │
  └────────────────────────────────────────┘
```

- Header memuat Cancel/Save Draft/Publish; panel atas memuat Nama template, pemilih gambar, dan status (+Unpublish).
- Baris tab HTML Code / Live Preview memuat **Use starter template** dan **Fullscreen** (FR-11).
- Sub-tab Images adalah `EntityFlagExamplesPanel` yang sudah ada (upload/kelola galeri per kategori), tanpa perubahan perilaku.

## 10. Acceptance Criteria

- User entity "Finance" menyimpan draft halaman edukasinya, me-reload, dan isi editor tetap sama.
- Setelah Publish, mengubah lalu menyimpan draft tidak mengubah versi published; UI menandai "ada perubahan belum di-publish" sampai Publish ditekan lagi.
- User entity "HR" melihat halaman kosong miliknya sendiri, bukan milik "Finance".
- User "HR" tidak dapat menyimpan ke entity "Finance" walaupun mengirim parameter `entity` (tetap tersimpan ke "HR").
- User non-admin tidak dapat menyimpan halaman entity General (403).
- Menempel template HTML sendiri (mis. `docs/prototypes/education-page.html`) tersimpan dan ter-preview apa adanya tanpa diubah strukturnya.
- Memilih 2 gambar lalu Insert at cursor menaruh dua `<figure data-pukat-img="…">` di posisi kursor sesuai urutan pilih; di draft `img src` berupa URL (bukan base64), dan ter-preview.
- Publish pada draft kosong ditolak (422). HTML di atas 4 MB ditolak (422).
- Response `GET /flag-page` memuat halaman entity (dengan HTML, karena ini detail satu halaman, bukan list).
- Starter template menghasilkan halaman bilingual dengan slot gambar `.image-box` kosong.
- `npm run lint`/`test` clean, `php -l` clean, smoke test sesuai AGENTS.md §7.

## 11. Tahap 2 — Hubungan ke GoPhish (garis besar)

**Disederhanakan setelah `docs/api_campaignnew.md` Rilis 3 (K-01 terimplementasi via `next_campaign_id`).** Kedatangan dari simulasi ke education dicatat **otomatis** oleh GoPhish saat target submit; Pukat tidak perlu endpoint penerima sendiri maupun memanggil `recipients` untuk rantai, dan tidak menyentuh `redirect_url`.

Urutan yang direncanakan:

1. **Klien GoPhish (G1 — SELESAI 2026-10-12)**: `GoPhishService` kenal `campaign_type`/`is_master` (via `create_campaign`), filter `is_master`, `add_recipients`, `reactivate_campaign`, `?confirm_master=true`, dan `set_next_campaign()` (`POST /{id}/next`). Status `Added` dikenali di sisi sync.
2. **Sync saat Publish → GoPhish Landing Page (SELESAI 2026-10-12):** menekan Publish membuat/memperbarui objek **Landing Page** GoPhish bernama `pukat-edu-<entity>` dari HTML `published` — `data-pukat-img` diganti base64 (FR-6b), `capture_credentials=true` (menangkap submit `answer_*`), `redirect_url` kosong (rantai pakai `next_campaign_id`). **Page tidak butuh `url`**, jadi tidak ada keputusan url di sini. `gophish_page_id`/`synced_at` disimpan; sync yang gagal tidak membatalkan publish lokal (bisa di-retry via `POST /flag-page/sync`). Landing page wajib punya `<form method="post">` (template starter sudah punya).
3. **Master education per entity (SELESAI 2026-10-12, verified live):** URL dipilih di editor lewat dropdown **Launch URL**. Master dibuat/di-refresh **saat Publish** (`FlagPageSyncService::recreate_master`): `campaign_type=education`, `is_master`, `url=launch_url`, aset dummy template/smtp per entity, referensi Landing Page `pukat-edu-<entity>`, In progress; `gophish_master_id` disimpan. Di-recreate tiap Publish karena GoPhish men-snapshot halaman saat create (terverifikasi). Edit terkunci selama simulasi terkait aktif (FR-13).
4. **Linking simulation → education (BELUM, G3b)**: saat simulation di-launch dengan education follow-up, set `next_campaign_id` simulation = `gophish_master_id` entity (saat create atau `set_next_campaign()`). Opsional lanjut ke quiz master. Butuh opsi di wizard Step 3 + perubahan alur `CampaignRunService` launch.
5. **Monitoring (BELUM)**: `GET /api/campaigns/{simulation_id}/results` lalu **group `timeline` by `rid`** — `Submitted Data (Education)`/`(Quiz)` sudah tergabung (§3.5.1); `master_stats` untuk hitung kedatangan/orang unik per master.

Peserta di luar rantai (mis. yang tidak terjebak) tetap bisa ditambahkan manual via `add_recipients(send_email=true)`.

## 12. Decisions

- **Satu halaman Education per entity** (keputusan 2026-10-12, membalik keputusan per-kategori sebelumnya) — satu halaman memuat materi banyak flag sekaligus, sesuai template nyata yang dibawa user. Kategori Flag tetap hanya untuk mengelompokkan gambar contoh, bukan memiliki halaman. Konsekuensi: tabel `pukat_flag_pages` jadi UNIQUE per `entity_name` (tanpa `flag_id`), dan API jadi endpoint tunggal `/flag-page`.
- **Pemilih gambar multi-select, bukan switcher kategori** (keputusan 2026-10-12) — area "PILIH KATEGORI FLAG" dulu dikira switcher kategori; dikoreksi jadi pemilih gambar contoh multi-select yang menyisipkan ke HTML.
- **Identitas kode `data-pukat-img`, base64 saat export** (keputusan 2026-10-12) — tiap gambar yang disisipkan ditandai `data-pukat-img="{id}"` pada `<figure>`; `src` draft memakai URL (ringan, terbaca), dan base64 hanya disubstitusi saat export/sync ke GoPhish. Ini mengganti keputusan "base64 inline saat insert" (2026-10-09): identitas kode lebih mudah dilacak, HTML tetap ringan, editor tidak berat, dan base64 tetap format akhir di GoPhish.
- **Master education dibuat saat Publish, bukan saat launch** (keputusan 2026-10-12, FR-12) — karena Launch URL kini dipilih di editor, url sudah diketahui saat Publish, jadi master dibuat di situ ("publish → tersync ke GoPhish" sesuai keinginan user). **Master di-recreate tiap Publish**: terbukti GoPhish men-snapshot halaman/template saat campaign di-create (update Page object tidak mengubah yang disajikan master), jadi untuk mencerminkan edit, master lama dihapus + dibuat ulang (id berubah). Aman karena edit dikunci selama simulasi aktif (FR-13); linking `next_campaign_id` dilakukan saat simulation launch (G3b), bukan saat create master, sehingga id master yang berubah tidak memutus rantai simulasi yang sudah jalan.
- **Edit dikunci saat simulasi aktif** (keputusan 2026-10-12, FR-13) — melengkapi keputusan recreate di atas: selama simulation chained (`next_campaign_id`) belum Completed, halaman tak bisa diubah (backend 409). Mencegah snapshot master basi di tengah kampanye.
- **Bugfix 2026-10-12**: GoPhish `PUT /api/pages/{id}` butuh field `id` di body (`"/:id and /:page_id mismatch"`); `FlagPageSyncService::push()` kini menyertakannya saat update. Tanpa ini, re-sync/re-publish halaman diam-diam gagal (hanya create pertama yang jalan).
- **Draft/published tanpa riwayat versi** untuk v1 — cukup untuk konten milik entity sendiri; versioning bisa ditambahkan nanti tanpa mengubah kontrak API.
- **Resource permission sendiri (`flag_pages`)**, tidak menumpang `flag_examples.upload` — supaya admin bisa memberi hak upload gambar tanpa hak menyusun/publish halaman.
- **Editor memakai ulang komponen landing page**, bukan komponen baru.
- **Panel atas tanpa Redirect URL/Entity/toggle capture** (keputusan 2026-10-09) — field itu dari editor landing page tidak ditampilkan: entity ditentukan server, dan *capture submitted data* selalu aktif untuk Education Page (diterapkan otomatis saat sync ke GoPhish di Tahap 2, bukan pilihan user). Panel atas berisi Nama template, pemilih gambar, dan status; **Use starter template** diletakkan di baris tab editor (sebaris Fullscreen), bukan di panel konfigurasi.
- **Halaman dirender oleh GoPhish di Tahap 2**, bukan oleh halaman publik Pukat — master memang wajib punya landing page, dan Pukat tidak perlu menyajikan HTML bebas dari domainnya sendiri.
- **HTML bebas-bentuk, sisip gambar di kursor** (keputusan 2026-10-09, revisi — FR-6/6a) — karena tiap entity bisa membawa template GoPhish-nya sendiri, fitur tidak boleh mengunci struktur. Ide "blok terkelola (hidup)" yang sempat diputuskan **dibatalkan**: ia mengasumsikan layout kita dan tidak cocok untuk template bebas yang menaruh gambar di tengah dokumen. Gantinya, gambar disisipkan di posisi kursor dan setelah itu jadi HTML biasa milik user. Markup `<figure><img><figcaption>` dengan caption.
- ~~**Gambar tertanam base64 saat disisipkan** (keputusan 2026-10-09)~~ — **DIBATALKAN 2026-10-12**, digantikan oleh keputusan "identitas kode `data-pukat-img`, base64 saat export" di atas. Alasan pembatalan: user minta identitas kode yang jelas dan HTML ringan/terbaca; base64 inline membuat draft besar dan tak terlacak. base64 tetap jadi format akhir, hanya disubstitusi saat export/sync (Tahap 2).
- **Fullscreen editing** (FR-11, keputusan 2026-10-12) — editor + preview bisa dibuka layar penuh lewat `Portal` untuk kenyamanan menyunting HTML panjang, tanpa membuat komponen editor baru.
- **Pemilih gambar = kolom per kategori yang scrollable** (keputusan 2026-10-12) — kategori berderet ke kanan, tiap kolom scroll vertikal sendiri, supaya banyak gambar/kategori tetap ringkas di kolom My Profile yang sempit.

## 13. Open Questions

- ~~**Jalur kedatangan dari simulasi ke master**~~ — **RESOLVED** oleh `docs/api_campaignnew.md` **Rilis 3**: `next_campaign_id` membuat GoPhish otomatis mendaftarkan + redirect target saat submit. Pukat tidak menjembatani; cukup set `next_campaign_id`.
- ~~**`redirect_url` mendukung `{{.RID}}`?**~~ — **MOOT**: rantai tidak memakai `redirect_url` (§3.4); dikosongkan. URL redirect dibangun GoPhish dari `url` campaign tujuan + `?rid=` otomatis, jadi `esc_url_raw()` tidak jadi masalah.
- ~~**Template email dan sending profile untuk master**~~ — **RESOLVED (2026-10-12): aset dummy per entity.** Master tetap wajib punya template/page/smtp walau tidak kirim email di rantai; Pukat menyiapkan aset dummy/"nonaktif" **per entity** (bukan bersama) saat membuat master education entity itu (G2).
- **Kedatangan tanpa submit**: rantai hanya terpicu **submit** `<form method="post">`; yang hanya membuka halaman tidak masuk education. Ditunda/di luar cakupan (perlu mekanisme lain bila ingin ditangkap).
- **Akun/API key GoPhish** yang dipakai orchestrator (`docs/api_campaignnew.md` §6) — keputusan operasional, bukan API. Key diatur runtime lewat fitur **GoPhish Connection** (`pukat_gophish_url`/`pukat_gophish_api_key`), tidak ada kode yang terikat akun tertentu, jadi **bisa diganti kapan pun**. Nuansa: data GoPhish terpisah per akun — **rotasi key akun yang sama** mulus, tapi **pindah ke akun berbeda setelah G2** membuat master/aset yatim (akun baru tak melihatnya, ID tersimpan jadi 404) dan harus dibuat ulang. Disarankan tetapkan akun khusus orchestrator **sebelum G2** agar tak perlu migrasi.
- **Kuota** jumlah gambar/ukuran halaman per entity: diasumsikan hanya batas 4 MB per halaman (FR-6b).
- ~~**Target downscale base64**~~ — **RESOLVED (Tahap 1):** `/data-uri` memakai rendition **`large`** WP (~1024px) via `image_get_intermediate_size()`, fallback ke file tersimpan bila rendition tak ada. Bisa ditinjau ulang bila teks pada screenshot kurang tajam.
- **Kuis di dalam halaman edukasi**: `docs/api_campaignnew.md` memperlakukan `education` dan `quiz` sebagai master terpisah yang dirantai (`next_campaign_id`), tapi Q&A juga boleh ditanam di halaman education (ditangkap sebagai `Submitted Data (Education)`); skor dihitung di luar GoPhish (§7). Jadi quiz master = tahap opsional. Keputusan "quiz menyatu vs master terpisah" diselaraskan saat fitur Quiz digarap — di luar cakupan PRD ini.
- **Editor dengan HTML besar**: `HtmlCodeEditor` menyorot seluruh string. Karena base64 tidak lagi disimpan di draft (hanya URL), draft tetap ringan; tetapi template yang di-paste user bisa panjang. Fullscreen (FR-11) membantu ergonomi; mitigasi highlight (mis. batasi panjang) belum diperlukan sejauh ini.
