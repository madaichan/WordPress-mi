# Implementation Plan: Campaign Wizard — Playbook Picker (Search, Sort, Preview)

Status: Fase 1–3 implemented (butuh verifikasi manual di browser)
Date: 2026-10-16
Owner: Pukat Product and Engineering

Related PRD:
- `docs/PRD_WIZARD_PLAYBOOK_PICKER.md`
- `docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`

Related implementation plan:
- `docs/IMPLEMENTATION_PLAN_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`
- `docs/IMPLEMENTATION_PLAN_FRONTEND_REUSE_AND_SERVER_DRIVEN_TABLE.md`

## 0. Status Implementasi

| Fase | Status | Catatan |
| --- | --- | --- |
| Fase 1 — ekstraksi reusable | Selesai | `playbookUiModel.js`, `PlaybookDetailBody.jsx`, `SearchInput.jsx`; `DetailPanel` halaman Playbooks jadi wrapper |
| Fase 2 — search + sort | Selesai | satu `playbookPickerState` untuk grid dan table, 17 unit test baru |
| Fase 3 — modal preview | Selesai | `PlaybookDetailModal.jsx`, tombol Preview di kartu grid dan baris table |

Validasi otomatis: `eslint src` bersih (satu warning lama di `pages/Simulation/Performing.jsx` yang sudah ada sebelum perubahan ini), `vitest run` 111 test lulus, `vite build` sukses. Build sengaja diarahkan ke direktori sementara supaya `assets/dist` tidak tersentuh (AGENTS.md §3) — untuk melihat hasilnya di `http://localhost:8080` perlu `npm run build` atau `npm run dev` yang dijalankan sengaja.

Belum dikerjakan: verifikasi manual di browser sesuai checklist §4.5 dan §5.4.

## 1. Ringkasan

Frontend-only. Tiga fase berurutan, tiap fase bisa direview dan dimerge sendiri:

```text
Fase 1  Ekstraksi reusable (tanpa perubahan perilaku)
Fase 2  Search + sort pada playbook picker (F1, F2)
Fase 3  Modal preview detail playbook (F3, F4)
```

Urutan ini dipilih supaya pekerjaan paling berisiko regresi (memindahkan kode detail panel milik halaman Playbooks) selesai dan terverifikasi lebih dulu, sebelum ada fitur baru yang menumpuk di atasnya.

## 2. Current State (hasil pembacaan kode)

```text
pukat-app/src/features/campaigns/Wizard/Step2.jsx            -- Campaign mode, Select playbook (grid + DataTable), Sending schedule
pukat-app/src/pages/Simulation/Campaigns.jsx                 -- orchestration: usePlaybooks, master assets, playbookMasterToWizardCard, componentOptions
pukat-app/src/features/setup/playbooks/Playbooks.jsx         -- 1628 baris; berisi playbookMasterToUiPlaybook, DetailPanel, ComponentRow, ComponentPreviewCard, DifficultyBlock, StatMini, Tag, CATEGORY_META
pukat-app/src/components/playbooks/PlaybookFormControls.jsx  -- PlaybookComponentSelect, PlaybookPreviewModal, EmailPreview, LandingPreview
pukat-app/src/components/DataTable/DataTableToolbar.jsx      -- search debounce 350 ms + filter select
pukat-app/src/utils/clientTableState.js                      -- paginateRows(rows, state, { searchFields })
pukat-app/src/utils/playbookComponentOptions.js              -- playbookComponentOptions(), option label/description/preview
pukat-app/src/components/UI/Modal.jsx                        -- Modal(open, onClose, title, subtitle, icon, footer, className)
pukat-app/src/index.css                                      -- .modal = max-w-lg (dilebarkan per-pemakaian lewat className)
```

Fakta penting yang sudah dikonfirmasi:

- `PlaybookMasterRepository::all()` memakai `SELECT * ... ORDER BY created_at DESC`, dan `PlaybookMasterService::prepare_playbook()` menambahkan `components`, `readiness`, `usage`, `edit_locked`, `edit_lock_reason`. Jadi `created_at`, `updated_at`, `entity`, `difficulty`, `objective`, `scenario`, dan readiness **sudah tersedia di response list** — tidak perlu endpoint atau field baru.
- `playbookMasterToWizardCard()` (`Campaigns.jsx:109`) menyimpan baris mentah di `raw`, tapi tidak mengekspos `created_at`/`updated_at`/`entity` sebagai field kartu.
- `Campaigns.jsx` sudah memanggil `useMasterEmailTemplates`, `useMasterLandingPages`, `useMasterSendingProfiles`, `useMasterDynamicDomains`, `useGophishSmtpProfiles` dan membangun `componentOptions` untuk custom mode — tepat input yang dibutuhkan `playbookMasterToUiPlaybook`.
- Kartu grid di `Step2.jsx` adalah satu elemen `<button>`; tombol Preview tidak boleh disarangkan di dalamnya.
- `PlaybookPreviewModal` memakai `z-[60]`, `.modal-backdrop` memakai `z-50` — preview komponen otomatis tampil di atas modal detail.

## 3. Fase 1 — Ekstraksi reusable (tanpa perubahan perilaku)

Tujuan: menyiapkan bahan untuk Fase 2–3 tanpa mengubah UI mana pun.

### 3.1 `pukat-app/src/utils/playbookUiModel.js` (baru)

Pindahkan dari `Playbooks.jsx` apa adanya:

```text
CATEGORY_META, DIFFICULTY_TEXT, CATEGORY_TAG, DIFFICULTY_TAG, STATUS_TAG
categoryFromText(), difficultyNumber()
findAssetById(), findEmailTemplateByVersionId(), findLandingPageByVersionId()
playbookMasterToUiPlaybook(row, assets, componentOptions)
```

`Playbooks.jsx` mengimpor balik dari modul ini. Tidak ada perubahan logic.

### 3.2 `pukat-app/src/components/playbooks/PlaybookDetailBody.jsx` (baru)

Pindahkan presentational pieces dari `Playbooks.jsx`:

```text
Tag, StatMini, DifficultyBlock, ComponentRow, ComponentPreviewCard   (di-export)
PlaybookDetailBody({ playbook, onPreviewComponent, header, actions }) (baru, hasil ekstraksi isi DetailPanel)
```

`PlaybookDetailBody` berisi urutan section yang ada sekarang: header (nama, deskripsi, tag), stats, Technical components, Difficulty level, Attack scenario, Insights. Slot `actions` menampung tombol-tombol spesifik halaman (Use this playbook / Duplicate / Edit / Submit for review / Approve) sehingga wizard bisa memberi footer berbeda.

`DetailPanel` tetap tinggal di `Playbooks.jsx` sebagai wrapper: empty state + permission gating + `actions`, lalu merender `PlaybookDetailBody`. Markup hasil render harus identik dengan sekarang.

### 3.3 `pukat-app/src/components/UI/SearchInput.jsx` (baru)

Input search dengan ikon + debounce (default 350 ms), diekstrak dari `DataTableToolbar`:

```text
SearchInput({ value, onChange, placeholder, debounceMs = 350, maxLength = 100, className })
```

`DataTableToolbar.jsx` direfactor memakainya supaya debounce search hanya hidup di satu tempat. Markup dijaga sama agar `DataTable.test.jsx` tetap lulus.

### 3.4 Verifikasi Fase 1

```bash
cd pukat-app && npm run lint && npm run test && npm run build
```

Manual: buka `/pukat/#/playbooks`, bandingkan dengan sebelum perubahan — list, detail panel, preview komponen, slideover create/edit, approve/submit, lock badge.

## 4. Fase 2 — Search dan sort (F1, F2)

### 4.1 `pukat-app/src/utils/playbookPickerState.js` (baru)

```text
PLAYBOOK_PICKER_SEARCH_FIELDS = ['name', 'desc', 'type', 'entity', 'scenario', 'statusLabel']
PLAYBOOK_SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest first',          sort: 'createdAt', order: 'desc' },
  { value: 'oldest',   label: 'Oldest first',          sort: 'createdAt', order: 'asc'  },
  { value: 'updated',  label: 'Recently updated',      sort: 'updatedAt', order: 'desc' },
  { value: 'name_asc', label: 'Name A–Z',              sort: 'name',      order: 'asc'  },
  { value: 'name_desc',label: 'Name Z–A',              sort: 'name',      order: 'desc' },
  { value: 'diff_asc', label: 'Easiest first',         sort: 'diff',      order: 'asc'  },
  { value: 'diff_desc',label: 'Hardest first',         sort: 'diff',      order: 'desc' },
  { value: 'ready',    label: 'Ready to launch first', sort: 'ready',     order: 'desc' },
]
DEFAULT_PLAYBOOK_PICKER_STATE = { search: '', sort: 'createdAt', order: 'desc', page: 1, perPage: 10, filters: {} }
sortOptionFromState(state) -> value dropdown
stateFromSortOption(state, value) -> state baru (page direset ke 1)
filterPlaybooks(playbooks, search) -> hasil search (substring, case-insensitive, multi-field)
sortPlaybooks(playbooks, state) -> hasil sort dengan tie-break createdAt desc; `ready` memakai boolean desc
```

`sortPlaybooks` tidak memakai `paginateRows` untuk pengurutan karena butuh tie-break dan perbandingan boolean/numerik yang tidak didukung comparator generik di `clientTableState.js`. Untuk table view, pagination tetap lewat `paginateRows`, dipanggil setelah filter+sort (`paginateRows` dipanggil dengan `state` tanpa `search`/`sort` agar tidak dobel kerja).

Test baru: `pukat-app/src/utils/playbookPickerState.test.js` — search multi-field, case-insensitive, sort tiap opsi, tie-break, `ready` desc, state kosong.

### 4.2 `playbookMasterToWizardCard()` di `Campaigns.jsx`

Tambahkan field turunan yang dibutuhkan search/sort (tanpa menghapus field lama):

```text
entity      <- row.entity || 'General'
scenario    <- row.objective || row.scenario || ''
createdAt   <- row.created_at || ''
updatedAt   <- row.updated_at || row.created_at || ''
ready       <- Boolean(row.readiness?.ready)
```

### 4.3 `pukat-app/src/components/playbooks/PlaybookPickerToolbar.jsx` (baru)

```text
PlaybookPickerToolbar({ search, onSearchChange, sortValue, onSortChange, resultCount, totalCount })
```

`SearchInput` + `Select` (opsi dari `PLAYBOOK_SORT_OPTIONS`) + teks "N of M playbooks". Komponen murni presentational, props-in/callback-out sesuai `AGENTS.md` §4.2.

### 4.4 `Step2.jsx`

- Ganti `playbookTableState` menjadi satu `playbookPickerState` (default `DEFAULT_PLAYBOOK_PICKER_STATE`) yang dipakai grid **dan** table.
- Render `PlaybookPickerToolbar` di bawah header kartu "Select playbook" (hanya kalau `playbooks.length > 0`).
- `visiblePlaybooks = useMemo(() => sortPlaybooks(filterPlaybooks(playbooks, state.search), state), [...])`.
- Grid: `visiblePlaybooks.map(...)`.
- Table: `DataTable` menerima `paginateRows(visiblePlaybooks, { ...state, search: '', sort: '' })`, dan `schema.search` dihapus supaya tidak ada dua kotak search (toolbar picker jadi satu-satunya).
- Header kolom `sortable` tetap aktif dan menulis ke state yang sama; dropdown sort ikut berubah lewat `sortOptionFromState`.
- Tambah state no-results di grid dan biarkan `DataTable` memakai no-results bawaannya di table view.

### 4.5 Verifikasi Fase 2

```bash
cd pukat-app && npm run lint && npm run test && npm run build
```

Manual di `/pukat/#/campaigns` (step 2, mode Use playbook): search di grid, toggle grid ↔ table (term dan urutan bertahan), tiap opsi sort, no-results + clear, lalu pastikan "Continue to review" masih gated oleh `form.playbook`.

## 5. Fase 3 — Modal preview detail playbook (F3, F4)

### 5.1 `pukat-app/src/features/campaigns/Wizard/PlaybookDetailModal.jsx` (baru)

```text
PlaybookDetailModal({ playbook, selected, onSelect, onClose, onPreviewComponent })
```

- `Modal` dengan `className="max-w-5xl"`, `title` nama playbook, `subtitle` entity + status.
- Body: blok readiness (kalau `readiness.ready === false`, render `readiness.errors`) lalu `PlaybookDetailBody`.
- Footer: "Select this playbook" (atau "Selected", disabled, kalau sudah terpilih) + "Close".
- Tidak memanggil mutation apa pun; murni read-only + callback.

### 5.2 `Campaigns.jsx`

- Satukan master assets jadi satu objek `masterAssets` (pola yang sudah dipakai `Playbooks.jsx:1159`).
- State baru `previewPlaybookId`, diturunkan ke `Step2` bersama callback-nya, atau dikelola di `Step2` dengan `masterAssets`/`componentOptions` sebagai props — pilih yang kedua agar `Campaigns.jsx` tidak bertambah state; `masterAssets` dikirim sebagai prop baru ke `Step2`.
- Model detail dihitung **lazy** hanya untuk playbook yang di-preview:

```js
const detailPlaybook = useMemo(
  () => (previewId ? playbookMasterToUiPlaybook(rawById(previewId), masterAssets, componentOptions) : null),
  [previewId, masterAssets, componentOptions],
)
```

  `rawById` memakai `playbook.raw` dari kartu wizard, jadi tidak ada fetch tambahan.

### 5.3 `Step2.jsx`

- Pecah kartu grid: container `div` + tombol select (area kartu) + tombol Preview terpisah di pojok. Tidak ada `<button>` bersarang.
- Tambah kolom aksi Preview di `playbookColumns` (renderer `custom`), di samping kolom Select yang sudah ada.
- State lokal `previewPlaybookId` + `componentPreview`; render `PlaybookDetailModal` dan `PlaybookPreviewModal` (untuk preview email/landing dari dalam detail).
- "Select this playbook" memanggil `setForm(f => ({ ...f, playbook: id }))` lalu menutup modal.

### 5.4 Verifikasi Fase 3

```bash
cd pukat-app && npm run lint && npm run test && npm run build
```

Manual:

```text
klik Preview di kartu grid         -> modal lebar terbuka, playbook terpilih TIDAK berubah
klik Preview di baris table        -> modal yang sama
Preview email di dalam modal       -> ClientPreview tampil di atas modal; close kembali ke modal detail
Preview landing page               -> LandingHtmlPreview tampil; close kembali ke modal detail
Select this playbook               -> modal tertutup, kartu jadi selected, Continue aktif
playbook dengan readiness false    -> daftar error readiness tampil di modal
klik backdrop / Close              -> modal tertutup tanpa mengubah pilihan
/pukat/#/playbooks                 -> tidak ada regresi
```

## 6. Ringkasan File

Baru:

```text
pukat-app/src/utils/playbookUiModel.js
pukat-app/src/utils/playbookPickerState.js
pukat-app/src/utils/playbookPickerState.test.js
pukat-app/src/components/UI/SearchInput.jsx
pukat-app/src/components/playbooks/PlaybookDetailBody.jsx
pukat-app/src/components/playbooks/PlaybookPickerToolbar.jsx
pukat-app/src/features/campaigns/Wizard/PlaybookDetailModal.jsx
```

Diubah:

```text
pukat-app/src/features/campaigns/Wizard/Step2.jsx
pukat-app/src/pages/Simulation/Campaigns.jsx
pukat-app/src/features/setup/playbooks/Playbooks.jsx     (import dari modul baru; DetailPanel jadi wrapper)
pukat-app/src/components/DataTable/DataTableToolbar.jsx  (pakai SearchInput)
pukat-app/src/components/UI/index.js                     (export SearchInput, kalau barrel ini dipakai)
```

Tidak disentuh: seluruh `includes/` (PHP), database/migration, `assets/dist`, `package.json`.

## 7. Risiko dan Mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Regresi halaman Playbooks saat ekstraksi | Fase 1 dipisah dan diverifikasi manual sebelum fitur baru masuk; markup dipindah tanpa diubah |
| Dua kotak search di table view | `schema.search` di `DataTable` wizard dihapus; toolbar picker jadi satu-satunya search |
| Header sort table dan dropdown sort tidak sinkron | Keduanya menulis/membaca satu `playbookPickerState`; `sortOptionFromState` memetakan balik ke dropdown (fallback label "Custom" kalau kombinasi tidak ada di daftar) |
| Nested button pada kartu grid | Kartu direstrukturisasi jadi `div` + dua tombol sejajar |
| Biaya render `HtmlThumbnail`/iframe | Model detail dan modal hanya dibuat saat preview dibuka (lazy), tidak untuk semua kartu |
| Grid bisa panjang kalau playbook banyak | Di luar scope; dicatat di PRD §9 |

## 8. Definition of Done

1. Acceptance criteria PRD §7 terpenuhi semua.
2. `npm run lint`, `npm run test`, `npm run build` di `pukat-app` lulus.
3. Halaman Playbooks terbukti tidak berubah (cek manual sesuai §3.4).
4. Tidak ada perubahan di `includes/`, migration, atau `assets/dist`.
