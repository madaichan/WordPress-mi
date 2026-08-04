# Implementation Plan: Campaign Wizard — Playbook-First Redesign

Status: Draft
Date: 2026-08-04
Owner: Pukat Product and Engineering

Related PRD:
- `docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`
- `docs/PRD.md`

Related implementation plan:
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/IMPLEMENTATION_PLAN_FRONTEND_REUSE_AND_SERVER_DRIVEN_TABLE.md`

## 1. Ringkasan

Implementation plan ini menerjemahkan `docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md` menjadi tahapan teknis. Dua kelompok pekerjaan digabung dalam satu plan karena saling bergantung di Step 3:

1. **Restrukturisasi wizard** (UI): Step 1 disederhanakan, Custom Campaign jadi "Coming soon", Sending Schedule dirapikan.
2. **Perbaikan bug fungsional kritis**: tombol "Launch campaign" untuk mode Playbook hari ini hanya membuat `draft_run` dan tidak pernah memanggil lock-snapshot/sync/launch — campaign tidak pernah benar-benar sampai ke GoPhish. Ini bukan pekerjaan kosmetik, ini bug yang harus diperbaiki supaya wizard berguna.
3. **Fitur baru "Set the Follow-Up"**: Quiz toggle (butuh migration kecil) dan Force Reset Password reminder (fitur baru penuh, backend belum ada sama sekali).

Urutan pengerjaan sengaja dimulai dari yang paling berisiko rendah dan paling blocking (perbaikan launch chain), baru diikuti fitur tambahan, supaya di titik manapun plan ini berhenti, wizard tetap dalam keadaan lebih baik dari sebelumnya — bukan setengah jadi.

## 2. Current State (hasil investigasi kode, bukan asumsi)

### 2.1 Frontend wizard

```text
pukat-app/src/features/campaigns/WizardStepper.jsx    -- 3 label step: Preparation, Performing, Review & launch
pukat-app/src/features/campaigns/Wizard/Step1.jsx      -- Information, Select template (statis), Import targets
pukat-app/src/features/campaigns/Wizard/Step2.jsx      -- Campaign mode, Select playbook, Sending schedule
pukat-app/src/features/campaigns/Wizard/Step3.jsx      -- Pre-launch checklist (sebagian hardcoded), Summary, After-launch (statis)
pukat-app/src/features/campaigns/Wizard/wizardData.js  -- TEMPLATES statis, DEMO_TARGETS statis
pukat-app/src/pages/Simulation/Campaigns.jsx           -- orchestration: state form, query playbooks, handleLaunch
pukat-app/src/utils/campaignLaunch.js                  -- buildCampaignLaunchPayload (dipakai untuk create saja)
pukat-app/src/api/campaignApi.js                       -- create, launch (legacy) + createRun, lockRunSnapshot, syncRun, launchRun (run modern)
pukat-app/src/hooks/mutations/useCampaignMutations.js  -- useCreateCampaignMutation, useCreateCampaignRunMutation, useLaunchCampaignMutation (legacy), useDeleteCampaignMutation
```

**Konfirmasi lewat grep di seluruh `pukat-app/src`**: `campaignApi.lockRunSnapshot`, `campaignApi.syncRun`, `campaignApi.launchRun` tidak dipanggil di file manapun. `Campaigns.jsx::handleLaunch()` untuk `form.mode === 'playbook'` hanya memanggil `createCampaignRunMutation.mutate(...)` (yaitu `POST /campaign-runs`) lalu langsung `navigate('/monitoring')`.

### 2.2 Backend Campaign Run lifecycle (sudah ada, sudah pernah live-verified, tinggal disambung dari frontend)

```text
includes/Services/CampaignRunService.php
  create(params, user_id)          -> status: draft_run          (baris 57-116)
  lock_snapshot(id, user_id)       -> status: ready_for_sync      (baris 121-190)
  sync(id, user_id)                -> status: synced              (baris 197-318, auto-lock kalau snapshot kosong)
  launch(id, user_id)              -> status: running/scheduled   (baris 325-367, auto-sync kalau gophish_campaign_id kosong)
  cancel(id, user_id)
  validate_playbook_ready(playbook) -- validasi template/page/smtp playbook, sumber kebenaran pre-launch checklist
```

`launch()` sendiri sudah cascading (akan memanggil `sync()` yang memanggil `lock_snapshot()` kalau perlu) — jadi secara teori frontend cukup memanggil `launchRun(id)` setelah `createRun` untuk menjalankan seluruh rantai. Tapi PRD tetap meminta progress bertahap di UI (lihat 5.3) supaya user paham ini proses multi-detik, bukan instan, dan supaya error dari tiap tahap (misal `gophish_connection_failed`) bisa ditampilkan spesifik.

### 2.3 Data model gap untuk Follow-Up

```text
wp_pukat_quiz_results     -- kolom saat ini: campaign_id (legacy). TIDAK punya campaign_run_id.
wp_pukat_risk_scores      -- SUDAH punya campaign_run_id (migration ensure_campaign_run_risk_score_column(), Activator.php:486-506)
wp_pukat_socialization_logs -- schema ada (type: pre|post|debrief|coaching), TAPI NOL kode backend yang menulis/membaca tabel ini
```

`RiskScoringService::quiz_results_has_campaign_run_id()` (baris 298-311) sudah defensive-check kolom `campaign_run_id` di `quiz_results` — kode ini SUDAH mengantisipasi migration yang belum pernah dibuat. Menambahkan kolom ini adalah menyelesaikan pekerjaan yang sudah setengah jalan, bukan memulai dari nol.

### 2.4 Force Reset Password — konfirmasi tidak ada fondasi

Satu-satunya kemunculan "reset password" di kodebase: teks umpan phishing di dalam Playbook (`PlaybookFormControls.jsx:85,111,114,115,170,244`, `Playbooks.jsx:160-161`). Tidak ada `wp_mail()`, notification service, atau job/cron terkait reminder di `includes/`. Ini murni fitur baru.

## 3. Dependency Order

```text
Phase 0: Konfirmasi keputusan tersisa (Sending Schedule drop/keep, reminder trigger otomatis/manual)
   |
Phase 1: Step 1 simplification (independen, tidak bergantung apa pun)
   |
Phase 2: Step 2 — Custom Campaign jadi Coming soon (independen)
   |
Phase 3: Perbaikan launch chain (BLOCKING — harus selesai sebelum Phase 4 checklist punya arti)
   |
Phase 4: Pre-launch checklist real (bergantung Phase 3 selesai agar ada data run yang benar untuk dicek)
   |
Phase 5: Backend Follow-Up (migration quiz_results, QuizController, follow_up storage di campaign run)
   |
Phase 6: Frontend Follow-Up UI (Step 3 toggle Quiz + Force Reset Password reminder)
   |
Phase 7: QA end-to-end di environment Docker + GoPhish nyata (pola sama seperti verifikasi DataTable sebelumnya)
```

Phase 1 dan 2 bisa paralel karena saling independen dan tidak menyentuh file yang sama secara signifikan.

## 4. Phase 0: Konfirmasi Keputusan Tersisa

Sebelum mulai coding, dua open question di PRD Bagian 11 perlu jawaban:

1. "Sending hours" dan "Blackout period" di Step 2 — didrop atau dipertahankan read-only?
2. Force Reset Password reminder — dikirim otomatis lewat hook `pukat_campaign_run_high_risk_detected`, atau manual lewat tombol di halaman Report/Monitoring?

Tidak ada kode yang berubah di fase ini.

## 5. Phase 1: Step 1 Simplification

**Tujuan:** Step 1 hanya berisi Information + Import Targets.

**Pekerjaan:**

- `Step1.jsx`: hapus seluruh Card 2 ("Select phishing template"), fungsi `openGophishTemplates`, dan import `TEMPLATES`/`TEMPLATE_FILTERS`.
- `wizardData.js`: hapus export `TEMPLATES`, `TEMPLATE_FILTERS`. Pertahankan `DEMO_TARGET_TOTAL`/`DEMO_TARGETS` (masih dipakai demo table saat `csvData` kosong).
- `Campaigns.jsx`: hapus `template`/`templateFilter` dari `INITIAL_FORM`.
- `Step3.jsx`: hapus referensi `TEMPLATES`/`selectedTemplate` (baris 3, 13, 22, 69) — checklist dan summary untuk mode playbook sudah cukup pakai `selectedPlaybook`. Karena Custom Campaign disabled (Phase 2), cabang `form.mode !== 'playbook'` di checklist secara efektif tidak akan pernah aktif, tapi kode-nya dirapikan supaya tidak menyisakan referensi ke data yang sudah dihapus.

**Acceptance Criteria:**

- Step 1 render tanpa error tanpa card template.
- `npm run build` tidak mengeluh unused import.
- `npm run test` tetap hijau (tidak ada test yang menguji template picker berdasarkan pengecekan awal, tapi perlu dipastikan saat eksekusi).

## 6. Phase 2: Custom Campaign — Coming Soon

**Tujuan:** Kartu Custom Campaign tetap terlihat tapi tidak bisa dipilih.

**Pekerjaan:**

- `Step2.jsx`: pada kartu Custom Campaign (baris 30-44) —
  - Hapus `onClick` atau ubah jadi no-op.
  - Tambah `disabled`, `aria-disabled="true"`, styling muted (mengikuti pola disabled state yang sudah ada di project, misal row action disabled di DataTable).
  - Ganti/tambah badge "Flexible" menjadi "Coming soon".
  - Tambah `title`/tooltip singkat menjelaskan alasan disabled (konsisten dengan aturan `AGENTS.md` 4.3: "Disabled action harus memiliki reason/title bila tersedia").
- Pastikan `form.mode` tidak bisa ter-set ke `'custom'` dari interaksi manapun di UI (defense in depth, walau backend sudah menolak lewat `CampaignRunService`).

**Acceptance Criteria:**

- Klik kartu Custom Campaign tidak mengubah `form.mode`.
- Kartu tetap terlihat dan berlabel jelas "Coming soon".

## 7. Phase 3: Perbaikan Launch Chain (BLOCKING, prioritas tertinggi)

**Tujuan:** Klik "Launch campaign" benar-benar menjalankan create → lock-snapshot → sync → launch, bukan berhenti di draft.

**Pekerjaan frontend:**

- `useCampaignMutations.js`: tambah hook baru:
  - `useLockCampaignRunSnapshotMutation`
  - `useSyncCampaignRunMutation`
  - `useLaunchCampaignRunMutation` (nama baru, jangan bentrok dengan `useLaunchCampaignMutation` legacy yang sudah ada untuk `campaignApi.launch`)
- `Campaigns.jsx::handleLaunch()`: untuk `form.mode === 'playbook'`, ubah urutan jadi:
  1. `createCampaignRunMutation.mutateAsync(payload)` → dapatkan `run.id`.
  2. `launchCampaignRunMutation.mutateAsync(run.id)` — karena `launch()` di backend sudah cascading (auto sync, auto lock-snapshot), satu panggilan ini cukup secara fungsional.
  3. Tampilkan progress state di Step 3 (lihat di bawah) selama proses berlangsung.
  4. Navigate ke `/monitoring` hanya setelah langkah 2 selesai sukses.
- `Step3.jsx`: terima prop progress/stage baru dari `Campaigns.jsx` (misal `launchStage: 'creating' | 'launching' | 'done' | null`) untuk menampilkan status per tahap di tombol Launch (contoh label: "Creating run…" → "Launching…").
- Error handling: kalau `launchCampaignRunMutation` gagal (misal `gophish_connection_failed`, `campaign_run_not_ready`), tampilkan pesan error dari response backend (`err.message`) lewat toast — jangan pakai pesan generik "Failed to launch campaign."

**Pekerjaan backend:** Tidak ada perubahan backend di fase ini — endpoint sudah ada dan sudah live-verified sebelumnya (lihat memory: 44 smoke-test assertions passed). Fase ini murni menyambungkan frontend ke endpoint yang sudah ada.

**Acceptance Criteria:**

- Setelah klik "Launch campaign" dengan playbook Active + target terimpor + jadwal terisi, Campaign Run di database berakhir dengan status `synced` atau lebih lanjut (`running`/`scheduled`), bukan `draft_run`.
- Campaign benar-benar muncul di GoPhish (`gophish_campaign_id` terisi) — verifikasi manual di environment Docker + GoPhish yang sudah didokumentasikan di memory project.
- Kegagalan sync/launch (contoh: GoPhish tidak reachable) menampilkan error yang jelas ke user, form tidak ter-reset, user bisa retry.

## 8. Phase 4: Pre-Launch Checklist Real

**Tujuan:** Hilangkan tiga item checklist yang hardcoded `ok: true`.

**Pekerjaan:**

- Pastikan data playbook yang dipakai wizard (`usePlaybooks()` / `playbookMasterToWizardCard`) menyertakan indikator kesiapan (template/page/smtp id terisi) — cek apakah field ini sudah ada di response `usePlaybooks()` atau perlu ditambahkan di backend (`PlaybookController` atau service terkait; di luar `CampaignRunService` yang sudah private-scoped `validate_playbook_ready()`).
  - Kalau field belum diekspos, tambahkan field ringkas (boolean `is_ready` + alasan) ke response playbook list yang sudah dipakai wizard, dihitung dengan logika yang sama seperti `validate_playbook_ready()` (jangan duplikasi logic tersembunyi, extract ke method yang bisa dipanggil dari kedua tempat kalau perlu).
- `Step3.jsx`: ganti item checklist SMTP/landing page/blackout hardcoded dengan kondisi nyata berdasarkan field baru ini.
- Item "No active blackout period" — didrop bersamaan dengan keputusan Phase 0 soal Blackout Period di Step 2 (kalau field itu didrop dari Step 2, checklist-nya juga didrop, bukan dibiarkan sebagai satu-satunya sisa fitur fiktif).

**Acceptance Criteria:**

- Tidak ada item checklist dengan `{ ok: true }` statis tanpa sumber data.
- Playbook yang belum punya template/page/smtp lengkap menampilkan checklist merah dengan pesan yang bisa ditindaklanjuti user.

## 9. Phase 5: Backend Follow-Up

**Tujuan:** Fondasi data untuk Quiz (campaign_run_id) dan Force Reset Password reminder.

**Pekerjaan:**

1. **Migration `pukat_quiz_results.campaign_run_id`** — tambahkan method baru di `Activator.php`, pola identik dengan `ensure_campaign_run_risk_score_column()` (baris 486-506):
   ```php
   private static function ensure_quiz_results_campaign_run_column(): void { ... }
   ```
   Panggil dari `create_tables()` dan `maybe_upgrade()` (bump `pukat_db_version`, ikuti pola versi existing).

2. **`QuizController::submit_quiz`** — terima `campaign_run_id` opsional di request body, simpan ke kolom baru. Tetap terima `campaign_id` untuk compatibility jalur legacy.

3. **Follow-up preference storage** — tambah kolom `follow_up_json` (TEXT/LONGTEXT, nullable) ke `wp_pukat_campaign_runs`, migration serupa pola di atas. `CampaignRunService::create()` menerima dan menyimpan `follow_up` dari params (`quiz_enabled`, `force_reset_password_reminder_enabled`).

4. **`FollowUpReminderService.php` (baru)** — bertanggung jawab kirim email reminder via `wp_mail()` dan mencatat ke `pukat_socialization_logs`. Hook ke action `pukat_campaign_run_high_risk_detected` (sudah ada, `RiskScoringService.php:110`) HANYA kalau Phase 0 memutuskan trigger otomatis; kalau manual, buat endpoint baru `POST /campaign-runs/{id}/send-follow-up-reminder` di `CampaignRunController.php` dengan `permission_manage`.

**Acceptance Criteria:**

- `php -l` bersih di semua file yang diubah.
- Migration idempoten — bisa dijalankan berkali-kali tanpa error (cek kolom ada dulu sebelum ALTER, sudah jadi pola project).
- Submit quiz dengan `campaign_run_id` valid tersimpan dan terhitung benar oleh `RiskScoringService::compute_campaign_run_quiz_score()`.
- Reminder terkirim (via `wp_mail()`) dan tercatat satu baris baru di `pukat_socialization_logs` per pengiriman, tidak dobel untuk target yang sama dalam satu campaign run.

## 10. Phase 6: Frontend Follow-Up UI

**Tujuan:** Step 3 punya UI toggle untuk Quiz dan Force Reset Password reminder.

**Pekerjaan:**

- `Step3.jsx`: tambah card baru "Set the Follow-Up" berisi dua toggle (pola UI sama seperti toggle/checkbox yang sudah dipakai di project, cek `components/UI` untuk komponen existing sebelum bikin baru — sesuai `AGENTS.md`).
- `Campaigns.jsx`: state `form.followUp = { quizEnabled: true, forceResetPasswordReminderEnabled: false }`, dikirim sebagai bagian payload `createCampaignRunMutation`.
- `campaignLaunch.js::buildCampaignLaunchPayload`: sertakan `follow_up` di payload yang dikirim ke `POST /campaign-runs`.

**Acceptance Criteria:**

- Toggle default sesuai PRD (Quiz on, Force Reset Password reminder off).
- Preference tersimpan dan bisa dibaca kembali dari response `GET /campaign-runs/{id}`.

## 11. Files Expected to Change

### Frontend

```text
pukat-app/src/features/campaigns/Wizard/Step1.jsx
pukat-app/src/features/campaigns/Wizard/Step2.jsx
pukat-app/src/features/campaigns/Wizard/Step3.jsx
pukat-app/src/features/campaigns/Wizard/wizardData.js
pukat-app/src/pages/Simulation/Campaigns.jsx
pukat-app/src/hooks/mutations/useCampaignMutations.js
pukat-app/src/utils/campaignLaunch.js
pukat-app/src/utils/campaignLaunch.test.js       (test baru untuk follow_up di payload)
```

### Backend

```text
includes/Core/Activator.php
includes/Api/QuizController.php
includes/Api/CampaignRunController.php            (kalau reminder manual)
includes/Services/CampaignRunService.php
includes/Services/FollowUpReminderService.php     (baru)
includes/Repositories/CampaignRunRepository.php
```

## 12. Testing and Verification Matrix

### Frontend

```text
npm run lint
npm run build
npm run test
```

Manual/dev-server check: pastikan tidak ada import mati (`TEMPLATES` dari `wizardData.js`) yang gagal resolve setelah Phase 1.

### Backend

```text
php -l untuk setiap file yang diubah
Migration idempotency check (jalankan ensure_* dua kali, pastikan tidak error)
REST smoke test:
  - POST /campaign-runs dengan follow_up payload
  - POST /campaign-runs/{id}/launch end-to-end (create -> launch, cek status akhir)
  - POST /quiz/submit dengan campaign_run_id
  - GET /campaign-runs/{id} mengembalikan follow_up_json yang tersimpan
invalid input case (playbook tidak Active, target belum diimpor)
permission denied case (user tanpa permission_manage)
```

### End-to-end (kalau environment Docker + GoPhish tersedia, ikuti pola verifikasi DataTable sebelumnya)

```text
Isi wizard lengkap -> Launch -> cek status campaign run jadi synced/running
Cek campaign benar-benar muncul di GoPhish
Submit quiz dari sisi target -> cek risk score campaign run terupdate
Trigger follow-up reminder -> cek email terkirim (atau minimal wp_mail() dipanggil tanpa error) dan tercatat di socialization_logs
```

## 13. Rollout Strategy

- Phase 1-2 (UI reorganisasi) bisa di-deploy terpisah lebih dulu — risiko rendah, tidak mengubah behavior backend.
- Phase 3 (perbaikan launch chain) adalah perubahan behavior yang terlihat user (campaign sekarang benar-benar launch, sebelumnya diam-diam hanya draft) — komunikasikan ke user/stakeholder sebagai bug fix, bukan cuma fitur baru.
- Phase 5-6 (Follow-Up) bisa menyusul sebagai rilis terpisah karena independen dari Phase 1-4.
- Tidak ada breaking change ke endpoint existing — semua penambahan bersifat additive (kolom baru nullable, parameter baru opsional).

## 14. Risks and Mitigations

- **Risiko:** Phase 3 mengubah UX tombol Launch dari instan menjadi multi-detik (create + launch berantai ke GoPhish). Mitigasi: progress indicator per tahap (7. Phase 3), supaya user tidak mengira aplikasi hang.
- **Risiko:** Migration kolom baru di tabel yang sudah berisi data produksi (`pukat_quiz_results`, `pukat_campaign_runs`). Mitigasi: ikuti pola `ensure_*` yang sudah terbukti aman (cek kolom dulu, additive only, tidak ada `DROP`/`MODIFY`).
- **Risiko:** `wp_mail()` gagal silent kalau WordPress belum dikonfigurasi SMTP di environment user. Mitigasi: `FollowUpReminderService` harus mengecek return value `wp_mail()` dan mencatat kegagalan (bukan cuma asumsi sukses), serta ini perlu diuji di environment nyata sebelum dianggap selesai (tidak bisa diverifikasi valid di sandbox tanpa SMTP asli).
- **Risiko:** Scope creep — Custom Campaign kartunya sudah kelihatan menarik untuk "sekalian dikerjakan sedikit". Mitigasi: tetap patuh ke Non-Tujuan PRD, Custom Campaign benar-benar di luar phase ini.

## 15. Open Decisions

Sama seperti PRD Bagian 11 — perlu dijawab di Phase 0 sebelum Phase 2 dan Phase 5 dimulai:

- Sending hours / Blackout period: drop atau read-only?
- Force Reset Password reminder: trigger otomatis (hook risk scoring) atau manual (tombol)?

## 16. MVP Completion Criteria

- Wizard 3-step sesuai struktur PRD Bagian 1 (minus field Custom Campaign, sesuai Non-Tujuan).
- Klik "Launch campaign" pada campaign berbasis Playbook menghasilkan Campaign Run yang benar-benar tersinkron/berjalan di GoPhish, bukan berhenti di draft.
- Pre-launch checklist 100% berbasis data nyata, tidak ada item hardcoded.
- Quiz result campaign run baru tertaut `campaign_run_id` dengan benar.
- Force Reset Password reminder terkirim sebagai notifikasi email (bukan aksi reset sungguhan) dan tercatat di log.
- `npm run lint/build/test` dan `php -l` bersih di semua file yang diubah.
