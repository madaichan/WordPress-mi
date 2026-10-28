<?php
/**
 * Quiz Module end-to-end smoke test — Q7 of
 * docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md.
 *
 * Walks a real target through the whole chain against the live GoPhish phish
 * server: submit the simulation landing page → get redirected into education →
 * submit that → get redirected into the quiz → submit answers → confirm the
 * answer came back merged into the SIMULATION's results (api_campaignnew.md
 * §3.5.1) and that Pukat graded it.
 *
 * WRITE PATH. Everything is throwaway (entity ZZQuizE2E, recipients on
 * `.invalid`, campaigns scheduled by this script) and removed at the end.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-quiz-e2e.php
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

use Pukat\Repositories\QuizResultRepository;
use Pukat\Services\FlagPageSyncService;
use Pukat\Services\GoPhishService;
use Pukat\Services\PermissionRegistry;
use Pukat\Services\QuizPageSyncService;
use Pukat\Services\QuizScoringService;

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

/**
 * The phish server as seen from inside this container. Campaign URLs use
 * localhost (what a target would use), which does not resolve here, so the
 * host is rewritten for the actual HTTP calls.
 */
const PHISH_INTERNAL = 'http://host.docker.internal:8081';

function phish_url( string $url ): string {
	return preg_replace( '#^https?://[^/]+#', PHISH_INTERNAL, $url ) ?? $url;
}

/** POST a landing-page form as a target would, without following redirects. */
function submit_form( string $url, array $fields ): array {
	$response = wp_remote_post( phish_url( $url ), [
		'timeout'     => 15,
		'redirection' => 0,
		'body'        => $fields,
	] );

	if ( is_wp_error( $response ) ) {
		return [ 'status' => 0, 'location' => '', 'error' => $response->get_error_message() ];
	}

	return [
		'status'   => (int) wp_remote_retrieve_response_code( $response ),
		'location' => (string) wp_remote_retrieve_header( $response, 'location' ),
		'body'     => (string) wp_remote_retrieve_body( $response ),
	];
}

/** The rid in a redirect Location, if any. */
function rid_from( string $location ): string {
	$query = (string) wp_parse_url( $location, PHP_URL_QUERY );
	$args  = [];
	wp_parse_str( $query, $args );

	return (string) ( $args['rid'] ?? '' );
}

do_action( 'rest_api_init' );

$gophish = new GoPhishService();
if ( is_wp_error( $gophish->test_connection() ) ) {
	fwrite( STDERR, "GoPhish is not reachable — configure the connection first.\n" );
	exit( 1 );
}
if ( is_wp_error( wp_remote_get( PHISH_INTERNAL . '/', [ 'timeout' => 5 ] ) ) ) {
	fwrite( STDERR, 'The phish server is not reachable at ' . PHISH_INTERNAL . " — skipping the end-to-end test.\n" );
	exit( 1 );
}

$entity     = 'ZZQuizE2E';
$suffix     = (string) time();
$role_slug  = 'pukat_smoke_quize2e';
$launch_url = 'http://localhost:8081';
$slug       = sanitize_title( $entity );
$quiz_sync  = new QuizPageSyncService();
$edu_sync   = new FlagPageSyncService();

$sim_page_name  = 'zz-e2e-sim-page-' . $suffix;
$sim_tmpl_name  = 'zz-e2e-sim-tmpl-' . $suffix;
$sim_smtp_name  = 'zz-e2e-sim-smtp-' . $suffix;
$group_name     = 'zz-e2e-grp-' . $suffix;
$sim_name       = 'zz-e2e-sim-' . $suffix;
$target_email   = 'zz-e2e-' . $suffix . '@example.invalid';

// ---------------------------------------------------------------------------
// Setup: entity, question, published quiz page, published education page.
// ---------------------------------------------------------------------------
remove_role( $role_slug );
add_role( $role_slug, 'Smoke QuizE2E', [ 'read' => true ] );
$role = get_role( $role_slug );
foreach ( [ 'post_sim.view', 'post_sim.manage', 'quiz_pages.view', 'quiz_pages.edit', 'quiz_pages.publish', 'flag_pages.view', 'flag_pages.edit', 'flag_pages.publish', 'domains.view' ] as $key ) {
	$role->add_cap( PermissionRegistry::capability_for( $key ) );
}
$login   = $role_slug . '_' . $suffix;
$user_id = (int) wp_insert_user( [
	'user_login' => $login,
	'user_pass'  => wp_generate_password(),
	'user_email' => $login . '@example.test',
	'role'       => $role_slug,
] );
update_user_meta( $user_id, 'meta_entity', $entity );

$domains_table = $wpdb->prefix . 'pukat_dynamic_domains';
$wpdb->insert( $domains_table, [
	'domain'               => 'zz-e2e-' . $suffix . '.test',
	'base_landing_url'     => $launch_url,
	'type'                 => 'quiz',
	'environment'          => 'staging',
	'owner_entity'         => $entity,
	'authorization_status' => 'authorized',
	'status'               => 'active',
] );
$domain_id = (int) $wpdb->insert_id;

call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Tindakan paling aman?',
	'input_name' => 'answer_q1',
	'options'    => [
		[ 'label' => 'Klik', 'value' => 'click', 'correct' => false ],
		[ 'label' => 'Lapor', 'value' => 'report', 'correct' => true ],
	],
], $user_id );

$quiz_html = '<html><body><h1>Kuis</h1><form method="post">'
	. '<input type="hidden" name="rid" value="{{.RId}}">'
	. '<fieldset><input type="radio" name="answer_q1" value="click"><input type="radio" name="answer_q1" value="report"></fieldset>'
	. '<button type="submit">Kirim</button></form></body></html>';
call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $quiz_html, 'title' => 'E2E quiz', 'launch_url' => $launch_url ], $user_id );
[ , $body ]  = call( 'POST', '/pukat/v1/quiz-page/publish', [], $user_id );
$quiz_master = (int) ( $body['data']['gophish_master_id'] ?? 0 );
check( 'the quiz master is live', $quiz_master > 0, $failures );

$edu_html = '<html><body><h1>Edukasi</h1><form method="post">'
	. '<input type="hidden" name="rid" value="{{.RId}}">'
	. '<input type="hidden" name="education_understood" value="yes">'
	. '<button type="submit">Saya paham</button></form></body></html>';
call( 'PUT', '/pukat/v1/flag-page', [ 'html_body' => $edu_html, 'title' => 'E2E edu', 'launch_url' => $launch_url ], $user_id );
[ , $body ] = call( 'POST', '/pukat/v1/flag-page/publish', [], $user_id );
$edu_master = (int) ( $body['data']['gophish_master_id'] ?? 0 );
check( 'the education master is live and chained to the quiz', $edu_master > 0 && true === ( $body['data']['chain']['linked'] ?? false ), $failures );

// ---------------------------------------------------------------------------
// A throwaway simulation chained into education.
// ---------------------------------------------------------------------------
$gophish->create_landing_page( [
	'name'                => $sim_page_name,
	'html'                => '<html><body><form method="post"><input type="hidden" name="rid" value="{{.RId}}">'
		. '<input type="text" name="username" value="zz"><input type="password" name="password" value="zz">'
		. '<button type="submit">Login</button></form></body></html>',
	'capture_credentials' => true,
	'capture_passwords'   => false,
	'redirect_url'        => '',
] );
$gophish->create_email_template( [
	'name'        => $sim_tmpl_name,
	'subject'     => 'E2E test',
	'html'        => '<html><body><a href="{{.URL}}">buka</a></body></html>',
	'text'        => '{{.URL}}',
	'attachments' => [],
] );
$gophish->create_sending_profile( [
	'name'               => $sim_smtp_name,
	'interface_type'     => 'SMTP',
	'host'               => 'localhost:25',
	'from_address'       => 'noreply@example.com',
	'ignore_cert_errors' => true,
	'headers'            => [],
] );
$group    = $gophish->create_group( [
	'name'    => $group_name,
	'targets' => [ [ 'email' => $target_email, 'first_name' => 'ZZ', 'last_name' => 'E2E' ] ],
] );
$group_id = is_wp_error( $group ) ? 0 : (int) ( $group['id'] ?? 0 );

$sim    = $gophish->create_campaign( [
	'name'             => $sim_name,
	'campaign_type'    => 'simulation',
	'entity'           => $entity,
	'url'              => $launch_url,
	'template'         => [ 'name' => $sim_tmpl_name ],
	'page'             => [ 'name' => $sim_page_name ],
	'smtp'             => [ 'name' => $sim_smtp_name ],
	'groups'           => [ [ 'name' => $group_name ] ],
	'next_campaign_id' => $edu_master,
	'launch_date'      => gmdate( 'Y-m-d\TH:i:s+00:00' ),
] );
$sim_id = is_wp_error( $sim ) ? 0 : (int) ( $sim['id'] ?? 0 );
check( 'a throwaway simulation chained to education was created', $sim_id > 0, $failures );

$results = $gophish->get_campaign_results( $sim_id );
$sim_rid = (string) ( $results['results'][0]['id'] ?? '' );
check( 'the simulation has a recipient rid to act as', '' !== $sim_rid, $failures );

// ---------------------------------------------------------------------------
// Walk the chain as the target.
// ---------------------------------------------------------------------------
echo "\n-- walking the chain --\n";

$step = submit_form( $launch_url . '/?rid=' . $sim_rid, [ 'rid' => $sim_rid, 'username' => 'zz', 'password' => 'zz' ] );
check( 'submitting the simulation page redirects onward (302)', 302 === $step['status'], $failures );
$edu_rid = rid_from( $step['location'] );
check( 'the redirect carries a NEW rid for the education entry', '' !== $edu_rid && $edu_rid !== $sim_rid, $failures );

$step = submit_form( $step['location'], [ 'rid' => $edu_rid, 'education_understood' => 'yes' ] );
check( 'submitting the education page redirects onward (302)', 302 === $step['status'], $failures );
$quiz_rid = rid_from( $step['location'] );
check( 'the redirect carries a NEW rid for the quiz entry', '' !== $quiz_rid && $quiz_rid !== $edu_rid, $failures );

$step = submit_form( $step['location'], [ 'rid' => $quiz_rid, 'answer_q1' => 'report' ] );
check( 'submitting the quiz is accepted', in_array( $step['status'], [ 200, 302 ], true ), $failures );

// ---------------------------------------------------------------------------
// The answer must come back merged into the SIMULATION's results.
// ---------------------------------------------------------------------------
echo "\n-- grading --\n";

$results  = $gophish->get_campaign_results( $sim_id );
$messages = array_column( (array) ( $results['timeline'] ?? [] ), 'message' );
check( 'the simulation timeline now holds Submitted Data (Quiz)', in_array( 'Submitted Data (Quiz)', $messages, true ), $failures );

$quiz_events = array_values( array_filter(
	(array) $results['timeline'],
	static fn ( array $e ): bool => 'Submitted Data (Quiz)' === (string) ( $e['message'] ?? '' )
) );
check( 'the merged quiz event carries the ORIGINAL simulation rid', $sim_rid === (string) ( $quiz_events[0]['rid'] ?? '' ), $failures );

$run_id  = 95000 + ( (int) $suffix % 1000 );
$scoring = new QuizScoringService();
$outcome = $scoring->record_from_results( $results, [
	'entity'              => $entity,
	'campaign_run_id'     => $run_id,
	'gophish_campaign_id' => $sim_id,
] );
check( 'Pukat graded exactly one quiz submission', 1 === $outcome['graded'], $failures );

$rows = ( new QuizResultRepository() )->list_for_run( $run_id );
check( 'the graded row scored 100 and passed', 1 === count( $rows ) && 100 === (int) $rows[0]['score'] && 1 === (int) $rows[0]['passed'], $failures );
check( 'the graded row is attributed to the real target email', $target_email === (string) ( $rows[0]['target_email'] ?? '' ), $failures );

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
echo "\n-- cleanup --\n";
wp_set_current_user( 0 );

if ( $sim_id > 0 ) {
	$gophish->delete_campaign( $sim_id );
}
foreach ( (array) $gophish->get_campaigns( [ 'is_master' => true ] ) as $c ) {
	if ( in_array( (string) ( $c['name'] ?? '' ), [ $quiz_sync->master_name( $entity ), $edu_sync->master_name( $entity ) ], true ) ) {
		$gophish->delete_campaign( (int) $c['id'], true );
	}
}
if ( $group_id > 0 ) {
	$gophish->delete_group( $group_id );
}
foreach ( (array) $gophish->get_landing_pages() as $p ) {
	if ( in_array( (string) ( $p['name'] ?? '' ), [ $sim_page_name, $quiz_sync->page_name( $entity ), $edu_sync->page_name( $entity ) ], true ) ) {
		$gophish->delete_landing_page( (int) $p['id'] );
	}
}
foreach ( (array) $gophish->get_email_templates() as $tpl ) {
	if ( in_array( (string) ( $tpl['name'] ?? '' ), [ $sim_tmpl_name, 'pukat-quiz-tmpl-' . $slug, 'pukat-edu-tmpl-' . $slug ], true ) ) {
		$gophish->delete_email_template( (int) $tpl['id'] );
	}
}
foreach ( (array) $gophish->get_sending_profiles() as $prof ) {
	if ( in_array( (string) ( $prof['name'] ?? '' ), [ $sim_smtp_name, 'pukat-quiz-smtp-' . $slug, 'pukat-edu-smtp-' . $slug ], true ) ) {
		$gophish->delete_sending_profile( (int) $prof['id'] );
	}
}

$wpdb->delete( $domains_table, [ 'id' => $domain_id ] );
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'entity_name' => $entity ] );
$wpdb->delete( $wpdb->prefix . 'pukat_flag_pages', [ 'entity_name' => $entity ] );
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_questions', [ 'entity_name' => $entity ] );
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_results', [ 'entity_name' => $entity ] );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}pukat_audit_logs WHERE user_id = %d", $user_id ) );
wp_delete_user( $user_id );
remove_role( $role_slug );

$leftover = array_filter(
	(array) $gophish->get_campaigns(),
	static fn ( $c ): bool => str_starts_with( (string) ( $c['name'] ?? '' ), 'zz-e2e-' )
		|| in_array( (string) ( $c['name'] ?? '' ), [ $quiz_sync->master_name( $entity ), $edu_sync->master_name( $entity ) ], true )
);
check( 'every throwaway campaign was removed', ! $leftover, $failures );
check(
	'the real education master (ibaraki) is untouched',
	1 === count( array_filter(
		(array) $gophish->get_campaigns( [ 'is_master' => true ] ),
		static fn ( $c ): bool => 'pukat-edu-master-ibaraki' === (string) ( $c['name'] ?? '' )
	) ),
	$failures
);

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
