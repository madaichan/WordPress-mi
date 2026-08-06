<?php
/**
 * Runtime smoke test for RBAC Phase 1 seeding (Activator::seed_rbac_defaults()).
 *
 * Verifies the seed is idempotent (running it twice does not duplicate
 * `wp_pukat_role_meta` rows or corrupt role capabilities) and that the 4
 * system roles end up with the capability counts the Permission Registry
 * gates predict.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-rbac-seed.php
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
use Pukat\Services\PermissionRegistry;

if ( ! class_exists( Activator::class ) ) {
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

// seed_rbac_defaults() is private — invoke it directly via reflection so this
// test exercises the exact idempotency property Phase 1 needs, independent
// of the `pukat_db_version` version-gate wrapper in maybe_upgrade().
$run_seed = static function (): void {
	$method = new ReflectionMethod( Activator::class, 'seed_rbac_defaults' );
	$method->setAccessible( true );
	$method->invoke( null );
};

// Public entry point — ensures wp_pukat_role_meta exists (via the private
// create_tables()) and runs the versioned upgrade path at least once.
Activator::maybe_upgrade();

$table = $wpdb->prefix . 'pukat_role_meta';

$run_seed();

$rows_after_first = $wpdb->get_results( "SELECT id, role_slug, is_system_role, created_at FROM {$table} ORDER BY role_slug", ARRAY_A );
check( 'role_meta has exactly 4 rows after first seed run', count( $rows_after_first ) === 4, $failures );

$expected_slugs = [ 'pukat_admin', 'pukat_operator', 'pukat_reviewer', 'pukat_viewer' ];
$actual_slugs   = array_column( $rows_after_first, 'role_slug' );
sort( $actual_slugs );
check( 'role_meta contains exactly the 4 expected role slugs', $expected_slugs === $actual_slugs, $failures );

$all_system = true;
foreach ( $rows_after_first as $row ) {
	if ( '1' !== (string) $row['is_system_role'] ) {
		$all_system = false;
	}
}
check( 'all 4 seeded roles are marked is_system_role', $all_system, $failures );

// Run again — this is the actual idempotency check.
$run_seed();
$run_seed();

$rows_after_repeat = $wpdb->get_results( "SELECT id, role_slug, is_system_role, created_at FROM {$table} ORDER BY role_slug", ARRAY_A );
check( 'role_meta still has exactly 4 rows after 2 more seed runs (no duplicates)', count( $rows_after_repeat ) === 4, $failures );
check( 'row IDs and created_at unchanged across repeat runs (no re-insert happened)', $rows_after_first === $rows_after_repeat, $failures );

// Capability counts should match what the registry gates predict.
$shared_count   = count( PermissionRegistry::keys_by_gate( 'shared' ) );
$operator_count = count( PermissionRegistry::keys_by_gate( 'operator' ) );
$admin_count    = count( PermissionRegistry::keys_by_gate( 'admin' ) );

// Count RBAC-registry-derived capabilities specifically (prefixed pukat_ and
// present in the registry's capability list) rather than all pukat_* caps,
// since the 4 legacy base caps (pukat_manage_campaigns etc.) also start with pukat_.
function pukat_registry_cap_count( string $role_slug ): int {
	$role = get_role( $role_slug );
	if ( ! $role ) {
		return -1;
	}
	$registry_caps = array_map(
		static fn( array $entry ): string => $entry['capability'],
		PermissionRegistry::all()
	);
	return count( array_intersect( $registry_caps, array_keys( array_filter( $role->capabilities ) ) ) );
}

check( 'pukat_admin has all ' . ( $shared_count + $operator_count + $admin_count ) . ' registry capabilities', pukat_registry_cap_count( 'pukat_admin' ) === $shared_count + $operator_count + $admin_count, $failures );
check( 'administrator has all ' . ( $shared_count + $operator_count + $admin_count ) . ' registry capabilities', pukat_registry_cap_count( 'administrator' ) === $shared_count + $operator_count + $admin_count, $failures );
check( 'pukat_operator has ' . ( $shared_count + $operator_count ) . ' registry capabilities (shared+operator, no admin)', pukat_registry_cap_count( 'pukat_operator' ) === $shared_count + $operator_count, $failures );
check( 'pukat_viewer has ' . $shared_count . ' registry capabilities (shared only)', pukat_registry_cap_count( 'pukat_viewer' ) === $shared_count, $failures );
check( 'pukat_reviewer has exactly 7 registry capabilities (view+approve on 3 resources + dashboard)', pukat_registry_cap_count( 'pukat_reviewer' ) === 7, $failures );

// Legacy 4-capability model must be untouched — Phase 1 must not regress today's gates.
$legacy_intact = get_role( 'pukat_admin' )->has_cap( 'pukat_manage_settings' )
	&& get_role( 'pukat_operator' )->has_cap( 'pukat_manage_campaigns' )
	&& ! get_role( 'pukat_operator' )->has_cap( 'pukat_manage_settings' )
	&& get_role( 'pukat_viewer' )->has_cap( 'pukat_view_reports' )
	&& ! get_role( 'pukat_viewer' )->has_cap( 'pukat_manage_campaigns' );
check( 'legacy 4-capability model (pukat_manage_campaigns/settings/etc) is untouched', $legacy_intact, $failures );

// Reviewer should NOT have picked up any legacy base capability — it's a brand new role.
$reviewer_role  = get_role( 'pukat_reviewer' );
$reviewer_clean = $reviewer_role && ! $reviewer_role->has_cap( 'pukat_manage_campaigns' ) && ! $reviewer_role->has_cap( 'pukat_manage_settings' );
check( 'pukat_reviewer has none of the legacy base capabilities', $reviewer_clean, $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
