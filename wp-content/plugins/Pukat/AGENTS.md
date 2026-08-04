# Pukat Implementation Agent

Kamu adalah implementation agent untuk plugin WordPress **Pukat**.

Tugas utama kamu adalah membantu implementasi fitur secara terarah berdasarkan PRD dan implementation plan yang sudah ada, tanpa keluar dari arsitektur yang telah didesain.

Pukat memiliki dua area besar:

- Backend WordPress/PHP untuk database, service, repository, REST API, permission, audit, dan integrasi GoPhish.
- Frontend React di folder `pukat-app` untuk admin SPA dan frontend/public SPA.

## 1. Project Context

### 1.1 Frontend

- Stack: React 18, Vite, Tailwind CSS v3, Zustand, TanStack Query v5.
- Routing: React Router DOM v6.
- HTTP client: Axios wrapper di `pukat-app/src/api/client.js`.
- Entry point: `AppAdmin.jsx` dan `AppFrontend.jsx`, digabung lewat `main.jsx`.
- Bahasa: JavaScript JSX. Jangan migrasi ke TypeScript kecuali diminta eksplisit.

Frontend folder guide:

```text
pukat-app/src/api          API client wrapper and endpoint functions
pukat-app/src/components   reusable shared UI components
pukat-app/src/features     feature/domain logic and components
pukat-app/src/pages        route-level pages
pukat-app/src/store        Zustand global store
pukat-app/src/hooks        custom hooks and query/mutation hooks
pukat-app/src/utils        helper functions
pukat-app/src/config       frontend config
pukat-app/src/data         static data/constants
```

### 1.2 Backend

- Platform: WordPress plugin.
- Bahasa: PHP.
- REST namespace: `pukat/v1`.
- Controller base: `includes/Api/RestController.php`.
- Route registration: `includes/Core/Plugin.php`.
- Main backend areas:

```text
includes/Api
includes/Core
includes/Repositories
includes/Services
tools
```

Backend harus menjadi source of truth untuk permission, mutation validation, object access, audit, versioning, and security-sensitive decisions.

## 2. PRD and Plan Discipline

Sebelum mengubah kode, baca requirement dan dokumen yang relevan.

Dokumen baseline:

```text
docs/PRD.md
docs/IMPLEMENTATION_PLAN.md
```

Catatan: `docs/PRD.md` adalah baseline Playbook Master yang sudah diimplementasikan melalui `docs/IMPLEMENTATION_PLAN.md`. Jangan memperlakukan dokumen itu sebagai backlog harian baru kecuali user meminta review baseline.

Dokumen active/next-phase:

```text
docs/PRD_ASSET_ACCESS_AND_VERSIONING.md
docs/IMPLEMENTATION_PLAN_ASSET_ACCESS_AND_VERSIONING.md
docs/PRD_REUSABLE_FRONTEND_COMPONENTS.md
docs/PRD_REUSABLE_DATA_TABLE_COMPONENT.md
docs/PRD_SERVER_DRIVEN_TABLE_API_AND_PERFORMANCE.md
docs/IMPLEMENTATION_PLAN_FRONTEND_REUSE_AND_SERVER_DRIVEN_TABLE.md
docs/PRD_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md
docs/IMPLEMENTATION_PLAN_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md
```

Aturan:

- Ikuti implementation plan aktif jika request berkaitan dengan area tersebut.
- Jika PRD dan kode existing berbeda, jelaskan perbedaannya sebelum memilih arah implementasi.
- Jangan memperluas scope PRD secara diam-diam.
- Jangan membuat ulang arsitektur yang sudah ada jika existing pattern cukup.
- Pecah perubahan besar menjadi fase kecil yang bisa direview.

## 3. General Implementation Rules

- Pelajari struktur project sebelum mengubah kode.
- Cari komponen, helper, hook, service, repository, atau controller existing sebelum membuat file baru.
- Jangan mengubah file yang tidak berkaitan dengan tugas.
- Jangan revert perubahan user atau perubahan lain yang tidak kamu buat.
- Jangan menyentuh `assets/dist` kecuali user secara eksplisit meminta build/release artifact.
- Jangan menambahkan package baru tanpa alasan jelas dan persetujuan eksplisit.
- Jangan menyimpan password, token, API key, SMTP secret, atau credential lain di source code.
- Secret tidak boleh berada di frontend. Frontend env/Vite tetap bisa terbundle ke browser.
- Gunakan komentar secukupnya hanya untuk logic yang tidak langsung jelas.

## 4. Frontend Guardrails

### 4.1 Component Taxonomy

Gunakan lokasi berikut:

```text
pukat-app/src/components/UI
```

Untuk primitive generik seperti:

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

Gunakan lokasi berikut:

```text
pukat-app/src/features/assets/components
```

Untuk domain asset components seperti:

```text
AssetActionGroup
AssetCard
AssetCreateCard
AssetEditorLayout
AssetLockBadge
BrowserPreview
SmtpProfileDrawer
```

Gunakan lokasi berikut:

```text
pukat-app/src/components/DataTable
```

Untuk reusable schema-driven DataTable.

Jangan menaruh domain-aware asset component di `components/UI`.

### 4.2 React Rules

- Gunakan functional component dan hooks.
- Tetap pakai JavaScript JSX.
- Styling pakai Tailwind utility classes.
- Jangan membuat file CSS baru kecuali memang dibutuhkan dan dijelaskan.
- State global pakai Zustand jika benar-benar global.
- Data fetching/caching pakai TanStack Query.
- Jangan memakai `useEffect` + `fetch` manual untuk query API biasa.
- Page harus menjadi orchestration layer: query, mutation, local state, permission props, composition.
- Reusable component menerima data dan callback lewat props.
- Reusable component tidak boleh memanggil mutation langsung kecuali memang dirancang sebagai container.

### 4.3 Frontend Permission

- Frontend boleh memakai permission/action state untuk UX.
- Backend tetap source of truth.
- Component tidak boleh menghitung role global sendiri jika page dapat mengirim permission props.
- Disabled action harus memiliki reason/title bila tersedia.
- Row action dari API harus dicek lewat frontend action registry allowlist.

### 4.4 DataTable Frontend Rules

DataTable harus:

- Membuat header dari schema.
- Merender cell melalui renderer registry.
- Tidak memakai `dangerouslySetInnerHTML` untuk value dari API.
- Mendukung loading, empty, no-results, error, forbidden state.
- Mengirim search, filter, sort, pagination sebagai server-side table state.
- Memakai debounce untuk search.
- Memakai query key yang mencakup `tableKey` dan table state.
- Bulk action mengirim explicit row IDs, bukan raw query/filter SQL.

## 5. Backend Guardrails

### 5.1 REST API Rules

- Semua route wajib memiliki WordPress REST `permission_callback`.
- Gunakan `RestController` response helper jika sesuai.
- Backend harus validasi ulang semua mutation.
- Jangan mengandalkan frontend hidden/disabled action sebagai permission enforcement.
- Error response harus konsisten dan bisa dipakai frontend untuk state error.
- Jangan mengirim secret, token, API key, SMTP password, atau payload besar yang tidak perlu.

### 5.2 Database and Query Rules

- Jangan menerima raw database table name dari frontend.
- Jangan menerima raw column name dari frontend.
- Gunakan whitelist/registry untuk table key, sort key, filter key, dan search fields.
- Gunakan `$wpdb->prepare()` untuk SQL dinamis.
- Gunakan `$wpdb->esc_like()` untuk LIKE search.
- Hindari `SELECT *` untuk list endpoint.
- Hindari N+1 query pada list endpoint.
- Batasi field list endpoint ke data yang memang dibutuhkan table.
- Large text/JSON seperti HTML body, snapshot JSON, audit payload detail, dan secret tidak boleh dikirim di rows endpoint kecuali memang requirement eksplisit.

### 5.3 Server-Driven Table API Rules

Endpoint target:

```http
GET /wp-json/pukat/v1/tables/{table_key}/schema
GET /wp-json/pukat/v1/tables/{table_key}/rows
```

Rules:

- `table_key` harus whitelist via backend registry.
- `page` dan `per_page` harus divalidasi.
- `per_page` maksimum MVP adalah 100.
- `sort` dan `order` harus divalidasi.
- Filter key dan value harus disanitasi sesuai type.
- Search maksimal 100 karakter untuk MVP.
- Response rows harus menyertakan pagination `meta`.
- Row actions dan bulk actions boleh dikirim untuk UX, tetapi mutation tetap wajib validasi ulang.
- Operasi berat seperti export besar, bulk sync, dan recalculation tidak boleh terjadi di request list biasa.

## 6. Before Writing Code

1. Baca requirement user.
2. Baca PRD atau implementation plan yang relevan.
3. Cek status kerja dan hindari menimpa perubahan orang lain.
4. Cari file dan pattern existing yang berkaitan.
5. Jelaskan rencana perubahan secara singkat.
6. Sebutkan file yang akan diubah atau dibuat jika perubahan cukup besar.
7. Baru lakukan implementasi.

## 7. After Writing Code

### 7.1 Frontend Validation

Jalankan dari folder `pukat-app` jika source frontend berubah:

```bash
npm run lint
npm run build
npm run test
```

Jika salah satu tidak bisa dijalankan, jelaskan alasannya.

### 7.2 Backend Validation

Jika backend PHP/REST API berubah, lakukan validasi sesuai konteks:

```text
PHP syntax check untuk file yang diubah
REST smoke test untuk endpoint baru/berubah
permission denied case
invalid input case
success case
no sensitive field in response
```

Untuk table API, minimal cek:

```text
schema endpoint success
rows endpoint success
invalid table key
invalid sort
invalid filter
invalid pagination
permission denied if applicable
row action enabled/disabled reason
```

### 7.3 Docs-Only Validation

Jika hanya dokumentasi yang berubah:

```text
Tidak wajib menjalankan lint/build/test.
Pastikan markdown terbaca dan path dokumen benar.
```

## 8. Reporting Back

Laporkan dengan ringkas:

1. Apa yang diubah.
2. File yang diubah/dibuat.
3. Validasi yang dijalankan.
4. Risiko atau area yang perlu dicek manusia.
5. Hal yang sengaja tidak disentuh.

Jika ada test yang gagal, laporkan failure paling penting dan tindakan yang sudah dilakukan.
