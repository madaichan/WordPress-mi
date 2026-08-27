# PRD: Asset Access Control and Version-Only Editing

Status: Draft
Date: 2026-07-27
Owner: Pukat Product and Engineering
Related area: Email templates, landing pages, sending profiles, playbooks, campaign runs
Implementation plan: `docs/IMPLEMENTATION_PLAN_ASSET_ACCESS_AND_VERSIONING.md`

Revision 2026-08-27: Menambahkan Usage Lock policy — assign master ke campaign/playbook baru selalu boleh, tetapi edit dan delete master terkunci permanen begitu master pernah dipakai campaign (langsung atau melalui playbook). Lihat §5.8. Ini menggantikan prinsip "edit tidak perlu diblokir usage" pada draft sebelumnya (§6.3, §9.4.1).

## 1. Ringkasan

Pukat membutuhkan aturan akses yang konsisten untuk asset yang dapat dipakai ulang oleh campaign, terutama asset `general` yang dapat digunakan banyak user secara bersamaan. Asset tidak boleh berubah secara live ketika sudah dipakai campaign. Karena itu, proses edit harus memakai model version-only edit: perubahan asset selalu membuat versi baru, sedangkan campaign tetap memakai versi/snapshot yang sudah dikunci.

PRD ini mengatur:

- Hak view, use, edit, delete, dan archive untuk role admin dan non-admin.
- Perbedaan route master dan non-master.
- Perbedaan asset `general` dan `own`.
- Version-only edit untuk mencegah perubahan campaign yang sedang atau pernah berjalan.
- Usage lock: assign master selalu boleh, tetapi edit dan delete terkunci begitu master punya riwayat penggunaan campaign.
- Enforcement security di backend/API sebagai source of truth.

## 2. Latar Belakang

Asset seperti landing page, email template, sending profile, dan playbook dapat dipakai oleh banyak campaign. Risiko terbesar ada pada asset `general`, karena asset tersebut bisa dipakai semua user secara bersamaan.

Tanpa versioning, contoh risiko yang bisa terjadi:

```text
User A membuat campaign memakai General Email Template v1
User B membuat campaign memakai General Email Template v1
Admin mengedit template general yang sama
Campaign A/B ikut berubah tanpa sengaja jika campaign membaca asset live
```

Untuk mencegah hal tersebut, campaign harus menyimpan `asset_version_id` atau snapshot immutable saat campaign dikunci, disync, atau diluncurkan.

## 3. Tujuan

- Menutup celah IDOR dan bypass permission pada API.
- Mencegah non-admin melihat atau mengubah asset user lain.
- Mencegah non-admin mengedit asset `general`.
- Mencegah admin mengedit asset user lain dari flow non-master.
- Menjaga histori campaign tetap akurat walaupun asset sumber sudah diedit.
- Mengizinkan assign/reuse master ke campaign atau playbook baru kapan pun, tanpa terhalang oleh usage yang sudah ada pada master tersebut.
- Mengunci edit dan delete master yang sudah pernah dipakai campaign (langsung atau melalui playbook), sampai seluruh relasi usage tersebut dilepas.
- Mencegah edit dan delete asset yang pernah digunakan campaign.
- Memberi frontend informasi permission yang konsisten dari backend.

## 4. Non-Tujuan

- Membuat permission builder dinamis di UI admin.
- Mengizinkan non-admin mengelola asset `general`.
- Mengizinkan delete paksa untuk asset yang sudah pernah digunakan campaign.
- Mengizinkan edit paksa untuk asset yang sudah pernah digunakan campaign atau playbook.
- Membuat mekanisme unlock otomatis untuk melepas usage lock tanpa proses purge data terpisah.
- Mengubah GoPhish sebagai source of truth.
- Menyimpan SMTP password atau secret provider di WordPress sebagai plain text.

## 5. Definisi

### 5.1 Asset

Asset adalah resource reusable yang bisa dipakai campaign:

- Email template
- Landing page
- Sending profile
- Playbook

### 5.2 General Asset

Asset `general` adalah asset global yang bisa dilihat dan digunakan oleh semua user yang memiliki akses Pukat.

Karakteristik:

- `scope = general`
- `owner_user_id = null`
- Dikelola oleh admin
- Read-only untuk non-admin
- Bisa digunakan oleh semua user dalam campaign

### 5.3 Own Asset

Asset `own` adalah asset milik user tertentu.

Karakteristik:

- `scope = own`
- `owner_user_id = current_user.id`
- Hanya bisa dilihat, digunakan, diedit, dan diarsipkan oleh owner
- Tidak bisa diakses oleh non-admin lain
- Admin dapat melihatnya di page master untuk governance, tetapi tidak mengedit/delete melalui flow non-master

### 5.4 Master Route

Master route adalah halaman governance untuk admin.

Target route:

```text
/master/email-templates
/master/landing-pages
/master/sending-profiles
/master/playbook
```

Catatan naming:

- `/master/playbook` menjadi target naming master playbook.
- Jika saat ini aplikasi masih memiliki `/master/playbooks`, route tersebut harus dimigrasikan atau diarahkan ke `/master/playbook` sebagai compatibility redirect.

### 5.5 Non-Master Route

Non-master route adalah halaman kerja user.

Target route:

```text
/email-templates
/landing-pages
/sending-profiles
/playbooks
```

Halaman non-master hanya menampilkan asset `general` dan asset `own` milik current user.

### 5.6 Version-Only Edit

Version-only edit berarti update konten asset tidak mengubah versi lama. Sistem membuat versi baru dan menjadikannya current version setelah valid.

Campaign yang sudah memilih versi lama tetap memakai versi lama.

### 5.7 Campaign Usage

Campaign usage adalah catatan bahwa campaign pernah menggunakan asset atau versi asset tertentu. Usage ini menjadi dasar untuk menolak **edit dan delete** master terkait (lihat §5.8).

Usage harus dicatat minimal saat campaign snapshot dikunci, disync, atau diluncurkan, mana yang terjadi lebih dulu. Sekali usage tercatat, relasi ini bersifat permanen — baris usage tidak dihapus otomatis walaupun campaign yang bersangkutan sudah completed, cancelled, atau archived.

### 5.8 Usage Lock (Assign vs Edit/Delete)

Usage lock memisahkan hak **assign** (memakai ulang master) dari hak **edit/delete** master itu sendiri, berdasarkan keberadaan baris di `pukat_campaign_asset_usages`.

- **Assign selalu boleh.** Master boleh dipilih sebagai component Playbook baru atau dipakai Campaign Run baru kapan pun, terlepas dari apakah master tersebut sudah pernah dipakai campaign atau playbook lain sebelumnya. Assign tidak pernah diblokir oleh usage lock.
- **Edit dan delete terkunci begitu usage ada.** Begitu sebuah master (email template, landing page, sending profile, atau playbook) memiliki minimal satu baris `pukat_campaign_asset_usages`, master tersebut tidak bisa lagi di-edit (create version baru) atau di-delete.
- **Lock permanen berdasarkan histori, bukan status campaign saat ini.** Status campaign (draft_run, running, completed, cancelled, archived) tidak melepas lock. Selama baris usage masih ada, master tetap terkunci — termasuk untuk campaign yang sudah lama selesai.
- **Assignment ke Playbook saja tidak membuat usage.** Memasukkan Email Template/Landing Page/Sending Profile sebagai component default di sebuah Playbook Master tidak mencatat `pukat_campaign_asset_usages`. Usage baru tercatat saat Playbook tersebut benar-benar dipakai membuat Campaign Run dan snapshot-nya dikunci/disync/diluncurkan (lihat §5.7). Sampai titik itu, Email Template/Landing Page/Sending Profile/Playbook yang bersangkutan masih bebas diedit/dihapus.
- **Archive tetap tersedia** sebagai jalan keluar ketika edit/delete terkunci karena usage (lihat §8.2); archive tidak mengubah konten sehingga tidak melanggar version-only edit.

## 6. Policy Matrix

### 6.1 View

| Context | Admin | Non-admin |
|---|---|---|
| Master route | Bisa melihat semua data | 403 / tidak boleh akses |
| Non-master route | Melihat `general` + `own` miliknya | Melihat `general` + `own` miliknya |
| API detail asset user lain | Boleh hanya dari endpoint master admin | 403 |
| API list non-master | Filter `scope = general OR owner_user_id = current_user.id` | Filter `scope = general OR owner_user_id = current_user.id` |

### 6.2 Use in Campaign

| Asset Scope | Admin | Non-admin |
|---|---|---|
| General | Boleh memakai current active version | Boleh memakai current active version |
| Own milik sendiri | Boleh memakai | Boleh memakai |
| Own milik user lain | Tidak boleh melalui flow normal | Tidak boleh |

Assign/select master ke campaign atau ke component playbook baru tidak pernah diblokir oleh usage lock (§5.8), walaupun master tersebut sudah dipakai campaign atau playbook lain sebelumnya.

### 6.3 Edit

| Asset Scope | Admin | Non-admin | Behavior |
|---|---|---|---|
| General, belum ada usage | Boleh | Tidak boleh | Create new version |
| Own milik sendiri, belum ada usage | Boleh melalui non-master jika owner | Boleh | Create new version |
| Own milik user lain | Tidak boleh melalui flow normal | Tidak boleh | 403 |
| Asset apa pun yang sudah punya `campaign_asset_usages` | Tidak boleh | Tidak boleh | 409 `asset_already_used`, gunakan archive |

Edit terkunci begitu asset (langsung atau melalui playbook) sudah pernah dipakai campaign — lihat Usage Lock (§5.8). Selama belum ada usage, edit tetap version-only (create version baru, bukan overwrite) sesuai §7.

### 6.4 Delete

| Asset Scope | Admin | Non-admin | Syarat |
|---|---|---|---|
| General | Boleh | Tidak boleh | Belum pernah digunakan campaign |
| Own milik sendiri | Boleh melalui non-master jika owner | Boleh | Belum pernah digunakan campaign |
| Own milik user lain | Tidak boleh melalui flow normal | Tidak boleh | 403 |

Jika asset pernah digunakan campaign, action yang tersedia adalah `archive`, bukan `delete`. Syarat "belum pernah digunakan campaign" ini permanen — sekali usage tercatat, delete (dan edit, §6.3) tetap terkunci walaupun campaign yang memakainya sudah completed/cancelled/archived (lihat §5.8).

### 6.5 Archive

| Asset Scope | Admin | Non-admin | Behavior |
|---|---|---|---|
| General | Boleh | Tidak boleh | Asset disembunyikan dari pilihan campaign baru |
| Own milik sendiri | Boleh melalui non-master jika owner | Boleh | Asset disembunyikan dari pilihan campaign baru |
| Own milik user lain | Tidak boleh melalui flow normal | Tidak boleh | 403 |

Archive tidak boleh mengubah campaign yang sudah memakai asset tersebut.

## 7. Versioning Requirement

### 7.1 Prinsip

- Asset version harus immutable setelah dibuat.
- Edit asset berarti membuat version baru.
- Edit hanya bisa dilakukan sebelum asset punya `campaign_asset_usages`; begitu usage tercatat, edit terkunci (lihat §5.8, §6.3).
- Campaign harus menyimpan `asset_version_id` dan snapshot payload.
- Campaign tidak boleh membaca konten asset live saat execution.
- Versi lama tidak boleh dihapus jika pernah dipakai campaign.
- `current_version_id` hanya menunjuk versi terbaru yang aktif untuk pemakaian campaign baru.

### 7.2 Versioning Per Asset

| Asset | Versioning Target |
|---|---|
| Email template | Wajib memakai version table |
| Landing page | Wajib memakai version table |
| Sending profile | Wajib memiliki revision/version atau immutable snapshot metadata |
| Playbook | Wajib memiliki version/revision untuk default component dan rules |

### 7.3 Edit Flow

```text
User/Admin klik edit
Backend cek NOT EXISTS campaign_asset_usages untuk asset_id; jika ada, tolak 409 asset_already_used
Backend validasi permission berdasarkan role, scope, dan owner
Backend membuat row version baru
Backend update asset.current_version_id ke version baru
Backend menulis audit log
Frontend refetch list/detail dan menampilkan version terbaru
```

### 7.4 Campaign Flow

```text
User memilih asset current version
Campaign draft dibuat
Saat snapshot lock/sync/launch:
  - Backend re-check asset masih visible dan usable
  - Backend menyimpan asset_id
  - Backend menyimpan asset_version_id
  - Backend menyimpan payload snapshot
  - Backend menulis campaign_asset_usage
Campaign execution membaca snapshot, bukan asset live
```

## 8. Delete and Archive Requirement

Aturan usage-based lock pada bagian ini sekarang berlaku untuk **delete maupun edit** (lihat §5.8, §6.3). Kondisi `NOT EXISTS campaign_asset_usages` yang dipakai untuk delete di §8.1 adalah kondisi yang sama dipakai untuk mengizinkan edit.

### 8.1 Delete

Delete hanya boleh jika asset belum pernah digunakan campaign.

Backend harus mengecek `campaign_asset_usages` secara atomic sebelum delete:

```text
Delete request
-> Validate role/scope/owner
-> Check NOT EXISTS campaign_asset_usages for asset_id
-> Soft delete or hard delete according to storage policy
-> Audit log
```

Jika usage sudah ada:

```text
HTTP 409 Conflict
code: asset_already_used
message: Asset sudah pernah digunakan campaign. Gunakan archive.
```

### 8.2 Archive

Archive boleh dilakukan untuk asset yang pernah digunakan campaign selama role/scope/owner valid.

Efek archive:

- Asset tidak muncul sebagai opsi campaign baru.
- Asset masih muncul di report/histori campaign yang pernah memakai asset tersebut.
- Snapshot campaign lama tidak berubah.
- Existing campaign yang sudah locked/synced/running/completed tetap valid.

## 9. Backend Security Requirement

Backend/API adalah source of truth untuk permission.

Frontend hanya boleh menggunakan permission dari API untuk UX, seperti hide/disable button, tetapi tidak boleh menjadi enforcement utama.

### 9.1 Enforcement Wajib

Semua endpoint berikut wajib melewati backend policy:

- List
- Detail
- Create
- Edit/create version
- Delete
- Archive
- Duplicate
- Preview
- Export
- Use/select asset in campaign
- Lock snapshot
- Sync campaign
- Launch campaign

### 9.2 Policy Functions

Backend harus menyediakan policy terpusat, misalnya:

```text
can_view_asset(user, asset, context)
can_use_asset(user, asset)
can_edit_asset(user, asset)
can_delete_asset(user, asset)
can_archive_asset(user, asset)
can_view_master_route(user)
```

Policy tidak boleh tersebar sebagai kondisi manual di banyak controller.

### 9.3 Request Body Trust Boundary

Backend tidak boleh percaya field permission dari request body:

- `owner_user_id`
- `scope`
- `is_general`
- `can_edit`
- `can_delete`
- `current_version_id`
- `used_count`

Field tersebut harus dihitung ulang dari database dan current authenticated user.

### 9.4 Server Validation Flow

Server validation flow adalah urutan pengecekan yang wajib dilakukan backend saat user menjalankan action seperti edit, delete, archive, duplicate, use in campaign, lock snapshot, sync, atau launch.

Tujuannya adalah memastikan request tetap aman walaupun response API, tombol frontend, atau payload request dimanipulasi oleh user.

#### 9.4.1 Edit / Create Version

Edit tidak boleh memakai `can_edit` dari client sebagai izin final. Backend harus menghitung ulang permission dari database.

Flow wajib:

```text
Request create version masuk
-> Ambil current authenticated user dari server
-> Ambil asset terbaru dari database berdasarkan asset_id
-> Jika asset tidak ditemukan atau deleted/archived, tolak request
-> Cek NOT EXISTS campaign_asset_usages untuk asset_id dan asset_type
-> Jika usage ada, tolak request dengan 409 asset_already_used dan sarankan archive
-> Hitung role user dari server
-> Hitung scope asset dari database
-> Hitung owner asset dari database
-> Jika scope = general, hanya admin yang boleh edit
-> Jika scope = own, hanya owner_user_id yang sama dengan current user yang boleh edit
-> Validasi payload versi baru
-> Insert asset version baru
-> Update asset.current_version_id ke version baru
-> Tulis audit log
-> Return response asset/version terbaru
```

Jika permission gagal, backend harus mengembalikan `403`.

Edit wajib mengecek usage sebelum membuat version baru. Jika asset sudah pernah dipakai campaign (langsung atau melalui playbook), request edit ditolak dengan `409`, terlepas dari role admin atau owner — lihat Usage Lock (§5.8).

#### 9.4.2 Delete

Delete tidak boleh memakai `can_delete` atau `used_count` dari client sebagai izin final. Backend harus mengecek ulang role, scope, owner, dan campaign usage dari database.

Flow wajib:

```text
Request delete masuk
-> Ambil current authenticated user dari server
-> Ambil asset terbaru dari database berdasarkan asset_id
-> Jika asset tidak ditemukan atau sudah deleted, tolak request
-> Hitung role user dari server
-> Hitung scope asset dari database
-> Hitung owner asset dari database
-> Jika scope = general, hanya admin yang boleh delete
-> Jika scope = own, hanya owner_user_id yang sama dengan current user yang boleh delete
-> Cek NOT EXISTS campaign_asset_usages untuk asset_id dan asset_type
-> Jika usage ada, tolak delete dan sarankan archive
-> Soft delete atau hard delete sesuai storage policy
-> Tulis audit log
-> Return success
```

Jika permission gagal, backend harus mengembalikan `403`.

Jika asset pernah digunakan campaign, backend harus mengembalikan `409`.

Delete harus dijalankan secara atomic menggunakan transaction atau conditional query agar tidak kalah oleh campaign snapshot lock yang terjadi di waktu bersamaan.

#### 9.4.3 Archive

Archive boleh dilakukan walaupun asset pernah digunakan campaign, selama role/scope/owner valid.

Flow wajib:

```text
Request archive masuk
-> Ambil current authenticated user dari server
-> Ambil asset terbaru dari database berdasarkan asset_id
-> Hitung role/scope/owner dari server dan database
-> Jika scope = general, hanya admin yang boleh archive
-> Jika scope = own, hanya owner yang boleh archive
-> Update status asset menjadi archived
-> Tulis audit log
-> Return asset terbaru
```

Archive tidak boleh menghapus version lama atau mengubah campaign snapshot yang sudah ada.

#### 9.4.4 Use in Campaign and Snapshot Lock

Saat user memilih asset untuk campaign, backend tetap harus memastikan asset boleh digunakan oleh user tersebut.

Flow wajib saat lock snapshot, sync, atau launch:

```text
Request campaign lock/sync/launch masuk
-> Ambil current authenticated user dari server
-> Ambil campaign terbaru dari database
-> Ambil asset dan current version terbaru dari database
-> Validasi user boleh mengakses campaign
-> Validasi user boleh memakai setiap asset
-> Tolak asset archived/deleted/inactive untuk campaign baru
-> Simpan asset_id
-> Simpan asset_version_id
-> Simpan payload snapshot final
-> Tulis campaign_asset_usage
-> Tulis audit log
-> Lanjutkan lock/sync/launch
```

Jika asset sudah berubah status setelah campaign draft dibuat, backend harus memakai status terbaru saat lock/sync/launch.

#### 9.4.5 Error Mapping

Server harus membedakan jenis kegagalan:

| Condition | HTTP | Code |
|---|---:|---|
| Asset tidak ada atau tidak visible | 404 | `asset_not_found` |
| User tidak boleh action berdasarkan role/scope/owner | 403 | `asset_action_forbidden` |
| Non-admin mencoba edit/delete/archive general asset | 403 | `general_asset_admin_only` |
| Non-owner mencoba action own asset | 403 | `asset_owner_forbidden` |
| Asset pernah dipakai campaign saat edit atau delete | 409 | `asset_already_used` |
| Asset berubah menjadi archived/deleted/inactive saat campaign lock | 409 | `asset_not_usable` |
| Usage berubah saat delete berjalan | 409 | `asset_usage_changed` |

### 9.5 Response Permission Contract

List/detail asset harus mengembalikan permission hasil kalkulasi backend.

Contoh:

```json
{
  "id": 12,
  "type": "email_template",
  "scope": "general",
  "owner_user_id": null,
  "current_version_id": 31,
  "status": "active",
  "usage": {
    "used_count": 4,
    "active_campaign_count": 1
  },
  "permissions": {
    "can_view": true,
    "can_use": true,
    "can_edit": false,
    "can_delete": false,
    "can_archive": false,
    "delete_reason": "Asset sudah pernah digunakan campaign.",
    "edit_reason": "General asset hanya bisa diedit admin."
  }
}
```

## 10. Data Model Requirement

### 10.1 Required Asset Fields

Setiap master asset harus memiliki field konseptual:

```text
id
type
scope: general | own
owner_user_id nullable
current_version_id nullable
status: draft | active | deprecated | archived
deleted_at nullable
created_by
updated_by
created_at
updated_at
```

Catatan implementasi:

- Jika tabel existing masih memakai `entity = General`, field tersebut tidak cukup sebagai security ownership.
- `owner_user_id` atau mapping ownership yang setara harus tersedia untuk enforce own-user permission.
- `entity` dapat tetap dipakai untuk grouping bisnis, filtering organisasi, atau metadata tampilan.

### 10.2 Required Version Fields

Setiap version/revision harus memiliki field konseptual:

```text
id
asset_id
version_number
payload_json or typed payload columns
status
created_by
created_at
approved_by nullable
approved_at nullable
```

Version yang sudah dipakai campaign tidak boleh diubah atau dihapus.

### 10.3 Campaign Asset Usage

Tambahkan tabel usage konseptual:

```text
pukat_campaign_asset_usages
- id
- campaign_run_id
- campaign_id nullable
- asset_type
- asset_id
- asset_version_id nullable
- scope_snapshot
- owner_user_id_snapshot nullable
- used_by_user_id
- usage_context: draft_lock | sync | launch | legacy_import
- created_at
```

Index yang disarankan:

```text
KEY asset_lookup (asset_type, asset_id)
KEY version_lookup (asset_type, asset_version_id)
KEY campaign_run_id (campaign_run_id)
```

Delete check harus memakai `asset_lookup`.

## 11. API Requirement

### 11.1 Master Routes

Target REST route tetap memakai prefix WordPress:

```text
GET    /wp-json/pukat/v1/master/email-templates
POST   /wp-json/pukat/v1/master/email-templates
GET    /wp-json/pukat/v1/master/email-templates/{id}
POST   /wp-json/pukat/v1/master/email-templates/{id}/versions
POST   /wp-json/pukat/v1/master/email-templates/{id}/archive
DELETE /wp-json/pukat/v1/master/email-templates/{id}

GET    /wp-json/pukat/v1/master/landing-pages
POST   /wp-json/pukat/v1/master/landing-pages
GET    /wp-json/pukat/v1/master/landing-pages/{id}
POST   /wp-json/pukat/v1/master/landing-pages/{id}/versions
POST   /wp-json/pukat/v1/master/landing-pages/{id}/archive
DELETE /wp-json/pukat/v1/master/landing-pages/{id}

GET    /wp-json/pukat/v1/master/sending-profiles
POST   /wp-json/pukat/v1/master/sending-profiles
GET    /wp-json/pukat/v1/master/sending-profiles/{id}
POST   /wp-json/pukat/v1/master/sending-profiles/{id}/versions
POST   /wp-json/pukat/v1/master/sending-profiles/{id}/archive
DELETE /wp-json/pukat/v1/master/sending-profiles/{id}

GET    /wp-json/pukat/v1/master/playbook
POST   /wp-json/pukat/v1/master/playbook
GET    /wp-json/pukat/v1/master/playbook/{id}
POST   /wp-json/pukat/v1/master/playbook/{id}/versions
POST   /wp-json/pukat/v1/master/playbook/{id}/archive
DELETE /wp-json/pukat/v1/master/playbook/{id}
```

Non-admin request ke master route harus mendapat 403.

### 11.2 Non-Master Routes

```text
GET    /wp-json/pukat/v1/email-templates
POST   /wp-json/pukat/v1/email-templates
GET    /wp-json/pukat/v1/email-templates/{id}
POST   /wp-json/pukat/v1/email-templates/{id}/versions
POST   /wp-json/pukat/v1/email-templates/{id}/archive
DELETE /wp-json/pukat/v1/email-templates/{id}

GET    /wp-json/pukat/v1/landing-pages
POST   /wp-json/pukat/v1/landing-pages
GET    /wp-json/pukat/v1/landing-pages/{id}
POST   /wp-json/pukat/v1/landing-pages/{id}/versions
POST   /wp-json/pukat/v1/landing-pages/{id}/archive
DELETE /wp-json/pukat/v1/landing-pages/{id}

GET    /wp-json/pukat/v1/sending-profiles
POST   /wp-json/pukat/v1/sending-profiles
GET    /wp-json/pukat/v1/sending-profiles/{id}
POST   /wp-json/pukat/v1/sending-profiles/{id}/versions
POST   /wp-json/pukat/v1/sending-profiles/{id}/archive
DELETE /wp-json/pukat/v1/sending-profiles/{id}

GET    /wp-json/pukat/v1/playbooks
POST   /wp-json/pukat/v1/playbooks
GET    /wp-json/pukat/v1/playbooks/{id}
POST   /wp-json/pukat/v1/playbooks/{id}/versions
POST   /wp-json/pukat/v1/playbooks/{id}/archive
DELETE /wp-json/pukat/v1/playbooks/{id}
```

Non-master list harus mengembalikan hanya asset `general` dan asset `own` current user.

### 11.3 Error Codes

| Condition | HTTP | Code |
|---|---:|---|
| Belum login | 401 | `rest_not_logged_in` |
| Role tidak boleh akses master | 403 | `master_route_forbidden` |
| Bukan owner own asset | 403 | `asset_owner_forbidden` |
| Non-admin edit general | 403 | `general_asset_admin_only` |
| Asset pernah dipakai campaign | 409 | `asset_already_used` |
| Asset archived dipakai campaign baru | 409 | `asset_not_usable` |
| Version tidak ditemukan/terlarang | 404/403 | `asset_version_unavailable` |
| Race condition saat delete | 409 | `asset_usage_changed` |

## 12. Frontend Requirement

Frontend harus:

- Menyembunyikan master menu untuk non-admin.
- Mengarahkan `/master/playbooks` ke `/master/playbook` jika route lama masih ada.
- Menampilkan tombol action berdasarkan `permissions` dari API.
- Tetap menangani error 403/409 dari API meskipun tombol sebelumnya aktif.
- Menampilkan alasan disabled, misalnya "General asset hanya bisa diedit admin" atau "Asset sudah pernah digunakan campaign".
- Menonaktifkan tombol edit (bukan hanya delete) dengan alasan yang sama ketika asset sudah punya usage campaign/playbook, dan mengarahkan user ke action archive sebagai alternatif.
- Tetap menampilkan tombol assign/use asset ke campaign atau playbook baru walaupun asset tersebut sudah punya usage — assign tidak pernah dikunci oleh usage lock.
- Setelah edit/delete/archive, selalu refetch list/detail.
- Tidak mengirim `can_edit`, `can_delete`, `scope`, atau `owner_user_id` sebagai sumber kebenaran.

## 13. Concurrency and Race Condition

Backend harus aman terhadap kondisi status berubah di waktu yang sama.

Requirement:

- Delete harus melakukan permission check dan usage check dalam transaction atau conditional query.
- Edit harus membuat version baru dalam transaction.
- Campaign snapshot lock harus menulis usage dalam transaction yang sama dengan snapshot.
- Jika usage muncul saat delete berjalan, delete harus gagal dengan 409.
- Jika asset diarchive saat user sedang membuat campaign draft, lock/sync/launch harus re-check usability terbaru.

Contoh delete logic konseptual:

```sql
DELETE FROM asset_table
WHERE id = :asset_id
AND NOT EXISTS (
  SELECT 1
  FROM pukat_campaign_asset_usages
  WHERE asset_type = :asset_type
  AND asset_id = :asset_id
);
```

Jika memakai soft delete, kondisi `NOT EXISTS` tetap wajib.

## 14. Audit Requirement

Audit log wajib dicatat untuk:

- Create asset
- Create version
- Promote/activate version
- Archive asset
- Delete asset
- Failed delete karena usage
- Failed edit karena permission
- Campaign snapshot lock
- Campaign sync
- Campaign launch

Audit payload tidak boleh menyimpan secret.

## 15. Migration Requirement

### 15.1 Ownership Backfill

Asset existing harus dimigrasikan ke model scope/owner:

```text
entity = General -> scope = general, owner_user_id = null
entity != General -> scope = own, owner_user_id = created_by jika valid
```

Jika `created_by` kosong atau user tidak ditemukan, asset harus masuk status `needs_review` atau hanya terlihat admin di master route sampai ownership diperbaiki.

### 15.2 Route Migration

```text
/master/playbooks -> redirect/alias sementara ke /master/playbook
/playbooks -> tetap non-master route
```

Alias lama dapat dihapus setelah UI dan bookmark internal selesai dipindahkan.

### 15.3 Legacy API Compatibility

Jika endpoint lama masih memakai `PUT` untuk edit konten, backend harus mengubah behavior menjadi create-version, bukan overwrite live content.

## 16. Acceptance Criteria

### 16.1 View

- Admin membuka `/master/email-templates` dan melihat semua email template.
- Admin membuka `/master/landing-pages` dan melihat semua landing page.
- Admin membuka `/master/sending-profiles` dan melihat semua sending profile.
- Admin membuka `/master/playbook` dan melihat semua playbook.
- Non-admin membuka route master dan menerima 403 atau redirect aman.
- Non-admin membuka non-master route dan hanya melihat asset `general` plus asset miliknya sendiri.
- Non-admin tidak bisa melihat detail asset milik user lain dengan mengganti ID di URL/API.

### 16.2 Edit

- Admin bisa edit asset `general` yang belum pernah dipakai campaign/playbook; backend membuat version baru.
- Non-admin tidak bisa edit asset `general`.
- Owner bisa edit asset `own` yang belum pernah dipakai campaign/playbook; backend membuat version baru.
- Non-owner tidak bisa edit asset `own`.
- Campaign yang sedang berjalan tetap memakai version lama setelah asset diedit (untuk asset yang masih boleh diedit).
- Edit master yang sudah pernah dipakai campaign (langsung atau melalui playbook) ditolak dengan 409, walaupun requester admin atau owner.
- Master yang sudah dipakai campaign yang sudah lama completed/archived tetap terkunci edit (usage lock permanen).
- Assign master yang sudah punya usage ke campaign atau playbook baru tetap berhasil — assign tidak diblokir usage lock.

### 16.3 Delete

- Admin bisa delete asset `general` yang belum pernah digunakan campaign.
- Owner bisa delete asset `own` yang belum pernah digunakan campaign.
- Delete asset yang pernah digunakan campaign gagal dengan 409.
- Jika asset sudah pernah digunakan, archive tersedia sesuai permission.
- Delete tetap gagal 409 walaupun campaign yang memakai asset sudah completed/cancelled/archived (usage lock permanen, sama seperti edit).

### 16.4 Campaign

- User bisa memakai asset `general` dalam campaign.
- User bisa memakai asset `own` miliknya sendiri dalam campaign.
- User tidak bisa memakai asset `own` milik user lain.
- Campaign snapshot menyimpan `asset_id`, `asset_version_id`, dan payload final.
- Campaign execution tidak berubah ketika asset sumber diedit setelah snapshot.

### 16.5 Security

- Semua mutation endpoint menolak request tanpa permission walaupun frontend button dimanipulasi.
- Permission dihitung di backend, bukan dipercaya dari frontend.
- Delete/edit re-check kondisi terbaru saat request diterima.
- Audit log tercatat untuk success dan failure penting.

## 17. Implementation Phasing

### Phase 1: Schema and Migration

- Tambah field `scope`, `owner_user_id`, `current_version_id`, `deleted_at` jika belum tersedia.
- Tambah version/revision untuk sending profile dan playbook jika belum tersedia.
- Tambah `pukat_campaign_asset_usages`.
- Backfill ownership dari data existing.

### Phase 2: Backend Policy

- Buat centralized asset policy.
- Terapkan policy ke list/detail/mutation/campaign flow.
- Tambah response `permissions` dan `usage`.
- Pastikan delete atomic terhadap usage.
- Tambah usage lock check yang dipakai bersama oleh edit dan delete (§5.8).

### Phase 3: Version-Only Edit

- Ubah semua edit konten menjadi create-version.
- Pastikan version lama immutable.
- Pastikan campaign snapshot memakai version, bukan live asset.
- Pastikan create-version ditolak 409 jika asset sudah punya usage (§6.3, §9.4.1).

### Phase 4: Frontend Integration

- Update menu master dan non-master.
- Update route `/master/playbook`.
- Gunakan `permissions` dari API untuk tombol action.
- Tangani error 403/409 dengan pesan jelas.

### Phase 5: QA and Hardening

- Tambah test untuk admin/non-admin, owner/non-owner, general/own.
- Tambah test race delete vs snapshot lock.
- Tambah test campaign tetap memakai snapshot setelah asset diedit.
- Tambah audit verification.

## 18. Open Questions

- Apakah admin boleh mengambil alih ownership asset `own` user lain melalui action khusus governance? Default PRD: tidak, out of scope.
- Apakah campaign draft yang belum lock snapshot harus memblokir delete sementara? Default PRD: lock/sync/launch menjadi titik usage permanen untuk delete maupun edit; draft reference harus divalidasi ulang saat lock (lihat §5.8).
- Apakah `owner_user_id` cukup, atau perlu tenant/entity ownership terpisah untuk organisasi besar? Default PRD: `owner_user_id` untuk security, `entity` untuk metadata/grouping.
- Karena usage lock sekarang permanen, apakah perlu mekanisme purge/retention untuk baris `campaign_asset_usages` milik campaign yang sudah sangat lama, agar master tidak terkunci selamanya? Default PRD: tidak ada override otomatis; unlock hanya melalui purge/retention policy yang didefinisikan terpisah dari PRD ini, dengan approval governance.
