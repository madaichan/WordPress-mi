<?php
/**
 * Runtime smoke test for RBAC Phase 4 (docs/IMPLEMENTATION_PLAN_RBAC.md §8 —
 * Approval Capability Split and Self-Approval Guard).
 *
 * Covers the plan's own validation checklist end-to-end with real drafts:
 *   - Operator (creator) approving their own Playbook Master draft -> 403 self_approval_forbidden.
 *   - Reviewer (not the creator) approving someone else's draft -> succeeds
 *     (or at least clears the self-approval AND entity-ownership checks).
 *   - Reviewer attempting to create a new draft -> 403 (never granted .create).
 *
 * Also exercises the full clean create -> self-approve-blocked ->
 * reviewer-approves(200) round trip for email template versions and landing
 * page versions, since those have no readiness prerequisite (unlike Playbook
 * Master, which requires linked/approved default components) — a genuine
 * 200 is achievable and worth proving, not just the permission boundary.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-phase4-approval.php
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

$admin_id    = 2; // john_editor, pukat_admin
$operator_id = 4; // daymon, pukat_operator

// Ephemeral reviewer user — no fixture user holds pukat_reviewer.
$reviewer_login = 'pukat_smoke_reviewer_' . time();
$reviewer_id    = wp_insert_user( [
	'user_login' => $reviewer_login,
	'user_pass'  => wp_generate_password(),
	'user_email' => $reviewer_login . '@example.test',
	'role'       => 'pukat_reviewer',
] );

if ( is_wp_error( $reviewer_id ) ) {
	fwrite( STDERR, 'Could not create ephemeral reviewer test user: ' . $reviewer_id->get_error_message() . "\n" );
	exit( 1 );
}

// Operator (daymon) has no entity assigned in this environment (verified
// earlier this session) — the create-draft calls below need one, and this
// is also the plan's own literal scenario ("Operator (creator)"). Assign a
// temporary entity, restore afterward regardless of pass/fail.
$operator_original_entity = get_user_meta( $operator_id, 'entity', true );
update_user_meta( $operator_id, 'entity', 'Phase4SmokeEntity' );

$playbook_id = null;

// ---------------------------------------------------------------------------
// Playbook Master: Operator creates, Operator (creator) cannot self-approve,
// Reviewer clears both the self-approval AND entity-ownership checks.
// Not asserting a clean 200 here — Playbook Master approval also requires
// validate_ready_for_approval() (linked, approved default components), which
// a bare smoke-test draft can't realistically satisfy. What matters for this
// phase is that the guard blocks the creator and does NOT block the reviewer.
// ---------------------------------------------------------------------------
$create = call( 'POST', '/pukat/v1/playbook-masters', [
	'name'   => 'Phase 4 Smoke Playbook ' . time(),
	'entity' => 'Phase4SmokeEntity', // must match the operator's assigned entity below, or entity_forbidden
], $operator_id );
check( 'operator creates a playbook master draft (201)', 201 === $create['status'], $failures );
$playbook_id = $create['data']['data']['id'] ?? null;

if ( $playbook_id ) {
	// Operator no longer holds master_playbooks.approve at all after Phase 4
	// (that's the primary change, not the self-approval guard) — so this is
	// correctly blocked by the capability gate itself (rest_forbidden),
	// never reaching the self-approval guard. The guard's real target is a
	// creator who DOES hold .approve (e.g. Admin, or a future custom
	// dual-role) — tested below via admin editing then approving.
	$operator_self_approve = call( 'POST', "/pukat/v1/playbook-masters/{$playbook_id}/approve", [], $operator_id );
	check(
		'operator (creator, no .approve at all post-Phase-4) is blocked at the capability gate, not the self-approval guard',
		403 === $operator_self_approve['status'] && 'rest_forbidden' === ( $operator_self_approve['data']['code'] ?? null ),
		$failures
	);

	// Admin edits the operator's draft (updated_by = admin) — tests the
	// guard's `updated_by` branch specifically, distinct from `created_by`
	// (already covered by the email/landing template version cases below).
	$edit = call( 'PUT', "/pukat/v1/playbook-masters/{$playbook_id}", [ 'description' => 'Edited by admin for Phase 4 smoke test' ], $admin_id );
	check( 'admin edits the operator-created playbook (200)', 200 === $edit['status'], $failures );

	$admin_self_approve = call( 'POST', "/pukat/v1/playbook-masters/{$playbook_id}/approve", [], $admin_id );
	check(
		'admin (now updated_by, not created_by, but holds .approve) is blocked by the self-approval guard',
		403 === $admin_self_approve['status'] && 'self_approval_forbidden' === ( $admin_self_approve['data']['code'] ?? null ),
		$failures
	);

	$reviewer_approve = call( 'POST', "/pukat/v1/playbook-masters/{$playbook_id}/approve", [], $reviewer_id );
	check(
		'reviewer (neither created_by nor updated_by) approving is NOT blocked by the self-approval guard',
		'self_approval_forbidden' !== ( $reviewer_approve['data']['code'] ?? null ),
		$failures
	);
	check(
		'reviewer approving also clears the entity-ownership check (not entity_forbidden)',
		'entity_forbidden' !== ( $reviewer_approve['data']['code'] ?? null ),
		$failures
	);
}

// Restore operator's original entity state before continuing.
if ( '' === (string) $operator_original_entity ) {
	delete_user_meta( $operator_id, 'entity' );
} else {
	update_user_meta( $operator_id, 'entity', $operator_original_entity );
}
check( 'operator entity meta restored to its original state', get_user_meta( $operator_id, 'entity', true ) === $operator_original_entity, $failures );

// ---------------------------------------------------------------------------
// Email Template Version: full clean round trip. Admin creates (bypasses
// entity checks entirely), admin (creator) is blocked from self-approving,
// reviewer approves for real — this one has no readiness prerequisite, so a
// genuine 200 is the right bar, not just a boundary check.
// ---------------------------------------------------------------------------
$email_master_id  = null;
$email_version_id = null;

$email_create = call( 'POST', '/pukat/v1/master/email-templates', [
	'name'      => 'Phase 4 Smoke Email ' . time(),
	'subject'   => 'Phase 4 smoke test subject',
	'html_body' => '<p>Phase 4 smoke test body</p>',
], $admin_id );
check( 'admin creates an email template master + initial version (201)', 201 === $email_create['status'], $failures );
$email_master_id = $email_create['data']['data']['id'] ?? null;

if ( $email_master_id ) {
	$versions = call( 'GET', "/pukat/v1/master/email-templates/{$email_master_id}/versions", [], $admin_id );
	$email_version_id = $versions['data']['data'][0]['id'] ?? null;
	check( 'initial version exists and is fetchable', null !== $email_version_id, $failures );
}

if ( $email_version_id ) {
	$self_approve = call( 'POST', "/pukat/v1/master/email-template-versions/{$email_version_id}/approve", [], $admin_id );
	check(
		'admin (creator) approving their own email template version is blocked',
		403 === $self_approve['status'] && 'self_approval_forbidden' === ( $self_approve['data']['code'] ?? null ),
		$failures
	);

	$reviewer_approve = call( 'POST', "/pukat/v1/master/email-template-versions/{$email_version_id}/approve", [], $reviewer_id );
	check( 'reviewer successfully approves the email template version (200)', 200 === $reviewer_approve['status'], $failures );
	check( 'approved version status is now approved', 'approved' === ( $reviewer_approve['data']['data']['status'] ?? null ), $failures );
}

$reviewer_create = call( 'POST', '/pukat/v1/master/email-templates', [
	'name'      => 'Should never be created',
	'subject'   => 'x',
	'html_body' => 'x',
], $reviewer_id );
check(
	'reviewer cannot create a new email template master (403, never granted .create)',
	403 === $reviewer_create['status'] && 'rest_forbidden' === ( $reviewer_create['data']['code'] ?? null ),
	$failures
);

// ---------------------------------------------------------------------------
// Landing Page Version: same full round trip, mirrors the email template
// case exactly (both share MasterComponentService::approve_version()) — kept
// as its own real test rather than assumed-symmetric, since a mistake in
// either call site's new $approve_permission_key argument (Phase 4's fix for
// the entity-ownership bypass) would only show up in the mismatched one.
// ---------------------------------------------------------------------------
$landing_master_id  = null;
$landing_version_id = null;

$landing_create = call( 'POST', '/pukat/v1/master/landing-pages', [
	'name'      => 'Phase 4 Smoke Landing ' . time(),
	'html_body' => '<html><body>Phase 4 smoke test</body></html>',
], $admin_id );
check( 'admin creates a landing page master + initial version (201)', 201 === $landing_create['status'], $failures );
$landing_master_id = $landing_create['data']['data']['id'] ?? null;

if ( $landing_master_id ) {
	$versions = call( 'GET', "/pukat/v1/master/landing-pages/{$landing_master_id}/versions", [], $admin_id );
	$landing_version_id = $versions['data']['data'][0]['id'] ?? null;
	check( 'initial version exists and is fetchable', null !== $landing_version_id, $failures );
}

if ( $landing_version_id ) {
	$self_approve = call( 'POST', "/pukat/v1/master/landing-page-versions/{$landing_version_id}/approve", [], $admin_id );
	check(
		'admin (creator) approving their own landing page version is blocked',
		403 === $self_approve['status'] && 'self_approval_forbidden' === ( $self_approve['data']['code'] ?? null ),
		$failures
	);

	$reviewer_approve = call( 'POST', "/pukat/v1/master/landing-page-versions/{$landing_version_id}/approve", [], $reviewer_id );
	check( 'reviewer successfully approves the landing page version (200)', 200 === $reviewer_approve['status'], $failures );
	check( 'approved version status is now approved', 'approved' === ( $reviewer_approve['data']['data']['status'] ?? null ), $failures );
}

// ---------------------------------------------------------------------------
// Cleanup — direct DB, since PlaybookMasterController has no DELETE route
// and going through the master-delete endpoints for the other two adds no
// extra coverage over what's already been asserted.
// ---------------------------------------------------------------------------
if ( $playbook_id ) {
	$wpdb->delete( $wpdb->prefix . 'pukat_playbook_masters', [ 'id' => $playbook_id ] );
}
if ( $email_master_id ) {
	$wpdb->delete( $wpdb->prefix . 'pukat_email_template_versions', [ 'template_master_id' => $email_master_id ] );
	$wpdb->delete( $wpdb->prefix . 'pukat_email_template_masters', [ 'id' => $email_master_id ] );
}
if ( $landing_master_id ) {
	$wpdb->delete( $wpdb->prefix . 'pukat_landing_page_versions', [ 'landing_page_master_id' => $landing_master_id ] );
	$wpdb->delete( $wpdb->prefix . 'pukat_landing_page_masters', [ 'id' => $landing_master_id ] );
}
wp_delete_user( $reviewer_id );
check( 'ephemeral reviewer test user removed', false === get_userdata( $reviewer_id ), $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
