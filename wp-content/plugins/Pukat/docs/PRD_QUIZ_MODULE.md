# PRD: Quiz Module

Status: **Implemented** (2026-10-21) — Q1–Q7 selesai dan terverifikasi live.
> Penyimpangan kecil antara dokumen ini dan kode as-built dicatat di `docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md` §"Penyimpangan dari PRD (as-built)" — baca itu sebelum memperlakukan §7/§8 sebagai kontrak final.
Date: 2026-10-20
Owner: Pukat Product and Engineering
Related area: Education Page (`docs/PRD_FLAG_EDUCATION_PAGES.md`), wizard Campaign Run (`docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`), integrasi GoPhish (`docs/api_campaignnew.md`), risk scoring (`includes/Services/RiskScoringService.php`)
Implementation plan: `docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md`

> Dokumen ini menutup bagian yang sengaja digantung di `docs/PRD_FLAG_EDUCATION_PAGES.md` §4 ("tidak membangun fitur Quiz") dan §13 ("keputusan quiz menyatu vs master terpisah diselaraskan saat fitur Quiz digarap").

## 1. Ringkasan

Setelah karyawan terpancing simulasi dan membaca Education Page, tahap berikutnya adalah **evaluasi**: apakah materinya nyangkut. PRD ini menambahkan **Quiz Module** — satu halaman quiz per entity yang dirantai setelah education (atau langsung setelah simulasi), jawabannya ditangkap GoPhish, lalu **dinilai di Pukat** dan masuk ke risk scoring.

Modul ini menyambung dua bagian yang sudah ada tapi belum bertemu:

- **Quiz native legacy** — tabel `pukat_quiz_questions`/`pukat_quiz_results`, `QuizController`, dan kontribusi skor quiz di `RiskScoringService` sudah ada sejak awal, tetapi tidak tersambung ke GoPhish dan UI-nya masih demo.
- **Rantai GoPhish** — `campaign_type=quiz`, `is_master`, dan `next_campaign_id` sudah didukung fork (`docs/api_campaignnew.md` Rilis 2/3), dan monitoring G4 **sudah** menghitung `quiz_completed` dari event `Submitted Data (Quiz)`. Yang belum ada: halaman quiz-nya, master quiz-nya, dan penilaian jawabannya.

Polanya mengikuti Education Page (G2/G3/G3b/G4) yang sudah terbukti live, bukan arsitektur baru.

## 2. Latar Belakang

### 2.1 Quiz legacy berdiri sendiri dan belum tersambung

- `pukat_quiz_questions` adalah bank soal **global** — tanpa `entity_name`, jadi tidak bisa dipakai model per-entity yang dipakai seluruh fitur lain.
- `QuizController::submit_quiz()` menilai **seluruh** isi bank, bukan soal yang benar-benar disajikan ke target. Dengan bank yang tumbuh, skor jadi salah.
- `POST /quiz/submit` mengandaikan halaman quiz di-host Pukat. Itu bertabrakan dengan rantai `next_campaign_id`, yang mengharuskan halaman disajikan GoPhish.
- Di frontend, `quizApi` hanya **diekspor** di `api/index.js` dan tidak dipanggil komponen mana pun; `pages/PostSimulation/Quiz.jsx` berisi 1 soal hardcoded dan `QuizReportPane.jsx` masih mock. Artinya tidak ada konsumen nyata yang akan rusak kalau kontrak legacy diubah.
- Yang **nyata dipakai**: `RiskScoringService` membaca `pukat_quiz_results.score` (kontribusi 0–50, invers persentase). Ini satu-satunya konsumen hilir yang harus tetap jalan.

### 2.2 Rantai dan monitoring sudah siap menerima quiz

- `docs/api_campaignnew.md` §3.1.1/§4.2: `next_campaign_id` merangkai simulation → education → quiz; peserta quiz dibuat **otomatis** saat target submit, tanpa memanggil `recipients`.
- §3.5.1: `GET /api/campaigns/{simulation}/results` **sudah** menggabungkan event `Submitted Data (Quiz)` ke timeline campaign sumber dengan `rid` ditulis-ulang ke entry asal. Jadi jawaban quiz sampai ke Pukat **tanpa call API baru**.
- G4 (`docs/IMPLEMENTATION_PLAN_FLAG_EDUCATION_PAGES.md`) sudah memakai itu: `QUIZ_EVENT_TYPE`, `target_details().quiz_at`, `aggregate_result_stats().quiz_completed`/`quiz_rate`, dan kolom `Quiz` di `Performing.jsx` muncul kondisional. Semua itu kini akan punya isi.
- §7: **GoPhish tidak menilai quiz.** Penilaian memang tugas Pukat.

### 2.3 Pola Education Page bisa dipakai ulang hampir seluruhnya

`FlagPageService`/`FlagPageSyncService`/`FlagPageRepository` + editor `EntityFlagPageEditor` sudah menyelesaikan: satu halaman per entity, draft/published, sync Landing Page, master per entity, inline base64 gambar, edit-lock saat simulasi aktif, dan Launch URL dari `dynamic_domains`. Quiz memakai pola yang sama; yang benar-benar baru hanya **answer key + linter + skoring**.

Tipe domain `quiz` juga **sudah ada** di `MasterComponentService::DOMAIN_TYPE_VALUES` (migrasi `1.27.0`), jadi dropdown Launch URL quiz tinggal memfilternya.

## 3. Tujuan

- Entity dapat menyusun **satu halaman quiz** miliknya (HTML bebas, pola identik Education Page) dan mem-publish-nya ke GoPhish sebagai master quiz.
- Jawaban target **dinilai otomatis** di Pukat terhadap kunci yang berlaku saat halaman itu tayang, lalu masuk ke `pukat_quiz_results` dan risk scoring.
- Quiz dapat dirantai **setelah education** maupun **langsung setelah simulasi**, dan bisa dikirim manual ke target di luar rantai.
- Operator tidak pernah bisa mem-publish halaman quiz yang jawabannya tidak dapat dinilai.
- Hasil quiz terbaca di report: per target, per percobaan, dan per soal.

## 4. Non-Tujuan

- **Tidak** menampilkan skor atau pembahasan ke target setelah submit. Target hanya diarahkan ke halaman terima kasih (§5.5). Menampilkan skor butuh halaman publik Pukat yang menerima `rid` — di luar cakupan.
- **Tidak** mengacak soal per target. Secara arsitektur tidak mungkin: halaman quiz adalah HTML statis yang di-snapshot GoPhish saat master dibuat, dan tidak ada yang merender per target. Lihat §12.
- **Tidak** memilih subset soal per campaign run di v1 (§12 Open Question).
- **Tidak** membangun editor visual; editor tetap berbasis kode HTML.
- **Tidak** ada riwayat versi halaman atau alur approval, konsisten dengan Education Page.
- **Tidak** mengubah rumus risk scoring (`50 − persentase × 0.5`) maupun kontrak `RiskScoringService`.
- **Tidak** menerjemahkan soal secara otomatis. Bank soal satu bahasa; versi EN ditulis operator di HTML (§5.2).
- **Tidak** ada tipe soal bergambar di v1. Bank soal hanya menyimpan soal **text-only**; soal dengan gambar sudah diputuskan sebagai tipe kedua tapi dikerjakan setelah v1 (§11, §12).

## 5. Definisi

### 5.1 Bank soal (question bank)

Kumpulan soal milik satu entity. Tiap soal menyimpan pertanyaan, opsi beserta **kunci**, dan **`input_name`** — nama atribut `name` input HTML yang mewakili soal itu (mis. `answer_q1`). `input_name` adalah jembatan satu-satunya antara HTML bebas dan penilaian.

### 5.2 Halaman quiz

Satu halaman HTML per entity, **bebas-bentuk** seperti Education Page: operator boleh menempel template GoPhish-nya sendiri. Satu-satunya kewajiban struktural: ada `<form method="post">` dan setiap soal yang dinilai memakai `name` sesuai `input_name`-nya.

> **Direvisi 2026-10-21 (§13).** Bentuk bebas ini adalah v1 yang sudah terbangun. Arah berikutnya: operator membuat halaman quiz **tanpa koding** — memilih **quiz template** dari katalog yang dibuat administrator, lalu menandai soal mana dari bank yang tampil; HTML digenerate. Lihat §13.

Starter template yang digenerate bersifat **bilingual ID/EN** dengan toggle bahasa (seperti starter education), tetapi **bank soal hanya menyimpan teks ID**. Teks EN diisi operator langsung di HTML. Konsekuensi penting: label dua bahasa harus berbagi **satu set input** — kalau blok soal diduplikasi untuk EN beserta `name`-nya, linter menolak publish karena nama ganda (§6 FR-6).

### 5.3 Answer key dan snapshot

**Answer key** = peta `input_name` → nilai benar, diturunkan dari soal aktif entity. Saat Publish, answer key dan pass score yang berlaku **di-snapshot** ke row halaman (`published_answer_key_json`, `published_pass_score`). Jawaban yang masuk kemudian dinilai terhadap snapshot itu, bukan terhadap bank yang mungkin sudah diedit. Tanpa ini, mengedit soal akan diam-diam mengubah nilai orang yang sudah mengerjakan.

### 5.4 Master quiz dan campaign undangan

- **Master quiz** — satu per entity, `campaign_type=quiz`, `is_master=true`, tanpa `groups`, tidak mengirim email. Dipakai sebagai tujuan rantai (`next_campaign_id`). Aset template/SMTP-nya **dummy**, karena memang tidak mengirim apa pun.
- **Campaign undangan quiz** — campaign quiz biasa (`is_master=false`) yang dibuat on-demand untuk mengirim quiz ke target di luar rantai (§6 FR-15). Memakai template email + sending profile **sungguhan** yang dipilih operator saat itu, dan menunjuk Landing Page quiz entity yang sama.

### 5.5 Halaman terima kasih

URL statis tujuan `redirect_url` halaman quiz, dipilih entity di editor. Karena quiz adalah ujung rantai (`next_campaign_id = 0`), tanpa ini target akan menggantung di halaman quiz setelah submit.

## 6. Functional Requirements

- **FR-1 (area Quiz)**: route `/post/quiz` yang sudah terdaftar (`appRoutes.jsx`, permission `post_sim.view`, judul "Quiz Module — Question bank and quiz results") diisi dua sub-tab: **Question Bank** dan **Quiz Page**. `Quiz.jsx` demo digantikan.
- **FR-2 (bank soal per entity)**: CRUD soal milik entity — pertanyaan, opsi (`{label, value, correct}`), `input_name`, penjelasan, difficulty, tags, dan `is_active`. Soal di v1 **selalu text-only**; `question_type` belum ada di skema, dan penambahannya dijadwalkan sebagai fase lanjutan (§12). `input_name` wajib cocok pola `^answer_[a-z0-9_]{1,50}$` dan **unik per entity**. Soal boleh punya lebih dari satu opsi benar (dinilai sebagai himpunan).
- **FR-3 (halaman quiz per entity)**: satu halaman per entity dengan judul, editor kode HTML, dan pratinjau browser. **Save draft** tidak pernah mengubah versi published. Entity yang belum punya halaman terbuka sebagai halaman kosong (`id: null`), bukan error.
- **FR-4 (starter dari bank soal)**: tombol **Use starter template** menghasilkan HTML dari **soal aktif entity**: `<form method="post">`, hidden `{{.RId}}`, satu blok per soal dengan `name` = `input_name`, label bilingual ID/EN berbagi satu input, dan slot EN kosong siap diisi. Konfirmasi diminta bila editor sudah berisi.
- **FR-5 (HTML bebas + sisip gambar)**: HTML tidak dikunci strukturnya. Pemilih gambar multi-select dari galeri flag example entity (galeri yang sama, bukan galeri baru) menyisipkan `<figure data-pukat-img="{id}">` di posisi kursor; `src` draft memakai URL dan diganti base64 saat export ke GoPhish. Perilaku identik FR-6a/6b PRD Education Page, memakai ulang helper yang sama.
- **FR-6 (linter publish — memblokir)**: Publish **ditolak 422** dengan daftar masalah bila: (a) ada input `answer_*` di HTML tanpa kunci terdaftar, (b) ada soal **aktif** yang `input_name`-nya tidak muncul di HTML, (c) ada `name` ganda, atau (d) tidak ada `<form method="post">`. Linter juga bisa dijalankan tanpa publish (dry-run) supaya operator melihat masalahnya sambil menyunting. Pesan error (c) harus menyebut jebakan duplikasi blok EN (§5.2) secara eksplisit.
- **FR-7 (publish → snapshot + sync + master)**: Publish melakukan, berurutan: (1) validasi linter, (2) salin draft → published + snapshot answer key & pass score, (3) sync Landing Page GoPhish `pukat-quiz-<entity>` dengan `capture_credentials=true` dan `redirect_url` = halaman terima kasih, (4) create/refresh master quiz `pukat-quiz-master-<entity>` (`campaign_type=quiz`, `is_master=true`, `url=launch_url`, aset dummy per entity), (5) relink rantai (FR-10). Master **di-recreate tiap Publish**, sebab GoPhish men-snapshot halaman saat create — sama seperti master education (FR-12 PRD Education Page). Gagal di langkah 3–5 **tidak** membatalkan publish lokal; statusnya dikembalikan ke UI dan bisa di-retry.
- **FR-8 (unpublish)**: mengembalikan halaman ke draft, mengosongkan versi published beserta snapshot-nya, dan melepas rantai education → quiz yang menunjuk master itu.
- **FR-9 (Launch URL + halaman terima kasih)**: dropdown **Launch URL** diisi dari `dynamic_domains` yang **difilter `type=quiz`** (tipe ini sudah ada sejak migrasi `1.27.0`), divalidasi server. Field **Thank-you URL** menyimpan `redirect_url` halaman quiz.
- **FR-10 (relink rantai dua arah)**: karena master di kedua sisi di-recreate saat publish, `next_campaign_id` harus dipulihkan setiap kali:
  - Publish **education** → setelah master education baru dibuat, set `next_campaign_id`-nya ke master quiz entity (bila ada halaman quiz published).
  - Publish **quiz** → setelah master quiz baru dibuat, set ulang `next_campaign_id` master education entity ke master quiz yang baru.
  - Gagal relink bersifat **warning**, bukan pembatal publish, dan harus terlihat di UI.
- **FR-11 (edit-lock)**: selama ada simulasi chained yang belum Completed di rantai entity itu, halaman quiz **terkunci** — save/publish/unpublish ditolak **409 `quiz_locked`** (backend enforce) dan editor menampilkan banner. Setara FR-13 PRD Education Page; deteksinya harus mencakup simulasi yang menunjuk master quiz **maupun** yang menunjuk master education yang merantai ke quiz itu.
- **FR-12 (pass score)**: pass score disimpan **per entity** di halaman quiz, dengan **override opsional per campaign run** di wizard. Resolusi saat skoring: override run → entity → option global `pukat_quiz_pass_score` (70). Nilai yang berlaku ikut disimpan di row hasil, karena `passed` dihitung saat sync.
- **FR-13 (wizard Step 3)**: baris **quiz** di kartu "Set The Follow Up" jadi toggle live, **independen** dari toggle education:
  - education on + quiz on → sim → education → quiz.
  - education off + quiz on → sim → quiz langsung.
  - Toggle aktif hanya bila entity punya halaman quiz `status=published` + `gophish_master_id`; bila tidak, disabled dengan hint "Publish halaman quiz dulu".
  - Field override pass score muncul saat quiz on.
- **FR-14 (skoring otomatis)**: saat sync hasil campaign run, event `Submitted Data (Quiz)` dinilai terhadap snapshot answer key halaman yang tayang: `score` = persentase jawaban benar dari jumlah soal di snapshot, `passed` = `score >= pass_score` efektif. Hasil ditulis ke `pukat_quiz_results` **satu row per kedatangan** (`gophish_rid`), idempoten lewat `UNIQUE (campaign_run_id, gophish_rid)`. Risk scoring memakai **percobaan terakhir** per target.
- **FR-15 (kirim quiz manual)**: operator dapat mengirim quiz ke target terpilih di luar rantai. Implementasinya **bukan** `add_recipients` ke master, melainkan membuat **campaign undangan quiz** (§5.4) dengan template email + sending profile yang dipilih operator saat itu dan group berisi target terpilih. Alasan: GoPhish men-snapshot template saat create, jadi master yang dibuat dengan template dummy akan mengirim email dummy; mengganti asetnya berarti recreate master, yang justru diblokir edit-lock saat simulasi aktif. Hasil campaign undangan ikut dinilai FR-14, dengan row hasil tanpa `campaign_run_id`.
- **FR-16 (reporting)**: `QuizReportPane` diisi data nyata — ringkasan (peserta, lulus, gagal, rata-rata), tabel per target dengan riwayat percobaan, dan **analisis per soal** (berapa banyak yang salah per `input_name`) berikut denominatornya. Kolom skor quiz ikut di report campaign run.
- **FR-17 (read-only)**: user tanpa hak ubah melihat bank soal dan halaman dalam mode baca saja, tanpa tombol simpan/publish/insert/kirim.

## 7. Data Model

### 7.1 Tabel baru — `pukat_quiz_pages`

Mirror `pukat_flag_pages`, ditambah kolom khusus quiz.

```sql
CREATE TABLE {prefix}quiz_pages (
    id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    entity_name              VARCHAR(191)    NOT NULL,
    title                    VARCHAR(255)    NOT NULL DEFAULT '',
    html_body                LONGTEXT        NOT NULL,
    published_html           LONGTEXT        DEFAULT NULL,
    published_answer_key     LONGTEXT        DEFAULT NULL COMMENT 'JSON snapshot: input_name -> {correct[], question_id}',
    published_pass_score     TINYINT UNSIGNED DEFAULT NULL,
    pass_score               TINYINT UNSIGNED DEFAULT NULL COMMENT 'per-entity; NULL = pakai option global',
    launch_url               VARCHAR(255)    NOT NULL DEFAULT '',
    thankyou_url             VARCHAR(255)    NOT NULL DEFAULT '',
    status                   VARCHAR(50)     NOT NULL DEFAULT 'draft',
    gophish_page_id          BIGINT UNSIGNED DEFAULT NULL,
    gophish_master_id        BIGINT UNSIGNED DEFAULT NULL,
    synced_at                DATETIME        DEFAULT NULL,
    created_by               BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_by               BIGINT UNSIGNED DEFAULT NULL,
    published_by             BIGINT UNSIGNED DEFAULT NULL,
    created_at               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at             DATETIME        DEFAULT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY entity_name (entity_name)
) $charset_collate;
```

`UNIQUE (entity_name)` menjamin satu halaman quiz per entity; menyimpan berarti upsert. `VARCHAR(191)` dipakai agar indeks unik aman di utf8mb4, konsisten `pukat_flag_pages`.

### 7.2 Perubahan `pukat_quiz_questions`

```sql
ALTER TABLE {prefix}quiz_questions
    ADD COLUMN entity_name VARCHAR(191) NOT NULL DEFAULT '' AFTER id,
    ADD COLUMN input_name  VARCHAR(64)  NOT NULL DEFAULT '' AFTER question,
    ADD COLUMN is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    ADD UNIQUE KEY entity_input (entity_name, input_name),
    ADD KEY entity_name (entity_name);
```

Baris lama (bank global, kalau ada) tidak punya entity maupun `input_name`. Karena tidak ada konsumen nyata (§2.1) dan fitur belum pernah rilis, baris tanpa `entity_name` **dihapus** saat migrasi, bukan di-backfill ke entity acak. Jumlah baris yang dihapus dicatat di log migrasi.

### 7.3 Perubahan `pukat_quiz_results`

```sql
ALTER TABLE {prefix}quiz_results
    ADD COLUMN entity_name     VARCHAR(191)    NOT NULL DEFAULT '' AFTER id,
    ADD COLUMN gophish_rid     VARCHAR(64)     NOT NULL DEFAULT '' AFTER campaign_run_id,
    ADD COLUMN gophish_campaign_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'campaign quiz asal event (master atau undangan)',
    ADD COLUMN question_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN correct_count   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN pass_score_used TINYINT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN quiz_page_id    BIGINT UNSIGNED DEFAULT NULL,
    ADD UNIQUE KEY run_rid (campaign_run_id, gophish_rid),
    ADD KEY entity_name (entity_name);
```

- `question_count`/`correct_count` membuat **denominator eksplisit** di tiap row. Ini yang memungkinkan rekap tetap benar kalau nanti subset soal diizinkan (§12), tanpa migrasi ulang.
- `UNIQUE (campaign_run_id, gophish_rid)` membuat sync idempoten: sync berulang melakukan upsert, bukan menambah duplikat.
- `campaign_run_id` **nullable** untuk hasil dari campaign undangan (FR-15), yang tidak menempel ke run mana pun. `gophish_campaign_id` yang mengidentifikasi asalnya.
- `answers` (JSON payload) tetap dipakai apa adanya.

## 8. API & Security Requirement

```http
GET    /wp-json/pukat/v1/quiz-page?entity=         — halaman quiz entity (kosong bila belum ada)
PUT    /wp-json/pukat/v1/quiz-page                 — simpan draft (title, html_body, launch_url, thankyou_url, pass_score)
POST   /wp-json/pukat/v1/quiz-page/validate        — linter dry-run, tidak menyimpan
POST   /wp-json/pukat/v1/quiz-page/publish         — publish + snapshot + sync + master + relink
POST   /wp-json/pukat/v1/quiz-page/unpublish       — kembali ke draft, lepas rantai
POST   /wp-json/pukat/v1/quiz-page/sync            — retry sync Landing Page/master

GET    /wp-json/pukat/v1/quiz/questions?entity=    — bank soal entity
POST   /wp-json/pukat/v1/quiz/questions            — buat soal
PUT    /wp-json/pukat/v1/quiz/questions/{id}       — ubah soal
DELETE /wp-json/pukat/v1/quiz/questions/{id}       — hapus soal

POST   /wp-json/pukat/v1/quiz/invite               — kirim quiz manual (campaign undangan, FR-15)
GET    /wp-json/pukat/v1/quiz/results              — hasil quiz (filter entity/campaign_run_id)
```

- **Permission**: resource baru **`quiz_pages`** di Permission Registry (group Post Sim) — `view` (gate `shared`), `edit`, `publish`, `invite` (seed `operator`). Bank soal tetap memakai `post_sim.view`/`post_sim.manage` yang sudah ada, supaya hak "kelola soal" bisa dipisah dari hak "publish halaman".
- **Entity selalu ditentukan server.** Non-admin selalu memakai entity miliknya; `entity` hanya dihormati untuk admin. Pola identik `FlagPageService::target_entity()`.
- **Hak tulis** melewati `EntityProfileService::enforce_entity_editable()`: non-admin hanya entity sendiri, General hanya admin.
- **Hak baca**: non-admin yang meminta entity lain tidak mendapat 403, melainkan data entity-nya sendiri.
- **Validasi**: nama entity ≤ 191 karakter; `html_body` string ≤ **4 MB** (sejajar `FlagPageService::MAX_HTML_BYTES`); `title` ≤ 255; `launch_url` harus salah satu `dynamic_domains` bertipe `quiz` yang boleh dilihat user; `thankyou_url` divalidasi sebagai URL; `pass_score` 0–100; `input_name` pola `^answer_[a-z0-9_]{1,50}$`; publish ditolak 422 bila draft kosong atau linter gagal (FR-6).
- **`POST /quiz/invite`** memvalidasi ulang kepemilikan entity target, membatasi jumlah penerima per permintaan, dan tidak menerima nama template/SMTP mentah dari frontend selain referensi aset yang user memang boleh pakai.
- **HTML disimpan apa adanya**, seperti landing page dan education page. Konsekuensinya sama: Pukat **tidak pernah** merender HTML ini di luar iframe ber-sandbox (`BrowserPreview`), tidak ada `dangerouslySetInnerHTML`, dan `quiz_pages.edit` harus diperlakukan setara hak mengubah landing page.
- **Jawaban target bukan data tepercaya.** Payload `Submitted Data (Quiz)` berasal dari form publik: nilai yang tidak dikenal di answer key diabaikan (tidak menambah `question_count`), dan payload disimpan setelah disanitasi.
- **`POST /quiz/submit` dihapus.** Skoring kini server-side dari results GoPhish, halaman quiz tidak di-host Pukat, dan route itu `__return_true` tanpa konsumen (§2.1). `quizApi.submit` ikut dihapus.
- **Audit**: `quiz_page.saved`, `quiz_page.published`, `quiz_page.unpublished`, `quiz_page.synced`, `quiz_page.master_recreated`, `quiz_page.chain_linked`, `quiz_question.created/updated/deleted`, `quiz.invited`, `quiz.scored`.

## 9. UI

Area `/post/quiz`:

```text
( Question Bank | Quiz Page )

Question Bank:
  [ + Add question ]                                     entity: Finance (admin: pemilih entity)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ answer_q1  Email mendesak minta ganti password…   3 opsi · 1 kunci   │
  │            difficulty 2 · tags: phishing          [aktif] [edit] [x] │
  │ answer_q2  Lampiran .zip dari pengirim tak dikenal…                  │
  └──────────────────────────────────────────────────────────────────────┘

Quiz Page:
  Create/Edit Quiz Page                      [Cancel] [Save Draft] [Publish]
  ┌ panel atas ────────────────────────────────────────────────────────────┐
  │ NAMA TEMPLATE * [____________]   PASS SCORE [__]%                      │
  │ LAUNCH URL [ domain tipe quiz ▾ ]  THANK-YOU URL [______________]      │
  │ PILIH GAMBAR   (kolom per kategori)            [Insert at cursor (2)]  │
  │ Status: Published · ada perubahan belum di-publish      [Unpublish]    │
  │ GoPhish: synced · master #58 · rantai: education → quiz OK             │
  │ ⚠ Linter: answer_q3 punya kunci tapi tidak ada di HTML                  │
  └────────────────────────────────────────────────────────────────────────┘
  ( HTML Code | Live Preview )   [Use starter template] [Check] [Fullscreen]
```

- Panel status menampilkan tiga hal sekaligus: status draft/published, status sync+master, dan status rantai (FR-10).
- Laporan linter tampil inline di panel atas dan di dialog saat publish gagal.
- Editor memakai ulang `AssetEditorLayout` + `HtmlCodeEditor` + `BrowserPreview` + `Portal` fullscreen, persis `EntityFlagPageEditor`.
- Dialog **Send quiz manually** (FR-15): pilih target, template email, sending profile, lalu konfirmasi. Dialog menyebut jelas bahwa email akan benar-benar terkirim.

## 10. Acceptance Criteria

- Entity "Finance" membuat 3 soal, menekan **Use starter template**, dan HTML yang dihasilkan memuat 3 input dengan `name` sesuai `input_name`, satu `<form method="post">`, dan hidden `{{.RId}}`.
- Menambah soal aktif ke-4 tanpa memperbarui HTML → **Publish ditolak 422** dengan pesan yang menyebut `input_name` soal ke-4.
- Menduplikasi blok soal untuk versi EN beserta `name`-nya → Publish ditolak 422 "nama ganda", dengan pesan yang menyebut jebakan bilingual.
- Setelah Publish: Landing Page `pukat-quiz-finance` ada di GoPhish dengan `capture_credentials=true` dan `redirect_url` = thank-you URL; master `pukat-quiz-master-finance` ada dengan `campaign_type=quiz`, `is_master=true`, `url` = Launch URL, status In progress.
- Entity yang punya education **dan** quiz published: setelah Publish education, `next_campaign_id` master education menunjuk master quiz. Setelah Publish quiz (master id berubah), `next_campaign_id` master education menunjuk master quiz **yang baru**.
- Target submit di simulation → education → quiz: `GET /api/campaigns/{simulation}/results` memuat `Submitted Data (Quiz)` dengan `rid` entry asal; setelah sync, ada row `pukat_quiz_results` dengan `score`, `passed`, `question_count`, `pass_score_used`, dan `gophish_rid` terisi.
- Sync dijalankan dua kali → jumlah row `pukat_quiz_results` **tidak** bertambah (idempoten).
- Target mengerjakan quiz dua kali (dua kedatangan, dua rid) → dua row; risk scoring memakai yang terakhir.
- Mengedit soal **setelah** target mengerjakan tidak mengubah `score` row yang sudah ada (snapshot answer key).
- Override pass score per run 90% → target dengan skor 80% tercatat `passed=0`, `pass_score_used=90`, sementara entity lain dengan pass score 70% tidak terpengaruh.
- Wizard: quiz on + education off → `next_campaign_id` simulation = master quiz; keduanya on → = master education.
- Simulasi chained masih aktif → save/publish/unpublish halaman quiz ditolak **409 `quiz_locked`**, `editable=false` di `GET /quiz-page`.
- User entity "HR" tidak dapat menyimpan ke entity "Finance" walaupun mengirim parameter `entity`.
- Non-admin tidak dapat menyimpan halaman quiz entity General (403).
- `QuizReportPane` menampilkan ringkasan, tabel per target, dan analisis per soal dengan denominator per soal.
- `npm run lint`/`test` clean, `php -l` clean, smoke test sesuai AGENTS.md §7.

## 11. Decisions

- **Master quiz terpisah, bukan Q&A ditanam di education page** (2026-10-20) — sesuai `docs/api_campaignnew.md` §4.2; parsing `quiz_completed`/`quiz_rate` dan kolom UI dari G4 sudah menunggu isi, dan quiz bisa dimatikan terpisah per run. Ini menjawab Open Question "kuis di dalam halaman edukasi" di `docs/PRD_FLAG_EDUCATION_PAGES.md` §13.
- **HTML bebas + konvensi `name="answer_*"`, bukan HTML yang digenerate dan dikunci** (2026-10-20) — konsisten dengan Education Page, karena tiap entity bisa membawa template GoPhish-nya sendiri. Kerapuhannya ditambal **bank soal sebagai sumber `input_name`**, **starter yang digenerate** (jalur normal tidak pernah mengetik nama input manual), dan **linter yang memblokir publish**.
- **Answer key di-snapshot saat publish** (2026-10-20) — jawaban dinilai dengan kunci yang berlaku saat halaman tayang. Tanpa ini, mengedit soal mengubah nilai orang yang sudah mengerjakan.
- **Linter memblokir publish (422), bukan sekadar memperingatkan** (2026-10-20) — halaman yang jawabannya tidak dapat dinilai tidak boleh tayang; ketahuan setelah kampanye jalan berarti data evaluasi hilang dan tidak bisa diulang.
- **Skoring dari results GoPhish, bukan endpoint submit sendiri** (2026-10-20) — event `Submitted Data (Quiz)` sudah tergabung per `rid` (§3.5.1) dan sudah dibaca G4, jadi tidak ada call API baru dan rantai `next_campaign_id` tetap utuh. Konsekuensinya `POST /quiz/submit` dihapus.
- **Satu row hasil per kedatangan (`gophish_rid`), risk pakai percobaan terakhir** (2026-10-20) — sesuai model GoPhish yang mencatat tiap kedatangan sebagai entry; riwayat percobaan tersimpan utuh, dan `UNIQUE (campaign_run_id, gophish_rid)` membuat sync idempoten.
- **Pasca-submit: `redirect_url` ke halaman terima kasih** (2026-10-20) — sederhana dan tidak membocorkan kunci jawaban. Menampilkan skor ke target butuh halaman publik Pukat yang menerima `rid`; ditolak untuk v1.
- **Pass score per entity dengan override opsional per run** (2026-10-20) — ketatnya evaluasi bisa diatur per kampanye tanpa mengubah set soal. Nilai efektif di-snapshot ke row hasil karena `passed` dihitung saat sync.
- **Quiz boleh tanpa education** (2026-10-20) — fork mengizinkan simulation menunjuk master quiz langsung, jadi dua toggle di wizard dibuat independen.
- **Kirim manual lewat campaign undangan non-master, bukan `add_recipients` ke master** (2026-10-20) — GoPhish men-snapshot template saat create, jadi master dengan template dummy akan mengirim email dummy; mengganti asetnya berarti recreate master, yang justru diblokir edit-lock. Campaign undangan sekali-pakai memakai aset sungguhan dan membiarkan master utuh. Konsekuensi: hasil quiz punya dua sumber, dan row hasil dari undangan tidak punya `campaign_run_id`.
- **Gambar memakai ulang `data-pukat-img` + base64 saat export** (2026-10-20) — helper `inline_flag_images()`/`count_flag_images()` dari `FlagPageSyncService` digeneralisasi agar dipakai dua halaman. Sumber gambar tetap galeri flag example entity, bukan galeri baru.
- **Starter bilingual ID/EN, bank soal satu bahasa** (2026-10-20) — teks EN ditulis operator di HTML. Trade-off yang diterima: versi EN tidak terlacak di bank dan rekap per soal hanya menampilkan teks ID. Konsekuensi yang harus dijaga: label dua bahasa berbagi satu set input, dan pesan linter "nama ganda" menyebut jebakan ini.
- **Satu set soal aktif per entity di v1** (2026-10-20) — tanpa subset per run dan tanpa randomisasi. Randomisasi per target tidak mungkin secara arsitektur (HTML statis yang di-snapshot). Subset per run bertabrakan dengan "satu master per entity" + edit-lock, dan merusak komparabilitas rekap. `question_count`/`correct_count` di row hasil disiapkan supaya subset bisa ditambahkan nanti tanpa migrasi ulang. Lihat §12.
- **Bank soal legacy dipakai ulang, bukan dibangun baru** (2026-10-20) — `pukat_quiz_questions`/`pukat_quiz_results` di-ALTER agar entity-scoped dan rid-aware, supaya kontribusi quiz di `RiskScoringService` (satu-satunya konsumen nyata) tidak perlu disambung ulang. Baris bank global tanpa entity dihapus saat migrasi, bukan di-backfill.
- **Relink rantai dua arah jadi bagian dari publish** (2026-10-20) — konsekuensi langsung dari keputusan "master di-recreate tiap publish" di PRD Education Page. Ini satu-satunya bagian modul yang tidak punya preseden di G3b, dan jadi fase tersendiri di plan.
- **Halaman quiz dibuat tanpa koding: template oleh admin, operator memilih template + soal** (2026-10-21) — setelah memakai v1, menulis HTML terbukti jadi penghalang utama bagi operator entity. Pembuatan halaman dipecah dua peran: **administrator** menulis dan merawat katalog **quiz template** (HTML, sekali, tervalidasi), **operator entity** hanya memilih template dan menandai soal mana yang tampil. Urutan tampil = urutan pemilihan. Ini juga menjawab Open Question "subset soal" (§12) dalam bentuk yang di sana dinilai paling mungkin: **subset per publish**, bukan per run. Detail dan konsekuensi di §13.
- **Dua tipe soal (text-only dan bergambar), tapi v1 text-only saja** (2026-10-21) — setelah meninjau hasil implementasi, bank soal disepakati nantinya punya dua tipe: **text-only** dan **dengan gambar** (mis. screenshot email phishing yang harus dinilai). v1 tetap text-only supaya rilis tidak tertahan: gambar menyentuh bank soal, starter template, linter, dan ekspor base64 sekaligus (§12). Konsekuensi yang harus dijaga sampai fase itu datang: tiap penambahan field soal baru sebaiknya memakai nama yang netral tipe, dan UI bank soal jangan mengunci asumsi "satu soal = satu blok teks".

## 12. Open Questions

- **Subset soal per campaign run / randomisasi.** v1 memakai satu set soal aktif per entity (§11). Analisis yang sudah dilakukan: (a) randomisasi per target tidak mungkin karena halaman di-snapshot GoPhish dan tidak ada yang merender per target; (b) subset per run tidak dapat dipenuhi oleh satu master per entity, dan mengganti subset di tengah kampanye terbentur edit-lock; (c) HTML bebas membuat subset tidak otomatis — tiap perubahan subset berarti menyunting HTML lagi, dan linter akan menolak publish sampai HTML disesuaikan; (d) rekap jadi tidak sebanding (denominator berbeda), risk scoring jadi bias karena rumusnya berbasis persentase, dan analisis per soal butuh denominator per soal. Ditinjau ulang setelah ada data rekap nyata. Kalau diambil nanti, bentuk yang paling mungkin adalah subset **per publish** (bukan per run) dengan HTML yang digenerate ulang.
- **Apakah `add_recipients(send_email=true)` memakai template snapshot atau template terkini?** Harus diverifikasi sebelum FR-15 dikunci. Kalau ternyata memakai template terkini, desain kirim manual bisa disederhanakan kembali ke master dan campaign undangan tidak diperlukan.
- **Kedatangan tanpa submit.** Diwarisi dari PRD Education Page: rantai hanya terpicu **submit**. Target yang membuka education tapi tidak submit tidak pernah sampai quiz, dan target yang membuka quiz tapi tidak submit tidak tercatat. Di luar cakupan; jalur kirim manual (FR-15) adalah mitigasi yang tersedia.
- **Analisis per soal lintas entity.** Karena bank soal per entity, soal "yang sama" di dua entity adalah dua baris berbeda, jadi tidak ada agregasi lintas entity. Cukup untuk v1; kalau nanti diminta, perlu konsep soal bersama (master question) yang di-assign ke entity.
- **Retensi jawaban mentah.** `answers` menyimpan payload jawaban per orang. Belum ada kebijakan retensi/anonimisasi; mengikuti perlakuan data result campaign yang sudah ada.
- **Ukuran halaman quiz** diasumsikan hanya dibatasi 4 MB per halaman, sama seperti education page.
- **Soal bergambar (tipe kedua).** **Diputuskan 2026-10-22** — lihat §13.10. Ringkas: tiap soal boleh bertipe `image` dengan gambar **di-upload per soal** (disimpan sebagai data URI base64 di bank), dirender generator di atas opsi, inline apa adanya ke GoPhish. Open question lama (a)–(e) terjawab di §13.10.

## 13. Revisi v2 — Quiz Builder tanpa koding (2026-10-21)

Status: **belum dikerjakan.** §1–§12 mendeskripsikan v1 yang sudah terbangun dan terverifikasi (lihat as-built log di implementation plan). Bagian ini merekam arah v2 supaya keputusan dan konsekuensinya tidak hilang; tidak ada kode yang berubah sampai open question §13.7 diselesaikan.

### 13.1 Masalah yang diselesaikan

Operator entity harus menulis/menempel HTML, menyesuaikannya dengan `input_name` bank soal, lalu melewati linter. Jalur ini bekerja (v1 punya starter + linter yang memblokir), tetapi menuntut keahlian yang tidak dimiliki operator, dan tiap perubahan set soal berarti menyunting HTML lagi.

### 13.2 Pembagian peran

- **Administrator** — membuat dan merawat **katalog quiz template**: cangkang HTML ber-gaya (tema visual, header, blok terima kasih, gaya render opsi jawaban) dengan dua jenis penanda — **placeholder** (field teks yang nanti diisi user) dan **slot soal berulang** tempat tiap soal terpilih di-render. Tiap template **mendeklarasikan sendiri daftar placeholder-nya** (nama, label, tipe). Dilakukan sekali per template, dipakai lintas entity. Ini satu-satunya peran yang masih menyentuh koding.
- **Operator entity** — tidak menyentuh HTML. Memilih satu template dari katalog, mengisi field placeholder template lewat form biasa, memilih soal dari bank entity-nya (urutan tampil = urutan pemilihan), mengatur pass score / launch URL / thank-you URL, lalu Publish. Operator **boleh membuat lebih dari satu quiz**.

### 13.3 Functional Requirements v2

- **FR-18 (katalog quiz template, admin-only)**: CRUD quiz template dengan permission baru yang terpisah dari `quiz_pages.edit` (hanya admin). Tiap template menyimpan nama, cangkang HTML dengan penanda **placeholder** + **slot soal**, **deklarasi placeholder** (daftar field: key, label, tipe `text`/`textarea`, wajib/opsional), dan metadata. Template dimiliki bersama, bukan per entity.
- **FR-19 (placeholder didefinisikan per template — Opsi A)**: field yang diisi operator **ditentukan tiap template**, tidak ada set field tetap global. Builder merender form dari deklarasi placeholder template yang dipilih. Nilai yang diisi operator disimpan per quiz dan disuntikkan ke cangkang saat generate.
- **FR-20 (operator bisa punya banyak quiz)**: satu entity boleh memiliki **lebih dari satu** quiz. `UNIQUE(entity_name)` pada `pukat_quiz_pages` (v1) **dibuang**; tiap quiz berdiri sebagai baris dengan id dan nama sendiri. (Konsekuensi penamaan master GoPhish & linkage education→quiz dibahas terpisah saat sesi linkage — lihat §13.7.)
- **FR-21 (builder tanpa koding)**: operator memilih satu template, mengisi placeholder, memilih subset soal aktif dari bank (urutan = urutan pemilihan, bisa di-reorder). Sistem **men-generate** `html_body`: suntik nilai placeholder ke cangkang, render tiap soal terpilih ke slot berulang pada urutannya. Operator tidak pernah melihat atau mengedit HTML sebagai jalur normal.
- **FR-22 (snapshot pilihan)**: tiap quiz menyimpan **template yang dipakai + nilai placeholder + daftar `question_id` terurut** sebagai sumber generate, di samping `html_body` hasilnya. Publish tetap men-snapshot answer key (§5.3), kini diturunkan dari **soal terpilih quiz itu**, bukan dari semua soal aktif entity.
- **FR-23 (linter jadi invarian, bukan gerbang utama)**: karena HTML digenerate, mismatch `input_name` secara normal tidak mungkin terjadi. Linter v1 (§6 FR-6) **tetap dijalankan** sebagai pengaman terhadap template admin yang rusak (slot hilang, `name` ganda di markup cangkang), bukan sebagai beban operator.

### 13.4 Dampak data model

- **Tabel baru `pukat_quiz_templates`** (admin-owned): id, nama, cangkang `html_body`, **deklarasi placeholder** (JSON: daftar field key/label/tipe/wajib), penanda slot, audit. Perlu migrasi baru.
- **`pukat_quiz_pages` berubah dari satu-per-entity jadi banyak-per-entity**: `UNIQUE(entity_name)` dibuang (diganti `KEY entity_name`), tiap quiz jadi baris dengan id + nama sendiri. Kolom baru: `template_id`, nilai placeholder (`field_values_json`), daftar soal terpilih terurut (`selected_question_ids_json`), dan **`is_default_followup`** (flag: quiz mana yang dipakai rantai education→quiz; satu default per entity). `html_body` tetap sebagai hasil generate (dibutuhkan sync GoPhish yang sudah ada). Perlu migrasi.
- **Penamaan master GoPhish** tidak bisa lagi `pukat-quiz-master-<entity>` (akan tabrakan bila satu entity punya banyak quiz) — butuh suffix per quiz (mis. `pukat-quiz-master-<entity>-<id>`).
- Hubungan dengan soal bergambar (§11, Open Question §12): slot soal di template harus bisa merender blok text **dan** blok bergambar; dua fitur ini saling menyentuh dan sebaiknya didesain bersama.

### 13.5 Dampak UI

- Tab **Quiz Page** berubah dari satu editor kode menjadi **daftar quiz** (karena bisa banyak) + builder:
  - **Daftar quiz** entity: nama, template, status draft/published, aksi buat/edit/hapus.
  - **Builder** (buat/edit satu quiz): pemilih template (kartu/preview) → form placeholder yang dirender dari deklarasi template terpilih → daftar soal bank dengan checkbox + reorder → panel pass score / launch URL / thank-you URL. Preview tetap lewat `BrowserPreview` ber-sandbox.
- Area admin baru untuk **katalog quiz template** (CRUD, editor HTML + preview + editor deklarasi placeholder) — di sinilah `HtmlCodeEditor`/`AssetEditorLayout` v1 dipindahkan, bukan dibuang.
- Mode read-only (§6 FR-17) berlaku ke builder: tanpa hak, operator hanya melihat daftar quiz, template, dan soal terpilih.

### 13.6 Keputusan yang sudah diambil

- **Template dibuat admin, bukan operator** (2026-10-21, user) — operator cukup memilih. Editor kode tidak dihapus; ia berpindah ke area admin template.
- **Urutan = urutan pemilihan** (2026-10-21, user).
- **Builder adalah jalur pembuatan normal** (2026-10-21) — editor HTML per-entity v1 tidak lagi jadi jalur utama. Apakah ia masih disisakan sebagai mode lanjutan per-entity belum diputuskan (§13.7).
- **Template = gaya + satu slot soal berulang, jumlah soal bebas** (2026-10-22, user) — template tidak mengunci jumlah soal; satu slot diulang untuk tiap soal terpilih. Varian template hanya berbeda di tampilan + teks tetap + gaya render, bukan perilaku (satu-soal-per-layar/acak mustahil di halaman statis yang di-snapshot GoPhish).
- **Placeholder didefinisikan per template (Opsi A)** (2026-10-22, user) — tiap template mendeklarasikan field-nya sendiri; builder merender form dinamis dari deklarasi itu. Bukan set field tetap global.
- **Operator boleh membuat banyak quiz** (2026-10-22, user) — membatalkan asumsi v1 "satu halaman quiz per entity"; `UNIQUE(entity_name)` dibuang.
- **Template satu bahasa (ID), ikut bank** (2026-10-22, user) — bilingual ditunda sampai bank soal punya teks EN (§11, §13.7).
- **Soal bergambar: upload per soal, disimpan data URI base64 di bank** (2026-10-22, user) — tiap soal boleh bertipe `image`; gambar di-upload langsung di form soal, bukan dari galeri flag example. Disimpan di bank sebagai data URI, dirender generator di dalam blok soal, dan ikut inline apa adanya saat ekspor ke GoPhish. Lihat §13.10.
- **Linkage: satu "quiz default" per entity, tanpa override per campaign di v2** (2026-10-22, user) — dibatasi oleh GoPhish: `next_campaign_id` adalah satu nilai per campaign dan **dipakai bersama** ([api_campaignnew.md:163](api_campaignnew.md)), jadi satu master education hanya bisa menunjuk satu quiz. Maka tiap entity menandai **satu quiz sebagai default follow-up** (flag di builder), dan itulah quiz yang dipakai rantai. Mekanisme publish→master + relink dua arah + edit-lock jadi **persis v1**, hanya sumber "quiz entity" berubah dari "satu-satunya quiz" menjadi "quiz yang ditandai default". Lihat §13.9.

### 13.7 Open Questions v2

- **Bentuk penanda slot & placeholder di cangkang template.** Perlu konvensi penanda yang tidak bentrok dengan sintaks GoPhish (`{{.RId}}` dll) — untuk slot soal berulang **dan** untuk placeholder. Keputusan teknis admin-template, ditetapkan saat implementasi (§13.8).
- **Nasib `html_body` bebas per entity v1.** Dengan builder sebagai jalur normal, apakah entity masih boleh menyunting HTML hasil generate (mode lanjutan), atau HTML sepenuhnya milik generator? Mode lanjutan berarti quiz bisa "lepas" dari template dan tidak bisa kembali ke builder tanpa menimpa; jalur murni-generate lebih bersih tapi menghapus kemampuan membawa markup khusus. **Harus diputuskan sebelum skema `pukat_quiz_pages` disentuh.**
- **Migrasi halaman quiz v1 yang sudah published.** Halaman dengan `html_body` tulisan tangan tidak punya `template_id`, nilai placeholder, maupun daftar soal terpilih. Perlu jalur: biarkan sebagai "legacy custom HTML" (read-only di builder) atau minta operator membuat ulang sebagai quiz baru.
- **Bilingual ID/EN (ditunda).** Diputuskan template satu bahasa ID untuk sekarang (§13.6). Bilingual butuh teks EN datang dari template (statis) atau dari bank soal (kolom teks EN — perubahan bank, menyentuh §11). Ditinjau bila dibutuhkan.
- ~~**Interaksi dengan soal bergambar (§12).**~~ **Terjawab 2026-10-22** — soal bergambar memakai upload per soal (data URI di bank), independen dari slot template; generator merender gambar di dalam blok soal. Lihat §13.10.

### 13.8 Catatan implementasi (ketika fase ini dimulai)

- Generator HTML dari cangkang template + nilai placeholder + soal terpilih menggantikan `quizPageTemplate.js` (starter v1) sebagai sumber `html_body`, dan harus menghasilkan markup yang **lolos linter v1 apa adanya** — linter tetap dijalankan sebagai regression guard terhadap cangkang admin.
- Perlu **konvensi penanda** di cangkang untuk (a) placeholder (disubstitusi dari `field_values_json`) dan (b) slot soal berulang (diulang per soal terpilih). Konvensi harus aman terhadap sintaks GoPhish `{{.RId}}`; nilai placeholder disanitasi sebelum disuntik (input admin tepercaya, tapi tetap di-escape agar tidak merusak markup).
- Snapshot answer key (§5.3) kini diturunkan dari **soal terpilih terurut per quiz**, bukan dari semua soal aktif entity. `QuizPageService::publish()` perlu menyesuaikan sumber kunci dan beroperasi per-quiz-id (bukan per-entity).
- Karena banyak quiz per entity, service/repository quiz page yang v1 mengambil "halaman entity" harus beralih ke lookup per id; cek semua pemanggil `QuizPageRepository`.
- Sync GoPhish (§6 FR-7) tidak berubah bentuknya: tetap mengirim `html_body` hasil generate; syaratnya `html_body` selalu terisi sebelum publish. Penamaan master memakai suffix id per quiz (§13.4).

### 13.9 Linkage education → quiz (banyak quiz per entity)

**Batas teknis (sumber kebenaran: `docs/api_campaignnew.md`):** `next_campaign_id` adalah satu nilai per campaign dan **dipakai bersama** semua target yang lewat campaign itu ([§3.1.1, baris 163](api_campaignnew.md)). Maka **satu master education hanya bisa menunjuk satu quiz** pada satu waktu. Education tidak bisa bercabang ke banyak quiz.

**Desain v2 (disederhanakan, disetujui 2026-10-22):** tiap entity menandai **satu quiz sebagai default follow-up** (`is_default_followup`, diatur di builder). Perilaku per bentuk rantai:

| Rantai | Quiz yang dipakai |
|---|---|
| SIM → Quiz (education off) | **bisa quiz mana saja** — SIM punya `next_campaign_id` sendiri per campaign run |
| SIM → Education → Quiz | **quiz default entity** — `next_campaign_id` master education dipakai bersama, jadi tetap satu |
| SIM → Education | tidak ada quiz |

**Konsekuensi untuk kode (semua tetap pola v1, hanya "quiz entity" → "quiz default entity"):**
- `QuizChainService` v1 memakai `quiz_pages->find_for_entity($entity)` di `link_education_to_quiz()`, `unlink_education_from_quiz()`, `resolve_simulation_target()`. Dengan banyak quiz, ganti menjadi **lookup quiz default entity** (`find_default_followup_for_entity()` atau sejenis). Relink dua arah, master-recreate-tiap-publish, dan edit-lock tetap persis.
- Edit-lock (§6 FR-11): quiz default terkunci saat ada simulasi chained aktif yang lewat education **atau** langsung ke quiz default itu. Quiz non-default hanya terkunci bila ada simulasi aktif yang menunjuknya langsung (jalur SIM → Quiz).
- Wizard Step 3 tetap toggle on/off seperti v1; saat quiz on, rantai memakai quiz default entity. **Tidak ada dropdown override di v2** — bentuk SIM → Quiz dengan quiz pilihan (override per campaign) dicatat sebagai pengembangan lanjutan, bukan bagian v2 pertama.
- Entity tanpa quiz default: toggle quiz di wizard disabled dengan hint "Tandai satu quiz sebagai default follow-up dulu", setara hint v1 "Publish halaman quiz dulu".

**Ditunda (tidak dikerjakan di v2 pertama):**
- Override quiz per campaign untuk bentuk SIM → Quiz langsung (secara teknis mungkin, tapi menambah field `quiz_id` di `follow_up` dan UI; ditunda sampai terbukti perlu).
- SIM → Education → quiz-berbeda-per-campaign: hanya mungkin dengan master education terpisah per pasangan (lebih banyak objek GoPhish, recreate tiap publish, edit-lock lebih rumit). Ditolak untuk v2.

### 13.10 Soal bergambar (tipe soal kedua) — 2026-10-22

Keputusan: **upload gambar per soal**, disimpan di bank sebagai **data URI base64**.

**Data model** (`pukat_quiz_questions`, migrasi baru):
- `question_type` VARCHAR(20) NOT NULL DEFAULT `'text'` — `text` | `image`.
- `image_data` LONGTEXT DEFAULT NULL — data URI (`data:image/png;base64,…`). Hanya diisi untuk tipe `image`.
- `image_data` **tidak** ikut di endpoint list bank (payload besar); list hanya membawa `question_type` + flag `has_image`. Edit mengambil gambar lewat `GET /quiz/questions/{id}` (soal tunggal, lengkap). Generator mengambil gambar lewat `find_selected_for_entity` (yang disertakan `image_data`-nya).

**Validasi (bank, server)**: tipe `image` **wajib** punya `image_data`; `image_data` wajib cocok `^data:image/(png|jpe?g|gif|webp);base64,` dan ukuran ter-decode ≤ **1 MB** per gambar. Tipe `text` mengabaikan/menghapus `image_data`.

**Generator**: `QuizPageGenerator::render_question_block()` menyisipkan `<div class="pukat-question-image"><img src="<data-uri>" alt="…"></div>` di atas opsi bila soal bertipe `image`. Karena sudah data URI, gambar **inline apa adanya** saat GoPhish men-snapshot — tidak perlu langkah `inline_flag_images` seperti galeri.

**Batas 4 MB**: data URI ikut masuk `html_body` hasil generate, jadi penjaga ukuran yang **sudah ada** (`build_from_template` menolak bila html > `MAX_HTML_BYTES`) otomatis menangkap halaman yang menabrak batas. Ditambah cap 1 MB/gambar di atas. Tidak ada cek baru yang diperlukan selain pesan error yang jelas.

**Linter**: tidak perlu aturan baru — kelengkapan gambar dijaga di **bank** (tipe `image` wajib `image_data`), bukan di HTML. Linter tetap memeriksa `name` input saja.

**Rekap per soal**: untuk soal `image` yang teks pertanyaannya kosong, rekap menampilkan `input_name` sebagai label (fallback yang sudah ada). Tidak ada perubahan skema rekap.

**Di luar cakupan tahap ini**: resize/kompresi gambar otomatis (operator bertanggung jawab memperkecil), multiple gambar per soal, dan galeri gambar bersama. Upload satu gambar per soal sudah cukup.

### 13.11 Quiz Dashboard — 2026-10-26

Tab **Results** dikeluarkan dari modul Quiz (FR-1 memang hanya menyebut Question Bank + Quiz Page) menjadi halaman sendiri `/post/quiz-results`, item sidebar **Quiz Dashboard** tepat di bawah Quiz. Halaman ini menjawab empat pertanyaan, satu blok per pertanyaan:

1. **Apakah quiz-nya jalan** — status strip untuk quiz default-followup: ada/tidak, published/draft, sudah dipush ke GoPhish atau belum. Hanya quiz default yang dilaporkan karena rantai `next_campaign_id` hanya pernah sampai ke sana (§13.9).
2. **Materi mana yang lemah** — ranking soal berdasarkan `wrong/asked` dengan teks soal asli.
3. **Apakah pemahaman membaik** — avg score + pass rate per campaign run, urut dari run terlama.
4. **Siapa yang perlu ditindaklanjuti** — target yang **percobaan terakhirnya** gagal (bukan percobaan terburuk; risk scoring juga memakai percobaan terakhir, FR-14), diurutkan dari skor terendah, dengan jumlah percobaan.

**Perubahan backend (dua, kecil):**

- `QuizScoringService::per_question_breakdown()` kini menyertakan `question_id` per entry. Answer key sudah membawanya, jadi tidak ada query tambahan; frontend memetakannya ke bank untuk menampilkan teks soal, bukan `input_name` mentah. Soal yang sudah dihapus dari bank tetap tampil dengan `input_name`.
- `GET /quiz/results` (cabang per-entity saja) menambah blok `participation`: `reached`, `completed`, `rate`, dan `runs[]` (tiap run membawa `via`). Angkanya dibaca dari `metrics_json` tiap campaign run yang sudah launched (`CampaignRunRepository::quiz_participation_for_entity()`) — satu query, **tanpa** call GoPhish, jadi kesegarannya mengikuti sync hasil run terakhir.

**Hanya dua linkage yang dihitung** (konsisten dengan doktrin `QuizPageService::compute_linkage()` di §13.9): `simulation → quiz` (`via` = `direct`) dan `simulation → education → quiz` (`via` = `education`). Run yang berhenti di **education saja**, run tanpa follow-up, dan run tanpa `follow_up_json` sama sekali **dikeluarkan** — targetnya tidak pernah ditawari quiz, jadi memasukkannya ke penyebut hanya membuat participation terlihat lebih buruk dari kenyataan. Pemisahnya `follow_up_json.quiz_enabled` (+ `education_enabled` untuk menentukan `via`), bukan rantai GoPhish: education master hanya punya satu `next_campaign_id` bersama sehingga rantai live tidak bisa membedakan ketiga jalan itu. Tabel per-run menampilkan kolom **Linkage** supaya jalur tiap run terbaca.

Catatan asimetri yang disengaja: karena `next_campaign_id` bersama itu, sebuah run education-only secara fisik masih bisa mendaratkan orang di halaman quiz. Kalau itu terjadi, jawabannya tetap masuk `pukat_quiz_results` dan tetap terhitung di kartu ringkasan (itu jawaban quiz yang nyata), tapi run-nya tidak punya baris di tren dan targetnya tidak masuk penyebut participation.

**Kenapa `participation` tidak bisa diturunkan dari rows:** orang yang diarahkan ke quiz tapi tidak menjawab **tidak punya row** di `pukat_quiz_results`. Penyebutnya adalah `submitted_data` per run (submit form phishing-lah yang mengalihkan target ke rantai edukasi/quiz) — penyebut yang sama yang dipakai `quiz_rate` di `CampaignRunService::aggregate_result_stats()`. Cabang per-run (`?campaign_run_id=`) sengaja tidak dapat blok ini: di sana akses diperiksa per baris hasil, jadi tidak ada entity untuk membatasi lookup run-nya.

**Keputusan chart:**

- **Tidak ada dual-axis.** Jumlah submission dan persentase adalah dua skala berbeda, jadi chart tren hanya memuat dua seri persen (avg score, pass rate) dan semua angka hitungan pindah ke tabel per-run di bawahnya. Tabel itu sekaligus padanan teks chart-nya.
- Run yang tidak dijawab siapa pun **memutus garis** (`null`), tidak diplot sebagai 0 — tidak ada jawaban itu masalah pengiriman, dan 0 akan terbaca "semua gagal". Participation run itu tetap 0% yang sebenarnya.
- Histogram distribusi memakai **satu warna** (satu seri). Sengaja tidak diwarnai lulus/gagal: bucket 60–79 memotong pass mark 70 sehingga pewarnaan apa pun akan menyesatkan; pass mark disebut di teks, dan pass rate dibawa kartu ringkasan.
- Dua hue seri (`#6C63FF` violet-500 aplikasi + `#059669`) lolos uji lightness band, chroma floor, separasi CVD (ΔE 24.9 deutan), dan kontras 3:1 pada **kedua** surface tema (putih dan `#161F38`), jadi satu pasang warna dipakai light dan dark. Separasi tritan ada di floor band 6–8, karena itu setiap chart wajib punya legend + label langsung.

**Filter quiz** di halaman ini client-side: `/quiz/results` sudah mengirim seluruh submission entity dalam satu response. `participation` adalah satu-satunya angka yang tidak ikut terfilter (dihitung per run, bukan per quiz) dan kartunya menyatakan itu.

**Catatan ukuran bundle:** halaman ini pemakai `recharts` pertama di SPA, chunk `QuizResults` jadi ±400 kB (±111 kB gzip). Route-nya lazy-loaded, jadi hanya terunduh saat dashboard dibuka.

**Di luar cakupan tahap ini:** breakdown per difficulty/tag, export, dan participation per quiz (butuh pemetaan run → quiz yang belum ada).

### 13.12 Refresh on-demand milik quiz — 2026-10-26

Masalah: dashboard membaca DB lokal, yang hanya terisi saat cron monitoring (`pukat_process_campaign_results`) berjalan. Jadi kesegarannya milik monitoring, bukan milik quiz.

Keputusan: **jalur pull sendiri**, `POST /quiz/results/refresh`, dipanggil saat dashboard dibuka dan lewat tombol Refresh. `QuizRefreshService` → `GoPhishService::get_campaign_results()` → `QuizScoringService::record_from_results()`, lalu membalas payload yang **sama bentuknya** dengan `GET /quiz/results` supaya frontend bisa menaruhnya langsung ke cache.

**Sengaja BUKAN `CampaignRunService::sync_results_for_run()`.** Method itu milik monitoring: selain mengambil hasil, ia menulis ulang `metrics_json`, mengubah status run, dan — ini yang menentukan — menghapus lalu menyisipkan ulang risk score run tersebut, di tabel `pukat_risk_scores` yang **tidak punya UNIQUE**. Dua eksekusi yang tumpang-tindih bisa meninggalkan baris risk score ganda atau sesaat hilang. Karena itu jalur quiz menyentuh **tepat satu tabel**, `pukat_quiz_results`, yang justru dilindungi `UNIQUE (campaign_run_id, gophish_rid)`: refresh bersamaan paling buruk kalah balapan di satu kedatangan, yang akan tergrade di refresh berikutnya. Participation dihitung **in-memory** dan dikembalikan, tidak pernah ditulis — `metrics_json` tetap milik monitoring.

**Yang dipoll:** hanya run yang masih berjalan (`status IN ('synced','scheduled','running')`, set yang sama dengan `result_sync_candidates()`) **dan** quiz-linked (§13.11), maksimum 10 run terbaru. Run yang sudah selesai tidak mungkin dapat jawaban baru, jadi angkanya tetap dari snapshot final yang dibuat cron dan tidak memboroskan satu request pun.

**Throttle 45 detik per entity** (transient). Ini pembatas laju, bukan mutex: dua klik yang benar-benar bersamaan bisa lolos berdua, dan itu hanya berbiaya satu putaran call ekstra karena grading idempoten. Mutex sejati butuh `GET_LOCK()`/`add_option()` dan tidak sebanding untuk menghemat beberapa request.

**Kegagalan GoPhish bukan error halaman:** run yang gagal dipoll jadi `warnings[]`, data tersimpan tetap dikembalikan, dan bar refresh menampilkannya sebagai peringatan kuning di samping timestamp. Permission-nya `post_sim.view` (bukan key manage): endpoint ini tidak menerima input pemanggil selain entity, grading-nya idempoten, dan sudah di-throttle — justru tujuannya agar seorang viewer bisa melihat angka segar.

**Reach dihitung identik dengan monitoring** (`reached` dari `status === 'Submitted Data'`, `completed` dari event `Submitted Data (Quiz)` milik target, dikelompokkan by email seperti `result_targets()`). Kalau definisinya beda, angka participation akan melompat setiap kali refresh menggantikan snapshot tersimpan.

**Bukti:** `tools/smoke-quiz-refresh.php` — 26 check dengan GoPhish distub: filter run yang dipoll, grading, reach, throttle, idempotensi, dan verifikasi eksplisit bahwa `metrics_json`, status run, dan `pukat_risk_scores` **tidak tersentuh**. Route + permission + bentuk payload dicek di `smoke-quiz-dashboard.php`.

**Temuan terpisah (belum dikerjakan, atas persetujuan user):** `pukat_risk_scores` tidak punya UNIQUE dan diisi dengan pola delete-lalu-insert tanpa transaksi, sementara jalur sync tidak punya lock sama sekali — jadi cron monitoring yang bertemu refresh manual **sudah** bisa menghasilkan baris ganda hari ini, dan `get_campaign_run_summary()` menghitung semua baris sehingga duplikat menggandakan hitungan tier. Tidak berhubungan dengan dashboard quiz; dicatat untuk dibahas terpisah.


**Bukti:** `tools/smoke-quiz-dashboard.php` — 22 check, termasuk run education-only, run tanpa follow-up, run tanpa `follow_up_json`, run entity lain, run belum launched, dan label `via` untuk kedua linkage.
