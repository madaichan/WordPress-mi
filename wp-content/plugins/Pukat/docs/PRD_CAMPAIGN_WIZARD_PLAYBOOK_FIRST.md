# PRD: Campaign Wizard — Playbook-First Redesign

Status: Draft
Date: 2026-08-04
Owner: Pukat Product and Engineering
Related area: React frontend (`pukat-app/src/features/campaigns/Wizard`, `pukat-app/src/pages/Simulation/Campaigns.jsx`), backend Campaign Run lifecycle, Quiz, Risk Scoring
Related PRD:
- `docs/PRD.md`
- `docs/PRD_REUSABLE_DATA_TABLE_COMPONENT.md`

## 1. Ringkasan

Wizard "New campaign" di `/pukat/#/campaigns` (Step 1–3, `WizardStepper`) akan disusun ulang mengikuti alur berikut, dengan fokus tahap ini pada jalur **campaign berbasis Playbook**:

```text
1. Wizard Preparation
   - Information
   - Import Targets

2. Performing
   - Campaign Mode
     - Use Playbook        (aktif, dikerjakan penuh di fase ini)
       - Show the Playbook
       - Set the Playbook
     - Custom Campaign     (kartu tetap tampil, berlabel "Coming soon", disabled)
   - Sending Schedule

3. Review & Launch
   - Pre-Launch Checklist
   - Campaign Summary
   - Set the Follow-Up
     - Quiz
     - Force Reset Password (reminder saja, bukan reset password sungguhan)
```

PRD ini bukan cuma reorganisasi tampilan. Investigasi kode existing menemukan bahwa wizard saat ini punya beberapa cacat fungsional nyata (bukan asumsi) yang harus diperbaiki bersamaan dengan restrukturisasi ini — lihat Bagian 2.

## 2. Latar Belakang

### 2.1 Template picker di Step 1 tidak nyambung dengan Campaign Mode

`Step1.jsx` menampilkan kartu "Select phishing template" (data statis dari `wizardData.js`, bukan dari API) sebelum user memilih Campaign Mode di Step 2. Kalau user akhirnya memilih "Use playbook", pilihan template itu tidak pernah dipakai — playbook sudah punya email template sendiri. Field ini salah tempat secara alur.

### 2.2 "Custom Campaign" hari ini tidak fungsional

`Step2.jsx` hanya menampilkan teks deskriptif untuk mode Custom Campaign ("Configure the email template, landing page, and SMTP relay manually") tanpa field input apa pun. Tidak ada UI untuk memilih email template, landing page, SMTP profile, atau domain.

### 2.3 Mesin launch modern ("Campaign Run") mewajibkan Playbook — tidak bisa dipakai untuk Custom Campaign

`CampaignRunService::create()` (`includes/Services/CampaignRunService.php:57-61`) menolak request tanpa `playbook_master_id` ("playbook_master_id is required"). Referensi ke playbook tersebar di 45 titik sepanjang service ini (create, lock_snapshot, sync, launch, cancel, report, risk scoring). Custom Campaign tidak bisa numpang di mesin ini tanpa rework backend yang cukup besar — karena itu, sesuai keputusan user, Custom Campaign ditunda ke fase berikutnya dan untuk saat ini hanya ditampilkan sebagai "Coming soon".

### 2.4 Temuan kritis: tombol "Launch campaign" untuk mode Playbook TIDAK benar-benar launch

Ini temuan paling penting dari investigasi. `Campaigns.jsx::handleLaunch()` (baris 197-217) untuk mode playbook hanya memanggil:

```js
createCampaignRunMutation.mutate(buildCampaignLaunchPayload(form, wizardPlaybooks))
```

yaitu `POST /campaign-runs` — yang menurut `CampaignRunService::create()` cuma menghasilkan status `draft_run`. Backend sebenarnya sudah punya lifecycle lengkap dan sudah diverifikasi jalan (lihat memory hasil live testing sebelumnya):

```text
create          -> status: draft_run
lock-snapshot   -> status: ready_for_sync   (membekukan versi playbook + target)
sync            -> status: synced           (push template/page/smtp/group/campaign ke GoPhish)
launch          -> status: running/scheduled
```

`sync()` otomatis memanggil `lock_snapshot()` kalau belum dikunci, dan `launch()` otomatis memanggil `sync()` kalau belum tersinkron — jadi cukup satu panggilan `launch()` untuk mengeksekusi seluruh rantai ini. Tapi `campaignApi.js` sudah mendefinisikan `lockRunSnapshot`, `syncRun`, `launchRun` (baris 14-16) dan **tidak satu pun pernah dipanggil dari frontend manapun** (dikonfirmasi lewat pencarian di seluruh `pukat-app/src`). Akibatnya: mengklik "Launch campaign" hari ini hanya membuat draft di database — campaign itu tidak pernah benar-benar tersinkron atau berjalan di GoPhish, walau tombolnya berlabel "Launch" dan toast-nya bilang "Campaign launched in GoPhish."

### 2.5 Pre-launch checklist di Step 3 berisi item palsu yang selalu hijau

`Step3.jsx` baris 24, 25, 27 — "SMTP sending profile validated", "Landing page configured in GoPhish", "No active blackout period" — semuanya `{ ok: true }` hardcoded, tidak pernah benar-benar dicek terhadap playbook yang dipilih.

### 2.6 "Set the Follow-Up" adalah fitur baru, bukan yang sudah ada

- **Quiz**: sudah punya fondasi backend (`QuizController.php` submit + hasil, tabel `pukat_quiz_results`), tapi tabel ini **hanya punya kolom `campaign_id`, tidak punya `campaign_run_id`**. `RiskScoringService::quiz_results_has_campaign_run_id()` (baris 298-311) sudah mengantisipasi kolom ini lewat defensive check, tapi kolom itu sendiri belum pernah dibuat lewat migration manapun di `Activator.php` (beda dengan `pukat_risk_scores` yang sudah dapat migration `campaign_run_id` di `ensure_campaign_run_risk_score_column()`). Artinya hasil quiz dari campaign berbasis Campaign Run saat ini tidak bisa tertaut balik ke campaign run yang benar.
- **Force Reset Password**: satu-satunya kemunculan frasa ini di seluruh kodebase adalah sebagai **konten umpan phishing** di dalam Playbook (`PlaybookFormControls.jsx`, `Playbooks.jsx` — teks email palsu "CRITICAL: Reset your Active Directory password" yang memang didesain untuk memancing klik target). Tidak ada aksi sistem nyata bernama ini. Tidak ada juga infrastruktur pengiriman notifikasi/reminder di backend (`wp_mail`/notification service tidak ditemukan di `includes/`) — tabel `pukat_socialization_logs` sudah ada di schema (kolom `type` sudah punya opsi `pre|post|debrief|coaching`) tapi **belum ada satu pun kode yang menulis atau membaca tabel ini**. Ini murni skeleton, bukan fitur yang tinggal disambung.

### 2.7 Keputusan yang sudah disepakati bersama user

- Fase ini fokus ke jalur **Campaign by Playbook**. Custom Campaign field-level (Set Email Template/Landing Page/Domain) ditunda.
- Kartu "Custom Campaign" di Campaign Mode tetap ditampilkan, tapi disabled dengan label "Coming soon".
- "Force Reset Password" dikerjakan sebagai **reminder/notifikasi email saja** (bukan integrasi reset password sungguhan ke Active Directory/IT system).

## 3. Tujuan

- Menata ulang wizard menjadi 3 step sesuai struktur di Bagian 1, dengan Step 1 hanya berisi Information + Import Targets.
- Menghapus template picker dari Step 1 (tidak relevan untuk mode Playbook, dan Custom Campaign belum dikerjakan).
- Menjadikan alur "Use Playbook" benar-benar menghasilkan campaign yang tersinkron dan berjalan di GoPhish saat user klik "Launch" — bukan cuma draft.
- Mengganti pre-launch checklist yang hardcoded dengan pengecekan nyata terhadap kesiapan playbook (status aktif, template/page/smtp lengkap) dan target yang sudah diimpor.
- Menyediakan kartu "Custom Campaign" sebagai placeholder disabled berlabel "Coming soon" di Campaign Mode.
- Menambahkan "Set the Follow-Up" di Review & Launch dengan dua opsi: Quiz (toggle, sudah ada fondasi) dan Force Reset Password reminder (toggle, fitur baru — kirim email pengingat, bukan reset sungguhan).
- Menyambungkan `campaign_run_id` ke `pukat_quiz_results` supaya hasil quiz Campaign Run berbasis Playbook bisa dihitung dengan benar oleh `RiskScoringService`.

## 4. Non-Tujuan

- Membangun field Custom Campaign (Set Email Template, Set Landing Page, Set Email/SMTP, Set Domain) — ditunda ke fase berikutnya.
- Mengubah `CampaignRunService` supaya bisa jalan tanpa `playbook_master_id`.
- Integrasi reset password sungguhan ke Active Directory atau sistem IT eksternal.
- Mengerjakan ulang `CalendarView`, `MonitoringView`, `ReportView`, `AssetsView` di luar yang secara langsung terdampak oleh perubahan status Campaign Run.
- Menghapus jalur legacy `create_campaign`/`launch_campaign` (`CampaignController.php`) — tetap ada untuk compatibility, tidak dipakai lagi oleh wizard setelah fase ini (karena Custom Campaign disabled).
- Menambah dependency/package baru. `wp_mail()` (WordPress core) sudah cukup untuk reminder email.
- Redesain visual/styling besar-besaran di luar penyesuaian struktur step.

## 5. Scope

### 5.1 In Scope

Frontend:

```text
pukat-app/src/features/campaigns/Wizard/Step1.jsx
pukat-app/src/features/campaigns/Wizard/Step2.jsx
pukat-app/src/features/campaigns/Wizard/Step3.jsx
pukat-app/src/features/campaigns/Wizard/wizardData.js
pukat-app/src/features/campaigns/WizardStepper.jsx
pukat-app/src/pages/Simulation/Campaigns.jsx
pukat-app/src/hooks/mutations/useCampaignMutations.js  (tambah hook untuk lock-snapshot/sync/launch run)
pukat-app/src/utils/campaignLaunch.js
```

Backend:

```text
includes/Core/Activator.php                 (migration campaign_run_id di pukat_quiz_results)
includes/Api/QuizController.php             (terima & simpan campaign_run_id)
includes/Services/CampaignRunService.php    (simpan follow-up preference: quiz/reminder toggle)
includes/Repositories/CampaignRunRepository.php
includes/Api/CampaignRunController.php      (endpoint baru untuk trigger reminder, jika diperlukan)
```

Kemungkinan file baru:

```text
includes/Services/FollowUpReminderService.php   (kirim reminder via wp_mail, tulis ke pukat_socialization_logs)
```

### 5.2 Out of Scope

- Semua item di Bagian 4 (Non-Tujuan).
- Perubahan skema `pukat_campaigns` (jalur legacy) — tidak disentuh.
- UI Custom Campaign selain kartu disabled "Coming soon".

## 6. Definisi

### 6.1 Campaign Run

Record di `wp_pukat_campaign_runs`, instance eksekusi dari sebuah Playbook Master. Status berjalan: `draft_run -> ready_for_sync -> synced -> running/scheduled`.

### 6.2 Snapshot

Salinan beku konten Playbook (template, landing page, difficulty, dst) pada saat `lock_snapshot` dipanggil, disimpan di kolom `snapshot_json`. Menjamin campaign yang sudah berjalan tidak berubah walau Playbook Master-nya diedit setelahnya.

### 6.3 Follow-Up

Aksi otomatis yang dikonfigurasi user di Step 3 untuk dijalankan setelah campaign berjalan/selesai. Fase ini mencakup dua jenis: Quiz (kirim/lacak quiz ke target yang klik) dan Force Reset Password Reminder (kirim email pengingat, bukan aksi sistem).

### 6.4 Coming Soon Card

Kartu pilihan mode di UI yang tetap terlihat (agar user tahu fitur akan datang) tapi tidak bisa diklik/dipilih, dengan indikator visual jelas (badge/label "Coming soon", cursor not-allowed).

## 7. Functional Requirements

### 7.1 Step 1 — Wizard Preparation

- Hapus card "Select phishing template" dan seluruh dependensinya (`TEMPLATES`, `TEMPLATE_FILTERS` di `wizardData.js`, tombol "Create a new template in GoPhish").
- Card "Information": tetap — nama campaign (required) dan deskripsi (optional).
- Card "Import Targets": tetap seperti sekarang (upload CSV, preview, download template CSV) — sudah tersambung ke `POST /targets/import` dan berfungsi.
- `form.template`/`form.templateFilter` dihapus dari state wizard (`INITIAL_FORM` di `Campaigns.jsx`) karena tidak lagi dipakai di jalur Playbook.

### 7.2 Step 2 — Performing

**Campaign Mode:**

- Kartu "Use playbook": tetap sebagai pilihan aktif dan default (`form.mode` default `'playbook'`, dipertahankan).
- Kartu "Custom campaign": tetap tampil, tapi:
  - `disabled`, tidak bisa diklik/dipilih.
  - Badge "Flexible" diganti/ditambah badge "Coming soon".
  - `onClick` dihapus atau no-op; `aria-disabled="true"`.

**Show the Playbook / Set the Playbook** (sub bagian dari Use Playbook):

- Menggunakan grid kartu playbook yang sudah ada (`Step2.jsx` baris 66-95) — "Show" mengacu pada tampilan kartu (nama, deskripsi, tipe, difficulty, status), "Set" mengacu pada aksi klik memilih (`form.playbook`). Tidak ada perubahan struktural besar di bagian ini; hanya rename/rapikan judul section jadi "Use playbook — select from Playbook Master" bila diperlukan agar konsisten dengan penamaan proposal.
- Tetap tampilkan `playbooksLoading` dan empty state seperti sekarang.
- Playbook dengan status bukan `active` tetap bisa dipilih di UI (agar user lihat pilihannya), tapi validasi "harus Active" tetap terjadi sebelum submit (sudah ada di `handleLaunch`, baris 207-210) — dipertahankan.

**Sending Schedule:**

- Start date, End date, Timezone: dipertahankan (dipakai nyata oleh `buildCampaignLaunchPayload`).
- "Sending hours" dropdown dan "Blackout period" static text: **hardcoded/dekoratif, tidak pernah dikirim ke backend maupun dipakai di manapun.** Direkomendasikan untuk didrop dari UI fase ini (bukan direproduksi sebagai fitur nyata) — konsisten dengan pola project ini di migrasi-migrasi sebelumnya (drop field fabricated, jangan dipertahankan sebagai UI kosong). Ini judgment call yang perlu dikonfirmasi user sebelum implementasi, bukan diterapkan diam-diam.

### 7.3 Step 3 — Review & Launch

**Pre-Launch Checklist (real, bukan hardcoded):**

Ganti item statis `{ ok: true }` dengan pengecekan nyata:

| Item | Sumber kebenaran |
|---|---|
| Target terimpor | `csvData.length > 0` (sudah ada) |
| Playbook dipilih & Active | `selectedPlaybook` + `selectedPlaybookReady` (sudah ada) |
| SMTP sending profile tersedia | Playbook Master punya `gophish_smtp_id` valid (field baru dari data playbook, atau hasil `validate_playbook_ready()` yang sudah ada di backend) |
| Landing page tersedia | Playbook Master punya `gophish_page_id` valid |
| Jadwal pengiriman diisi | `form.dateStart && form.dateEnd` (sudah ada) |

Tiga item pertama sudah tercermin di `CampaignRunService::validate_playbook_ready()` — perlu diekspos ke frontend (lewat data playbook yang sudah di-load `usePlaybooks()`, atau endpoint baru) supaya checklist tidak menebak.

**Campaign Summary:** dipertahankan seperti sekarang, tidak ada perubahan fungsional.

**Set the Follow-Up (baru):**

- **Quiz** — toggle on/off (default: on, mencerminkan perilaku saat ini yang implisit selalu "on" di teks statis).
  - Kalau on: setelah campaign run dibuat, simpan preference ini pada campaign run (field baru, lihat 7.4).
  - Hasil submit quiz dari target harus tertaut ke `campaign_run_id`, bukan cuma `campaign_id` lama.
- **Force Reset Password** (reminder) — toggle on/off (default: off).
  - Kalau on: setelah campaign run berjalan dan risk scoring mendeteksi target high-risk (klik + gagal quiz), kirim satu email reminder ke target tersebut via `wp_mail()`, isi email menyarankan ganti password — bukan memaksa reset sungguhan.
  - Setiap pengiriman dicatat di `pukat_socialization_logs` (kolom `type` bisa pakai nilai baru, misal `password_reminder`, atau reuse `coaching`).

**Tombol "Launch campaign" harus benar-benar menjalankan rantai penuh:**

```text
create (jika belum ada run) -> lock-snapshot -> sync -> launch
```

UI menampilkan progress per tahap (misal: "Creating run…" → "Locking snapshot…" → "Syncing to GoPhish…" → "Launching…") supaya user tahu proses multi-step ini sedang berjalan, bukan instan. Kalau salah satu tahap gagal (contoh: `gophish_connection_failed`), tampilkan error spesifik dari backend, bukan pesan generik.

### 7.4 Data Model Baru

`wp_pukat_campaign_runs` — tambah kolom (atau simpan di `metrics_json`/kolom JSON baru `follow_up_json`):

```json
{
  "quiz_enabled": true,
  "force_reset_password_reminder_enabled": false
}
```

`wp_pukat_quiz_results` — tambah kolom `campaign_run_id BIGINT UNSIGNED DEFAULT NULL` + index, mengikuti pola persis `ensure_campaign_run_risk_score_column()` yang sudah ada untuk `pukat_risk_scores`.

## 8. API Impact

| Endpoint | Perubahan |
|---|---|
| `POST /campaign-runs` | Terima `follow_up` object opsional (quiz_enabled, force_reset_password_reminder_enabled) |
| `POST /campaign-runs/{id}/lock-snapshot` | Tidak berubah — mulai dipanggil dari frontend |
| `POST /campaign-runs/{id}/sync` | Tidak berubah — mulai dipanggil dari frontend (implisit lewat launch) |
| `POST /campaign-runs/{id}/launch` | Tidak berubah — mulai dipanggil dari frontend, jadi ujung rantai launch |
| `POST /quiz/submit` (di `QuizController`) | Terima `campaign_run_id` opsional selain `campaign_id` |
| Baru: reminder trigger | Bisa berupa job/cron sederhana yang jalan setelah risk scoring (`pukat_campaign_run_high_risk_detected` action hook sudah ada di `RiskScoringService.php:110` — reminder service bisa hook ke sini) |

## 9. Acceptance Criteria

- Step 1 tidak lagi menampilkan pemilihan template email.
- Kartu "Custom Campaign" di Step 2 tampil, berlabel "Coming soon", tidak bisa dipilih.
- Memilih Playbook yang Active, mengisi jadwal, lalu klik "Launch campaign" di Step 3 menghasilkan Campaign Run dengan status akhir `synced` atau `running`/`scheduled` (bukan berhenti di `draft_run`), dan campaign benar-benar muncul di GoPhish.
- Pre-launch checklist menampilkan status merah/hijau berdasarkan data nyata, tidak ada item yang hardcoded `ok: true` tanpa sumber data.
- Toggle Quiz dan Force Reset Password Reminder tersimpan bersama Campaign Run dan bisa dibaca kembali.
- Submit quiz untuk target campaign run tercatat dengan `campaign_run_id` yang benar dan terhitung oleh `RiskScoringService`.
- Tidak ada regresi pada `npm run lint`, `npm run build`, `npm run test`, dan `php -l` untuk file backend yang diubah.

## 10. Risks

- **Multi-step launch di frontend menambah state kompleksitas** (loading per tahap, retry parsial). Mitigasi: backend sudah mendukung idempoten (create sekali, lalu ulang launch akan cascade lewat status check) — pastikan retry dari UI cukup memanggil `launchRun` ulang.
- **Migration kolom `campaign_run_id` di `pukat_quiz_results`** harus aman untuk instalasi existing (pola sudah terbukti dipakai untuk `pukat_risk_scores`, risiko rendah).
- **Menghapus "Sending hours"/"Blackout period" dari UI** adalah judgment call yang mengubah tampilan existing — perlu konfirmasi eksplisit dari user sebelum dieksekusi (lihat 7.2).
- **Reminder email tanpa infrastruktur notifikasi sebelumnya** — perlu dipastikan `wp_mail()` sudah terkonfigurasi di environment (SMTP WordPress, bukan GoPhish) sebelum fitur ini dianggap selesai; kalau belum terkonfigurasi di server user, email reminder bisa gagal silent kalau tidak ditangani.

## 11. Open Questions

- Apakah "Sending hours" dan "Blackout period" didrop (rekomendasi) atau tetap dipertahankan sebagai UI read-only?
- Apakah reminder "Force Reset Password" dikirim otomatis (trigger dari risk scoring, lihat 8) atau manual (tombol "Send reminder" di halaman Report/Monitoring)? PRD ini mengasumsikan otomatis via hook `pukat_campaign_run_high_risk_detected`, perlu dikonfirmasi.
