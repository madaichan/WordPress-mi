<?php
/**
 * Quiz Builder v2 smoke — Fase 3 (HTML generator + per-quiz answer key).
 *
 * Proves that a template-backed quiz generates its html_body from the template
 * shell + placeholder values + selected questions, that the linter passes the
 * generated markup, and that the answer key is derived from the quiz's SELECTED
 * questions (not the whole active bank). Legacy (no-template) quizzes still use
 * the entity-wide active key.
 *
 * Pure local test — it never publishes or touches GoPhish (that path is
 * covered by smoke-quiz-gophish/chain). Throwaway entity + template, cleaned up.
 *
 *   php wp-content/plugins/Pukat/tools/smoke-quiz-generator.php
 *
 * @package Pukat
 */

declare(strict_types=1);

require dirname( __DIR__, 4 ) . '/wp-load.php';

use Pukat\Repositories\QuizPageRepository;
use Pukat\Services\QuizPageService;
use Pukat\Services\QuizQuestionService;
use Pukat\Services\QuizTemplateService;

global $wpdb;

$failures = [];
function check( string $label, bool $ok, array &$failures ): void {
	echo '[' . ( $ok ? 'PASS' : 'FAIL' ) . "] {$label}\n";
	if ( ! $ok ) {
		$failures[] = $label;
	}
}

$entity = 'ZZGenEntity';
wp_set_current_user( 1 );

$questions = new QuizQuestionService();
$templates = new QuizTemplateService();
$pages     = new QuizPageService();
$repo      = new QuizPageRepository();

// Clean slate.
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'entity_name' => $entity ] );
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_questions', [ 'entity_name' => $entity ] );

// --- bank: three active questions -------------------------------------------
$ids = [];
foreach ( [ 'q1', 'q2', 'q3' ] as $n ) {
	$q = $questions->create( [
		'entity'     => $entity,
		'question'   => "Pertanyaan {$n}?",
		'input_name' => "answer_{$n}",
		'options'    => [
			[ 'label' => 'Benar', 'value' => 'a', 'correct' => true ],
			[ 'label' => 'Salah', 'value' => 'b', 'correct' => false ],
		],
	], 1 );
	if ( is_array( $q ) ) {
		$ids[ $n ] = (int) $q['id'];
	}
}
check( 'bank has three questions', 3 === count( $ids ), $failures );

// --- template ---------------------------------------------------------------
$tpl = $templates->create( [
	'name'         => 'ZZGenTpl',
	'html_body'    => '<html><body><h1>{{pukat:heading}}</h1><form method="post"><input type="hidden" name="rid" value="{{.RId}}" />{{pukat:questions}}<button type="submit">Kirim</button></form></body></html>',
	'placeholders' => [ [ 'key' => 'heading', 'label' => 'Heading', 'type' => 'text', 'required' => true ] ],
], 1 );
check( 'template created', is_array( $tpl ) && ! empty( $tpl['id'] ), $failures );
$template_id = is_array( $tpl ) ? (int) $tpl['id'] : 0;

// --- template-backed quiz: select only q1 + q3 ------------------------------
$quiz = $pages->create( [ 'entity' => $entity, 'title' => 'Gen Quiz', 'template_id' => $template_id ], 1 );
check( 'quiz created with template', is_array( $quiz ) && (int) $quiz['template_id'] === $template_id, $failures );
$quiz_id = is_array( $quiz ) ? (int) $quiz['id'] : 0;

$saved = $pages->save( [
	'entity'                => $entity,
	'id'                    => $quiz_id,
	'template_id'           => $template_id,
	'field_values'          => [ 'heading' => 'Kuis Keamanan' ],
	'selected_question_ids' => [ $ids['q1'], $ids['q3'] ],
], 1 );
check( 'save returns generated page', is_array( $saved ), $failures );

$html = is_array( $saved ) ? (string) $saved['html_body'] : '';
check( 'placeholder {{pukat:heading}} substituted', str_contains( $html, 'Kuis Keamanan' ) && ! str_contains( $html, '{{pukat:heading}}' ), $failures );
check( 'question slot replaced (no marker left)', ! str_contains( $html, '{{pukat:questions}}' ), $failures );
check( 'GoPhish {{.RId}} token preserved', str_contains( $html, '{{.RId}}' ), $failures );
check( 'selected q1 input rendered', str_contains( $html, 'name="answer_q1"' ), $failures );
check( 'selected q3 input rendered', str_contains( $html, 'name="answer_q3"' ), $failures );
check( 'unselected q2 input NOT rendered', ! str_contains( $html, 'name="answer_q2"' ), $failures );
check( 'two fieldsets rendered', 2 === substr_count( $html, '<fieldset class="pukat-question"' ), $failures );

// --- answer key is the SELECTED set, not the whole active bank --------------
check( 'answer key counts only selected (2 of 3)', is_array( $saved ) && 2 === (int) $saved['answer_key_count'], $failures );
check( 'linter passes the generated page', is_array( $saved ) && ! empty( $saved['linter']['ok'] ), $failures );

// --- validate agrees --------------------------------------------------------
$val = $pages->validate( [ 'entity' => $entity, 'id' => $quiz_id ] );
check( 'validate linter ok', is_array( $val ) && ! empty( $val['linter']['ok'] ), $failures );

// --- selection order is preserved -------------------------------------------
$reload = $repo->find( $quiz_id );
$stored = json_decode( (string) $reload['selected_question_ids_json'], true );
check( 'stored selection equals [q1,q3] in order', [ $ids['q1'], $ids['q3'] ] === array_map( 'intval', (array) $stored ), $failures );

// --- legacy (no template) quiz still uses the whole active bank -------------
// On a separate entity with no template quiz, a no-id save creates a legacy
// (hand-written, template_id NULL) page whose key is the entire active bank.
$legacy_entity = 'ZZGenLegacy';
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'entity_name' => $legacy_entity ] );
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_questions', [ 'entity_name' => $legacy_entity ] );
foreach ( [ 'q1', 'q2', 'q3' ] as $n ) {
	$questions->create( [
		'entity'     => $legacy_entity,
		'question'   => "L {$n}?",
		'input_name' => "answer_{$n}",
		'options'    => [ [ 'label' => 'B', 'value' => 'a', 'correct' => true ], [ 'label' => 'S', 'value' => 'b', 'correct' => false ] ],
	], 1 );
}
$legacy = $pages->save( [ 'entity' => $legacy_entity, 'html_body' => '<form method="post"><fieldset><input type="radio" name="answer_q1" value="a"></fieldset><fieldset><input type="radio" name="answer_q2" value="a"></fieldset><fieldset><input type="radio" name="answer_q3" value="a"></fieldset></form>' ], 1 );
check( 'legacy quiz key counts all 3 active', is_array( $legacy ) && 3 === (int) $legacy['answer_key_count'], $failures );
check( 'legacy quiz has no template_id', is_array( $legacy ) && null === $legacy['template_id'], $failures );

// --- cleanup ----------------------------------------------------------------
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'entity_name' => $entity ] );
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_questions', [ 'entity_name' => $entity ] );
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'entity_name' => $legacy_entity ] );
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_questions', [ 'entity_name' => $legacy_entity ] );
if ( $template_id ) {
	$wpdb->delete( $wpdb->prefix . 'pukat_quiz_templates', [ 'id' => $template_id ] );
}
echo "-- cleanup done --\n";

echo "\n" . ( $failures ? count( $failures ) . " FAILURE(S)\n" : "ALL PASS\n" );
exit( $failures ? 1 : 0 );
