<?php
/**
 * Standalone unit check for PermissionRegistry — no WordPress bootstrap
 * needed, the class has zero WP dependency.
 *
 * Usage:
 * php wp-content/plugins/Pukat/tools/smoke-permission-registry.php
 *
 * @package Pukat
 */

declare(strict_types=1);

require dirname( __DIR__ ) . '/includes/Services/PermissionRegistry.php';

use Pukat\Services\PermissionRegistry;

$failures = [];

function check( string $label, bool $condition, array &$failures ): void {
	echo ( $condition ? "PASS" : "FAIL" ) . " — {$label}\n";
	if ( ! $condition ) {
		$failures[] = $label;
	}
}

$all = PermissionRegistry::all();

check( 'registry is non-empty', count( $all ) > 0, $failures );

// Every entry's own `key` field matches the array key it's stored under.
$self_consistent = true;
foreach ( $all as $array_key => $entry ) {
	if ( $entry['key'] !== $array_key ) {
		$self_consistent = false;
		break;
	}
}
check( 'every entry key matches its array key (no duplicates possible)', $self_consistent, $failures );

// Capability strings must be unique across the whole registry — two
// permission keys must never collide onto the same WP capability.
$capabilities = array_column( $all, 'capability' );
check( 'all capability strings are unique', count( $capabilities ) === count( array_unique( $capabilities ) ), $failures );

// Every entry must have a non-empty capability string.
$all_have_capability = true;
foreach ( $all as $entry ) {
	if ( '' === trim( (string) $entry['capability'] ) ) {
		$all_have_capability = false;
		break;
	}
}
check( 'no entry has an empty capability string', $all_have_capability, $failures );

// Every entry's gate must be one of the 4 values the seed logic understands.
$valid_gates    = [ 'shared', 'operator', 'admin', 'approve' ];
$all_gates_known = true;
foreach ( $all as $entry ) {
	if ( ! in_array( $entry['gate'], $valid_gates, true ) ) {
		$all_gates_known = false;
		break;
	}
}
check( 'every entry has a recognized seed gate (shared/operator/admin/approve)', $all_gates_known, $failures );

// capability_for() must be deterministic and match what all() already computed.
$capability_matches = true;
foreach ( $all as $key => $entry ) {
	if ( PermissionRegistry::capability_for( $key ) !== $entry['capability'] ) {
		$capability_matches = false;
		break;
	}
}
check( 'capability_for() matches all() for every key', $capability_matches, $failures );

// has_key() whitelist behavior.
check( 'has_key() true for a real key', PermissionRegistry::has_key( 'dashboard.view' ), $failures );
check( 'has_key() false for an invented key', ! PermissionRegistry::has_key( 'not_a_real.menu' ), $failures );

// keys_by_gate() partitions the registry exactly — every key in exactly one gate bucket.
$shared   = PermissionRegistry::keys_by_gate( 'shared' );
$operator = PermissionRegistry::keys_by_gate( 'operator' );
$admin    = PermissionRegistry::keys_by_gate( 'admin' );
$approve  = PermissionRegistry::keys_by_gate( 'approve' );
$gate_buckets = [ $shared, $operator, $admin, $approve ];
$no_overlap   = true;
foreach ( $gate_buckets as $i => $bucket_a ) {
	foreach ( $gate_buckets as $j => $bucket_b ) {
		if ( $i < $j && count( array_intersect( $bucket_a, $bucket_b ) ) > 0 ) {
			$no_overlap = false;
		}
	}
}
check(
	'keys_by_gate(shared/operator/admin/approve) partitions the full registry with no overlap',
	count( $shared ) + count( $operator ) + count( $admin ) + count( $approve ) === count( $all ) && $no_overlap,
	$failures
);

// grouped() must contain every entry exactly once.
$grouped_count = array_sum( array_map( 'count', PermissionRegistry::grouped() ) );
check( 'grouped() contains every entry exactly once', $grouped_count === count( $all ), $failures );

// dashboard.view must be `shared` — every seeded role (incl. Reviewer) depends on this as the universal landing page.
check( 'dashboard.view gate is shared', ( $all['dashboard.view']['gate'] ?? null ) === 'shared', $failures );

// The 3 approvable master resources must have an `.approve` action gated `approve`
// (Phase 4 of docs/IMPLEMENTATION_PLAN_RBAC.md) — a dedicated bucket, distinct from
// `operator`, since Operator does not hold approve-gated keys (only Admin/Reviewer do).
foreach ( [ 'master_playbooks', 'master_email_templates', 'master_landing_pages' ] as $menu ) {
	check(
		"{$menu}.approve exists and is gated approve (Operator excluded, Admin/Reviewer included)",
		( $all["{$menu}.approve"]['gate'] ?? null ) === 'approve',
		$failures
	);
}

echo "\n" . count( $all ) . " total permission keys (" . count( $shared ) . " shared, " . count( $operator ) . " operator, " . count( $admin ) . " admin, " . count( $approve ) . " approve).\n";

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
