# Perubahan API GoPhish untuk Orchestrator

Tanggal: 6 Oktober 2026.

Dokumen ini hanya mencantumkan **perubahan** API GoPhish relatif terhadap GoPhish standar, supaya integrasi API di aplikasi orchestrator dapat disesuaikan. Hal yang tidak disebut di sini tidak berubah.

Perubahan dibagi tiga rilis:

- Rilis 1 (`campaign_type` dan `entity`) — kemungkinan sudah dipakai orchestrator.
- Rilis 2 (master campaign) — baru.
- Rilis 3 (`next_campaign_id`, rantai redirect simulation → education → quiz) — baru; mengimplementasikan K-01.

Autentikasi tidak berubah: tetap `Authorization: Bearer <api_key>`. Implikasi kepemilikan data dibahas di bagian akhir (Catatan RBAC).

---

## 1. Rilis 1 — `campaign_type` dan `entity`

### Field baru pada objek campaign

| Field | Tipe | Keterangan |
|---|---|---|
| `campaign_type` | string | `dissemination`, `simulation`, `education`, `quiz`. Default `simulation` bila kosong/null/absen. |
| `entity` | string | Label bebas untuk pengelompokan. |

- Dikirim saat `POST /api/campaigns/` dan dikembalikan pada semua endpoint baca campaign (list, detail, summary, results).
- Nilai `campaign_type` nonkosong yang bukan salah satu di atas ditolak **HTTP 400** sebelum penyimpanan.

### Filter query baru (list dan summary)

- `GET /api/campaigns/?campaign_type=quiz`
- `GET /api/campaigns/?entity=Finance`
- `GET /api/campaigns/summary?campaign_type=quiz`
- Kombinasi `entity` + `campaign_type` memakai **AND**.
- Parameter kosong/absen berarti semua. Nilai `campaign_type` tidak valid → **HTTP 400**.

---

## 2. Rilis 2 — Master Campaign

### 2.1 Field baru pada objek campaign

| Field | Tipe | Keterangan |
|---|---|---|
| `is_master` | bool | Default `false`. Hanya boleh `true` untuk `campaign_type` `education` atau `quiz`; kombinasi lain ditolak **HTTP 400**. |

Dikembalikan juga pada list, detail, summary, dan results.

### 2.2 Field baru pada objek result dan event

| Objek | Field | Keterangan |
|---|---|---|
| result (item `results[]`) | `created_date` | Waktu kedatangan entry. Dipakai untuk mengurutkan kedatangan berulang. |
| event (item `timeline[]`) | `rid` | rid entry yang memicu event. Kosong untuk event lama sebelum migrasi. |

`rid` menautkan tiap event ke entry tertentu (`results[].id`), sehingga kedatangan berulang dari email yang sama tidak tercampur.

### 2.3 Perubahan perilaku endpoint yang sudah ada

**`POST /api/campaigns/`**
- Bila `is_master=true`, campaign boleh dibuat **tanpa `groups`** (validasi "No groups specified" tidak berlaku). Template, landing page, dan sending profile tetap wajib.
- Master **tidak diluncurkan otomatis** meski status langsung In progress. Pengiriman email master hanya terjadi lewat penambahan peserta (lihat 2.4).

**`GET /api/campaigns/{id}/complete`**
- Bila campaign adalah master, menyelesaikan ditolak **HTTP 409** kecuali ada query `?confirm_master=true`.

**`DELETE /api/campaigns/{id}`**
- Bila campaign adalah master, menghapus ditolak **HTTP 409** kecuali ada query `?confirm_master=true`.

**Nilai status result baru**
- `Added` — entry master yang dicatat tanpa pengiriman email (`send_email=false`). Orchestrator perlu mengenali nilai status ini selain nilai yang sudah ada (`Scheduled`, `Email Sent`, dll).

### 2.4 Endpoint baru: tambah peserta ke master

`POST /api/campaigns/{id}/recipients`

Request:

```json
{
  "send_email": false,
  "recipients": [
    {"email": "budi@example.com", "first_name": "Budi", "last_name": "Santoso", "position": "Staff"}
  ]
}
```

Response (HTTP 201):

```json
{
  "results": [
    {"id": "QNI0XE8", "email": "budi@example.com", "status": "Added", "created_date": "2026-10-05T03:43:01Z", "first_name": "Budi", "last_name": "Santoso", "position": "Staff", "send_date": "2026-10-05T03:43:01Z", "reported": false}
  ]
}
```

Aturan:
- Hanya untuk campaign **master** yang berstatus **In progress**.
- Setiap item **selalu membuat entry baru** (tidak ada deduplikasi email): email yang sama dapat masuk berkali-kali, masing-masing dengan `id` (rid) dan `created_date` sendiri.
- `send_email=true` → entry berstatus `Scheduled`, email dikirim memakai template/landing page/sending profile master. `send_email=false` → entry berstatus `Added`, tanpa email.
- Validasi email dilakukan di depan; satu email tidak valid menolak **seluruh** request (tidak ada penyimpanan sebagian).
- `id` (rid) pada response adalah pengenal entry yang harus disimpan orchestrator.

Kode status:
- 201 berhasil; 400 input tidak valid atau campaign bukan master; 409 master berstatus Completed; 404 campaign tidak ada / milik pengguna lain.

### 2.5 Endpoint baru: reaktivasi master

`POST /api/campaigns/{id}/reactivate`

- Tanpa body. Membuka kembali master berstatus Completed menjadi In progress, mencatat event `Campaign Reactivated`.
- Email yang sudah dihapus dari antrean saat Complete tidak dikirim ulang; event selama periode Completed tidak dapat dipulihkan.
- Kode status: 200 berhasil; 400 bukan master atau status bukan Completed; 404 campaign tidak ada / milik pengguna lain.

### 2.6 Filter query baru

- `GET /api/campaigns/?is_master=true` dan `?is_master=false`.
- `GET /api/campaigns/summary?is_master=true|false`.
- Dapat digabung dengan `entity` dan `campaign_type` (AND). Nilai selain `true`/`false` → **HTTP 400**.

### 2.7 Statistik master

Endpoint summary kini menyertakan objek `master_stats` **khusus untuk master** (absen untuk campaign biasa):

```json
{
  "id": 1,
  "name": "Quiz master",
  "is_master": true,
  "stats": { "total": 3, "...": "..." },
  "master_stats": { "entries": 3, "unique": 1 }
}
```

- `master_stats.entries` = jumlah kedatangan (entry); sama dengan `stats.total` pada master.
- `master_stats.unique` = jumlah email unik.
- Tersedia pada `GET /api/campaigns/{id}/summary` dan tiap item master pada `GET /api/campaigns/summary`.
- Catatan: pada master, `stats.total` tetap berarti jumlah kedatangan, bukan jumlah orang unik; gunakan `master_stats.unique` untuk jumlah orang.

---

## 3. Rilis 3 — Rantai redirect antar-campaign (`next_campaign_id`)

Mengimplementasikan K-01: saat target **submit** pada landing page sebuah campaign, server otomatis mendaftarkan target itu sebagai **entry baru** di campaign berikutnya (rid baru), lalu me-redirect (HTTP 302) ke sana. Ini merangkai perjalanan **simulation → education → quiz** per target, tanpa orchestrator perlu menambah peserta secara manual.

### 3.1 Field baru pada objek campaign

| Field | Tipe | Keterangan |
|---|---|---|
| `next_campaign_id` | int | Default `0` (tidak ada rantai). Bila diisi, menunjuk campaign **master** `education` atau `quiz` milik akun yang sama. Setelah target submit landing page campaign ini, target didaftarkan ke campaign tujuan dan di-redirect ke sana. |

- Dikirim saat `POST /api/campaigns/` dan dikembalikan pada semua endpoint baca campaign (list, detail, summary, results).
- Validasi saat create: bila nonzero, campaign tujuan harus ada, milik akun yang sama, `is_master=true`, dan ber-`campaign_type` `education`/`quiz`. Kombinasi lain ditolak **HTTP 400** (`Next campaign not found` atau `Next campaign must be an education or quiz master campaign`).

### 3.1.1 Mengubah `next_campaign_id` setelah create — `POST /api/campaigns/{id}/next`

Endpoint **baru**. GoPhish standar tidak punya endpoint update campaign, jadi `next_campaign_id` dulu hanya bisa diset saat create. Endpoint ini menyetel/menghapus link redirect pada campaign yang **sudah ada** — berguna untuk merangkai rantai setelahnya (mis. menautkan education master ke quiz master) tanpa membuat ulang campaign.

- **Request:** `POST /api/campaigns/{id}/next`, body `{"next_campaign_id": <int>}`. Nilai `0` menghapus link.
- **Validasi** (sama seperti create): bila nonzero, tujuan harus ada, milik akun yang sama, `is_master=true`, `campaign_type` `education`/`quiz`, dan **tidak boleh** menunjuk dirinya sendiri. Gagal → **HTTP 400** (`Next campaign not found` / `Next campaign must be an education or quiz master campaign`). Campaign `{id}` tidak ditemukan → **HTTP 404**.
- **Respons sukses:** `200` `{"success": true, "message": "Next campaign updated"}`.
- **Efek samping penting:** `next_campaign_id` adalah properti campaign tujuan yang **dipakai bersama**. Mengubahnya mengalihkan **semua** target yang lewat campaign itu, bukan hanya satu rantai; nilai lama ditimpa.

```bash
# Tautkan education (id 25) -> quiz (id 26)
curl -sk -X POST https://<host>:3333/api/campaigns/25/next \
  -H "Authorization: Bearer <api_key>" -H "Content-Type: application/json" \
  -d '{"next_campaign_id": 26}'
```

Catatan: UI **New Campaign** memakai endpoint ini — saat membuat simulation dan memilih Education + Quiz sekaligus, form menyetel `next_campaign_id` simulation ke education (saat create) lalu memanggil endpoint ini untuk menautkan education → quiz.

### 3.2 Nilai event baru

| Objek | Nilai | Keterangan |
|---|---|---|
| event (`timeline[]`) | message `Redirected In` | Dicatat pada entry baru di campaign tujuan saat target tiba lewat redirect. `details.payload` berisi `source_rid` dan `source_campaign_id` (rid + id campaign asal), `stage=redirect_arrival`, dan `email`. Inilah penaut antar-tahap. |

Setelah `Redirected In`, redirect memicu GET biasa sehingga entry juga mendapat `Clicked Link`, lalu `Submitted Data` saat target mengisi halaman tujuan (seperti entry lain).

### 3.3 Cara memasang rantai (urutan create penting)

Karena `next_campaign_id` harus menunjuk campaign yang **sudah ada**, buat dari ujung belakang rantai:

1. **Quiz master** — `campaign_type=quiz`, `is_master=true`, tanpa `next_campaign_id`.
2. **Education master** — `campaign_type=education`, `is_master=true`, `next_campaign_id` = id quiz.
3. **Simulation** — `campaign_type=simulation`, dengan `groups`, `next_campaign_id` = id education.

> Urutan buat-dari-belakang hanya perlu bila ingin menyetel `next_campaign_id` langsung saat create. Dengan `POST /api/campaigns/{id}/next` (3.1.1) kamu bisa membuat campaign dalam urutan apa pun lalu menautkannya belakangan.

Contoh create education master:

```json
POST /api/campaigns/
{
  "name": "Education Awareness",
  "campaign_type": "education",
  "is_master": true,
  "next_campaign_id": 26,
  "url": "https://phish.example.com",
  "template": { "name": "Template Edu" },
  "page":     { "name": "Halaman Education" },
  "smtp":     { "name": "SMTP Nonaktif" }
}
```

### 3.4 Aturan dan prasyarat

- **Semua campaign dalam rantai wajib mengisi `url`, termasuk master education dan quiz.** URL redirect dibangun dari `url` **campaign tujuan** (`<url>?rid=<rid_baru>`); bila `url` master kosong, redirect gagal. `url` harus menunjuk phish server yang dapat dijangkau target.
- **Master tujuan harus berstatus `In progress`** agar dapat menerima redirect. Kirim `launch_date` ≤ sekarang (atau kosongkan → default = waktu buat). Master In progress tetap tidak mengirim email.
- **Landing page tiap tahap harus memuat `<form method="post">`.** Submit itulah yang memicu pendaftaran + redirect. Field `redirect_url` pada page **tidak dipakai** untuk rantai ini (biarkan kosong); mekanismenya `next_campaign_id`, bukan `redirect_url` bawaan.
- **Tidak perlu memanggil `POST /.../recipients` untuk rantai.** Entry di education dan quiz dibuat otomatis saat redirect. `recipients` hanya untuk menambah peserta master secara manual di luar rantai.
- Rantai boleh 2 tahap atau lebih; campaign terakhir tidak mengisi `next_campaign_id`.
- Identitas (email/nama) target dibawa dari entry asal ke entry baru, sehingga satu orang dapat ditelusuri lintas campaign via `source_rid`.

### 3.5 Membaca hasil rantai

- Jawaban/isian tiap tahap ada di event `Submitted Data` → `timeline[].details.payload` (mis. `education_understood`, `answer_q1`…).
- Untuk merekonstruksi perjalanan satu orang: mulai dari entry simulation, lalu cari entry di campaign tujuan yang `Redirected In`-nya memuat `source_rid` = rid tahap sebelumnya.

#### 3.5.1 Hasil gabungan di campaign sumber (`GET /api/campaigns/{id}/results`)

Untuk menghindari penggabungan manual lintas campaign, `GET /api/campaigns/{id}/results` kini **otomatis menyertakan** `Submitted Data` dari campaign hilir (education/quiz) ke dalam `timeline` campaign sumber. Perilaku ini berlaku untuk campaign mana pun yang menjadi awal/tengah rantai (mis. simulation `36`), dan muncul identik di API, halaman UI campaign, dan skrip pembaca.

- Event bawaan rantai ditambahkan dengan `message` berlabel tahap: **`Submitted Data (Education)`**, **`Submitted Data (Quiz)`**, atau **`Submitted Data (Chained)`** (fallback bila tipe campaign hilir lain).
- `rid` event tambahan **ditulis-ulang ke rid entry asal** di campaign sumber, sehingga orchestrator cukup **group `timeline` by `rid`** untuk mendapat kredensial + jawaban education + quiz dalam satu perjalanan — tanpa menelusuri `source_rid` lagi.
- `campaign_id` pada event tambahan tetap = id campaign hilir asal (35/34), berguna untuk mengenali tahapnya. `details.payload` tetap asli (termasuk `rid` hilir di dalam payload, bila perlu mencocokkan entry hilir spesifik).
- Penelusuran via `source_rid` (poin di atas) tetap valid dan tidak berubah; penggabungan ini hanya menambah event, tidak mengganti `Redirected In` maupun event asli campaign sumber.

Contoh potongan `timeline` untuk satu orang di `/api/campaigns/36/results`:

```jsonc
{ "campaign_id": 36, "rid": "k4EZTtY", "message": "Submitted Data",             "details": "{\"payload\":{\"email\":[\"...\"]}}" },
{ "campaign_id": 35, "rid": "k4EZTtY", "message": "Submitted Data (Education)",  "details": "{\"payload\":{\"answer_1\":[\"yes\"],\"lang\":[\"id\"]}}" },
{ "campaign_id": 34, "rid": "k4EZTtY", "message": "Submitted Data (Quiz)",       "details": "{\"payload\":{\"quiz_1\":[\"no\"]}}" }
```

### 3.6 Fitur "education page": simpan = sinkron Landing Page **dan** master education

> Koreksi model: aksi **simpan education page template** di orchestrator melakukan **dua** sinkronisasi ke GoPhish sekaligus — (1) **Landing Page** education, dan (2) **create master education campaign** untuk entity itu (sekali). Jadi master education **dibuat saat simpan education page pertama kali** untuk entity, bukan di langkah terpisah.

Model yang disepakati: **tiap entity punya tepat 1 master education** (dan 1 master quiz). Campaign education **tidak menyimpan HTML-nya sendiri** — HTML ada di objek **Landing Page** yang dirujuk **by name**. Maka simpan page berikutnya cukup memperbarui Landing Page; master tidak dibuat ulang. Dari sisi UX tim tetap satu aksi "simpan education page"; call API di bawah terjadi di balik layar.

#### Yang dijalankan orchestrator saat "simpan education page" (idempoten per entity)

1. **Pastikan objek dummy ada** (sekali, dipakai ulang lintas entity): `POST /api/templates/` (template dummy) dan `POST /api/smtp/` (sending profile dummy). Master education tidak mengirim email, jadi isinya boleh dummy — tim **tidak** mengisi ini manual.
2. **Sinkron Landing Page** (konten education):
   - Pertama kali: `POST /api/pages/` → simpan `id`.
   - Simpan berikutnya: `PUT /api/pages/{id}` dengan HTML baru (nama dipertahankan).
   ```json
   POST /api/pages/
   {
     "name": "page-edu-<entity>",
     "html": "<html><body><form method=\"post\"> ... </form></body></html>",
     "capture_credentials": true,
     "capture_passwords": false,
     "redirect_url": ""
   }
   ```
   - **`capture_credentials: true` wajib** — bila `false`, GoPhish menghapus atribut `name` semua input saat disimpan → jawaban **tidak tertangkap**. HTML wajib ber-`<form method="post">`; `redirect_url` kosong (redirect diatur campaign); hidden rid pakai `{{.RId}}` — jangan hardcode.
3. **Pastikan master education entity ada** (create **sekali**):
   - **Cek dulu** (pakai endpoint *list*, yang mendukung filter `entity`):
     `GET /api/campaigns/?entity=<entity>&campaign_type=education&is_master=true`
     Bila sudah ada → selesai (HTML terbaru otomatis dipakai dari langkah 2).
     > Catatan: `GET /api/campaigns/summary` **tidak** mendukung filter `entity`; untuk cek keberadaan master per entity gunakan endpoint list di atas.
   - **Bila belum ada** → `POST /api/campaigns/` membuat master education yang merujuk Landing Page + dummy template/smtp **by name**:
   ```json
   POST /api/campaigns/
   {
     "name": "master-education-<entity>",
     "campaign_type": "education",
     "is_master": true,
     "entity": "<entity>",
     "page":     {"name": "page-edu-<entity>"},
     "template": {"name": "tmpl-dummy"},
     "smtp":     {"name": "smtp-dummy"},
     "url": "http://phish.perusahaan.co.id",
     "next_campaign_id": 0
   }
   ```
   Master langsung **In progress** (`launch_date` kosong = waktu buat), siap jadi target redirect, dan **tidak** mengirim email.

> Field `template`/`smtp`/`url` **tidak diisi tim** — orchestrator mengisinya otomatis (dummy) saat create master. `template`/`smtp`/`page` harus sudah ada sebelum create (resolve by name; jika tidak ada → `Page not found` / `Template not found` / `Sending profile not found`). `groups` tidak wajib untuk master.

#### Idempotensi & 1 master per entity

- Master dibuat **sekali per entity** berkat cek list di langkah 3. Simpan page ke-2 dst hanya `PUT /api/pages/{id}`.
- Master merujuk page **by name**, jadi HTML terbaru dipakai tiap page diakses — **tak perlu** membuat ulang campaign.

#### Redirect & tautan education → quiz

- **Redirect `simulation → education`**: dibuat di fitur **create new campaign** (simulation menunjuk master education entity via `next_campaign_id`). Lihat 4.2. Di luar fitur education page.
- **Tautan `education → quiz`**: set `next_campaign_id` master education ke master quiz entity — saat create master (langkah 3) bila quiz sudah ada, atau menyusul via `POST /api/campaigns/{id}/next` (3.1.1).

#### Pemetaan orchestrator → GoPhish

| Aksi di orchestrator | Objek GoPhish | Endpoint |
|---|---|---|
| Simpan education page — konten | Landing Page | `POST /api/pages/` (pertama), `PUT /api/pages/{id}` (berikutnya) |
| Simpan education page — master entity (sekali) | Campaign | `GET /api/campaigns/?entity=&campaign_type=education&is_master=true` lalu `POST /api/campaigns/` bila belum ada |
| Prasyarat template & smtp dummy (sekali) | Template, Sending Profile | `POST /api/templates/`, `POST /api/smtp/` |
| Redirect simulation → education | Campaign | `POST /api/campaigns/` dengan `next_campaign_id` (fitur create new campaign) |

---

## 4. Contoh payload end-to-end (bundle lengkap)

Section 3 menunjukkan payload *create campaign* untuk rantai. Bagian ini melengkapinya dengan payload penuh seluruh objek pendukung. Semua request memakai header `Authorization: Bearer <api_key>` dan `Content-Type: application/json`. Objek dirujuk berdasarkan nama, jadi buat dengan urutan: template → page → smtp → group → campaign. Beri nama unik per pengiriman (sisipkan ID campaign orchestrator); GoPhish menolak nama duplikat.

### 4.1 Objek pendukung

**`POST /api/templates/`**
```json
{
  "name": "tmpl-sim-2026-0042",
  "subject": "Verifikasi akun Anda",
  "html": "<html><body>Klik {{.URL}}{{.Tracker}}</body></html>",
  "text": "Klik {{.URL}}",
  "envelope_sender": "it-support@perusahaan.co.id"
}
```

**`POST /api/pages/`** — halaman harus memuat `<form method="post">`; submit-lah yang memicu rantai (section 3). Untuk rantai, biarkan `redirect_url` kosong (mekanismenya `next_campaign_id`). Untuk pola manual tanpa rantai, `redirect_url` boleh menunjuk orchestrator.
```json
{
  "name": "page-sim-2026-0042",
  "html": "<html><body><form method=\"post\">...</form></body></html>",
  "capture_credentials": true,
  "capture_passwords": false,
  "redirect_url": ""
}
```

**`POST /api/smtp/`**
```json
{
  "name": "smtp-sim-2026-0042",
  "interface_type": "SMTP",
  "host": "mail.perusahaan.co.id:587",
  "from_address": "IT Support <it-support@perusahaan.co.id>",
  "username": "it-support@perusahaan.co.id",
  "password": "••••••",
  "ignore_cert_errors": false,
  "headers": []
}
```

**`POST /api/groups/`** (hanya untuk simulation; master tidak perlu group)
```json
{
  "name": "grp-sim-2026-0042",
  "targets": [
    {"email": "budi@perusahaan.co.id", "first_name": "Budi", "last_name": "Santoso", "position": "Staff"},
    {"email": "siti@perusahaan.co.id", "first_name": "Siti", "last_name": "Rahma", "position": "Manager"}
  ]
}
```

### 4.2 Pola A — Rantai otomatis (Rilis 3, disarankan)

Buat dari ujung belakang agar `next_campaign_id` menunjuk id yang sudah ada. Semua campaign wajib mengisi `url` (dipakai membangun URL redirect). Peserta education/quiz **dibuat otomatis** saat target submit; tidak perlu `recipients`.

**1. Quiz master** — `POST /api/campaigns/`
```json
{
  "name": "master-quiz-finance",
  "campaign_type": "quiz",
  "is_master": true,
  "entity": "Finance",
  "template": {"name": "tmpl-quiz-finance"},
  "page": {"name": "page-quiz-finance"},
  "smtp": {"name": "smtp-quiz-finance"},
  "url": "http://phish.perusahaan.co.id"
}
```
Simpan `id` yang dikembalikan (mis. `26`).

**2. Education master** — `next_campaign_id` = id quiz.
```json
{
  "name": "master-education-finance",
  "campaign_type": "education",
  "is_master": true,
  "entity": "Finance",
  "next_campaign_id": 26,
  "template": {"name": "tmpl-edu-finance"},
  "page": {"name": "page-edu-finance"},
  "smtp": {"name": "smtp-edu-finance"},
  "url": "http://phish.perusahaan.co.id"
}
```
Simpan `id` (mis. `27`).

**3. Simulation** — `next_campaign_id` = id education, dengan `groups`.
```json
{
  "name": "camp-sim-2026-0042",
  "campaign_type": "simulation",
  "is_master": false,
  "entity": "Finance",
  "next_campaign_id": 27,
  "template": {"name": "tmpl-sim-2026-0042"},
  "page": {"name": "page-sim-2026-0042"},
  "smtp": {"name": "smtp-sim-2026-0042"},
  "url": "http://phish.perusahaan.co.id",
  "launch_date": "2026-10-10T08:00:00Z",
  "send_by_date": "2026-10-10T12:00:00Z",
  "groups": [{"name": "grp-sim-2026-0042"}]
}
```

Setelah target submit di simulation → otomatis jadi entry di education (event `Redirected In`), submit education → otomatis entry di quiz. Orchestrator cukup membaca hasil.

### 4.3 Pola B — Penambahan peserta manual (Rilis 2)

Untuk mengirim quiz/education langsung ke peserta di luar rantai (mis. yang tidak terjebak), buat master tanpa `next_campaign_id`, lalu tambahkan peserta.

**`POST /api/campaigns/{id}/recipients`** — kirim email:
```json
{
  "send_email": true,
  "recipients": [
    {"email": "budi@perusahaan.co.id", "first_name": "Budi", "last_name": "Santoso", "position": "Staff"}
  ]
}
```
Hanya mencatat kedatangan tanpa email:
```json
{
  "send_email": false,
  "recipients": [
    {"email": "siti@perusahaan.co.id", "first_name": "Siti", "last_name": "Rahma"}
  ]
}
```
Response (201) mengembalikan `results[].id` (rid) dan `created_date` per entry; simpan sebagai kunci kedatangan.

## 5. Checklist penyesuaian kode orchestrator

- [ ] Kirim `is_master: true` saat membuat education/quiz master; master dibuat tanpa `groups`.
- [ ] Untuk master, gunakan `POST .../recipients` untuk menambah peserta, bukan membuat campaign baru tiap kali.
- [ ] Simpan `results[].id` (rid) dan `created_date` tiap kedatangan sebagai kunci entry.
- [ ] Baca `timeline[].rid` untuk menautkan event ke entry; tangani event lama tanpa `rid`.
- [ ] Kenali status result `Added`.
- [ ] Jika orchestrator pernah memanggil complete/delete pada master, tambahkan `?confirm_master=true`.
- [ ] Gunakan filter `is_master=false` saat menampilkan campaign non-master agar master tidak tercampur.
- [ ] Jangan mengandalkan auto-launch untuk master; pengiriman email hanya via `recipients` dengan `send_email=true`.
- [ ] Untuk rantai: buat campaign dari belakang (quiz → education → simulation) agar `next_campaign_id` menunjuk id yang sudah ada.
- [ ] Isi `url` di semua campaign rantai, termasuk master education dan quiz (dipakai untuk membangun URL redirect).
- [ ] Pastikan master tujuan `In progress` (kirim `launch_date` ≤ sekarang) sebelum simulation diluncurkan.
- [ ] Jangan memanggil `recipients` untuk peserta rantai; entry education/quiz dibuat otomatis saat redirect.
- [ ] Kenali event `Redirected In` dan baca `source_rid`/`source_campaign_id` untuk menautkan perjalanan lintas campaign.
- [ ] Alternatif lebih ringkas (3.5.1): baca `GET /api/campaigns/{sumber}/results` dan **group `timeline` by `rid`** — jawaban education/quiz sudah digabung dengan label `Submitted Data (Education|Quiz)`.

---

## 6. Catatan RBAC dan autentikasi (bahan diskusi)

Mekanisme auth tidak berubah, tetapi perlu dipertimbangkan untuk orchestrator:

- **Data GoPhish terisolasi per pemilik.** Semua campaign, template, page, group, dan result di-scope berdasarkan `user_id` pemilik API key. GoPhish tidak punya berbagi lintas pengguna dan tidak ada "admin melihat semua".
- Konsekuensi: campaign yang dibuat orchestrator **hanya terlihat oleh akun yang API key-nya dipakai**. Jika operator membuka UI GoPhish dengan akun lain, master/simulation buatan orchestrator tidak akan tampak, dan sebaliknya.

Pilihan model auth:

| Pilihan | Konsekuensi |
|---|---|
| Akun khusus orchestrator (non-admin, role dengan `modify_objects`) | Audit dan pencabutan lebih bersih. Tetapi operator yang ingin melihat campaign di UI GoPhish harus login dengan akun yang sama; kalau tidak, data tidak terlihat. Cocok bila operator memakai UI orchestrator, bukan UI GoPhish. |
| Pakai API key akun yang juga dipakai operator di UI | Operator dan orchestrator melihat data yang sama di satu akun. Tetapi tidak ada pemisahan kepemilikan/audit dan key sulit dicabut tanpa mengganggu akun itu. |

Belum diputuskan. Keputusan ini tidak mengubah kode API; hanya menentukan API key mana yang dipakai orchestrator dan akun mana yang dipakai operator di UI.

---

## 7. Belum tersedia / catatan

- **K-01 sudah diimplementasikan** (lihat Rilis 3): kedatangan dari jalur redirect simulation → education → quiz kini dicatat otomatis via `next_campaign_id`. Penambahan peserta langsung via `recipients` tetap tersedia untuk kebutuhan di luar rantai.
- GoPhish tidak menghitung skor quiz secara native; penilaian jawaban (`answer_q*`) tetap dilakukan di luar GoPhish (lihat contoh `doc/examples/score-quiz.py`).
