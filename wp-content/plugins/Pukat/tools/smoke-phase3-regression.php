<?php
/**
 * Cumulative regression smoke test for RBAC Phase 3 (docs/IMPLEMENTATION_PLAN_RBAC.md
 * §7 — Migrate Controllers to Granular Capabilities).
 *
 * Each Phase 3 sub-step migrates one controller's permission_callback from
 * the old blanket permission_read/manage/admin() gates to granular
 * Permission Registry capabilities. This script accumulates a permission
 * matrix assertion per migrated route so every subsequent controller
 * migration re-verifies ALL previously migrated ones haven't regressed —
 * append to $cases as each controller is migrated, don't create a new
 * one-off smoke script per controller.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-phase3-regression.php
 *
 * @package Pukat
 */

declare(strict_types=1);

$wp_load = dirname( __DIR__, 4 ) . '/wp-load.php';
if ( ! file_exists( $wp_load ) ) {
	fwrite( STDERR, "wp-load.php was not found. Run this from a WordPress install.\n" );
	exit( 1 );
}

require $wp_load;
require_once ABSPATH . 'wp-admin/includes/user.php';

use Pukat\Core\Activator;

global $wpdb;

$failures = [];

function check( string $label, bool $condition, array &$failures ): void {
	echo ( $condition ? "PASS" : "FAIL" ) . " — {$label}\n";
	if ( ! $condition ) {
		$failures[] = $label;
	}
}

function call( string $method, string $route, array $params = [], ?int $user_id = null ): int {
	wp_set_current_user( $user_id ?: 0 );
	$request = new WP_REST_Request( $method, $route );
	foreach ( $params as $key => $value ) {
		$request->set_param( $key, $value );
	}
	return rest_do_request( $request )->get_status();
}

/**
 * Assert a route returns the expected HTTP status for admin/operator/viewer/anonymous.
 *
 * @param array{admin: int, operator: int, viewer: int, anon: int} $expected
 */
function assert_permission_matrix(
	string $label,
	string $method,
	string $route,
	array $params,
	array $expected,
	int $admin_id,
	int $operator_id,
	int $viewer_id,
	array &$failures
): void {
	check( "{$label} — admin", $expected['admin'] === call( $method, $route, $params, $admin_id ), $failures );
	check( "{$label} — operator", $expected['operator'] === call( $method, $route, $params, $operator_id ), $failures );
	check( "{$label} — viewer", $expected['viewer'] === call( $method, $route, $params, $viewer_id ), $failures );
	check( "{$label} — anonymous", $expected['anon'] === call( $method, $route, $params, null ), $failures );
}

/**
 * Same permission boundary check as assert_permission_matrix(), but for
 * routes whose ALLOWED-role status depends on a live external service (here:
 * GoPhish, which may or may not be reachable from this environment) —
 * confirmed by direct probing that GoPhish is unreachable right now, turning
 * would-be 404s into 500s. Blocked roles are still asserted exactly (401/403
 * is decided by the permission_callback before any GoPhish call happens, so
 * it's always deterministic). Allowed roles are only asserted to have
 * cleared the permission boundary (i.e. NOT 401/403) — whatever GoPhish
 * says afterward is out of scope for an RBAC regression check.
 *
 * @param string[] $blocked_roles Subset of ['admin','operator','viewer','anon'] expected to be blocked.
 */
function assert_permission_boundary_only(
	string $label,
	string $method,
	string $route,
	array $params,
	array $blocked_roles,
	int $admin_id,
	int $operator_id,
	int $viewer_id,
	array &$failures
): void {
	$identities = [ 'admin' => $admin_id, 'operator' => $operator_id, 'viewer' => $viewer_id, 'anon' => null ];

	foreach ( $identities as $role => $user_id ) {
		$status = call( $method, $route, $params, $user_id );

		if ( in_array( $role, $blocked_roles, true ) ) {
			$expected = 'anon' === $role ? 401 : 403;
			check( "{$label} — {$role} (blocked)", $expected === $status, $failures );
		} else {
			check( "{$label} — {$role} (permission cleared; downstream status depends on live GoPhish, not asserted)", ! in_array( $status, [ 401, 403 ], true ), $failures );
		}
	}
}

do_action( 'rest_api_init' );
Activator::maybe_upgrade();

$admin_id    = 2; // john_editor, pukat_admin
$operator_id = 4; // daymon, pukat_operator

// No fixture user holds ONLY pukat_viewer (the one candidate, steupy, also has
// WP administrator — which alone grants every Pukat capability — so it can't
// stand in for a clean viewer). Create + delete an ephemeral one instead.
$viewer_login = 'pukat_smoke_viewer_' . time();
$viewer_id    = wp_insert_user( [
	'user_login' => $viewer_login,
	'user_pass'  => wp_generate_password(),
	'user_email' => $viewer_login . '@example.test',
	'role'       => 'pukat_viewer',
] );

if ( is_wp_error( $viewer_id ) ) {
	fwrite( STDERR, 'Could not create ephemeral viewer test user: ' . $viewer_id->get_error_message() . "\n" );
	exit( 1 );
}

// ---------------------------------------------------------------------------
// SettingsController (Phase 3, controller 1/11) — settings.view / settings.edit,
// both `admin`-gated, replacing the old blanket permission_admin().
// ---------------------------------------------------------------------------
$original_org_name = get_option( 'pukat_org_name' );

assert_permission_matrix(
	'GET /settings',
	'GET',
	'/pukat/v1/settings',
	[],
	[ 'admin' => 200, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /settings',
	'PUT',
	'/pukat/v1/settings',
	[ 'pukat_org_name' => 'Phase 3 Regression Test' ],
	[ 'admin' => 200, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// The admin-identity call above for PUT actually wrote pukat_org_name — restore it.
update_option( 'pukat_org_name', $original_org_name );
check( 'pukat_org_name restored to its original value', $original_org_name === get_option( 'pukat_org_name' ), $failures );

// ---------------------------------------------------------------------------
// TableController (Phase 3, controller 2/11) — table_key-aware view checks
// replacing the blanket permission_read(). 5 of 6 table_keys keep the exact
// same admin+operator+viewer scope as before (their Permission Registry key
// is `shared`-gated, same population permission_read allowed).
//
// `audit_logs` is the one deliberate exception, not a bug: its Registry key
// (audit_logs.view) was seeded `admin`-only in Phase 1 to match the OTHER
// audit log endpoint (UserController's /audit-logs, already permission_admin
// today) — but TableController's /tables/audit_logs/* had been on the loose
// blanket permission_read this whole time, a pre-existing inconsistency
// between two routes serving the same data. This migration step closes that
// gap: operator/viewer lose table-API access to audit logs, matching what
// was clearly always the intent (WP-admin's own "User Access" submenu page
// already required pukat_manage_users, admin-only). Flagged here explicitly
// rather than silently absorbed — see docs/PRD_RBAC.md's changelog norms.
// ---------------------------------------------------------------------------
$shared_table_keys = [ 'sending_profiles', 'landing_pages', 'email_templates', 'dynamic_domains', 'campaigns' ];

foreach ( $shared_table_keys as $table_key ) {
	assert_permission_matrix(
		"GET /tables/{$table_key}/schema",
		'GET',
		"/pukat/v1/tables/{$table_key}/schema",
		[],
		[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
		$admin_id, $operator_id, $viewer_id, $failures
	);
}

assert_permission_matrix(
	'GET /tables/audit_logs/schema (tightened: admin-only, was operator+viewer)',
	'GET',
	'/pukat/v1/tables/audit_logs/schema',
	[],
	[ 'admin' => 200, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /tables/audit_logs/rows (tightened: admin-only, was operator+viewer)',
	'GET',
	'/pukat/v1/tables/audit_logs/rows',
	[],
	[ 'admin' => 200, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /tables/not_a_real_table/schema (unrecognized table_key falls through to TableQueryService)',
	'GET',
	'/pukat/v1/tables/not_a_real_table/schema',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// UserController (Phase 3, controller 3/11) — users.view, users.assign_role,
// audit_logs.view (NOT users.view — see UserController::permission_view_audit_logs()
// doc comment) replacing the blanket permission_admin() on all 3 routes.
// All 3 keys are `admin`-gated in Phase 1, so this is a pure swap, same
// scope as before for every existing role.
// ---------------------------------------------------------------------------
assert_permission_matrix(
	'GET /users',
	'GET',
	'/pukat/v1/users',
	[],
	[ 'admin' => 200, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /audit-logs',
	'GET',
	'/pukat/v1/audit-logs',
	[],
	[ 'admin' => 200, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// A nonexistent target user id (999999) so a permitted admin call fails at
// the handler's own not_found check (404) rather than actually mutating a
// real user's role — still proves admin cleared the permission boundary.
assert_permission_matrix(
	'PUT /users/999999/role (nonexistent target — proves permission boundary without mutating a real user)',
	'PUT',
	'/pukat/v1/users/999999/role',
	[ 'pukat_role' => 'pukat_viewer' ],
	[ 'admin' => 404, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// QuizController (Phase 3, controller 4/11) — post_sim.manage/post_sim.view
// replacing permission_manage()/permission_read() on the 4 authenticated
// routes. post_sim.manage is operator-gated, post_sim.view is shared-gated
// in Phase 1 — same population as before for every existing role.
//
// /quiz/submit is deliberately NOT touched here — it stays __return_true,
// a genuine public endpoint (quiz link delivered via email to targets who
// are never WP users), not a permission gap. Tested below only to prove
// this migration didn't accidentally change that.
// ---------------------------------------------------------------------------
assert_permission_matrix(
	'GET /quiz/questions',
	'GET',
	'/pukat/v1/quiz/questions',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// Empty body so a permitted call fails its own validation (422) rather than
// actually inserting a quiz question.
assert_permission_matrix(
	'POST /quiz/questions (empty body — proves permission boundary without creating real data)',
	'POST',
	'/pukat/v1/quiz/questions',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// Nonexistent question id — delete_question() unconditionally reports
// success regardless of whether a row matched, so this is a safe no-op.
assert_permission_matrix(
	'DELETE /quiz/questions/999999 (nonexistent id — safe no-op)',
	'DELETE',
	'/pukat/v1/quiz/questions/999999',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /quiz/results/1',
	'GET',
	'/pukat/v1/quiz/results/1',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// __return_true regression guard: same (validation) outcome for every
// identity, including anonymous — proves the public route wasn't touched.
// Empty body so nothing is actually inserted into quiz_results.
$submit_statuses = [
	'admin'      => call( 'POST', '/pukat/v1/quiz/submit', [], $admin_id ),
	'operator'   => call( 'POST', '/pukat/v1/quiz/submit', [], $operator_id ),
	'viewer'     => call( 'POST', '/pukat/v1/quiz/submit', [], $viewer_id ),
	'anonymous'  => call( 'POST', '/pukat/v1/quiz/submit', [], null ),
];
check(
	'POST /quiz/submit — still __return_true (identical outcome for every identity, including anonymous)',
	1 === count( array_unique( $submit_statuses ) ) && 422 === $submit_statuses['anonymous'],
	$failures
);

// ---------------------------------------------------------------------------
// PlaybookController (Phase 3, controller 5/11) — the deprecated legacy
// compat layer for the pre-Playbook-Master pukat_playbooks table. Reuses
// master_playbooks.view/create/edit/delete (no distinct registry entry of
// its own — see PlaybookController's doc comment), all `shared`/`operator`
// gated in Phase 1, same population as permission_read()/permission_manage()
// allowed before.
// ---------------------------------------------------------------------------
assert_permission_matrix(
	'GET /playbooks',
	'GET',
	'/pukat/v1/playbooks',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// Empty body -> PlaybookService::create() 422s on missing name before
// anything is written, proving the boundary without creating real data.
assert_permission_matrix(
	'POST /playbooks (empty body — proves permission boundary without creating real data)',
	'POST',
	'/pukat/v1/playbooks',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// Nonexistent id (999999) -> all 3 mutating routes 404 at PlaybookService's
// own not_found check, no real row touched.
assert_permission_matrix(
	'GET /playbooks/999999 (nonexistent id)',
	'GET',
	'/pukat/v1/playbooks/999999',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /playbooks/999999 (nonexistent id — safe, no real row touched)',
	'PUT',
	'/pukat/v1/playbooks/999999',
	[ 'name' => 'Phase 3 Regression Test' ],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'DELETE /playbooks/999999 (nonexistent id — safe, no real row touched)',
	'DELETE',
	'/pukat/v1/playbooks/999999',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /playbooks/999999/migrate-to-master (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/playbooks/999999/migrate-to-master',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// PlaybookMasterController (Phase 3, controller 6/11) — master_playbooks.view/
// create/edit, all shared/operator-gated in Phase 1, same population as
// permission_read()/permission_manage() allowed before. duplicate reuses
// .create (new row); submit-review and archive reuse .edit (status
// transitions on an existing row).
//
// /approve is intentionally NOT migrated here — still permission_manage(),
// exactly as before. Tested below to snapshot that it's genuinely unchanged
// in this step; Phase 4 migrates it together with the new self-approval
// guard as its own reviewable unit.
// ---------------------------------------------------------------------------
assert_permission_matrix(
	'GET /playbook-masters',
	'GET',
	'/pukat/v1/playbook-masters',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /playbook-masters (empty body — proves permission boundary without creating real data)',
	'POST',
	'/pukat/v1/playbook-masters',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /playbook-masters/999999 (nonexistent id)',
	'GET',
	'/pukat/v1/playbook-masters/999999',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /playbook-masters/999999 (nonexistent id — safe, no real row touched)',
	'PUT',
	'/pukat/v1/playbook-masters/999999',
	[ 'name' => 'Phase 3 Regression Test' ],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /playbook-masters/999999/duplicate (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/playbook-masters/999999/duplicate',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /playbook-masters/999999/submit-review (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/playbook-masters/999999/submit-review',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /playbook-masters/999999/archive (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/playbook-masters/999999/archive',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /playbook-masters/999999/approve (unchanged this step — still permission_manage(), migrates in Phase 4)',
	'POST',
	'/pukat/v1/playbook-masters/999999/approve',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// ReportController (Phase 3, controller 7/11) — all 6 routes are read-only,
// so they all map to the single reports.view key (shared-gated in Phase 1),
// replacing permission_read(). Same admin+operator+viewer population as
// before. All GET, nothing to worry about mutating.
// ---------------------------------------------------------------------------
assert_permission_matrix(
	'GET /reports/999999 (nonexistent campaign)',
	'GET',
	'/pukat/v1/reports/999999',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /reports/999999/export',
	'GET',
	'/pukat/v1/reports/999999/export',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /reports/campaign-runs/999999 (nonexistent campaign run)',
	'GET',
	'/pukat/v1/reports/campaign-runs/999999',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /reports/campaign-runs/999999/export',
	'GET',
	'/pukat/v1/reports/campaign-runs/999999/export',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /risk-scores',
	'GET',
	'/pukat/v1/risk-scores',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /risk-scores/not-a-real-email@example.test',
	'GET',
	'/pukat/v1/risk-scores/not-a-real-email@example.test',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// CampaignController (Phase 3, controller 8/11) — campaigns.view/create/
// edit/delete/launch replacing permission_read()/permission_manage().
// complete and targets/import both reuse .edit (a status transition and a
// campaign-content modification, neither a create/delete/launch). All
// shared/operator-gated in Phase 1, same population as before.
// ---------------------------------------------------------------------------
assert_permission_matrix(
	'GET /campaigns',
	'GET',
	'/pukat/v1/campaigns',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaigns (empty body — proves permission boundary without creating real data)',
	'POST',
	'/pukat/v1/campaigns',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /campaigns/999999 (nonexistent id)',
	'GET',
	'/pukat/v1/campaigns/999999',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'DELETE /campaigns/999999 (nonexistent id — safe, no real row touched)',
	'DELETE',
	'/pukat/v1/campaigns/999999',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaigns/999999/launch (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/campaigns/999999/launch',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaigns/999999/complete (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/campaigns/999999/complete',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /campaigns/999999/results (nonexistent id)',
	'GET',
	'/pukat/v1/campaigns/999999/results',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /targets/import (empty body — proves permission boundary without writing real data)',
	'POST',
	'/pukat/v1/targets/import',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /campaigns/999999/targets (nonexistent id — route has no existence check, always 200)',
	'GET',
	'/pukat/v1/campaigns/999999/targets',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// CampaignRunController (Phase 3, controller 9/11) — shares CampaignController's
// campaigns.* keys. lock-snapshot, sync, sync-results, and send-follow-up-
// reminder all reuse .edit (operational state changes on an existing run);
// .cancel gets its first real use. All shared/operator-gated in Phase 1,
// same population as before.
// ---------------------------------------------------------------------------
assert_permission_matrix(
	'GET /campaign-runs',
	'GET',
	'/pukat/v1/campaign-runs',
	[],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// Empty body -> playbook_master_id missing -> 422 before any lookup, safe.
assert_permission_matrix(
	'POST /campaign-runs (empty body — proves permission boundary without creating real data)',
	'POST',
	'/pukat/v1/campaign-runs',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /campaign-runs/999999 (nonexistent id)',
	'GET',
	'/pukat/v1/campaign-runs/999999',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaign-runs/999999/lock-snapshot (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/campaign-runs/999999/lock-snapshot',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaign-runs/999999/sync (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/campaign-runs/999999/sync',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaign-runs/999999/launch (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/campaign-runs/999999/launch',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaign-runs/999999/cancel (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/campaign-runs/999999/cancel',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /campaign-runs/999999/results (nonexistent id)',
	'GET',
	'/pukat/v1/campaign-runs/999999/results',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaign-runs/999999/sync-results (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/campaign-runs/999999/sync-results',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /campaign-runs/999999/report (nonexistent id)',
	'GET',
	'/pukat/v1/campaign-runs/999999/report',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /campaign-runs/999999/send-follow-up-reminder (nonexistent id — safe, no real row touched)',
	'POST',
	'/pukat/v1/campaign-runs/999999/send-follow-up-reminder',
	[],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// GoPhishProxy (Phase 3, controller 10/11) — largest single controller
// migrated this phase. Email/landing page routes map to the non-master
// email_templates.*/landing_pages.* keys (shared/operator-gated, same
// population as permission_read()/permission_manage() before). Sending
// profile routes map to master_sending_profiles.* (admin-gated in Phase 1) —
// the exact same effective scope the 2026-08-06 hardcode already enforced,
// now a configurable seed grant instead. See GoPhishProxy's own doc comment
// for the full rationale.
//
// GoPhish is confirmed unreachable from this environment right now (probed
// directly: cURL "Failed to connect to host.docker.internal port 3333"), so
// routes that hit GoPhish immediately (list/delete/entity/status) use
// assert_permission_boundary_only() — only the permission boundary is
// deterministic, not the downstream status. Routes with body validation
// that runs BEFORE any GoPhish call (create/update/test-email — confirmed by
// reading each handler) use the exact assert_permission_matrix() with an
// empty body, since validation_error (422) fires without ever touching
// GoPhish regardless of its availability.
// ---------------------------------------------------------------------------
assert_permission_boundary_only(
	'GET /gophish/status (settings.view, admin-only)',
	'GET',
	'/pukat/v1/gophish/status',
	[],
	[ 'operator', 'viewer', 'anon' ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_boundary_only(
	'GET /gophish/templates/email',
	'GET',
	'/pukat/v1/gophish/templates/email',
	[],
	[ 'anon' ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /gophish/templates/email (empty body — validates before touching GoPhish)',
	'POST',
	'/pukat/v1/gophish/templates/email',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /gophish/templates/email/999999 (empty body — validates before touching GoPhish)',
	'PUT',
	'/pukat/v1/gophish/templates/email/999999',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_boundary_only(
	'DELETE /gophish/templates/email/999999',
	'DELETE',
	'/pukat/v1/gophish/templates/email/999999',
	[],
	[ 'viewer', 'anon' ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /gophish/templates/email/999999/entity (no entity param — validates before touching GoPhish)',
	'PUT',
	'/pukat/v1/gophish/templates/email/999999/entity',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_boundary_only(
	'GET /gophish/templates/landing',
	'GET',
	'/pukat/v1/gophish/templates/landing',
	[],
	[ 'anon' ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /gophish/templates/landing (empty body — validates before touching GoPhish)',
	'POST',
	'/pukat/v1/gophish/templates/landing',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /gophish/templates/landing/999999 (empty body — validates before touching GoPhish)',
	'PUT',
	'/pukat/v1/gophish/templates/landing/999999',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_boundary_only(
	'DELETE /gophish/templates/landing/999999',
	'DELETE',
	'/pukat/v1/gophish/templates/landing/999999',
	[],
	[ 'viewer', 'anon' ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /gophish/templates/landing/999999/entity (no entity param — validates before touching GoPhish)',
	'PUT',
	'/pukat/v1/gophish/templates/landing/999999/entity',
	[],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_boundary_only(
	'GET /gophish/smtp',
	'GET',
	'/pukat/v1/gophish/smtp',
	[],
	[ 'anon' ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /gophish/smtp (empty body, admin-only — validates before touching GoPhish)',
	'POST',
	'/pukat/v1/gophish/smtp',
	[],
	[ 'admin' => 422, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /gophish/smtp/999999 (empty body, admin-only — validates before touching GoPhish)',
	'PUT',
	'/pukat/v1/gophish/smtp/999999',
	[],
	[ 'admin' => 422, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_boundary_only(
	'DELETE /gophish/smtp/999999 (admin-only)',
	'DELETE',
	'/pukat/v1/gophish/smtp/999999',
	[],
	[ 'operator', 'viewer', 'anon' ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'POST /gophish/smtp/test-email (empty body, admin-only — validates before touching GoPhish)',
	'POST',
	'/pukat/v1/gophish/smtp/test-email',
	[],
	[ 'admin' => 422, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'PUT /gophish/smtp/999999/entity (no entity param, admin-only — validates before touching GoPhish)',
	'PUT',
	'/pukat/v1/gophish/smtp/999999/entity',
	[],
	[ 'admin' => 422, 'operator' => 403, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_boundary_only(
	'GET /gophish/groups',
	'GET',
	'/pukat/v1/gophish/groups',
	[],
	[ 'anon' ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// MasterComponentController (Phase 3, controller 11/11 — closes Phase 3).
// Pure WP DB, no external service dependency, so every case here is fully
// deterministic (unlike GoPhishProxy) — confirmed by reading each service
// method: create_* validates params before any DB lookup (empty body -> 422
// regardless of id), update_*/delete_*/version/validate/health-check all
// check existence first (nonexistent id -> 404 regardless of body).
//
// Email templates and landing pages keep their master_email_templates.*/
// master_landing_pages.* keys (unchanged from the original Phase 1 design —
// these ARE the WordPress-owned versioned catalog those keys were always
// meant for). Sending profiles use the NEW sending_profile_references.* key
// discovered while migrating this controller — see MasterComponentController's
// class-level doc comment for why master_sending_profiles.* would have been
// wrong here. The 2 approve routes are snapshotted unchanged (still
// permission_manage()); Phase 4 migrates them together with PlaybookMaster's.
// ---------------------------------------------------------------------------
assert_permission_matrix(
	'GET /master/email-templates',
	'GET', '/pukat/v1/master/email-templates', [],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/email-templates (empty body)',
	'POST', '/pukat/v1/master/email-templates', [],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'GET /master/email-templates/999999',
	'GET', '/pukat/v1/master/email-templates/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'PUT /master/email-templates/999999 (empty body — 404 before body is read)',
	'PUT', '/pukat/v1/master/email-templates/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'DELETE /master/email-templates/999999',
	'DELETE', '/pukat/v1/master/email-templates/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'GET /master/email-templates/999999/versions',
	'GET', '/pukat/v1/master/email-templates/999999/versions', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/email-templates/999999/versions (empty body — 404 before body is read)',
	'POST', '/pukat/v1/master/email-templates/999999/versions', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'PUT /master/email-template-versions/999999 (empty body — 404 before body is read)',
	'PUT', '/pukat/v1/master/email-template-versions/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/email-template-versions/999999/approve (unchanged this step — still permission_manage())',
	'POST', '/pukat/v1/master/email-template-versions/999999/approve', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /master/landing-pages',
	'GET', '/pukat/v1/master/landing-pages', [],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/landing-pages (empty body)',
	'POST', '/pukat/v1/master/landing-pages', [],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'GET /master/landing-pages/999999',
	'GET', '/pukat/v1/master/landing-pages/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'PUT /master/landing-pages/999999 (empty body — 404 before body is read)',
	'PUT', '/pukat/v1/master/landing-pages/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'DELETE /master/landing-pages/999999',
	'DELETE', '/pukat/v1/master/landing-pages/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'GET /master/landing-pages/999999/versions',
	'GET', '/pukat/v1/master/landing-pages/999999/versions', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/landing-pages/999999/versions (empty body — 404 before body is read)',
	'POST', '/pukat/v1/master/landing-pages/999999/versions', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'PUT /master/landing-page-versions/999999 (empty body — 404 before body is read)',
	'PUT', '/pukat/v1/master/landing-page-versions/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/landing-page-versions/999999/approve (unchanged this step — still permission_manage())',
	'POST', '/pukat/v1/master/landing-page-versions/999999/approve', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /master/sending-profiles',
	'GET', '/pukat/v1/master/sending-profiles', [],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/sending-profiles (empty body)',
	'POST', '/pukat/v1/master/sending-profiles', [],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'GET /master/sending-profiles/999999',
	'GET', '/pukat/v1/master/sending-profiles/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'PUT /master/sending-profiles/999999 (empty body — 404 before body is read)',
	'PUT', '/pukat/v1/master/sending-profiles/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'DELETE /master/sending-profiles/999999',
	'DELETE', '/pukat/v1/master/sending-profiles/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/sending-profiles/999999/validate-gophish',
	'POST', '/pukat/v1/master/sending-profiles/999999/validate-gophish', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

assert_permission_matrix(
	'GET /master/dynamic-domains',
	'GET', '/pukat/v1/master/dynamic-domains', [],
	[ 'admin' => 200, 'operator' => 200, 'viewer' => 200, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/dynamic-domains (empty body)',
	'POST', '/pukat/v1/master/dynamic-domains', [],
	[ 'admin' => 422, 'operator' => 422, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'GET /master/dynamic-domains/999999',
	'GET', '/pukat/v1/master/dynamic-domains/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 404, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'PUT /master/dynamic-domains/999999 (empty body — 404 before body is read)',
	'PUT', '/pukat/v1/master/dynamic-domains/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'DELETE /master/dynamic-domains/999999',
	'DELETE', '/pukat/v1/master/dynamic-domains/999999', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);
assert_permission_matrix(
	'POST /master/dynamic-domains/999999/health-check',
	'POST', '/pukat/v1/master/dynamic-domains/999999/health-check', [],
	[ 'admin' => 404, 'operator' => 404, 'viewer' => 403, 'anon' => 401 ],
	$admin_id, $operator_id, $viewer_id, $failures
);

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
wp_delete_user( $viewer_id );
check( 'ephemeral viewer test user removed', false === get_userdata( $viewer_id ), $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
