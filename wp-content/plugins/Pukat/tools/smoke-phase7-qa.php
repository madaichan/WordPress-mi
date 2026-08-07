<?php
/**
 * Phase 7 (docs/IMPLEMENTATION_PLAN_RBAC.md §11) consolidated final QA.
 *
 * Does NOT re-implement what the 5 earlier smoke tests already cover
 * (permission registry unit checks, RBAC seed idempotency, RoleController
 * CRUD, the full Phase 3 controller-migration regression matrix, the Phase
 * 4 self-approval guard) — those are still the source of truth and should
 * be run alongside this one. This script fills the two gaps the plan calls
 * out specifically for Phase 7 that nothing earlier exercises:
 *
 * 1. A Reviewer-role sample-endpoint sweep across every one of the 12
 *    controllers (11 migrated in Phase 3 + RoleController itself) — Phase
 *    4's own smoke test only ever exercised Reviewer against the 3
 *    approve-specific routes, never confirmed the registry mapping holds
 *    for Reviewer everywhere else. Reviewer's access is a genuinely
 *    asymmetric subset (7 hardcoded keys, NOT derived from the `shared`
 *    gate) — it does NOT inherit Viewer's broad view-everything access, a
 *    fact easy to assume wrong, so this also explicitly proves that.
 * 2. An explicit Admin-lockout edge case beyond what
 *    smoke-role-controller.php already covers: a PUT /roles/pukat_admin
 *    that touches only `description` (no `permissions` key at all) must
 *    leave Admin's permissions completely untouched, not silently wipe
 *    them to empty.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-phase7-qa.php
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

use Pukat\Services\PermissionRegistry;

if ( ! class_exists( \Pukat\Api\RoleController::class ) ) {
	fwrite( STDERR, "Pukat is not loaded. Make sure the plugin is active.\n" );
	exit( 1 );
}

global $wpdb;

$failures = [];

function check( string $label, bool $condition, array &$failures ): void {
	echo ( $condition ? "PASS" : "FAIL" ) . " — {$label}\n";
	if ( ! $condition ) {
		$failures[] = $label;
	}
}

function call( string $method, string $route, array $params = [], ?int $user_id = null ): array {
	wp_set_current_user( $user_id ?: 0 );
	$request = new WP_REST_Request( $method, $route );
	foreach ( $params as $key => $value ) {
		$request->set_param( $key, $value );
	}
	$response = rest_do_request( $request );
	return [ 'status' => $response->get_status(), 'data' => $response->get_data() ];
}

do_action( 'rest_api_init' );

$admin_id = 2; // john_editor, pukat_admin

// ── Ephemeral Reviewer fixture — no existing test user holds pukat_reviewer
// alone (same "no fixture user is a clean single-role holder" gap noted in
// every earlier phase's smoke tests).
$existing = get_user_by( 'login', 'pukat_qa_phase7_reviewer' );
if ( $existing ) {
	wp_delete_user( $existing->ID );
}
$reviewer_id = wp_insert_user( [
	'user_login'   => 'pukat_qa_phase7_reviewer',
	'user_pass'    => wp_generate_password( 20, true ),
	'user_email'   => 'pukat_qa_phase7_reviewer@example.test',
	'display_name' => 'Phase7 QA Reviewer',
	'role'         => 'pukat_reviewer',
] );
if ( is_wp_error( $reviewer_id ) ) {
	fwrite( STDERR, $reviewer_id->get_error_message() . "\n" );
	exit( 1 );
}

echo "=== Reviewer sample-endpoint sweep — all 12 controllers ===\n";
echo "(Reviewer's 7 keys: dashboard.view, master_{playbooks,email_templates,landing_pages}.{view,approve} — NOT derived from the shared/viewer gate)\n\n";

// [ label, method, route, expected_status_for_reviewer ]
$sweep = [
	[ 'SettingsController: GET /settings (settings.view)',                         'GET', '/pukat/v1/settings',                 403 ],
	[ 'TableController: GET /tables/audit_logs/schema (audit_logs.view)',          'GET', '/pukat/v1/tables/audit_logs/schema', 403 ],
	[ 'UserController: GET /users (users.view)',                                   'GET', '/pukat/v1/users',                    403 ],
	[ 'UserController: GET /audit-logs (audit_logs.view)',                         'GET', '/pukat/v1/audit-logs',               403 ],
	[ 'QuizController: GET /quiz/questions (post_sim.manage)',                     'GET', '/pukat/v1/quiz/questions',           403 ],
	[ 'PlaybookController (legacy): GET /playbooks (master_playbooks.view)',       'GET', '/pukat/v1/playbooks',                200 ],
	[ 'PlaybookMasterController: GET /playbook-masters (master_playbooks.view)',   'GET', '/pukat/v1/playbook-masters',         200 ],
	[ 'ReportController: GET /risk-scores (reports.view)',                        'GET', '/pukat/v1/risk-scores',              403 ],
	[ 'CampaignController: GET /campaigns (campaigns.view)',                       'GET', '/pukat/v1/campaigns',                403 ],
	[ 'CampaignRunController: GET /campaign-runs (campaigns.view)',                'GET', '/pukat/v1/campaign-runs',            403 ],
	[ 'GoPhishProxy: GET /gophish/status (settings.view)',                         'GET', '/pukat/v1/gophish/status',           403 ],
	[ 'MasterComponentController: GET /master/email-templates (master_email_templates.view)', 'GET', '/pukat/v1/master/email-templates', 200 ],
	[ 'MasterComponentController: GET /master/sending-profiles (sending_profile_references.view)', 'GET', '/pukat/v1/master/sending-profiles', 403 ],
	[ 'RoleController: GET /roles (users.manage_roles)',                           'GET', '/pukat/v1/roles',                    403 ],
];

foreach ( $sweep as [ $label, $method, $route, $expected ] ) {
	$res = call( $method, $route, [], $reviewer_id );
	check( "{$label} — reviewer gets {$expected}", $expected === $res['status'], $failures );
}

echo "\n=== Reviewer does NOT inherit Viewer's shared/view-everything access (asymmetry check) ===\n";
$res = call( 'GET', '/pukat/v1/master/dynamic-domains', [], $reviewer_id );
check( 'reviewer blocked from domains.view (a shared/viewer key Reviewer does not hold)', 403 === $res['status'], $failures );

$my_perms = call( 'GET', '/pukat/v1/me/permissions', [], $reviewer_id );
check( 'GET /me/permissions as reviewer is 200', 200 === $my_perms['status'], $failures );
$reviewer_keys = $my_perms['data']['data']['permissions'] ?? [];
sort( $reviewer_keys );
$expected_reviewer_keys = [
	'dashboard.view',
	'master_email_templates.approve',
	'master_email_templates.view',
	'master_landing_pages.approve',
	'master_landing_pages.view',
	'master_playbooks.approve',
	'master_playbooks.view',
];
check( 'reviewer has exactly the 7 hardcoded keys, no more no less', $expected_reviewer_keys === $reviewer_keys, $failures );

$shared_count = count( PermissionRegistry::keys_by_gate( 'shared' ) );
check(
	"reviewer's 7 keys are fewer than the {$shared_count} shared/viewer keys (proves no inheritance from the shared gate)",
	7 < $shared_count,
	$failures
);

echo "\n=== Explicit lockout edge case: description-only update must not touch permissions ===\n";
$before = call( 'GET', '/pukat/v1/roles', [], $admin_id );
$admin_row_before = current( array_filter( $before['data']['data'] ?? [], static fn( array $r ): bool => 'pukat_admin' === $r['role_slug'] ) );
$original_description = $admin_row_before['description'] ?? '';
$original_permission_count = count( $admin_row_before['permissions'] ?? [] );

$touch = call( 'PUT', '/pukat/v1/roles/pukat_admin', [ 'description' => 'Phase 7 QA touch — description only, no permissions key' ], $admin_id );
check( 'PUT /roles/pukat_admin with only description is 200 (not blocked)', 200 === $touch['status'], $failures );
check( 'description was actually updated', 'Phase 7 QA touch — description only, no permissions key' === ( $touch['data']['data']['description'] ?? null ), $failures );
check(
	'permissions completely untouched by a request that never included a permissions key',
	$original_permission_count === count( $touch['data']['data']['permissions'] ?? [] ),
	$failures
);

$registry_total = count( PermissionRegistry::all() );
check( "pukat_admin still has all {$registry_total} registry permissions after the description-only touch", $registry_total === count( $touch['data']['data']['permissions'] ?? [] ), $failures );

// Restore.
$restore = call( 'PUT', '/pukat/v1/roles/pukat_admin', [ 'description' => $original_description ], $admin_id );
check( "pukat_admin description restored to its original value", $original_description === ( $restore['data']['data']['description'] ?? null ), $failures );

// ── Cleanup ──
wp_delete_user( $reviewer_id );
check( 'ephemeral reviewer test user removed', false === get_userdata( $reviewer_id ), $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
