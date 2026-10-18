# Implementation Plan: Playbook Telemetry Stats

Status: Draft
Date: 2026-10-18
Owner: Pukat Product and Engineering

Related PRD:
- `docs/PRD_PLAYBOOK_TELEMETRY_STATS.md`
- `docs/PRD_WIZARD_PLAYBOOK_PICKER.md`

## 1. Ringkasan

Mengisi kartu Used / Avg click rate / Avg submit rate di detail playbook dengan agregasi nyata dari campaign run. Backend menghitung satu `stats` per playbook dan menempelkannya ke payload list/get yang sudah ada; frontend membaca `stats` alih-alih literal hardcoded.

Dua fase:

```text
Fase 1  Backend: agregasi stats per playbook (satu query, tanpa N+1)
Fase 2  Frontend: playbookUiModel + PlaybookDetailBody membaca stats
```

## 2. Current State (hasil pembacaan kode)

```text
includes/Services/CampaignRunService.php
  build_metrics_summary()  -> total, email_sent, clicked, submitted_data, click_rate, submit_rate, ... (per run)
  sync()                   -> menulis metrics_json + status + launched_at/completed_at
includes/Repositories/CampaignRunRepository.php
  all(), find(), playbook_names_by_id()  -- belum ada agregasi per playbook
includes/Repositories/PlaybookMasterRepository.php
  count_campaign_runs_for_playbook()     -- hitung run dengan snapshot (untuk edit-lock), bukan untuk stats
includes/Services/PlaybookMasterService.php
  prepare_playbook()       -> menambah components, readiness, usage, edit_locked; `metrics` dari playbook.metrics_json (NULL)
  list()                   -> map prepare_playbook atas semua playbook milik user
pukat-app/src/utils/playbookUiModel.js
  playbookMasterToUiPlaybook() -> usedCount/clickAvg/submitAvg/clickSub/submitSub hardcoded
pukat-app/src/components/playbooks/PlaybookDetailBody.jsx
  StatMini "Used" sub="since Jan 2025" (hardcoded)
```

Kolom relevan di `pukat_campaign_runs` (`includes/Core/Activator.php`): `playbook_master_id` (index), `status`, `metrics_json` (LONGTEXT), `launched_at`, `completed_at`.

## 3. Keputusan Teknis

### 3.1 Jalur agregasi: parse PHP vs denormalisasi kolom

**Dipilih untuk MVP: parse di PHP dengan satu query ber-scope.**

- Satu query membaca hanya `playbook_master_id`, `launched_at`, `metrics_json` dari run yang `launched_at IS NOT NULL`, untuk semua playbook yang sedang dilist (atau seluruhnya lalu difilter per playbook id yang diminta).
- PHP mengelompokkan per `playbook_master_id`, menjumlah `clicked`, `submitted_data`, `total` dari tiap `metrics_json`, dan mengambil `MIN(launched_at)`.
- Alasan: tanpa migration/backfill, dan jumlah run saat ini modest. `metrics_json` tetap tidak dikirim ke frontend — hanya hasil agregasi.

**Alternatif (dicatat untuk §9 PRD, tidak dikerjakan sekarang):** tambah kolom integer denormalisasi (`result_total`, `result_clicked`, `result_submitted`) di `pukat_campaign_runs`, diisi saat `sync()`, sehingga agregasi jadi `SUM/GROUP BY` murni tanpa parse JSON. Lebih tahan skala tetapi butuh migration + backfill run lama.

### 3.2 Bentuk `stats`

```php
[
  'used_count'        => int,     // run dengan launched_at != null
  'first_launched_at' => ?string, // MIN(launched_at), mysql datetime, null bila belum ada
  'tested_run_count'  => int,     // run dengan total > 0
  'click_rate'        => ?float,  // pooled: round(sum_clicked / sum_total * 100, 1), null bila tested_run_count = 0
  'submit_rate'       => ?float,  // pooled: round(sum_submitted / sum_total * 100, 1), null bila tested_run_count = 0
]
```

## 4. Fase 1 — Backend

### 4.1 `CampaignRunRepository`

Tambah metode agregasi, satu query, dipanggil sekali:

```php
/**
 * @param array<int,int> $playbook_ids  Kosong = semua playbook.
 * @return array<int, array{used_count:int, first_launched_at:?string, rows: array<int, array{metrics_json:?string}>}>
 */
public function launched_runs_for_playbooks( array $playbook_ids = [] ): array
```

- `SELECT playbook_master_id, launched_at, metrics_json FROM {campaign_runs} WHERE launched_at IS NOT NULL` (+ `AND playbook_master_id IN (...)` bila id diberikan, pakai placeholder `%d` via `$wpdb->prepare`).
- Tidak `SELECT *` (AGENTS.md §5.2) — hanya tiga kolom.
- Repository mengembalikan baris mentah per playbook; agregasi angka dilakukan di service (business logic), repository tetap tipis.

### 4.2 `PlaybookMasterService`

- Metode baru `private function playbook_stats_map( array $playbook_ids ): array` — panggil repo sekali, lalu untuk tiap `playbook_master_id`: hitung `used_count` (jumlah baris), `first_launched_at` (min), dan dari tiap `metrics_json` yang ter-decode jumlahkan `total`/`clicked`/`submitted_data`, hasilkan `tested_run_count` dan pooled `click_rate`/`submit_rate` (null bila tak ada run ter-test).
- `list()`: kumpulkan id semua playbook yang lolos filter user, panggil `playbook_stats_map()` **sekali**, lalu teruskan map itu ke `prepare_playbook()` (tambah parameter opsional `?array $stats = null`). Hindari memanggil agregasi di dalam loop.
- `get()`: panggil `playbook_stats_map([$id])` untuk satu playbook.
- `prepare_playbook()`: tambahkan `'stats' => $stats ?? $this->empty_stats()` ke array hasil.

### 4.3 Validasi Fase 1

```text
PHP syntax check file yang diubah (via container plugindev_wordpress: php -l)
GET /pukat/v1/playbook-masters          -> tiap item punya `stats`, tanpa metrics_json run mentah
GET /pukat/v1/playbook-masters/{id}     -> `stats` terisi
playbook tanpa run                      -> used_count 0, rate null
playbook dengan run launched tanpa hasil-> used_count >=1, tested_run_count 0, rate null
playbook dengan run berhasil            -> rate pooled benar
cek jumlah query tidak naik linear terhadap jumlah playbook (satu query agregasi)
```

Smoke manual (read-only, tanpa menulis data): panggil endpoint list, cek shape. Tidak ada mutation, jadi tidak melanggar aturan "no mutation tests on real data".

## 5. Fase 2 — Frontend

### 5.1 `pukat-app/src/utils/playbookUiModel.js`

Ganti blok hardcoded dengan turunan dari `row.stats`:

```text
const stats = row.stats || {}
usedCount  = `${stats.used_count ?? 0}x`
usedSub    = stats.first_launched_at ? `since ${formatMonthYear(stats.first_launched_at)}` : 'no runs yet'
tested     = Number(stats.tested_run_count || 0)
clickAvg   = tested > 0 ? `${stats.click_rate}%` : '—'
submitAvg  = tested > 0 ? `${stats.submit_rate}%` : '—'
clickSub   = tested > 0 ? `across ${tested} tested ${tested === 1 ? 'run' : 'runs'}` : 'not tested yet'
submitSub  = clickSub
```

`formatMonthYear` helper kecil (pakai `parseServerDate` dari `utils/serverDate.js` agar konsisten timezone). Tambahkan `usedSub` ke objek yang dikembalikan.

### 5.2 `pukat-app/src/components/playbooks/PlaybookDetailBody.jsx`

- `StatMini label="Used" ... sub={playbook.usedSub}` menggantikan `sub="since Jan 2025"`.
- Dua StatMini lain sudah membaca `playbook.clickSub`/`submitSub`, jadi otomatis ikut.

### 5.3 Validasi Fase 2

```bash
cd pukat-app && npm run lint && npm run test && npm run build   # build diarahkan ke outDir sementara, assets/dist tidak disentuh
```

Manual: buka Playbooks dan modal preview wizard untuk playbook (a) belum dipakai, (b) sudah launch tapi 0 hasil, (c) ada hasil — bandingkan angkanya identik di dua tempat.

## 6. Ringkasan File

Diubah:

```text
includes/Repositories/CampaignRunRepository.php     (query agregasi baru)
includes/Services/PlaybookMasterService.php         (playbook_stats_map, prepare_playbook, list, get)
pukat-app/src/utils/playbookUiModel.js              (baca row.stats + formatMonthYear)
pukat-app/src/components/playbooks/PlaybookDetailBody.jsx (sub Used dari prop)
```

Tidak disentuh: skema/migration (jalur MVP parse-PHP), `assets/dist`, perhitungan metrik per-run di `CampaignRunService`.

## 7. Definition of Done

1. Acceptance criteria PRD §6 terpenuhi.
2. Lint/test/build frontend lulus; PHP syntax check lulus.
3. List playbook tetap satu query agregasi (bukan per playbook), dan tanpa `metrics_json` run di payload.
4. Playbooks page dan modal wizard menampilkan angka yang sama.
