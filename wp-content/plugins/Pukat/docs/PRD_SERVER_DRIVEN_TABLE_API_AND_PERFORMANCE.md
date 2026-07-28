# PRD: Server-Driven Table API and Performance

Status: Draft
Date: 2026-07-27
Owner: Pukat Product and Engineering
Related area: WordPress REST API, custom database tables, React data table, query performance
Primary consumer: `docs/PRD_REUSABLE_DATA_TABLE_COMPONENT.md`
Related PRD:
- `docs/PRD_REUSABLE_FRONTEND_COMPONENTS.md`
- `docs/PRD_ASSET_ACCESS_AND_VERSIONING.md`

## 1. Ringkasan

Pukat membutuhkan standar API untuk list/table data yang besar, dinamis, dan diakses banyak user secara bersamaan.

API table harus bersifat server-driven:

- Frontend meminta data per halaman.
- Backend melakukan search, filter, sort, dan pagination.
- Backend hanya mengirim field yang dibutuhkan untuk table list.
- Backend mengirim schema/action/permission yang aman untuk UI.
- Backend tetap menjadi source of truth untuk permission dan mutation.

PRD ini menjadi pasangan backend/API untuk `docs/PRD_REUSABLE_DATA_TABLE_COMPONENT.md`.

## 2. Latar Belakang

Data Pukat dapat berkembang besar:

- Campaign dan campaign runs
- Target list
- Email template versions
- Landing page versions
- Sending profile refs
- Dynamic domains
- Quiz results
- Risk scores
- Socialization logs
- Audit logs

Jika frontend mengambil seluruh dataset, masalah yang muncul:

- Browser lambat dan boros memori.
- API response besar.
- Database bekerja berat saat banyak user membuka halaman bersamaan.
- Sorting/search/filter di browser tidak akurat untuk dataset yang belum seluruhnya dimuat.
- Count dan join dapat menjadi bottleneck.
- Permission action rawan tidak konsisten antar endpoint.

Karena itu, semua table besar harus memakai API contract yang jelas dan query backend yang dioptimalkan.

## 3. Tujuan

- Menyediakan standar endpoint table schema dan table rows.
- Mendukung server-side pagination, search, filter, dan sort.
- Menghindari `SELECT *` untuk list endpoint.
- Menetapkan allowlist sort/filter/search field per table.
- Menyediakan row actions dan bulk actions yang permission-aware.
- Menyediakan metadata pagination yang konsisten.
- Mendukung caching schema dan filter options.
- Mengurangi beban query berat dan N+1 query.
- Menyediakan strategi index database untuk kolom yang sering dipakai.
- Menjaga API aman dari SQL injection, IDOR, dan permission bypass.

## 4. Non-Tujuan

- Membuat endpoint SQL generic yang menerima nama table bebas dari frontend.
- Mengganti REST API WordPress dengan GraphQL.
- Membuat realtime streaming table.
- Membuat export ribuan row langsung dari response table.
- Mengganti semua endpoint list existing dalam satu fase.
- Mengubah source of truth GoPhish.

## 5. Prinsip Arsitektur

### 5.1 Server-Driven, Bukan Client-Driven

Frontend mengirim table state:

```text
page
per_page
search
filters
sort
order
```

Backend mengembalikan rows yang sesuai.

Frontend tidak boleh mengambil semua rows hanya untuk difilter atau disort di browser.

### 5.2 Table Key Harus Whitelist

API tidak boleh menerima raw database table name dari frontend.

Gunakan `table_key` yang dipetakan di backend:

```text
sending_profiles
campaigns
email_templates
landing_pages
dynamic_domains
campaign_runs
audit_logs
```

Setiap `table_key` memiliki definisi backend yang eksplisit:

```text
columns
allowed_search_fields
allowed_filters
allowed_sorts
default_sort
repository
permission_callback
row_action_resolver
bulk_action_resolver
```

### 5.3 Backend Source of Truth

Frontend boleh memakai `actions` dan `permissions` untuk UX, tetapi backend tetap wajib memvalidasi:

- User capability
- Object ownership
- Scope asset
- Status row
- Campaign usage
- Allowed transition/action

### 5.4 List Endpoint Harus Ringan

List endpoint hanya mengambil field yang diperlukan untuk table.

Detail besar seperti HTML body, JSON panjang, SMTP secret, template body, snapshot, atau audit payload lengkap tidak boleh dikirim di table rows kecuali memang dibutuhkan untuk kolom ringkas.

## 6. API Endpoint Contract

### 6.1 Schema Endpoint

Recommended route:

```http
GET /wp-json/pukat/v1/tables/{table_key}/schema
```

Response setelah dibuka oleh Axios interceptor Pukat:

```json
{
  "table_key": "sending_profiles",
  "schema_version": "sending_profiles_v1",
  "title": "Sending Profiles",
  "search": {
    "enabled": true,
    "placeholder": "Search sending profiles..."
  },
  "columns": [
    {
      "key": "profile",
      "label": "Profile Name",
      "type": "text_with_subtext",
      "sortable": true,
      "width": "260px"
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
  "filters": [
    {
      "key": "status",
      "label": "Status",
      "type": "multi_select",
      "options": [
        {
          "value": "draft",
          "label": "Draft"
        },
        {
          "value": "active",
          "label": "Active"
        }
      ]
    }
  ],
  "row_actions": [
    {
      "key": "edit",
      "label": "Edit",
      "icon": "ti-edit",
      "tone": "blue"
    },
    {
      "key": "delete",
      "label": "Delete",
      "icon": "ti-trash",
      "tone": "red"
    }
  ],
  "bulk_actions": [
    {
      "key": "archive",
      "label": "Archive selected",
      "tone": "amber"
    }
  ],
  "defaults": {
    "page": 1,
    "per_page": 25,
    "sort": "updated_at",
    "order": "desc"
  },
  "limits": {
    "max_per_page": 100
  }
}
```

### 6.2 Rows Endpoint

Recommended route:

```http
GET /wp-json/pukat/v1/tables/{table_key}/rows
```

Example:

```http
GET /wp-json/pukat/v1/tables/sending_profiles/rows?page=1&per_page=25&search=smtp&sort=updated_at&order=desc&status=active
```

Response:

```json
{
  "table_key": "sending_profiles",
  "schema_version": "sending_profiles_v1",
  "rows": [
    {
      "id": 12,
      "values": {
        "profile": {
          "primary": "Sample EntityA SMTP",
          "secondary": "smtp.example.com"
        },
        "host_port": "smtp.example.com:587",
        "from_address": "security@example.com",
        "encryption": {
          "label": "TLS",
          "tone": "blue"
        },
        "status": {
          "value": "valid",
          "label": "Valid",
          "tone": "green",
          "dot": true
        },
        "entity": {
          "label": "General",
          "tone": "gray"
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
  ],
  "meta": {
    "page": 1,
    "per_page": 25,
    "returned": 25,
    "total": 4500,
    "total_pages": 180,
    "has_next": true,
    "has_prev": false,
    "sort": "updated_at",
    "order": "desc"
  }
}
```

### 6.3 Complex Filter Request

Jika filter terlalu kompleks untuk query param sederhana, API boleh menyediakan POST read endpoint:

```http
POST /wp-json/pukat/v1/tables/{table_key}/query
```

Body:

```json
{
  "page": 1,
  "per_page": 25,
  "search": "smtp",
  "sort": "updated_at",
  "order": "desc",
  "filters": {
    "status": ["active", "valid"],
    "entity": ["General"],
    "created_at": {
      "from": "2026-07-01",
      "to": "2026-07-27"
    }
  }
}
```

MVP dapat memakai GET terlebih dahulu untuk filter sederhana.

## 7. Request Rules

### 7.1 Pagination

Rules:

- Default `page`: 1
- Default `per_page`: 25
- Minimum `per_page`: 10
- Maximum `per_page`: 100
- `page` dan `per_page` harus integer positif
- Jika page melewati total, response boleh mengembalikan rows kosong dengan meta valid

### 7.2 Search

Rules:

- `search` harus disanitasi.
- Panjang search MVP maksimal 100 karakter.
- Search field harus allowlisted per table.
- Query SQL harus memakai `$wpdb->prepare()`.
- LIKE query harus memakai `$wpdb->esc_like()`.

### 7.3 Filter

Rules:

- Filter key harus allowlisted.
- Filter value harus disanitasi sesuai type.
- Multi select memiliki batas jumlah value.
- Date range harus divalidasi sebagai date.
- Boolean harus diparse eksplisit.
- Unknown filter key harus ditolak atau diabaikan secara konsisten.

### 7.4 Sort

Rules:

- Sort key harus allowlisted.
- Order hanya `asc` atau `desc`.
- Default sort harus deterministic.
- Tambahkan secondary sort `id DESC` atau `id ASC` untuk stabilitas pagination jika diperlukan.

## 8. Backend Table Registry

Backend sebaiknya memiliki registry definisi table.

Contoh konseptual:

```php
[
	'sending_profiles' => [
		'capability'     => 'pukat_manage_campaigns',
		'default_sort'   => 'updated_at',
		'default_order'  => 'desc',
		'max_per_page'   => 100,
		'columns'        => [ /* schema */ ],
		'filters'        => [ /* filter schema */ ],
		'sorts'          => [ 'name', 'status', 'entity', 'updated_at' ],
		'search_fields'  => [ 'name', 'from_email', 'entity' ],
		'repository'     => SendingProfileTableRepository::class,
	],
]
```

Registry mencegah frontend mengakses table atau kolom database secara bebas.

## 9. Query Optimization Requirements

### 9.1 No `SELECT *` untuk List Endpoint

List endpoint harus memilih field minimal.

Contoh:

```sql
SELECT id, name, from_email, environment, entity, status, updated_at
FROM wp_pukat_sending_profile_refs
WHERE status IN (...)
ORDER BY updated_at DESC, id DESC
LIMIT 25 OFFSET 0
```

Detail field besar diambil dari endpoint detail:

```http
GET /wp-json/pukat/v1/sending-profiles/{id}
```

### 9.2 Index Strategy

Setiap table harus memiliki index untuk kolom yang sering dipakai filter/sort/search.

Candidate index:

| Table | Candidate Index |
|---|---|
| `pukat_campaigns` | `status`, `created_by`, `scheduled_at`, `launched_at`, `updated_at` |
| `pukat_targets` | `campaign_id`, `email`, `department` |
| `pukat_email_template_masters` | `status`, `entity`, `created_by`, `updated_at` |
| `pukat_landing_page_masters` | `status`, `entity`, `created_by`, `updated_at` |
| `pukat_sending_profile_refs` | `status`, `entity`, `environment`, `updated_at`, `from_email` |
| `pukat_dynamic_domains` | `status`, `owner_entity`, `authorization_status`, `dns_status`, `updated_at` |
| `pukat_playbook_masters` | `status`, `entity`, `difficulty`, `updated_at` |
| `pukat_campaign_runs` | `campaign_id`, `status`, `created_by`, `launched_at`, `updated_at` |
| `pukat_quiz_results` | `campaign_id`, `target_id`, `score`, `submitted_at` |
| `pukat_risk_scores` | `campaign_id`, `target_id`, `risk_level`, `score`, `created_at` |
| `pukat_audit_logs` | `user_id`, `action`, `object_type`, `object_id`, `created_at` |

Composite index harus ditambahkan berdasarkan query nyata.

Contoh:

```sql
KEY status_entity (status, entity)
KEY entity_updated (entity, updated_at)
KEY campaign_status (campaign_id, status)
```

Index final harus divalidasi saat implementation, bukan hanya berdasarkan asumsi PRD.

### 9.3 Count Strategy

MVP boleh memakai exact count query:

```sql
SELECT COUNT(*)
FROM ...
WHERE ...
```

Untuk table besar seperti audit logs dan event/history table, fase berikutnya dapat memakai:

- Cached total count.
- Approximate total.
- `has_next` tanpa total presisi.
- Keyset pagination untuk halaman berikutnya.

API harus tetap mendukung UI walaupun `total` tidak tersedia.

### 9.4 Avoid N+1 Query

List endpoint tidak boleh menjalankan query tambahan per row untuk data yang bisa dibatch.

Contoh yang harus dibatch:

- Target count per campaign.
- Usage count per asset.
- Latest tested timestamp per sending profile.
- Permission/action availability per row.
- Assignment summary per asset.

Gunakan join, grouped subquery, atau batch lookup.

### 9.5 Large Text and JSON

Kolom besar tidak boleh dikirim di list endpoint:

- `html_body`
- `text_body`
- `variables_json`
- `snapshot_json`
- `capture_settings_json`
- `redirect_settings_json`
- audit payload detail

Jika table butuh preview, kirim ringkasan yang sudah dipotong di backend.

## 10. Caching Requirements

### 10.1 Schema Cache

Schema jarang berubah dan dapat dicache.

Rules:

- Cache key mengandung `table_key`, role/capability group, locale jika relevan, dan `schema_version`.
- Cache invalidated saat deployment/version berubah.
- Schema boleh disimpan di frontend cache TanStack Query dengan stale time lebih panjang.

### 10.2 Filter Options Cache

Filter options seperti entity, status, category, dan environment dapat dicache.

Rules:

- Cache harus memperhatikan permission user.
- Cache TTL pendek untuk data yang bisa berubah.
- Jika memakai WordPress transient, key harus mengandung user/role scope bila hasilnya permission-specific.

### 10.3 Row Data Cache

Row data boleh dicache singkat hanya jika aman.

Rules:

- Cache key harus mengandung table state dan user permission scope.
- Hindari cache row data yang mengandung data user-specific sensitif kecuali key benar-benar terisolasi.
- Mutation harus invalidate cache yang terdampak.

## 11. Frontend Loading Performance

API harus mendukung frontend behavior berikut:

- Debounced search.
- Abort stale request dengan Axios/TanStack Query signal jika memungkinkan.
- Keep previous page data saat refetch agar UI tidak berkedip.
- Schema query terpisah dari rows query.
- Perubahan search/filter/sort mengembalikan page ke 1.
- Page size dibatasi sesuai `limits.max_per_page`.

## 12. Bulk and Heavy Operations

Table API tidak boleh menjalankan operasi berat dalam request list biasa.

Operasi berikut harus memakai mutation khusus dan dapat diproses async jika besar:

- Export CSV besar.
- Sync GoPhish banyak asset.
- Bulk delete banyak row.
- Bulk archive banyak row.
- Bulk assign asset ke banyak user/entity.
- Recalculate risk scores.

Untuk job async, API dapat mengembalikan:

```json
{
  "job_id": "pukat_job_123",
  "status": "queued"
}
```

Progress dicek melalui endpoint job/status terpisah.

## 13. Concurrency Requirements

Karena table dapat diakses beberapa user bersamaan:

- Read endpoint harus idempotent.
- Mutation harus memakai permission check terbaru saat request diterima.
- Bulk mutation harus validasi setiap row, bukan hanya validasi table-level.
- Sync/export job harus memakai lock agar tidak berjalan dobel untuk resource yang sama.
- Response mutation harus jelas membedakan success, partial success, dan failed rows.

Contoh partial response:

```json
{
  "status": "partial",
  "succeeded_ids": [1, 2, 4],
  "failed": [
    {
      "id": 3,
      "code": "permission_denied",
      "message": "You cannot archive this item."
    }
  ]
}
```

## 14. Security Requirements

- Semua route harus memiliki WordPress REST `permission_callback`.
- Backend tidak boleh menerima raw table name atau raw column name.
- Sort dan filter key harus allowlisted.
- SQL harus memakai `$wpdb->prepare()`.
- LIKE harus memakai `$wpdb->esc_like()`.
- Object-level permission wajib untuk detail dan mutation.
- Row actions dari API bukan pengganti permission validation.
- Jangan kirim secret seperti API key atau SMTP password di rows.
- Bulk action harus menerima explicit IDs.
- Audit log mutation penting harus ditulis.

## 15. Error Contract

Error harus konsisten agar DataTable bisa menampilkan state yang tepat.

Contoh:

```json
{
  "code": "invalid_sort",
  "message": "Sort field is not allowed for this table.",
  "data": {
    "status": 400
  }
}
```

Common error code:

| Code | HTTP | Meaning |
|---|---:|---|
| `invalid_table_key` | 404 | Table key tidak dikenal |
| `permission_denied` | 403 | User tidak boleh mengakses table |
| `invalid_filter` | 400 | Filter key/value tidak valid |
| `invalid_sort` | 400 | Sort key/order tidak valid |
| `invalid_pagination` | 400 | Page/per_page tidak valid |
| `row_not_found` | 404 | Row tidak ditemukan |
| `action_not_allowed` | 403/409 | Action tidak boleh untuk row tersebut |
| `query_failed` | 500 | Query gagal |

## 16. Observability

Implementation harus memudahkan deteksi query lambat.

Recommended:

- Log query duration untuk table endpoint pada debug mode.
- Catat table key, page size, filter count, sort key, dan result count.
- Jangan log payload sensitif.
- Tambahkan smoke test untuk endpoint table utama.
- Untuk local/dev, boleh tampilkan debug meta hanya jika `WP_DEBUG` aktif.

## 17. Recommended Implementation Phases

### Phase 1: Backend Contract Skeleton

- Buat table registry sederhana.
- Buat schema endpoint.
- Buat rows endpoint untuk satu table pertama.
- Terapkan pagination, sort allowlist, dan per_page cap.

Output:

- `sending_profiles` atau `campaigns` dapat dimuat lewat table API.

### Phase 2: Search dan Filter

- Tambahkan search allowlist.
- Tambahkan filter parser.
- Tambahkan filter schema response.
- Tambahkan sanitasi dan validation.

Output:

- DataTable dapat search/filter server-side.

### Phase 3: Row Actions dan Permissions

- Tambahkan row action resolver.
- Tambahkan bulk action resolver.
- Tambahkan disabled reason.
- Pastikan mutation endpoint tetap validasi ulang.

Output:

- Frontend mendapat action state yang konsisten.

### Phase 4: Query Optimization

- Review query plans.
- Tambahkan index yang benar-benar dibutuhkan.
- Hilangkan N+1 lookup.
- Pisahkan detail payload dari list payload.

Output:

- Endpoint tetap ringan untuk dataset besar.

### Phase 5: Adoption Bertahap

- Migrasikan satu halaman frontend ke DataTable.
- Evaluasi schema/rows contract.
- Migrasikan table lain berdasarkan prioritas produk.

Output:

- Pola server-driven table dipakai lintas halaman.

## 18. Candidate First Table

Rekomendasi table pertama:

```text
sending_profiles
```

Alasan:

- Memiliki cell kompleks: title/subtitle, badge, status, entity, assignment, actions.
- Relevan dengan asset reusable.
- Membutuhkan permission-aware action.
- Cukup mewakili kebutuhan table lain.

Alternatif:

```text
campaigns
```

Alasan:

- Lebih sederhana.
- Cocok untuk membuktikan pagination, search, sort, dan action dasar.

## 19. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Generic table endpoint terlalu bebas | Security risk | Gunakan table registry whitelist |
| Query count mahal | API lambat | Cache count atau gunakan `has_next` untuk table besar |
| Sort/filter field tidak diindex | Query lambat | Review query plan dan tambah index bertahap |
| Row action permission tidak sinkron | UX/security regression | Backend row action resolver dan mutation validator memakai policy yang sama |
| Response terlalu besar | Load lambat | Field projection khusus list endpoint |
| Cache bocor antar user | Data leak | Cache key harus mengandung user/role/scope |

## 20. Open Questions

- Apakah endpoint table memakai route generic `/tables/{table_key}` atau route per domain dengan schema standar?
- Apakah table schema akan dilokalisasi dari backend atau label tetap di frontend?
- Table mana yang membutuhkan keyset pagination sejak awal?
- Apakah column visibility preference akan disimpan di browser atau di user meta WordPress?
- Apakah exact total count wajib untuk semua table, atau cukup `has_next` untuk log table besar?

## 21. Acceptance Criteria MVP

MVP server-driven table API dianggap selesai jika:

- Ada schema endpoint untuk minimal satu table.
- Ada rows endpoint dengan pagination server-side.
- `per_page` dibatasi maksimal 100.
- Search, filter, dan sort divalidasi dengan allowlist.
- Response rows hanya mengirim field list yang diperlukan.
- Response mengirim `meta` pagination.
- Response mengirim row actions atau action availability.
- Permission callback dan object-level permission berjalan.
- Query memakai prepare/sanitasi sesuai WordPress standard.
- Frontend DataTable dapat memakai endpoint tersebut tanpa hardcoded header.
