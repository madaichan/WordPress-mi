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
		'name' => [ 1 => 'Ani Wijaya', 2 => 'Budi Santoso', 3 => 'Siti Aminah' ][$i] ?? "Target Contoh {$i}",
		'email' => 2 === $i ? 'budi.santoso@gmail.com' : "target{$i}@corp.example",
		'department' => $i % 2 ? 'IT' : 'Finance',
		'status' => 1 === $i ? 'Clicked Link' : ( 2 === $i ? 'Submitted Data' : ( $i <= 4 ? 'Email Reported' : 'Email Opened' ) ),
		'clicked_at' => $i <= 3 ? '2026-09-15T09:10:00Z' : null,
		'submitted_at' => 2 === $i ? '2026-09-15T09:11:00Z' : null,
		'reported_at' => in_array( $i, [ 3, 4 ], true ) ? '2026-09-15T09:12:00Z' : null,
	];
}
$context = [
	'run' => [ 'id' => 42, 'name' => 'Simulasi Phishing - Update Kebijakan HR', 'launched_at' => '2026-09-15 09:00:00', 'source_playbook' => [ 'difficulty' => 3, 'scenario' => 'Malware' ] ],
	'stats' => [ 'total' => 12, 'email_sent' => 12, 'email_opened' => 8, 'clicked' => 3, 'submitted_data' => 1, 'email_reported' => 2, 'open_rate' => 66.7, 'click_rate' => 25, 'submit_rate' => 8.3, 'report_rate' => 16.7 ],
	'department_breakdown' => [ [ 'department' => 'IT' ], [ 'department' => 'Finance' ] ],
	'target_details' => $targets, 'synced' => true, 'generated_at' => '2026-09-16 09:00:00',
];
$service = new CampaignReportPdfService();
wp_set_current_user( 1 );
$sample_org = static fn() => 'PT Contoh Organisasi';
add_filter( 'pre_option_pukat_org_name', $sample_org );
$cases = [ 'sample' => $context ];
$cases['unsynced'] = array_replace( $context, [ 'synced' => false, 'stats' => [], 'target_details' => [] ] );
$cases['clean'] = $context;
$cases['clean']['stats'] = array_replace( $context['stats'], [ 'clicked' => 0, 'submitted_data' => 0, 'email_reported' => 8, 'click_rate' => 0, 'submit_rate' => 0, 'report_rate' => 66.7 ] );
foreach ( $cases['clean']['target_details'] as $i => &$target ) {
	$target['status'] = $i < 8 ? 'Email Reported' : 'Email Sent';
	$target['clicked_at'] = $target['submitted_at'] = null;
	$target['reported_at'] = $i < 8 ? '2026-09-15T09:12:00Z' : null;
}
unset( $target );
$cases['long'] = $context;
$cases['long']['run']['name'] = str_repeat( 'Kampanye lintas departemen dan evaluasi keamanan ', 6 );
$cases['long']['target_details'] = [];
for ( $i = 1; $i <= 80; $i++ ) {
	$cases['long']['target_details'][] = array_replace( $targets[0], [ 'name' => "Target panjang {$i} " . str_repeat( 'Contoh ', 4 ), 'email' => "target.{$i}." . str_repeat( 'alamatpanjang', 3 ) . '@corp.example' ] );
}
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
    @media screen { .report-page { display:flex; flex-direction:column; } }
    @media print { .preview-bar, .preview-header, .preview-footer { display:none; } }
</style>';
$preview = str_replace( '</head>', $preview_css . '</head>', $document['html'] );
$preview = str_replace( '<body>', '<body><div class="preview-bar"><span><b>Preview desain Pukat</b> · Data contoh</span><button type="button" onclick="window.print()">Cetak / Simpan PDF</button></div>', $preview );
$preview = preg_replace( '/(<article[^>]*>)/', '$1<div class="preview-header">' . str_replace( 'margin:0 17mm', 'margin:0', $document['header'] ) . '</div>', $preview );
$page_number = 0;
$preview = preg_replace_callback( '/<\/article>/', static function () use ( &$page_number, $document ): string {
	$page_number++;
	$footer = str_replace( [ 'margin:0 17mm', '<span class="pageNumber"></span>', '<span class="totalPages"></span>' ], [ 'margin:0', (string) $page_number, '2' ], $document['footer'] );
	return '<div class="preview-footer">' . $footer . '</div></article>';
}, $preview );
file_put_contents( "{$output}/sample-preview.html", $preview );
$unsafe = $context;
$unsafe['run']['name'] = '<script>document.body.innerHTML="bad"</script>';
$unsafe['target_details'][0]['email'] = '<img src="http://example.com/leak">';
$safe_document = $service->campaign_run_document( $unsafe );
pdf_check( 'dynamic names and emails are escaped', ! str_contains( $safe_document['html'], '<script>' ) && str_contains( $safe_document['html'], '&lt;script&gt;' ) && str_contains( $safe_document['html'], '&lt;img' ) );
pdf_check( 'donut handles reporters who did not click', str_contains( $service->campaign_run_document( $context )['html'], 'Klik/data (2)' ) );
pdf_check( 'unsynced metrics are unavailable, not zero results', str_contains( $service->campaign_run_document( $cases['unsynced'] )['html'], 'Data belum tersedia' ) );

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
remove_filter( 'pre_option_pukat_org_name', $sample_org );

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
// Group export still depends on Dompdf; preserve and check its renderer.
$group = $service->render( 'Group regression check', [ 'stats' => $context['stats'], 'campaign_runs' => [], 'generated_at' => $context['generated_at'] ] );
pdf_check( 'group PDF renderer still works', str_starts_with( $group, '%PDF-' ) );
echo "Artifacts: {$output}\n";
exit( $failures ? 1 : 0 );
