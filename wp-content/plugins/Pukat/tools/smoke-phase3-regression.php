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
// Cleanup
// ---------------------------------------------------------------------------
wp_delete_user( $viewer_id );
check( 'ephemeral viewer test user removed', false === get_userdata( $viewer_id ), $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
