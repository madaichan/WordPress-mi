<?php
/**
 * Runtime smoke test for the 3 permission keys activated in PR 4 of
 * docs/IMPLEMENTATION_PLAN_RBAC_COVERAGE_COMPLETION.md:
 * `master_email_templates.assign_entity`, `master_landing_pages.assign_entity`
 * and `domains.authorize` — all three previously existed in the Permission
 * Registry (and so in the Roles UI) without any backend code reading them.
 *
 * Everything this script touches is created by the script itself (two
 * throwaway roles, two throwaway users, one email template master, one
 * landing page master, one dynamic domain) and removed again at the end. It
 * never writes to a pre-existing row.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-rbac-coverage.php
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

use Pukat\Services\MasterComponentService;
use Pukat\Services\PermissionRegistry;

if ( ! class_exists( MasterComponentService::class ) ) {
	fwrite( STDERR, "Pukat is not loaded. Make sure the plugin is active.\n" );
	exit( 1 );
}

global $wpdb;

$failures = [];

function check( string $label, bool $condition, array &$failures ): void {
	echo ( $condition ? 'PASS' : 'FAIL' ) . " — {$label}\n";
	if ( ! $condition ) {
		$failures[] = $label;
	}
}

function call( string $method, string $route, array $params, int $user_id ): array {
	wp_set_current_user( $user_id );
	$request = new WP_REST_Request( $method, $route );
	foreach ( $params as $key => $value ) {
		$request->set_param( $key, $value );
	}
	$response = rest_do_request( $request );

	return [ $response->get_status(), $response->get_data() ];
}

do_action( 'rest_api_init' );

$own_entity   = 'SmokePR4Own';
$other_entity = 'SmokePR4Other';
$suffix       = (string) time();

// ---------------------------------------------------------------------------
// Two throwaway roles that differ ONLY in the 3 keys under test.
// ---------------------------------------------------------------------------
$base_keys = [
	'master_email_templates.view',
	'master_email_templates.edit',
	'master_landing_pages.view',
	'master_landing_pages.edit',
	'domains.view',
	'domains.edit',
];
$extra_keys = [
	'master_email_templates.assign_entity',
	'master_landing_pages.assign_entity',
	'domains.authorize',
];

$roles = [
	'pukat_smoke_pr4_plain' => $base_keys,
	'pukat_smoke_pr4_power' => array_merge( $base_keys, $extra_keys ),
];

$user_ids = [];
foreach ( $roles as $role_slug => $keys ) {
	remove_role( $role_slug );
	add_role( $role_slug, 'Smoke PR4 ' . $role_slug, [ 'read' => true ] );
	$role = get_role( $role_slug );
	foreach ( $keys as $key ) {
		$role->add_cap( PermissionRegistry::capability_for( $key ) );
	}

	$login   = $role_slug . '_' . $suffix;
	$user_id = wp_insert_user( [
		'user_login' => $login,
		'user_pass'  => wp_generate_password(),
		'user_email' => $login . '@example.test',
		'role'       => $role_slug,
	] );
	if ( is_wp_error( $user_id ) ) {
		fwrite( STDERR, "Could not create {$role_slug} test user: " . $user_id->get_error_message() . "\n" );
		exit( 1 );
	}
	update_user_meta( (int) $user_id, 'meta_entity', $own_entity );
	$user_ids[ $role_slug ] = (int) $user_id;
}

$plain = $user_ids['pukat_smoke_pr4_plain'];
$power = $user_ids['pukat_smoke_pr4_power'];

// ---------------------------------------------------------------------------
// Throwaway rows, inserted directly so creation permissions stay out of scope.
// ---------------------------------------------------------------------------
$email_table  = $wpdb->prefix . 'pukat_email_template_masters';
$landing_table = $wpdb->prefix . 'pukat_landing_page_masters';
$domain_table = $wpdb->prefix . 'pukat_dynamic_domains';

$wpdb->insert( $email_table, [ 'name' => 'Smoke PR4 Email ' . $suffix, 'entity' => $own_entity, 'status' => 'draft' ] );
$email_id = (int) $wpdb->insert_id;
$wpdb->insert( $landing_table, [ 'name' => 'Smoke PR4 Landing ' . $suffix, 'entity' => $own_entity, 'status' => 'draft' ] );
$landing_id = (int) $wpdb->insert_id;
$wpdb->insert( $domain_table, [
	'domain'               => 'smoke-pr4-' . $suffix . '.test',
	'owner_entity'         => $own_entity,
	'authorization_status' => 'pending',
	'environment'          => 'production',
	'status'               => 'draft',
	'tracking_url'         => 'https://before.example.test/',
] );
$domain_id = (int) $wpdb->insert_id;

check( 'throwaway rows created', $email_id > 0 && $landing_id > 0 && $domain_id > 0, $failures );

function column( string $table, int $id, string $column ): string {
	global $wpdb;

	// $table/$column are script-local constants, never request input.
	return (string) $wpdb->get_var( $wpdb->prepare( "SELECT {$column} FROM {$table} WHERE id = %d", $id ) );
}

// ---------------------------------------------------------------------------
// master_email_templates.assign_entity / master_landing_pages.assign_entity
// ---------------------------------------------------------------------------
foreach ( [
	[ 'email', '/pukat/v1/master/email-templates/' . $email_id, $email_table, $email_id, 'entity' ],
	[ 'landing page', '/pukat/v1/master/landing-pages/' . $landing_id, $landing_table, $landing_id, 'entity' ],
] as [ $label, $route, $table, $row_id, $col ] ) {
	[ $status ] = call( 'PUT', $route, [ 'entity' => $other_entity ], $plain );
	check( "{$label}: reassign to another entity WITHOUT .assign_entity is 403", 403 === $status, $failures );
	check( "{$label}: entity unchanged after the refused reassign", $own_entity === column( $table, $row_id, $col ), $failures );

	[ $status ] = call( 'PUT', $route, [ 'entity' => $other_entity ], $power );
	check( "{$label}: reassign WITH .assign_entity succeeds", 200 === $status, $failures );
	check( "{$label}: entity is now the requested one", $other_entity === column( $table, $row_id, $col ), $failures );
}

// ---------------------------------------------------------------------------
// domains.authorize
// ---------------------------------------------------------------------------
$domain_route = '/pukat/v1/master/dynamic-domains/' . $domain_id;

[ $status ] = call( 'PUT', $domain_route, [
	'owner_entity'         => $own_entity,
	'authorization_status' => 'authorized',
	'tracking_url'         => 'https://after.example.test/',
], $plain );
check( 'domain: edit WITHOUT domains.authorize still succeeds', 200 === $status, $failures );
check( 'domain: authorization_status kept at pending', 'pending' === column( $domain_table, $domain_id, 'authorization_status' ), $failures );
check(
	'domain: the other edited field was saved (not a blanket 403)',
	str_contains( column( $domain_table, $domain_id, 'tracking_url' ), 'after.example.test' ),
	$failures
);

[ $status ] = call( 'PUT', $domain_route, [
	'owner_entity'         => $own_entity,
	'authorization_status' => 'authorized',
], $power );
check( 'domain: edit WITH domains.authorize succeeds', 200 === $status, $failures );
check( 'domain: authorization_status is now authorized', 'authorized' === column( $domain_table, $domain_id, 'authorization_status' ), $failures );

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
wp_set_current_user( 0 );
$wpdb->delete( $email_table, [ 'id' => $email_id ] );
$wpdb->delete( $landing_table, [ 'id' => $landing_id ] );
$wpdb->delete( $domain_table, [ 'id' => $domain_id ] );
foreach ( $user_ids as $user_id ) {
	wp_delete_user( $user_id );
}
foreach ( array_keys( $roles ) as $role_slug ) {
	remove_role( $role_slug );
}

$leftover_rows  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$email_table} WHERE id = %d", $email_id ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$landing_table} WHERE id = %d", $landing_id ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$domain_table} WHERE id = %d", $domain_id ) );
$leftover_users = array_filter( array_map( 'get_userdata', array_values( $user_ids ) ) );
$leftover_roles = array_filter( array_map( 'get_role', array_keys( $roles ) ) );
check( 'all throwaway rows, users and roles removed', 0 === $leftover_rows && ! $leftover_users && ! $leftover_roles, $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
