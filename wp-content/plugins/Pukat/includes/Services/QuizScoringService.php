<?php
/**
 * Grade quiz answers captured by GoPhish.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\QuizPageRepository;
use Pukat\Repositories\QuizResultRepository;

/**
 * GoPhish captures quiz answers but never scores them
 * (docs/api_campaignnew.md §7), so grading happens here.
 *
 * The answers arrive for free: `GET /api/campaigns/{id}/results` already folds
 * `Submitted Data (Quiz)` events from downstream masters into the source
 * campaign's timeline, with the rid rewritten to the originating entry
 * (§3.5.1). So this service needs no GoPhish call of its own — it grades the
 * timeline the results sync already holds.
 *
 * Answers are graded against the answer key **snapshotted when the page was
 * published**, not the current question bank, so editing a question later
 * never rewrites a score somebody already earned (PRD §5.3).
 */
class QuizScoringService {

	private QuizPageRepository $pages;
	private QuizResultRepository $results;
	private QuizPageService $page_service;

	public function __construct(
		?QuizPageRepository $pages = null,
		?QuizResultRepository $results = null,
		?QuizPageService $page_service = null
	) {
		$this->pages        = $pages ?? new QuizPageRepository();
		$this->results      = $results ?? new QuizResultRepository();
		$this->page_service = $page_service ?? new QuizPageService();
	}

	/**
	 * Grade one submitted payload against an answer key. Pure: no database, no
	 * network, no clock — everything it needs is in its arguments.
	 *
	 * GoPhish posts form fields as arrays, and a question may have more than one
	 * correct option, so answers are compared as sets. Fields that are not in
	 * the key (`rid`, `lang`, anything the operator added) are ignored and do
	 * not count toward the total.
	 *
	 * @param array<string, mixed>                                                  $payload    Submitted form fields.
	 * @param array<string, array{question_id?: int, correct?: array<int, string>}> $answer_key Snapshot, keyed by input name.
	 * @return array{score: int, passed: bool, question_count: int, correct_count: int, per_question: array<string, bool>}
	 */
	public function score_payload( array $payload, array $answer_key, int $pass_score ): array {
		$total        = 0;
		$correct      = 0;
		$per_question = [];

		foreach ( $answer_key as $input_name => $definition ) {
			++$total;

			$expected = array_map( 'strval', (array) ( $definition['correct'] ?? [] ) );
			$given    = $this->normalize_answer( $payload[ $input_name ] ?? null );

			sort( $expected );
			sort( $given );

			$is_correct = ! empty( $expected ) && $expected === $given;
			if ( $is_correct ) {
				++$correct;
			}
			$per_question[ (string) $input_name ] = $is_correct;
		}

		$score = $total > 0 ? (int) round( ( $correct / $total ) * 100 ) : 0;

		return [
			'score'          => $score,
			'passed'         => $total > 0 && $score >= $pass_score,
			'question_count' => $total,
			'correct_count'  => $correct,
			'per_question'   => $per_question,
		];
	}

	/**
	 * Grade and record every `Submitted Data (Quiz)` event in one campaign's
	 * results. Idempotent: the repository upserts on the rid, so re-syncing a
	 * campaign updates rows instead of appending them.
	 *
	 * Known limit, by design: rows already recorded keep the score they were
	 * given. If a page were republished with a different key mid-campaign, old
	 * arrivals are not re-graded — which is exactly the situation the edit lock
	 * (FR-11) prevents from arising.
	 *
	 * @param array<string, mixed> $results GoPhish campaign results payload.
	 * @param array{entity: string, campaign_run_id?: int, gophish_campaign_id?: int, pass_score_override?: int|null} $context
	 * @return array{graded: int, skipped: int, reason?: string}
	 */
	public function record_from_results( array $results, array $context ): array {
		$entity = trim( (string) ( $context['entity'] ?? '' ) );
		if ( '' === $entity ) {
			return [ 'graded' => 0, 'skipped' => 0, 'reason' => 'no_entity' ];
		}

		// Build the quiz resolver. With many quizzes per entity (Quiz Builder
		// v2) a submission is graded against the quiz it was actually submitted
		// to: the event carries the downstream quiz master id. An explicit
		// context quiz_page_id (an invite campaign knows its quiz) wins; then
		// the event's master id; then the entity default (single-quiz/legacy).
		$published      = $this->pages->published_rows_for_entity( $entity );
		$by_master      = [];
		foreach ( $published as $row ) {
			if ( ! empty( $row['gophish_master_id'] ) ) {
				$by_master[ (int) $row['gophish_master_id'] ] = $row;
			}
		}
		$default_page = $this->pages->find_default_for_entity( $entity );
		$context_page = ! empty( $context['quiz_page_id'] ) ? $this->pages->find( (int) $context['quiz_page_id'] ) : null;

		if ( empty( $published ) && null === $context_page ) {
			// Nothing published for this entity, so nothing can be graded. Not
			// an error: most runs have no quiz at all.
			return [ 'graded' => 0, 'skipped' => 0, 'reason' => 'no_published_answer_key' ];
		}

		// Per-invocation cache: the pass-score override can differ between calls
		// on a reused service instance, so never carry a resolved context over.
		$this->grading_cache = [];

		$override      = $context['pass_score_override'] ?? null;
		$emails_by_rid = $this->emails_by_rid( $results );
		$run_id        = (int) ( $context['campaign_run_id'] ?? 0 );

		$graded  = 0;
		$skipped = 0;
		$scored_page_ids = [];

		foreach ( (array) ( $results['timeline'] ?? [] ) as $event ) {
			if ( QuizEventTypes::QUIZ !== (string) ( $event['message'] ?? '' ) ) {
				continue;
			}

			$rid = trim( (string) ( $event['rid'] ?? '' ) );
			if ( '' === $rid ) {
				++$skipped;
				continue;
			}

			$payload = $this->payload_from_event( $event );
			if ( null === $payload ) {
				++$skipped;
				continue;
			}

			// Resolve which quiz this submission belongs to, then its snapshot.
			$event_campaign = (int) ( $event['campaign_id'] ?? ( $context['gophish_campaign_id'] ?? 0 ) );
			$page           = $context_page ?? ( $by_master[ $event_campaign ] ?? $default_page );
			if ( ! $page ) {
				++$skipped;
				continue;
			}
			$grading = $this->grading_context_for_page( $page, $override );
			if ( null === $grading ) {
				// This quiz has no usable snapshot — cannot grade its arrivals.
				++$skipped;
				continue;
			}
			[ $answer_key, $pass_score ] = $grading;

			$scored = $this->score_payload( $payload, $answer_key, $pass_score );
			$email  = sanitize_email( (string) ( $emails_by_rid[ $rid ] ?? '' ) );
			$user   = $email ? get_user_by( 'email', $email ) : false;

			$row_id = $this->results->upsert( [
				'entity_name'         => $entity,
				'campaign_id'         => (int) ( $context['gophish_campaign_id'] ?? 0 ),
				'campaign_run_id'     => $run_id > 0 ? $run_id : null,
				'gophish_rid'         => $rid,
				// The event keeps the downstream campaign id, which is the quiz
				// campaign the answer was actually submitted to.
				'gophish_campaign_id' => $event_campaign,
				'quiz_page_id'        => (int) $page['id'],
				'user_id'             => $user ? (int) $user->ID : 0,
				'target_email'        => $email,
				'score'               => $scored['score'],
				'question_count'      => $scored['question_count'],
				'correct_count'       => $scored['correct_count'],
				'passed'              => $scored['passed'] ? 1 : 0,
				'pass_score_used'     => $pass_score,
				'answers'             => (string) wp_json_encode( $this->sanitize_payload( $payload ) ),
				'completed_at'        => $this->event_time( $event ),
			] );

			if ( $row_id > 0 ) {
				++$graded;
				$scored_page_ids[ (int) $page['id'] ] = true;
			} else {
				++$skipped;
			}
		}

		if ( $graded > 0 ) {
			// One audit entry per sync, not per row — a 200-target campaign
			// would otherwise flood the log.
			AuditLogService::log(
				'quiz.scored',
				[
					'entity_name'     => $entity,
					'campaign_run_id' => $run_id,
					'graded'          => $graded,
					'skipped'         => $skipped,
					// Many quizzes may be graded in one sync (Quiz Builder v2),
					// so the log records how many distinct quizzes, not one score.
					'quizzes'         => count( $scored_page_ids ),
				],
				null,
				'quiz_page',
				(int) ( $default_page['id'] ?? 0 )
			);
		}

		return [ 'graded' => $graded, 'skipped' => $skipped ];
	}

	/**
	 * How often each question was answered wrongly across a set of result rows,
	 * each with its own denominator — a question added later was simply not
	 * asked of everyone (PRD FR-16).
	 *
	 * `question_id` rides along so a caller can show the question's own text
	 * instead of the bare input name — the answer key already carries it, so
	 * this costs no extra query.
	 *
	 * @param array<int, array<string, mixed>> $rows Result rows (needing only `id`).
	 * @return array<int, array{input_name: string, question_id: int, asked: int, correct: int, wrong: int}>
	 */
	public function per_question_breakdown( array $rows ): array {
		$ids      = array_map( static fn ( array $r ): int => (int) ( $r['id'] ?? 0 ), $rows );
		$answers  = $this->results->answers_for( $ids );
		$by_input = [];

		foreach ( $rows as $row ) {
			$row_id  = (int) ( $row['id'] ?? 0 );
			$payload = json_decode( (string) ( $answers[ $row_id ] ?? '' ), true );
			if ( ! is_array( $payload ) ) {
				continue;
			}

			$page       = (int) ( $row['quiz_page_id'] ?? 0 );
			$answer_key = $this->answer_key_for_page( $page );

			foreach ( $answer_key as $input_name => $definition ) {
				$expected = array_map( 'strval', (array) ( $definition['correct'] ?? [] ) );
				$given    = $this->normalize_answer( $payload[ $input_name ] ?? null );
				sort( $expected );
				sort( $given );

				if ( ! isset( $by_input[ $input_name ] ) ) {
					$by_input[ $input_name ] = [
						'input_name'  => (string) $input_name,
						'question_id' => (int) ( $definition['question_id'] ?? 0 ),
						'asked'       => 0,
						'correct'     => 0,
						'wrong'       => 0,
					];
				}
				++$by_input[ $input_name ]['asked'];
				if ( ! empty( $expected ) && $expected === $given ) {
					++$by_input[ $input_name ]['correct'];
				} else {
					++$by_input[ $input_name ]['wrong'];
				}
			}
		}

		ksort( $by_input );

		return array_values( $by_input );
	}

	/** @var array<int, array{0: array<string, mixed>, 1: int}|null> Per-page grading context cache. */
	private array $grading_cache = [];

	/**
	 * The answer key + effective pass score for a quiz row, or null when the
	 * row has no usable published snapshot. Cached per page id so a 200-arrival
	 * campaign decodes each quiz's snapshot once.
	 *
	 * @param array<string, mixed> $row
	 * @return array{0: array<string, mixed>, 1: int}|null
	 */
	private function grading_context_for_page( array $row, ?int $override ): ?array {
		$page_id = (int) ( $row['id'] ?? 0 );
		if ( array_key_exists( $page_id, $this->grading_cache ) ) {
			return $this->grading_cache[ $page_id ];
		}

		$answer_key = json_decode( (string) ( $row['published_answer_key'] ?? '' ), true );
		if ( ! is_array( $answer_key ) || ! $answer_key ) {
			return $this->grading_cache[ $page_id ] = null;
		}

		$pass_score = $this->page_service->effective_pass_score(
			$override,
			// The snapshot wins over the current per-entity setting: it is what
			// was in force when the page went live.
			[ 'pass_score' => $row['published_pass_score'] ?? $row['pass_score'] ?? null ]
		);

		return $this->grading_cache[ $page_id ] = [ $answer_key, $pass_score ];
	}

	/** @var array<int, array<string, mixed>> Answer-key snapshots already loaded. */
	private array $answer_key_cache = [];

	/**
	 * @return array<string, array<string, mixed>>
	 */
	private function answer_key_for_page( int $page_id ): array {
		if ( array_key_exists( $page_id, $this->answer_key_cache ) ) {
			return $this->answer_key_cache[ $page_id ];
		}

		$key = [];
		if ( $page_id > 0 ) {
			global $wpdb;
			$snapshot = $wpdb->get_var(
				$wpdb->prepare( "SELECT published_answer_key FROM {$wpdb->prefix}pukat_quiz_pages WHERE id = %d", $page_id )
			);
			$decoded  = json_decode( (string) $snapshot, true );
			$key      = is_array( $decoded ) ? $decoded : [];
		}

		$this->answer_key_cache[ $page_id ] = $key;

		return $key;
	}

	/**
	 * Submitted values as a flat list of strings. GoPhish posts each field as an
	 * array; a single value and a one-element array must grade the same.
	 *
	 * @param mixed $raw
	 * @return array<int, string>
	 */
	private function normalize_answer( mixed $raw ): array {
		if ( null === $raw ) {
			return [];
		}

		$values = is_array( $raw ) ? $raw : [ $raw ];
		$out    = [];
		foreach ( $values as $value ) {
			if ( is_array( $value ) ) {
				continue;
			}
			$value = trim( (string) $value );
			if ( '' !== $value ) {
				$out[] = $value;
			}
		}

		return array_values( array_unique( $out ) );
	}

	/**
	 * The submitted fields inside a timeline event's `details`, or null when it
	 * holds nothing usable. Target submissions are untrusted input, so anything
	 * unexpected is skipped rather than guessed at.
	 *
	 * @param array<string, mixed> $event
	 * @return array<string, mixed>|null
	 */
	private function payload_from_event( array $event ): ?array {
		$details = $event['details'] ?? '';
		$decoded = is_array( $details ) ? $details : json_decode( (string) $details, true );
		if ( ! is_array( $decoded ) ) {
			return null;
		}

		$payload = $decoded['payload'] ?? null;

		return is_array( $payload ) ? $payload : null;
	}

	/**
	 * Keep the stored payload to scalar strings. It comes from a public form and
	 * is shown in reports, so it is sanitized before it is ever persisted.
	 *
	 * @param array<string, mixed> $payload
	 * @return array<string, array<int, string>>
	 */
	private function sanitize_payload( array $payload ): array {
		$clean = [];
		foreach ( $payload as $field => $value ) {
			$name = sanitize_text_field( (string) $field );
			if ( '' === $name ) {
				continue;
			}
			$clean[ $name ] = array_map(
				static fn ( string $v ): string => sanitize_text_field( $v ),
				$this->normalize_answer( $value )
			);
		}

		return $clean;
	}

	/**
	 * rid => email for every recipient entry in a results payload.
	 *
	 * @param array<string, mixed> $results
	 * @return array<string, string>
	 */
	private function emails_by_rid( array $results ): array {
		$map = [];
		foreach ( (array) ( $results['results'] ?? [] ) as $entry ) {
			$rid = trim( (string) ( $entry['id'] ?? '' ) );
			if ( '' !== $rid ) {
				$map[ $rid ] = (string) ( $entry['email'] ?? '' );
			}
		}

		return $map;
	}

	/**
	 * @param array<string, mixed> $event
	 */
	private function event_time( array $event ): string {
		$time = strtotime( (string) ( $event['time'] ?? '' ) );

		return $time ? gmdate( 'Y-m-d H:i:s', $time ) : current_time( 'mysql', true );
	}
}
