<?php
/**
 * Quiz Builder v2 smoke — admin quiz overview (QuizPageService::overview()).
 *
 * Verifies the cross-entity overview: every quiz from every entity, its
 * template name, and local usage (participants / attempts / runs) from recorded
 * results. GoPhish chain linkage is best-effort and not asserted here (covered
 * by smoke-quiz-chain). Throwaway entities, cleaned up.
 *
 *   php wp-content/plugins/Pukat/tools/smoke-quiz-overview.php
 *
 * @package Pukat
 */

declare(strict_types=1);

require dirname( __DIR__, 4 ) . '/wp-load.php';

use Pukat\Services\QuizPageService;

global $wpdb;

$failures = [];
function check( string $label, bool $ok, array &$failures ): void {
	echo '[' . ( $ok ? 'PASS' : 'FAIL' ) . "] {$label}\n";
	if ( ! $ok ) {
		$failures[] = $label;
	}
}

$pages_table = $wpdb->prefix . 'pukat_quiz_pages';
$tpl_table   = $wpdb->prefix . 'pukat_quiz_templates';
$res_table   = $wpdb->prefix . 'pukat_quiz_results';
$e1          = 'ZZOverviewA';
$e2          = 'ZZOverviewB';

foreach ( [ $e1, $e2 ] as $e ) {
	$wpdb->delete( $pages_table, [ 'entity_name' => $e ] );
	$wpdb->delete( $res_table, [ 'entity_name' => $e ] );
}
$wpdb->delete( $tpl_table, [ 'name' => 'ZZOverviewTpl' ] );

// A template + a quiz per entity, both referencing it.
$wpdb->insert( $tpl_table, [ 'name' => 'ZZOverviewTpl', 'html_body' => '{{pukat:questions}}', 'placeholders' => '[]', 'is_active' => 1 ] );
$tpl_id = (int) $wpdb->insert_id;

$wpdb->insert( $pages_table, [ 'entity_name' => $e1, 'title' => 'Quiz A1', 'template_id' => $tpl_id, 'html_body' => '<form method="post"></form>', 'status' => 'published', 'is_default_followup' => 1, 'gophish_master_id' => 0 ] );
$q1 = (int) $wpdb->insert_id;
$wpdb->insert( $pages_table, [ 'entity_name' => $e2, 'title' => 'Quiz B1', 'template_id' => $tpl_id, 'html_body' => '<form method="post"></form>', 'status' => 'draft', 'is_default_followup' => 1 ] );
$q2 = (int) $wpdb->insert_id;

// Results for Q1: two people, one of them twice (3 attempts, 2 participants),
// across two runs.
$mk = function ( $rid, $email, $run ) use ( $wpdb, $res_table, $e1, $q1 ) {
	$wpdb->insert( $res_table, [
		'entity_name' => $e1, 'campaign_id' => 10, 'campaign_run_id' => $run, 'gophish_rid' => $rid,
		'gophish_campaign_id' => 10, 'quiz_page_id' => $q1, 'user_id' => 0, 'target_email' => $email,
		'score' => 100, 'question_count' => 1, 'correct_count' => 1, 'passed' => 1, 'pass_score_used' => 70,
		'answers' => '{}', 'completed_at' => '2026-10-22 00:00:00',
	] );
};
$mk( 'r1', 'a@x.invalid', 101 );
$mk( 'r2', 'b@x.invalid', 101 );
$mk( 'r3', 'a@x.invalid', 102 );

wp_set_current_user( 1 );
$overview = ( new QuizPageService() )->overview();
$rows     = $overview['quizzes'] ?? [];
$byId     = [];
foreach ( $rows as $r ) {
	$byId[ (int) $r['id'] ] = $r;
}

check( 'overview returns both throwaway quizzes', isset( $byId[ $q1 ], $byId[ $q2 ] ), $failures );
check( 'quiz shows its entity', ( $byId[ $q1 ]['entity_name'] ?? '' ) === $e1 && ( $byId[ $q2 ]['entity_name'] ?? '' ) === $e2, $failures );
check( 'quiz shows the template name', ( $byId[ $q1 ]['template_name'] ?? '' ) === 'ZZOverviewTpl', $failures );
check( 'Q1 participants = 2 (distinct emails)', 2 === (int) ( $byId[ $q1 ]['participants'] ?? 0 ), $failures );
check( 'Q1 attempts = 3 (rows)', 3 === (int) ( $byId[ $q1 ]['attempts'] ?? 0 ), $failures );
check( 'Q1 runs = 2 (distinct runs)', 2 === (int) ( $byId[ $q1 ]['runs'] ?? 0 ), $failures );
check( 'Q2 has no results yet', 0 === (int) ( $byId[ $q2 ]['participants'] ?? -1 ), $failures );
check( 'linkage shape present (count + list)', array_key_exists( 'linkage_count', $byId[ $q1 ] ) && array_key_exists( 'linked_campaigns', $byId[ $q1 ] ), $failures );

// Cleanup.
foreach ( [ $e1, $e2 ] as $e ) {
	$wpdb->delete( $pages_table, [ 'entity_name' => $e ] );
	$wpdb->delete( $res_table, [ 'entity_name' => $e ] );
}
$wpdb->delete( $tpl_table, [ 'id' => $tpl_id ] );
echo "-- cleanup done --\n";

echo "\n" . ( $failures ? count( $failures ) . " FAILURE(S)\n" : "ALL PASS\n" );
exit( $failures ? 1 : 0 );
