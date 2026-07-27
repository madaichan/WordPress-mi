# PRD: Reusable Frontend Components

Status: Draft
Date: 2026-07-27
Owner: Pukat Product and Engineering
Related area: React frontend, asset management pages, admin master pages, simulation workspace
Related PRD: `docs/PRD_ASSET_ACCESS_AND_VERSIONING.md`

## 1. Ringkasan

Frontend Pukat sudah memiliki komponen UI dasar seperti button, badge, tabs, drawer, table, dan page header. Namun, beberapa halaman produk masih menyimpan komponen besar langsung di dalam file page. Pola ini membuat UI sulit direuse, perilaku antar halaman mudah berbeda, dan refactor menjadi mahal karena perubahan kecil harus dilakukan di banyak tempat.

PRD ini menetapkan arah reusable component untuk frontend Pukat agar page berperan sebagai orchestration layer, sedangkan UI yang berulang dipindahkan ke komponen presentational atau feature component yang dapat digunakan lintas Admin dan Simulation.

Baseline awal yang terlihat di source saat PRD ini dibuat:

- Enam halaman asset utama memiliki total sekitar 4.460 baris kode.
- Komponen inline yang berulang mencakup `BrowserPreview`, `SmtpSlideover`, `CreateCard`, `ThumbnailMockup`, form field SMTP, lock badge, dan action row.
- Halaman Admin dan Simulation memiliki pola UI serupa tetapi tidak memakai shared component yang sama.

## 2. Latar Belakang

Pukat mengelola reusable asset seperti email template, landing page, sending profile, dan playbook. Secara produk, asset tersebut memang reusable, tetapi struktur frontend belum sepenuhnya mencerminkan konsep tersebut.

Contoh masalah yang muncul:

```text
Admin Master Landing Pages punya BrowserPreview sendiri
Simulation Landing Pages punya BrowserPreview sendiri
Admin Master Sending Profiles punya SmtpSlideover sendiri
Simulation Sending Profiles punya SmtpSlideover sendiri
```

Akibatnya:

- Perubahan tampilan atau behavior harus diulang di banyak file.
- Validasi permission, locked state, dan action disabled rawan tidak konsisten.
- File page menjadi terlalu besar dan sulit dibaca.
- Reusable concept produk belum terlihat di struktur kode.

## 3. Tujuan

- Membuat arsitektur komponen frontend yang reusable, konsisten, dan mudah dirawat.
- Mengurangi duplikasi UI lintas halaman Admin dan Simulation.
- Memisahkan presentational component, feature component, page orchestration, hooks, API, dan utility.
- Menjaga behavior existing tetap sama selama refactor.
- Membuat halaman asset lebih mudah dikembangkan untuk requirement access control dan versioning.
- Menyediakan component contract yang jelas untuk permission, locked state, action callback, loading state, dan empty state.

## 4. Non-Tujuan

- Mendesain ulang visual aplikasi secara besar-besaran.
- Mengubah backend, database, permission API, atau GoPhish integration.
- Migrasi React ke TypeScript.
- Membuat design system publik yang lengkap.
- Mengganti Tailwind atau icon set yang sedang digunakan.
- Menggabungkan semua halaman menjadi satu generic component besar yang sulit dipahami.

## 5. Scope

### 5.1 In Scope

Halaman target awal:

```text
src/pages/Admin/MasterEmailTemplates.jsx
src/pages/Admin/MasterLandingPages.jsx
src/pages/Admin/MasterSendingProfiles.jsx
src/pages/Simulation/EmailTemplates.jsx
src/pages/Simulation/LandingPages.jsx
src/pages/Simulation/SendingProfiles.jsx
```

Komponen target awal:

- Shared browser preview untuk landing page HTML.
- Shared SMTP profile drawer/slideover.
- Shared asset card shell untuk email template dan landing page.
- Shared create card.
- Shared asset action group untuk edit, preview, delete, duplicate, assign, dan test.
- Shared locked/assignment/entity visual helpers.
- Shared editor page layout untuk metadata panel dan editor/preview panel.
- Shared search/filter toolbar jika variasinya bisa disatukan tanpa memaksa.

### 5.2 Out of Scope untuk Fase Awal

- Refactor semua dashboard/report/campaign page.
- Mengubah data-fetching hooks.
- Mengubah payload builder atau mapper utility.
- Membuat component library documentation site.
- Mengganti test framework.

## 6. Prinsip Desain Komponen

### 6.1 Page Sebagai Orchestrator

Page bertanggung jawab untuk:

- Memanggil query dan mutation hooks.
- Mengatur state halaman seperti selected item, active tab, search, filter, drawer mode, dan modal.
- Menghubungkan data ke callback.
- Menentukan permission berdasarkan current user dan backend response.

Page tidak ideal untuk:

- Menyimpan markup card/table/drawer besar yang bisa dipakai ulang.
- Menyimpan style detail yang berulang.
- Menyimpan UI behavior yang sama di beberapa halaman.

### 6.2 Feature Component untuk Domain Pukat

Komponen yang spesifik domain asset diletakkan di area feature, bukan di `components/UI`.

Rekomendasi struktur:

```text
src/features/assets/components/
  AssetActionGroup.jsx
  AssetCard.jsx
  AssetCreateCard.jsx
  AssetEditorLayout.jsx
  AssetLockBadge.jsx
  BrowserPreview.jsx
  SmtpProfileDrawer.jsx
  index.js
```

`components/UI` tetap untuk primitive generik seperti `Button`, `Badge`, `Drawer`, `Tabs`, `Table`, `Modal`, `Input`, dan `Select`.

### 6.3 Presentational First

Reusable component harus menerima data dan callback melalui props. Komponen tidak mengambil data sendiri kecuali memang dibuat sebagai container khusus.

Contoh arah contract:

```text
<SmtpProfileDrawer
  mode={mode}
  form={form}
  saving={saving}
  locked={locked}
  entityLocked={entityLocked}
  onChange={updateForm}
  onSubmit={submitProfile}
/>
```

### 6.4 Reusable Bukan Terlalu Generic

Komponen dibuat reusable ketika ada pola nyata yang berulang. Jangan membuat satu komponen super-generic untuk semua jenis asset jika hasilnya lebih sulit dibaca dibanding komponen kecil yang jelas.

Komponen boleh punya variasi melalui props, tetapi variasi tersebut harus mewakili kebutuhan produk yang stabil.

## 7. Component Taxonomy

### 7.1 UI Primitive

Lokasi:

```text
src/components/UI/
```

Kriteria:

- Tidak tahu domain Pukat.
- Tidak tahu email template, landing page, sending profile, playbook, role, atau GoPhish.
- Bisa dipakai di banyak fitur.

Contoh:

- `Button`
- `Badge`
- `Drawer`
- `Modal`
- `Tabs`
- `Table`
- `Input`
- `Select`

### 7.2 Domain Presentational Component

Lokasi:

```text
src/features/assets/components/
```

Kriteria:

- Tahu domain asset Pukat.
- Tidak memanggil API/hook.
- Menerima data siap render.
- Mengeluarkan event lewat callback.

Contoh:

- `AssetCard`
- `AssetCreateCard`
- `AssetActionGroup`
- `AssetLockBadge`
- `BrowserPreview`
- `SmtpProfileDrawer`

### 7.3 Feature Container

Lokasi:

```text
src/features/assets/
```

Kriteria:

- Boleh menggabungkan beberapa domain component.
- Boleh mengatur state lokal fitur jika dipakai ulang lintas page.
- Tetap tidak menggantikan page routing.

Contoh kandidat fase berikutnya:

- `EmailTemplateWorkspace`
- `LandingPageWorkspace`
- `SendingProfileWorkspace`

### 7.4 Page

Lokasi tetap:

```text
src/pages/Admin/
src/pages/Simulation/
```

Kriteria:

- Entry point route.
- Mengatur role/context page.
- Memanggil hooks dan mutation.
- Merakit layout dari reusable component.

## 8. Functional Requirements

### 8.1 Shared Browser Preview

Komponen browser preview harus:

- Menerima `html`, `redirectUrl`, dan optional `title`.
- Menyediakan viewport desktop, tablet, dan mobile.
- Merender iframe sandbox untuk HTML landing page.
- Dipakai oleh Admin Master Landing Pages dan Simulation Landing Pages.
- Memiliki styling konsisten tanpa copy-paste markup.

Acceptance:

- Tidak ada lagi duplikasi `function BrowserPreview` di halaman landing page.
- Perubahan label viewport cukup dilakukan di satu file.

### 8.2 Shared SMTP Profile Drawer

Komponen SMTP drawer harus:

- Menerima mode `create`, `update`, atau `dup`.
- Menerima `form`, `changed`, `saving`, `testing`, `testResult`, `showPassword`.
- Mendukung `locked` dan `lockReason`.
- Mendukung `entityLocked` untuk non-admin.
- Menerima callback `onChange`, `onHeaderChange`, `onAddHeader`, `onRemoveHeader`, `onRunTest`, `onSubmit`, `onDelete`, dan `onClose`.
- Menggunakan primitive `Drawer` dan `Button`.

Acceptance:

- Tidak ada lagi duplikasi `function SmtpSlideover` di Admin dan Simulation.
- Behavior locked state tetap sama.
- Non-admin tetap tidak bisa mengubah entity jika `entityLocked = true`.

### 8.3 Shared Asset Card

Komponen asset card harus:

- Mendukung asset email template dan landing page.
- Menampilkan thumbnail, title, description/meta, entity, lock badge, dan optional chips.
- Menerima daftar action yang dirender oleh `AssetActionGroup`.
- Mendukung create card sebagai komponen terpisah.

Acceptance:

- `EmailTemplateCard`, `LandingPageCard`, dan `CreateCard` tidak lagi diulang dengan markup button yang sama.
- Action disabled dan tooltip locked konsisten.

### 8.4 Shared Asset Action Group

Komponen action group harus:

- Mendukung action umum: edit, preview, delete, duplicate, assign, test.
- Menerima config action dalam array.
- Menggunakan icon button atau compact text button sesuai konteks.
- Menerapkan `disabled`, `title`, `aria-label`, dan tone secara konsisten.

Acceptance:

- Edit/delete/preview button card tidak ditulis ulang manual di setiap page.
- Table action tetap bisa memakai `TableActionButton` jika konteksnya table.

### 8.5 Shared Editor Layout

Komponen editor layout harus:

- Menyediakan header editor dengan title, subtitle, cancel, dan save action.
- Menyediakan panel kiri untuk metadata.
- Menyediakan panel kanan untuk editor/preview.
- Tidak mengunci field spesifik agar email template dan landing page tetap bisa punya form berbeda.

Acceptance:

- Struktur editor dua kolom tidak diulang penuh di setiap page.
- Copy label dan form field tetap dapat berbeda sesuai domain.

## 9. Permission dan State Requirements

Reusable component tidak boleh menentukan permission sendiri dari role global. Permission harus dikirim dari page atau container sebagai props.

Props minimum untuk action:

```text
{
  key: 'edit',
  label: 'Edit',
  icon: 'ti-edit',
  tone: 'gray',
  disabled: item.editLocked || !canEdit,
  title: item.editLocked ? lockReason : 'Edit',
  onClick: () => onEdit(item.id)
}
```

Alasan:

- Backend tetap source of truth.
- Page tetap tahu context Admin vs Simulation.
- Komponen reusable tidak bergantung pada store global.

## 10. UX Requirements

- UI setelah refactor harus terlihat sama atau lebih konsisten.
- Tidak boleh ada perubahan wording besar tanpa kebutuhan produk.
- Empty state, loading state, dan disabled state harus tetap jelas.
- Button icon harus tetap memiliki `aria-label` atau visible label.
- Drawer harus bisa ditutup melalui close button dan backdrop.
- Layout harus tetap responsif untuk desktop dan mobile.

## 11. Technical Requirements

- Tetap menggunakan React 18, Vite, Tailwind, dan dependency yang sudah ada.
- Tidak menambah dependency baru untuk refactor MVP.
- Reusable component menggunakan named/default export yang konsisten.
- Tambahkan `index.js` pada folder feature component untuk import yang bersih.
- Hindari side effect di presentational component.
- Hindari komponen yang melakukan mutation langsung.
- Gunakan helper existing seperti `masterAssetLockMessage`, mapper asset, dan payload builder di page/container, bukan di primitive UI.
- Jangan menyentuh `assets/dist` sebagai bagian dari refactor source, kecuali build/deploy memang diminta.

## 12. Success Metrics

Target kuantitatif untuk fase awal:

- Menghapus duplikasi `BrowserPreview` menjadi satu komponen.
- Menghapus duplikasi `SmtpSlideover` menjadi satu komponen.
- Mengurangi total baris pada enam halaman target minimal 15 persen tanpa menghapus behavior.
- Semua halaman target tetap lulus build.
- Tidak ada regression untuk create, edit, preview, delete, assign, duplicate, dan test SMTP.

Target kualitatif:

- Developer baru bisa memahami halaman asset dari orchestration flow, bukan membaca markup panjang.
- Perubahan visual umum bisa dilakukan di satu component file.
- Admin dan Simulation memakai bahasa UI dan state behavior yang konsisten.

## 13. Rollout Plan

### Phase 1: Audit dan Component Map

- Petakan komponen inline yang berulang.
- Tentukan mana yang menjadi UI primitive, domain component, atau tetap page-local.
- Buat daftar prop contract sebelum edit source.

Output:

- Component map.
- Final implementation plan.

### Phase 2: Extract Low-Risk Leaf Components

- Extract `BrowserPreview`.
- Extract lock/entity visual helpers jika perlu.
- Extract `AssetCreateCard`.

Output:

- Duplikasi kecil hilang.
- Build tetap lulus.

### Phase 3: Extract Complex Components

- Extract `SmtpProfileDrawer`.
- Extract `AssetActionGroup`.
- Extract `AssetCard`.

Output:

- Halaman Admin dan Simulation memakai component yang sama untuk flow besar.
- Behavior locked/entity permission tetap sama.

### Phase 4: Simplify Pages

- Rapikan halaman target agar page hanya berisi query, state, memoized data, handler, dan composition.
- Hindari perubahan behavior API.

Output:

- File page lebih pendek dan lebih mudah ditinjau.

### Phase 5: Verification

- Jalankan lint/build/test yang tersedia.
- Lakukan smoke test manual untuk halaman target.
- Verifikasi create/edit/preview/delete/assign/test SMTP.

Output:

- Hasil verifikasi terdokumentasi di implementation summary.

## 14. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Komponen terlalu generic | Sulit dipakai dan dibaca | Extract berdasarkan pola nyata, bukan abstraksi spekulatif |
| Behavior Admin dan Simulation tercampur | Permission regression | Permission dikirim via props dari page |
| Refactor terlalu besar dalam satu PR | Review sulit | Kerjakan bertahap per component group |
| Visual regression kecil terlewat | UX tidak konsisten | Screenshot/smoke test halaman target |
| Build output ikut berubah | Diff membesar | Jangan build dist kecuali diminta |

## 15. Open Questions

- Apakah folder final untuk domain component akan memakai `src/features/assets/components/` atau `src/components/Assets/`?
- Apakah page master dan non-master akan tetap dipertahankan sebagai page terpisah setelah refactor?
- Apakah reusable table untuk master asset perlu masuk fase awal atau fase berikutnya?
- Apakah perlu menambahkan React Testing Library untuk component tests, atau cukup build/lint/smoke test untuk MVP?

## 16. Acceptance Criteria MVP

MVP reusable component dianggap selesai jika:

- `BrowserPreview` hanya memiliki satu implementation.
- `SmtpProfileDrawer` hanya memiliki satu implementation.
- Card/action/create pattern untuk email template dan landing page memakai shared component.
- Enam halaman target tetap menjalankan flow existing tanpa behavior regression.
- Build frontend berhasil.
- PR/summary menjelaskan component contract dan halaman yang terdampak.
