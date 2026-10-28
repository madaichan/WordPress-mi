<?php
/**
 * Quiz Module smoke test — Q1 (schema/RBAC) and Q2 (question bank, quiz page,
 * linter) of docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md.
 *
 * Exercises the REST surface as three throwaway users (operator-like,
 * view-only, and another entity) against two throwaway entities, then removes
 * every row, user and role it created. It never touches a real entity, a real
 * question bank, or GoPhish — Q3 onwards covers the GoPhish side separately.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-quiz-module.php
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

use Pukat\Services\PermissionRegistry;
use Pukat\Services\QuizPageService;

if ( ! class_exists( QuizPageService::class ) ) {
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

$own_entity   = 'ZZSmokeQuizOwn';
$other_entity = 'ZZSmokeQuizOther';
$suffix       = (string) time();

// ---------------------------------------------------------------------------
// Three throwaway users: full quiz rights, view-only, and another entity.
// ---------------------------------------------------------------------------
$manage_keys = [
	'post_sim.view',
	'post_sim.manage',
	'quiz_pages.view',
	'quiz_pages.edit',
	'quiz_pages.publish',
];
$view_keys   = [ 'post_sim.view', 'quiz_pages.view' ];

$roles = [
	'pukat_smoke_quiz_manage' => $manage_keys,
	'pukat_smoke_quiz_view'   => $view_keys,
	'pukat_smoke_quiz_other'  => $manage_keys,
];
$entities = [
	'pukat_smoke_quiz_manage' => $own_entity,
	'pukat_smoke_quiz_view'   => $own_entity,
	'pukat_smoke_quiz_other'  => $other_entity,
];

$user_ids = [];
foreach ( $roles as $role_slug => $keys ) {
	remove_role( $role_slug );
	add_role( $role_slug, 'Smoke Quiz ' . $role_slug, [ 'read' => true ] );
	$role = get_role( $role_slug );
	foreach ( $keys as $key ) {
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
		fwrite( STDERR, "Could not create {$role_slug} test user: " . $user_id->get_error_message() . "\n" );
		exit( 1 );
	}
	update_user_meta( (int) $user_id, 'meta_entity', $entities[ $role_slug ] );
	$user_ids[ $role_slug ] = (int) $user_id;
}

$manager = $user_ids['pukat_smoke_quiz_manage'];
$viewer  = $user_ids['pukat_smoke_quiz_view'];
$other   = $user_ids['pukat_smoke_quiz_other'];

$questions_table = $wpdb->prefix . 'pukat_quiz_questions';
$pages_table     = $wpdb->prefix . 'pukat_quiz_pages';

// ---------------------------------------------------------------------------
// Question bank
// ---------------------------------------------------------------------------
echo "\n-- question bank --\n";

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Email mendesak minta ganti password?',
	'input_name' => 'answer_q1',
	'options'    => [
		[ 'label' => 'Klik tautan', 'value' => 'click', 'correct' => false ],
		[ 'label' => 'Lapor ke IT', 'value' => 'report', 'correct' => true ],
	],
], $manager );
check( 'create question succeeds (201)', 201 === $status, $failures );
$q1_id = (int) ( $body['data']['id'] ?? 0 );
check( 'created question is scoped to the caller entity', $own_entity === ( $body['data']['entity_name'] ?? '' ), $failures );

[ $status ] = call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Duplicate input name',
	'input_name' => 'answer_q1',
	'options'    => [
		[ 'label' => 'A', 'value' => 'a', 'correct' => true ],
		[ 'label' => 'B', 'value' => 'b', 'correct' => false ],
	],
], $manager );
check( 'duplicate input_name in the same entity is rejected (422)', 422 === $status, $failures );

[ $status ] = call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Bad input name',
	'input_name' => 'q1',
	'options'    => [
		[ 'label' => 'A', 'value' => 'a', 'correct' => true ],
		[ 'label' => 'B', 'value' => 'b', 'correct' => false ],
	],
], $manager );
check( 'input_name without the answer_ prefix is rejected (422)', 422 === $status, $failures );

[ $status ] = call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'No correct option',
	'input_name' => 'answer_q9',
	'options'    => [
		[ 'label' => 'A', 'value' => 'a', 'correct' => false ],
		[ 'label' => 'B', 'value' => 'b', 'correct' => false ],
	],
], $manager );
check( 'a question with no correct option is rejected (422)', 422 === $status, $failures );

[ $status ] = call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Single option',
	'input_name' => 'answer_q8',
	'options'    => [ [ 'label' => 'A', 'value' => 'a', 'correct' => true ] ],
], $manager );
check( 'a question with fewer than two options is rejected (422)', 422 === $status, $failures );

[ $status ] = call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Viewer should not be able to write',
	'input_name' => 'answer_q7',
	'options'    => [
		[ 'label' => 'A', 'value' => 'a', 'correct' => true ],
		[ 'label' => 'B', 'value' => 'b', 'correct' => false ],
	],
], $viewer );
check( 'view-only user cannot create questions (403)', 403 === $status, $failures );

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz/questions', [
	'question'   => 'Kedua: lampiran zip tak dikenal?',
	'input_name' => 'answer_q2',
	'options'    => [
		[ 'label' => 'Buka', 'value' => 'open', 'correct' => false ],
		[ 'label' => 'Jangan dibuka', 'value' => 'skip', 'correct' => true ],
	],
], $manager );
$q2_id = (int) ( $body['data']['id'] ?? 0 );
check( 'second question created', 201 === $status && $q2_id > 0, $failures );

[ $status, $body ] = call( 'GET', '/pukat/v1/quiz/questions', [ 'entity' => $other_entity ], $manager );
check(
	'non-admin naming another entity gets its own bank, not a 403',
	200 === $status && $own_entity === ( $body['data']['entity_name'] ?? '' ) && 2 === count( $body['data']['questions'] ?? [] ),
	$failures
);

[ $status ] = call( 'PUT', '/pukat/v1/quiz/questions/' . $q1_id, [ 'difficulty' => 3 ], $other );
check( 'another entity cannot edit this entity\'s question (403)', 403 === $status, $failures );

[ $status, $body ] = call( 'PUT', '/pukat/v1/quiz/questions/' . $q2_id, [ 'is_active' => false ], $manager );
check( 'deactivating a question succeeds', 200 === $status && false === ( $body['data']['is_active'] ?? true ), $failures );

// ---------------------------------------------------------------------------
// Quiz page: draft, linter, publish
// ---------------------------------------------------------------------------
echo "\n-- quiz page --\n";

[ $status, $body ] = call( 'GET', '/pukat/v1/quiz-page', [], $manager );
check(
	'an entity with no page gets an empty shell, not a 404',
	200 === $status && array_key_exists( 'id', (array) $body['data'] ) && null === $body['data']['id'] && 1 === ( $body['data']['answer_key_count'] ?? 0 ),
	$failures
);

$good_html = '<html><body><form method="post"><input type="hidden" name="rid" value="{{.RId}}">'
	. '<fieldset><label><input type="radio" name="answer_q1" value="click"></label>'
	. '<label><input type="radio" name="answer_q1" value="report"></label></fieldset>'
	. '</form></body></html>';

[ $status ] = call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $good_html, 'title' => 'Smoke quiz' ], $viewer );
check( 'view-only user cannot save the page (403)', 403 === $status, $failures );

[ $status, $body ] = call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $good_html, 'title' => 'Smoke quiz' ], $manager );
check( 'saving a draft succeeds', 200 === $status, $failures );
check( 'the saved draft lints clean', true === ( $body['data']['linter']['ok'] ?? false ), $failures );
$page_id = (int) ( $body['data']['id'] ?? 0 );

// A non-admin naming someone else's entity is not refused — the server simply
// ignores the parameter and writes to their own entity (PRD §10). What must
// never happen is the other entity's page changing.
$own_html_before = (string) $wpdb->get_var( $wpdb->prepare( "SELECT html_body FROM {$pages_table} WHERE entity_name = %s", $own_entity ) );
[ $status ] = call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => '<p>written by the other entity</p>', 'entity' => $own_entity ], $other );
check( 'a non-admin naming another entity is not refused', 200 === $status, $failures );
check(
	'...the write landed on the caller\'s own entity instead',
	'<p>written by the other entity</p>' === (string) $wpdb->get_var( $wpdb->prepare( "SELECT html_body FROM {$pages_table} WHERE entity_name = %s", $other_entity ) ),
	$failures
);
check(
	'...and the named entity\'s page was left untouched',
	$own_html_before === (string) $wpdb->get_var( $wpdb->prepare( "SELECT html_body FROM {$pages_table} WHERE entity_name = %s", $own_entity ) ),
	$failures
);

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/validate', [
	'html_body' => '<form method="post"><fieldset><input type="radio" name="answer_q1" value="a"></fieldset><input type="text" name="answer_zz"></form>',
], $manager );
$codes = array_column( $body['data']['linter']['issues'] ?? [], 'code' );
check( 'dry-run validate reports an input with no key', 200 === $status && in_array( 'input_without_key', $codes, true ), $failures );

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/validate', [ 'html_body' => '<div>no form at all</div>' ], $manager );
$codes = array_column( $body['data']['linter']['issues'] ?? [], 'code' );
check( 'dry-run validate reports a missing POST form', in_array( 'missing_form', $codes, true ), $failures );
check( 'dry-run validate reports the active key missing from the page', in_array( 'key_without_input', $codes, true ), $failures );

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/publish', [], $manager );
check( 'publishing a clean draft succeeds', 200 === $status, $failures );
check( 'the published page records its pass score snapshot', 70 === ( $body['data']['published_pass_score'] ?? 0 ), $failures );
$snapshot = (string) $wpdb->get_var( $wpdb->prepare( "SELECT published_answer_key FROM {$pages_table} WHERE id = %d", $page_id ) );
$decoded  = json_decode( $snapshot, true );
check(
	'the answer key snapshot holds only the active question and its correct value',
	is_array( $decoded ) && [ 'answer_q1' ] === array_keys( $decoded ) && [ 'report' ] === ( $decoded['answer_q1']['correct'] ?? [] ),
	$failures
);

// Re-activating the second question makes the published page incomplete again.
call( 'PUT', '/pukat/v1/quiz/questions/' . $q2_id, [ 'is_active' => true ], $manager );
[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/publish', [], $manager );
$codes = array_column( $body['linter']['issues'] ?? [], 'code' );
check( 'publish is refused (422) once an active question is missing from the page', 422 === $status, $failures );
check( '...and the refusal names the missing input', in_array( 'key_without_input', $codes, true ), $failures );
check(
	'...and the previous snapshot is left untouched',
	$snapshot === (string) $wpdb->get_var( $wpdb->prepare( "SELECT published_answer_key FROM {$pages_table} WHERE id = %d", $page_id ) ),
	$failures
);

// A page that duplicates a text input cannot be published either.
call( 'PUT', '/pukat/v1/quiz/questions/' . $q2_id, [ 'is_active' => false ], $manager );
$dup_html = '<form method="post"><input type="text" name="answer_q1"><input type="text" name="answer_q1"></form>';
call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $dup_html ], $manager );
[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/publish', [], $manager );
$codes = array_column( $body['linter']['issues'] ?? [], 'code' );
check( 'publish is refused when one input name is used twice', 422 === $status && in_array( 'duplicate_input', $codes, true ), $failures );

// Settings validation.
[ $status ] = call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $good_html, 'pass_score' => 140 ], $manager );
check( 'a pass score above 100 is rejected (422)', 422 === $status, $failures );

[ $status ] = call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $good_html, 'launch_url' => 'http://not-a-known-domain.test' ], $manager );
check( 'a launch URL outside the quiz-typed domains is rejected (422)', 422 === $status, $failures );

[ $status, $body ] = call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $good_html, 'pass_score' => 85, 'thankyou_url' => 'https://intranet.example.test/thanks' ], $manager );
check(
	'pass score and thank-you URL are stored',
	200 === $status && 85 === ( $body['data']['pass_score'] ?? 0 ) && 85 === ( $body['data']['effective_pass_score'] ?? 0 ),
	$failures
);

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz-page/unpublish', [], $manager );
check(
	'unpublish clears the published copy and its snapshot',
	200 === $status
		&& 'draft' === ( $body['data']['status'] ?? '' )
		&& null === $wpdb->get_var( $wpdb->prepare( "SELECT published_answer_key FROM {$pages_table} WHERE id = %d", $page_id ) ),
	$failures
);

// The removed legacy route must be gone.
[ $status ] = call( 'POST', '/pukat/v1/quiz/submit', [ 'campaign_id' => 1, 'email' => 'x@example.test', 'answers' => [ 1 => 'a' ] ], $manager );
check( 'the legacy POST /quiz/submit route no longer exists (404)', 404 === $status, $failures );

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
echo "\n-- cleanup --\n";
wp_set_current_user( 0 );
$wpdb->delete( $pages_table, [ 'entity_name' => $own_entity ] );
$wpdb->delete( $pages_table, [ 'entity_name' => $other_entity ] );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$questions_table} WHERE entity_name IN (%s, %s)", $own_entity, $other_entity ) );
$wpdb->query(
	$wpdb->prepare(
		"DELETE FROM {$wpdb->prefix}pukat_audit_logs WHERE object_type IN ('quiz_page', 'quiz_question') AND user_id IN (%d, %d, %d)",
		$manager,
		$viewer,
		$other
	)
);
foreach ( $user_ids as $user_id ) {
	wp_delete_user( $user_id );
}
foreach ( array_keys( $roles ) as $role_slug ) {
	remove_role( $role_slug );
}

$leftover = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$pages_table} WHERE entity_name IN (%s, %s)", $own_entity, $other_entity ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$questions_table} WHERE entity_name IN (%s, %s)", $own_entity, $other_entity ) );
$leftover_users = array_filter( array_map( 'get_userdata', array_values( $user_ids ) ) );
$leftover_roles = array_filter( array_map( 'get_role', array_keys( $roles ) ) );
check( 'all throwaway rows, users and roles removed', 0 === $leftover && ! $leftover_users && ! $leftover_roles, $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
