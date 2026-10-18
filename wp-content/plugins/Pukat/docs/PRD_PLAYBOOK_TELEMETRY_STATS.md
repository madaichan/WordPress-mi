# PRD: Playbook Telemetry Stats (Used / Avg Click / Avg Submit)

Status: Draft
Date: 2026-10-18
Owner: Pukat Product and Engineering
Related area: Backend (`includes/Services/PlaybookMasterService.php`, `includes/Repositories/CampaignRunRepository.php`, `includes/Services/CampaignRunService.php`), React frontend (`pukat-app/src/utils/playbookUiModel.js`, `pukat-app/src/components/playbooks/PlaybookDetailBody.jsx`)
Related PRD:
- `docs/PRD.md`
- `docs/PRD_WIZARD_PLAYBOOK_PICKER.md`
- `docs/PRD_CAMPAIGN_GROUP_MONITORING.md`

## 1. Ringkasan

Kartu statistik di detail playbook — **Used**, **Avg click rate**, **Avg submit rate** — saat ini hardcoded `0x`, `0%`, `0%` dengan sublabel palsu (`since Jan 2025`, `not tested yet`) untuk semua playbook. PRD ini mengisinya dengan telemetri nyata yang diagregasi dari campaign run yang benar-benar pernah dikirim memakai playbook tersebut.

Kartu-kartu itu dirender oleh `PlaybookDetailBody`, yang sejak `PRD_WIZARD_PLAYBOOK_PICKER` dipakai bersama oleh halaman Playbooks (`/pukat/#/playbooks`) dan modal preview di wizard. Jadi perbaikan ini otomatis muncul di kedua tempat.

## 2. Latar Belakang dan Masalah

### 2.1 Angka hardcoded

`playbookMasterToUiPlaybook()` (`pukat-app/src/utils/playbookUiModel.js`) menetapkan nilai tetap:

```js
usedCount: '0x',
clickAvg: '0%',
submitAvg: '0%',
clickSub: 'not tested yet',
submitSub: 'not tested yet',
```

dan sublabel `"since Jan 2025"` ditulis langsung di `PlaybookDetailBody.jsx`. Tidak ada satu pun yang berasal dari data.

### 2.2 Datanya sebenarnya ada, tapi per-run, belum diagregasi

Telemetri asli hidup per campaign run, bukan per playbook:

- `pukat_campaign_runs.metrics_json` diisi `CampaignRunService::sync()` (`includes/Services/CampaignRunService.php:~984`) dengan ringkasan dari `build_metrics_summary()`: `total`, `email_sent`, `email_opened`, `clicked`, `submitted_data`, `email_reported`, `click_rate`, `submit_rate`, dst.
- Setiap run menyimpan `playbook_master_id` (kolom ber-index), `launched_at`, `completed_at`, dan `status`.

Yang belum ada: agregasi lintas run per `playbook_master_id`. `PlaybookMasterRepository::count_campaign_runs_for_playbook()` menghitung run (untuk keperluan edit-lock), tetapi tidak membedakan run yang sudah dikirim dari yang masih draft/sync, dan tidak menyentuh metrics.

### 2.3 Field `metrics` pada playbook selalu kosong

Service mengirim `metrics` dari `pukat_playbook_masters.metrics_json`, tetapi kolom itu `DEFAULT NULL` dan tidak pernah diisi (`includes/Core/Activator.php:269`). Jadi bukan sumber yang bisa dipakai.

## 3. Goals

- Kartu Used menampilkan berapa kali playbook benar-benar dipakai untuk mengirim campaign (bukan draft), dengan sublabel jujur ("since <bulan pertama>" atau "no runs yet").
- Kartu Avg click rate dan Avg submit rate menampilkan rata-rata nyata dari run-run yang sudah punya hasil.
- Saat belum ada data, kartu menampilkan keadaan jujur ("—" / "no runs yet" / "not tested yet"), bukan `0%` yang menyesatkan.
- Nilai dihitung di backend dan dikirim lewat payload playbook yang sudah ada, tanpa membocorkan data per-target atau blob JSON besar.
- Halaman Playbooks dan modal wizard sama-sama ikut benar karena memakai komponen yang sama.

## 4. Non-Goals

- Tidak mengubah cara `CampaignRunService` menghitung metrik per-run. PRD ini hanya mengagregasi yang sudah ada.
- Tidak membuat dashboard baru. Hanya tiga kartu yang sudah ada yang diisi.
- Section **"Insights from previous simulations"** di detail tetap hardcoded untuk fase ini (lihat §9).
- Tidak menambah endpoint publik baru kalau tidak perlu — target utamanya memperkaya response list/get playbook yang sudah ada.
- Tidak menyentuh `assets/dist`.

## 5. Requirement Fungsional

### 5.1 Definisi metrik (F1)

| Kartu | Definisi | Sumber |
| --- | --- | --- |
| **Used** | Jumlah campaign run milik playbook yang **sudah dikirim** — `launched_at IS NOT NULL` (draft/ready_for_sync tidak dihitung). | `pukat_campaign_runs` |
| **Used** sublabel | "since <bulan tahun run pertama dikirim>", mis. "since Mar 2026"; "no runs yet" kalau Used = 0. | `MIN(launched_at)` |
| **Avg click rate** | Agregat click rate lintas run yang punya hasil (`total > 0`). | `metrics_json` per run |
| **Avg submit rate** | Agregat submit rate lintas run yang punya hasil. | `metrics_json` per run |
| rate sublabel | "across N tested runs" bila ada; "not tested yet" bila belum ada run dengan hasil. | — |

### 5.2 Metode agregasi rate (F2)

Dua opsi:

- **Pooled (direkomendasikan):** `avg_click_rate = SUM(clicked) / SUM(total) × 100` lintas run. Run dengan 200 target tidak bobotnya sama dengan run 2 target. Lebih benar secara statistik.
- **Mean of rates:** rata-rata aritmetik dari `click_rate` tiap run. Lebih sederhana tapi bias ke run kecil.

PRD memilih **pooled**. Run yang `total = 0` (sudah launch tapi belum ada hasil) dihitung untuk **Used** tetapi tidak untuk rate.

### 5.3 Sumber data dan performa (F3)

- Agregasi dihitung di backend dan ditempelkan ke tiap playbook pada response list/get sebagai key baru `stats` (kecil): `{ used_count, first_launched_at, tested_run_count, click_rate, submit_rate }`.
- **Tidak boleh N+1.** List playbook memanggil agregasi satu kali untuk semua playbook (satu query grouped), bukan satu query per playbook.
- **Tidak mengirim `metrics_json` run mentah ke frontend** (AGENTS.md §5.2). Hanya angka `stats` yang sudah diringkas.
- Karena `metrics_json` berbentuk JSON, implementation plan menimbang dua jalur (parse di PHP vs kolom denormalisasi) — lihat plan.

### 5.4 Perilaku frontend (F4)

- `playbookMasterToUiPlaybook()` membaca `row.stats` alih-alih literal. Pemetaan:
  - `usedCount` = `used_count` (mis. "12x"), `0x` → tetap "0x" tetapi sublabel "no runs yet".
  - `clickAvg`/`submitAvg` = `"<rate>%"` bila `tested_run_count > 0`, selain itu "—".
  - `clickSub`/`submitSub` = "across N tested runs" atau "not tested yet".
  - Sublabel Used = "since <bulan>" dari `first_launched_at`, atau "no runs yet".
- Sublabel `"since Jan 2025"` yang hardcoded di `PlaybookDetailBody.jsx` dipindah jadi prop/`playbook.usedSub` supaya tidak ada tanggal palsu.
- Tidak ada perubahan layout; hanya isi `StatMini`.

### 5.5 Akses (F5)

- `stats` adalah agregat non-sensitif (hitungan dan persentase), tanpa nama/email target. Mengikuti permission view playbook yang sudah ada; tidak ada gating tambahan.

## 6. Acceptance Criteria

1. Playbook yang belum pernah dipakai: Used "0x / no runs yet", click & submit "— / not tested yet".
2. Playbook dengan ≥1 run terkirim tapi belum ada hasil: Used menghitung run itu; rate tetap "not tested yet".
3. Playbook dengan beberapa run berhasil: Avg click/submit = pooled rate, sublabel "across N tested runs", Used sublabel "since <bulan run pertama>".
4. Draft run (belum launch) tidak menambah Used.
5. Response list playbook tidak memuat `metrics_json` run mentah; hanya `stats`.
6. List playbook tidak menimbulkan query per-playbook (verifikasi lewat jumlah query/among logs).
7. Halaman Playbooks dan modal preview wizard menampilkan angka yang sama untuk playbook yang sama.
8. `npm run lint`, `npm run build`, `npm run test` di `pukat-app` lulus; PHP syntax check file yang diubah lulus.

## 7. Dampak dan Kompatibilitas

- Menambah key `stats` pada payload playbook; konsumen lama yang mengabaikan field tak dikenal tidak terpengaruh.
- Tidak ada perubahan permission atau skema yang merusak (kalau jalur denormalisasi dipilih, hanya penambahan kolom + backfill, lihat plan).

## 8. Risiko

| Risiko | Mitigasi |
| --- | --- |
| Parsing `metrics_json` untuk banyak run memberatkan list | Baca hanya kolom yang perlu (`playbook_master_id`, `launched_at`, `metrics_json`) untuk run terkirim; atau denormalisasi ke kolom integer (plan memutuskan) |
| Definisi "Used" ambigu (launched vs synced) | Dipatok eksplisit: `launched_at IS NOT NULL` |
| Rate menyesatkan saat sampel kecil | Sublabel selalu menyebut "across N tested runs" agar konteks jumlah run terlihat |
| Data lama sebelum fitur ini | Run lama yang sudah punya `metrics_json` tetap terhitung; tidak perlu backfill untuk jalur parse-PHP |

## 9. Fase Berikutnya (tidak dikerjakan sekarang)

- Section "Insights from previous simulations" diisi insight nyata (mis. departemen paling rentan dari agregasi `risk_summary`).
- Caching/denormalisasi penuh jika jumlah run tumbuh besar.
- Tren per periode (naik/turun antar campaign group).
