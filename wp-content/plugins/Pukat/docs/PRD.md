# PRD: Playbook Master & GoPhish Campaign Orchestration

## 1. Ringkasan

Pukat membutuhkan model playbook yang bertindak sebagai master utama untuk skenario simulasi phishing awareness. Playbook tidak diperlakukan sebagai campaign sekali pakai, melainkan sebagai blueprint standar yang dapat digunakan berkali-kali untuk membuat campaign run.

WordPress menjadi system of record untuk master data, versioning, approval, audit, dan orchestration. GoPhish tetap digunakan sebagai campaign runner untuk pengiriman email, landing page runtime, tracking event, dan campaign execution.

Prinsip utama:

- Playbook Master disimpan di database WordPress.
- Email Template Master, Landing Page Master, Sending Profile Reference, dan Dynamic Domain Master juga disimpan di WordPress sebagai master data terpisah.
- GoPhish hanya menerima snapshot final saat playbook dibuat menjadi campaign run.
- Campaign run yang sudah dibuat tidak berubah walaupun master playbook atau komponennya diperbarui.
- Secret seperti SMTP password dan API key tidak disimpan sebagai plain data di WordPress.

## 2. Tujuan Produk

Tujuan fitur ini adalah menyediakan sistem playbook phishing simulation yang reusable, terkontrol, dan aman untuk operasional security awareness.

Target outcome:

- Tim dapat membuat standar campaign melalui Playbook Master.
- Tim dapat memilih email template, landing page, sending profile, dan domain dari master data WordPress.
- Tim dapat membuat campaign run dari playbook tanpa konfigurasi ulang dari nol.
- Campaign run memiliki snapshot final yang konsisten dan dapat diaudit.
- GoPhish tetap menjadi engine eksekusi tanpa menjadi sumber utama master data.

## 3. Definisi Utama

### 3.1 Playbook Master

Playbook Master adalah blueprint utama untuk campaign. Ia menyimpan standar, default, aturan, dan referensi ke komponen master.

Contoh:

```text
Playbook Master:
- Password Reset Simulation
- Default Email Template: Password Expiry v3
- Default Landing Page: Awareness Login v2
- Default Sending Profile: awareness-internal-smtp
- Default Dynamic Domain: awareness.company.test
- Difficulty: 3
- Status: Active
```

### 3.2 Campaign Run

Campaign Run adalah instance eksekusi aktual yang dibuat dari Playbook Master. Campaign Run menyimpan snapshot final, target aktual, jadwal aktual, GoPhish campaign ID, dan hasil tracking.

Contoh:

```text
Campaign Run:
- Password Reset Simulation - Finance - Aug 2026
- Source Playbook: Password Reset Simulation v1
- Snapshot Email Template: Password Expiry v3
- Snapshot Landing Page: Awareness Login v2
- Snapshot Sending Profile: awareness-internal-smtp
- Snapshot Domain: awareness.company.test
- Target: Finance Department
- GoPhish Campaign ID: 34
```

### 3.3 Master Component

Master Component adalah data induk yang bisa digunakan oleh satu atau banyak playbook.

Komponen master:

- Email Template Master
- Landing Page Master
- Sending Profile Reference
- Dynamic Domain Master

## 4. Scope

### 4.1 In Scope

- CRUD Playbook Master.
- CRUD Email Template Master dengan versioning.
- CRUD Landing Page Master dengan versioning.
- CRUD Sending Profile Reference tanpa menyimpan secret mentah.
- CRUD Dynamic Domain Master untuk domain yang sudah diotorisasi.
- Relasi Playbook Master ke master component.
- Lifecycle approval Playbook Master.
- Pembuatan Campaign Run dari Playbook Master.
- Snapshot Campaign Run.
- Sync snapshot ke GoPhish.
- Penyimpanan GoPhish IDs di WordPress.
- Audit log untuk perubahan dan eksekusi.

### 4.2 Out of Scope untuk MVP

- Visual drag-and-drop email builder.
- Visual landing page builder kompleks.
- Secret manager eksternal penuh.
- AI template generator.
- Recommendation engine untuk skenario campaign.
- Full bi-directional sync dari GoPhish ke WordPress.
- Multi-tenant billing atau licensing.

## 5. Aktor dan Role

_4 aktor di bawah tetap valid secara konseptual, tapi implementasi akses sejak `docs/PRD_RBAC.md` bukan lagi 4 role tetap — sistem RBAC generik dengan role dinamis dan permission per menu/action. Admin/Operator/Reviewer/Viewer di sini dipetakan jadi 4 default seeded role (lihat `docs/PRD_RBAC.md` §8); admin bisa membuat role custom lain lewat `Admin/Roles.jsx`._

### 5.1 Admin

Dapat mengelola semua master data, konfigurasi GoPhish, approval policy, user access, dan audit log.

### 5.2 Operator

Dapat membuat draft playbook, memilih master component, membuat campaign run, dan melihat status campaign sesuai permission.

### 5.3 Reviewer / Approver

Dapat melakukan review dan approval terhadap Playbook Master atau Campaign Run sebelum disync ke GoPhish.

### 5.4 Viewer

Dapat melihat playbook, campaign run, dan report tanpa melakukan perubahan.

## 6. Alur Produk

### 6.1 Alur Master Data

```text
Admin/Operator membuat master component
-> Email Template Master
-> Landing Page Master
-> Sending Profile Reference
-> Dynamic Domain Master
-> Set status Draft / Review / Approved / Active
```

### 6.2 Alur Playbook Master

```text
Buat Playbook Master
-> Pilih default Email Template version
-> Pilih default Landing Page version
-> Pilih default Sending Profile Reference
-> Pilih default Dynamic Domain / Domain Pool
-> Set difficulty, objective, scenario, metrics, rules
-> Submit Review
-> Approved
-> Active
```

### 6.3 Alur Campaign Run

```text
User pilih Playbook Master yang Active
-> Create Campaign Run
-> Sistem mengambil default component dari playbook
-> User mengisi target, jadwal, dan override yang diizinkan
-> Pre-launch validation
-> Lock snapshot
-> Sync snapshot ke GoPhish
-> Simpan GoPhish IDs
-> Campaign Scheduled / Running
-> Ambil hasil tracking
-> Campaign Completed
```

### 6.4 Kapan Sync ke GoPhish

Sync ke GoPhish dilakukan saat Playbook Master yang sudah approved dibuat menjadi Campaign Run dan snapshot dikunci.

Sync tidak dilakukan saat:

- Draft playbook disimpan.
- Email template draft diedit.
- Landing page draft diedit.
- Master component belum approved.
- Playbook masih dalam review.

Rekomendasi default:

```text
Sync saat Campaign Run dibuat, lalu campaign dijadwalkan di GoPhish.
```

Alasan:

- Menghindari GoPhish penuh dengan draft yang belum dipakai.
- Campaign sudah bisa divalidasi sebelum hari pelaksanaan.
- Jika sync gagal, tim masih punya waktu memperbaiki sebelum jadwal launch.

## 7. Lifecycle dan Status

### 7.1 Playbook Master Status

```text
Draft -> Review -> Approved -> Active -> Deprecated -> Archived
```

Definisi:

- Draft: masih bisa diedit bebas.
- Review: menunggu persetujuan.
- Approved: sudah disetujui, belum tentu aktif.
- Active: bisa dipakai membuat Campaign Run.
- Deprecated: tidak disarankan untuk campaign baru, campaign lama tetap tersimpan.
- Archived: disembunyikan dari pilihan operasional.

### 7.2 Master Component Status

```text
Draft -> Review -> Approved -> Active -> Deprecated -> Archived
```

Komponen hanya bisa dipakai di Playbook Master aktif jika statusnya Approved atau Active.

### 7.3 Campaign Run Status

```text
Draft Run -> Ready for Sync -> Syncing -> Synced -> Scheduled -> Running -> Completed -> Archived
```

Status error:

```text
Sync Failed
Launch Failed
Cancelled
```

## 8. Requirement Fungsional

### 8.1 Playbook Master

Sistem harus menyediakan:

- Membuat, melihat, mengubah, menduplikasi, deprecate, dan archive Playbook Master.
- Menyimpan objective, scenario, difficulty, risk level, default metrics, dan notes.
- Menghubungkan Playbook Master ke Email Template version.
- Menghubungkan Playbook Master ke Landing Page version.
- Menghubungkan Playbook Master ke Sending Profile Reference.
- Menghubungkan Playbook Master ke Dynamic Domain Master atau Domain Pool.
- Menentukan rules seperti max recipients, allowed entity, allowed target segment, cooldown period, dan required approval.
- Menampilkan status kelengkapan playbook sebelum bisa diaktifkan.

Acceptance criteria:

- Playbook Master tidak bisa Active jika komponen wajib belum dipilih.
- Playbook Master tidak bisa Active jika komponen wajib masih Draft.
- Perubahan Playbook Master tidak mengubah Campaign Run yang sudah dibuat.
- Playbook Master bisa diduplikasi untuk membuat variasi baru.

### 8.2 Email Template Master

Sistem harus menyediakan:

- Membuat template email master.
- Membuat versi baru dari template email.
- Menyimpan subject, HTML body, text body opsional, variables, language, category, difficulty indicator, dan owner entity.
- Preview email dengan sample target data.
- Validasi variable placeholder.
- Approval per version.

Acceptance criteria:

- Hanya version Approved atau Active yang bisa dipilih ke Playbook Master aktif.
- Versi lama tetap tersedia untuk audit.
- Campaign Run menyimpan snapshot subject dan body yang dipakai saat run dibuat.

### 8.3 Landing Page Master

Sistem harus menyediakan:

- Membuat landing page master.
- Membuat versi baru dari landing page.
- Menyimpan HTML/content, capture setting, redirect/debrief behavior, language, category, dan owner entity.
- Preview desktop dan mobile.
- Validasi form behavior untuk awareness simulation.
- Approval per version.

Acceptance criteria:

- Hanya version Approved atau Active yang bisa dipilih ke Playbook Master aktif.
- Campaign Run menyimpan snapshot landing page HTML/content.
- Landing page tidak menyimpan credential asli target.
- Submit form hanya mencatat event sesuai kebutuhan awareness.

### 8.4 Sending Profile Reference

Sistem harus menyediakan:

- Membuat Sending Profile Reference di WordPress.
- Menyimpan display name, from name, from email, reply-to, environment, allowed domains, rate limit metadata, dan GoPhish sending profile ID.
- Validasi mapping ke sending profile yang ada di GoPhish.
- Menandai profile sebagai Active, Inactive, atau Deprecated.

Data yang tidak boleh disimpan sebagai plain data:

- SMTP password.
- API token SMTP provider.
- Private key.
- Credential GoPhish.

Acceptance criteria:

- Campaign Run hanya menyimpan snapshot metadata dan GoPhish sending profile ID.
- Secret tetap berada di GoPhish, encrypted WordPress settings, environment variable, atau secret manager.
- Sending profile yang Inactive tidak bisa dipakai untuk Campaign Run baru.

### 8.5 Dynamic Domain Master

Sistem harus menyediakan:

- Membuat master domain atau domain pool.
- Menyimpan domain name, base landing URL, tracking URL, environment, owner entity, status, dan allowed playbooks.
- Menyimpan status ownership/authorization.
- Menyimpan DNS health check status.
- Menyimpan TLS health check status.
- Mengatur domain mana yang boleh dipasangkan dengan sending profile tertentu.

Acceptance criteria:

- Hanya domain yang authorized dan Active yang bisa dipakai Campaign Run.
- Campaign Run menyimpan snapshot domain yang dipakai.
- Domain yang sudah dipakai campaign lama tetap tercatat walaupun master domain di-deprecate.
- Sistem menolak domain yang belum tervalidasi authorization-nya.

### 8.6 Campaign Run

Sistem harus menyediakan:

- Membuat Campaign Run dari Playbook Master.
- Mengambil default component dari Playbook Master.
- Mengizinkan override hanya untuk field yang diperbolehkan oleh rule playbook.
- Memilih target group atau segment.
- Mengatur schedule dan timezone.
- Menjalankan pre-launch checklist.
- Mengunci snapshot sebelum sync.
- Sync snapshot ke GoPhish.
- Menyimpan GoPhish IDs untuk template, landing page, sending profile, group, dan campaign.
- Mengambil status campaign dan hasil tracking dari GoPhish.

Acceptance criteria:

- Campaign Run tidak bisa disync jika snapshot belum lengkap.
- Campaign Run yang sudah Synced tidak bisa mengubah snapshot tanpa membuat revision run baru.
- Campaign Run menyimpan source playbook version.
- Campaign Run dapat dilacak dari WordPress ke campaign ID GoPhish.

### 8.7 Sync ke GoPhish

Sistem harus menyediakan sync orchestration:

- Create atau update email template snapshot di GoPhish.
- Create atau update landing page snapshot di GoPhish.
- Resolve sending profile ID di GoPhish.
- Resolve target group di GoPhish.
- Create campaign di GoPhish.
- Save response GoPhish ke Campaign Run.
- Retry sync jika gagal pada step yang aman diulang.

Acceptance criteria:

- Sync failure menampilkan step yang gagal dan pesan error.
- Sync bersifat idempotent untuk Campaign Run yang sama.
- Sistem tidak membuat duplicate campaign di GoPhish jika retry dilakukan setelah campaign berhasil dibuat.
- Semua request dan response penting dicatat di audit log tanpa secret.

## 9. Requirement Non-Fungsional

### 9.1 Security

- GoPhish API key tidak pernah dikirim ke browser.
- Secret disimpan terenkripsi atau di luar WordPress DB jika memungkinkan.
- Role-based access diterapkan untuk semua endpoint.
- WP nonce diterapkan untuk request dari browser.
- Audit log wajib untuk create, update, approve, sync, launch, cancel, dan archive.
- Sistem tidak menyimpan password asli dari target simulasi.
- Domain dan target harus berada dalam scope yang sudah diotorisasi.

### 9.2 Reliability

- Sync ke GoPhish harus memiliki retry strategy.
- Campaign Run harus menyimpan checkpoint per sync step.
- Campaign Run harus bisa dipulihkan jika sync terputus.
- Snapshot tidak boleh berubah setelah status Synced kecuali melalui mekanisme revision.

### 9.3 Performance

- List Playbook Master harus dapat difilter dan dipaginasi.
- Campaign Run dengan target besar harus diproses secara batch.
- Import target 1.000+ baris harus selesai kurang dari 30 detik untuk validasi awal.

### 9.4 Auditability

- Setiap master data menyimpan created_by, updated_by, approved_by, created_at, updated_at, approved_at.
- Campaign Run menyimpan source version dari setiap komponen.
- Semua perubahan status tersimpan sebagai audit event.

## 10. Model Data Konseptual

### 10.1 Tabel Master

```text
pukat_playbook_masters
- id
- name
- description
- objective
- scenario
- difficulty
- risk_level
- default_email_template_version_id
- default_landing_page_version_id
- default_sending_profile_ref_id
- default_dynamic_domain_id
- allowed_overrides_json
- rules_json
- metrics_json
- entity
- status
- version
- created_by
- updated_by
- approved_by
- created_at
- updated_at
- approved_at
```

```text
pukat_email_template_masters
- id
- name
- category
- entity
- status
- created_by
- updated_by
- created_at
- updated_at
```

```text
pukat_email_template_versions
- id
- template_master_id
- version
- subject
- html_body
- text_body
- variables_json
- language
- status
- approved_by
- approved_at
- created_at
- updated_at
```

```text
pukat_landing_page_masters
- id
- name
- category
- entity
- status
- created_by
- updated_by
- created_at
- updated_at
```

```text
pukat_landing_page_versions
- id
- landing_page_master_id
- version
- html_body
- capture_settings_json
- redirect_settings_json
- variables_json
- language
- status
- approved_by
- approved_at
- created_at
- updated_at
```

```text
pukat_sending_profile_refs
- id
- name
- from_name
- from_email
- reply_to
- gophish_sending_profile_id
- environment
- allowed_domains_json
- rate_limit_json
- entity
- status
- created_at
- updated_at
```

```text
pukat_dynamic_domains
- id
- domain
- base_landing_url
- tracking_url
- environment
- owner_entity
- authorization_status
- dns_status
- tls_status
- allowed_playbooks_json
- allowed_sending_profiles_json
- status
- created_at
- updated_at
```

### 10.2 Tabel Campaign Run

```text
pukat_campaign_runs
- id
- playbook_master_id
- playbook_version
- name
- target_segment_id
- schedule_at
- timezone
- status
- snapshot_json
- gophish_template_id
- gophish_page_id
- gophish_group_id
- gophish_sending_profile_id
- gophish_campaign_id
- sync_state_json
- metrics_json
- created_by
- launched_by
- created_at
- updated_at
- launched_at
- completed_at
```

Snapshot minimal:

```json
{
  "playbook": {
    "id": 1,
    "name": "Password Reset Simulation",
    "version": 1
  },
  "email_template": {
    "master_id": 10,
    "version_id": 31,
    "version": 3,
    "subject": "Password expiry notice",
    "html_body": "<html>...</html>"
  },
  "landing_page": {
    "master_id": 20,
    "version_id": 44,
    "version": 2,
    "html_body": "<html>...</html>"
  },
  "sending_profile": {
    "ref_id": 5,
    "name": "awareness-internal-smtp",
    "gophish_sending_profile_id": 7,
    "from_name": "Security Awareness",
    "from_email": "awareness@example.com"
  },
  "dynamic_domain": {
    "id": 8,
    "domain": "awareness.example.com",
    "base_landing_url": "https://awareness.example.com"
  }
}
```

## 11. API Requirement

Endpoint konseptual:

```text
GET    /wp-json/pukat/v1/playbook-masters
POST   /wp-json/pukat/v1/playbook-masters
GET    /wp-json/pukat/v1/playbook-masters/{id}
PUT    /wp-json/pukat/v1/playbook-masters/{id}
POST   /wp-json/pukat/v1/playbook-masters/{id}/submit-review
POST   /wp-json/pukat/v1/playbook-masters/{id}/approve
POST   /wp-json/pukat/v1/playbook-masters/{id}/archive
POST   /wp-json/pukat/v1/playbook-masters/{id}/duplicate
```

```text
GET    /wp-json/pukat/v1/master/email-templates
POST   /wp-json/pukat/v1/master/email-templates
POST   /wp-json/pukat/v1/master/email-templates/{id}/versions
POST   /wp-json/pukat/v1/master/email-template-versions/{id}/approve
```

```text
GET    /wp-json/pukat/v1/master/landing-pages
POST   /wp-json/pukat/v1/master/landing-pages
POST   /wp-json/pukat/v1/master/landing-pages/{id}/versions
POST   /wp-json/pukat/v1/master/landing-page-versions/{id}/approve
```

```text
GET    /wp-json/pukat/v1/master/sending-profiles
POST   /wp-json/pukat/v1/master/sending-profiles
POST   /wp-json/pukat/v1/master/sending-profiles/{id}/validate-gophish
```

```text
GET    /wp-json/pukat/v1/master/dynamic-domains
POST   /wp-json/pukat/v1/master/dynamic-domains
POST   /wp-json/pukat/v1/master/dynamic-domains/{id}/health-check
```

```text
GET    /wp-json/pukat/v1/campaign-runs
POST   /wp-json/pukat/v1/campaign-runs
GET    /wp-json/pukat/v1/campaign-runs/{id}
POST   /wp-json/pukat/v1/campaign-runs/{id}/lock-snapshot
POST   /wp-json/pukat/v1/campaign-runs/{id}/sync
POST   /wp-json/pukat/v1/campaign-runs/{id}/launch
POST   /wp-json/pukat/v1/campaign-runs/{id}/cancel
GET    /wp-json/pukat/v1/campaign-runs/{id}/results
```

## 12. UI Requirement

### 12.1 Playbook Master List

Harus menyediakan:

- Search by name, scenario, entity.
- Filter by status, difficulty, risk level, entity.
- Action: create, duplicate, edit, submit review, approve, deprecate, archive.
- Indicator kelengkapan komponen.

### 12.2 Playbook Master Detail

Harus menyediakan tab:

- Overview
- Components
- Rules
- Metrics
- Versions / Changelog
- Campaign Runs
- Audit Log

### 12.3 Master Component Pages

Halaman master component:

- Master Email Templates
- Master Landing Pages
- Master Sending Profiles
- Master Dynamic Domains

Setiap halaman menyediakan:

- List.
- Detail.
- Version list jika applicable.
- Preview.
- Status.
- Approval action.
- Usage reference: playbook mana saja yang memakai komponen tersebut.

### 12.4 Campaign Run Builder

Harus menyediakan:

- Pilih Playbook Master.
- Review default component.
- Pilih target.
- Pilih schedule.
- Override field jika diizinkan.
- Pre-launch checklist.
- Lock snapshot.
- Sync status.
- Link ke GoPhish campaign.

## 13. Pre-launch Checklist

Campaign Run tidak bisa disync atau launch sebelum checklist terpenuhi:

- Playbook Master status Active.
- Email Template version Approved atau Active.
- Landing Page version Approved atau Active.
- Sending Profile Reference Active dan valid di GoPhish.
- Dynamic Domain Active dan authorized.
- DNS/TLS domain sehat jika domain digunakan untuk landing/tracking.
- Target segment tidak kosong.
- Schedule valid.
- Timezone valid.
- Required approval terpenuhi.
- Campaign berada di luar blackout period.
- Max recipient rule tidak terlampaui.

## 14. Metrics

Metrics default yang dapat didefinisikan di Playbook Master:

- Email sent.
- Email opened.
- Link clicked.
- Form submitted.
- Reported phishing.
- Quiz assigned.
- Quiz completed.
- Risk score delta.

Campaign Run menyimpan nilai aktual metrics berdasarkan hasil GoPhish dan data Pukat.

## 15. Governance dan Safety

- Sistem hanya digunakan untuk simulasi awareness dalam scope organisasi yang sah.
- Domain harus dimiliki atau diotorisasi oleh organisasi.
- Target harus berasal dari segment yang disetujui.
- Landing page tidak boleh menyimpan password asli.
- Semua campaign harus memiliki owner dan approval yang jelas.
- Perubahan pada master data harus tercatat.
- Campaign yang sudah berjalan tidak boleh berubah akibat edit master.
- Data hasil campaign mengikuti retention policy organisasi.

## 16. MVP

MVP yang direkomendasikan:

1. Playbook Master CRUD.
2. Email Template Master + Version CRUD.
3. Landing Page Master + Version CRUD.
4. Sending Profile Reference CRUD.
5. Dynamic Domain Master CRUD sederhana.
6. Relasi Playbook Master ke komponen default.
7. Status Draft, Approved, Active, Archived.
8. Create Campaign Run dari Playbook Master.
9. Lock snapshot.
10. Sync snapshot ke GoPhish.
11. Simpan GoPhish campaign ID.
12. Basic audit log.

## 17. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Master berubah saat campaign berjalan | Campaign tidak konsisten | Campaign Run wajib memakai snapshot |
| GoPhish penuh data draft | Sulit dikelola | Sync hanya saat Campaign Run |
| Secret tersimpan di WordPress | Risiko keamanan tinggi | Simpan hanya reference, secret di GoPhish/encrypted settings/secret manager |
| Domain belum authorized | Risiko governance | Dynamic Domain wajib punya authorization status |
| Retry sync membuat duplicate campaign | Data kacau | Sync harus idempotent dan menyimpan checkpoint |
| Template variable salah | Email rusak saat dikirim | Validasi placeholder sebelum approval |

## 18. Open Questions

- Apakah approval dilakukan di level Playbook Master saja, atau juga wajib di Campaign Run?
- Apakah Dynamic Domain dipilih satu per campaign atau bisa domain pool per target segment?
- Apakah target segment master akan disimpan di WordPress atau tetap mengikuti GoPhish group?
- Apakah Campaign Run boleh melakukan override template/landing page dari default playbook?
- Apakah perlu menyimpan rendered HTML final per recipient, atau cukup snapshot template dan event tracking?

## 19. Keputusan Desain Saat Ini

- Playbook adalah master utama, bukan campaign sekali pakai.
- Master utama disimpan di database WordPress.
- GoPhish adalah execution engine, bukan source of truth master data.
- Landing page, email template, sending profile reference, dan dynamic domain adalah master data terpisah.
- Sync ke GoPhish terjadi saat Campaign Run dibuat dan snapshot dikunci.
- Campaign Run lama tidak ikut berubah ketika master diperbarui.
- Sending Profile di WordPress hanya reference, bukan tempat menyimpan SMTP secret mentah.
