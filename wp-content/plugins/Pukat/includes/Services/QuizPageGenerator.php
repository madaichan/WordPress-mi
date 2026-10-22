<?php
/**
 * Quiz page HTML generator (Quiz Builder v2).
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * Turns an admin template plus the operator's choices into the quiz page HTML
 * (docs/PRD_QUIZ_MODULE.md §13). Pure and dependency-free so it can be unit
 * tested and run in a preview:
 *
 *   {{pukat:<key>}}      replaced by the operator's field value (escaped).
 *   {{pukat:questions}}  replaced by one rendered block per selected question,
 *                        in the given order.
 *
 * The rendered blocks are exactly what QuizPageLinter accepts and what the
 * answer key is built from: each question is one <fieldset> (so the linter
 * reads it as a single input group) carrying an input whose `name` is the
 * question's input_name.
 */
class QuizPageGenerator {

	/** The repeating question slot, shared with QuizTemplateService. */
	public const QUESTION_SLOT = QuizTemplateService::QUESTION_SLOT;

	/**
	 * Generate the page HTML.
	 *
	 * @param string                                   $template_html The template shell.
	 * @param array<string, mixed>                     $field_values  Placeholder key => value.
	 * @param array<int, array<string, mixed>>         $questions     Selected question rows, in display order.
	 */
	public function generate( string $template_html, array $field_values, array $questions ): string {
		$blocks = [];
		$number = 0;
		foreach ( $questions as $question ) {
			$blocks[] = $this->render_question_block( $question, ++$number );
		}
		$rendered = implode( "\n", $blocks );

		// Fill the question slot first so a placeholder value can never contain
		// a literal slot marker and smuggle question markup in.
		$html = str_replace( self::QUESTION_SLOT, $rendered, $template_html );

		return $this->substitute_placeholders( $html, $field_values );
	}

	/**
	 * Replace every {{pukat:<key>}} marker (other than the question slot) with
	 * the operator's escaped value; an unknown key resolves to empty so no
	 * marker is ever left behind on the live page.
	 *
	 * @param array<string, mixed> $field_values
	 */
	private function substitute_placeholders( string $html, array $field_values ): string {
		return (string) preg_replace_callback(
			'/\{\{pukat:([a-z0-9_]+)\}\}/',
			static function ( array $m ) use ( $field_values ): string {
				if ( 'questions' === $m[1] ) {
					return $m[0]; // Should already be filled; leave untouched.
				}
				$value = $field_values[ $m[1] ] ?? '';

				return esc_html( (string) $value );
			},
			$html
		);
	}

	/**
	 * One question's HTML block. Uses checkboxes when the question has more
	 * than one correct option (the answer is graded as a set), radios
	 * otherwise — both grouped in a <fieldset> so repeating the name across a
	 * question's own options is not read as a duplicate.
	 *
	 * @param array<string, mixed> $question A question bank row.
	 */
	public function render_question_block( array $question, int $number ): string {
		$input_name = esc_attr( (string) ( $question['input_name'] ?? '' ) );
		$text       = esc_html( (string) ( $question['question'] ?? '' ) );
		$options    = $this->decode_options( $question['options'] ?? [] );

		$correct_count = 0;
		foreach ( $options as $option ) {
			if ( ! empty( $option['correct'] ) ) {
				++$correct_count;
			}
		}
		$type = $correct_count > 1 ? 'checkbox' : 'radio';

		$choices = [];
		foreach ( $options as $option ) {
			$value   = esc_attr( (string) ( $option['value'] ?? '' ) );
			$label   = esc_html( (string) ( $option['label'] ?? $option['value'] ?? '' ) );
			$req     = 'radio' === $type ? ' required' : '';
			$choices[] = sprintf(
				'      <label class="pukat-choice"><input type="%1$s" name="%2$s" value="%3$s"%4$s /> <span>%5$s</span></label>',
				$type,
				$input_name,
				$value,
				$req,
				$label
			);
		}

		return implode( "\n", [
			sprintf( '    <fieldset class="pukat-question" data-qid="%d">', (int) ( $question['id'] ?? 0 ) ),
			sprintf( '      <legend><span class="pukat-q-number">%d</span> %s</legend>', $number, $text ),
			implode( "\n", $choices ),
			'    </fieldset>',
		] );
	}

	/**
	 * @param mixed $raw JSON string or already-decoded array of options.
	 * @return array<int, array<string, mixed>>
	 */
	private function decode_options( $raw ): array {
		if ( is_string( $raw ) ) {
			$raw = json_decode( $raw, true );
		}

		return is_array( $raw ) ? $raw : [];
	}
}
