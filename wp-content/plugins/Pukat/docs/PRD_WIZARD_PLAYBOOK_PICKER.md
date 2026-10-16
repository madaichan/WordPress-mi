# PRD: Campaign Wizard — Playbook Picker (Search, Sort, Preview)

Status: Draft
Date: 2026-10-16
Owner: Pukat Product and Engineering
Related area: React frontend (`pukat-app/src/features/campaigns/Wizard/Step2.jsx`, `pukat-app/src/pages/Simulation/Campaigns.jsx`, `pukat-app/src/features/setup/playbooks/Playbooks.jsx`, `pukat-app/src/components/playbooks`)
Related PRD:
- `docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`
- `docs/PRD_REUSABLE_FRONTEND_COMPONENTS.md`
- `docs/PRD_REUSABLE_DATA_TABLE_COMPONENT.md`

## 1. Ringkasan

Menambah tiga kemampuan pada kartu **"Select playbook"** di wizard `New campaign` step 2 ("Performing"), `/pukat/#/campaigns`:

1. **Global search** yang bekerja di kedua view (grid dan table), bukan hanya di table seperti sekarang.
2. **Sort** eksplisit dengan opsi yang bermakna untuk pemilihan playbook (Newest + beberapa opsi lain, lihat Bagian 5).
3. **Preview playbook** lewat modal lebar yang menampilkan detail playbook, memakai ulang komponen section "details" dari halaman Playbooks (`features/setup/playbooks/Playbooks.jsx` → `DetailPanel`).

Scope-nya frontend saja. Tidak ada perubahan REST API, database, permission, atau GoPhish.

## 2. Latar Belakang dan Masalah

### 2.1 Search hanya ada di table view

`Step2.jsx` menyediakan `ViewToggle` grid/table. Table view memakai `DataTable` (`tableKey="wizard_playbooks"`) sehingga dapat toolbar search bawaan, tapi grid view (default) merender `playbooks.map(...)` mentah tanpa search apa pun. Akibatnya user yang memakai view default harus scroll untuk mencari playbook, atau pindah ke table view hanya untuk bisa mencari.

Search di table view juga sempit: `paginateRows(playbooks, state, { searchFields: ['name', 'desc'] })` — tidak mencakup type maupun entity.

### 2.2 Tidak ada kendali urutan

Grid view memakai urutan apa pun yang datang dari API. `PlaybookMasterRepository::all()` memakai `ORDER BY created_at DESC`, jadi grid secara kebetulan sudah "newest first", tapi ini implisit, tidak terlihat user, dan tidak bisa diubah. Table view malah default `sort: 'name', order: 'asc'`, sehingga dua view menampilkan urutan berbeda untuk data yang sama tanpa penjelasan.

### 2.3 Kartu playbook di wizard terlalu dangkal untuk mengambil keputusan

Kartu grid hanya menampilkan `name`, `desc` (2 baris, `line-clamp-2`), status, type, dan difficulty. Informasi yang sebenarnya dibutuhkan sebelum memilih — komponen teknis (email template, landing page, SMTP, dynamic domain), narasi skenario, level difficulty PhishScale, dan status readiness — sudah ada di payload `GET /playbook-masters` (service mengirim `components`, `readiness`, `usage`, `edit_locked`) tapi tidak pernah ditampilkan di wizard. Hari ini user harus membuka halaman Playbooks di tab lain untuk melihatnya, lalu kembali ke wizard.

Halaman Playbooks sudah punya tampilan detail lengkap (`DetailPanel`, `ComponentPreviewCard`, `ComponentRow`, `DifficultyBlock`, `StatMini`), tapi semuanya terkunci sebagai fungsi privat di dalam `Playbooks.jsx` dan tidak bisa dipakai ulang.

## 3. Goals

- User bisa mencari playbook dari grid view maupun table view dengan satu kontrol search yang sama.
- User bisa mengubah urutan playbook secara eksplisit, dengan default yang sama di kedua view.
- User bisa melihat detail lengkap satu playbook tanpa keluar dari wizard, lalu memilihnya langsung dari modal detail itu.
- Section detail playbook jadi satu komponen reusable yang dipakai halaman Playbooks dan wizard, bukan dua implementasi paralel.

## 4. Non-Goals

- Tidak menambah endpoint atau server-driven table untuk playbook picker. Jumlah Playbook Master masih kecil dan `GET /playbook-masters` sudah mengirim seluruh data yang dibutuhkan; search/sort tetap client-side seperti `paginateRows` sekarang.
- Tidak mengubah logic pemilihan, readiness, atau launch chain campaign.
- Tidak mengubah tampilan detail di halaman Playbooks (hanya dipindah lokasi filenya supaya reusable).
- Tidak menambah editing playbook dari dalam wizard. Modal detail bersifat read-only + tombol select.
- Tidak menyentuh `assets/dist`.

## 5. Requirement Fungsional

### 5.1 Global search (F1)

- Satu input search ditaruh di header kartu "Select playbook", berlaku untuk grid dan table view.
- Search debounce 350 ms, konsisten dengan `DataTableToolbar` (`SEARCH_DEBOUNCE_MS`).
- Field yang dicari: `name`, `desc`/`description`, `type` (kategori hasil `playbookTypeFromRow`), `entity`, `objective`/`scenario`, dan `statusLabel`. Pencocokan case-insensitive, substring.
- Nilai search dipakai sebagai satu sumber kebenaran: saat user pindah grid ↔ table, term search tidak hilang dan hasilnya identik.
- Term search dibatasi 100 karakter, mengikuti aturan search di `AGENTS.md` §5.3.
- State no-results punya pesan sendiri ("No playbook matches ...") plus aksi "Clear search", terpisah dari state empty ("No playbook masters found in database.") yang sudah ada.
- Jumlah hasil ditampilkan ("N of M playbooks"), seperti pola di halaman Playbooks.

### 5.2 Sort (F2)

Opsi sort (dropdown tunggal, label user-facing):

| Label | Key | Urutan |
| --- | --- | --- |
| Newest first | `created_at` desc | **Default** |
| Oldest first | `created_at` asc | |
| Recently updated | `updated_at` desc | `updated_at` kosong jatuh ke `created_at` |
| Name A–Z | `name` asc | |
| Name Z–A | `name` desc | |
| Easiest first | `diff` asc | difficulty 1→5 |
| Hardest first | `diff` desc | difficulty 5→1 |
| Ready to launch first | `ready` desc | `readiness.ready` dulu, tie-break `created_at` desc |

Catatan desain:

- "Newest first" jadi default di kedua view, menggantikan default `name asc` di table view, supaya grid dan table tidak lagi berbeda urutan.
- "Ready to launch first" adalah opsi yang paling berguna secara operasional: playbook yang `readiness.ready === false` akan ditolak backend saat launch (`playbook_not_ready`), jadi menaikkannya ke atas mencegah user memilih playbook yang pasti gagal.
- "Most used" (dari `usage.active_campaign_run_count`) **tidak** masuk fase ini: angka itu hanya menghitung campaign run yang sedang aktif, bukan histori pemakaian, jadi labelnya akan menyesatkan. Masuk kandidat fase berikutnya kalau metrik pemakaian historis sudah tersedia.
- Sort dan search memakai state yang sama untuk kedua view; kolom `sortable` di table view tetap bekerja dan hanya mengubah state yang sama itu.

### 5.3 Preview playbook (F3)

- Setiap kartu grid punya tombol **Preview** (ikon `ti-eye`); table view mendapat kolom aksi Preview yang setara.
- Preview membuka **Modal lebar** (`Modal` + `className="max-w-5xl"`), judul nama playbook, isi read-only:
  - Header: nama, deskripsi, tag status/category/difficulty/entity/GoPhish/locked.
  - Technical components: email template dan landing page sebagai preview card dengan thumbnail (`ComponentPreviewCard` + `HtmlThumbnail`), SMTP dan dynamic domain sebagai baris (`ComponentRow`).
  - Difficulty level (PhishScale NIST block).
  - Attack scenario (narasi + vulnerable targets).
  - Insights.
  - Readiness: kalau `readiness.ready === false`, tampilkan daftar `readiness.errors` sebagai blok warning, supaya user tahu playbook ini belum bisa dilaunch sebelum memilihnya.
- Tombol Preview di dalam komponen email/landing page tetap berfungsi: membuka `PlaybookPreviewModal` di atas modal detail (`PlaybookPreviewModal` memakai `z-[60]`, di atas `.modal-backdrop` `z-50`).
- Footer modal: **Select this playbook** (menutup modal dan menyetel `form.playbook`) dan **Close**. Kalau playbook itu sudah terpilih, tombol tampil sebagai "Selected" dan disabled.
- Isi modal dirender dari komponen yang sama dengan section details halaman Playbooks. Halaman Playbooks harus tetap terlihat dan berperilaku persis seperti sekarang setelah komponen itu dipindah.

### 5.4 Interaksi dan aksesibilitas (F4)

- Kartu grid saat ini adalah satu `<button>`. Tombol Preview tidak boleh ditaruh di dalamnya (nested button = HTML invalid dan perilaku klik tidak jelas). Kartu harus dipecah: container `div`, satu tombol select yang menutupi area kartu, dan tombol Preview terpisah.
- `aria-pressed` pada tombol select tetap dipertahankan.
- Modal bisa ditutup dengan klik backdrop (sudah jadi perilaku `Modal`) dan tombol Close.
- Search dan sort tetap muncul saat hasil kosong karena search, tapi disembunyikan kalau database memang tidak punya playbook sama sekali — supaya kontrol tidak nongol di atas empty state.

## 6. Dampak pada Custom Campaign Mode

Tidak ada. Kartu "Select playbook" hanya dirender saat `form.mode === 'playbook'`; mode custom tetap memakai `PlaybookComponentSelect`.

## 7. Acceptance Criteria

1. Di grid view, mengetik di search mempersempit kartu yang tampil; mengosongkan search memulihkan seluruh daftar.
2. Search term dan pilihan sort bertahan saat toggle grid ↔ table, dan kedua view menampilkan himpunan serta urutan baris yang sama.
3. Default sort kedua view adalah "Newest first".
4. Memilih "Ready to launch first" menaikkan semua playbook dengan `readiness.ready === true` ke atas.
5. Tombol Preview pada kartu **tidak** mengubah playbook yang terpilih.
6. Modal preview menampilkan komponen teknis, difficulty, skenario, insight, dan — kalau ada — daftar error readiness.
7. Preview email/landing page dari dalam modal detail tampil penuh di atas modal, dan menutupnya kembali ke modal detail (bukan menutup keduanya).
8. "Select this playbook" dari modal menyetel playbook terpilih dan menutup modal; tombol "Continue to review" lalu aktif.
9. Halaman Playbooks (`/pukat/#/playbooks`) tidak berubah secara visual maupun fungsional.
10. `npm run lint`, `npm run build`, dan `npm run test` di `pukat-app` lulus.

## 8. Risiko

| Risiko | Mitigasi |
| --- | --- |
| Memindahkan `DetailPanel` dan helper-nya keluar dari `Playbooks.jsx` berisiko regresi halaman Playbooks | Pindah tanpa mengubah markup; `DetailPanel` tetap tinggal di `Playbooks.jsx` sebagai wrapper aksi, hanya body detail yang dipindah |
| Mapper detail (`playbookMasterToUiPlaybook`) butuh master assets + component options | `Campaigns.jsx` sudah query keempat master asset itu untuk custom mode; tidak ada query baru |
| Memetakan seluruh playbook ke UI model (termasuk HTML preview) bisa berat | Model detail dihitung lazy, hanya untuk playbook yang sedang di-preview |
| Grid tanpa pagination bisa panjang kalau playbook banyak | Di luar scope fase ini; search + sort sudah mengurangi masalahnya. Catat sebagai kandidat berikutnya (grid "show more") |

## 9. Fase Berikutnya (tidak dikerjakan sekarang)

- Filter chip Type / Status / Entity, dan toggle "Ready only" di picker.
- Sort "Most used" berbasis histori pemakaian playbook yang sebenarnya.
- Grid pagination / "show more".
