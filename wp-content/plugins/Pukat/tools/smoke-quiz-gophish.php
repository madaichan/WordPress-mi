<?php
/**
 * Quiz Module live GoPhish smoke test — Q3 of
 * docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md (publish → Landing Page + quiz
 * master, and the edit lock).
 *
 * WRITE PATH against the configured GoPhish instance. Everything it creates
 * carries a throwaway entity name (ZZQuizGp...) and is deleted at the end: a
 * WordPress user, a quiz-typed dynamic domain row, a question, a quiz page, the
 * GoPhish landing page / dummy template / dummy sending profile / quiz master,
 * and one scheduled-in-2099 simulation used to prove the lock. It never touches
 * a real entity, and it only ever deletes GoPhish objects whose names it built
 * itself.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-quiz-gophish.php
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

use Pukat\Services\GoPhishService;
use Pukat\Services\PermissionRegistry;
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

$entity      = 'ZZQuizGp';
$suffix      = (string) time();
$role_slug   = 'pukat_smoke_quizgp';
$sync        = new QuizPageSyncService();
$page_name   = $sync->page_name( $entity );
$master_name = $sync->master_name( $entity );
$launch_url  = 'http://localhost:8081';
$thanks_url  = 'https://intranet.example.test/terima-kasih';

$pages_table     = $wpdb->prefix . 'pukat_quiz_pages';
$questions_table = $wpdb->prefix . 'pukat_quiz_questions';
$domains_table   = $wpdb->prefix . 'pukat_dynamic_domains';

// ---------------------------------------------------------------------------
// Throwaway operator + a quiz-typed domain for the Launch URL dropdown.
// ---------------------------------------------------------------------------
remove_role( $role_slug );
add_role( $role_slug, 'Smoke QuizGP', [ 'read' => true ] );
$role = get_role( $role_slug );
foreach ( [ 'post_sim.view', 'post_sim.manage', 'quiz_pages.view', 'quiz_pages.edit', 'quiz_pages.publish', 'domains.view' ] as $key ) {
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
	'domain'               => 'zz-quiz-smoke-' . $suffix . '.test',
	'base_landing_url'     => $launch_url,
	'type'                 => 'quiz',
	'environment'          => 'staging',
	'owner_entity'         => $entity,
	'authorization_status' => 'authorized',
	'status'               => 'active',
] );
$domain_id = (int) $wpdb->insert_id;

// ---------------------------------------------------------------------------
// Publish → landing page + master
// ---------------------------------------------------------------------------
echo "\n-- publish syncs a landing page and a quiz master --\n";

call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Apa tindakan paling aman?',
	'input_name' => 'answer_q1',
	'options'    => [
		[ 'label' => 'Klik tautan', 'value' => 'click', 'correct' => false ],
		[ 'label' => 'Lapor ke IT', 'value' => 'report', 'correct' => true ],
	],
], $user_id );

$html = '<html><body><form method="post"><input type="hidden" name="rid" value="{{.RId}}">'
	. '<fieldset><label><input type="radio" name="answer_q1" value="click"></label>'
	. '<label><input type="radio" name="answer_q1" value="report"></label></fieldset>'
	. '<figure data-pukat-img="999999"><img src="https://example.test/missing.png"></figure>'
	. '<button type="submit">Kirim</button></form></body></html>';

call( 'PUT', '/pukat/v1/quiz-page', [
	'html_body'    => $html,
	'title'        => 'Smoke quiz page',
	'launch_url'   => $launch_url,
	'thankyou_url' => $thanks_url,
], $user_id );

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/publish', [], $user_id );
check( 'publish succeeds', 200 === $status, $failures );
check( 'the landing page sync reports ok', true === ( $body['data']['sync']['ok'] ?? false ), $failures );
check( 'the quiz master reports ok', true === ( $body['data']['master']['ok'] ?? false ), $failures );

$gp_page_id   = (int) ( $body['data']['gophish_page_id'] ?? 0 );
$gp_master_id = (int) ( $body['data']['gophish_master_id'] ?? 0 );
check( 'the page and master ids are stored on the row', $gp_page_id > 0 && $gp_master_id > 0, $failures );

// Quiz Builder v2: GoPhish object names carry the quiz id so an entity can own
// several quizzes without collisions. Recompute the expected names now that we
// know the row id.
$quiz_row_id = (int) ( $body['data']['id'] ?? 0 );
$page_name   = $sync->page_name( $entity, $quiz_row_id );
$master_name = $sync->master_name( $entity, $quiz_row_id );

$page = $gophish->get_landing_page( $gp_page_id );
check( 'the GoPhish page carries the expected name', ! is_wp_error( $page ) && $page_name === (string) ( $page['name'] ?? '' ), $failures );
check( 'capture_credentials is on (without it GoPhish strips input names)', ! is_wp_error( $page ) && true === ( $page['capture_credentials'] ?? false ), $failures );
check( 'redirect_url is the thank-you URL, not empty like the education page', ! is_wp_error( $page ) && $thanks_url === (string) ( $page['redirect_url'] ?? '' ), $failures );
check( 'the synced HTML kept the graded input', ! is_wp_error( $page ) && str_contains( (string) ( $page['html'] ?? '' ), 'name="answer_q1"' ), $failures );
check( 'the data-pukat-img identity attribute was stripped on export', ! is_wp_error( $page ) && ! str_contains( (string) ( $page['html'] ?? '' ), 'data-pukat-img' ), $failures );

$master = $gophish->get_campaign( $gp_master_id );
check( 'the master is campaign_type=quiz', ! is_wp_error( $master ) && 'quiz' === (string) ( $master['campaign_type'] ?? '' ), $failures );
check( 'the master is a master campaign', ! is_wp_error( $master ) && true === ( $master['is_master'] ?? false ), $failures );
check( 'the master url is the chosen Launch URL', ! is_wp_error( $master ) && $launch_url === (string) ( $master['url'] ?? '' ), $failures );
check( 'the master is In progress so it can receive redirects', ! is_wp_error( $master ) && 'In progress' === (string) ( $master['status'] ?? '' ), $failures );
check( 'the master ends the chain (next_campaign_id = 0)', ! is_wp_error( $master ) && 0 === (int) ( $master['next_campaign_id'] ?? 0 ), $failures );
check( 'the master is tagged with the entity', ! is_wp_error( $master ) && $entity === (string) ( $master['entity'] ?? '' ), $failures );

// ---------------------------------------------------------------------------
// Re-publish recreates the master (GoPhish snapshots the page at creation)
// ---------------------------------------------------------------------------
echo "\n-- re-publish recreates the master --\n";

call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => str_replace( 'Kirim', 'Kirim Jawaban', $html ) ], $user_id );
[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/publish', [], $user_id );
$second_master = (int) ( $body['data']['gophish_master_id'] ?? 0 );
$second_page   = (int) ( $body['data']['gophish_page_id'] ?? 0 );
check( 're-publish succeeds', 200 === $status, $failures );
check( 'the master id changed (it was recreated)', $second_master > 0 && $second_master !== $gp_master_id, $failures );
check( 'the landing page id stayed the same (updated in place)', $second_page === $gp_page_id, $failures );
$page = $gophish->get_landing_page( $gp_page_id );
check( 'the landing page now holds the edited HTML', ! is_wp_error( $page ) && str_contains( (string) ( $page['html'] ?? '' ), 'Kirim Jawaban' ), $failures );
check( 'only one master with this name exists after the recreate', 1 === count( array_filter(
	(array) $gophish->get_campaigns( [ 'is_master' => true, 'campaign_type' => 'quiz' ] ),
	static fn ( $c ): bool => $master_name === (string) ( $c['name'] ?? '' )
) ), $failures );
$gp_master_id = $second_master;

// ---------------------------------------------------------------------------
// Edit lock while something routes into the quiz
// ---------------------------------------------------------------------------
echo "\n-- edit lock --\n";

$group_name = 'zz-quiz-smoke-grp-' . $suffix;
$group      = $gophish->create_group( [
	'name'    => $group_name,
	'targets' => [ [ 'email' => 'zz-smoke-' . $suffix . '@example.invalid', 'first_name' => 'ZZ', 'last_name' => 'Smoke' ] ],
] );
$group_id   = is_wp_error( $group ) ? 0 : (int) ( $group['id'] ?? 0 );

// Scheduled far in the future so GoPhish never sends this email.
$sim      = $gophish->create_campaign( [
	'name'             => 'zz-quiz-smoke-sim-' . $suffix,
	'campaign_type'    => 'simulation',
	'entity'           => $entity,
	'url'              => $launch_url,
	'template'         => [ 'name' => 'pukat-quiz-tmpl-' . sanitize_title( $entity ) ],
	'page'             => [ 'name' => $page_name ],
	'smtp'             => [ 'name' => 'pukat-quiz-smtp-' . sanitize_title( $entity ) ],
	'groups'           => [ [ 'name' => $group_name ] ],
	'next_campaign_id' => $gp_master_id,
	'launch_date'      => '2099-01-01T00:00:00+00:00',
] );
$sim_id   = is_wp_error( $sim ) ? 0 : (int) ( $sim['id'] ?? 0 );
check( 'a throwaway simulation chained to the quiz master was created', $sim_id > 0, $failures );

[ $status, $body ] = call( 'GET', '/pukat/v1/quiz-page', [], $user_id );
check( 'GET reports the page as not editable', false === ( $body['data']['editable'] ?? true ), $failures );
check( 'GET names the active campaign and how it routes in', 'quiz' === ( $body['data']['active_simulations'][0]['via'] ?? '' ), $failures );

[ $status, $body ] = call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $html ], $user_id );
check( 'save is refused with 409 quiz_locked', 409 === $status && 'quiz_locked' === ( $body['code'] ?? '' ), $failures );

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/publish', [], $user_id );
check( 'publish is refused with 409 quiz_locked', 409 === $status && 'quiz_locked' === ( $body['code'] ?? '' ), $failures );

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/unpublish', [], $user_id );
check( 'unpublish is refused with 409 quiz_locked', 409 === $status && 'quiz_locked' === ( $body['code'] ?? '' ), $failures );

if ( $sim_id > 0 ) {
	$gophish->delete_campaign( $sim_id );
	$sim_id = 0;
}
[ $status, $body ] = call( 'GET', '/pukat/v1/quiz-page', [], $user_id );
check( 'the page is editable again once the simulation is gone', true === ( $body['data']['editable'] ?? false ), $failures );

// The masters themselves must never count as "active users" of the page.
$active = $sync->active_simulations_for_quiz( $gp_master_id, 0 );
check( 'the quiz master does not lock its own page', ! in_array( $gp_master_id, array_column( $active, 'id' ), true ), $failures );

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
foreach ( (array) $gophish->get_campaigns( [ 'is_master' => true, 'campaign_type' => 'quiz' ] ) as $c ) {
	if ( $master_name === (string) ( $c['name'] ?? '' ) ) {
		$gophish->delete_campaign( (int) $c['id'], true );
	}
}
foreach ( (array) $gophish->get_landing_pages() as $p ) {
	if ( $page_name === (string) ( $p['name'] ?? '' ) ) {
		$gophish->delete_landing_page( (int) $p['id'] );
	}
}
foreach ( (array) $gophish->get_email_templates() as $tpl ) {
	if ( 'pukat-quiz-tmpl-' . sanitize_title( $entity ) === (string) ( $tpl['name'] ?? '' ) ) {
		$gophish->delete_email_template( (int) $tpl['id'] );
	}
}
foreach ( (array) $gophish->get_sending_profiles() as $prof ) {
	if ( 'pukat-quiz-smtp-' . sanitize_title( $entity ) === (string) ( $prof['name'] ?? '' ) ) {
		$gophish->delete_sending_profile( (int) $prof['id'] );
	}
}

$wpdb->delete( $domains_table, [ 'id' => $domain_id ] );
$wpdb->delete( $pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $questions_table, [ 'entity_name' => $entity ] );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}pukat_audit_logs WHERE user_id = %d", $user_id ) );
wp_delete_user( $user_id );
remove_role( $role_slug );

$leftover_gp = array_filter(
	(array) $gophish->get_campaigns( [ 'is_master' => true, 'campaign_type' => 'quiz' ] ),
	static fn ( $c ): bool => $master_name === (string) ( $c['name'] ?? '' )
);
$leftover_pg = array_filter(
	(array) $gophish->get_landing_pages(),
	static fn ( $p ): bool => $page_name === (string) ( $p['name'] ?? '' )
);
$leftover_db = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$pages_table} WHERE entity_name = %s", $entity ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$questions_table} WHERE entity_name = %s", $entity ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$domains_table} WHERE id = %d", $domain_id ) );

check( 'every throwaway GoPhish object and DB row was removed', ! $leftover_gp && ! $leftover_pg && 0 === $leftover_db && ! get_userdata( $user_id ) && ! get_role( $role_slug ), $failures );

// The production objects must be untouched by all of the above.
$ibaraki = array_filter(
	(array) $gophish->get_campaigns( [ 'is_master' => true ] ),
	static fn ( $c ): bool => 'pukat-edu-master-ibaraki' === (string) ( $c['name'] ?? '' )
);
check( 'the real education master (ibaraki) is still there', 1 === count( $ibaraki ), $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
