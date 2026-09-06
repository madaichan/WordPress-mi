<?php
/**
 * Runtime smoke test for Campaign Groups (CampaignGroupController) and the
 * Campaign Run lifecycle changes that ship alongside them: the unified
 * `complete` action (renamed from `cancel`), bulk-complete, and
 * assign-group with entity enforcement. See docs/PRD_CAMPAIGN_GROUP_MONITORING.md
 * and docs/IMPLEMENTATION_PLAN_CAMPAIGN_GROUP_MONITORING.md.
 *
 * Every fixture Playbook Master is entity "General", which the existing
 * entity-editability rule (CampaignRunService::enforce_existing_playbook_editable())
 * restricts to admin-only edits regardless of the editor's own entity — so a
 * meaningful entity-mismatch test for assign-group needs a disposable
 * non-General Playbook Master. This script clones Playbook Master #1 (DIP,
 * active + fully configured) with entity overridden to the operator's own
 * entity ("ibaraki" in this fixture), and a second Campaign Group row
 * inserted directly with a different entity to prove cross-entity assignment
 * is rejected for non-admins. Everything created here is cleaned up at the end.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-campaign-groups.php
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
use Pukat\Services\CampaignRunService;

if ( ! class_exists( \Pukat\Api\CampaignGroupController::class ) ) {
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

// Fixed test users from the live dev fixture.
$admin_id    = 1; // steupy, administrator, entity "ibaraki"
$operator_id = 2; // pukatop, pukat_operator, entity "ibaraki"
$viewer_id   = 3; // pukatvie, pukat_viewer, entity "ibaraki"
$other_id    = 5; // pukat2vie, pukat_viewer, entity "ibaraki2"

$cleanup_group_ids = [];
$cleanup_run_ids   = [];
$disposable_playbook_id = null;

echo "=== Permission boundary ===\n";

$res = call( 'POST', '/pukat/v1/campaign-groups', [ 'name' => 'Should Not Exist' ], $viewer_id );
check( 'POST /campaign-groups as viewer is 403', 403 === $res['status'], $failures );

$res = call( 'GET', '/pukat/v1/campaign-groups', [], $viewer_id );
check( 'GET /campaign-groups as viewer is 200 (view-only)', 200 === $res['status'], $failures );

$res = call( 'POST', '/pukat/v1/campaign-groups', [ 'name' => 'x' ], 0 );
check( 'POST /campaign-groups unauthenticated is 401', 401 === $res['status'], $failures );

echo "\n=== Campaign Group CRUD + entity auto-assign ===\n";

$res = call( 'POST', '/pukat/v1/campaign-groups', [], $operator_id );
check( 'POST /campaign-groups without name is 422', 422 === $res['status'], $failures );

$group_name = 'Smoke Test Group ' . time();
$res        = call( 'POST', '/pukat/v1/campaign-groups', [ 'name' => $group_name, 'entity' => 'spoofed-entity' ], $operator_id );
check( 'POST /campaign-groups succeeds (201)', 201 === $res['status'], $failures );
$group_id = (int) ( $res['data']['data']['id'] ?? 0 );
$cleanup_group_ids[] = $group_id;
check( 'created group has an id', $group_id > 0, $failures );
check( "entity is server-assigned from creator ('ibaraki'), not the spoofed body value", 'ibaraki' === ( $res['data']['data']['entity'] ?? null ), $failures );
check( 'created group status starts computed as active (no members)', 'active' === ( $res['data']['data']['status'] ?? null ), $failures );
check( 'created group member_count starts at 0', 0 === ( $res['data']['data']['member_count'] ?? null ), $failures );

$res = call( 'GET', '/pukat/v1/campaign-groups', [], $operator_id );
$found = array_filter( $res['data']['data'] ?? [], static fn ( array $g ): bool => (int) $g['id'] === $group_id );
check( 'GET /campaign-groups lists the new group', count( $found ) === 1, $failures );

$res = call( 'GET', '/pukat/v1/campaign-groups', [], $other_id );
$found_cross_entity = array_filter( $res['data']['data'] ?? [], static fn ( array $g ): bool => (int) $g['id'] === $group_id );
check( "user from a different entity ('ibaraki2') cannot see the 'ibaraki' group", 200 === $res['status'] && count( $found_cross_entity ) === 0, $failures );

$res = call( 'PUT', "/pukat/v1/campaign-groups/{$group_id}", [ 'name' => $group_name . ' (renamed)' ], $operator_id );
check( 'PUT /campaign-groups/{id} renames it', 200 === $res['status'] && str_ends_with( (string) ( $res['data']['data']['name'] ?? '' ), '(renamed)' ), $failures );

$res = call( 'GET', '/pukat/v1/campaign-groups/999999', [], $operator_id );
check( 'GET /campaign-groups/{missing} is 404', 404 === $res['status'], $failures );

echo "\n=== Disposable fixtures (non-General playbook, so operator can fully edit its runs) ===\n";

$dip = $wpdb->get_row( "SELECT * FROM {$wpdb->prefix}pukat_playbook_masters WHERE id = 1", ARRAY_A );
if ( ! $dip ) {
	echo "  [SKIP] Playbook Master #1 (DIP) not found in this fixture — skipping entity/complete/bulk tests.\n";
} else {
	$clone = $dip;
	unset( $clone['id'] );
	$clone['name']   = 'Smoke Test Playbook ' . time();
	$clone['entity'] = 'ibaraki';
	$wpdb->insert( $wpdb->prefix . 'pukat_playbook_masters', $clone );
	$disposable_playbook_id = (int) $wpdb->insert_id;
	check( 'disposable Playbook Master cloned with entity "ibaraki"', $disposable_playbook_id > 0, $failures );

	$run_service = new CampaignRunService();

	function make_run( CampaignRunService $svc, int $playbookId, int $creatorId, array &$cleanup_run_ids, array &$failures, string $label ) {
		$result = $svc->create( [ 'playbook_master_id' => $playbookId, 'name' => 'Smoke Run ' . $label . ' ' . time() ], $creatorId );
		check( "disposable run created ({$label})", ! is_wp_error( $result ), $failures );
		if ( is_wp_error( $result ) ) {
			return null;
		}
		$id = (int) $result['id'];
		$cleanup_run_ids[] = $id;
		return $id;
	}

	$run_a = make_run( $run_service, $disposable_playbook_id, $operator_id, $cleanup_run_ids, $failures, 'A' );
	$run_b = make_run( $run_service, $disposable_playbook_id, $operator_id, $cleanup_run_ids, $failures, 'B' );

	echo "\n=== assign-group: entity enforcement ===\n";

	if ( $run_a ) {
		$res = call( 'POST', "/pukat/v1/campaign-runs/{$run_a}/assign-group", [ 'campaign_group_id' => $group_id ], $viewer_id );
		check( 'assign-group as viewer is 403', 403 === $res['status'], $failures );

		$res = call( 'POST', "/pukat/v1/campaign-runs/{$run_a}/assign-group", [ 'campaign_group_id' => $group_id ], $operator_id );
		check( 'assign-group to same-entity group succeeds for operator', 200 === $res['status'] && $group_id === (int) ( $res['data']['data']['campaign_group_id'] ?? 0 ), $failures );

		$res = call( 'GET', "/pukat/v1/campaign-groups/{$group_id}", [], $operator_id );
		check( 'group member_count is now 1', 1 === ( $res['data']['data']['member_count'] ?? null ), $failures );

		// Insert a group row directly with a different entity to test cross-entity rejection.
		$wpdb->insert( $wpdb->prefix . 'pukat_campaign_groups', [
			'name' => 'Smoke Other-Entity Group', 'entity' => 'other-entity', 'created_by' => $admin_id,
		] );
		$other_entity_group_id = (int) $wpdb->insert_id;
		$cleanup_group_ids[]   = $other_entity_group_id;

		$res = call( 'POST', "/pukat/v1/campaign-runs/{$run_a}/assign-group", [ 'campaign_group_id' => $other_entity_group_id ], $operator_id );
		check( 'assign-group to a different-entity group is rejected (422) for non-admin', 422 === $res['status'], $failures );

		$res = call( 'POST', "/pukat/v1/campaign-runs/{$run_a}/assign-group", [ 'campaign_group_id' => $other_entity_group_id ], $admin_id );
		check( 'assign-group to a different-entity group succeeds for admin (bypasses entity check)', 200 === $res['status'], $failures );
	}

	echo "\n=== Complete + bulk-complete ===\n";

	if ( $run_a ) {
		$res = call( 'POST', "/pukat/v1/campaign-runs/{$run_a}/complete", [], $operator_id );
		check( 'complete succeeds (no GoPhish call — never synced)', 200 === $res['status'] && 'completed' === ( $res['data']['data']['status'] ?? null ), $failures );
	}

	if ( $run_a && $run_b ) {
		$res = call( 'POST', '/pukat/v1/campaign-runs/bulk-complete', [ 'ids' => [ $run_a, $run_b ] ], $operator_id );
		check( 'bulk-complete returns 200', 200 === $res['status'], $failures );
		$results_by_id = [];
		foreach ( ( $res['data']['data'] ?? [] ) as $row ) {
			$results_by_id[ (int) $row['id'] ] = $row;
		}
		check( 'bulk-complete reports per-item results for both ids', isset( $results_by_id[ $run_a ], $results_by_id[ $run_b ] ), $failures );
		check( 'run A (already completed) reported as a failure, not silently skipped', false === ( $results_by_id[ $run_a ]['success'] ?? null ), $failures );
		check( 'run B (fresh) reported as a success', true === ( $results_by_id[ $run_b ]['success'] ?? null ), $failures );
	}

	echo "\n=== Report aggregation ===\n";

	$res = call( 'GET', "/pukat/v1/campaign-groups/{$group_id}/report", [], $operator_id );
	check( 'group report succeeds', 200 === $res['status'] && array_key_exists( 'stats', $res['data']['data'] ?? [] ), $failures );

	$res = call( 'GET', '/pukat/v1/campaign-groups/active/report', [], $operator_id );
	check( 'active-groups report succeeds', 200 === $res['status'] && array_key_exists( 'stats', $res['data']['data'] ?? [] ), $failures );
}

echo "\n=== Cleanup ===\n";

foreach ( $cleanup_run_ids as $id ) {
	$wpdb->delete( $wpdb->prefix . 'pukat_campaign_runs', [ 'id' => $id ] );
}
if ( $disposable_playbook_id ) {
	$wpdb->delete( $wpdb->prefix . 'pukat_playbook_masters', [ 'id' => $disposable_playbook_id ] );
}

$res = call( 'DELETE', "/pukat/v1/campaign-groups/{$group_id}", [], $operator_id );
check( 'DELETE /campaign-groups/{id} succeeds', 200 === $res['status'], $failures );
foreach ( array_diff( $cleanup_group_ids, [ $group_id ] ) as $id ) {
	$wpdb->delete( $wpdb->prefix . 'pukat_campaign_groups', [ 'id' => $id ] );
}

$res = call( 'GET', "/pukat/v1/campaign-groups/{$group_id}", [], $operator_id );
check( 'group is gone after delete', 404 === $res['status'], $failures );

echo "\n" . str_repeat( '=', 60 ) . "\n";
echo 'Failed: ' . count( $failures ) . "\n";

if ( $failures ) {
	echo "\nFailures:\n";
	foreach ( $failures as $failure ) {
		echo " - {$failure}\n";
	}
	exit( 1 );
}

exit( 0 );
