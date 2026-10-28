<?php
/**
 * Quiz page HTML inspection against the entity's answer key.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * The only safeguard standing between free-form quiz HTML and answers that
 * cannot be graded (docs/PRD_QUIZ_MODULE.md FR-6).
 *
 * Deliberately has no database or GoPhish dependency so it can be unit tested
 * and run as a dry-run while the operator is still typing. Parsing uses
 * DOMDocument rather than a regex: operator HTML is pasted from elsewhere and
 * routinely not well-formed, and a regex would silently miss inputs inside
 * comments, attributes spread over lines, or uppercase tag names. A parse that
 * fails is reported as a problem — never treated as "nothing found, so fine".
 */
class QuizPageLinter {

	/** Only inputs under this prefix are graded; anything else is the operator's own field. */
	public const INPUT_PREFIX = 'answer_';

	/**
	 * Inspect page HTML against an answer key.
	 *
	 * @param string                                                         $html       Page HTML (draft or published).
	 * @param array<string, array{question_id?: int, correct?: array<int, string>}> $answer_key Keyed by input name.
	 * @return array{ok: bool, issues: array<int, array{code: string, input_name: string, message: string}>, inputs: array<int, string>}
	 */
	public function inspect( string $html, array $answer_key ): array {
		$issues = [];

		$scan = $this->scan_inputs( $html );
		foreach ( $scan['errors'] as $message ) {
			$issues[] = [ 'code' => 'unparsable_html', 'input_name' => '', 'message' => $message ];
		}

		if ( ! $scan['has_post_form'] ) {
			$issues[] = [
				'code'       => 'missing_form',
				'input_name' => '',
				'message'    => __( 'The page needs a <form method="post"> — without it GoPhish never receives any answer.', 'pukat' ),
			];
		}

		foreach ( $scan['duplicates'] as $input_name ) {
			$issues[] = [
				'code'       => 'duplicate_input',
				'input_name' => $input_name,
				'message'    => sprintf(
					/* translators: %s: input name, e.g. answer_q1. */
					__( '"%s" appears on more than one question. A bilingual page must share one set of inputs between the Indonesian and English labels — duplicating the whole question block, name attribute included, makes the answer ambiguous.', 'pukat' ),
					$input_name
				),
			];
		}

		foreach ( $scan['names'] as $input_name ) {
			if ( ! isset( $answer_key[ $input_name ] ) ) {
				$issues[] = [
					'code'       => 'input_without_key',
					'input_name' => $input_name,
					'message'    => sprintf(
						/* translators: %s: input name, e.g. answer_q1. */
						__( '"%s" is in the page but has no question in the bank, so its answer cannot be graded.', 'pukat' ),
						$input_name
					),
				];
			}
		}

		foreach ( array_keys( $answer_key ) as $input_name ) {
			if ( ! in_array( $input_name, $scan['names'], true ) ) {
				$issues[] = [
					'code'       => 'key_without_input',
					'input_name' => (string) $input_name,
					'message'    => sprintf(
						/* translators: %s: input name, e.g. answer_q1. */
						__( 'The active question "%s" is missing from the page, so nobody can ever score 100%%.', 'pukat' ),
						$input_name
					),
				];
			}
		}

		return [
			'ok'     => empty( $issues ),
			'issues' => $issues,
			'inputs' => $scan['names'],
		];
	}

	/**
	 * Collect graded input names, duplicates, and whether a POST form exists.
	 *
	 * @return array{names: array<int, string>, duplicates: array<int, string>, has_post_form: bool, errors: array<int, string>}
	 */
	private function scan_inputs( string $html ): array {
		$empty = [ 'names' => [], 'duplicates' => [], 'has_post_form' => false, 'errors' => [] ];

		if ( '' === trim( $html ) ) {
			return $empty;
		}

		if ( ! class_exists( '\DOMDocument' ) ) {
			$empty['errors'][] = __( 'The HTML could not be inspected on this server (DOM extension missing).', 'pukat' );
			return $empty;
		}

		$previous = libxml_use_internal_errors( true );
		$document = new \DOMDocument();
		// Operator HTML is pasted from elsewhere and may be a fragment, so
		// loadHTML's own complaints are expected and not reported as issues —
		// only a total failure to parse is.
		$loaded = $document->loadHTML( '<?xml encoding="utf-8" ?>' . $html );
		libxml_clear_errors();
		libxml_use_internal_errors( $previous );

		if ( ! $loaded ) {
			$empty['errors'][] = __( 'The page HTML could not be parsed, so its answers cannot be verified. Fix the markup and check again.', 'pukat' );
			return $empty;
		}

		$has_post_form = false;
		foreach ( $document->getElementsByTagName( 'form' ) as $form ) {
			if ( 'post' === strtolower( trim( $form->getAttribute( 'method' ) ) ) ) {
				$has_post_form = true;
				break;
			}
		}

		$counts = [];
		foreach ( [ 'input', 'select', 'textarea' ] as $tag ) {
			foreach ( $document->getElementsByTagName( $tag ) as $element ) {
				$name = trim( $element->getAttribute( 'name' ) );
				if ( '' === $name || 0 !== strpos( $name, self::INPUT_PREFIX ) ) {
					continue;
				}

				// Radio groups and checkbox groups legitimately repeat one name
				// across their options, so they count once.
				$type    = strtolower( trim( $element->getAttribute( 'type' ) ) );
				$grouped = 'input' === $tag && in_array( $type, [ 'radio', 'checkbox' ], true );
				// getNodePath(), not spl_object_id(): every parentNode access
				// hands back a fresh PHP wrapper object, so object ids are not
				// stable identities for DOM nodes and would count one radio
				// group as several.
				$fragment = $grouped ? $this->group_key( $element ) : (string) $element->getNodePath();

				$counts[ $name ][ $fragment ] = true;
			}
		}

		$names      = array_keys( $counts );
		$duplicates = [];
		foreach ( $counts as $name => $occurrences ) {
			if ( count( $occurrences ) > 1 ) {
				$duplicates[] = (string) $name;
			}
		}

		return [
			'names'         => array_map( 'strval', $names ),
			'duplicates'    => $duplicates,
			'has_post_form' => $has_post_form,
			'errors'        => [],
		];
	}

	/**
	 * Identify which question block a grouped input (radio/checkbox) belongs
	 * to, so repeating one name across its own options is not a duplicate,
	 * while repeating it in a second block is. The nearest enclosing fieldset,
	 * list item, form, or body acts as the block.
	 *
	 * Known limit, accepted deliberately: `div` is NOT a block boundary here,
	 * because plenty of hand-written markup wraps each radio option in its own
	 * div and that would read as a duplicate. The cost is that a radio group
	 * duplicated across two plain divs inside one form is not flagged. That
	 * case still submits a single value, so it does not corrupt grading, and
	 * the generated starter emits one fieldset per question (FR-4) so a
	 * duplicated starter block IS caught. Text, select, and textarea inputs are
	 * compared per element instead — duplicating those really does produce an
	 * array of values, so they are always flagged.
	 */
	private function group_key( \DOMElement $element ): string {
		$block = [ 'fieldset', 'li', 'form', 'body' ];

		for ( $node = $element->parentNode; $node instanceof \DOMElement; $node = $node->parentNode ) {
			if ( in_array( strtolower( $node->nodeName ), $block, true ) ) {
				return (string) $node->getNodePath();
			}
		}

		return 'root';
	}
}
