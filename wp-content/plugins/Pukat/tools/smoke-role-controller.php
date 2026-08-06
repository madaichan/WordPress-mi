<?php
/**
 * Runtime smoke test for RoleController (RBAC Phase 2).
 *
 * Exercises the full CRUD + permission-boundary surface described in
 * docs/IMPLEMENTATION_PLAN_RBAC.md Phase 2's validation checklist:
 * permission-denied, invalid permission key, delete system role, delete
 * role in use, and a full create -> grant -> assign -> revoke -> delete
 * success flow. Mutates and then restores a real test user's role.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-role-controller.php
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

use Pukat\Core\Activator;

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
Activator::maybe_upgrade();

// Fixed test users from the live Docker fixture (same ones used for the
// sending-profile-admin-only and RBAC seed smoke tests earlier this project).
$admin_id    = 2; // john_editor, pukat_admin
$operator_id = 4; // daymon, pukat_operator
$target_id   = 3; // fika — whatever her current role is gets captured and restored below

$target_user          = get_userdata( $target_id );
$target_original_role = $target_user ? array_values( array_intersect( $target_user->roles, [ 'pukat_admin', 'pukat_operator', 'pukat_viewer', 'pukat_reviewer' ] ) )[0] ?? 'none' : 'none';

echo "=== Permission boundary (operator, no roles.manage) ===\n";
$res = call( 'GET', '/pukat/v1/roles', [], $operator_id );
check( 'GET /roles as operator is 403', 403 === $res['status'], $failures );

$res = call( 'POST', '/pukat/v1/roles', [ 'display_name' => 'Should Not Exist' ], $operator_id );
check( 'POST /roles as operator is 403', 403 === $res['status'], $failures );

$res = call( 'GET', '/pukat/v1/permissions/registry', [], $operator_id );
check( 'GET /permissions/registry as operator is 403', 403 === $res['status'], $failures );

$res = call( 'GET', '/pukat/v1/me/permissions', [], $operator_id );
check( 'GET /me/permissions as operator is 200 (any logged-in user)', 200 === $res['status'], $failures );
$operator_permission_count = count( $res['data']['data']['permissions'] ?? [] );
check( 'operator has 48 permissions via /me/permissions (13 shared + 35 operator)', 48 === $operator_permission_count, $failures );

echo "\n=== List roles (admin) ===\n";
$res = call( 'GET', '/pukat/v1/roles', [], $admin_id );
check( 'GET /roles as admin is 200', 200 === $res['status'], $failures );
$initial_slugs = array_column( $res['data']['data'] ?? [], 'role_slug' );
sort( $initial_slugs );
check(
	'GET /roles returns exactly the 4 seeded system roles',
	[ 'pukat_admin', 'pukat_operator', 'pukat_reviewer', 'pukat_viewer' ] === $initial_slugs,
	$failures
);

echo "\n=== Validation ===\n";
$res = call( 'POST', '/pukat/v1/roles', [ 'display_name' => '', 'permissions' => [] ], $admin_id );
check( 'POST /roles with empty display_name is 422', 422 === $res['status'], $failures );

$res = call( 'POST', '/pukat/v1/roles', [ 'display_name' => 'Bad Perms Role', 'permissions' => [ 'not_a_real.key' ] ], $admin_id );
check( 'POST /roles with unknown permission key is 422', 422 === $res['status'], $failures );
check( 'error code is invalid_permission_key', 'invalid_permission_key' === ( $res['data']['code'] ?? null ), $failures );

echo "\n=== Full success flow: create -> grant -> assign -> revoke -> delete ===\n";
$create = call( 'POST', '/pukat/v1/roles', [
	'display_name' => 'Regional QA Smoke Test',
	'description'  => 'Created by tools/smoke-role-controller.php',
	'permissions'  => [ 'dashboard.view', 'campaigns.view', 'campaigns.create' ],
], $admin_id );
check( 'POST /roles (valid) is 201', 201 === $create['status'], $failures );
$new_slug = $create['data']['data']['role_slug'] ?? null;
check( 'created role slug starts with pukat_role_', is_string( $new_slug ) && str_starts_with( $new_slug, 'pukat_role_' ), $failures );
check( 'created role has 3 permissions', 3 === count( $create['data']['data']['permissions'] ?? [] ), $failures );
check( 'created role user_count is 0', 0 === ( $create['data']['data']['user_count'] ?? -1 ), $failures );

if ( $new_slug ) {
	$update = call( 'PUT', "/pukat/v1/roles/{$new_slug}", [
		'permissions' => [ 'dashboard.view', 'campaigns.view', 'campaigns.edit' ], // drop campaigns.create, add campaigns.edit
	], $admin_id );
	check( 'PUT /roles/{slug} (grant+revoke) is 200', 200 === $update['status'], $failures );
	$updated_permissions = $update['data']['data']['permissions'] ?? [];
	sort( $updated_permissions );
	$expected = [ 'campaigns.edit', 'campaigns.view', 'dashboard.view' ];
	check( 'permissions reflect the grant+revoke diff', $expected === $updated_permissions, $failures );

	$granted_logged = (bool) $wpdb->get_var( $wpdb->prepare(
		"SELECT COUNT(*) FROM {$wpdb->prefix}pukat_audit_logs WHERE action = %s AND details LIKE %s",
		'role.permission_granted', '%' . $wpdb->esc_like( $new_slug ) . '%'
	) );
	$revoked_logged = (bool) $wpdb->get_var( $wpdb->prepare(
		"SELECT COUNT(*) FROM {$wpdb->prefix}pukat_audit_logs WHERE action = %s AND details LIKE %s",
		'role.permission_revoked', '%' . $wpdb->esc_like( $new_slug ) . '%'
	) );
	check( 'role.permission_granted was audit-logged', $granted_logged, $failures );
	check( 'role.permission_revoked was audit-logged', $revoked_logged, $failures );

	$assign = call( 'PUT', "/pukat/v1/users/{$target_id}/role", [ 'pukat_role' => $new_slug ], $admin_id );
	check( 'assigning the new custom role to a real user is 200', 200 === $assign['status'], $failures );

	$users_list = call( 'GET', '/pukat/v1/users', [ 'search' => 'fika' ], $admin_id );
	$fika_row   = current( array_filter( $users_list['data']['data']['users'] ?? [], static fn( array $u ): bool => (int) $u['id'] === $target_id ) );
	check( 'GET /users shows the custom role for the assigned user', ( $fika_row['pukat_role'] ?? null ) === $new_slug, $failures );

	$delete_in_use = call( 'DELETE', "/pukat/v1/roles/{$new_slug}", [], $admin_id );
	check( 'DELETE /roles/{slug} while still assigned to a user is 409', 409 === $delete_in_use['status'], $failures );
	check( 'error code is role_in_use', 'role_in_use' === ( $delete_in_use['data']['code'] ?? null ), $failures );

	// Restore the test user's original role before freeing the custom role up for deletion.
	call( 'PUT', "/pukat/v1/users/{$target_id}/role", [ 'pukat_role' => $target_original_role ], $admin_id );

	$delete_ok = call( 'DELETE', "/pukat/v1/roles/{$new_slug}", [], $admin_id );
	check( 'DELETE /roles/{slug} after unassigning is 200', 200 === $delete_ok['status'], $failures );

	$after_delete = call( 'GET', '/pukat/v1/roles', [], $admin_id );
	$after_slugs  = array_column( $after_delete['data']['data'] ?? [], 'role_slug' );
	check( 'deleted role no longer appears in GET /roles', ! in_array( $new_slug, $after_slugs, true ), $failures );
}

echo "\n=== System role protection ===\n";
$delete_system = call( 'DELETE', '/pukat/v1/roles/pukat_admin', [], $admin_id );
check( 'DELETE /roles/pukat_admin (system role) is 400', 400 === $delete_system['status'], $failures );
check( 'error code is system_role', 'system_role' === ( $delete_system['data']['code'] ?? null ), $failures );

$lockout = call( 'PUT', '/pukat/v1/roles/pukat_admin', [ 'permissions' => [ 'dashboard.view' ] ], $admin_id );
check( 'PUT /roles/pukat_admin revoking users.manage_roles is 400', 400 === $lockout['status'], $failures );
check( 'error code is lockout_prevented', 'lockout_prevented' === ( $lockout['data']['code'] ?? null ), $failures );

// Sanity: pukat_admin must still have all its Phase-1 permissions after the rejected update above.
$final_roles = call( 'GET', '/pukat/v1/roles', [], $admin_id );
$admin_row   = current( array_filter( $final_roles['data']['data'] ?? [], static fn( array $r ): bool => 'pukat_admin' === $r['role_slug'] ) );
check( 'pukat_admin still has 59 permissions after the rejected lockout attempt', 59 === count( $admin_row['permissions'] ?? [] ), $failures );

// Confirm the test user ended up back where it started.
$target_user_after = get_userdata( $target_id );
check(
	'test user role fully restored to its original state',
	in_array( $target_original_role, $target_user_after->roles, true ) || ( 'none' === $target_original_role && [] === array_intersect( $target_user_after->roles, [ 'pukat_admin', 'pukat_operator', 'pukat_viewer', 'pukat_reviewer' ] ) ),
	$failures
);

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
