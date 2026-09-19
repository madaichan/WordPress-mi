<?php
/**
 * Read-only PDF/REST smoke checks against a running WordPress + renderer.
 * Usage: php wp-content/plugins/Pukat/tools/smoke-campaign-pdf.php [output-directory]
 * Review artifacts contain synthetic data, except live-rest.pdf (a local campaign).
 */
declare(strict_types=1);
require dirname( __DIR__, 4 ) . '/wp-load.php';

use Pukat\Services\CampaignReportPdfService;
use Pukat\Services\ChromiumPdfService;

$output = $argv[1] ?? sys_get_temp_dir() . '/pukat-pdf-review';
if ( ! is_dir( $output ) ) {
	mkdir( $output, 0700, true );
}
$failures = [];
function pdf_check( string $label, bool $condition ): void {
	global $failures;
	echo ( $condition ? 'PASS' : 'FAIL' ) . " — {$label}\n";
	if ( ! $condition ) { $failures[] = $label; }
}
$targets = [];
for ( $i = 1; $i <= 12; $i++ ) {
	$targets[] = [
		'name' => [ 1 => 'Ani Wijaya', 2 => 'Budi Santoso', 3 => 'Siti Aminah' ][$i] ?? "Sample Recipient {$i}",
		'email' => 2 === $i ? 'budi.santoso@gmail.com' : "target{$i}@corp.example",
		'department' => $i % 2 ? 'IT' : 'Finance',
		'status' => 1 === $i ? 'Clicked Link' : ( 2 === $i ? 'Submitted Data' : ( $i <= 4 ? 'Email Reported' : 'Email Opened' ) ),
		'clicked_at' => $i <= 3 ? '2026-09-15T09:10:00Z' : null,
		'submitted_at' => 2 === $i ? '2026-09-15T09:11:00Z' : null,
		'reported_at' => in_array( $i, [ 3, 4 ], true ) ? '2026-09-15T09:12:00Z' : null,
	];
}
$context = [
	'run' => [ 'id' => 42, 'name' => 'Phishing Simulation - HR Policy Update', 'launched_at' => '2026-09-15 09:00:00', 'source_playbook' => [ 'difficulty' => 3, 'scenario' => 'Malware' ] ],
	'stats' => [ 'total' => 12, 'email_sent' => 12, 'email_opened' => 8, 'clicked' => 3, 'submitted_data' => 1, 'email_reported' => 2, 'open_rate' => 66.7, 'click_rate' => 25, 'submit_rate' => 8.3, 'report_rate' => 16.7 ],
	'department_breakdown' => [ [ 'department' => 'IT' ], [ 'department' => 'Finance' ] ],
	'target_details' => $targets, 'synced' => true, 'generated_at' => '2026-09-16 09:00:00',
];
$service = new CampaignReportPdfService();
wp_set_current_user( 1 );
$cases = [ 'sample' => $context ];
$cases['unsynced'] = array_replace( $context, [ 'synced' => false, 'stats' => [], 'target_details' => [] ] );
$cases['clean'] = $context;
$cases['clean']['stats'] = array_replace( $context['stats'], [ 'clicked' => 0, 'submitted_data' => 0, 'email_reported' => 8, 'click_rate' => 0, 'submit_rate' => 0, 'report_rate' => 66.7 ] );
foreach ( $cases['clean']['target_details'] as $i => &$target ) {
	$target['status'] = $i < 8 ? 'Email Reported' : 'Email Sent';
	$target['clicked_at'] = $target['submitted_at'] = null;
	$target['opened_at'] = $i < 8 ? '2026-09-15T09:09:00Z' : null;
	$target['reported_at'] = $i < 8 ? '2026-09-15T09:12:00Z' : null;
}
unset( $target );
$cases['long'] = $context;
$cases['long']['run']['name'] = str_repeat( 'Campaign across departments and security assessment ', 6 );
$cases['long']['target_details'] = [];
for ( $i = 1; $i <= 80; $i++ ) {
	$cases['long']['target_details'][] = array_replace( $targets[0], [ 'name' => "Long Recipient {$i} " . str_repeat( 'Example ', 4 ), 'email' => "target.{$i}." . str_repeat( 'longaddress', 3 ) . '@corp.example', 'opened_at' => '2026-09-15T09:09:00Z' ] );
}
$cases['no-response'] = $context;
$cases['no-response']['stats'] = array_replace( $context['stats'], [ 'email_opened' => 0, 'clicked' => 0, 'submitted_data' => 0, 'email_reported' => 0, 'open_rate' => 0, 'click_rate' => 0, 'submit_rate' => 0, 'report_rate' => 0 ] );
foreach ( $cases['no-response']['target_details'] as &$target ) {
 $target['status'] = 'Email Sent';
 $target['opened_at'] = $target['clicked_at'] = $target['submitted_at'] = $target['reported_at'] = null;
}
unset( $target );
$cases['incomplete'] = $context;
$cases['incomplete']['target_details'] = array_slice( $targets, 0, 2 );
$cases['zero-targets'] = array_replace( $context, [ 'stats' => [ 'total' => 0 ], 'target_details' => [] ] );
$cases['prototype-scale'] = $context;
$cases['prototype-scale']['target_details'] = [];
$department_names = [ 'IT & Security', 'Finance & Accounting', 'Human Capital (HR)', 'Procurement & Supply Chain', 'Sales & Marketing', 'Operations & Logistics', 'Legal & Compliance', 'Research & Development', 'Internal Audit', 'Corporate Secretary' ];
for ( $i = 1; $i <= 200; $i++ ) {
	$cases['prototype-scale']['target_details'][] = [
		'name' => sprintf( 'Example User %03d', $i ), 'email' => sprintf( 'user%03d@corp.example', $i ),
		'department' => $department_names[ ( $i - 1 ) % 10 ], 'position' => [ 'Staff', 'Supervisor', 'Manager' ][ ( $i - 1 ) % 3 ],
		'status' => $i <= 37 ? 'Clicked Link' : ( $i <= 98 ? 'Email Reported' : ( $i <= 165 ? 'Email Opened' : 'Email Sent' ) ),
		'opened_at' => $i <= 165 ? '2026-09-15T09:09:00Z' : null,
		'clicked_at' => $i <= 37 ? '2026-09-15T09:10:00Z' : null,
		'reported_at' => $i > 37 && $i <= 98 ? '2026-09-15T09:12:00Z' : null,
	];
}
$cases['prototype-scale']['stats'] = [ 'total' => 200, 'email_sent' => 200, 'email_opened' => 165, 'clicked' => 37, 'submitted_data' => 0, 'email_reported' => 61, 'open_rate' => 82.5, 'click_rate' => 18.5, 'submit_rate' => 0, 'report_rate' => 30.5 ];
$cases['long']['stats'] = array_replace( $context['stats'], [ 'total' => 80, 'email_sent' => 80, 'email_opened' => 80, 'clicked' => 80, 'submitted_data' => 0, 'email_reported' => 0, 'open_rate' => 100, 'click_rate' => 100, 'submit_rate' => 0, 'report_rate' => 0 ] );
foreach ( $cases as $name => $fixture ) {
	$document = $service->campaign_run_document( $fixture );
	file_put_contents( "{$output}/{$name}.json", wp_json_encode( $document ) );
	file_put_contents( "{$output}/{$name}.html", $document['html'] );
	$pdf = $service->render_campaign_run( $fixture );
	pdf_check( "{$name}: complete PDF", is_string( $pdf ) && str_starts_with( $pdf, '%PDF-' ) && str_contains( substr( $pdf, -1024 ), '%%EOF' ) );
	if ( is_string( $pdf ) ) { file_put_contents( "{$output}/{$name}.pdf", $pdf ); }
}
$document = $service->campaign_run_document( $context );
$preview_css = '<style>
    .preview-bar { max-width:210mm; margin:0 auto 18px; display:flex; justify-content:space-between; align-items:center; gap:16px; font-size:12px; }
    .preview-bar button { background:#173f54; color:white; border:0; padding:10px 18px; border-radius:6px; cursor:pointer; }
    .preview-header { margin-bottom:18px; }
    .preview-footer { margin-top:auto; padding-top:24px; }
    @media screen { .page { display:flex; flex-direction:column; } }
    @media print { .preview-bar, .preview-header, .preview-footer { display:none; } }
</style>';
$preview = str_replace( '</head>', $preview_css . '</head>', $document['html'] );
$preview = str_replace( '<body>', '<body><div class="preview-bar"><span><b>Pukat Report Preview</b> · Sample data</span><button type="button" onclick="window.print()">Print / Save PDF</button></div>', $preview );
$preview = preg_replace( '/(<article[^>]*>)/', '$1<div class="preview-header">' . str_replace( 'margin:0 18mm', 'margin:0', $document['header'] ) . '</div>', $preview );
$page_number = 0;
$preview_pages = substr_count( $document['html'], '<article class="page"' );
$preview = preg_replace_callback( '/<\/article>/', static function () use ( &$page_number, $document, $preview_pages ): string {
	$page_number++;
	$footer = str_replace( [ 'margin:0 18mm', '<span class="pageNumber"></span>', '<span class="totalPages"></span>' ], [ 'margin:0', (string) $page_number, (string) $preview_pages ], $document['footer'] );
	return '<div class="preview-footer">' . $footer . '</div></article>';
}, $preview );
file_put_contents( "{$output}/sample-preview.html", $preview );
$unsafe = $context;
$unsafe['run']['name'] = '<script>document.body.innerHTML="bad"</script>';
$unsafe['target_details'][0]['email'] = '<img src="http://example.com/leak">';
$safe_document = $service->campaign_run_document( $unsafe );
pdf_check( 'dynamic names and emails are escaped', ! str_contains( $safe_document['html'], '<script>' ) && str_contains( $safe_document['html'], '&lt;script&gt;' ) && str_contains( $safe_document['html'], '&lt;img' ) );
$data = $service->campaign_run_report_data( $context );
pdf_check( 'campaign coverage and summary use the actual two targeted departments', 2 === $data['target_department_count'] && '12 recipients · 2 departments' === $data['facts']['Campaign Coverage'] && str_contains( $data['summary'][0], '2 departments' ) && str_contains( $data['summary'][0], '12 recipients' ) && str_contains( $data['summary'][0], 'Malware scenario' ) );
$single_department = $context;
foreach ( $single_department['target_details'] as &$target ) { $target['department'] = 'IT'; }
unset( $target );
$single_department_data = $service->campaign_run_report_data( $single_department );
pdf_check( 'a single targeted department uses singular wording', 1 === $single_department_data['target_department_count'] && str_contains( $single_department_data['summary'][0], '1 department</strong>' ) );
$no_response_data = $service->campaign_run_report_data( $cases['no-response'] );
pdf_check( 'targeted department count includes recipients with no response activity', 2 === $no_response_data['target_department_count'] && 0 === $no_response_data['response_count'] );
$mixed_department_names = $context;
$mixed_department_names['target_details'][0]['department'] = ' it ';
pdf_check( 'department count ignores surrounding whitespace and letter case', 2 === $service->campaign_run_report_data( $mixed_department_names )['target_department_count'] );
$missing_department = $context;
$missing_department['target_details'][0]['department'] = '';
$missing_department_data = $service->campaign_run_report_data( $missing_department );
pdf_check( 'missing department metadata does not count Unassigned as a department', null === $missing_department_data['target_department_count'] && str_contains( $missing_department_data['summary'][0], 'Departmental coverage cannot yet be established' ) && str_contains( $missing_department_data['facts']['Campaign Coverage'], 'incomplete' ) );
pdf_check( 'click and reporting overlap: exposure remains 3, exclusive donut is 8/2/2', 3 === $data['exposed'] && [ 8, 2, 2 ] === array_column( $data['segments'], 'count' ) );
pdf_check( 'departments count unique exposed users', 3 === array_sum( array_column( $data['departments'], 'exposed' ) ) );
pdf_check( 'rankings never double-count a user who clicks and reports', 4 === array_sum( array_column( $data['department_ranking'], 'count' ) ) );
pdf_check( 'all responsive users appear exactly once in appendix', 12 === $data['response_count'] && 12 === count( array_unique( array_column( array_merge( ...$data['response_chunks'] ), 'email' ) ) ) );
$position_fixture = $context;
$position_fixture['target_details'][0]['position'] = '';
$position_fixture['run']['snapshot']['target']['targets'] = [ [ 'email' => $targets[0]['email'], 'position' => 'Staff' ], [ 'email' => $targets[2]['email'], 'position' => 'Supervisor' ] ];
$position_data = $service->campaign_run_report_data( $position_fixture );
pdf_check( 'position ranking uses real snapshot metadata', in_array( 'Staff', array_column( $position_data['position_ranking'], 'name' ), true ) && in_array( 'Supervisor', array_column( $position_data['position_ranking'], 'name' ), true ) );
pdf_check( 'missing positions do not invent staff/supervisor/manager counts', null === $data['position_ranking'][0]['count'] );
$timezone_filter = static fn() => 'Asia/Jakarta';
add_filter( 'pre_option_timezone_string', $timezone_filter );
$localized = $service->campaign_run_report_data( $context );
remove_filter( 'pre_option_timezone_string', $timezone_filter );
$reported_row = array_values( array_filter( $localized['response_chunks'][0], static fn( array $row ): bool => 'Siti Aminah' === $row['name'] ) )[0];
pdf_check( 'reporting stage timestamp is converted to the site timezone', 'Reported' === $reported_row['response'] && '16:12' === $reported_row['time'] && '15 Sep 2026' === $reported_row['date'] );
$long_data = $service->campaign_run_report_data( $cases['long'] );
pdf_check( '80 responsive users are chunked 25/25/25/5 without truncation', [ 25, 25, 25, 5 ] === array_map( 'count', $long_data['response_chunks'] ) );
$incomplete = $service->campaign_run_report_data( $cases['incomplete'] );
pdf_check( 'partial recipient records do not claim a full department count', null === $incomplete['target_department_count'] && str_contains( $incomplete['summary'][0], 'Departmental coverage cannot yet be established' ) );
pdf_check( 'unsynchronised records do not fabricate a targeted department count', null === $service->campaign_run_report_data( $cases['unsynced'] )['target_department_count'] );
pdf_check( 'partial details do not fabricate distributions or exposure unions', ! $incomplete['details_complete'] && null === $incomplete['exposed'] && [] === $incomplete['segments'] && [] === $incomplete['departments'] );
$unsafe['run']['snapshot']['sending_profile']['password'] = 'NEVER_PRINT_SMTP_PASSWORD';
pdf_check( 'SMTP secrets are not included in document', ! str_contains( wp_json_encode( $service->campaign_run_document( $unsafe ) ), 'NEVER_PRINT_SMTP_PASSWORD' ) );
pdf_check( 'unsynced metrics are unavailable, not zero results', str_contains( $service->campaign_run_document( $cases['unsynced'] )['html'], 'Data unavailable' ) );

$http_failure = static fn() => new WP_Error( 'http_request_failed', 'internal details' );
add_filter( 'pre_http_request', $http_failure );
$result = $service->render_campaign_run( $context );
remove_filter( 'pre_http_request', $http_failure );
pdf_check( 'renderer failure is a controlled 503 error', is_wp_error( $result ) && 503 === $result->get_error_data()['status'] );
$corrupt = static fn() => [ 'response' => [ 'code' => 200 ], 'body' => '%PDF-truncated' ];
add_filter( 'pre_http_request', $corrupt );
$result = ( new ChromiumPdfService() )->render( $service->campaign_run_document( $context ) );
remove_filter( 'pre_http_request', $corrupt );
pdf_check( 'truncated renderer response rejected', is_wp_error( $result ) );

do_action( 'rest_api_init' );
global $wpdb;
$run_id = (int) $wpdb->get_var( "SELECT id FROM {$wpdb->prefix}pukat_campaign_runs ORDER BY id ASC LIMIT 1" );
if ( $run_id ) {
	$route = "/pukat/v1/campaign-runs/{$run_id}/report/export";
	wp_set_current_user( 0 );
	$response = rest_do_request( new WP_REST_Request( 'GET', $route ) );
	pdf_check( 'export rejects anonymous access', in_array( $response->get_status(), [ 401, 403 ], true ) );
	wp_set_current_user( 1 );
	$response = rest_do_request( new WP_REST_Request( 'GET', '/pukat/v1/campaign-runs/2147483647/report/export' ) );
	pdf_check( 'unknown campaign is 404', 404 === $response->get_status() );
	$response = rest_do_request( new WP_REST_Request( 'GET', $route ) );
	pdf_check( 'existing campaign export returns binary PDF', 200 === $response->get_status() && is_string( $response->get_data() ) && str_starts_with( $response->get_data(), '%PDF-' ) );
	if ( is_string( $response->get_data() ) ) { file_put_contents( "{$output}/live-rest.pdf", $response->get_data() ); }
	add_filter( 'pre_http_request', $http_failure );
	$response = rest_do_request( new WP_REST_Request( 'GET', $route ) );
	remove_filter( 'pre_http_request', $http_failure );
	pdf_check( 'REST renderer failure returns JSON error, not a broken PDF', 503 === $response->get_status() && 'pdf_renderer_unavailable' === ( $response->get_data()['code'] ?? '' ) );
} else {
	echo "SKIP — no existing campaign for REST success smoke check\n";
}
// Campaign Group / multi-campaign report — Chromium, same pattern as the single-run report above.
$group_stats = [ 'total' => 0, 'email_sent' => 0, 'email_opened' => 0, 'clicked' => 0, 'submitted_data' => 0, 'email_reported' => 0 ];
$group_runs = [
	[ 'campaign_run_id' => 201, 'campaign_group_id' => 9, 'name' => 'HR Policy Update', 'status' => 'completed', 'stats' => [ 'total' => 300, 'email_sent' => 300, 'email_opened' => 210, 'clicked' => 54, 'submitted_data' => 12, 'email_reported' => 90 ], 'playbook_name' => 'Internal Policy Notice', 'launched_at' => '2026-09-15 01:00:00', 'schedule_at' => null, 'target_count' => 300, 'synced_at' => '2026-09-18 02:40:00' ],
	[ 'campaign_run_id' => 202, 'campaign_group_id' => 9, 'name' => 'Invoice Verification', 'status' => 'running', 'stats' => [ 'total' => 250, 'email_sent' => 240, 'email_opened' => 160, 'clicked' => 70, 'submitted_data' => 15, 'email_reported' => 45 ], 'playbook_name' => 'Supplier Invoice Request', 'launched_at' => '2026-09-16 02:00:00', 'schedule_at' => null, 'target_count' => 250, 'synced_at' => '2026-09-18 02:59:00' ],
	[ 'campaign_run_id' => 205, 'campaign_group_id' => 10, 'name' => 'Leadership Security Briefing', 'status' => 'scheduled', 'stats' => [], 'playbook_name' => 'Security Briefing Notice', 'launched_at' => null, 'schedule_at' => '2026-09-19 02:00:00', 'target_count' => 100, 'synced_at' => null ],
];
foreach ( $group_runs as $run ) {
	foreach ( $group_stats as $k => $v ) { $group_stats[ $k ] += $run['stats'][ $k ] ?? 0; }
}
$group_stats['open_rate']   = round( $group_stats['email_opened'] / $group_stats['total'] * 100, 1 );
$group_stats['click_rate']  = round( $group_stats['clicked'] / $group_stats['total'] * 100, 1 );
$group_stats['submit_rate'] = round( $group_stats['submitted_data'] / $group_stats['total'] * 100, 1 );
$group_stats['report_rate'] = round( $group_stats['email_reported'] / $group_stats['total'] * 100, 1 );
$group_report = [
	'stats' => $group_stats, 'campaign_runs' => $group_runs,
	'department_breakdown' => [
		[ 'department' => 'IT & Security', 'total' => 60, 'clicked' => 20, 'submitted' => 5, 'click_rate' => 33.3, 'risk_level' => 'Med' ],
		[ 'department' => 'Finance & Accounting', 'total' => 160, 'clicked' => 60, 'submitted' => 22, 'click_rate' => 37.5, 'risk_level' => 'Med' ],
	],
	'hourly_activity' => array_map( static fn( $h ) => in_array( $h, [ 8, 9, 10 ], true ) ? 30 : 0, range( 0, 23 ) ),
	'recent_events' => [ [ 'name' => 'Example Participant A', 'department' => 'Finance & Accounting', 'message' => 'Email Reported', 'time' => '2026-09-18T02:38:00Z' ] ],
	'generated_at' => '2026-09-18 03:00:00',
];
$group_context = [ 'report' => $group_report, 'campaign_group_id' => null, 'group_name' => null, 'groups_by_id' => [ 9 => 'Q3 Awareness Exercise', 10 => 'Executive Targeting Exercise' ] ];
$group_document = $service->campaign_group_document( $group_context );
file_put_contents( "{$output}/group-active.json", wp_json_encode( $group_document ) );
file_put_contents( "{$output}/group-active.html", $group_document['html'] );
$group_pdf = $service->render_campaign_group( $group_context );
pdf_check( 'group active-selection: complete PDF', is_string( $group_pdf ) && str_starts_with( $group_pdf, '%PDF-' ) && str_contains( substr( $group_pdf, -1024 ), '%%EOF' ) );
if ( is_string( $group_pdf ) ) { file_put_contents( "{$output}/group-active.pdf", $group_pdf ); }

$empty_group_report = [ 'stats' => array_fill_keys( array_keys( $group_stats ), 0 ), 'campaign_runs' => [], 'department_breakdown' => [], 'hourly_activity' => array_fill( 0, 24, 0 ), 'recent_events' => [], 'generated_at' => $group_report['generated_at'] ];
$empty_group_context = [ 'report' => $empty_group_report, 'campaign_group_id' => 9, 'group_name' => 'Q3 Awareness Exercise', 'groups_by_id' => [ 9 => 'Q3 Awareness Exercise' ] ];
$empty_group_pdf = $service->render_campaign_group( $empty_group_context );
pdf_check( 'group single-group with no synced results: complete PDF', is_string( $empty_group_pdf ) && str_starts_with( $empty_group_pdf, '%PDF-' ) );

$unsafe_group_context = $group_context;
$unsafe_group_context['report']['campaign_runs'][0]['name'] = '<script>document.body.innerHTML="bad"</script>';
$unsafe_group_document = $service->campaign_group_document( $unsafe_group_context );
pdf_check( 'group report: dynamic campaign names are escaped', ! str_contains( $unsafe_group_document['html'], '<script>' ) && str_contains( $unsafe_group_document['html'], '&lt;script&gt;' ) );

$group_data = $service->campaign_group_report_data( $group_context );
pdf_check( 'group report: consolidated rate uses summed counts, not an average of campaign rates', '22.5%' === $group_data['recorded_totals']['stages']['clicked']['rate'] );
pdf_check( 'group report: pending (unsynced) campaign is excluded from the recorded denominator', 550 === $group_data['total'] && 650 === $group_data['planned'] );
pdf_check( 'group report: per-run group label resolves via the authorised groups map', 'Executive Targeting Exercise' === $group_data['runs'][2]['group_name'] );

do_action( 'rest_api_init' );
global $wpdb;
$group_id = (int) $wpdb->get_var( "SELECT id FROM {$wpdb->prefix}pukat_campaign_groups ORDER BY id ASC LIMIT 1" );
if ( $group_id ) {
	wp_set_current_user( 0 );
	$response = rest_do_request( new WP_REST_Request( 'GET', "/pukat/v1/campaign-groups/{$group_id}/report/export" ) );
	pdf_check( 'group export rejects anonymous access', in_array( $response->get_status(), [ 401, 403 ], true ) );
	wp_set_current_user( 1 );
	$response = rest_do_request( new WP_REST_Request( 'GET', "/pukat/v1/campaign-groups/{$group_id}/report/export" ) );
	pdf_check( 'existing campaign group export returns binary PDF', 200 === $response->get_status() && is_string( $response->get_data() ) && str_starts_with( $response->get_data(), '%PDF-' ) );
	if ( is_string( $response->get_data() ) ) { file_put_contents( "{$output}/group-live-rest.pdf", $response->get_data() ); }
	$response = rest_do_request( new WP_REST_Request( 'GET', '/pukat/v1/campaign-groups/active/report/export' ) );
	pdf_check( 'active-groups export returns binary PDF', 200 === $response->get_status() && is_string( $response->get_data() ) && str_starts_with( $response->get_data(), '%PDF-' ) );
} else {
	echo "SKIP — no existing campaign group for REST success smoke check\n";
}

echo "Artifacts: {$output}\n";
exit( $failures ? 1 : 0 );
