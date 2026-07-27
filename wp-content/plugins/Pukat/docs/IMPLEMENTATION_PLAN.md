# Implementation Plan: Playbook Master

## 1. Arah Implementasi

Implementasi Playbook Master dilakukan bertahap di sisi WordPress/Pukat. GoPhish tidak diubah struktur database, source code, atau API-nya. GoPhish tetap digunakan as-is sebagai execution engine.

Arsitektur target:

```text
WordPress/Pukat
-> Master data
-> Versioning
-> Approval
-> Campaign Run Snapshot
-> Sync Orchestration

GoPhish
-> Email delivery
-> Landing page runtime
-> Target group
-> Campaign execution
-> Event tracking
```

Flow lama `pukat_playbooks` dan `pukat_campaigns` tetap dipertahankan sementara sebagai legacy compatibility. Flow baru akan dibuat paralel dulu, lalu cutover setelah stabil.

## 1.1 Status Implementasi

```text
Phase 1: Database Core - implemented and runtime migration verified
Phase 2: Master Component Backend - implemented and API smoke test verified
Phase 3: Playbook Master Backend - implemented and API smoke test verified
Phase 4: Campaign Run dan Snapshot - implemented and API smoke test verified
Phase 5: Sync Orchestrator ke GoPhish - implemented, pending full GoPhish success-path verification
Phase 6: Reporting dan Result Sync - implemented and stubbed GoPhish smoke test verified
Phase 7: Cutover Legacy Flow - implemented and runtime smoke test verified
Phase 8: Stabilization dan API Handoff - implemented
```

## 2. Prinsip Teknis

- WordPress DB menjadi source of truth untuk Playbook Master dan semua master component.
- GoPhish hanya menerima snapshot final saat Campaign Run disync.
- Campaign Run lama tidak berubah walaupun master data diperbarui.
- Secret SMTP/API tidak disimpan sebagai plain data di WordPress.
- Sync ke GoPhish harus idempotent agar retry tidak membuat duplicate campaign.
- UI existing diabaikan dulu; prioritas awal adalah backend, schema, service, dan REST API.

## 3. Tahapan Implementasi

### Phase 1: Database Core

Tujuan: menambahkan struktur data baru tanpa merusak flow lama.

Tambahkan tabel:

```text
pukat_playbook_masters
pukat_email_template_masters
pukat_email_template_versions
pukat_landing_page_masters
pukat_landing_page_versions
pukat_sending_profile_refs
pukat_dynamic_domains
pukat_campaign_runs
```

Kebutuhan utama:

- Status lifecycle.
- Version field.
- Audit metadata: created_by, updated_by, approved_by, timestamps.
- JSON fields untuk rules, metrics, allowed overrides, capture settings, sync state, dan snapshot.
- Migration via `Activator::maybe_upgrade()`.

Deliverable:

- Schema baru tersedia saat plugin upgrade/activation.
- Flow lama masih tetap berjalan.

### Phase 2: Master Component Backend

Tujuan: membuat backend untuk component master di WordPress.

Implementasi:

- Repository + Service + Controller untuk Email Template Master.
- Repository + Service + Controller untuk Landing Page Master.
- Repository + Service + Controller untuk Sending Profile Reference.
- Repository + Service + Controller untuk Dynamic Domain Master.

Requirement penting:

- Email template dan landing page memiliki versioning.
- Approval dilakukan per version.
- Sending Profile Reference hanya menyimpan metadata dan GoPhish sending profile ID.
- Dynamic Domain menyimpan authorization status, DNS status, TLS status, dan allowed usage.

Deliverable:

- REST endpoint master component tersedia.
- Component master bisa dibuat dan dipilih oleh Playbook Master.
- Belum wajib sync ke GoPhish di phase ini.

### Phase 3: Playbook Master Backend

Tujuan: mengganti konsep playbook lama dengan Playbook Master yang sesuai PRD.

Endpoint target:

```text
GET    /wp-json/pukat/v1/playbook-masters
POST   /wp-json/pukat/v1/playbook-masters
GET    /wp-json/pukat/v1/playbook-masters/{id}
PUT    /wp-json/pukat/v1/playbook-masters/{id}
POST   /wp-json/pukat/v1/playbook-masters/{id}/duplicate
POST   /wp-json/pukat/v1/playbook-masters/{id}/submit-review
POST   /wp-json/pukat/v1/playbook-masters/{id}/approve
POST   /wp-json/pukat/v1/playbook-masters/{id}/archive
```

Validasi:

- Email Template Version wajib Approved atau Active.
- Landing Page Version wajib Approved atau Active.
- Sending Profile Reference wajib Active.
- Dynamic Domain wajib Active dan authorized jika digunakan.
- Playbook Master tidak bisa Active jika component wajib belum lengkap.

Deliverable:

- Playbook Master CRUD tersedia.
- Lifecycle minimal berjalan.
- Playbook Master bisa mereferensikan component master.

### Phase 4: Campaign Run dan Snapshot

Tujuan: membuat instance eksekusi dari Playbook Master.

Endpoint target:

```text
GET    /wp-json/pukat/v1/campaign-runs
POST   /wp-json/pukat/v1/campaign-runs
GET    /wp-json/pukat/v1/campaign-runs/{id}
POST   /wp-json/pukat/v1/campaign-runs/{id}/lock-snapshot
```

Flow:

```text
User pilih Playbook Master Active
-> Create Campaign Run
-> Sistem ambil default component
-> User isi target, schedule, timezone, dan override yang diizinkan
-> Pre-launch validation
-> Lock snapshot
```

Snapshot minimal menyimpan:

- Source playbook ID dan version.
- Email template subject/body final.
- Landing page HTML/content final.
- Sending profile reference metadata dan GoPhish ID.
- Dynamic domain final.
- Target segment/group reference.
- Schedule dan timezone.

Deliverable:

- Campaign Run dapat dibuat dari Playbook Master.
- Snapshot terkunci dan tidak berubah akibat update master.

### Phase 5: Sync Orchestrator ke GoPhish

Tujuan: mengirim snapshot final ke GoPhish.

Status saat ini: backend dan REST API sudah diimplementasikan. Verifikasi runtime sudah memastikan failure path tanpa konfigurasi GoPhish ditangani dengan benar (`sync_failed` + `sync_state_json` gagal tercatat). Success path penuh masih perlu GoPhish aktif, API key valid, sending profile GoPhish valid, dan target group/target list tersedia.

Endpoint target:

```text
POST /wp-json/pukat/v1/campaign-runs/{id}/sync
POST /wp-json/pukat/v1/campaign-runs/{id}/launch
POST /wp-json/pukat/v1/campaign-runs/{id}/cancel
GET  /wp-json/pukat/v1/campaign-runs/{id}/results
```

Sync steps:

```text
1. Create email template snapshot di GoPhish
2. Create landing page snapshot di GoPhish
3. Resolve sending profile GoPhish ID
4. Resolve/create target group di GoPhish
5. Create campaign di GoPhish
6. Save GoPhish IDs ke Campaign Run
7. Update sync_state_json
```

Requirement:

- Idempotent per Campaign Run.
- Menyimpan checkpoint setiap step.
- Retry aman jika sync gagal di tengah.
- Tidak membuat duplicate GoPhish campaign jika campaign sudah tercipta.
- Audit log untuk sync started, step completed, sync failed, sync completed.

Deliverable:

- Campaign Run tersync ke GoPhish dari snapshot.
- GoPhish campaign ID tersimpan di WordPress.

### Phase 6: Reporting dan Result Sync

Tujuan: menghubungkan hasil GoPhish ke Campaign Run baru.

Status saat ini: backend result sync, report endpoint, export endpoint, risk score link ke `campaign_run_id`, dan cron Campaign Run sync sudah diimplementasikan. Verifikasi runtime memakai stub GoPhish berhasil memastikan metrics, risk score, report, export, dan cron path berjalan.

Implementasi:

- Extend cron result sync agar membaca `pukat_campaign_runs`.
- Ambil GoPhish results dari `gophish_campaign_id`.
- Simpan/derive metrics untuk Campaign Run.
- Hubungkan risk scoring ke Campaign Run.

Endpoint tambahan:

```text
POST /wp-json/pukat/v1/campaign-runs/{id}/sync-results
GET  /wp-json/pukat/v1/campaign-runs/{id}/report
GET  /wp-json/pukat/v1/reports/campaign-runs/{id}
GET  /wp-json/pukat/v1/reports/campaign-runs/{id}/export
```

Deliverable:

- Campaign Run memiliki metrics aktual.
- Report bisa memakai flow baru tanpa bergantung ke `pukat_campaigns` lama.

### Phase 7: Cutover Legacy Flow

Tujuan: memindahkan operasional dari flow lama ke flow baru.

Status saat ini: endpoint legacy tetap hidup tetapi diberi metadata/header deprecation, legacy launch diarahkan ke Campaign Run sebagai pengganti, GoPhish proxy diberi mode admin/debug, dan adapter migrasi legacy playbook ke Playbook Master sudah tersedia serta idempotent.

Langkah:

- Mark endpoint lama `/playbooks` sebagai legacy.
- Mark launch lama `/campaigns/{id}/launch` sebagai legacy.
- Tambahkan adapter/migration optional dari `pukat_playbooks` lama ke `pukat_playbook_masters`.
- GoPhish proxy tetap boleh ada untuk admin/debug, tetapi bukan source of truth master asset.

Endpoint transisi:

```text
POST /wp-json/pukat/v1/playbooks/{id}/migrate-to-master
```

Catatan migrasi:

- Playbook Master hasil migrasi dibuat sebagai `draft`.
- Legacy GoPhish asset IDs disimpan di `rules.legacy`.
- `legacy_playbook_id` disimpan di `pukat_playbook_masters` agar migrasi aman diulang tanpa duplikasi.

Deliverable:

- Flow baru menjadi jalur utama.
- Flow lama tetap tidak langsung rusak.

### Phase 8: Stabilization dan API Handoff

Tujuan: menyiapkan hasil implementasi backend agar bisa dipakai UI, QA, dan integrasi GoPhish nyata.

Status saat ini: dokumen handoff API sudah dibuat di `docs/API_HANDOFF.md`. Dokumen tersebut merangkum flow utama UI, endpoint master component, Playbook Master, Campaign Run, reporting, legacy compatibility, prerequisite GoPhish real verification, QA checklist, dan known gaps. Runtime smoke runner juga tersedia di `tools/smoke-playbook-master.php`.

Deliverable:

- Kontrak endpoint flow baru terdokumentasi.
- QA checklist tersedia.
- Runtime smoke runner tersedia.
- Legacy behavior dan replacement endpoint terdokumentasi.
- Gap sebelum production cutover terdokumentasi.

## 4. Urutan MVP

MVP backend yang paling masuk akal:

1. Schema baru.
2. Email Template Master + Version.
3. Landing Page Master + Version.
4. Sending Profile Reference.
5. Dynamic Domain basic.
6. Playbook Master.
7. Campaign Run + lock snapshot.
8. Sync Campaign Run ke GoPhish.
9. Basic result sync.
10. Legacy cutover.
11. Stabilization dan API handoff.

## 5. Yang Tidak Dilakukan di GoPhish

Kita tidak akan:

- Mengubah GoPhish database.
- Mengubah GoPhish source code.
- Membuat custom GoPhish plugin.
- Menambah endpoint GoPhish.
- Mengubah internal campaign lifecycle GoPhish.

GoPhish hanya menerima data via REST API:

- Email template.
- Landing page.
- Sending profile reference by ID/name.
- Target group.
- Campaign.

## 6. Risiko Implementasi

| Risiko | Mitigasi |
|---|---|
| Flow lama rusak saat schema baru masuk | Tambahkan tabel baru tanpa mengubah tabel lama di phase awal |
| Duplicate campaign di GoPhish saat retry sync | Simpan checkpoint dan GoPhish campaign ID di `sync_state_json` |
| Master berubah setelah run dibuat | Campaign Run wajib memakai `snapshot_json` |
| Secret SMTP bocor ke WordPress/browser | WordPress hanya menyimpan reference; response SMTP tidak mengandung password |
| Data model terlalu besar untuk sekali implement | Kerjakan phase kecil dengan acceptance criteria jelas |
| Report lama dan baru bentrok | Tambahkan support Campaign Run baru sebelum deprecate `pukat_campaigns` |

## 7. Acceptance Criteria Awal

Phase awal dianggap berhasil jika:

- Tabel baru berhasil dibuat tanpa menghapus/mengubah data lama.
- Email template dan landing page bisa punya beberapa version.
- Playbook Master bisa Active hanya jika component wajib valid.
- Campaign Run bisa dibuat dari Playbook Master dan memiliki snapshot terkunci.
- Snapshot bisa disync ke GoPhish dan menghasilkan GoPhish campaign ID.
- Retry sync tidak membuat duplicate campaign.
- GoPhish tetap berjalan vanilla/as-is.
