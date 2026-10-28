<?php
/**
 * Quiz Builder v2 smoke — Fase 2b (many-per-entity quiz pages).
 *
 * Exercises QuizPageService's new structural surface: an entity owning several
 * quizzes, create/list, the single default-followup invariant, and delete
 * promoting a new default. Runs entirely on a throwaway entity through the
 * service layer (no GoPhish): the chain hooks are no-ops here because nothing
 * is published/synced, which is what we want to assert at this layer.
 *
 * Usage from the WordPress container:
 *   php wp-content/plugins/Pukat/tools/smoke-quiz-builder.php
 *
 * @package Pukat
 */

declare(strict_types=1);

$wp_load = dirname( __DIR__, 4 ) . '/wp-load.php';
if ( ! file_exists( $wp_load ) ) {
	fwrite( STDERR, "wp-load.php was not found.\n" );
	exit( 1 );
}
require $wp_load;

use Pukat\Repositories\QuizPageRepository;
use Pukat\Services\QuizPageService;

global $wpdb;

$failures = [];
function check( string $label, bool $ok, array &$failures ): void {
	echo '[' . ( $ok ? 'PASS' : 'FAIL' ) . "] {$label}\n";
	if ( ! $ok ) {
		$failures[] = $label;
	}
}

$entity = 'ZZBuilderEntity';
$admin  = 1; // user id 1 is an administrator in dev.
wp_set_current_user( $admin );

$svc  = new QuizPageService();
$repo = new QuizPageRepository();

// Start clean.
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'entity_name' => $entity ] );

// --- create two quizzes -----------------------------------------------------
$q1 = $svc->create( [ 'entity' => $entity, 'title' => 'Quiz One' ], $admin );
$q2 = $svc->create( [ 'entity' => $entity, 'title' => 'Quiz Two' ], $admin );
check( 'create first quiz', is_array( $q1 ) && ! empty( $q1['id'] ), $failures );
check( 'create second quiz', is_array( $q2 ) && ! empty( $q2['id'] ), $failures );
check( 'first quiz is default-followup', is_array( $q1 ) && true === $q1['is_default_followup'], $failures );
check( 'second quiz is NOT default', is_array( $q2 ) && false === $q2['is_default_followup'], $failures );

// --- list shows both --------------------------------------------------------
$list = $svc->list( [ 'entity' => $entity ] );
check( 'list returns two quizzes', is_array( $list ) && 2 === count( $list['quizzes'] ), $failures );

// --- get by id --------------------------------------------------------------
$got = $svc->get( [ 'entity' => $entity, 'id' => (int) $q2['id'] ] );
check( 'get by id returns that quiz', is_array( $got ) && (int) $got['id'] === (int) $q2['id'], $failures );

// --- set default switches the flag (exactly one default) --------------------
$svc->set_default( [ 'entity' => $entity, 'id' => (int) $q2['id'] ], $admin );
$defaults = array_filter( $repo->list_for_entity( $entity ), fn ( $r ) => (int) $r['is_default_followup'] === 1 );
check( 'exactly one default after switch', 1 === count( $defaults ), $failures );
check( 'the new default is quiz two', 1 === count( $defaults ) && (int) array_values( $defaults )[0]['id'] === (int) $q2['id'], $failures );

// --- save by id updates only that quiz --------------------------------------
$svc->save( [ 'entity' => $entity, 'id' => (int) $q1['id'], 'html_body' => '<form method="post">one</form>', 'title' => 'Quiz One Edited' ], $admin );
$reload = $repo->find( (int) $q1['id'] );
check( 'save by id updated title', 'Quiz One Edited' === (string) $reload['title'], $failures );
$other = $repo->find( (int) $q2['id'] );
check( 'other quiz untouched by id-scoped save', 'Quiz Two' === (string) $other['title'], $failures );

// --- id from another entity is rejected -------------------------------------
$foreign = $svc->get( [ 'entity' => $entity, 'id' => 999999999 ] );
check( 'unknown id falls back to empty shell (id null)', is_array( $foreign ) && null === $foreign['id'], $failures );
$foreign_save = $svc->save( [ 'entity' => $entity, 'id' => 999999999, 'html_body' => '<form method="post"></form>' ], $admin );
check( 'save with foreign/unknown id is 404', is_wp_error( $foreign_save ) && 'not_found' === $foreign_save->get_error_code(), $failures );

// --- delete default promotes the remaining quiz -----------------------------
$svc->delete( [ 'entity' => $entity, 'id' => (int) $q2['id'] ], $admin );
$remaining = $repo->list_for_entity( $entity );
check( 'one quiz remains after delete', 1 === count( $remaining ), $failures );
check( 'remaining quiz promoted to default', 1 === count( $remaining ) && (int) $remaining[0]['is_default_followup'] === 1, $failures );
check( 'the promoted quiz is quiz one', 1 === count( $remaining ) && (int) $remaining[0]['id'] === (int) $q1['id'], $failures );

// --- cleanup ----------------------------------------------------------------
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'entity_name' => $entity ] );
echo "-- cleanup --\n";
check( 'all throwaway quizzes removed', 0 === $repo->count_for_entity( $entity ), $failures );

echo "\n" . ( $failures ? count( $failures ) . " FAILURE(S)\n" : "ALL PASS\n" );
exit( $failures ? 1 : 0 );
