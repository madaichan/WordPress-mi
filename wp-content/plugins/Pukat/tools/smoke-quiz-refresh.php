<?php
/**
 * Quiz on-demand refresh smoke (QuizRefreshService).
 *
 * Proves the quiz module can pull fresh answers itself, without going through
 * the monitoring results sync:
 *
 * - only in-flight, quiz-linked runs of the entity are polled;
 * - arrivals are graded, and grading the same payload twice adds no row;
 * - reach is counted the way monitoring counts submitted_data/quiz_completed;
 * - a second refresh inside the throttle window makes no GoPhish call;
 * - `metrics_json` and the risk-score table are never written.
 *
 * GoPhish is stubbed, so this touches no network. Throwaway entity.
 *
 *   php wp-content/plugins/Pukat/tools/smoke-quiz-refresh.php
 *
 * @package Pukat
 */

declare(strict_types=1);

require dirname( __DIR__, 4 ) . '/wp-load.php';

use Pukat\Services\GoPhishService;
use Pukat\Services\QuizRefreshService;

global $wpdb;

$failures = [];

function check( string $label, bool $condition, array &$failures ): void {
	echo ( $condition ? 'PASS' : 'FAIL' ) . " — {$label}\n";
	if ( ! $condition ) {
		$failures[] = $label;
	}
}

/** GoPhish stand-in: answers from a fixture and counts how often it was asked. */
final class SmokeGoPhish extends GoPhishService {

	/** @var array<int, int> */
	public array $calls = [];

	/** @var array<int, array<string, mixed>> */
	private array $fixtures;

	/** @param array<int, array<string, mixed>> $fixtures Keyed by GoPhish campaign id. */
	public function __construct( array $fixtures ) {
		parent::__construct();
		$this->fixtures = $fixtures;
	}

	public function get_campaign_results( int $id ): array|WP_Error {
		$this->calls[ $id ] = ( $this->calls[ $id ] ?? 0 ) + 1;

		return $this->fixtures[ $id ] ?? new WP_Error( 'not_found', 'No such campaign' );
	}
}

$entity        = 'ZZQuizRefresh';
$pages_table   = $wpdb->prefix . 'pukat_quiz_pages';
$results_table = $wpdb->prefix . 'pukat_quiz_results';
$runs_table    = $wpdb->prefix . 'pukat_campaign_runs';
$risk_table    = $wpdb->prefix . 'pukat_risk_scores';

// Clean slate.
$wpdb->delete( $pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $results_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $runs_table, [ 'entity' => $entity ] );
delete_transient( 'pukat_quiz_refresh_' . md5( strtolower( $entity ) ) );

// --- a published quiz to grade against --------------------------------------
$wpdb->insert( $pages_table, [
	'entity_name'          => $entity,
	'title'                => 'Refresh smoke quiz',
	'html_body'            => '<form method="post"></form>',
	'published_html'       => '<form method="post"></form>',
	'published_answer_key' => (string) wp_json_encode( [
		'answer_q1' => [ 'question_id' => 7101, 'correct' => [ 'report' ] ],
	] ),
	'published_pass_score' => 70,
	'status'               => 'published',
	'is_default_followup'  => 1,
	'gophish_master_id'    => 70001,
] );

// --- three runs: only the first may be polled -------------------------------
$run_defs = [
	[ 'name' => 'In-flight quiz run', 'status' => 'running',   'campaign' => 7001, 'quiz' => true,  'pass' => 60 ],
	[ 'name' => 'Finished quiz run',  'status' => 'completed', 'campaign' => 7002, 'quiz' => true,  'pass' => null ],
	[ 'name' => 'In-flight no quiz',  'status' => 'running',   'campaign' => 7003, 'quiz' => false, 'pass' => null ],
];
$run_ids = [];
foreach ( $run_defs as $def ) {
	$wpdb->insert( $runs_table, [
		'playbook_master_id'  => 0,
		'name'                => $def['name'],
		'entity'              => $entity,
		'status'              => $def['status'],
		'launched_at'         => '2026-10-25 01:00:00',
		'gophish_campaign_id' => $def['campaign'],
		'metrics_json'        => (string) wp_json_encode( [ 'stats' => [ 'submitted_data' => 2, 'quiz_completed' => 0 ] ] ),
		'follow_up_json'      => (string) wp_json_encode( [
			'quiz_enabled'      => $def['quiz'],
			'education_enabled' => false,
			'quiz_pass_score'   => $def['pass'],
		] ),
	] );
	$run_ids[ $def['name'] ] = (int) $wpdb->insert_id;
}
$metrics_before = $wpdb->get_var( $wpdb->prepare( "SELECT metrics_json FROM {$runs_table} WHERE id = %d", $run_ids['In-flight quiz run'] ) );
$risk_before    = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$risk_table}" );

// --- the fixture: two reached the chain, one finished the quiz --------------
// A third target never submitted, so it is in neither number.
$fixture = [
	7001 => [
		'status'   => 'In progress',
		'results'  => [
			[ 'id' => 'ref-1', 'email' => 'one@example.invalid',   'status' => 'Submitted Data' ],
			[ 'id' => 'ref-2', 'email' => 'two@example.invalid',   'status' => 'Submitted Data' ],
			[ 'id' => 'ref-3', 'email' => 'three@example.invalid', 'status' => 'Email Opened' ],
		],
		'timeline' => [
			[ 'email' => 'one@example.invalid', 'rid' => 'ref-1', 'message' => 'Submitted Data', 'time' => '2026-10-25T02:00:00Z' ],
			[ 'email' => 'two@example.invalid', 'rid' => 'ref-2', 'message' => 'Submitted Data', 'time' => '2026-10-25T02:01:00Z' ],
			[
				'email'      => 'one@example.invalid',
				'rid'        => 'ref-1',
				'campaign_id' => 70001,
				'message'    => 'Submitted Data (Quiz)',
				'time'       => '2026-10-25T02:05:00Z',
				'details'    => '{"payload":{"answer_q1":["report"]}}',
			],
		],
	],
	// Deliberately available but must never be asked for.
	7002 => [ 'status' => 'Completed', 'results' => [], 'timeline' => [] ],
	7003 => [ 'status' => 'In progress', 'results' => [], 'timeline' => [] ],
];

$gophish = new SmokeGoPhish( $fixture );
$service = new QuizRefreshService( $gophish );

echo "\n-- first refresh --\n";
$first = $service->refresh_entity( $entity );

check( 'refresh ran', true === $first['refreshed'], $failures );
check( 'exactly one run polled', 1 === (int) $first['polled'], $failures );
check( 'only the in-flight quiz run was asked', [ 7001 => 1 ] === $gophish->calls, $failures );
check( 'a finished run is never polled', ! array_key_exists( 7002, $gophish->calls ), $failures );
check( 'a run without quiz follow-up is never polled', ! array_key_exists( 7003, $gophish->calls ), $failures );
check( 'one arrival graded', 1 === (int) $first['graded'], $failures );
check( 'no warnings', [] === $first['warnings'], $failures );

$reach = $first['reach'][ $run_ids['In-flight quiz run'] ] ?? [];
check( 'reach counts both who submitted the form', 2 === (int) ( $reach['reached'] ?? -1 ), $failures );
check( 'completion counts only the quiz answer', 1 === (int) ( $reach['completed'] ?? -1 ), $failures );

$rows = $wpdb->get_results( $wpdb->prepare( "SELECT gophish_rid, score, passed, pass_score_used FROM {$results_table} WHERE entity_name = %s", $entity ), ARRAY_A );
check( 'one graded row stored', 1 === count( $rows ), $failures );
check( 'the answer scored 100', 100 === (int) ( $rows[0]['score'] ?? -1 ), $failures );
check( "the run's own pass score override was used", 60 === (int) ( $rows[0]['pass_score_used'] ?? -1 ), $failures );

echo "\n-- throttle --\n";
$second = $service->refresh_entity( $entity );

check( 'a second refresh inside the window is throttled', true === $second['throttled'] && false === $second['refreshed'], $failures );
check( 'and makes no further GoPhish call', [ 7001 => 1 ] === $gophish->calls, $failures );
check( 'it still reports when the data was refreshed', '' !== (string) $second['refreshed_at'], $failures );
check( 'and how long until the next one', $second['retry_in'] > 0 && $second['retry_in'] <= QuizRefreshService::THROTTLE_SECONDS, $failures );
check( 'and reuses the reach it already has', $second['reach'] === $first['reach'], $failures );

echo "\n-- idempotence --\n";
delete_transient( 'pukat_quiz_refresh_' . md5( strtolower( $entity ) ) );
$third = $service->refresh_entity( $entity );
$count = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$results_table} WHERE entity_name = %s", $entity ) );

check( 'refreshing again re-reads GoPhish', 2 === (int) ( $gophish->calls[7001] ?? 0 ), $failures );
check( 'but adds no duplicate row', 1 === $count, $failures );
check( 'and reports the same reach', $third['reach'] === $first['reach'], $failures );

echo "\n-- monitoring left alone --\n";
$metrics_after = $wpdb->get_var( $wpdb->prepare( "SELECT metrics_json FROM {$runs_table} WHERE id = %d", $run_ids['In-flight quiz run'] ) );
$status_after  = $wpdb->get_var( $wpdb->prepare( "SELECT status FROM {$runs_table} WHERE id = %d", $run_ids['In-flight quiz run'] ) );

check( "metrics_json is untouched", $metrics_before === $metrics_after, $failures );
check( "the run's status is untouched", 'running' === (string) $status_after, $failures );
check( 'no risk score rows were written', $risk_before === (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$risk_table}" ), $failures );

echo "\n-- unknown entity --\n";
$none = ( new QuizRefreshService( new SmokeGoPhish( [] ) ) )->refresh_entity( '' );
check( 'an empty entity refreshes nothing', false === $none['refreshed'] && 0 === (int) $none['polled'], $failures );

// --- cleanup ----------------------------------------------------------------
delete_transient( 'pukat_quiz_refresh_' . md5( strtolower( $entity ) ) );
$wpdb->delete( $pages_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $results_table, [ 'entity_name' => $entity ] );
$wpdb->delete( $runs_table, [ 'entity' => $entity ] );
echo "\n-- cleanup done --\n";

echo "\n" . ( $failures ? count( $failures ) . " FAILURE(S)\n" : "ALL PASS\n" );
exit( $failures ? 1 : 0 );
