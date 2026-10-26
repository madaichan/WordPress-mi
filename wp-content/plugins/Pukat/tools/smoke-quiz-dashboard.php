<?php
/**
 * Quiz dashboard smoke — the two data additions behind it.
 *
 * 1. `per_question` entries carry `question_id`, so the dashboard can show a
 *    question's own text instead of its bare input name.
 * 2. `GET /quiz/results` carries a `participation` block built from each
 *    campaign run's stored metrics snapshot: how many targets were redirected
 *    into the quiz chain versus how many finished it, in total and per run.
 * 3. That block counts ONLY the two linkages that belong to the quiz —
 *    simulation → quiz and simulation → education → quiz. A run that chained
 *    to education alone, or asked for no follow-up at all, never offered a
 *    quiz and must stay out of the denominator.
 *
 * Pure local test: inserts a published quiz, graded result rows and campaign
 * runs directly, never touches GoPhish, and cleans up. Throwaway entity and
 * throwaway user.
 *
 *   php wp-content/plugins/Pukat/tools/smoke-quiz-dashboard.php
 *
 * @package Pukat
 */

declare(strict_types=1);

require dirname( __DIR__, 4 ) . '/wp-load.php';

use Pukat\Services\PermissionRegistry;

global $wpdb;

$failures = [];

function check( string $label, bool $condition, array &$failures ): void {
	echo ( $condition ? 'PASS' : 'FAIL' ) . " — {$label}\n";
	if ( ! $condition ) {
		$failures[] = $label;
	}
}

do_action( 'rest_api_init' );

$entity       = 'ZZQuizDash';
$other_entity = 'ZZQuizDashOther';
$suffix       = (string) time();
$role_slug    = 'pukat_smoke_quiz_dash';

$pages_table   = $wpdb->prefix . 'pukat_quiz_pages';
$results_table = $wpdb->prefix . 'pukat_quiz_results';
$runs_table    = $wpdb->prefix . 'pukat_campaign_runs';

// Clean slate.
$wpdb->delete( $pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $results_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $runs_table, [ 'entity' => $entity ] );
$wpdb->delete( $runs_table, [ 'entity' => $other_entity ] );

// --- throwaway reader -------------------------------------------------------
remove_role( $role_slug );
add_role( $role_slug, 'Smoke Quiz Dashboard', [ 'read' => true ] );
$role = get_role( $role_slug );
foreach ( [ 'post_sim.view', 'quiz_pages.view' ] as $key ) {
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

// --- a published quiz whose answer key names its question ids ---------------
$answer_key = [
	'answer_q1' => [ 'question_id' => 4101, 'correct' => [ 'report' ] ],
	'answer_q2' => [ 'question_id' => 4102, 'correct' => [ 'verify' ] ],
];
$wpdb->insert( $pages_table, [
	'entity_name'          => $entity,
	'title'                => 'Dashboard smoke quiz',
	'html_body'            => '<form method="post"></form>',
	'published_html'       => '<form method="post"></form>',
	'published_answer_key' => (string) wp_json_encode( $answer_key ),
	'published_pass_score' => 70,
	'status'               => 'published',
	'is_default_followup'  => 1,
	'gophish_master_id'    => 60001,
] );
$quiz_id = (int) $wpdb->insert_id;

// Three arrivals: q1 right twice, q2 right once — so q2 is the weaker question.
$arrivals = [
	[ 'rid' => 'dash-1', 'email' => 'one@example.invalid',   'answers' => [ 'answer_q1' => [ 'report' ], 'answer_q2' => [ 'verify' ] ], 'score' => 100, 'correct' => 2, 'passed' => 1 ],
	[ 'rid' => 'dash-2', 'email' => 'two@example.invalid',   'answers' => [ 'answer_q1' => [ 'report' ], 'answer_q2' => [ 'click' ] ],  'score' => 50,  'correct' => 1, 'passed' => 0 ],
	[ 'rid' => 'dash-3', 'email' => 'three@example.invalid', 'answers' => [ 'answer_q1' => [ 'click' ], 'answer_q2' => [ 'click' ] ],   'score' => 0,   'correct' => 0, 'passed' => 0 ],
];
foreach ( $arrivals as $arrival ) {
	$wpdb->insert( $results_table, [
		'entity_name'     => $entity,
		'campaign_id'     => 0,
		'campaign_run_id' => 9001,
		'gophish_rid'     => $arrival['rid'],
		'quiz_page_id'    => $quiz_id,
		'user_id'         => 0,
		'target_email'    => $arrival['email'],
		'score'           => $arrival['score'],
		'question_count'  => 2,
		'correct_count'   => $arrival['correct'],
		'passed'          => $arrival['passed'],
		'pass_score_used' => 70,
		'answers'         => (string) wp_json_encode( $arrival['answers'] ),
		'completed_at'    => '2026-10-20 03:00:00',
	] );
}

// --- campaign runs: the participation denominator ---------------------------
// Counted: Run A (simulation → education → quiz) and Run B (simulation →
// quiz). Not counted: Run C was reached by nobody, Run D belongs to another
// entity, Run E stopped at education, Run F asked for no follow-up at all.
// Run A's entity is cased differently on purpose.
$run_rows = [
	[ 'name' => 'Run A', 'entity' => strtolower( $entity ), 'launched_at' => '2026-10-18 01:00:00', 'reached' => 10, 'quiz' => 7,  'quiz_enabled' => true,  'education_enabled' => true ],
	[ 'name' => 'Run B', 'entity' => $entity,               'launched_at' => '2026-10-20 01:00:00', 'reached' => 5,  'quiz' => 2,  'quiz_enabled' => true,  'education_enabled' => false ],
	[ 'name' => 'Run C', 'entity' => $entity,               'launched_at' => '2026-10-21 01:00:00', 'reached' => 0,  'quiz' => 0,  'quiz_enabled' => true,  'education_enabled' => false ],
	[ 'name' => 'Run D', 'entity' => $other_entity,         'launched_at' => '2026-10-21 02:00:00', 'reached' => 99, 'quiz' => 99, 'quiz_enabled' => true,  'education_enabled' => false ],
	[ 'name' => 'Run E', 'entity' => $entity,               'launched_at' => '2026-10-22 01:00:00', 'reached' => 20, 'quiz' => 0,  'quiz_enabled' => false, 'education_enabled' => true ],
	[ 'name' => 'Run F', 'entity' => $entity,               'launched_at' => '2026-10-23 01:00:00', 'reached' => 30, 'quiz' => 0,  'quiz_enabled' => false, 'education_enabled' => false ],
];
foreach ( $run_rows as $run ) {
	$wpdb->insert( $runs_table, [
		'playbook_master_id' => 0,
		'name'               => $run['name'],
		'entity'             => $run['entity'],
		'status'             => 'completed',
		'launched_at'        => $run['launched_at'],
		'metrics_json'       => (string) wp_json_encode( [
			'stats' => [
				'submitted_data' => $run['reached'],
				'quiz_completed' => $run['quiz'],
			],
		] ),
		'follow_up_json'     => (string) wp_json_encode( [
			'quiz_enabled'      => $run['quiz_enabled'],
			'education_enabled' => $run['education_enabled'],
		] ),
	] );
}

// A never-launched run must be ignored even though it has a snapshot.
$wpdb->insert( $runs_table, [
	'playbook_master_id' => 0,
	'name'               => 'Run never launched',
	'entity'             => $entity,
	'status'             => 'draft_run',
	'launched_at'        => null,
	'metrics_json'       => (string) wp_json_encode( [ 'stats' => [ 'submitted_data' => 50, 'quiz_completed' => 50 ] ] ),
	'follow_up_json'     => (string) wp_json_encode( [ 'quiz_enabled' => true, 'education_enabled' => false ] ),
] );

// A run with no follow-up record at all (pre-dates the column) must not be
// read as opting into a quiz.
$wpdb->insert( $runs_table, [
	'playbook_master_id' => 0,
	'name'               => 'Run without follow-up json',
	'entity'             => $entity,
	'status'             => 'completed',
	'launched_at'        => '2026-10-24 01:00:00',
	'metrics_json'       => (string) wp_json_encode( [ 'stats' => [ 'submitted_data' => 40, 'quiz_completed' => 0 ] ] ),
	'follow_up_json'     => null,
] );

// --- the response -----------------------------------------------------------
wp_set_current_user( $user_id );
$response = rest_do_request( new WP_REST_Request( 'GET', '/pukat/v1/quiz/results' ) );
$status   = $response->get_status();
$body     = $response->get_data();

check( 'GET /quiz/results returns 200', 200 === $status, $failures );

$data = is_array( $body ) && isset( $body['data'] ) && is_array( $body['data'] ) ? $body['data'] : (array) $body;

check( 'three submissions came back', 3 === (int) ( $data['total'] ?? 0 ), $failures );

// --- per-question question_id ----------------------------------------------
echo "\n-- per-question --\n";
$per_question = [];
foreach ( (array) ( $data['per_question'] ?? [] ) as $entry ) {
	$per_question[ (string) ( $entry['input_name'] ?? '' ) ] = $entry;
}

check( 'both questions are broken down', 2 === count( $per_question ), $failures );
check( 'answer_q1 carries its question id', 4101 === (int) ( $per_question['answer_q1']['question_id'] ?? 0 ), $failures );
check( 'answer_q2 carries its question id', 4102 === (int) ( $per_question['answer_q2']['question_id'] ?? 0 ), $failures );
check( 'answer_q1 wrong once of three', 1 === (int) ( $per_question['answer_q1']['wrong'] ?? -1 ) && 3 === (int) ( $per_question['answer_q1']['asked'] ?? -1 ), $failures );
check( 'answer_q2 wrong twice of three', 2 === (int) ( $per_question['answer_q2']['wrong'] ?? -1 ) && 3 === (int) ( $per_question['answer_q2']['asked'] ?? -1 ), $failures );

// --- participation ----------------------------------------------------------
echo "\n-- participation --\n";
$participation = (array) ( $data['participation'] ?? [] );
$runs          = (array) ( $participation['runs'] ?? [] );
$run_names     = array_map( static fn ( $r ): string => (string) ( $r['name'] ?? '' ), $runs );

check( 'reached sums this entity\'s quiz-linked runs (10 + 5)', 15 === (int) ( $participation['reached'] ?? -1 ), $failures );
check( 'completed sums the same runs (7 + 2)', 9 === (int) ( $participation['completed'] ?? -1 ), $failures );
check( 'rate is completed/reached (9/15 = 60%)', 60 === (int) ( $participation['rate'] ?? -1 ), $failures );
check( 'a differently-cased entity name still matches', in_array( 'Run A', $run_names, true ), $failures );
check( 'a run nobody reached is dropped', ! in_array( 'Run C', $run_names, true ), $failures );
check( 'a never-launched run is ignored', ! in_array( 'Run never launched', $run_names, true ), $failures );
check( "another entity's run is excluded", ! in_array( 'Run D', $run_names, true ), $failures );
check( 'two runs reported, newest first', 2 === count( $runs ) && 'Run B' === ( $run_names[0] ?? '' ), $failures );

echo "\n-- linkage: only simulation→quiz and simulation→education→quiz --\n";
$via = [];
foreach ( $runs as $run ) {
	$via[ (string) ( $run['name'] ?? '' ) ] = (string) ( $run['via'] ?? '' );
}

check( 'an education-only run is excluded', ! in_array( 'Run E', $run_names, true ), $failures );
check( 'a run with no follow-up at all is excluded', ! in_array( 'Run F', $run_names, true ), $failures );
check( 'a run with no follow-up record is excluded', ! in_array( 'Run without follow-up json', $run_names, true ), $failures );
check( 'simulation → education → quiz is labelled education', 'education' === ( $via['Run A'] ?? '' ), $failures );
check( 'simulation → quiz is labelled direct', 'direct' === ( $via['Run B'] ?? '' ), $failures );
check(
	"an education-only run's targets stay out of the denominator",
	15 === (int) ( $participation['reached'] ?? -1 ),
	$failures
);

// --- the refresh route ------------------------------------------------------
// Route, permission and payload shape only: this entity has no in-flight run,
// so nothing is polled and GoPhish is never called. The refresh mechanics
// themselves are proven with a stubbed GoPhish in smoke-quiz-refresh.php.
echo "\n-- refresh route --\n";
$refresh_response = rest_do_request( new WP_REST_Request( 'POST', '/pukat/v1/quiz/results/refresh' ) );
$refresh_body     = $refresh_response->get_data();
$refresh_data     = is_array( $refresh_body ) && isset( $refresh_body['data'] ) && is_array( $refresh_body['data'] )
	? $refresh_body['data']
	: (array) $refresh_body;

check( 'POST /quiz/results/refresh returns 200', 200 === $refresh_response->get_status(), $failures );
check( 'it reports what the refresh did', isset( $refresh_data['refresh']['refreshed'] ), $failures );
check( 'no in-flight run means nothing polled', 0 === (int) ( $refresh_data['refresh']['polled'] ?? -1 ), $failures );
check( 'it answers with the same payload as a read', 3 === (int) ( $refresh_data['total'] ?? 0 ) && isset( $refresh_data['participation'] ), $failures );

// --- cleanup ----------------------------------------------------------------
wp_set_current_user( 0 );
delete_transient( 'pukat_quiz_refresh_' . md5( strtolower( $entity ) ) );
require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user( $user_id );
remove_role( $role_slug );
$wpdb->delete( $pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $results_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $runs_table, [ 'entity' => $entity ] );
$wpdb->delete( $runs_table, [ 'entity' => strtolower( $entity ) ] );
$wpdb->delete( $runs_table, [ 'entity' => $other_entity ] );
echo "\n-- cleanup done --\n";

echo "\n" . ( $failures ? count( $failures ) . " FAILURE(S)\n" : "ALL PASS\n" );
exit( $failures ? 1 : 0 );
