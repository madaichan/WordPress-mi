<?php
/**
 * Uninstall script — runs when plugin is deleted from WP admin.
 *
 * Removes all plugin data: options, custom tables, and roles.
 *
 * @package Pukat
 */

declare(strict_types=1);

// Security check.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

// ---------------------------------------------------------------------------
// Remove options
// ---------------------------------------------------------------------------
$options = [
	'pukat_version',
	'pukat_db_version',
	'pukat_gophish_url',
	'pukat_gophish_api_key',
	'pukat_org_name',
	'pukat_org_logo',
	'pukat_timezone',
	'pukat_quiz_pass_score',
	'pukat_risk_thresholds',
	'pukat_blackout_dates',
];

foreach ( $options as $option ) {
	delete_option( $option );
}

// ---------------------------------------------------------------------------
// Drop custom tables
// ---------------------------------------------------------------------------
$tables = [
	'pukat_campaigns',
	'pukat_targets',
	'pukat_playbooks',
	'pukat_quiz_questions',
	'pukat_quiz_results',
	'pukat_risk_scores',
	'pukat_coaching_assignments',
	'pukat_socialization_logs',
	'pukat_audit_logs',
];

foreach ( $tables as $table ) {
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$table}" );
}

// ---------------------------------------------------------------------------
// Remove custom roles
// ---------------------------------------------------------------------------
remove_role( 'pukat_admin' );
remove_role( 'pukat_operator' );
remove_role( 'pukat_viewer' );

// Remove caps from WP admins.
$admin_role = get_role( 'administrator' );
if ( $admin_role ) {
	$admin_role->remove_cap( 'pukat_manage_campaigns' );
	$admin_role->remove_cap( 'pukat_view_reports' );
	$admin_role->remove_cap( 'pukat_manage_users' );
	$admin_role->remove_cap( 'pukat_manage_settings' );
}
