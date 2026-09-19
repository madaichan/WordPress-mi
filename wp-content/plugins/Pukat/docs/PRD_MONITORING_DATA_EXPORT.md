# PRD: Monitoring — Download Data (CSV & Excel Export)

Status: Implemented (v1: FR-1–14), Draft addendum (§7.8 FR-15/16: per-campaign responder list, group scope)
Date: 2026-09-19
Owner: Pukat Product and Engineering
Related area: `pukat-app/src/pages/Simulation/Performing.jsx` (halaman Monitoring, route `/monitoring`), `includes/Services/CampaignRunService.php`, `includes/Services/CampaignGroupService.php`, `includes/Api/CampaignRunController.php`, `includes/Api/CampaignGroupController.php`
Related PRD:
- `docs/PRD_CAMPAIGN_GROUP_MONITORING.md` §7.5 FR-11 (pola export PDF yang sudah ada — PRD ini menambah format baru untuk kebutuhan yang beda, bukan menggantikan)
- `docs/PDF_EXPORT.md` (dokumentasi teknis export PDF yang sudah live, dipakai sebagai referensi pola)

## 1. Ringkasan

PIC sudah bisa mengunduh laporan Monitoring sebagai PDF (FR-11, `docs/PRD_CAMPAIGN_GROUP_MONITORING.md`). PIC sekarang juga butuh versi **data mentah** yang bisa diolah lebih lanjut di luar aplikasi (filter, pivot, sortir manual, dilampirkan ke laporan lain) — dalam format **CSV** atau **Excel (.xlsx) asli**, bukan PDF.

PRD ini menambahkan tombol **"Download data"** di halaman Monitoring (`/monitoring`, komponen `Performing.jsx`), di samping tombol "Export PDF" yang sudah ada, untuk mengunduh data tabular yang sedang tampil di layar sebagai CSV atau .xlsx.

## 2. Latar Belakang

### 2.1 Export yang sudah ada

- `GET /campaign-runs/{id}/report/export` dan `GET /campaign-groups/{id|active}/report/export` sudah live, menghasilkan PDF asli lewat Chromium/Playwright (`CampaignReportPdfService`, lihat `docs/PDF_EXPORT.md`). **Tidak diubah** oleh PRD ini.
- Ada endpoint CSV lama di `ReportController.php` (`/reports/{campaign_id}/export`, `/reports/campaign-runs/{campaign_run_id}/export`) — tapi ini baca dari tabel **legacy** `pukat_campaigns`/`pukat_risk_scores`/`pukat_quiz_results`, **tidak pernah dipanggil frontend manapun** (tidak ada di `campaignApi.js` maupun `campaignGroupApi.js`), dan mengembalikan JSON `{rows, filename}` untuk dirakit jadi file di sisi klien — bukan file biner langsung. Konvensi ini sudah usang dan **tidak dipakai ulang** oleh PRD ini (lihat §4).
- Halaman `/reports` (`Reports.jsx`) punya tombol "Export CSV" / "Download PDF" yang masih stub (`toast.success('...is being prepared.')` di `pages/Simulation/Reports.jsx:144,344,347`) — **di luar scope PRD ini**, konsisten dengan non-goal PRD sebelumnya yang tidak menyentuh halaman itu.

### 2.2 Data yang benar-benar tampil di halaman Monitoring

Halaman Monitoring (`Performing.jsx`) punya dua mode, dipilih lewat query param `?run={id}`:

1. **Mode grup / seluruh grup aktif** (`runId` kosong) — funnel stats agregat, breakdown per departemen, aktivitas per jam, dan **daftar ringkasan per-campaign** ("Campaign funnel", komponen `CampaignSummaryRow`, sumber data `report.campaign_runs` dari `CampaignGroupService::report()`/`report_active()`).
2. **Mode satu Campaign Run** (`?run={id}`) — funnel stats satu campaign, plus **`DataTable` "Target details"** (`TARGET_DETAILS_SCHEMA`, sumber data `report.metrics.target_details` dari `CampaignRunService::report()`) — satu-satunya tabel per-target (satu baris = satu penerima) yang benar-benar ada di halaman ini saat ini.

Kedua sumber data ini sudah dihitung backend dan tersimpan di `metrics_json` masing-masing Campaign Run (`CampaignRunService::build_result_metrics()`) — sama persis dengan sumber data export PDF. Tidak perlu live call baru ke GoPhish maupun query database baru.

## 3. Tujuan

- PIC dapat mengunduh **Target details** (satu baris per penerima: nama, email, departemen, status, timestamp tiap tahap) sebagai CSV atau .xlsx, untuk satu Campaign Run yang sedang dibuka.
- PIC dapat mengunduh **ringkasan per-campaign** ("Campaign funnel": nama, status, playbook, waktu launch, jumlah target, sent/opened/clicked/submitted + rate, terakhir sync) sebagai CSV atau .xlsx, untuk satu Campaign Group / seluruh grup aktif yang sedang dipilih.
- File yang diunduh mencerminkan **persis** cakupan (scope) yang sedang tampil di layar saat tombol diklik — perilaku yang sama seperti "Export PDF" yang sudah ada.

## 4. Non-Tujuan

- Tidak mengubah endpoint `/report/export` (PDF) yang sudah ada.
- Tidak menghidupkan-ulang/reuse endpoint CSV legacy `ReportController.php` (§2.1) — beda entity, beda schema, tidak dipanggil frontend manapun saat ini.
- Tidak membangun halaman `/reports` (`Reports.jsx`) — tombol "Export CSV" / "Download PDF" di sana tetap stub.
- Tidak menambah tabel/breakdown data baru (mis. per-departemen, live event feed) — export ini menyalin tabel yang **sudah ada** di layar (§2.2), bukan menambah agregasi baru.
- Tidak ada pemilihan kolom custom oleh user — kolom tetap tetap sama seperti data yang tampil di layar.
- ~~Tidak menggabungkan Target details lintas-campaign jadi satu file saat mode grup~~ — **direvisi oleh addendum §7.8**: khusus untuk *user yang memberikan response* (bukan seluruh target), sekarang digabung lintas-campaign dalam satu sheet/section "Responders". Keterbatasan dedup penerima dari `docs/PDF_EXPORT.md` tetap berlaku (satu user yang jadi target di 2 campaign berbeda tetap muncul sebagai 2 baris terpisah, satu per campaign — tidak di-dedup lintas campaign).
- Tidak ada dedup penerima lintas-campaign di list Responders — satu email yang jadi target di beberapa campaign dalam grup yang sama muncul sebagai baris terpisah per campaign, bukan digabung jadi satu baris.

## 5. Scope

### 5.1 In Scope

Backend:

```text
composer.json                                          — dependency baru openspout/openspout (lihat FR-14, disetujui user)
includes/Services/CampaignDataExportService.php         — baru: bangun rows (header + data) dari report() yang sudah ada, tulis CSV/XLSX
includes/Services/CampaignGroupService.php              — addendum §7.8: aggregate() juga mengumpulkan responder_details lintas-campaign
includes/Api/CampaignRunController.php                  — route baru GET /campaign-runs/{id}/report/export-data
includes/Api/CampaignGroupController.php                — route baru GET /campaign-groups/{id|active}/report/export-data
```

Frontend:

```text
pukat-app/src/pages/Simulation/Performing.jsx           — tombol "Download data" (pilih CSV/XLSX) di samping "Export PDF"
pukat-app/src/api/campaignApi.js, campaignGroupApi.js    — fungsi export-data baru
```

### 5.2 Out of Scope

```text
includes/Api/ReportController.php dan endpoint /reports/* legacy
pukat-app/src/pages/Simulation/Reports.jsx
Export gabungan seluruh Target details (bukan cuma responder) lintas Campaign Run — lihat §7.8 untuk yang memang digabung (responder saja)
Kolom custom / filter kolom saat export
```

## 6. Definisi

- **Target details**: baris per-penerima dari `metrics_json.target_details` — sumber data `DataTable` "Target details" di `Performing.jsx`.
- **Campaign summary**: baris per-Campaign Run dari `CampaignGroupService::report()['campaign_runs']` — sumber data list "Campaign funnel" di `Performing.jsx`.
- **Responder** *(addendum §7.8)*: target yang punya minimal satu event tercatat — `opened_at`, `clicked_at`, `submitted_at`, atau `reported_at` terisi (status "Email Sent" tanpa event lain **bukan** responder).

## 7. Functional Requirements

### 7.1 Format file

- FR-1: PIC memilih salah satu dari dua format saat klik "Download data": **CSV** atau **Excel (.xlsx)**. File .xlsx harus file Excel **asli** (dibuka langsung tanpa peringatan format), bukan CSV yang cuma di-rename ekstensinya.
- FR-2: File CSV memakai UTF-8 dengan BOM (supaya nama/departemen dengan karakter non-ASCII tampil benar saat dibuka Excel di Windows — isu umum untuk data Indonesia) dan delimiter koma standar.

### 7.2 Target details export (mode satu Campaign Run)

- FR-3: Saat `runId` terisi di URL (`?run={id}`), tombol "Download data" mengunduh seluruh baris `target_details` campaign tersebut. Kolom sama seperti `TARGET_DETAILS_SCHEMA` di `Performing.jsx`: Name, Email, Department, Status, Opened At, Clicked At, Submitted At, Reported At.
- FR-4: Tanggal/waktu diformat memakai timezone situs WordPress (`wp_timezone()`), bukan UTC mentah — konsisten dengan cara `CampaignReportPdfService::report_datetime()` memformat tanggal untuk PDF. Baris tanpa timestamp untuk suatu tahap ditampilkan kosong, bukan `null`/`0000-00-00`.
- FR-5: Kalau `target_details` kosong (campaign belum pernah sync), file tetap ter-generate berisi header kolom saja dengan 0 baris data — bukan error 4xx/5xx.

### 7.3 Campaign summary export (mode grup / seluruh grup aktif)

- FR-6: Saat `runId` kosong, tombol "Download data" mengunduh satu baris per Campaign Run dalam cakupan yang sedang dipilih (satu group tertentu, atau seluruh group berstatus Active). Kolom: Campaign Name, Status, Playbook, Group, Launched/Scheduled At, Targets, Sent, Opened, Clicked, Click Rate (%), Submitted, Submit Rate (%), Last Synced At.
- FR-7: Baris terakhir memuat **Total** — funnel stats agregat cakupan tersebut (`report.stats`, angka yang sama seperti kartu ringkasan di atas halaman) — supaya file tetap punya angka ringkasan tanpa PIC harus menjumlah manual.
- FR-8: Kalau cakupan tidak punya Campaign Run sama sekali, file tetap ter-generate (header + baris Total bernilai 0), bukan error.

### 7.4 Keamanan data

- FR-9: Nilai sel yang berasal dari input user (nama target, departemen, nama campaign, nama playbook — semuanya bisa diisi lewat import target CSV atau form) **wajib disanitasi terhadap CSV/Excel formula injection**: kalau nilai diawali `=`, `+`, `-`, atau `@`, tambahkan prefiks `'` (apostrophe) sebelum ditulis ke sel, supaya Excel/Google Sheets tidak mengeksekusinya sebagai formula saat file dibuka.
- FR-10: Tidak ada field sensitif (password, token, secret) di kolom manapun — konsisten dengan aturan umum `AGENTS.md` §5.1; `target_details`/`campaign_runs` yang jadi sumber data memang sudah tidak membawa field itu.

### 7.5 Permission & cakupan akses

- FR-11: Endpoint export-data pakai `permission_callback` yang **sama persis** dengan endpoint report yang sudah ada untuk resource yang sama (`campaigns.view`, lihat `permission_view_campaign_run`/`permission_view_campaign_group`) — tidak ada capability baru.
- FR-12: Visibility Campaign Run/Campaign Group entity-based yang sudah ada (`current_user_can_access_run()`, dkk.) tetap berlaku — export tidak boleh membocorkan data di luar entity user. Endpoint export-data memanggil ulang service method (`report()`) yang sama persis dengan endpoint report biasa, jadi otomatis mewarisi guard ini, bukan reimplementasi terpisah yang rawan divergen.

### 7.6 UI

- FR-13: Tombol "Download data" ditempatkan di sebelah "Export PDF" (area `actions` pada `PageHeader`), memicu pilihan format (CSV/XLSX) sebelum request dikirim — pola dropdown kecil, bukan modal penuh. Selama proses download, tombol menampilkan state loading yang sama seperti "Export PDF" (`isExporting`/disabled), supaya PIC tidak klik dobel.

### 7.7 Dependency baru

- **FR-14 (disetujui eksplisit oleh user — lihat `AGENTS.md` §3 soal dependency baru):** PRD ini menambah dependency PHP baru untuk generate .xlsx asli. **Rekomendasi: `openspout/openspout`** (bukan `phpoffice/phpspreadsheet`) — alasan: kebutuhan di sini cuma *menulis* satu sheet data tabular sederhana (bukan baca/edit/styling kompleks), openspout jauh lebih ringan (streaming writer, memory footprint kecil, dependency minim) dibanding PhpSpreadsheet yang didesain untuk kebutuhan read+write+styling penuh. Pemilihan final & version pin diputuskan di implementation plan.
  Perlu PHP extension `ext-zip` aktif di environment (format .xlsx adalah ZIP container) — **wajib dicek di image PHP/Docker WordPress sebelum implementasi XLSX dimulai** (lihat Risks §10; beda dari environment PDF renderer yang terpisah/Node-based, jadi tidak otomatis ikut ready). CSV tidak butuh dependency baru (native `fputcsv`/string building), sama seperti prinsip file biner lain yang sudah dilewatkan lewat `RestController::binary_response()`.

### 7.8 Daftar responder per campaign, sesuai group *(addendum — user request setelah v1 live)*

- **FR-15 (keputusan user):** Pada export Campaign summary (mode grup/all-active, §7.3), file yang sama juga memuat **daftar user yang memberikan response**, satu baris per user, ditandai campaign asal dan label group-nya. Definisi "response" = **Responder** (§6): minimal satu event tercatat (opened/clicked/submitted/reported) — bukan hanya yang klik/submit/lapor, dan bukan cuma "Email Sent" tanpa event lain.
- **FR-16:** Struktur flat, satu baris = satu user, kolom: **Group, Campaign, Name, Email, Department, Status, Opened At, Clicked At, Submitted At, Reported At** — mudah difilter/pivot di Excel (keputusan user, dibanding baris judul berkelompok per Group/Campaign).
- **FR-17:** List ini **ditambahkan ke file yang sama** dengan Campaign summary (§7.3), bukan tombol/endpoint baru — untuk XLSX sebagai **sheet kedua** ("Responders", sheet pertama "Campaign Summary"); untuk CSV (yang tidak mengenal sheet) sebagai **section kedua** dalam file yang sama, dipisah baris judul + baris kosong dari section Campaign Summary.
- **FR-18:** Sumber data: per-run `target_details` yang sudah didekode `CampaignGroupService::aggregate()` untuk `department_breakdown`/`hourly_activity`/`recent_events` — **tidak ada query database tambahan**, hanya menambah satu filter+map di loop yang sudah ada. Konsisten dengan §7.2 FR-3, tidak melanggar batas "tidak ada agregasi baru di luar yang sudah dihitung backend" (§4 Non-Tujuan v1) karena `target_details` per-run memang sudah tersedia di `metrics_json`, cuma belum pernah diekspos lewat `CampaignGroupService`.
- **FR-19:** Mode satu Campaign Run (§7.2) **tidak berubah** — tabel "Target details" di sana sudah menampilkan seluruh target (termasuk yang belum respons) per definisi yang sudah ada, bukan di-scope ulang ke responder saja.

## 8. API Impact

| Endpoint | Perubahan |
|---|---|
| `GET /campaign-runs/{id}/report/export-data?format=csv\|xlsx` | **Baru.** File Target details untuk satu Campaign Run (FR-3). `format` wajib salah satu dari whitelist (`csv` kalau tidak dikirim), selain itu 400. |
| `GET /campaign-groups/{id}/report/export-data?format=csv\|xlsx` | **Baru.** File berisi **dua tabel**: Campaign summary (FR-6/7) + Responders (FR-15–18), untuk satu Campaign Group. |
| `GET /campaign-groups/active/report/export-data?format=csv\|xlsx` | **Baru.** Sama seperti di atas, untuk seluruh Campaign Group Active, pola sama seperti `.../active/report/export` PDF yang sudah ada. |
| `GET .../report/export` (PDF, sudah ada) | **Tidak berubah.** |
| `GET /reports/*` (legacy CSV) | **Tidak berubah, tidak dipanggil ulang.** |

## 9. Acceptance Criteria

- Di halaman Monitoring dengan satu Campaign Run terbuka, klik "Download data" → pilih CSV, menghasilkan file `.csv` yang jumlah barisnya sama dengan jumlah baris `DataTable` "Target details" di layar, kolom & urutan sama.
- Kolom nama/departemen dengan karakter non-ASCII (mis. "Muhammad Álvarez") tampil benar saat file CSV dibuka Excel (bukan mojibake).
- Baris data dengan nama yang diawali karakter formula (mis. `=cmd|'/c calc'!A1`) muncul sebagai teks literal saat dibuka Excel, bukan tereksekusi sebagai formula.
- Ganti pilihan ke XLSX pada campaign/grup yang sama menghasilkan file `.xlsx` yang bisa dibuka Excel tanpa peringatan "file corrupt/repair", isi baris identik dengan versi CSV.
- Di mode grup/all-active, file summary punya satu baris per campaign yang tampil di panel "Campaign funnel" plus satu baris Total yang angkanya sama dengan kartu ringkasan di atas halaman.
- User dari entity yang tidak berhak mengakses suatu Campaign Run/Group tetap mendapat 403/404 yang sama seperti saat mengakses `/report` biasa (tidak ada bypass akses lewat endpoint export-data).
- *(Addendum §7.8)* File Campaign summary (mode grup/all-active) memuat sheet/section kedua "Responders" berisi seluruh user dengan minimal satu event (opened/clicked/submitted/reported) di semua campaign pada cakupan tersebut, masing-masing baris menunjukkan Group dan Campaign asalnya dengan benar — termasuk saat mode "all active groups" mencakup lebih dari satu Campaign Group sekaligus.
- *(Addendum §7.8)* User yang statusnya cuma "Email Sent" (tidak ada event lain) **tidak muncul** di list Responders.
- Tidak ada regresi pada `npm run lint`, `npm run build`, `npm run test` (frontend) dan `php -l` (backend) untuk file yang diubah.

## 10. Risks

- **`ext-zip` mungkin belum aktif di image PHP/Docker WordPress saat ini** — .xlsx (ZIP container) tidak bisa ditulis tanpanya. Wajib dicek (`php -m | grep zip`) sebelum fase implementasi XLSX dimulai; kalau tidak ada, perlu update Dockerfile WordPress.
- **CSV formula injection (FR-9) gampang terlewat** kalau helper sanitasi tidak dipakai konsisten di kedua writer (CSV dan XLSX) — harus ada satu titik sanitasi yang dipakai bersama oleh keduanya, bukan diimplementasikan dua kali secara terpisah.
- **Duplikasi logic format tanggal antara `CampaignReportPdfService` dan service baru** — kalau tidak diekstrak jadi helper kecil bersama, ada risiko dua tempat itu makin divergen (mis. salah satu diupdate soal timezone, yang lain tidak). Bukan blocker MVP, dicatat sebagai technical debt kalau tidak diekstrak dari awal.
- **`openspout/openspout` adalah dependency baru** — perlu dicek kompatibilitas versi dengan PHP 8.1+ (`composer.json` saat ini) dan tidak konflik dengan `dompdf/dompdf` yang sudah ada, sebelum dianggap final.
- **Target details tidak paginated** (sama seperti keterbatasan `DataTable` di layar sekarang — lihat komentar di `Performing.jsx:201-204`) — campaign dengan ribuan target akan menghasilkan file besar dalam satu request sinkron. Bukan regresi baru (data memang sudah dimuat penuh di memory oleh `report()` untuk kebutuhan PDF/DataTable), tapi berlaku juga untuk export ini — di luar scope untuk dioptimalkan lebih lanjut kecuali diminta.

## 11. Open Questions

Semua keputusan besar sudah diambil user di awal PRD ini (format CSV + .xlsx asli; scope Target details + Campaign summary). Tidak ada open question tersisa dari sisi requirement. Detail kecil yang masih diputuskan di implementation plan (bukan requirement, murni teknis): nama pasti class/file baru, exact version pin library, dan bentuk visual dropdown tombol.
