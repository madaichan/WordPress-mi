# PRD: Reusable Data Table Component

Status: Draft
Date: 2026-07-27
Owner: Pukat Product and Engineering
Related area: React frontend, admin list pages, simulation list pages, reusable UI components
Related PRD:
- `docs/PRD_REUSABLE_FRONTEND_COMPONENTS.md`
- `docs/PRD_SERVER_DRIVEN_TABLE_API_AND_PERFORMANCE.md`

## 1. Ringkasan

Pukat membutuhkan komponen data table yang reusable, dinamis, dan cukup pintar untuk dipakai di banyak halaman tanpa membuat ulang header, cell style, action button, filter, sorting, pagination, dan state dasar.

Komponen ini bukan database table. Komponen ini adalah UI table untuk frontend React. Header dan behavior table dikendalikan oleh table schema dari API atau konfigurasi frontend, sedangkan isi row dikirim oleh API secara paginated.

Targetnya adalah satu komponen data table dapat dipakai untuk halaman seperti:

- Campaigns
- Email template masters
- Landing page masters
- Sending profile refs
- Dynamic domains
- Playbook masters
- Campaign runs
- Quiz results
- Risk scores
- Audit logs

Karena data Pukat dapat besar dan diakses banyak user bersamaan, komponen ini harus didesain sebagai server-driven table. Frontend tidak boleh memuat semua row sekaligus untuk search, sort, atau filter.

## 2. Latar Belakang

Beberapa halaman Pukat membutuhkan tabel yang mirip secara struktur, tetapi berbeda pada bentuk cell dan action.

Contoh kebutuhan pada tabel sending profile:

- Kolom profile menampilkan title dan subtext.
- Kolom encryption tampil sebagai badge.
- Kolom status tampil sebagai status dot dan badge.
- Kolom assignment dan entity tampil sebagai pill.
- Kolom actions menampilkan beberapa icon button.

Jika setiap halaman membuat table markup sendiri, risiko yang muncul:

- Header, spacing, empty state, loading state, dan action pattern tidak konsisten.
- Sorting/filtering mudah berbeda antar halaman.
- Perubahan desain table harus diedit di banyak file.
- API besar cenderung dimuat seluruhnya ke browser.
- Permission action rawan hanya disembunyikan di frontend tanpa enforcement backend.

PRD ini mendefinisikan reusable data table component yang dapat menerima schema, rows, meta, dan callback action dengan contract yang stabil.

## 3. Tujuan

- Membuat satu data table reusable untuk list page Pukat.
- Header table otomatis mengikuti column schema.
- Cell dapat dirender dinamis berdasarkan renderer type.
- Mendukung row action dan bulk action yang permission-aware.
- Mendukung server-side search, filter, sort, dan pagination.
- Menyediakan loading, empty, error, forbidden, dan no-results state.
- Menjaga table tetap rapi untuk data lebar dengan horizontal scroll dan sticky column.
- Mengurangi hardcoded table markup di page-level component.
- Menjaga page tetap berperan sebagai orchestration layer.

## 4. Non-Tujuan

- Mengganti seluruh design system Pukat.
- Mengubah stack React, Vite, Tailwind, Zustand, atau TanStack Query.
- Membuat generic SQL table builder di frontend.
- Mengizinkan API mengirim HTML mentah untuk cell.
- Memindahkan validasi permission dari backend ke frontend.
- Memaksa semua halaman memakai table ini dalam satu fase.
- Membuat datatable seperti spreadsheet editable penuh.

## 5. Scope

### 5.1 In Scope

Komponen target:

```text
src/components/DataTable/
  DataTable.jsx
  DataTableToolbar.jsx
  DataTablePagination.jsx
  DataTableEmptyState.jsx
  DataTableBulkBar.jsx
  DataTableColumnMenu.jsx
  DataTableActionCell.jsx
  cellRenderers.js
  actionRegistry.js
  index.js
```

Komponen existing yang dapat dipakai ulang:

```text
src/components/UI/Table.jsx
src/components/UI/TableActionButton.jsx
src/components/UI/Badge.jsx
src/components/UI/Button.jsx
src/components/UI/Input.jsx
src/components/UI/Select.jsx
src/components/UI/Checkbox.jsx
src/components/UI/EmptyState.jsx
```

Fitur table:

- Dynamic columns
- Cell renderer registry
- Row actions
- Bulk selection dan bulk actions
- Server-side search
- Server-side filter
- Server-side sorting
- Server-side pagination
- Column visibility
- Loading skeleton
- Empty state
- Error state
- Forbidden state
- Sticky selection column
- Sticky action column
- Responsive horizontal scroll

### 5.2 Out of Scope untuk Fase Awal

- Inline editing per cell.
- Drag-and-drop row ordering.
- Real-time collaborative table updates.
- Advanced column grouping.
- Pivot table/report builder.
- Export besar secara langsung dari browser.
- Virtualized infinite scroll sebagai default untuk semua table.

## 6. Definisi

### 6.1 DataTable

Komponen reusable yang menerima schema, rows, meta, state, dan callbacks, lalu menampilkan table interaktif.

### 6.2 Table Schema

Konfigurasi kolom, filter, action, default sort, pagination, dan opsi tampilan.

Schema dapat berasal dari API atau konfigurasi frontend yang distandarkan.

### 6.3 Column

Definisi satu kolom table, termasuk key, label, renderer type, width, alignment, sorting, filtering, dan visibility.

### 6.4 Cell Renderer

Renderer frontend yang menentukan bagaimana nilai cell ditampilkan.

Contoh:

```text
text
text_with_subtext
badge
status_badge
date
number
email
link
actions
```

### 6.5 Action Registry

Registry frontend yang memetakan action key dari API menjadi icon, label, tone, dan callback.

Contoh:

```text
edit
duplicate
delete
assign
send_test
sync
view_report
archive
restore
```

### 6.6 Table State

State yang mempengaruhi request data:

```text
page
per_page
search
sort
order
filters
visible_columns
selected_row_ids
```

## 7. Functional Requirements

### 7.1 Dynamic Columns

DataTable harus membuat header berdasarkan `columns`.

Column minimal:

```json
{
  "key": "status",
  "label": "Status",
  "type": "status_badge",
  "sortable": true,
  "filterable": true,
  "width": "140px",
  "align": "left",
  "hidden": false
}
```

Requirement:

- Urutan header mengikuti urutan `columns`.
- Kolom dengan `hidden: true` tidak tampil secara default.
- Kolom yang dapat disembunyikan user harus masuk column visibility menu.
- Kolom action dapat dibuat sticky di sisi kanan.
- Kolom checkbox dapat dibuat sticky di sisi kiri.

### 7.2 Cell Renderer

DataTable harus memakai renderer berdasarkan `column.type`.

Renderer MVP:

| Type | Output |
|---|---|
| `text` | Text biasa |
| `text_with_subtext` | Primary text dan secondary text |
| `badge` | Pill/badge |
| `status_badge` | Dot optional dan badge status |
| `date` | Tanggal terformat |
| `number` | Angka terformat |
| `email` | Email text/link optional |
| `link` | Link internal/eksternal |
| `actions` | Icon button actions |
| `custom` | Slot khusus dari caller |

DataTable tidak boleh merender HTML mentah dari API. Jika ada kebutuhan rich content, API mengirim structured value dan frontend memilih renderer yang aman.

### 7.3 Row Actions

DataTable harus mendukung action per row.

Contoh row action:

```json
{
  "key": "send_test",
  "enabled": true,
  "label": "Send test",
  "reason": null
}
```

Requirement:

- Action yang disabled tetap boleh ditampilkan dengan tooltip reason jika UX membutuhkan.
- Action yang tidak relevan untuk row boleh tidak dikirim oleh API.
- Frontend hanya menampilkan action sesuai allowlist action registry.
- Mutation tetap divalidasi ulang di backend.

### 7.4 Bulk Selection dan Bulk Actions

DataTable harus mendukung checkbox per row dan checkbox header.

Bulk action MVP:

- Delete selected
- Archive selected
- Export selected
- Assign selected
- Sync selected

Requirement:

- Bulk action hanya aktif jika ada row terpilih.
- Bulk action harus mengecek permission dari schema dan row.
- Selection harus reset saat table key, search, filter, atau page berubah kecuali ada requirement eksplisit untuk cross-page selection.
- Cross-page selection tidak masuk MVP.

### 7.5 Search

Search harus server-side.

Requirement:

- Input search memakai debounce 300-500 ms.
- Request lama dibatalkan atau diabaikan ketika query baru muncul.
- Search mengubah page kembali ke 1.
- Search placeholder dapat berasal dari schema.

### 7.6 Filter

Filter harus server-side.

Filter type MVP:

| Type | Contoh |
|---|---|
| `select` | status |
| `multi_select` | entity, category |
| `date_range` | created_at, updated_at |
| `boolean` | assigned, used |
| `number_range` | score, target_count |

Requirement:

- Filter yang tersedia berasal dari schema.
- Filter value dikirim sebagai query param yang distandarkan oleh PRD API.
- Reset filter harus mengembalikan page ke 1.
- Active filter harus terlihat di toolbar.

### 7.7 Sorting

Sorting harus server-side.

Requirement:

- Hanya kolom dengan `sortable: true` yang dapat disort.
- Sort key harus berasal dari allowlist schema.
- Sort state minimal: `sort` dan `order`.
- Order hanya menerima `asc` atau `desc`.
- Perubahan sort mengembalikan page ke 1.

### 7.8 Pagination

Pagination harus server-side.

Requirement:

- Default `per_page` adalah 25.
- Opsi page size MVP: 10, 25, 50, 100.
- UI menampilkan range data saat total tersedia.
- UI tetap dapat berjalan jika API hanya mengirim `has_next` tanpa total presisi.

### 7.9 Loading, Empty, Error, dan Forbidden State

DataTable harus memiliki state:

- Initial loading
- Refetching/loading ringan
- Empty data
- No search/filter results
- Error API
- Forbidden/no permission

Requirement:

- Loading skeleton harus menjaga tinggi row agar layout tidak melompat.
- Error state menyediakan retry callback.
- Empty state dapat dikustomisasi per table.
- Forbidden state tidak menampilkan row/action.

### 7.10 Column Visibility

DataTable harus menyediakan column visibility untuk table dengan banyak kolom.

Requirement:

- Kolom wajib dapat diberi `required: true`.
- Kolom required tidak bisa disembunyikan.
- Preference column visibility dapat disimpan di local storage per `table_key`.
- Preference user tidak boleh menghilangkan data security-sensitive dari backend; backend tetap menentukan field yang boleh dikirim.

### 7.11 Responsive Behavior

Requirement:

- Table lebar memakai horizontal scroll.
- Header dan body tetap alignment.
- Checkbox column dapat sticky kiri.
- Action column dapat sticky kanan.
- Cell text panjang harus truncate atau wrap sesuai konfigurasi kolom.
- Text tidak boleh overlap dengan icon/action.
- Layout tidak berubah saat hover, loading, atau action disabled.

### 7.12 Accessibility

Requirement:

- Table memakai elemen table semantik.
- Action button memiliki `aria-label`.
- Checkbox memiliki label accessible.
- Sort button menyampaikan state sort.
- Loading dan error state dapat dibaca screen reader.
- Keyboard user dapat mengakses toolbar, pagination, dan actions.

## 8. Data Contract Frontend

DataTable menerima props dengan arah berikut:

```jsx
<DataTable
  tableKey="sending_profiles"
  schema={schema}
  rows={rows}
  meta={meta}
  state={tableState}
  loading={isLoading}
  refetching={isFetching}
  error={error}
  selectedRowIds={selectedRowIds}
  onStateChange={setTableState}
  onSelectionChange={setSelectedRowIds}
  onRowAction={handleRowAction}
  onBulkAction={handleBulkAction}
/>
```

Schema contoh:

```json
{
  "table_key": "sending_profiles",
  "schema_version": "sending_profiles_v1",
  "columns": [
    {
      "key": "profile",
      "label": "Profile Name",
      "type": "text_with_subtext",
      "sortable": true,
      "width": "260px"
    },
    {
      "key": "host_port",
      "label": "Host / Port",
      "type": "text",
      "sortable": true
    },
    {
      "key": "status",
      "label": "Status",
      "type": "status_badge",
      "sortable": true,
      "filterable": true
    },
    {
      "key": "actions",
      "label": "Actions",
      "type": "actions",
      "sticky": "right",
      "required": true
    }
  ],
  "defaults": {
    "sort": "updated_at",
    "order": "desc",
    "per_page": 25
  }
}
```

Rows contoh:

```json
[
  {
    "id": 12,
    "values": {
      "profile": {
        "primary": "Sample EntityA SMTP",
        "secondary": "smtp.example.com"
      },
      "host_port": "smtp.example.com:587",
      "status": {
        "value": "valid",
        "label": "Valid",
        "tone": "green",
        "dot": true
      }
    },
    "actions": [
      {
        "key": "assign",
        "enabled": true
      },
      {
        "key": "edit",
        "enabled": true
      },
      {
        "key": "delete",
        "enabled": false,
        "reason": "Profile has been used by a campaign."
      }
    ]
  }
]
```

## 9. API Dependency

DataTable bergantung pada `docs/PRD_SERVER_DRIVEN_TABLE_API_AND_PERFORMANCE.md`.

Frontend table tidak boleh:

- Mengambil seluruh dataset untuk diproses di browser.
- Menentukan sendiri permission mutation.
- Mengirim sort/filter key di luar schema.
- Merender field yang tidak dikirim oleh backend.

Backend/API harus:

- Mengirim schema dan rows sesuai contract.
- Menerapkan pagination, search, filter, dan sort di server.
- Mengirim action availability per row atau per table.
- Menolak action yang tidak diizinkan walaupun frontend memunculkan tombol.

## 10. TanStack Query Requirement

Data fetching table harus memakai TanStack Query.

Requirement:

- Query key mencakup `tableKey`, `page`, `per_page`, `search`, `filters`, `sort`, dan `order`.
- Search input memakai debounce.
- Stale request harus dibatalkan atau hasilnya diabaikan.
- Schema dapat dicache lebih lama dibanding row data.
- Row data dapat memakai placeholder data agar page transition lebih halus.
- Mutation row/bulk action harus invalidate query key table yang terdampak.

## 11. Security Requirement

- UI permission hanya untuk pengalaman user, bukan enforcement utama.
- Semua mutation harus divalidasi ulang di backend.
- Action key dari API harus dicek terhadap frontend action registry.
- Link/action eksternal harus disanitasi.
- Cell renderer tidak boleh memakai `dangerouslySetInnerHTML` untuk value dari API.
- Bulk action harus mengirim explicit row IDs, bukan filter SQL atau raw query.

## 12. Recommended Implementation Phases

### Phase 1: Contract dan Skeleton

- Buat `DataTable` dengan dynamic header, rows, loading, empty, error, dan pagination static.
- Buat renderer `text`, `text_with_subtext`, `badge`, `status_badge`, `date`, dan `actions`.
- Buat action registry dasar memakai `TableActionButton`.

Output:

- DataTable dapat merender schema mock untuk sending profiles.

### Phase 2: Server-Side State

- Tambahkan search debounce.
- Tambahkan sort state.
- Tambahkan filter state.
- Tambahkan pagination state.
- Integrasikan dengan TanStack Query.

Output:

- DataTable memanggil API dengan query params yang benar.

### Phase 3: Permissions dan Actions

- Tambahkan row actions.
- Tambahkan disabled reason.
- Tambahkan bulk selection dan bulk action.
- Hubungkan mutation invalidate.

Output:

- Table dapat dipakai untuk action nyata seperti edit, duplicate, delete, assign, dan send test.

### Phase 4: Column Visibility dan Responsive Polish

- Tambahkan column visibility menu.
- Tambahkan local storage preference per `table_key`.
- Tambahkan sticky checkbox/action columns.
- Uji table lebar di desktop dan mobile.

Output:

- Table tetap rapi untuk dataset dengan banyak kolom.

### Phase 5: Page Adoption

- Migrasikan satu halaman berisiko rendah dulu.
- Migrasikan sending profiles setelah contract stabil.
- Migrasikan campaign dan master asset pages secara bertahap.

Output:

- Hardcoded table markup berkurang tanpa regression besar.

## 13. Candidate First Page

Rekomendasi halaman pertama:

```text
src/pages/Admin/MasterSendingProfiles.jsx
```

Alasan:

- Memiliki variasi cell yang mewakili kebutuhan table dinamis.
- Memiliki action row yang jelas.
- Relevan dengan asset reusable dan permission-aware action.
- Cocok untuk membuktikan schema, renderer, dan action registry.

Alternatif lebih rendah risiko:

```text
src/features/campaigns/CampaignTable.jsx
```

Alasan:

- Table lebih sederhana.
- Bisa memvalidasi dynamic columns, loading, empty, sort, dan action tanpa terlalu banyak cell type.

## 14. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Table terlalu generic | Sulit dipakai dan debug | Batasi renderer dan action registry MVP |
| API schema berubah tanpa versioning | Frontend rusak | Gunakan `schema_version` dan fallback renderer |
| Permission hanya di frontend | Security regression | Backend tetap source of truth |
| Data besar diproses di browser | Lambat dan boros memori | Semua search/filter/sort/pagination server-side |
| Banyak row action membuat UI penuh | Table sulit discan | Pakai icon button, overflow menu jika action terlalu banyak |
| Cell structured value tidak konsisten | Renderer pecah | Validasi contract di adapter/hook |

## 15. Open Questions

- Apakah `DataTable` ditempatkan di `src/components/DataTable/` atau tetap di `src/components/UI/`?
- Apakah table schema selalu dari API, atau beberapa table sederhana boleh memakai schema lokal?
- Apakah row selection perlu mendukung cross-page selection pada fase berikutnya?
- Apakah audit logs perlu keyset pagination sejak awal?
- Apakah column visibility preference cukup local storage, atau perlu disimpan per user di backend?

## 16. Acceptance Criteria MVP

MVP reusable data table dianggap selesai jika:

- Header dapat dibuat dari column schema.
- Minimal 6 renderer berjalan: `text`, `text_with_subtext`, `badge`, `status_badge`, `date`, `actions`.
- Search, filter, sort, dan pagination mengubah request server-side.
- Loading, empty, error, dan forbidden state tersedia.
- Row action menampilkan enabled/disabled state dan callback yang benar.
- Bulk selection tersedia untuk action yang dikirim schema.
- Column visibility tersedia untuk kolom non-required.
- Table tetap rapi pada viewport desktop dan mobile.
- Minimal satu halaman Pukat memakai DataTable tanpa hardcoded `<th>` page-level.
