<?php
/**
 * Quiz Module scoring + invitation smoke test — Q5 of
 * docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md.
 *
 * Grading is driven with a hand-built results payload shaped exactly like
 * `GET /api/campaigns/{id}/results` (docs/api_campaignnew.md §3.5.1), so the
 * scoring path is exercised deterministically — repeat arrivals, idempotent
 * re-syncs, the per-run pass-score override and the per-question breakdown.
 * The invitation path is exercised live against GoPhish, using throwaway
 * assets whose SMTP host cannot deliver, and recipients on `.invalid`.
 *
 * Everything is created under a throwaway entity (ZZQuizScore) and removed at
 * the end.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-quiz-scoring.php
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
use Pukat\Services\GoPhishService;
use Pukat\Services\PermissionRegistry;
use Pukat\Services\QuizPageSyncService;
use Pukat\Services\QuizScoringService;
use Pukat\Services\RiskScoringService;

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

$entity     = 'ZZQuizScore';
$suffix     = (string) time();
$role_slug  = 'pukat_smoke_quizscore';
$scoring    = new QuizScoringService();
$results_db = new QuizResultRepository();

$quiz_pages_table = $wpdb->prefix . 'pukat_quiz_pages';
$questions_table  = $wpdb->prefix . 'pukat_quiz_questions';
$results_table    = $wpdb->prefix . 'pukat_quiz_results';
$domains_table    = $wpdb->prefix . 'pukat_dynamic_domains';
$email_domains    = $wpdb->prefix . 'pukat_target_email_domains';

// ---------------------------------------------------------------------------
// Setup: a published quiz page with two active questions.
// ---------------------------------------------------------------------------
remove_role( $role_slug );
add_role( $role_slug, 'Smoke QuizScore', [ 'read' => true ] );
$role = get_role( $role_slug );
foreach ( [ 'post_sim.view', 'post_sim.manage', 'quiz_pages.view', 'quiz_pages.edit', 'quiz_pages.publish', 'quiz_pages.invite', 'domains.view' ] as $key ) {
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

$launch_url = 'http://localhost:8081';
$wpdb->insert( $domains_table, [
	'domain'               => 'zz-quizscore-' . $suffix . '.test',
	'base_landing_url'     => $launch_url,
	'type'                 => 'quiz',
	'environment'          => 'staging',
	'owner_entity'         => $entity,
	'authorization_status' => 'authorized',
	'status'               => 'active',
] );
$domain_id = (int) $wpdb->insert_id;

foreach ( [ [ 'answer_q1', 'report' ], [ 'answer_q2', 'skip' ] ] as [ $input, $correct ] ) {
	call( 'POST', '/pukat/v1/quiz/questions', [
		'question'   => 'Soal ' . $input,
		'input_name' => $input,
		'options'    => [
			[ 'label' => 'Salah', 'value' => 'wrong', 'correct' => false ],
			[ 'label' => 'Benar', 'value' => $correct, 'correct' => true ],
		],
	], $user_id );
}

$html = '<html><body><form method="post"><input type="hidden" name="rid" value="{{.RId}}">'
	. '<fieldset><input type="radio" name="answer_q1" value="wrong"><input type="radio" name="answer_q1" value="report"></fieldset>'
	. '<fieldset><input type="radio" name="answer_q2" value="wrong"><input type="radio" name="answer_q2" value="skip"></fieldset>'
	. '<button type="submit">Kirim</button></form></body></html>';

call( 'PUT', '/pukat/v1/quiz-page', [ 'html_body' => $html, 'launch_url' => $launch_url, 'thankyou_url' => 'https://intranet.example.test/thanks' ], $user_id );
[ , $body ] = call( 'POST', '/pukat/v1/quiz-page/publish', [], $user_id );
$page_id    = (int) ( $body['data']['id'] ?? 0 );
check( 'the quiz page is published with a 2-question snapshot', 2 === ( $body['data']['answer_key_count'] ?? 0 ), $failures );

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------
echo "\n-- grading submitted answers --\n";

$run_id = 90000 + ( (int) $suffix % 1000 );

/** Results payload shaped like the real §3.5.1 merge. */
$results_payload = static function ( array $events, array $recipients ): array {
	return [ 'status' => 'In progress', 'results' => $recipients, 'timeline' => $events ];
};

$recipients = [
	[ 'id' => 'rid-alpha', 'email' => 'alpha@example.invalid' ],
	[ 'id' => 'rid-beta', 'email' => 'beta@example.invalid' ],
];

$events = [
	// A simulation submission that must be ignored by the quiz grader.
	[ 'campaign_id' => 101, 'rid' => 'rid-alpha', 'message' => 'Submitted Data', 'time' => '2026-10-21T01:00:00Z', 'details' => '{"payload":{"email":["alpha@example.invalid"]}}' ],
	// Both answers right.
	[ 'campaign_id' => 202, 'rid' => 'rid-alpha', 'message' => 'Submitted Data (Quiz)', 'time' => '2026-10-21T02:00:00Z', 'details' => '{"payload":{"answer_q1":["report"],"answer_q2":["skip"],"lang":["id"]}}' ],
	// One of two right.
	[ 'campaign_id' => 202, 'rid' => 'rid-beta', 'message' => 'Submitted Data (Quiz)', 'time' => '2026-10-21T02:05:00Z', 'details' => '{"payload":{"answer_q1":["report"],"answer_q2":["wrong"]}}' ],
];

$outcome = $scoring->record_from_results( $results_payload( $events, $recipients ), [
	'entity'              => $entity,
	'campaign_run_id'     => $run_id,
	'gophish_campaign_id' => 101,
] );
check( 'both quiz submissions were graded, the simulation event ignored', 2 === $outcome['graded'] && 0 === $outcome['skipped'], $failures );

$rows = $results_db->list_for_run( $run_id );
check( 'one row per arrival was stored', 2 === count( $rows ), $failures );

$by_email = [];
foreach ( $rows as $row ) {
	$by_email[ (string) $row['target_email'] ] = $row;
}
check(
	'the full-marks submission scored 100 and passed',
	100 === (int) ( $by_email['alpha@example.invalid']['score'] ?? 0 )
		&& 1 === (int) ( $by_email['alpha@example.invalid']['passed'] ?? 0 )
		&& 2 === (int) ( $by_email['alpha@example.invalid']['question_count'] ?? 0 ),
	$failures
);
check(
	'the half-right submission scored 50 and failed at the default 70',
	50 === (int) ( $by_email['beta@example.invalid']['score'] ?? 0 )
		&& 0 === (int) ( $by_email['beta@example.invalid']['passed'] ?? 1 )
		&& 70 === (int) ( $by_email['beta@example.invalid']['pass_score_used'] ?? 0 ),
	$failures
);
check( 'the quiz page the snapshot came from is recorded', $page_id === (int) ( $by_email['alpha@example.invalid']['quiz_page_id'] ?? 0 ), $failures );
check( 'the downstream quiz campaign id is recorded, not the source one', 202 === (int) ( $by_email['alpha@example.invalid']['gophish_campaign_id'] ?? 0 ), $failures );

// Idempotency: the same results, graded again.
$again = $scoring->record_from_results( $results_payload( $events, $recipients ), [
	'entity'              => $entity,
	'campaign_run_id'     => $run_id,
	'gophish_campaign_id' => 101,
] );
check( 're-syncing grades the same submissions again', 2 === $again['graded'], $failures );
check( '...but adds no rows (upsert on the rid)', 2 === count( $results_db->list_for_run( $run_id ) ), $failures );

// A second arrival from the same person is its own row.
$recipients[] = [ 'id' => 'rid-beta-2', 'email' => 'beta@example.invalid' ];
$events[]     = [ 'campaign_id' => 202, 'rid' => 'rid-beta-2', 'message' => 'Submitted Data (Quiz)', 'time' => '2026-10-21T03:00:00Z', 'details' => '{"payload":{"answer_q1":["report"],"answer_q2":["skip"]}}' ];

$scoring->record_from_results( $results_payload( $events, $recipients ), [
	'entity'              => $entity,
	'campaign_run_id'     => $run_id,
	'gophish_campaign_id' => 101,
] );
$rows = $results_db->list_for_run( $run_id );
check( 'a second attempt by the same person is a separate row', 3 === count( $rows ), $failures );

// Risk scoring must use the latest attempt (beta improved to 100).
$risk  = new RiskScoringService();
$score = $risk->compute_and_store_for_campaign_run( $run_id, 'beta@example.invalid', [] );
// quiz contribution = 50 - score/2, so a latest attempt of 100 contributes 0.
check(
	'risk scoring takes the latest attempt, not the first',
	is_array( $score ) && 0 === (int) ( $score['quiz_score'] ?? -1 ),
	$failures
);

// Per-question breakdown keeps its own denominator per question.
$breakdown = $scoring->per_question_breakdown( $rows );
$by_input  = [];
foreach ( $breakdown as $entry ) {
	$by_input[ $entry['input_name'] ] = $entry;
}
check(
	'per-question analysis counts every answer to answer_q1',
	3 === ( $by_input['answer_q1']['asked'] ?? 0 ) && 3 === ( $by_input['answer_q1']['correct'] ?? 0 ),
	$failures
);
check(
	'per-question analysis shows answer_q2 was the one people got wrong',
	3 === ( $by_input['answer_q2']['asked'] ?? 0 ) && 1 === ( $by_input['answer_q2']['wrong'] ?? 0 ),
	$failures
);

// The per-run pass-score override.
$override = $scoring->record_from_results( $results_payload( $events, $recipients ), [
	'entity'              => $entity,
	'campaign_run_id'     => $run_id,
	'gophish_campaign_id' => 101,
	'pass_score_override' => 100,
] );
$rows     = $results_db->list_for_run( $run_id );
$failed   = array_filter( $rows, static fn ( array $r ): bool => 50 === (int) $r['score'] && empty( $r['passed'] ) && 100 === (int) $r['pass_score_used'] );
check( 'a per-run pass score of 100 is applied and recorded', 4 === $override['graded'] - 1 || count( $failed ) > 0, $failures );

// Editing the bank afterwards must not change a stored score.
$scores_before = array_column( $results_db->list_for_run( $run_id ), 'score', 'gophish_rid' );
$question_id   = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$questions_table} WHERE entity_name = %s AND input_name = %s", $entity, 'answer_q2' ) );
call( 'PUT', '/pukat/v1/quiz/questions/' . $question_id, [
	'options' => [
		[ 'label' => 'Salah', 'value' => 'wrong', 'correct' => true ],
		[ 'label' => 'Benar', 'value' => 'skip', 'correct' => false ],
	],
], $user_id );
$scores_after = array_column( $results_db->list_for_run( $run_id ), 'score', 'gophish_rid' );
check( 'flipping the answer key in the bank does not rewrite stored scores', $scores_before === $scores_after, $failures );

// The results endpoint.
[ $status, $body ] = call( 'GET', '/pukat/v1/quiz/results/202', [], $user_id );
check( 'the results endpoint summarises the graded rows', 200 === $status && 3 === (int) ( $body['data']['total'] ?? 0 ), $failures );
check( 'it carries the per-question breakdown', ! empty( $body['data']['per_question'] ), $failures );
check(
	'it never returns the raw answer payload',
	! array_key_exists( 'answers', (array) ( $body['data']['results'][0] ?? [] ) ),
	$failures
);

// ---------------------------------------------------------------------------
// Invitation (Pattern B)
// ---------------------------------------------------------------------------
echo "\n-- invitation --\n";

$gophish = new GoPhishService();
$live    = ! is_wp_error( $gophish->test_connection() );

[ $status ] = call( 'POST', '/pukat/v1/quiz/invite', [ 'targets' => [] ], $user_id );
check( 'an invitation with no recipients is refused (422)', 422 === $status, $failures );

[ $status, $body ] = call( 'POST', '/pukat/v1/quiz/invite', [
	'targets'       => [ [ 'email' => 'someone@example.invalid' ] ],
	'template_name' => 'pukat-quiz-tmpl-' . sanitize_title( $entity ),
	'smtp_name'     => 'whatever',
], $user_id );
check( "Pukat's own placeholder chain template is refused for an invitation", 422 === $status, $failures );

$tmpl_name = 'zz-quiz-invite-tmpl-' . $suffix;
$smtp_name = 'zz-quiz-invite-smtp-' . $suffix;
$campaign_id = 0;
$group_id    = 0;

if ( $live ) {
	$gophish->create_email_template( [
		'name'        => $tmpl_name,
		'subject'     => 'Kuis keamanan',
		'html'        => '<html><body><a href="{{.URL}}">Mulai kuis</a></body></html>',
		'text'        => '{{.URL}}',
		'attachments' => [],
	] );
	// localhost:25 is not listening in this stack, so nothing can actually
	// leave — and the recipients are on .invalid regardless.
	$gophish->create_sending_profile( [
		'name'               => $smtp_name,
		'interface_type'     => 'SMTP',
		'host'               => 'localhost:25',
		'from_address'       => 'noreply@example.com',
		'ignore_cert_errors' => true,
		'headers'            => [],
	] );

	[ $status, $body ] = call( 'POST', '/pukat/v1/quiz/invite', [
		'targets'       => [ [ 'email' => 'zz-invite-' . $suffix . '@example.invalid', 'first_name' => 'ZZ' ] ],
		'template_name' => $tmpl_name,
		'smtp_name'     => $smtp_name,
	], $user_id );
	check( 'an invitation with real assets is refused while no email domain is allow-listed', 422 === $status, $failures );

	// Allow-list the throwaway domain, then send for real.
	$wpdb->insert( $email_domains, [ 'entity_name' => $entity, 'domain' => 'example.invalid', 'status' => 'active' ] );

	[ $status, $body ] = call( 'POST', '/pukat/v1/quiz/invite', [
		'targets'       => [ [ 'email' => 'zz-invite-' . $suffix . '@example.invalid', 'first_name' => 'ZZ' ] ],
		'template_name' => $tmpl_name,
		'smtp_name'     => $smtp_name,
	], $user_id );
	check( 'the invitation campaign is created (201)', 201 === $status, $failures );
	$campaign_id = (int) ( $body['data']['gophish_campaign_id'] ?? 0 );
	check( 'it reports the campaign it created and the recipient count', $campaign_id > 0 && 1 === (int) ( $body['data']['recipients'] ?? 0 ), $failures );

	$campaign = $gophish->get_campaign( $campaign_id );
	check( 'the invitation is a quiz campaign that is NOT a master', ! is_wp_error( $campaign ) && 'quiz' === (string) ( $campaign['campaign_type'] ?? '' ) && empty( $campaign['is_master'] ), $failures );
	check( 'it uses the operator-chosen template, not the dummy', ! is_wp_error( $campaign ) && $tmpl_name === (string) ( $campaign['template']['name'] ?? '' ), $failures );
	check( 'it points at the entity quiz landing page', ! is_wp_error( $campaign ) && ( new QuizPageSyncService() )->page_name( $entity, $page_id ) === (string) ( $campaign['page']['name'] ?? '' ), $failures );

	[ $status ] = call( 'POST', '/pukat/v1/quiz/invite', [
		'targets'       => [ [ 'email' => 'outsider@not-allowed.test' ] ],
		'template_name' => $tmpl_name,
		'smtp_name'     => $smtp_name,
	], $user_id );
	check( 'a recipient outside the entity allow-list is refused (422)', 422 === $status, $failures );

	// An invitation's results carry no campaign_run_id.
	$invite_events = [
		[ 'campaign_id' => $campaign_id, 'rid' => 'rid-invite', 'message' => 'Submitted Data (Quiz)', 'time' => '2026-10-21T04:00:00Z', 'details' => '{"payload":{"answer_q1":["report"],"answer_q2":["skip"]}}' ],
	];
	$scoring->record_from_results(
		$results_payload( $invite_events, [ [ 'id' => 'rid-invite', 'email' => 'zz-invite-' . $suffix . '@example.invalid' ] ] ),
		[ 'entity' => $entity, 'gophish_campaign_id' => $campaign_id ]
	);
	$invite_rows = $results_db->list_for_campaign( $campaign_id );
	check( 'an invitation submission is graded with no campaign_run_id', 1 === count( $invite_rows ) && null === $invite_rows[0]['campaign_run_id'], $failures );
} else {
	echo "SKIP — GoPhish unreachable, invitation write path not exercised\n";
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
echo "\n-- cleanup --\n";
wp_set_current_user( 0 );

if ( $live ) {
	if ( $campaign_id > 0 ) {
		$gophish->delete_campaign( $campaign_id );
	}
	foreach ( (array) $gophish->get_groups() as $g ) {
		if ( str_starts_with( (string) ( $g['name'] ?? '' ), 'pukat-quiz-invite-' . sanitize_title( $entity ) ) ) {
			$gophish->delete_group( (int) $g['id'] );
		}
	}
	foreach ( (array) $gophish->get_campaigns( [ 'is_master' => true, 'campaign_type' => 'quiz' ] ) as $c ) {
		if ( ( new QuizPageSyncService() )->master_name( $entity ) === (string) ( $c['name'] ?? '' ) ) {
			$gophish->delete_campaign( (int) $c['id'], true );
		}
	}
	foreach ( (array) $gophish->get_landing_pages() as $p ) {
		if ( ( new QuizPageSyncService() )->page_name( $entity ) === (string) ( $p['name'] ?? '' ) ) {
			$gophish->delete_landing_page( (int) $p['id'] );
		}
	}
	foreach ( (array) $gophish->get_email_templates() as $tpl ) {
		if ( in_array( (string) ( $tpl['name'] ?? '' ), [ $tmpl_name, 'pukat-quiz-tmpl-' . sanitize_title( $entity ) ], true ) ) {
			$gophish->delete_email_template( (int) $tpl['id'] );
		}
	}
	foreach ( (array) $gophish->get_sending_profiles() as $prof ) {
		if ( in_array( (string) ( $prof['name'] ?? '' ), [ $smtp_name, 'pukat-quiz-smtp-' . sanitize_title( $entity ) ], true ) ) {
			$gophish->delete_sending_profile( (int) $prof['id'] );
		}
	}
}

$wpdb->delete( $domains_table, [ 'id' => $domain_id ] );
$wpdb->delete( $email_domains, [ 'entity_name' => $entity ] );
$wpdb->delete( $quiz_pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $questions_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $results_table, [ 'entity_name' => $entity ] );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}pukat_risk_scores WHERE campaign_run_id = %d", $run_id ) );
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->prefix}pukat_audit_logs WHERE user_id = %d OR object_type = 'quiz_page' AND object_id = %d", $user_id, $page_id ) );
wp_delete_user( $user_id );
remove_role( $role_slug );

$leftover = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$results_table} WHERE entity_name = %s", $entity ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$quiz_pages_table} WHERE entity_name = %s", $entity ) )
	+ (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$questions_table} WHERE entity_name = %s", $entity ) );
check( 'all throwaway rows, users and roles removed', 0 === $leftover && ! get_userdata( $user_id ) && ! get_role( $role_slug ), $failures );

if ( $failures ) {
	fwrite( STDERR, "\n" . count( $failures ) . " check(s) failed.\n" );
	exit( 1 );
}

echo "\nAll checks passed.\n";
