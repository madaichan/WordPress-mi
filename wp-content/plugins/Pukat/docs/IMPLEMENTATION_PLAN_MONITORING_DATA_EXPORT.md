# Implementation Plan: Monitoring — Download Data (CSV & Excel Export)

Status: Implemented (Phase 0–6 live + validated), addendum Phase 7 added below (docs/PRD_MONITORING_DATA_EXPORT.md §7.8)
Date: 2026-09-19
Owner: Pukat Product and Engineering
Related PRD: `docs/PRD_MONITORING_DATA_EXPORT.md` (semua open question sudah diputuskan — plan ini mengimplementasikannya sebagai final, tidak ada keputusan requirement lagi yang ditunggu)

## 1. Ringkasan

PRD menambahkan satu tombol baru "Download data" di halaman Monitoring (`Performing.jsx`), yang mengunduh data tabular yang sedang tampil (Target details per Campaign Run, atau Campaign summary per Group/all-active) sebagai CSV atau .xlsx asli. Backend dapat dua route baru (`.../report/export-data`) yang reuse `report()` yang sudah ada — tidak ada query database baru, tidak ada perubahan endpoint PDF yang sudah ada.

## 2. Current State (hasil investigasi kode, bukan asumsi)

### 2.1 Sumber data sudah ada dan sudah benar

- `CampaignRunService::report(int $id)` → `report_from_run()` mengembalikan `metrics_json` yang sudah berisi `target_details` (lihat `CampaignRunService.php:1116-1172`, method `target_details()`) — array `{email, name, department, status, sent_at, opened_at, clicked_at, submitted_at, reported_at}` per target, sudah di-`usort` berdasar nama. **Ini sumber data untuk export mode satu Campaign Run — tidak perlu dibangun ulang.**
- `CampaignGroupService::report( ?int $id )` / `report_active()` mengembalikan `campaign_runs` (array ringkasan per run: `campaign_run_id`, `name`, `status`, `playbook_name`, `launched_at`/`schedule_at`, `target_count`, `stats.{clicked, click_rate, ...}`, `synced_at`) dan `stats` (agregat funnel level-group) — persis yang dipakai `CampaignSummaryRow` di `Performing.jsx:125-156`. **Ini sumber data untuk export mode grup — tidak perlu dibangun ulang.**
- Kedua method di atas sudah dipakai endpoint `report/export` (PDF) yang ada — pola pemanggilannya di `CampaignRunController::export_report()` (`CampaignRunController.php:302-333`) dan `CampaignGroupController::export_report()`/`export_active_report()` jadi referensi langsung untuk route baru di plan ini (struktur sama, cuma writer di ujungnya beda).

### 2.2 Infrastruktur file biner sudah ada, generik, tidak perlu disentuh

- `RestController::binary_response( string $binary, string $filename, string $content_type )` (`RestController.php:89-101`) sudah generik untuk file apapun (dipakai PDF saat ini) — dipakai apa adanya untuk CSV/XLSX, tidak perlu overload/varian baru.
- `Plugin::register_binary_response_support()` (`Plugin.php:335-349`) meng-hook `rest_pre_serve_request` berdasarkan **Content-Type bukan `json`** — otomatis berlaku untuk `text/csv` dan `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` tanpa perubahan apapun di `Plugin.php`.

### 2.3 Belum ada sama sekali: service export data, route export-data, dependency XLSX

Tidak ada file `CampaignDataExportService.php`. Tidak ada route `.../report/export-data` di `CampaignRunController.php` maupun `CampaignGroupController.php`. `composer.json` cuma punya `dompdf/dompdf` (dipakai untuk kompatibilitas lama, sudah tidak dipakai — lihat `docs/PDF_EXPORT.md`) — belum ada library spreadsheet apapun.

### 2.4 Endpoint CSV legacy — dikonfirmasi tidak dipanggil, tidak disentuh

`ReportController.php::export_csv()`/`export_campaign_run_csv()` membaca `pukat_campaigns`/`pukat_risk_scores` (entity legacy, beda dari `pukat_campaign_runs`) dan mengembalikan JSON `{rows, filename}` (dirakit jadi file di klien) — dikonfirmasi **tidak ada pemanggil di `campaignApi.js`/`campaignGroupApi.js`** manapun (`grep` untuk `/reports` di frontend cuma nemu routing `Reports.jsx`, bukan pemanggilan API). Dead code dari sisi frontend Monitoring — dibiarkan apa adanya, tidak direfactor/dihapus di plan ini (di luar scope PRD).

## 3. Dependency Order

```text
Phase 0: Verifikasi ext-zip + composer require openspout/openspout   — manual + 1 file (composer.json)
   |
Phase 1: CampaignDataExportService (rows builder + sanitasi + writer CSV/XLSX)   (butuh Phase 0)
   |
Phase 2: REST routes export-data di CampaignRunController + CampaignGroupController   (butuh Phase 1)
   |
Phase 3: Backend smoke test tool   (butuh Phase 2)
   |
Phase 4: Frontend API layer (campaignApi.js, campaignGroupApi.js)   (butuh Phase 2 live)
   |
Phase 5: Frontend UI — tombol "Download data" di Performing.jsx   (butuh Phase 4)
   |
Phase 6: Validasi end-to-end (lint/build/test + manual QA)   (butuh Phase 5)
```

Tidak ada phase yang bisa paralel secara berarti — fitur ini kecil dan linear (satu service baru, dua controller yang sudah ada tinggal ditambah route, satu halaman frontend).

## 4. Phase 0: Verifikasi Environment + Dependency

**Tujuan:** Pastikan .xlsx bisa digenerate di environment ini sebelum menulis kode yang bergantung padanya (PRD §10 Risks).

**Pekerjaan:**

- Cek extension `zip` aktif di container PHP WordPress: `docker exec plugindev_wordpress php -m | grep -i zip`. Kalau tidak ada, tambahkan `RUN docker-php-ext-install zip` (atau setara) ke Dockerfile WordPress yang relevan **sebelum lanjut** — ini blocker keras untuk Phase 1 bagian XLSX (CSV tidak terpengaruh, bisa jalan duluan kalau perlu di-split).
- `composer require openspout/openspout` di root plugin (path `wp-content/plugins/Pukat`) — cek versi yang ter-resolve kompatibel dengan `"php": ">=8.1"` yang sudah ada di `composer.json`, dan tidak menghasilkan conflict dengan `dompdf/dompdf` yang sudah terpasang.
- Jalankan `composer validate` dan `php -l` pada file yang bertambah otomatis (autoload) untuk memastikan instalasi bersih.

**Acceptance Criteria:** `php -m` menunjukkan `zip` aktif; `composer.json`/`composer.lock` mencatat `openspout/openspout`; `composer install` bersih tanpa conflict.

## 5. Phase 1: `CampaignDataExportService`

**Tujuan:** Satu service baru yang mengubah output `report()` yang sudah ada menjadi baris tabular siap tulis, lalu menulisnya sebagai string CSV atau binary XLSX — dipakai oleh kedua controller di Phase 2.

**Pekerjaan (`includes/Services/CampaignDataExportService.php`, baru):**

- `target_details_rows( array $metrics ): array` — ambil `$metrics['target_details']` (bentuk exact sama seperti yang dipakai `CampaignRunController::export_report()` lewat `$result['metrics']['target_details']`), kembalikan `['headers' => [...], 'rows' => [...]]` dengan kolom **Name, Email, Department, Status, Opened At, Clicked At, Submitted At, Reported At** (FR-3) — tanggal diformat lewat helper timezone di bawah (FR-4), nilai kosong jadi string kosong bukan `null`.
- `campaign_summary_rows( array $report ): array` — ambil `$report['campaign_runs']` dan `$report['stats']`, kembalikan `['headers' => [...], 'rows' => [...]]` dengan kolom **Campaign Name, Status, Playbook, Group, Launched/Scheduled At, Targets, Sent, Opened, Clicked, Click Rate (%), Submitted, Submit Rate (%), Last Synced At** (FR-6) plus baris terakhir `Total` dari `$report['stats']` (FR-7). Nama Group per-run: kalau data run tidak membawa nama group langsung, resolve lewat pola yang sama seperti `CampaignReportPdfService` untuk Campaign Group report (`groups_by_id` map dari `CampaignGroupService::list()`/`CampaignGroupController::groups_by_id()`) — **jangan bikin resolver baru, reuse yang sudah ada.**
- **Shared date formatter** — ekstrak/duplikasi kecil dari pola `CampaignReportPdfService::report_datetime()`/`format_report_datetime()` (`CampaignReportPdfService.php:290-305,523-538`): konversi string ISO/MySQL UTC ke `wp_timezone()`, format `j M Y, H:i`. Kalau dirasa pantas diekstrak jadi satu helper bersama dipakai `CampaignReportPdfService` dan service baru ini (mengurangi duplikasi, lihat PRD Risks §10) — taruh di `includes/Services/ReportDateFormatter.php` sebagai static/trait kecil; kalau tidak, duplikasi method private-nya di service baru dengan komentar yang mengarah balik ke sumber aslinya. **Putuskan saat implementasi berdasar besar-kecilnya diff**, bukan blocker keputusan PRD.
- `sanitize_cell( mixed $value ): string` — satu titik sanitasi dipakai **kedua** writer (FR-9): cast ke string, kalau string diawali `=`, `+`, `-`, atau `@`, prefiks dengan `'`. Dipanggil di ujung `target_details_rows()`/`campaign_summary_rows()` (sebelum data sampai ke writer manapun), bukan diimplementasikan terpisah di writer CSV dan writer XLSX.
- `to_csv( array $table ): string` — terima `['headers', 'rows']`, tulis ke `php://temp` stream pakai `fputcsv()`, prefiks **UTF-8 BOM** (`"\xEF\xBB\xBF"`) di awal string sebelum baris header (FR-2), kembalikan isi stream sebagai string.
- `to_xlsx( array $table ): string` — pakai `openspout\Writer\XLSX\Writer` menulis ke stream sementara (`php://temp` via `fopen` + `fwrite` manual, atau tulis ke file temp `wp_tempnam()` lalu `file_get_contents()` — openspout menulis lewat stream, cek API-nya saat implementasi mana yang paling bersih), baris pertama header (bisa pakai `Style` bold kalau openspout API-nya gampang, opsional — bukan requirement), baris berikutnya data. Kembalikan isi file sebagai string biner. Hapus file/stream sementara setelah selesai (jangan bocor file temp).
- `export_format_from_request( string $raw ): string` — whitelist `csv`/`xlsx`, default `csv` kalau kosong, `WP_Error` `invalid_format` (400) kalau nilai lain — dipakai controller di Phase 2 supaya validasi format di satu tempat, bukan diulang di dua controller.

**Acceptance Criteria:** Unit-level manual check (lewat `tools/` smoke script di Phase 3, bukan PHPUnit baru kecuali dirasa perlu) — `to_csv()` atas data dummy berisi nilai `=SUM(A1:A9)` menghasilkan sel `'=SUM(A1:A9)` (dengan apostrophe) di output string; `to_xlsx()` atas data yang sama menghasilkan file yang valid dibuka `openspout\Reader\XLSX\Reader` (baca balik untuk verifikasi, dipakai smoke test).

## 6. Phase 2: REST Routes

**Tujuan:** Endpoint baru di kedua controller yang sudah ada, reuse permission & data source yang sudah ada (PRD §7.5, §8).

**Pekerjaan:**

- `CampaignRunController.php` — tambah route (dekat route `report/export` yang sudah ada, `CampaignRunController.php:137-141`):
  ```php
  register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/report/export-data', [
      'methods'             => 'GET',
      'callback'            => [ $this, 'export_report_data' ],
      'permission_callback' => [ $this, 'permission_view_campaign_run' ],
  ] );
  ```
  Handler `export_report_data()`: sama pembukaan seperti `export_report()` (panggil `$this->campaign_runs->report( $id )`, handle `WP_Error`), lalu panggil `CampaignDataExportService::target_details_rows()` + `to_csv()`/`to_xlsx()` sesuai `format` query param (validasi lewat `export_format_from_request()`), `binary_response()` dengan content type & filename sesuai format (`text/csv; charset=utf-8` / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, nama file `pukat-monitoring-target-details-{id}-{Ymd}.csv|xlsx`).
- `CampaignGroupController.php` — tambah dua route (dekat `report/export` yang sudah ada, `CampaignGroupController.php:61-65,91-95`), satu untuk `{id}` satu untuk `active`, keduanya panggil handler yang sama dengan parameter berbeda (pola sama seperti `export_report()`/`export_active_report()` yang sudah ada saat ini — cek apakah keduanya sudah saling delegasi ke satu private method bersama; kalau ya, ikuti pola itu untuk export-data juga). Nama file: `pukat-monitoring-campaign-summary-{scope}-{Ymd}.csv|xlsx` (`{scope}` = id group atau `active`).
- Constructor kedua controller: tambah instance `CampaignDataExportService` (pola sama seperti `CampaignReportPdfService $pdf` yang sudah ada di constructor keduanya) — konsisten dependency injection optional-nullable yang sudah dipakai di seluruh codebase ini.

**Acceptance Criteria:** `GET /campaign-runs/{id}/report/export-data` (tanpa `format`) mengembalikan CSV valid dengan header `Content-Type: text/csv; charset=utf-8` dan `Content-Disposition: attachment`; `?format=xlsx` mengembalikan file dengan `Content-Type` spreadsheet yang benar; `?format=pdf` (nilai tidak dikenal) mengembalikan 400 JSON error (bukan file); campaign run yang tidak ada/tidak accessible untuk user mengembalikan 404, identik dengan `.../report` biasa.

## 7. Phase 3: Backend Smoke Test

**Tujuan:** Validasi otomatis tanpa PHPUnit penuh, mengikuti pola `tools/smoke-campaign-pdf.php` yang sudah ada untuk PDF (`docs/PDF_EXPORT.md` §Validation).

**Pekerjaan (`tools/smoke-campaign-export-data.php`, baru — nama disesuaikan konvensi `smoke-campaign-pdf.php`):**

- Sintetis kasus: campaign run dengan data normal, campaign run tanpa sync (`target_details` kosong), nama/departemen mengandung karakter formula-injection (`=`, `+`, `-`, `@`) dan karakter non-ASCII, group dengan beberapa campaign run tercampur status, `active` bucket kosong.
- Cek: jumlah baris CSV/XLSX sama dengan jumlah `target_details`/`campaign_runs`; nilai sel formula-injection punya prefiks `'`; BOM ada di awal file CSV; file XLSX bisa dibaca balik oleh `openspout\Reader\XLSX\Reader` tanpa error dan isinya cocok; REST live test untuk auth/not-found/format-invalid/success sama seperti pola smoke PDF yang sudah ada.
- Ikuti pola artefak: simpan hasil generate ke `/tmp/pukat-export-review/` (bukan repo), bukan commit.

**Acceptance Criteria:** Skrip smoke jalan bersih di container WordPress (`docker exec plugindev_wordpress php wp-content/plugins/Pukat/tools/smoke-campaign-export-data.php /tmp/pukat-export-review`), semua assertion di atas lolos.

## 8. Phase 4: Frontend API Layer

**Tujuan:** Fungsi API baru mengikuti pola `runReportExportPdf`/`reportExportPdf` yang sudah ada persis (PRD §5.1).

**Pekerjaan:**

- `pukat-app/src/api/campaignApi.js` — tambah `runReportExportData: (id, format) => get(\`/campaign-runs/${id}/report/export-data\`, { params: { format }, responseType: 'blob' })`, diletakkan tepat di sebelah `runReportExportPdf` (`campaignApi.js:31`).
- `pukat-app/src/api/campaignGroupApi.js` — tambah helper `reportExportDataPath(id)` (pola sama seperti `reportExportPath(id)` yang sudah ada, `campaignGroupApi.js:8-10`) dan method `reportExportData: (id, format) => get(reportExportDataPath(id), { params: { format }, responseType: 'blob' })`.
- Tidak ada perubahan di `downloadBlob.js` — dipakai apa adanya (sudah generik untuk blob apapun).

**Acceptance Criteria:** Kedua fungsi baru dipanggil manual dari console/dev tool mengembalikan `Blob` dengan `type` sesuai format yang diminta, tanpa error network/CORS (sama origin, pola sama seperti PDF).

## 9. Phase 5: Frontend UI

**Tujuan:** Tombol "Download data" di `Performing.jsx`, memilih format sebelum request (PRD §7.6 FR-13).

**Pekerjaan (`pukat-app/src/pages/Simulation/Performing.jsx`):**

- State baru `isExportingData` (terpisah dari `isExporting` milik PDF, supaya kedua tombol bisa independen menampilkan loading-nya sendiri).
- Fungsi `handleExportData(format)` — cermin `handleExport()` (`Performing.jsx:309-322`) tapi manggil `campaignApi.runReportExportData(runId, format)` / `campaignGroupApi.reportExportData(selectedGroupId, format)`, nama file `pukat-monitoring-{scope}-${date}.${format}` (`scope` sama seperti yang sudah dipakai `handleExport()` — `campaign-{runId}` atau `selectedGroupId`).
- UI: dropdown kecil di sebelah tombol "Export PDF" yang sudah ada di `actions` `PageHeader` (`Performing.jsx:375-377`) — dua item "CSV" dan "Excel (.xlsx)". Cek dulu apakah `TableActionMenu.jsx` (`components/UI/TableActionMenu.jsx`) cukup generik dipakai di luar konteks row-action tabel; kalau strukturnya terlalu terikat ke posisi baris tabel, buat dropdown kecil scoped-lokal di file ini saja (state `showExportMenu` + `useRef`/klik-di-luar-untuk-tutup) — **jangan bikin komponen UI generik baru** di `components/UI/` untuk kebutuhan sekecil ini (AGENTS.md §4.1 soal taxonomy komponen), cukup lokal ke halaman ini kalau `TableActionMenu` tidak cocok dipakai ulang.

**Acceptance Criteria:** Klik "Download data" → "CSV" pada mode satu campaign run mengunduh file `.csv` lewat browser; klik lagi pilih "Excel (.xlsx)" mengunduh `.xlsx`; tombol menampilkan state disabled/loading selagi request berjalan; error network menampilkan `toast.error` (pola sama seperti `handleExport()`).

## 10. Phase 6: Validasi End-to-End

**Pekerjaan:**

- Backend: `php -l` untuk semua file PHP yang diubah/ditambah; jalankan smoke test Phase 3.
- Frontend (folder `pukat-app`): `npm run lint`, `npm run build`, `npm run test`.
- Manual QA di browser (`http://localhost:8080/pukat/#/monitoring`):
  - Buka satu Campaign Run yang sudah pernah sync → download CSV dan XLSX, buka keduanya di Excel/LibreOffice, bandingkan isi dengan tabel "Target details" di layar.
  - Buka Campaign Run yang belum pernah sync → download tetap menghasilkan file (header saja).
  - Kembali ke mode grup (all-active) → download CSV/XLSX, bandingkan isi dengan panel "Campaign funnel" + kartu ringkasan di atas.
  - Login sebagai user entity berbeda yang tidak berhak atas campaign/group tertentu → akses endpoint export-data langsung (mis. lewat URL) menghasilkan 403/404, bukan file.

**Acceptance Criteria:** Semua item Acceptance Criteria di PRD §9 terverifikasi; tidak ada regresi lint/build/test.

## 11. Phase 7 (Addendum): Responder List per Campaign, per Group

**Tujuan:** PRD §7.8 FR-15–19 — tambahkan sheet/section "Responders" ke file Campaign summary (mode grup/all-active), tanpa tombol/endpoint baru.

**Pekerjaan:**

- `CampaignGroupService::aggregate()` (`includes/Services/CampaignGroupService.php`) — di dalam loop `foreach ( $runs as $run )` yang sudah ada (tempat `department_breakdown`/`hourly_activity`/`recent_events` di-merge dari `$metrics` yang sudah didekode), tambah satu blok: iterasi `$metrics['target_details']`, filter ke target yang punya minimal satu dari `opened_at`/`clicked_at`/`submitted_at`/`reported_at` terisi (definisi Responder, PRD §6), lalu `array_merge` dengan `campaign_run_id`/`campaign_name`/`campaign_group_id` supaya baris tahu asalnya. Dikumpulkan ke `$responders[]`, dikembalikan sebagai key baru `responder_details` di return value `aggregate()` — otomatis ikut di `report()` dan `report_active()` karena keduanya memanggil `aggregate()`. **Tidak ada query tambahan** — `target_details` sudah ada di `$metrics` yang sudah didekode untuk kebutuhan lain di loop yang sama.
- `CampaignDataExportService.php`:
  - `responder_details_table( array $report, array $groups_by_id, ?int $group_id, ?string $group_name ): array` — baru, kolom Group/Campaign/Name/Email/Department/Status/4×timestamp, sanitasi formula-injection dan format tanggal reuse method yang sudah ada, diurutkan per Campaign lalu Name.
  - `resolve_group_label()` — extract dari `campaign_summary_table()` jadi private method bersama, dipakai juga oleh `responder_details_table()` (DRY, logic resolusi nama group persis sama).
  - `to_csv_sections( array $sections )` / `to_xlsx_sections( array $sections )` — baru, terima beberapa `{title, table}` sekaligus. CSV: judul + header + rows per section, dipisah baris kosong. XLSX: satu sheet per section (`addNewSheetAndMakeItCurrent()` + `setName()`, dibatasi 31 karakter tanpa `: \ / ? * [ ]`). `to_csv()`/`to_xlsx()` (single-table) **tidak diubah** — tetap dipakai apa adanya oleh export Target details (mode satu Campaign Run), supaya tidak mengubah bentuk file yang sudah divalidasi sebelumnya.
- `CampaignGroupController::export_data_response()` (`includes/Api/CampaignGroupController.php`) — bangun dua table (`campaign_summary_table` + `responder_details_table`, keduanya pakai `groups_by_id()` yang sama) jadi `$sections`, panggil `to_csv_sections()`/`to_xlsx_sections()` sesuai format. `CampaignRunController::export_report_data()` **tidak disentuh** (tetap single-table, sesuai FR-19).

**Acceptance Criteria:** Sama seperti dua butir addendum di PRD §9 — sheet/section "Responders" muncul di file group-scope dengan Group/Campaign terisi benar per baris, dan target berstatus "Email Sent" saja tidak ikut muncul.

**Validasi yang dijalankan:** `php -l` bersih untuk ketiga file yang diubah; smoke test `tools/smoke-campaign-export-data.php` diperluas dengan assertion untuk `responder_details_table()`, `resolve_group_label()`, `to_csv_sections()`/`to_xlsx_sections()` (termasuk baca-balik XLSX multi-sheet), dan REST live check bahwa response export-data grup memuat kedua section; QA browser nyata (Playwright headless, sesi login non-destruktif) mengunduh file dari mode grup dan memverifikasi sheet kedua terbaca dengan baris yang sesuai data live.
