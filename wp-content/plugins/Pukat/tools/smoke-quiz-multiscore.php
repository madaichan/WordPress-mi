<?php
/**
 * Quiz Builder v2 smoke — Fase 4 (per-quiz scoring with many quizzes).
 *
 * Proves QuizScoringService grades each submission against the quiz it was
 * actually submitted to — resolved by the downstream quiz master id on the
 * event — when an entity owns several published quizzes with different answer
 * keys. An event to an unknown campaign falls back to the entity default.
 *
 * Pure local test: it inserts two published quiz rows (with snapshots + fake
 * master ids) directly, never touches GoPhish, and cleans up. Throwaway entity.
 *
 *   php wp-content/plugins/Pukat/tools/smoke-quiz-multiscore.php
 *
 * @package Pukat
 */

declare(strict_types=1);

require dirname( __DIR__, 4 ) . '/wp-load.php';

use Pukat\Services\QuizScoringService;

global $wpdb;

$failures = [];
function check( string $label, bool $ok, array &$failures ): void {
	echo '[' . ( $ok ? 'PASS' : 'FAIL' ) . "] {$label}\n";
	if ( ! $ok ) {
		$failures[] = $label;
	}
}

$entity      = 'ZZMultiScore';
$pages_table = $wpdb->prefix . 'pukat_quiz_pages';
$res_table   = $wpdb->prefix . 'pukat_quiz_results';

// Clean slate.
$wpdb->delete( $pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $res_table, [ 'entity_name' => $entity ] );

// Two published quizzes with different answer keys and distinct master ids.
$keyA = [ 'answer_q1' => [ 'question_id' => 1, 'correct' => [ 'a' ] ] ];
$keyB = [ 'answer_q1' => [ 'question_id' => 2, 'correct' => [ 'b' ] ] ];
$wpdb->insert( $pages_table, [
	'entity_name'          => $entity,
	'title'                => 'Quiz A (default)',
	'html_body'            => '<form method="post"></form>',
	'published_html'       => '<form method="post"></form>',
	'published_answer_key' => (string) wp_json_encode( $keyA ),
	'published_pass_score' => 70,
	'status'               => 'published',
	'is_default_followup'  => 1,
	'gophish_master_id'    => 50001,
] );
$quiz_a = (int) $wpdb->insert_id;
$wpdb->insert( $pages_table, [
	'entity_name'          => $entity,
	'title'                => 'Quiz B',
	'html_body'            => '<form method="post"></form>',
	'published_html'       => '<form method="post"></form>',
	'published_answer_key' => (string) wp_json_encode( $keyB ),
	'published_pass_score' => 70,
	'status'               => 'published',
	'is_default_followup'  => 0,
	'gophish_master_id'    => 50002,
] );
$quiz_b = (int) $wpdb->insert_id;

// Timeline: one arrival into each quiz master, plus one into an unknown
// campaign that must fall back to the default (Quiz A). Each answers "a".
$events = [
	[ 'campaign_id' => 50001, 'rid' => 'rid-a', 'message' => 'Submitted Data (Quiz)', 'time' => '2026-10-22T01:00:00Z', 'details' => '{"payload":{"answer_q1":["a"]}}' ],
	[ 'campaign_id' => 50002, 'rid' => 'rid-b', 'message' => 'Submitted Data (Quiz)', 'time' => '2026-10-22T01:05:00Z', 'details' => '{"payload":{"answer_q1":["a"]}}' ],
	[ 'campaign_id' => 88888, 'rid' => 'rid-x', 'message' => 'Submitted Data (Quiz)', 'time' => '2026-10-22T01:10:00Z', 'details' => '{"payload":{"answer_q1":["a"]}}' ],
];
$results = [
	'status'   => 'In progress',
	'results'  => [
		[ 'id' => 'rid-a', 'email' => 'a@example.invalid' ],
		[ 'id' => 'rid-b', 'email' => 'b@example.invalid' ],
		[ 'id' => 'rid-x', 'email' => 'x@example.invalid' ],
	],
	'timeline' => $events,
];

$outcome = ( new QuizScoringService() )->record_from_results( $results, [
	'entity'              => $entity,
	'gophish_campaign_id' => 101,
] );
check( 'three arrivals graded', 3 === (int) $outcome['graded'], $failures );

$rows = [];
foreach ( $wpdb->get_results( $wpdb->prepare( "SELECT gophish_rid, quiz_page_id, score, gophish_campaign_id FROM {$res_table} WHERE entity_name = %s", $entity ), ARRAY_A ) as $r ) {
	$rows[ $r['gophish_rid'] ] = $r;
}

// Quiz A wants "a" → rid-a correct (100), recorded against quiz A.
check( 'rid-a graded against Quiz A', (int) ( $rows['rid-a']['quiz_page_id'] ?? 0 ) === $quiz_a, $failures );
check( 'rid-a scored 100 (A wanted "a")', 100 === (int) ( $rows['rid-a']['score'] ?? -1 ), $failures );

// Quiz B wants "b" → rid-b answered "a" → wrong (0), recorded against quiz B.
check( 'rid-b graded against Quiz B', (int) ( $rows['rid-b']['quiz_page_id'] ?? 0 ) === $quiz_b, $failures );
check( 'rid-b scored 0 (B wanted "b", got "a")', 0 === (int) ( $rows['rid-b']['score'] ?? -1 ), $failures );

// Unknown campaign → default quiz (A) → "a" correct (100).
check( 'rid-x fell back to the default quiz (A)', (int) ( $rows['rid-x']['quiz_page_id'] ?? 0 ) === $quiz_a, $failures );
check( 'rid-x scored 100 via the default snapshot', 100 === (int) ( $rows['rid-x']['score'] ?? -1 ), $failures );

// --- cleanup ----------------------------------------------------------------
$wpdb->delete( $pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $res_table, [ 'entity_name' => $entity ] );
echo "-- cleanup done --\n";

echo "\n" . ( $failures ? count( $failures ) . " FAILURE(S)\n" : "ALL PASS\n" );
exit( $failures ? 1 : 0 );
