<?php
/**
 * Quiz Module live chain smoke test — Q4 of
 * docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md.
 *
 * Covers the failure mode the plan calls the riskiest in the whole module: both
 * masters are recreated with a new id on every publish, so `next_campaign_id`
 * goes stale silently — the campaign still runs, the chain just stops leading
 * anywhere. Scenarios (a)–(f) from Q4 are asserted against live GoPhish.
 *
 * WRITE PATH. Everything is created under a throwaway entity (ZZQuizChain) and
 * deleted at the end; it only deletes GoPhish objects whose names it built
 * itself, and it re-checks afterwards that the real education master is intact.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-quiz-chain.php
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

use Pukat\Services\CampaignRunService;
use Pukat\Services\FlagPageSyncService;
use Pukat\Services\GoPhishService;
use Pukat\Services\PermissionRegistry;
use Pukat\Services\QuizChainService;
use Pukat\Services\QuizPageSyncService;

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

$gophish = new GoPhishService();
if ( is_wp_error( $gophish->test_connection() ) ) {
	fwrite( STDERR, "GoPhish is not reachable — configure the connection first.\n" );
	exit( 1 );
}

/** The live `next_campaign_id` of a campaign, or -1 when it cannot be read. */
function next_of( GoPhishService $gophish, int $id ): int {
	$campaign = $gophish->get_campaign( $id );

	return is_wp_error( $campaign ) ? -1 : (int) ( $campaign['next_campaign_id'] ?? 0 );
}

$entity     = 'ZZQuizChain';
$suffix     = (string) time();
$role_slug  = 'pukat_smoke_quizchain';
$launch_url = 'http://localhost:8081';

$quiz_sync = new QuizPageSyncService();
$edu_sync  = new FlagPageSyncService();
$chain     = new QuizChainService();
$slug      = sanitize_title( $entity );

$quiz_pages_table = $wpdb->prefix . 'pukat_quiz_pages';
$flag_pages_table = $wpdb->prefix . 'pukat_flag_pages';
$questions_table  = $wpdb->prefix . 'pukat_quiz_questions';
$domains_table    = $wpdb->prefix . 'pukat_dynamic_domains';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
remove_role( $role_slug );
add_role( $role_slug, 'Smoke QuizChain', [ 'read' => true ] );
$role = get_role( $role_slug );
foreach ( [ 'post_sim.view', 'post_sim.manage', 'quiz_pages.view', 'quiz_pages.edit', 'quiz_pages.publish', 'flag_pages.view', 'flag_pages.edit', 'flag_pages.publish', 'domains.view' ] as $key ) {
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
	fwrite( STDERR, 'Could not create the test user: ' . $user_id->get_error_message() . "\n" );
	exit( 1 );
}
$user_id = (int) $user_id;
update_user_meta( $user_id, 'meta_entity', $entity );

$wpdb->insert( $domains_table, [
	'domain'               => 'zz-quizchain-' . $suffix . '.test',
	'base_landing_url'     => $launch_url,
	'type'                 => 'quiz',
	'environment'          => 'staging',
	'owner_entity'         => $entity,
	'authorization_status' => 'authorized',
	'status'               => 'active',
] );
$domain_id = (int) $wpdb->insert_id;

$quiz_html = '<html><body><form method="post"><input type="hidden" name="rid" value="{{.RId}}">'
	. '<fieldset><label><input type="radio" name="answer_q1" value="click"></label>'
	. '<label><input type="radio" name="answer_q1" value="report"></label></fieldset>'
	. '<button type="submit">Kirim</button></form></body></html>';
$edu_html  = '<html><body><h1>Edukasi</h1><form method="post">'
	. '<input type="hidden" name="rid" value="{{.RId}}"><button type="submit">Saya paham</button></form></body></html>';

call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Tindakan paling aman?',
	'input_name' => 'answer_q1',
	'options'    => [
		[ 'label' => 'Klik', 'value' => 'click', 'correct' => false ],
		[ 'label' => 'Lapor', 'value' => 'report', 'correct' => true ],
	],
], $user_id );

// ---------------------------------------------------------------------------
// (a) publishing the quiz links the education master to it
// ---------------------------------------------------------------------------
echo "\n-- (a) quiz publish links education → quiz --\n";

call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $quiz_html, 'launch_url' => $launch_url, 'thankyou_url' => 'https://intranet.example.test/thanks' ], $user_id );
[ , $body ]  = call( 'POST', '/pukat/v1/quiz-page/publish', [], $user_id );
$quiz_master  = (int) ( $body['data']['gophish_master_id'] ?? 0 );
$quiz_page_id = (int) ( $body['data']['id'] ?? 0 ); // Quiz Builder v2: GoPhish names carry the quiz id.
check( 'the quiz master exists', $quiz_master > 0, $failures );
check(
	'with no education page yet, the chain step is a no-op and says so',
	true === ( $body['data']['chain']['ok'] ?? false ) && false === ( $body['data']['chain']['linked'] ?? true ),
	$failures
);

call( 'PUT', '/pukat/v1/flag-page', [ 'html_body' => $edu_html, 'launch_url' => $launch_url ], $user_id );
[ , $body ] = call( 'POST', '/pukat/v1/flag-page/publish', [], $user_id );
$edu_master = (int) ( $body['data']['gophish_master_id'] ?? 0 );
check( 'the education master exists', $edu_master > 0, $failures );
check( 'publishing education reports the chain as linked', true === ( $body['data']['chain']['linked'] ?? false ), $failures );
check( 'education → quiz is set in GoPhish', $quiz_master === next_of( $gophish, $edu_master ), $failures );

// ---------------------------------------------------------------------------
// (b) re-publishing education keeps the chain (the regression this fase exists for)
// ---------------------------------------------------------------------------
echo "\n-- (b) re-publishing education keeps the chain --\n";

call( 'PUT', '/pukat/v1/flag-page', [ 'html_body' => str_replace( 'Edukasi', 'Edukasi v2', $edu_html ) ], $user_id );
[ , $body ]     = call( 'POST', '/pukat/v1/flag-page/publish', [], $user_id );
$edu_master_two = (int) ( $body['data']['gophish_master_id'] ?? 0 );
check( 'the education master was recreated with a new id', $edu_master_two > 0 && $edu_master_two !== $edu_master, $failures );
check( 'the NEW education master still points at the quiz master', $quiz_master === next_of( $gophish, $edu_master_two ), $failures );
$edu_master = $edu_master_two;

// ---------------------------------------------------------------------------
// (c) re-publishing the quiz re-points education at the new quiz master
// ---------------------------------------------------------------------------
echo "\n-- (c) re-publishing the quiz re-points education --\n";

call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => str_replace( 'Kirim', 'Kirim Jawaban', $quiz_html ) ], $user_id );
[ , $body ]      = call( 'POST', '/pukat/v1/quiz-page/publish', [], $user_id );
$quiz_master_two = (int) ( $body['data']['gophish_master_id'] ?? 0 );
check( 'the quiz master was recreated with a new id', $quiz_master_two > 0 && $quiz_master_two !== $quiz_master, $failures );
check( 'education now points at the NEW quiz master', $quiz_master_two === next_of( $gophish, $edu_master ), $failures );
$quiz_master = $quiz_master_two;

// ---------------------------------------------------------------------------
// (e)/(f) what a launching simulation would chain to
// ---------------------------------------------------------------------------
echo "\n-- (e)/(f) resolving a simulation's follow-up target --\n";

$both = $chain->resolve_simulation_target( $entity, true, true );
check( 'education + quiz on → the simulation chains to education', 'education' === $both['stage'] && $edu_master === $both['campaign_id'], $failures );

$quiz_only = $chain->resolve_simulation_target( $entity, false, true );
check( 'quiz on, education off → the simulation chains straight to the quiz', 'quiz' === $quiz_only['stage'] && $quiz_master === $quiz_only['campaign_id'], $failures );

$neither = $chain->resolve_simulation_target( $entity, false, false );
check( 'both off → nothing to chain', 'none' === $neither['stage'] && 0 === $neither['campaign_id'], $failures );

$unknown = $chain->resolve_simulation_target( 'ZZNoSuchEntity' . $suffix, false, true );
check( 'an entity with no published quiz warns instead of linking', false === $unknown['ok'] && 0 === $unknown['campaign_id'] && '' !== $unknown['message'], $failures );

// Launch-time linking, exercised on a throwaway simulation through the private
// method CampaignRunService::launch() calls (same approach as the G4 smoke).
$group_name = 'zz-quizchain-grp-' . $suffix;
$group      = $gophish->create_group( [
	'name'    => $group_name,
	'targets' => [ [ 'email' => 'zz-chain-' . $suffix . '@example.invalid', 'first_name' => 'ZZ', 'last_name' => 'Chain' ] ],
] );
$group_id   = is_wp_error( $group ) ? 0 : (int) ( $group['id'] ?? 0 );

$sim    = $gophish->create_campaign( [
	'name'          => 'zz-quizchain-sim-' . $suffix,
	'campaign_type' => 'simulation',
	'entity'        => $entity,
	'url'           => $launch_url,
	'template'      => [ 'name' => 'pukat-quiz-tmpl-' . $slug ],
	'page'          => [ 'name' => $quiz_sync->page_name( $entity, $quiz_page_id ) ],
	'smtp'          => [ 'name' => 'pukat-quiz-smtp-' . $slug ],
	'groups'        => [ [ 'name' => $group_name ] ],
	'launch_date'   => '2099-01-01T00:00:00+00:00',
] );
$sim_id = is_wp_error( $sim ) ? 0 : (int) ( $sim['id'] ?? 0 );
check( 'a throwaway simulation was created for the launch-link check', $sim_id > 0, $failures );

$link_method = new ReflectionMethod( CampaignRunService::class, 'link_follow_up_chain' );
$link_method->setAccessible( true );
$runs        = new CampaignRunService();

$run_row = [
	'id'                  => 0,
	'entity'              => $entity,
	'gophish_campaign_id' => $sim_id,
	'follow_up_json'      => (string) wp_json_encode( [ 'quiz_enabled' => true, 'education_enabled' => false ] ),
];
$result  = $link_method->invoke( $runs, $run_row, $user_id );
check( 'launching with quiz-only follow-up links the simulation to the quiz master', is_array( $result ) && true === $result['ok'] && 'quiz' === $result['stage'], $failures );
check( '...and GoPhish really holds that next_campaign_id', $quiz_master === next_of( $gophish, $sim_id ), $failures );

$run_row['follow_up_json'] = (string) wp_json_encode( [ 'quiz_enabled' => true, 'education_enabled' => true ] );
$result                    = $link_method->invoke( $runs, $run_row, $user_id );
check( 'with both stages on it links to education instead', is_array( $result ) && 'education' === $result['stage'], $failures );
check( '...and GoPhish now holds the education master', $edu_master === next_of( $gophish, $sim_id ), $failures );

$run_row['follow_up_json'] = (string) wp_json_encode( [ 'quiz_enabled' => false, 'education_enabled' => false ] );
check( 'a run that opted into nothing is not linked at all', null === $link_method->invoke( $runs, $run_row, $user_id ), $failures );

// ---------------------------------------------------------------------------
// The wider edit lock: a simulation chained to EDUCATION also locks the quiz
// page, because education leads into it (PRD FR-11). The throwaway simulation
// above now points at the education master, which makes this testable here.
// ---------------------------------------------------------------------------
echo "\n-- edit lock reaches through education --\n";

[ , $body ] = call( 'GET', '/pukat/v1/quiz-page', [], $user_id );
check(
	'the quiz page is locked by a simulation that only chains to education',
	false === ( $body['data']['editable'] ?? true ) && 'education' === ( $body['data']['active_simulations'][0]['via'] ?? '' ),
	$failures
);

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/unpublish', [], $user_id );
check( 'unpublish is refused while that simulation is active', 409 === $status && 'quiz_locked' === ( $body['code'] ?? '' ), $failures );

// Clear the route in so the page is editable again for (d).
if ( $sim_id > 0 ) {
	$gophish->delete_campaign( $sim_id );
	$sim_id = 0;
}

// ---------------------------------------------------------------------------
// (d) unpublishing the quiz drops the chain
// ---------------------------------------------------------------------------
echo "\n-- (d) unpublishing the quiz drops the chain --\n";

[ , $body ] = call( 'POST', '/pukat/v1/quiz-page/unpublish', [], $user_id );
check( 'unpublish succeeds', 'draft' === ( $body['data']['status'] ?? '' ), $failures );
check( 'education no longer points anywhere', 0 === next_of( $gophish, $edu_master ), $failures );

$after = $chain->resolve_simulation_target( $entity, false, true );
check( 'and a quiz-only run would now warn rather than link', false === $after['ok'], $failures );

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
echo "\n-- cleanup --\n";
wp_set_current_user( 0 );

if ( $sim_id > 0 ) {
	$gophish->delete_campaign( $sim_id );
}
if ( $group_id > 0 ) {
	$gophish->delete_group( $group_id );
}

$own_masters = [ $quiz_sync->master_name( $entity, $quiz_page_id ), $edu_sync->master_name( $entity ) ];
foreach ( (array) $gophish->get_campaigns( [ 'is_master' => true ] ) as $c ) {
	if ( in_array( (string) ( $c['name'] ?? '' ), $own_masters, true ) ) {
		$gophish->delete_campaign( (int) $c['id'], true );
	}
}
$own_pages = [ $quiz_sync->page_name( $entity, $quiz_page_id ), $edu_sync->page_name( $entity ) ];
foreach ( (array) $gophish->get_landing_pages() as $p ) {
	if ( in_array( (string) ( $p['name'] ?? '' ), $own_pages, true ) ) {
		$gophish->delete_landing_page( (int) $p['id'] );
	}
}
$own_templates = [ 'pukat-quiz-tmpl-' . $slug, 'pukat-edu-tmpl-' . $slug ];
foreach ( (array) $gophish->get_email_templates() as $tpl ) {
	if ( in_array( (string) ( $tpl['name'] ?? '' ), $own_templates, true ) ) {
		$gophish->delete_email_template( (int) $tpl['id'] );
	}
}
$own_smtp = [ 'pukat-quiz-smtp-' . $slug, 'pukat-edu-smtp-' . $slug ];
foreach ( (array) $gophish->get_sending_profiles() as $prof ) {
	if ( in_array( (string) ( $prof['name'] ?? '' ), $own_smtp, true ) ) {
		$gophish->delete_sending_profile( (int) $prof['id'] );
	}
}

$wpdb->delete( $domains_table, [ 'id' => $domain_id ] );
$wpdb->delete( $quiz_pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $flag_pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $questions_table, [ 'entity_name' => $entity ] );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}pukat_audit_logs WHERE user_id = %d", $user_id ) );
wp_delete_user( $user_id );
remove_role( $role_slug );

$leftover_campaigns = array_filter(
	(array) $gophish->get_campaigns(),
	static fn ( $c ): bool => str_starts_with( (string) ( $c['name'] ?? '' ), 'zz-quizchain' )
		|| in_array( (string) ( $c['name'] ?? '' ), $own_masters, true )
);
$leftover_pages = array_filter(
	(array) $gophish->get_landing_pages(),
	static fn ( $p ): bool => in_array( (string) ( $p['name'] ?? '' ), $own_pages, true )
);
$leftover_db = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$quiz_pages_table} WHERE entity_name = %s", $entity ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$flag_pages_table} WHERE entity_name = %s", $entity ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$domains_table} WHERE id = %d", $domain_id ) );

check( 'every throwaway GoPhish object and DB row was removed', ! $leftover_campaigns && ! $leftover_pages && 0 === $leftover_db && ! get_userdata( $user_id ) && ! get_role( $role_slug ), $failures );

$ibaraki = array_values( array_filter(
	(array) $gophish->get_campaigns( [ 'is_master' => true ] ),
	static fn ( $c ): bool => 'pukat-edu-master-ibaraki' === (string) ( $c['name'] ?? '' )
) );
check( 'the real education master (ibaraki) still exists', 1 === count( $ibaraki ), $failures );
check( 'the real education master was not re-chained by any of this', isset( $ibaraki[0] ) && 0 === (int) ( $ibaraki[0]['next_campaign_id'] ?? -1 ), $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
