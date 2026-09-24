# Implementation Plan: Entity Profile & Guardrails

Status: Draft
Date: 2026-09-22
Related PRD: `docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md`

**Catatan revisi (2026-09-25):** Phase 2 dan Phase 5 di bawah sudah diimplementasikan dengan model akses admin-only, yang ternyata salah — lihat catatan revisi di PRD. Perbaikan yang sudah diterapkan ke kode existing (bukan re-implementasi dari nol): (1) `PermissionRegistry.php` — `master_entities.edit` diturunkan dari `admin` ke `operator`, `.view` dari `admin` ke `shared`, `.create`/`.delete` tetap `admin`; (2) `EntityProfileService.php` — ditambah `current_user_can_access_entity()` dan diterapkan di `list()`/`get()`/`update()`/domain methods; (3) `EntityController.php` — permission callback untuk update/domain endpoints ganti dari `master_entities.delete`-tier ke `.edit`. Detail lengkap ada di bagian masing-masing fase di bawah, ditandai "(revisi)".

## 1. Ringkasan

Dua tabel baru (`pukat_entity_profiles`, `pukat_target_email_domains`), satu controller baru (`EntityController.php`), satu penyesuaian kecil di alur pembuatan Campaign Run (validasi domain email target + validasi entity domain landing page), dan satu halaman Master baru di frontend.

## 2. Dependency Order

```text
Phase 1: Schema — pukat_entity_profiles, pukat_target_email_domains
   |
   +-- Phase 2: Backend EntityController.php (CRUD profile + email-domains)     [butuh Phase 1]
   |
Phase 3: Guardrail domain email — validasi di CampaignRunService::create()      [butuh Phase 1]
   |
Phase 4: Guardrail domain landing page — penguatan validasi owner_entity        [independen, tidak butuh Phase 1]
   |
Phase 5: RBAC — capability master_entities.*, guardrails.bypass di PermissionRegistry.php   [butuh Phase 2]
   |
Phase 6: Frontend — Admin/MasterEntities.jsx + dropdown entity di form Master lain   [butuh Phase 2 + 5]
   |
Phase 7: QA end-to-end
```

Phase 4 independen — bisa dikerjakan paralel dengan Phase 1-3 karena hanya menyentuh titik validasi domain yang sudah ada di `CampaignRunService.php:1998-2007`, tidak butuh tabel baru.

## 3. Phase 1: Schema

**File:** `includes/Core/Activator.php`.

- Tambah dua `CREATE TABLE IF NOT EXISTS` (SQL persis di PRD §8) ke `create_tables()`.
- Tambah blok `maybe_upgrade()` versi baru untuk instalasi existing (pola identik migrasi tabel baru lain di file yang sama, mis. `pukat_campaign_groups`).
- **Tidak ada backfill/seed data** kecuali opsional satu baris `entity_name = 'General', status = 'active'` di `pukat_entity_profiles` supaya dropdown Phase 6 tidak kosong sejak awal (PRD §11).

**Acceptance Criteria:** `php -l` bersih; migration idempoten (jalan dua kali tidak error); kedua tabel muncul di DB dev.

## 4. Phase 2: Backend — EntityController.php

**File baru:** `includes/Api/EntityController.php`, `includes/Repositories/EntityProfileRepository.php`, `includes/Services/EntityProfileService.php` (pola 3-layer yang sama seperti resource lain — Repository untuk query, Service untuk validasi/business logic, Controller untuk REST plumbing).

- `EntityProfileService::create( array $params, int $user_id )`: validasi `entity_name` wajib, dedupe case-insensitive (`WHERE LOWER(entity_name) = LOWER(%s)` via `$wpdb->prepare()`), insert.
- `EntityProfileService::delete( int $id )`: **tidak** menyentuh tabel lain (PRD FR-3) — hapus baris `pukat_entity_profiles` saja. Tambahkan docblock eksplisit yang menjelaskan ini supaya developer berikutnya tidak "memperbaiki" jadi cascade delete tanpa sadar itu melanggar keputusan PRD §6.
- `EntityProfileService::add_email_domain( string $entity_name, string $domain )` / `remove_email_domain()` / `list_email_domains( string $entity_name )` — domain dinormalisasi `strtolower( trim( $domain ) )`, divalidasi regex domain dasar sebelum insert ke `pukat_target_email_domains`.
- Route registrasi persis seperti daftar di PRD §9, ditambahkan ke `includes/Core/Plugin.php`.

**Acceptance Criteria:** create/update/delete Entity Profile lewat REST berhasil; create dengan `entity_name` yang sudah ada (beda kapitalisasi) ditolak 409; tambah/hapus domain email berhasil dan ter-normalisasi lowercase.

## 5. Phase 3: Guardrail Domain Email di Campaign Run

**File:** `includes/Services/CampaignRunService.php`.

- Method baru `validate_target_email_domains( array $targets, string $entity ): array` — query `pukat_target_email_domains WHERE entity_name = %s AND status = 'active'`. Kalau hasil query **kosong** (entity belum dikonfigurasi), return `[]` (fail-open, PRD FR-6/§11). Kalau ada baris, untuk tiap target di `$targets`, ekstrak domain (`substr( strrchr( $email, '@' ), 1 )`), cek `in_array( strtolower( $domain ), $allowed_domains, true )` — kalau tidak, tambahkan ke array error `[ 'email' => ..., 'reason' => 'domain_not_allowed' ]`.
- Panggil method ini dari `create()` (baris ~72) setelah `snapshot_targets()` dipanggil/target final diketahui, **sebelum** insert ke `pukat_campaign_runs`. Kalau ada error dan request tidak menyertakan flag bypass (lihat Phase 5 untuk capability-nya): return `WP_Error( 'target_email_domain_forbidden', ..., [ 'status' => 422, 'details' => $errors ] )` — bukan generic error, frontend butuh `details` untuk highlight baris target yang bermasalah (PRD FR-7).
- Flag bypass: parameter baru `bypass_email_domain_guardrail: bool` di payload `create()`. Kalau `true` **dan** `current_user_can( PermissionRegistry::capability_for( 'guardrails.bypass' ) )`, lewati validasi tapi panggil `AuditLogService::log( 'guardrail.email_domain.bypassed', [ 'campaign_run_id' => $id, 'bypassed_emails' => array_column( $errors, 'email' ) ], $user_id )` (PRD FR-8 & §10).

**Acceptance Criteria:** target dengan domain tidak diizinkan ditolak dengan daftar email spesifik di response; entity tanpa allow-list tetap lolos (regression check terhadap seluruh flow Campaign Run existing — jalankan smoke test end-to-end yang sudah ada di `docs/IMPLEMENTATION_PLAN_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md` untuk memastikan tidak ada regresi).

## 6. Phase 4: Guardrail Domain Landing Page (penguatan)

**File:** `includes/Services/CampaignRunService.php`, sekitar baris 1998-2007 (`validate_playbook_ready()` atau method sejenis yang memvalidasi `default_dynamic_domain_id`).

- Tambah satu `elseif` baru setelah cek `authorization_status`: `elseif ( ! current_user_can_access_entity( $domain['owner_entity'], $user_id ) ) { $errors[] = __( 'Dynamic domain belongs to a different entity.', 'pukat' ); }` — reuse helper `current_user_can_access_entity()` yang sudah ada (`CampaignRunService.php:2147-2159`), bukan menulis ulang logic entity match.

**Acceptance Criteria:** domain `owner_entity = 'Finance'` gagal dipakai playbook milik entity `'HR'` (non-admin); admin tetap bisa pakai domain entity mana pun (bypass existing tidak berubah); regression check terhadap domain `owner_entity = 'General'` tetap bisa dipakai semua entity.

## 7. Phase 5: RBAC

**File:** `includes/Services/PermissionRegistry.php`, `includes/Core/Activator.php` (`seed_rbac_defaults()`).

- Tambah menu baru `master_entities` di grup "Master Library" (`view_gate: 'admin'`, actions `create`/`edit`/`delete` semua `'admin'` — governance-sensitive, konsisten dengan `master_sending_profiles`).
- Tambah satu action permission baru `guardrails.bypass` (bukan menu tersendiri — tidak ada halaman "Guardrails" terpisah, bypass ini adalah flag di alur create Campaign Run yang sudah ada) di bawah grup `campaigns` atau grup baru kecil, seed `'admin'`.
- `Activator::maybe_upgrade()`: blok versi baru men-seed default capability untuk role Admin existing (pola identik migrasi cap di versi sebelumnya).

**Acceptance Criteria:** role Operator tidak bisa akses `/entities/*`; role Admin bisa; capability `guardrails.bypass` cuma dimiliki Admin secara default.

## 8. Phase 6: Frontend

- `pukat-app/src/pages/Admin/MasterEntities.jsx` (pola identik `MasterDomains.jsx`) — tabel Entity Profile + form create/edit + sub-panel "Domain Email yang Diizinkan" per entity (list + tambah + hapus).
- `pukat-app/src/api/entities.js`, `hooks/queries/useEntities.js`, `hooks/mutations/useEntityMutations.js`.
- Form-form Master lain yang punya field `entity`/`ownerEntity` bebas ketik (`MasterDomains.jsx:49` dan sejenisnya di Email Template/Landing Page/Sending Profile/Playbook Master) diganti jadi `<Select>` dengan opsi dari `useEntities()`, **plus opsi "custom/lainnya"** yang tetap membuka text input bebas (PRD §6 — tidak boleh mem-block entity yang belum punya profile, hanya menyediakan kemudahan).
- Nav entry baru `master_entities` di `adminNavGroups`, gated `<PermissionRoute permission="master_entities.view">`.
- Saat create Campaign Run gagal dengan error `target_email_domain_forbidden`, UI wizard menampilkan daftar email bermasalah per baris (bukan toast generik) — dan kalau user punya `guardrails.bypass`, tampilkan opsi "Lanjutkan meski ada target di luar domain resmi" yang mengirim ulang request dengan `bypass_email_domain_guardrail: true`.

**Acceptance Criteria:** halaman Master Entities berfungsi penuh (CRUD + kelola domain email); dropdown entity di form lain menampilkan Entity Profile yang ada tapi tetap bisa diisi manual; error domain email di wizard menampilkan detail per-target, bukan pesan generik.

## 9. Phase 7: QA

- `npm run lint && npm run build && npm run test` dari `pukat-app`.
- REST smoke test: CRUD Entity Profile, CRUD email-domains, create Campaign Run dengan target valid/invalid/bypass.
- Regression end-to-end: jalankan alur Campaign Wizard penuh (Docker + GoPhish, pola `docs/IMPLEMENTATION_PLAN_CAMPAIGN_WIZARD_PLAYBOOK_FIRST.md`) untuk entity `"General"` tanpa allow-list domain — pastikan tidak ada perubahan behavior (fail-open harus benar-benar transparan untuk data yang belum dikonfigurasi).

## 10. Risiko

- Kalau ternyata ada kode lain (di luar `CampaignRunService.php`) yang juga membangun/mengirim daftar target langsung ke GoPhish tanpa lewat `create()`/`snapshot_targets()`, guardrail Phase 3 tidak akan tersentuh di jalur itu — perlu grep ulang `gp->create_group(` di seluruh `includes/` sebelum Phase 3 dianggap selesai untuk memastikan hanya satu jalur pembuatan target group yang ada.
