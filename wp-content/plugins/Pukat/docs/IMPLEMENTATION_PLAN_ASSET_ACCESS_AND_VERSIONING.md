# Implementation Plan: Asset Access Control and Version-Only Editing

Status: Draft
Date: 2026-07-27
Related PRD: `docs/PRD_ASSET_ACCESS_AND_VERSIONING.md`

Revision 2026-08-27: Selaras dengan PRD §5.8 Usage Lock. Edit sekarang **diblokir permanen** begitu asset punya baris `pukat_campaign_asset_usages` (bukan lagi "edit selalu boleh, campaign tetap pakai snapshot lama"). Assign/use asset ke campaign atau playbook baru tetap selalu boleh, tidak pernah dikunci. Bagian yang paling terdampak: §3.2, §6.1, §7.2, §8.5, §10.3 validation, §13.1, §13.2, §18.

## 1. Ringkasan

Implementation plan ini menerjemahkan PRD asset access/versioning menjadi tahapan teknis untuk backend WordPress/Pukat dan frontend React.

Target utama:

- Backend menjadi source of truth untuk view, use, edit, delete, archive, dan campaign snapshot.
- API mengembalikan `permissions` untuk UX frontend, tetapi mutation tetap validasi ulang di server.
- Asset `general` dapat dipakai semua user, tetapi hanya admin yang dapat mengelola.
- Asset `own` hanya dapat dikelola oleh owner.
- Edit asset selalu membuat versi/revision baru, tapi hanya jika asset belum pernah dipakai campaign/playbook.
- Edit dan delete terkunci permanen begitu asset punya usage; assign ke campaign/playbook baru tetap selalu boleh.
- Campaign memakai immutable snapshot/version, bukan membaca asset live.

## 2. Current State

### 2.1 Backend

Area utama yang terdampak:

```text
includes/Core/Activator.php
includes/Api/RestController.php
includes/Api/MasterComponentController.php
includes/Api/PlaybookMasterController.php
includes/Api/PlaybookController.php
includes/Api/CampaignRunController.php
includes/Api/GoPhishProxy.php
includes/Repositories/MasterComponentRepository.php
includes/Repositories/PlaybookMasterRepository.php
includes/Repositories/PlaybookRepository.php
includes/Repositories/CampaignRunRepository.php
includes/Services/MasterComponentService.php
includes/Services/PlaybookMasterService.php
includes/Services/PlaybookService.php
includes/Services/CampaignRunService.php
includes/Services/AuditLogService.php
```

Observasi saat ini:

- Permission asset masih banyak berbasis `entity = General` dan `current_user_entity()`.
- Admin asset saat ini dideteksi dengan `pukat_manage_settings` atau `administrator`.
- Master component route saat ini masih memakai `permission_read` / `permission_manage`, bukan admin-only untuk semua master route.
- Email template dan landing page sudah punya table version.
- Sending profile belum punya version/revision table.
- Playbook Master punya field `version`, tetapi update masih mengubah row utama.
- Edit/delete saat ini diblokir jika asset digunakan active campaign/playbook. Target PRD memperluas ini jadi permanen (all-history usage), bukan hanya campaign yang sedang aktif.
- Delete saat ini dapat menghapus version rows, sehingga perlu diubah untuk asset yang pernah dipakai campaign.
- Usage permanen "pernah dipakai campaign" belum punya table khusus.
- Campaign Run sudah memiliki `snapshot_json`, tetapi belum menulis `pukat_campaign_asset_usages`.

### 2.2 Frontend

Area utama yang terdampak:

```text
pukat-app/src/config/appRoutes.jsx
pukat-app/src/api/masterAssetApi.js
pukat-app/src/api/playbookApi.js
pukat-app/src/api/campaignApi.js
pukat-app/src/hooks/queries/useMasterAssetQueries.js
pukat-app/src/hooks/mutations/useMasterAssetMutations.js
pukat-app/src/hooks/mutations/usePlaybookMutations.js
pukat-app/src/pages/Admin/MasterAssetPage.jsx
pukat-app/src/pages/Admin/MasterEmailTemplates.jsx
pukat-app/src/pages/Admin/MasterLandingPages.jsx
pukat-app/src/pages/Admin/MasterSendingProfiles.jsx
pukat-app/src/pages/Simulation/EmailTemplates.jsx
pukat-app/src/pages/Simulation/LandingPages.jsx
pukat-app/src/pages/Simulation/SendingProfiles.jsx
pukat-app/src/features/setup/playbooks/Playbooks.jsx
pukat-app/src/utils/masterAssetHelpers.js
pukat-app/src/utils/gophishAssetHelpers.js
pukat-app/src/utils/smtpProfileHelpers.js
pukat-app/src/utils/playbookComponentOptions.js
```

Observasi saat ini:

- Frontend route master playbook masih `/master/playbooks`.
- PRD target naming adalah `/master/playbook`.
- UI helper masih memakai `edit_locked` / active usage untuk disable edit.
- UI belum konsisten memakai response `permissions.can_edit`, `permissions.can_delete`, `permissions.can_archive`, dan reason field.

## 3. Target Architecture

### 3.1 Asset Permission Model

Backend menghitung permission dari:

```text
current authenticated user
server-side role/capability
asset.scope
asset.owner_user_id
asset.status/deleted_at
campaign_asset_usages
```

Admin asset:

```text
current_user_can('pukat_manage_settings') || current_user_can('administrator')
```

Non-admin operator/viewer tidak boleh mengelola `general` asset, walaupun bisa melihat dan memakai asset tersebut sesuai permission.

### 3.2 Asset Version Model

```text
asset master row
-> current_version_id
-> one or many immutable versions/revisions
```

Edit behavior:

```text
edit request
-> validate role/scope/owner
-> check NOT EXISTS campaign_asset_usages for asset_id (409 asset_already_used if it exists)
-> insert new version/revision
-> update current_version_id
-> audit log
```

Campaign behavior:

```text
lock/sync/launch campaign
-> validate user can use selected assets
-> store asset_id
-> store asset_version_id
-> store payload snapshot
-> insert campaign_asset_usage rows
```

### 3.3 Delete Model

This is the same condition used to gate edit (§3.2). Delete only when:

```text
role/scope/owner valid
AND asset has no row in pukat_campaign_asset_usages
```

If used by campaign:

```text
return 409 asset_already_used
offer archive instead
```

## 4. Phase 0: Baseline and Guardrails

Goal: make implementation safe before changing schema or behavior.

Tasks:

- Confirm current dirty worktree and avoid touching unrelated `assets/dist` churn.
- Add this plan and PRD to the branch first.
- Capture current API smoke baseline using `tools/smoke-playbook-master.php`.
- Confirm exact role mapping used by production users:
  - admin: `pukat_manage_settings` or `administrator`
  - non-admin manager/operator: `pukat_manage_campaigns`
  - viewer: `pukat_view_reports`
- Decide database version bump. Recommended: `pukat_db_version = 1.4.0`.

Deliverables:

- Baseline notes in PR or implementation issue.
- Confirmed role/capability mapping.
- No runtime behavior changes yet.

Validation:

```bash
docker exec -i wordpress_app php wp-content/plugins/Pukat/tools/smoke-playbook-master.php
```

## 5. Phase 1: Schema and Migration

Goal: add data structures needed for secure ownership, immutable versions, and permanent campaign usage tracking.

### 5.1 Add Asset Ownership Fields

Add conceptual fields to these tables:

```text
pukat_email_template_masters
pukat_landing_page_masters
pukat_sending_profile_refs
pukat_playbook_masters
```

Fields:

```text
scope VARCHAR(20) NOT NULL DEFAULT 'own'
owner_user_id BIGINT UNSIGNED DEFAULT NULL
current_version_id BIGINT UNSIGNED DEFAULT NULL
deleted_at DATETIME DEFAULT NULL
```

Recommended indexes:

```text
KEY scope (scope)
KEY owner_user_id (owner_user_id)
KEY current_version_id (current_version_id)
KEY deleted_at (deleted_at)
```

Backfill:

```text
entity = 'General'
-> scope = 'general'
-> owner_user_id = null

entity != 'General'
-> scope = 'own'
-> owner_user_id = created_by if created_by points to an existing user
```

Fallback:

```text
created_by missing/invalid
-> scope = 'own'
-> owner_user_id = null
-> status = 'needs_review' if allowed, otherwise keep current status and hide from non-admin
```

Notes:

- `entity` remains business metadata/grouping, not the security owner.
- Backend must stop treating `entity = General` as enough for permission.

### 5.2 Add Current Version Backfill

Email template:

```text
current_version_id = latest pukat_email_template_versions.id by version desc
```

Landing page:

```text
current_version_id = latest pukat_landing_page_versions.id by version desc
```

Sending profile:

Create revision support first, then set `current_version_id`.

Playbook Master:

Create revision support first, then set `current_version_id`.

### 5.3 Add Sending Profile Revisions

Add table:

```text
pukat_sending_profile_versions
- id
- sending_profile_ref_id
- version
- payload_json
- status
- created_by
- approved_by
- created_at
- approved_at
```

Recommended indexes:

```text
UNIQUE KEY sending_profile_version (sending_profile_ref_id, version)
KEY sending_profile_ref_id (sending_profile_ref_id)
KEY status (status)
```

Payload contains non-secret metadata only:

```text
from_name
from_email
reply_to
gophish_sending_profile_id
environment
allowed_domains
rate_limit
```

Do not store SMTP password or provider secret.

### 5.4 Add Playbook Master Revisions

Add table:

```text
pukat_playbook_master_versions
- id
- playbook_master_id
- version
- payload_json
- status
- created_by
- approved_by
- created_at
- approved_at
```

Payload contains:

```text
objective
scenario
difficulty
risk_level
default_email_template_version_id
default_landing_page_version_id
default_sending_profile_version_id or default_sending_profile_ref_id
default_dynamic_domain_id
allowed_overrides
rules
metrics
```

### 5.5 Add Campaign Asset Usage Table

Add table:

```text
pukat_campaign_asset_usages
- id
- campaign_run_id BIGINT UNSIGNED DEFAULT NULL
- campaign_id BIGINT UNSIGNED DEFAULT NULL
- asset_type VARCHAR(50) NOT NULL
- asset_id BIGINT UNSIGNED NOT NULL
- asset_version_id BIGINT UNSIGNED DEFAULT NULL
- scope_snapshot VARCHAR(20) NOT NULL
- owner_user_id_snapshot BIGINT UNSIGNED DEFAULT NULL
- used_by_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0
- usage_context VARCHAR(50) NOT NULL DEFAULT 'snapshot_lock'
- created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
```

Recommended indexes:

```text
KEY asset_lookup (asset_type, asset_id)
KEY version_lookup (asset_type, asset_version_id)
KEY campaign_run_id (campaign_run_id)
KEY campaign_id (campaign_id)
KEY used_by_user_id (used_by_user_id)
```

### 5.6 Usage Backfill

Backfill usage from existing `pukat_campaign_runs.snapshot_json`:

```text
snapshot.email_template.master_id/version_id
snapshot.landing_page.master_id/version_id
snapshot.sending_profile.ref_id
snapshot.playbook_master_id/playbook_version
```

Backfill usage from legacy campaigns/playbooks where possible:

```text
pukat_campaigns.playbook_id
pukat_playbooks.gophish_template_id
pukat_playbooks.gophish_page_id
pukat_playbooks.gophish_smtp_id
```

If legacy asset cannot map to a WordPress master asset, record only what can be mapped and leave GoPhish-only usage under existing active legacy checks.

Deliverables:

- `Activator::maybe_upgrade()` migrates schema idempotently.
- New tables and columns exist on plugin upgrade.
- Backfill can run repeatedly without duplicate usage rows.

Validation:

- `SHOW COLUMNS` confirms new fields.
- `SHOW TABLES LIKE '%pukat_campaign_asset_usages%'`.
- Smoke test still passes.

## 6. Phase 2: Centralized Backend Policy

Goal: move permission decisions out of scattered entity checks.

### 6.1 Add AssetAccessPolicy Service

Create:

```text
includes/Services/AssetAccessPolicy.php
```

Suggested methods:

```text
is_admin_asset_manager(int $user_id): bool
can_view_master_route(int $user_id): bool
can_view_asset(int $user_id, array $asset, string $context): bool
can_use_asset(int $user_id, array $asset): bool
can_create_asset(int $user_id, string $scope, ?int $owner_user_id, string $context): bool
can_edit_asset(int $user_id, array $asset, array $usage): bool
can_delete_asset(int $user_id, array $asset, array $usage): bool
can_archive_asset(int $user_id, array $asset): bool
permissions_for_asset(int $user_id, array $asset, array $usage): array
```

`can_use_asset()` (assign to a new campaign or as a playbook component) never consults `$usage` — it is never blocked by existing usage on the asset.

`can_edit_asset()` and `can_delete_asset()` both take `$usage`: if `$usage['used_count'] > 0` (any row ever written to `pukat_campaign_asset_usages`, any campaign status), both return `false` regardless of role/scope/owner.

Policy rules:

```text
general asset:
  view/use: admin and non-admin allowed, regardless of usage
  edit/delete: admin only AND used_count == 0
  archive: admin only

own asset:
  view/use: owner only, regardless of usage
  edit/delete: owner only AND used_count == 0
  archive: owner only
  admin can view through master context for governance
```

Important:

- Request body fields must not decide policy.
- Policy receives asset rows loaded from database.
- For list endpoints, apply DB filters first, then decorate results with `permissions`.

### 6.2 Add Repository Helpers

Create shared methods where appropriate:

```text
find_asset(asset_type, id)
list_assets_for_context(asset_type, user_id, context)
count_asset_usage(asset_type, asset_id)
has_asset_usage(asset_type, asset_id)
soft_delete_asset(asset_type, id, constraints)
archive_asset(asset_type, id, constraints)
create_asset_usage(...)
```

Keep SQL whitelisting strict for table and column names.

### 6.3 Update REST Permission Callbacks

Master routes:

```text
/master/email-templates
/master/landing-pages
/master/sending-profiles
/master/playbook
```

Should require admin asset manager for page/API master mutation and list/detail.

Non-master routes:

```text
/email-templates
/landing-pages
/sending-profiles
/playbooks
```

Should require logged-in/read access, then row-level policy decides list/detail/action access.

Deliverables:

- One reusable backend policy service.
- Existing services call policy instead of `enforce_write_entity()` style logic.
- API returns 403/404/409 according to PRD error mapping.

Validation:

- Unit tests for policy matrix.
- Non-admin cannot hit master route.
- Non-admin cannot access another user's own asset by ID.

## 7. Phase 3: API Response Capability Contract

Goal: return capabilities to frontend without trusting them on mutation.

### 7.1 Decorate List and Detail Responses

Every asset response should include:

```json
{
  "scope": "general",
  "owner_user_id": null,
  "current_version_id": 31,
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
    "edit_reason": "General asset hanya bisa diedit admin.",
    "delete_reason": "Asset sudah pernah digunakan campaign."
  }
}
```

Keep existing compatibility fields temporarily:

```text
edit_locked
edit_lock_reason
usage.active_usage_count
```

But frontend should move to `permissions`.

### 7.2 Normalize Usage

New usage fields:

```text
used_count: all-time usage count from pukat_campaign_asset_usages
active_campaign_count: active/scheduled/running campaign count
active_playbook_count: active playbook reference count if still needed for readiness warnings
```

Delete uses `used_count`, not active count.

Edit is blocked once `used_count > 0`, even if role/scope/owner permission passes. Assign (use in a new campaign or playbook) is never blocked by `used_count`.

Deliverables:

- Master and non-master API list/detail return `permissions`.
- Usage is computed from permanent usage table.
- Legacy UI fields still present until frontend cutover is complete.

Validation:

- API contract smoke covers admin and non-admin responses.
- Frontend existing pages continue rendering.

## 8. Phase 4: Version-Only Edit Behavior

Goal: ensure edit never mutates campaign-used content in place.

### 8.1 Email Templates

Current:

- `pukat_email_template_versions` exists.
- `PUT /master/email-template-versions/{id}` updates version rows.

Target:

- Version rows become immutable after creation or after first campaign usage.
- Editing content creates a new row through `/versions`.
- `PUT /master/email-template-versions/{id}` should be restricted to draft-only metadata or deprecated in favor of create-version.
- Master update should only update metadata that does not affect campaign snapshot, or should create a new version if content fields are present.
- `current_version_id` updates to the newly created version.

### 8.2 Landing Pages

Same as email templates:

- Create new landing page version for content changes.
- Do not update old HTML/capture settings if used by campaign.
- Update `current_version_id`.

### 8.3 Sending Profiles

Target:

- Add revision creation endpoint.
- Edit sending profile metadata creates a new revision.
- Keep GoPhish sending profile ID reference immutable per campaign snapshot.
- Do not store secrets.

### 8.4 Playbook Masters

Target:

- Edit Playbook Master creates a new playbook master version/revision.
- Active campaign runs keep original playbook version in snapshot.
- `current_version_id` or `version` points to latest active revision for new campaign runs.

### 8.5 Usage Lock for Edit and Delete (Permanent)

Replace current "active campaign/playbook" check with a permanent, usage-table-based check shared by edit and delete (PRD §5.8):

```text
cannot edit or delete once used_count > 0 in pukat_campaign_asset_usages
applies regardless of campaign status (draft_run, running, completed, cancelled, archived)
```

Allowed while `used_count == 0`:

```text
can edit if role/scope/owner valid AND used_count == 0
edit creates new version
```

Always allowed, independent of `used_count`:

```text
assign/select asset into a new campaign run or as a playbook component
```

Still block:

```text
edit or delete if used_count > 0
update immutable old version
use archived/deleted asset in new campaign
```

Deliverables:

- All edit paths either create version/revision (only when `used_count == 0`) or only update safe metadata.
- Edit requests on an asset with `used_count > 0` return `409 asset_already_used`, same code as delete.
- Old versions cannot be modified once used.
- Assign/select flows are verified to bypass the usage check entirely.
- API error messages distinguish edit-blocked-by-permission (403) from edit-blocked-by-usage (409).

Validation:

- Edit unused asset succeeds as new version.
- Edit asset with `used_count > 0` fails with 409 `asset_already_used`, even for admin/owner.
- Assign an already-used asset into a new campaign or playbook still succeeds.
- Existing campaign snapshot remains unchanged.
- Attempt to update used version row fails.

## 9. Phase 5: Delete and Archive

Goal: make delete safe and archive useful.

### 9.1 Delete

Implement atomic delete/soft delete:

```text
validate user from server
load asset from DB
validate role/scope/owner through policy
conditional update/delete with NOT EXISTS campaign_asset_usages
audit success/failure
```

Recommended:

```text
soft delete by setting deleted_at
```

Benefits:

- Safer rollback.
- Easier audit/debug.
- Avoids deleting related version rows prematurely.

### 9.2 Archive

Add archive endpoints where missing:

```text
POST /wp-json/pukat/v1/master/email-templates/{id}/archive
POST /wp-json/pukat/v1/master/landing-pages/{id}/archive
POST /wp-json/pukat/v1/master/sending-profiles/{id}/archive
POST /wp-json/pukat/v1/master/playbook/{id}/archive

POST /wp-json/pukat/v1/email-templates/{id}/archive
POST /wp-json/pukat/v1/landing-pages/{id}/archive
POST /wp-json/pukat/v1/sending-profiles/{id}/archive
POST /wp-json/pukat/v1/playbooks/{id}/archive
```

Archive behavior:

```text
status = archived
hidden from campaign creation
visible in history/report references
does not change campaign snapshot
```

Deliverables:

- Delete fails with `409 asset_already_used` if usage exists.
- Archive succeeds for used asset if policy allows it.
- Version rows remain available for audit.

Validation:

- Delete unused general asset as admin succeeds.
- Delete used general asset returns 409.
- Delete own asset by owner succeeds only if unused.
- Delete own asset by non-owner returns 403/404.
- Archive used asset succeeds if allowed.

## 10. Phase 6: Campaign Usage and Snapshot Lock

Goal: make campaign asset usage permanent and transactionally safe.

### 10.1 Update CampaignRunService::lock_snapshot()

During lock:

```text
START TRANSACTION
load run
validate run editable
load playbook
validate playbook usable
load every selected asset/version
validate current user can use every asset
build snapshot
update campaign run snapshot/status
insert campaign_asset_usage rows
COMMIT
```

Usage rows:

```text
asset_type = playbook
asset_type = email_template
asset_type = landing_page
asset_type = sending_profile
asset_type = dynamic_domain if included later
```

### 10.2 Sync and Launch Re-check

If sync auto-locks, it must use the same transaction path.

Launch must not rebuild snapshot. It must:

```text
verify locked snapshot exists
verify campaign status valid
continue with saved snapshot
```

### 10.3 Draft Behavior

Campaign draft references should not permanently block delete until snapshot lock.

At lock/sync/launch:

```text
re-check asset status
reject archived/deleted/inactive assets
```

Deliverables:

- Usage is written exactly once per campaign/asset/version.
- Delete cannot race with snapshot lock.
- Campaign execution reads snapshot only.

Validation:

- Create campaign draft, archive selected asset, lock fails with 409.
- Lock campaign, delete asset fails with 409.
- Lock campaign, edit that asset fails with 409 (usage was written at lock, not just draft reference).
- Before lock (draft only, no usage row yet), the same asset can still be edited or deleted freely.

## 11. Phase 7: Route and API Surface Alignment

Goal: align routes with PRD while preserving compatibility.

### 11.1 Frontend Routes

Change target route:

```text
/master/playbooks -> /master/playbook
```

Temporary compatibility:

```text
/master/playbooks redirects or renders same page with deprecation comment
```

Keep non-master:

```text
/playbooks
```

### 11.2 REST Routes

Add or alias:

```text
/wp-json/pukat/v1/master/playbook
```

Current routes may remain temporarily:

```text
/wp-json/pukat/v1/playbook-masters
```

Recommended transition:

- Keep `/playbook-masters` as backend compatibility for existing UI during migration.
- Add `/master/playbook` as PRD-aligned route or route alias.
- Mark old route in API handoff once UI moves.

### 11.3 Non-Master Asset APIs

If non-master pages currently use GoPhish proxy endpoints, move them to WordPress-owned asset APIs:

```text
/email-templates
/landing-pages
/sending-profiles
/playbooks
```

These endpoints must return only:

```text
scope = general
OR owner_user_id = current_user.id
```

Deliverables:

- UI nav uses `/master/playbook`.
- Old `/master/playbooks` remains safe during transition.
- API route naming documented in API handoff.

Validation:

- Admin can open `/master/playbook`.
- Old bookmark `/master/playbooks` still works during compatibility window.
- Non-admin cannot access master route.

## 12. Phase 8: Frontend Capability Integration

Goal: frontend becomes a good UX consumer of backend permissions.

### 12.1 API Client

Update clients:

```text
masterAssetApi.js
playbookApi.js
campaignApi.js if needed
```

Support:

```text
archive
create version/revision
non-master endpoints
master /playbook route alias if exposed
```

### 12.2 Helper Mapping

Update helpers:

```text
masterAssetHelpers.js
smtpProfileHelpers.js
playbookComponentOptions.js
```

Mapping:

```text
ui.canEdit = raw.permissions.can_edit
ui.canDelete = raw.permissions.can_delete
ui.canArchive = raw.permissions.can_archive
ui.editDisabledReason = raw.permissions.edit_reason
ui.deleteDisabledReason = raw.permissions.delete_reason
```

Keep fallback to `edit_locked` only during migration.

### 12.3 Pages and Actions

Update pages:

```text
MasterEmailTemplates.jsx
MasterLandingPages.jsx
MasterSendingProfiles.jsx
MasterAssetPage.jsx
EmailTemplates.jsx
LandingPages.jsx
SendingProfiles.jsx
Playbooks.jsx
```

Behavior:

- Hide/disable action buttons based on `permissions`.
- Show server reason in tooltip/title.
- Refetch after edit/delete/archive.
- Handle 403/409 even if button was enabled earlier.
- Do not send `scope`, `owner_user_id`, `can_edit`, or `can_delete` as trusted values unless creating asset and backend validates/overrides.

Deliverables:

- UI reflects backend permissions.
- General asset is read-only for non-admin.
- Used asset shows archive instead of delete.
- Error messages are clear after stale permission or race condition.

Validation:

```bash
cd wp-content/plugins/Pukat/pukat-app
npm run lint
npm run build
npm test
```

## 13. Phase 9: Testing and QA

Goal: prove the policy under normal, malicious, and race-like scenarios.

### 13.1 Backend Unit/Integration Tests

Add tests for:

- Admin view master list sees all assets.
- Non-admin master route returns 403.
- Non-admin non-master list sees general + own only.
- Non-admin cannot fetch another user's own detail.
- Admin can edit unused general asset and create new version.
- Admin cannot edit general asset once it has any `campaign_asset_usages` row (409, even though role passes).
- Non-admin cannot edit general asset.
- Owner can edit unused own asset and create new version.
- Owner cannot edit own asset once it has any `campaign_asset_usages` row (409, even though ownership passes).
- Non-owner cannot edit own asset.
- Delete unused asset succeeds if policy allows it.
- Delete used asset fails with 409.
- Edit/delete lock stays in place after the campaign that created the usage row is completed, cancelled, or archived.
- Assigning an already-used asset (general or own) to a new campaign or playbook still succeeds.
- Archive used asset succeeds if policy allows it.
- Mutation ignores client-supplied `can_delete`, `scope`, and `owner_user_id`.

### 13.2 Runtime Smoke Tests

Add:

```text
tools/smoke-asset-access-policy.php
```

Smoke flow:

```text
create admin user/context
create non-admin user A
create non-admin user B
create general asset
create own asset for user A
assert user B cannot view/edit/delete user A asset
assert user A can view general but cannot edit/delete general
assert admin can edit general and creates new version (before any usage)
lock campaign with general asset
assert delete general fails with 409
assert admin can no longer edit general (409, permanent lock)
assert admin can still assign general asset to a new campaign draft or playbook component
assert archive general succeeds for admin
```

Keep existing:

```text
tools/smoke-playbook-master.php
```

### 13.3 Frontend Tests

Add/update Vitest tests for helpers:

```text
masterAssetHelpers.test.js
smtpProfileHelpers.test.js
playbookComponentOptions.test.js
```

Assertions:

- `permissions.can_edit` maps to button state.
- `permissions.can_delete` maps to delete action availability.
- Missing permissions fallback remains safe.
- Used asset prefers archive messaging.

### 13.4 Manual QA Matrix

Roles:

```text
admin
operator user A
operator user B
viewer
```

Assets:

```text
general unused
general used
own unused
own used
own from another user
archived
deleted
```

Actions:

```text
list
detail
use in campaign
edit
delete
archive
duplicate
lock snapshot
sync
launch
```

## 14. Phase 10: Documentation and Handoff

Goal: make the behavior clear for future developers and QA.

Update:

```text
docs/API_HANDOFF.md
docs/IMPLEMENTATION_PLAN.md if the master plan needs a status note
docs/PRD_ASSET_ACCESS_AND_VERSIONING.md if decisions change
```

Add API examples for:

- List response with `permissions`.
- Edit create-version response.
- Delete used asset 409.
- Archive response.
- Campaign snapshot usage rows.

Deliverables:

- API handoff documents new capability contract.
- QA checklist references smoke tests.
- Known compatibility endpoints are listed.

## 15. Suggested Implementation Order by PR

### PR 1: Documentation and Baseline

- Add PRD and implementation plan.
- Add baseline notes.
- No behavior changes.

### PR 2: Schema Migration

- Add columns/tables.
- Add idempotent backfill.
- Add schema smoke assertions.

### PR 3: AssetAccessPolicy

- Add policy service.
- Add policy unit tests.
- Decorate responses with `permissions` while preserving old fields.

### PR 4: Delete/Archive and Usage Table

- Add permanent usage table writes.
- Make delete usage-based.
- Add archive endpoints.
- Add smoke coverage.

### PR 5: Version-Only Edit

- Convert edit paths to create version/revision.
- Lock down mutable version updates.
- Update campaign snapshot to use version IDs consistently.

### PR 6: Non-Master APIs and Route Alignment

- Add non-master endpoints if missing.
- Add `/master/playbook` route and compatibility alias.
- Ensure non-admin master route returns 403.

### PR 7: Frontend Permissions

- Update API clients, helpers, and pages.
- Use `permissions` for actions.
- Add helper tests.

### PR 8: End-to-End Hardening

- Add race/concurrency tests where feasible.
- Update API handoff.
- Full lint/build/test/smoke verification.

## 16. Rollout and Compatibility

Compatibility strategy:

- Keep old endpoints temporarily.
- Keep `edit_locked` response fields until UI no longer needs them.
- Keep `/master/playbooks` as frontend alias during migration.
- Prefer soft delete before hard delete.
- Do not remove legacy GoPhish proxy flows until campaign creation fully uses WordPress-owned asset APIs.

Rollback strategy:

- Schema additions are additive.
- `deleted_at` soft delete can be reverted by clearing the field during emergency admin recovery.
- Version-only edit can coexist with old version rows.
- Usage table can be rebuilt from campaign snapshots if needed.

## 17. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Ownership backfill wrong | User may lose access or see wrong data | Put invalid owner rows into admin-only review state |
| UI depends on `edit_locked` | Buttons may show wrong state | Preserve compatibility fields while adding `permissions` |
| Race between delete and snapshot lock | Used asset could be deleted | Use transaction or conditional query with `NOT EXISTS` |
| Sending profile secrets leak | Security incident | Version payload stores metadata only, never password/token |
| Existing active campaigns rely on live assets | Campaign output changes unexpectedly | Ensure execution reads `snapshot_json` and GoPhish synced snapshot |
| Non-master APIs duplicate master logic | Policy drift | Use centralized policy and shared repository helpers |
| Route rename breaks bookmarks | UX regression | Keep `/master/playbooks` alias temporarily |
| Permanent usage lock blocks legitimate edit on assets tied to very old completed campaigns | Admin/owner stuck unable to fix a typo or content bug | Offer archive + "duplicate as new asset" as the workaround; retention/purge policy for `pukat_campaign_asset_usages` is tracked as an open question in the PRD (§18), not solved by this plan |

## 18. Definition of Done

Implementation is complete when:

- API list/detail returns `permissions` and `usage` for all target assets.
- Non-admin cannot access master routes.
- Non-admin sees only `general` + own assets on non-master routes.
- Non-admin cannot edit/delete/archive `general`.
- Owner can edit own asset by creating a new version/revision, only while it has zero permanent usage.
- Admin can edit `general` by creating a new version/revision, only while it has zero permanent usage.
- Edit and delete are both permanently blocked (409) once an asset has any `pukat_campaign_asset_usages` row, regardless of current campaign status.
- Assigning an already-used asset to a new campaign or playbook remains allowed and is never blocked by usage.
- Delete succeeds only for assets with zero permanent usage.
- Archive works for used assets when policy allows it.
- Campaign snapshot writes `pukat_campaign_asset_usages`.
- Campaign execution does not change after source asset edit.
- Frontend uses backend `permissions` for action buttons.
- Backend rejects manipulated payloads.
- Smoke tests, frontend lint/build/test, and relevant backend tests pass.
