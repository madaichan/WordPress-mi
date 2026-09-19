<?php
/**
 * Read-only CSV/XLSX "Download data" smoke checks against a running
 * WordPress install — docs/PRD_MONITORING_DATA_EXPORT.md.
 * Usage: php wp-content/plugins/Pukat/tools/smoke-campaign-export-data.php [output-directory]
 * Review artifacts contain synthetic data, except the *-live.* files (real
 * local campaign/group data), same convention as smoke-campaign-pdf.php.
 */
declare(strict_types=1);
require dirname( __DIR__, 4 ) . '/wp-load.php';

use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use Pukat\Services\CampaignDataExportService;

$output = $argv[1] ?? sys_get_temp_dir() . '/pukat-export-review';
if ( ! is_dir( $output ) ) {
	mkdir( $output, 0700, true );
}

$failures = [];
function check( string $label, bool $condition ): void {
	global $failures;
	echo ( $condition ? 'PASS' : 'FAIL' ) . " — {$label}\n";
	if ( ! $condition ) {
		$failures[] = $label;
	}
}

/** Read an XLSX binary back into a plain array of row-arrays (header + data). */
function read_xlsx_rows( string $binary ): array {
	$tmp = tempnam( sys_get_temp_dir(), 'pukat-export-smoke-' );
	file_put_contents( $tmp, $binary );

	$rows = [];
	$reader = new XlsxReader();
	$reader->open( $tmp );
	foreach ( $reader->getSheetIterator() as $sheet ) {
		foreach ( $sheet->getRowIterator() as $row ) {
			$rows[] = $row->toArray();
		}
		break;
	}
	$reader->close();
	unlink( $tmp );

	return $rows;
}

$service = new CampaignDataExportService();

// ---------------------------------------------------------------------------
// resolve_format()
// ---------------------------------------------------------------------------

check( 'resolve_format: empty string defaults to csv', CampaignDataExportService::FORMAT_CSV === $service->resolve_format( '' ) );
check( 'resolve_format: "xlsx" accepted', CampaignDataExportService::FORMAT_XLSX === $service->resolve_format( 'xlsx' ) );
check( 'resolve_format: case-insensitive', CampaignDataExportService::FORMAT_XLSX === $service->resolve_format( 'XLSX' ) );
$invalid_format = $service->resolve_format( 'pdf' );
check( 'resolve_format: unknown value is a 400 WP_Error', is_wp_error( $invalid_format ) && 400 === $invalid_format->get_error_data()['status'] );

// ---------------------------------------------------------------------------
// target_details_table() — mirrors Performing.jsx's TARGET_DETAILS_SCHEMA
// ---------------------------------------------------------------------------

$targets = [
	[ 'email' => 'ani.wijaya@corp.example', 'name' => 'Ani Wijaya', 'department' => 'Keuangan & Ánggaran', 'status' => 'Clicked Link', 'opened_at' => '2026-09-15T02:05:00+00:00', 'clicked_at' => '2026-09-15T02:06:00+00:00', 'submitted_at' => null, 'reported_at' => null ],
	[ 'email' => 'formula@corp.example', 'name' => '=cmd|\' /c calc\'!A1', 'department' => '+SUM(A1:A9)', 'status' => 'Email Sent', 'opened_at' => null, 'clicked_at' => null, 'submitted_at' => null, 'reported_at' => null ],
];

$table = $service->target_details_table( $targets );
check( 'target_details_table: headers match on-screen columns', [ 'Name', 'Email', 'Department', 'Status', 'Opened At', 'Clicked At', 'Submitted At', 'Reported At' ] === $table['headers'] );
check( 'target_details_table: one row per target', 2 === count( $table['rows'] ) );
check( 'target_details_table: name formula injection neutralised', "'=cmd|' /c calc'!A1" === $table['rows'][1][0] );
check( 'target_details_table: department formula injection neutralised', "'+SUM(A1:A9)" === $table['rows'][1][2] );
check( 'target_details_table: timestamp formatted, not raw ISO', '' !== $table['rows'][0][4] && ! str_contains( $table['rows'][0][4], 'T' ) );
check( 'target_details_table: missing timestamp is empty string, not null/0000', '' === $table['rows'][1][4] );

$empty_table = $service->target_details_table( [] );
check( 'target_details_table: empty input still produces headers with zero rows', [] === $empty_table['rows'] && 8 === count( $empty_table['headers'] ) );

// ---------------------------------------------------------------------------
// campaign_summary_table() — mirrors Performing.jsx's "Campaign funnel"
// ---------------------------------------------------------------------------

$group_report = [
	'stats'         => [ 'total' => 550, 'email_sent' => 540, 'email_opened' => 370, 'clicked' => 124, 'submitted_data' => 27, 'click_rate' => 22.5, 'submit_rate' => 4.9 ],
	'campaign_runs' => [
		[ 'campaign_run_id' => 201, 'campaign_group_id' => 9, 'name' => 'HR Policy Update', 'status' => 'completed', 'playbook_name' => 'Internal Policy Notice', 'launched_at' => '2026-09-15 01:00:00', 'schedule_at' => null, 'target_count' => 300, 'synced_at' => '2026-09-18 02:40:00', 'stats' => [ 'total' => 300, 'email_sent' => 300, 'email_opened' => 210, 'clicked' => 54, 'click_rate' => 18, 'submitted_data' => 12, 'submit_rate' => 4 ] ],
		[ 'campaign_run_id' => 202, 'campaign_group_id' => 0, 'name' => 'Invoice + Verification', 'status' => 'running', 'playbook_name' => 'Supplier Invoice Request', 'launched_at' => null, 'schedule_at' => '2026-09-20 02:00:00', 'target_count' => 250, 'synced_at' => null, 'stats' => [] ],
		[ 'campaign_run_id' => 203, 'campaign_group_id' => 0, 'name' => '=HYPERLINK("http://evil.example")', 'status' => 'draft_run', 'playbook_name' => null, 'launched_at' => null, 'schedule_at' => null, 'target_count' => 0, 'synced_at' => null, 'stats' => [] ],
	],
];
$groups_by_id = [ 9 => 'Q3 Awareness Exercise' ];

$summary = $service->campaign_summary_table( $group_report, $groups_by_id, null, null );
check( 'campaign_summary_table: headers match spec', 13 === count( $summary['headers'] ) && 'Campaign Name' === $summary['headers'][0] && 'Last Synced At' === end( $summary['headers'] ) );
check( 'campaign_summary_table: one row per run plus a Total row', 4 === count( $summary['rows'] ) );
check( 'campaign_summary_table: group name resolved via groups_by_id map', 'Q3 Awareness Exercise' === $summary['rows'][0][3] );
check( 'campaign_summary_table: campaign_group_id 0 resolves to Ungrouped', 'Ungrouped' === $summary['rows'][1][3] );
check( 'campaign_summary_table: "+" mid-string is not mistaken for formula injection', 'Invoice + Verification' === $summary['rows'][1][0] );
check( 'campaign_summary_table: campaign name formula injection neutralised', "'=HYPERLINK" === substr( $summary['rows'][2][0], 0, 11 ) );
check( 'campaign_summary_table: missing playbook name shown as em dash', '—' === $summary['rows'][2][2] );
check( 'campaign_summary_table: unsynced run has empty Last Synced At', '' === $summary['rows'][1][12] );
$total_row = end( $summary['rows'] );
check( 'campaign_summary_table: Total row label', 'Total' === $total_row[0] );
check( 'campaign_summary_table: Total row uses report stats, not a recount', '540' === $total_row[6] && '124' === $total_row[8] );

$single_group_report = array_merge( $group_report, [ 'campaign_runs' => [ $group_report['campaign_runs'][0] ] ] );
$single = $service->campaign_summary_table( $single_group_report, $groups_by_id, 9, 'Q3 Awareness Exercise' );
check( 'campaign_summary_table: single-group scope uses the selection label, not the map lookup', 'Q3 Awareness Exercise' === $single['rows'][0][3] );

$empty_summary = $service->campaign_summary_table( [ 'stats' => array_fill_keys( array_keys( $group_report['stats'] ), 0 ), 'campaign_runs' => [] ], [], null, null );
check( 'campaign_summary_table: empty selection still produces a zeroed Total row', 1 === count( $empty_summary['rows'] ) && 'Total' === $empty_summary['rows'][0][0] && '0' === $empty_summary['rows'][0][6] );

// ---------------------------------------------------------------------------
// responder_details_table() — addendum PRD §7.8 (user request after v1 live)
// ---------------------------------------------------------------------------

$group_report_with_responders = array_merge( $group_report, [
	'responder_details' => [
		[ 'email' => 'budi@corp.example', 'name' => 'Budi Santoso', 'department' => 'Finance', 'status' => 'Clicked Link', 'opened_at' => '2026-09-15T02:05:00+00:00', 'clicked_at' => '2026-09-15T02:06:00+00:00', 'submitted_at' => null, 'reported_at' => null, 'campaign_run_id' => 201, 'campaign_name' => 'HR Policy Update', 'campaign_group_id' => 9 ],
		[ 'email' => 'formula@corp.example', 'name' => '=cmd|\' /c calc\'!A1', 'department' => 'IT', 'status' => 'Email Reported', 'opened_at' => '2026-09-16T01:00:00+00:00', 'clicked_at' => null, 'submitted_at' => null, 'reported_at' => '2026-09-16T01:05:00+00:00', 'campaign_run_id' => 202, 'campaign_name' => 'Invoice + Verification', 'campaign_group_id' => 0 ],
		[ 'email' => 'ani@corp.example', 'name' => 'Ani Wijaya', 'department' => 'Finance', 'status' => 'Email Opened', 'opened_at' => '2026-09-15T02:00:00+00:00', 'clicked_at' => null, 'submitted_at' => null, 'reported_at' => null, 'campaign_run_id' => 201, 'campaign_name' => 'HR Policy Update', 'campaign_group_id' => 9 ],
	],
] );

$responders_table = $service->responder_details_table( $group_report_with_responders, $groups_by_id, null, null );
check( 'responder_details_table: headers include Group and Campaign', [ 'Group', 'Campaign', 'Name', 'Email', 'Department', 'Status', 'Opened At', 'Clicked At', 'Submitted At', 'Reported At' ] === $responders_table['headers'] );
check( 'responder_details_table: one row per responder (already-filtered input)', 3 === count( $responders_table['rows'] ) );
check( 'responder_details_table: group name resolved via groups_by_id map', 'Q3 Awareness Exercise' === $responders_table['rows'][0][0] );
check( 'responder_details_table: campaign_group_id 0 resolves to Ungrouped', 'Ungrouped' === $responders_table['rows'][2][0] );
check( 'responder_details_table: name formula injection neutralised', "'=cmd" === substr( $responders_table['rows'][2][2], 0, 5 ) );
check( 'responder_details_table: sorted by campaign then name (Ani before Budi under HR Policy Update)', 'Ani Wijaya' === $responders_table['rows'][0][2] && 'Budi Santoso' === $responders_table['rows'][1][2] );

$single_group_responders = $service->responder_details_table( $group_report_with_responders, $groups_by_id, 9, 'Q3 Awareness Exercise' );
check( 'responder_details_table: single-group scope labels every row with the selection name', 'Q3 Awareness Exercise' === $single_group_responders['rows'][0][0] );

$empty_responders = $service->responder_details_table( [ 'responder_details' => [] ], [], null, null );
check( 'responder_details_table: empty input still produces headers with zero rows', [] === $empty_responders['rows'] );

// ---------------------------------------------------------------------------
// to_csv_sections() / to_xlsx_sections() — multi-table file (addendum §7.8)
// ---------------------------------------------------------------------------

$sections = [
	[ 'title' => 'Campaign Summary', 'table' => $summary ],
	[ 'title' => 'Responders', 'table' => $responders_table ],
];

$sections_csv = $service->to_csv_sections( $sections );
check( 'to_csv_sections: starts with UTF-8 BOM', str_starts_with( $sections_csv, "\xEF\xBB\xBF" ) );
check( 'to_csv_sections: both section titles present', str_contains( $sections_csv, 'Campaign Summary' ) && str_contains( $sections_csv, 'Responders' ) );
check( 'to_csv_sections: both header rows present', str_contains( $sections_csv, 'Campaign Name' ) && str_contains( $sections_csv, 'Group,Campaign,Name,Email' ) );
file_put_contents( "{$output}/campaign-summary-with-responders-sample.csv", $sections_csv );

$sections_xlsx = $service->to_xlsx_sections( $sections );
check( 'to_xlsx_sections: returns a binary string, not a WP_Error', ! is_wp_error( $sections_xlsx ) && is_string( $sections_xlsx ) && str_starts_with( $sections_xlsx, 'PK' ) );
if ( is_string( $sections_xlsx ) ) {
	file_put_contents( "{$output}/campaign-summary-with-responders-sample.xlsx", $sections_xlsx );

	$tmp = tempnam( sys_get_temp_dir(), 'pukat-export-smoke-sections-' );
	file_put_contents( $tmp, $sections_xlsx );
	$reader = new XlsxReader();
	$reader->open( $tmp );
	$sheet_names = [];
	$sheet_row_counts = [];
	foreach ( $reader->getSheetIterator() as $sheet ) {
		$sheet_names[] = $sheet->getName();
		$count = 0;
		foreach ( $sheet->getRowIterator() as $row ) { $count++; }
		$sheet_row_counts[] = $count;
	}
	$reader->close();
	unlink( $tmp );

	check( 'to_xlsx_sections: two sheets, named after each section', [ 'Campaign Summary', 'Responders' ] === $sheet_names );
	check( 'to_xlsx_sections: each sheet has its own header + rows (no bleed-over)', [ 5, 4 ] === $sheet_row_counts );
}

// ---------------------------------------------------------------------------
// to_csv() / to_xlsx()
// ---------------------------------------------------------------------------

$csv = $service->to_csv( $table );
check( 'to_csv: starts with UTF-8 BOM', str_starts_with( $csv, "\xEF\xBB\xBF" ) );
check( 'to_csv: header + all rows present', substr_count( $csv, "\n" ) >= 3 );
check( 'to_csv: formula-injection value stays literal (apostrophe-prefixed)', str_contains( $csv, "'=cmd" ) );
file_put_contents( "{$output}/target-details-sample.csv", $csv );

$xlsx = $service->to_xlsx( $table );
check( 'to_xlsx: returns a binary string, not a WP_Error', ! is_wp_error( $xlsx ) && is_string( $xlsx ) && str_starts_with( $xlsx, 'PK' ) );
if ( is_string( $xlsx ) ) {
	file_put_contents( "{$output}/target-details-sample.xlsx", $xlsx );
	$xlsx_rows = read_xlsx_rows( $xlsx );
	check( 'to_xlsx: readable back with header + 2 data rows', 3 === count( $xlsx_rows ) );
	check( 'to_xlsx: formula-injection cell round-trips as literal text (apostrophe-prefixed)', is_string( $xlsx_rows[2][0] ?? null ) && str_starts_with( (string) $xlsx_rows[2][0], "'=cmd" ) );
}

$empty_xlsx = $service->to_xlsx( $empty_table );
check( 'to_xlsx: header-only file for an empty scope is still valid', ! is_wp_error( $empty_xlsx ) && 1 === count( read_xlsx_rows( (string) $empty_xlsx ) ) );

// ---------------------------------------------------------------------------
// Live REST checks — same pattern as smoke-campaign-pdf.php
// ---------------------------------------------------------------------------

do_action( 'rest_api_init' );
global $wpdb;

$run_id = (int) $wpdb->get_var( "SELECT id FROM {$wpdb->prefix}pukat_campaign_runs ORDER BY id ASC LIMIT 1" );
if ( $run_id ) {
	$route = "/pukat/v1/campaign-runs/{$run_id}/report/export-data";

	wp_set_current_user( 0 );
	$response = rest_do_request( new WP_REST_Request( 'GET', $route ) );
	check( 'run export-data rejects anonymous access', in_array( $response->get_status(), [ 401, 403 ], true ) );

	wp_set_current_user( 1 );
	$response = rest_do_request( new WP_REST_Request( 'GET', '/pukat/v1/campaign-runs/2147483647/report/export-data' ) );
	check( 'run export-data: unknown campaign is 404', 404 === $response->get_status() );

	$bad_format_request = new WP_REST_Request( 'GET', $route );
	$bad_format_request->set_param( 'format', 'pdf' );
	$response = rest_do_request( $bad_format_request );
	check( 'run export-data: invalid format is 400', 400 === $response->get_status() );

	$response = rest_do_request( new WP_REST_Request( 'GET', $route ) );
	$headers  = $response->get_headers();
	check( 'run export-data: default format is CSV', 200 === $response->get_status() && str_starts_with( (string) ( $headers['Content-Type'] ?? '' ), 'text/csv' ) );
	if ( is_string( $response->get_data() ) ) {
		file_put_contents( "{$output}/target-details-live.csv", $response->get_data() );
	}

	$xlsx_request = new WP_REST_Request( 'GET', $route );
	$xlsx_request->set_param( 'format', 'xlsx' );
	$response = rest_do_request( $xlsx_request );
	$headers  = $response->get_headers();
	check(
		'run export-data: xlsx format returns spreadsheet content-type',
		200 === $response->get_status() && str_contains( (string) ( $headers['Content-Type'] ?? '' ), 'spreadsheetml' )
	);
	if ( is_string( $response->get_data() ) ) {
		file_put_contents( "{$output}/target-details-live.xlsx", $response->get_data() );
		check( 'run export-data: live xlsx is readable', [] !== read_xlsx_rows( $response->get_data() ) );
	}
} else {
	echo "SKIP — no existing Campaign Run for REST success smoke check\n";
}

$group_id = (int) $wpdb->get_var( "SELECT id FROM {$wpdb->prefix}pukat_campaign_groups ORDER BY id ASC LIMIT 1" );
if ( $group_id ) {
	$route = "/pukat/v1/campaign-groups/{$group_id}/report/export-data";

	wp_set_current_user( 0 );
	$response = rest_do_request( new WP_REST_Request( 'GET', $route ) );
	check( 'group export-data rejects anonymous access', in_array( $response->get_status(), [ 401, 403 ], true ) );

	wp_set_current_user( 1 );
	$response = rest_do_request( new WP_REST_Request( 'GET', $route ) );
	check( 'group export-data: existing group returns CSV', 200 === $response->get_status() && is_string( $response->get_data() ) && str_starts_with( $response->get_data(), "\xEF\xBB\xBF" ) );
	check( 'group export-data: CSV contains both Campaign Summary and Responders sections', is_string( $response->get_data() ) && str_contains( $response->get_data(), 'Campaign Summary' ) && str_contains( $response->get_data(), 'Responders' ) );
	if ( is_string( $response->get_data() ) ) {
		file_put_contents( "{$output}/campaign-summary-live.csv", $response->get_data() );
	}

	$xlsx_request = new WP_REST_Request( 'GET', $route );
	$xlsx_request->set_param( 'format', 'xlsx' );
	$response = rest_do_request( $xlsx_request );
	check( 'group export-data: xlsx format returns spreadsheet content-type', 200 === $response->get_status() && str_contains( (string) ( $response->get_headers()['Content-Type'] ?? '' ), 'spreadsheetml' ) );
	if ( is_string( $response->get_data() ) ) {
		file_put_contents( "{$output}/campaign-summary-live.xlsx", $response->get_data() );
		$tmp = tempnam( sys_get_temp_dir(), 'pukat-export-smoke-live-' );
		file_put_contents( $tmp, $response->get_data() );
		$reader = new XlsxReader();
		$reader->open( $tmp );
		$live_sheet_names = [];
		foreach ( $reader->getSheetIterator() as $sheet ) { $live_sheet_names[] = $sheet->getName(); }
		$reader->close();
		unlink( $tmp );
		check( 'group export-data: live xlsx has Campaign Summary + Responders sheets', [ 'Campaign Summary', 'Responders' ] === $live_sheet_names );
	}

	$response = rest_do_request( new WP_REST_Request( 'GET', '/pukat/v1/campaign-groups/active/report/export-data' ) );
	check( 'active-groups export-data returns CSV', 200 === $response->get_status() && is_string( $response->get_data() ) );
	check( 'active-groups export-data: CSV contains both sections', is_string( $response->get_data() ) && str_contains( $response->get_data(), 'Campaign Summary' ) && str_contains( $response->get_data(), 'Responders' ) );
	if ( is_string( $response->get_data() ) ) {
		file_put_contents( "{$output}/campaign-summary-active-live.csv", $response->get_data() );
	}
} else {
	echo "SKIP — no existing Campaign Group for REST success smoke check\n";
}

echo "Artifacts: {$output}\n";
exit( $failures ? 1 : 0 );
