# API Handoff: Playbook Master Flow

Dokumen ini merangkum kontrak backend Playbook Master setelah Phase 1-7 selesai. Fokusnya untuk UI, QA, dan integrasi operasional.

## 1. Prinsip Integrasi

- WordPress/Pukat adalah source of truth untuk Playbook Master dan master component.
- GoPhish dipakai sebagai execution engine saat Campaign Run sudah memiliki snapshot final.
- Flow lama `/playbooks` dan `/campaigns` masih hidup sebagai legacy compatibility.
- UI baru harus memakai `/playbook-masters`, `/master/*`, dan `/campaign-runs`.
- GoPhish proxy `/gophish/*` hanya untuk admin/debug, bukan untuk membuat master data baru dalam flow utama.

## 2. Flow Utama UI

```text
1. Buat master component
2. Approve versi email template dan landing page
3. Buat Playbook Master
4. Submit review / approve / activate Playbook Master
5. Buat Campaign Run dari Playbook Master active
6. Lock snapshot
7. Sync Campaign Run ke GoPhish
8. Launch / schedule Campaign Run
9. Sync results
10. Baca report
```

## 3. Master Component Endpoints

Email template:

```text
GET    /wp-json/pukat/v1/master/email-templates
POST   /wp-json/pukat/v1/master/email-templates
GET    /wp-json/pukat/v1/master/email-templates/{id}
PUT    /wp-json/pukat/v1/master/email-templates/{id}
POST   /wp-json/pukat/v1/master/email-templates/{id}/versions
PUT    /wp-json/pukat/v1/master/email-template-versions/{id}
POST   /wp-json/pukat/v1/master/email-template-versions/{id}/approve
```

Landing page:

```text
GET    /wp-json/pukat/v1/master/landing-pages
POST   /wp-json/pukat/v1/master/landing-pages
GET    /wp-json/pukat/v1/master/landing-pages/{id}
PUT    /wp-json/pukat/v1/master/landing-pages/{id}
POST   /wp-json/pukat/v1/master/landing-pages/{id}/versions
PUT    /wp-json/pukat/v1/master/landing-page-versions/{id}
POST   /wp-json/pukat/v1/master/landing-page-versions/{id}/approve
```

Sending profile reference:

```text
GET    /wp-json/pukat/v1/master/sending-profiles
POST   /wp-json/pukat/v1/master/sending-profiles
GET    /wp-json/pukat/v1/master/sending-profiles/{id}
PUT    /wp-json/pukat/v1/master/sending-profiles/{id}
POST   /wp-json/pukat/v1/master/sending-profiles/{id}/validate-gophish
```

Dynamic domain:

```text
GET    /wp-json/pukat/v1/master/dynamic-domains
POST   /wp-json/pukat/v1/master/dynamic-domains
GET    /wp-json/pukat/v1/master/dynamic-domains/{id}
PUT    /wp-json/pukat/v1/master/dynamic-domains/{id}
POST   /wp-json/pukat/v1/master/dynamic-domains/{id}/health-check
```

## 4. Playbook Master Endpoints

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

Required references before ready/active:

- `default_email_template_version_id`: email template version with `approved` or `active` status.
- `default_landing_page_version_id`: landing page version with `approved` or `active` status.
- `default_sending_profile_ref_id`: sending profile reference with `active` status and valid GoPhish sending profile ID.
- `default_dynamic_domain_id`: optional, but if used it must be `active` and `authorized`.

UI should show `readiness.ready` and `readiness.errors` from the response before allowing activation.

## 5. Campaign Run Endpoints

```text
GET    /wp-json/pukat/v1/campaign-runs
POST   /wp-json/pukat/v1/campaign-runs
GET    /wp-json/pukat/v1/campaign-runs/{id}
POST   /wp-json/pukat/v1/campaign-runs/{id}/lock-snapshot
POST   /wp-json/pukat/v1/campaign-runs/{id}/sync
POST   /wp-json/pukat/v1/campaign-runs/{id}/launch
POST   /wp-json/pukat/v1/campaign-runs/{id}/cancel
GET    /wp-json/pukat/v1/campaign-runs/{id}/results
POST   /wp-json/pukat/v1/campaign-runs/{id}/sync-results
GET    /wp-json/pukat/v1/campaign-runs/{id}/report
```

Minimum create payload:

```json
{
  "playbook_master_id": 1,
  "name": "Security Awareness - Finance - Aug 2026",
  "target_group_name": "Finance Targets",
  "schedule_at": "2026-08-10 09:00:00",
  "timezone": "Asia/Jakarta"
}
```

Important behavior:

- `lock-snapshot` freezes current playbook and component content into `snapshot`.
- `sync` can auto-lock if the run is still unlocked and has enough target data.
- Retry `sync` is intended to be idempotent using stored GoPhish IDs and deterministic asset names.
- `sync-results` pulls GoPhish results, stores `metrics`, and derives risk scores linked to `campaign_run_id`.

## 6. Reporting Endpoints

Campaign Run report:

```text
GET /wp-json/pukat/v1/reports/campaign-runs/{id}
GET /wp-json/pukat/v1/reports/campaign-runs/{id}/export
```

Legacy campaign report remains:

```text
GET /wp-json/pukat/v1/reports/{campaign_id}
GET /wp-json/pukat/v1/reports/{campaign_id}/export
```

Risk score filter supports new flow:

```text
GET /wp-json/pukat/v1/risk-scores?campaign_run_id={id}
```

## 7. Legacy Compatibility

Legacy endpoints remain available:

```text
GET/POST /wp-json/pukat/v1/playbooks
POST     /wp-json/pukat/v1/campaigns/{id}/launch
```

They return legacy metadata and headers:

```text
X-Pukat-Legacy: true
X-Pukat-Replacement: {successor endpoint URL}
Deprecation: true
```

Migration endpoint:

```text
POST /wp-json/pukat/v1/playbooks/{id}/migrate-to-master
```

Migration notes:

- Creates a Playbook Master in `draft`.
- Stores old GoPhish asset IDs under `rules.legacy`.
- Stores `legacy_playbook_id` to prevent duplicate migration.

## 8. GoPhish Real Verification Prerequisites

Before a full end-to-end sync test:

- `pukat_gophish_url` is configured.
- `pukat_gophish_api_key` is configured and valid.
- Sending profile reference points to an existing GoPhish sending profile ID.
- Target group named in Campaign Run exists in GoPhish, or target snapshot support is added for group creation.
- Dynamic domain base URL is reachable if used.

Expected full path:

```text
Campaign Run ready_for_sync
-> sync
-> synced with GoPhish template/page/group/campaign IDs
-> launch
-> scheduled or running
-> sync-results
-> metrics and risk scores populated
```

## 9. QA Checklist

Quick runtime smoke:

```bash
docker exec -i wordpress_app php wp-content/plugins/Pukat/tools/smoke-playbook-master.php
```

Expected output:

```text
pukat_smoke=ok
db_version=1.3.0
campaign_run_status=sync_failed
legacy_migration=ok
```

- Create email template master and approve a version.
- Create landing page master and approve a version.
- Create sending profile reference with GoPhish ID.
- Create dynamic domain with `authorized` and `active`.
- Create Playbook Master as draft.
- Confirm readiness errors when required components are missing.
- Submit review, approve, and activate Playbook Master.
- Create Campaign Run from active Playbook Master.
- Lock snapshot and confirm later master edits do not change it.
- Sync without GoPhish config and confirm `sync_failed`.
- Sync with stubbed or real GoPhish and confirm GoPhish IDs are stored.
- Refresh results and confirm `metrics_json` and `pukat_risk_scores.campaign_run_id`.
- Confirm legacy endpoints return legacy headers.
- Confirm legacy playbook migration is idempotent.

## 10. Known Gaps Before Production Cutover

- Full GoPhish success path still needs a real configured GoPhish runtime.
- Target segment to concrete target snapshot is not fully implemented yet.
- Campaign Run UI still needs to consume these new endpoints.
- PHPUnit coverage has not been added for these backend services.
