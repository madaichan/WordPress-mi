# Implementation Plan: Frontend Reuse and Server-Driven Table

Status: Draft
Date: 2026-07-27
Owner: Pukat Product and Engineering

Related PRD:
- `docs/PRD.md`
- `docs/PRD_ASSET_ACCESS_AND_VERSIONING.md`
- `docs/PRD_REUSABLE_FRONTEND_COMPONENTS.md`
- `docs/PRD_REUSABLE_DATA_TABLE_COMPONENT.md`
- `docs/PRD_SERVER_DRIVEN_TABLE_API_AND_PERFORMANCE.md`

Related implementation plan:
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/IMPLEMENTATION_PLAN_ASSET_ACCESS_AND_VERSIONING.md`

## 1. Ringkasan

Implementation plan ini menerjemahkan PRD reusable frontend components, reusable DataTable, dan server-driven table API menjadi tahapan teknis yang bisa dikerjakan setelah baseline Playbook Master sudah terimplementasi.

Posisi dokumen:

```text
PRD.md
-> baseline product architecture
-> already implemented via IMPLEMENTATION_PLAN.md

PRD_ASSET_ACCESS_AND_VERSIONING.md
-> hardening permission, ownership, versioning, snapshot usage
-> implemented through its own implementation plan

PRD_REUSABLE_FRONTEND_COMPONENTS.md
PRD_SERVER_DRIVEN_TABLE_API_AND_PERFORMANCE.md
PRD_REUSABLE_DATA_TABLE_COMPONENT.md
-> next-phase implementation covered by this document
```

Target utama:

- Mengurangi duplikasi UI di halaman asset Admin dan Simulation.
- Menjadikan page sebagai orchestration layer, bukan tempat markup besar yang berulang.
- Menyiapkan DataTable reusable yang mengikuti schema.
- Menyiapkan API table server-driven untuk search, filter, sort, pagination, dan action permission.
- Migrasi bertahap tanpa mematahkan endpoint list existing.

## 2. Current State

### 2.1 Baseline Playbook Master

`docs/IMPLEMENTATION_PLAN.md` mencatat baseline Playbook Master sudah selesai sampai fase stabilisasi dan API handoff.

Status ringkas:

```text
Database Core - implemented
Master Component Backend - implemented
Playbook Master Backend - implemented
Campaign Run dan Snapshot - implemented
Sync Orchestrator - implemented, pending full GoPhish success-path verification
Reporting dan Result Sync - implemented
Cutover Legacy Flow - implemented
Stabilization dan API Handoff - implemented
```

Karena itu, pekerjaan berikutnya tidak perlu mengulang fondasi Playbook Master. Fokusnya adalah hardening, reuse, scale, dan maintainability.

### 2.2 Frontend Asset Pages

Halaman target awal:

```text
pukat-app/src/pages/Admin/MasterEmailTemplates.jsx
pukat-app/src/pages/Admin/MasterLandingPages.jsx
pukat-app/src/pages/Admin/MasterSendingProfiles.jsx
pukat-app/src/pages/Simulation/EmailTemplates.jsx
pukat-app/src/pages/Simulation/LandingPages.jsx
pukat-app/src/pages/Simulation/SendingProfiles.jsx
```

Baseline saat dokumen dibuat:

- Enam halaman target memiliki total sekitar 4.460 baris.
- `BrowserPreview` masih ada di lebih dari satu page landing page.
- `SmtpSlideover` masih terduplikasi di Admin dan Simulation sending profiles.
- `CreateCard`, thumbnail mockup, card action row, lock badge, dan beberapa visual helper masih page-local.
- Folder `pukat-app/src/components/Assets/` sudah ada tetapi belum berisi reusable asset component.

### 2.3 Existing Frontend Stack

Frontend memakai:

```text
React 18
Vite
Tailwind CSS
TanStack Query
Zustand
Axios client wrapper
JavaScript JSX
```

Tidak ada kebutuhan untuk menambah dependency baru pada fase reusable component MVP.

### 2.4 Existing Backend API

Endpoint master asset saat ini masih domain-specific:

```text
GET /wp-json/pukat/v1/master/email-templates
GET /wp-json/pukat/v1/master/landing-pages
GET /wp-json/pukat/v1/master/sending-profiles
GET /wp-json/pukat/v1/master/dynamic-domains
```

Endpoint ini tetap dipertahankan untuk compatibility. Server-driven table API dibuat paralel dengan route baru:

```text
GET /wp-json/pukat/v1/tables/{table_key}/schema
GET /wp-json/pukat/v1/tables/{table_key}/rows
```

## 3. Target Architecture

### 3.1 Frontend Component Placement

Recommended structure:

```text
pukat-app/src/features/assets/components/
  AssetActionGroup.jsx
  AssetCard.jsx
  AssetCreateCard.jsx
  AssetEditorLayout.jsx
  AssetLockBadge.jsx
  BrowserPreview.jsx
  SmtpProfileDrawer.jsx
  index.js
```

Reasoning:

- Komponen ini tahu domain asset Pukat.
- Komponen ini bukan UI primitive murni.
- Page Admin dan Simulation bisa memakai component yang sama tanpa memindahkan route logic.

`pukat-app/src/components/UI/` tetap untuk primitive seperti:

```text
Button
Badge
Drawer
Modal
Tabs
Table
Input
Select
Checkbox
EmptyState
```

### 3.2 DataTable Placement

Recommended structure:

```text
pukat-app/src/components/DataTable/
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

Reasoning:

- DataTable adalah reusable UI component lintas domain.
- DataTable tidak tahu detail Playbook Master atau master asset.
- Domain page tetap bertanggung jawab pada query, mutation, dan action callback.

### 3.3 Backend Table API Placement

Recommended backend structure:

```text
includes/Api/TableController.php
includes/Services/TableRegistry.php
includes/Services/TableQueryService.php
includes/Repositories/Table/
  SendingProfileTableRepository.php
```

Route registration ditambahkan di:

```text
includes/Core/Plugin.php
```

Table registry menjadi whitelist untuk:

```text
table_key
columns
filters
sorts
search_fields
default_sort
default_order
repository
permission callback
row action resolver
bulk action resolver
```

## 4. Dependency Order

Urutan dependency praktis:

```text
1. Asset Access and Versioning hardening
2. Reusable asset frontend components
3. DataTable frontend skeleton
4. Server-driven table API skeleton
5. First page adoption
6. Wider migration and performance hardening
```

Catatan:

- Reusable asset components bisa mulai tanpa menunggu table API.
- DataTable skeleton bisa dibuat dengan mock schema sebelum backend selesai.
- Page adoption ke server-driven table sebaiknya menunggu minimal satu table API stabil.
- Permission response dari `PRD_ASSET_ACCESS_AND_VERSIONING.md` harus menjadi acuan action disabled/reason di UI.

## 5. Phase 0: Baseline and Decisions

Goal: memastikan ruang kerja dan keputusan implementasi jelas sebelum source refactor.

Tasks:

- Tandai `PRD.md` sebagai baseline already implemented dalam narasi PR atau tracking issue.
- Konfirmasi `docs/IMPLEMENTATION_PLAN_ASSET_ACCESS_AND_VERSIONING.md` tetap menjadi plan terpisah untuk permission/versioning.
- Pastikan perubahan docs tidak ikut mengubah `assets/dist`.
- Konfirmasi folder final:
  - asset domain components: `src/features/assets/components/`
  - DataTable: `src/components/DataTable/`
- Tetapkan first table adoption:
  - recommended: `sending_profiles`
  - fallback lower-risk: `campaigns`

Deliverables:

- Implementation plan ini masuk repo.
- Keputusan folder dan first table tercatat.

Validation:

```bash
git status --short wp-content/plugins/Pukat/docs
```

## 6. Phase 1: Low-Risk Reusable Asset Components

Goal: menghapus duplikasi komponen leaf tanpa mengubah behavior API atau state page.

### 6.1 Extract BrowserPreview

Create:

```text
pukat-app/src/features/assets/components/BrowserPreview.jsx
```

Contract:

```jsx
<BrowserPreview
  html={html}
  redirectUrl={redirectUrl}
  title="Landing Page Preview"
/>
```

Usage target:

```text
pukat-app/src/pages/Admin/MasterLandingPages.jsx
pukat-app/src/pages/Simulation/LandingPages.jsx
```

Acceptance:

- Hanya ada satu implementation `BrowserPreview`.
- Viewport desktop, tablet, dan mobile tetap bekerja.
- Iframe tetap memakai sandbox.
- Visual preview tidak berubah signifikan.

### 6.2 Extract AssetCreateCard

Create:

```text
pukat-app/src/features/assets/components/AssetCreateCard.jsx
```

Contract:

```jsx
<AssetCreateCard
  label="Buat landing page baru"
  icon="ti-plus"
  onClick={handleCreate}
/>
```

Usage target:

```text
pukat-app/src/pages/Simulation/EmailTemplates.jsx
pukat-app/src/pages/Simulation/LandingPages.jsx
```

Acceptance:

- Create card markup tidak diulang.
- Label tetap bisa berbeda per asset type.
- Permission tetap dikontrol oleh page melalui conditional render.

### 6.3 Extract AssetLockBadge

Create:

```text
pukat-app/src/features/assets/components/AssetLockBadge.jsx
```

Contract:

```jsx
<AssetLockBadge
  locked={asset.editLocked}
  reason={masterAssetLockMessage(asset, 'Landing page')}
/>
```

Acceptance:

- Locked badge konsisten di card dan table.
- Component tidak menghitung permission sendiri.

Deliverables:

- Shared component files.
- Import update pada halaman target.
- No backend changes.

Validation:

```bash
cd wp-content/plugins/Pukat/pukat-app
npm run lint
npm run build
```

## 7. Phase 2: Complex Reusable Asset Components

Goal: memindahkan UI besar yang berulang menjadi feature components dengan props contract yang jelas.

### 7.1 Extract SmtpProfileDrawer

Create:

```text
pukat-app/src/features/assets/components/SmtpProfileDrawer.jsx
```

Contract:

```jsx
<SmtpProfileDrawer
  mode={mode}
  sourceName={sourceName}
  form={form}
  changed={changed}
  showPassword={showPassword}
  testing={testing}
  testResult={testResult}
  saving={saving}
  locked={locked}
  lockReason={lockReason}
  entityLocked={entityLocked}
  onClose={handleClose}
  onChange={handleChange}
  onHeaderChange={handleHeaderChange}
  onAddHeader={handleAddHeader}
  onRemoveHeader={handleRemoveHeader}
  onTogglePassword={handleTogglePassword}
  onRunTest={handleRunTest}
  onSubmit={handleSubmit}
  onDelete={handleDelete}
/>
```

Usage target:

```text
pukat-app/src/pages/Admin/MasterSendingProfiles.jsx
pukat-app/src/pages/Simulation/SendingProfiles.jsx
```

Acceptance:

- Tidak ada lagi duplikasi `SmtpSlideover`.
- Create, update, duplicate, delete, save, password toggle, custom header, dan test SMTP tetap berjalan.
- Locked state dan `entityLocked` tidak berubah.
- Component tidak memanggil mutation langsung.

### 7.2 Extract AssetActionGroup

Create:

```text
pukat-app/src/features/assets/components/AssetActionGroup.jsx
```

Contract:

```jsx
<AssetActionGroup
  variant="card"
  actions={[
    {
      key: 'edit',
      label: 'Edit',
      icon: 'ti-edit',
      tone: 'gray',
      disabled: page.editLocked,
      title: lockReason,
      onClick: () => onEdit(page.id),
    },
  ]}
/>
```

Acceptance:

- Card action row memakai shared component.
- Action disabled/title/aria-label konsisten.
- Table action tetap boleh memakai `TableActionButton` sampai DataTable adoption.

### 7.3 Extract AssetCard

Create:

```text
pukat-app/src/features/assets/components/AssetCard.jsx
```

Contract:

```jsx
<AssetCard
  asset={asset}
  type="landing_page"
  title={asset.name}
  description={asset.description}
  meta={asset.meta}
  chips={asset.chips}
  badges={asset.badges}
  entity={asset.entity}
  locked={asset.editLocked}
  lockReason={lockReason}
  thumbnail={<LandingPageThumbnail page={asset} />}
  actions={actions}
/>
```

Acceptance:

- Email template card dan landing page card berbagi shell.
- Thumbnail domain-specific tetap bisa diberikan sebagai slot.
- Page tetap mengatur permission dan callbacks.

Deliverables:

- Admin dan Simulation sending profile memakai drawer yang sama.
- Email template dan landing page card mulai memakai shared shell/action.

Validation:

```bash
cd wp-content/plugins/Pukat/pukat-app
npm run lint
npm run build
npm run test
```

Manual smoke:

```text
Landing page preview desktop/tablet/mobile
Email template create/edit/delete
Landing page create/edit/delete/preview
Sending profile create/update/duplicate/delete/test
Assignment modal behavior
Locked state disabled action
```

## 8. Phase 3: Page Simplification and Permission Alignment

Goal: membuat page target menjadi orchestration layer yang mudah dibaca.

Tasks:

- Hapus page-local component yang sudah diekstrak.
- Pindahkan hanya presentational markup yang berulang.
- Pertahankan query, mutation, state, memoized data, dan handler di page.
- Align action disabled dengan `permissions` dan reason dari backend saat `PRD_ASSET_ACCESS_AND_VERSIONING.md` sudah tersedia.
- Hindari perubahan payload builder dan mapper utility kecuali dibutuhkan oleh permission contract.

Target page responsibility:

```text
fetch data
derive current user permission/context
map API data to UI model
own search/filter/tab/drawer/modal state
compose reusable components
call mutations from handlers
show toast/refetch/invalidate
```

Non-target page responsibility:

```text
browser preview shell markup
SMTP drawer markup
generic card action markup
lock badge visual
create card visual
```

Acceptance:

- Enam halaman target tetap menjalankan flow existing.
- Total baris enam halaman turun minimal 15 persen dari baseline 4.460.
- Tidak ada behavior regression yang diketahui.

## 9. Phase 4: DataTable Frontend Skeleton

Goal: membuat DataTable reusable yang bisa dirender dari schema dan rows, sebelum semua page dimigrasi.

Create:

```text
pukat-app/src/components/DataTable/DataTable.jsx
pukat-app/src/components/DataTable/DataTableToolbar.jsx
pukat-app/src/components/DataTable/DataTablePagination.jsx
pukat-app/src/components/DataTable/DataTableEmptyState.jsx
pukat-app/src/components/DataTable/DataTableActionCell.jsx
pukat-app/src/components/DataTable/cellRenderers.js
pukat-app/src/components/DataTable/actionRegistry.js
pukat-app/src/components/DataTable/index.js
```

MVP props:

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

MVP renderers:

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
custom
```

MVP features:

- Dynamic headers from schema.
- Loading skeleton.
- Empty, no-results, error, forbidden states.
- Server-side search state with debounce.
- Server-side sort state.
- Pagination state.
- Row actions via action registry allowlist.
- Bulk selection for current page only.

Acceptance:

- DataTable can render a mock `sending_profiles` schema.
- Unknown renderer falls back safely to text/empty value.
- DataTable does not use `dangerouslySetInnerHTML`.
- Row action callback receives `{ actionKey, row }`.
- Bulk action callback receives explicit selected row IDs.

Validation:

```bash
cd wp-content/plugins/Pukat/pukat-app
npm run lint
npm run build
npm run test
```

## 10. Phase 5: Server-Driven Table API Skeleton

Goal: menyediakan backend contract minimal untuk satu table pertama.

Create:

```text
includes/Api/TableController.php
includes/Services/TableRegistry.php
includes/Services/TableQueryService.php
includes/Repositories/Table/SendingProfileTableRepository.php
```

Update:

```text
includes/Core/Plugin.php
```

Routes:

```http
GET /wp-json/pukat/v1/tables/{table_key}/schema
GET /wp-json/pukat/v1/tables/{table_key}/rows
```

First table:

```text
sending_profiles
```

MVP backend behavior:

- Validate `table_key` via registry.
- Validate pagination.
- Cap `per_page` at 100.
- Validate sort key and order via allowlist.
- Validate filter keys via allowlist.
- Sanitize search and limit search length.
- Use `$wpdb->prepare()` for SQL.
- Use `$wpdb->esc_like()` for LIKE search.
- Do not return SMTP password/secret or large detail payload.
- Return row actions with enabled/disabled state and reason.
- Use WordPress REST `permission_callback`.

Schema response must include:

```text
table_key
schema_version
title
search
columns
filters
row_actions
bulk_actions
defaults
limits
```

Rows response must include:

```text
table_key
schema_version
rows
meta
```

Acceptance:

- Unknown `table_key` returns `invalid_table_key`.
- Invalid sort returns `invalid_sort`.
- Invalid pagination returns `invalid_pagination`.
- `sending_profiles` rows are paginated server-side.
- Search/filter/sort do not require loading all rows in browser.
- Response excludes large/sensitive fields.

Validation candidates:

```bash
curl "$WP_BASE/wp-json/pukat/v1/tables/sending_profiles/schema"
curl "$WP_BASE/wp-json/pukat/v1/tables/sending_profiles/rows?page=1&per_page=25"
curl "$WP_BASE/wp-json/pukat/v1/tables/sending_profiles/rows?sort=invalid"
```

If local WordPress CLI smoke tooling is preferred, add a dedicated script:

```text
tools/smoke-table-api.php
```

## 11. Phase 6: First Page Adoption

Goal: migrate one page to prove DataTable and table API end to end.

Recommended first page:

```text
pukat-app/src/pages/Admin/MasterSendingProfiles.jsx
```

Why:

- Represents complex cells.
- Has row actions.
- Has assignment/entity/locked state.
- Useful as proof for other asset tables.

Frontend API additions:

```text
pukat-app/src/api/tableApi.js
pukat-app/src/hooks/queries/useTableQueries.js
pukat-app/src/api/queryKeys.js
```

Recommended query keys:

```js
tables: {
  all: ['tables'],
  schema: (tableKey) => ['tables', tableKey, 'schema'],
  rows: (tableKey, params = {}) => ['tables', tableKey, 'rows', params],
}
```

Migration strategy:

1. Add DataTable behind local page composition.
2. Keep existing drawer/create/edit/delete handlers.
3. Map row actions to existing handlers.
4. Keep legacy list endpoint available until DataTable flow is verified.
5. Remove hardcoded page table markup after parity is confirmed.

Acceptance:

- `MasterSendingProfiles.jsx` no longer owns hardcoded table header/cell markup.
- Search, sort, filter, and pagination request server endpoint.
- Existing actions still use current mutations and backend validation.
- DataTable can be reused by another page without rewriting header/cell/action logic.

Validation:

```text
Search sending profiles
Sort sortable columns
Filter status/entity/environment
Change page and per_page
Edit row
Duplicate row
Delete row
Assign row
Run test
Disabled action with reason
```

## 12. Phase 7: Wider Rollout and Performance Hardening

Goal: migrate additional tables and optimize query behavior based on real usage.

Candidate rollout order:

```text
1. Admin Master Sending Profiles
2. Admin Master Landing Pages
3. Admin Master Email Templates
4. Campaigns or Campaign Runs
5. Dynamic Domains
6. Playbook Masters
7. Audit Logs and high-volume reports
```

Performance tasks:

- Review actual SQL query plans.
- Add indexes only for observed query patterns.
- Avoid N+1 row action and assignment lookups.
- Consider cached count or `has_next` for very large tables.
- Add keyset pagination for audit/event tables if offset pagination becomes slow.
- Keep list response field projection narrow.

Acceptance:

- At least two table pages use DataTable.
- Table API remains whitelisted per `table_key`.
- Query performance is acceptable for realistic data size.
- Heavy operations like export/sync remain separate mutation/job endpoints.

## 13. Files Expected To Change

### Frontend asset reuse

```text
pukat-app/src/features/assets/components/*
pukat-app/src/pages/Admin/MasterEmailTemplates.jsx
pukat-app/src/pages/Admin/MasterLandingPages.jsx
pukat-app/src/pages/Admin/MasterSendingProfiles.jsx
pukat-app/src/pages/Simulation/EmailTemplates.jsx
pukat-app/src/pages/Simulation/LandingPages.jsx
pukat-app/src/pages/Simulation/SendingProfiles.jsx
```

### DataTable frontend

```text
pukat-app/src/components/DataTable/*
pukat-app/src/api/tableApi.js
pukat-app/src/hooks/queries/useTableQueries.js
pukat-app/src/api/queryKeys.js
```

### Server-driven table API

```text
includes/Api/TableController.php
includes/Services/TableRegistry.php
includes/Services/TableQueryService.php
includes/Repositories/Table/*
includes/Core/Plugin.php
tools/smoke-table-api.php
```

## 14. Testing and Verification Matrix

### Docs-only changes

```text
No runtime test required.
Confirm markdown renders and links are correct.
```

### Frontend component refactor

```bash
cd wp-content/plugins/Pukat/pukat-app
npm run lint
npm run build
npm run test
```

Manual:

```text
Admin Master Email Templates
Admin Master Landing Pages
Admin Master Sending Profiles
Simulation Email Templates
Simulation Landing Pages
Simulation Sending Profiles
```

### DataTable frontend

```bash
cd wp-content/plugins/Pukat/pukat-app
npm run lint
npm run build
npm run test
```

Add unit tests for:

```text
cellRenderers
actionRegistry
table state reducer/helper if introduced
query param builder
column visibility persistence
```

### Backend table API

Smoke test:

```text
schema endpoint success
rows endpoint success
invalid table key
invalid sort
invalid filter
invalid pagination
permission denied
row action disabled reason
no sensitive SMTP data in rows
```

## 15. Rollout Strategy

Recommended rollout:

```text
PR 1: Documentation and phase decisions
PR 2: BrowserPreview, AssetCreateCard, AssetLockBadge
PR 3: SmtpProfileDrawer
PR 4: AssetActionGroup and AssetCard
PR 5: DataTable skeleton with mock usage
PR 6: Backend table API skeleton for sending_profiles
PR 7: MasterSendingProfiles DataTable adoption
PR 8+: Additional table migrations
```

Each PR should include:

- Summary of behavior touched.
- Pages/routes affected.
- Validation results.
- Known risk and rollback note.

## 16. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Component extraction changes behavior accidentally | Regression in asset workflow | Extract leaf components first and keep page handlers unchanged |
| Component becomes too generic | Hard to use and review | Prefer domain-specific component with explicit props |
| Admin and Simulation permission logic mixed | Permission regression | Page owns permission, component receives props |
| Table endpoint too generic | Security issue | Use backend registry whitelist, never raw table names |
| Sort/filter not indexed | Slow query | Add indexes only after query review |
| Response leaks sensitive data | Security issue | Field projection for list endpoint, no secrets or large payloads |
| DataTable action differs from mutation validator | UX/security mismatch | Backend remains source of truth for mutation |
| Large PR is hard to review | Slow delivery | Split by phase and keep legacy endpoints available |

## 17. Open Decisions

- Confirm whether `src/components/Assets/` should be removed, left empty, or used as a re-export compatibility layer.
- Confirm first DataTable adoption page: `Admin/MasterSendingProfiles.jsx` or a lower-risk campaign table.
- Confirm if column visibility preference is local storage only for MVP.
- Confirm if exact `total` is required for all tables or if `has_next` is acceptable for large tables.
- Confirm whether backend table schema labels are localized server-side or kept static for MVP.

## 18. MVP Completion Criteria

MVP is complete when:

- `PRD.md` is treated as implemented baseline, not active daily backlog.
- `BrowserPreview` has one shared implementation.
- `SmtpProfileDrawer` has one shared implementation.
- Asset card/create/action patterns use shared components where repeated.
- Six target asset pages keep existing behavior.
- DataTable can render schema-driven headers, cells, row actions, states, and pagination.
- Table API has schema and rows endpoint for at least `sending_profiles`.
- `MasterSendingProfiles.jsx` uses DataTable without hardcoded table markup.
- Frontend lint/build/test pass for source changes.
- Backend smoke test validates table API success and error cases.
