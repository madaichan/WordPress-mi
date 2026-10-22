<?php
/**
 * Graded quiz result database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_quiz_results` — one row per graded arrival
 * (docs/PRD_QUIZ_MODULE.md §7.3).
 *
 * Idempotency lives here. Re-syncing a campaign replays the same submissions,
 * so every write goes through upsert() keyed on the rid: `(campaign_run_id,
 * gophish_rid)` for a chained arrival, and `(gophish_campaign_id,
 * gophish_rid)` for one that came from a standalone invite campaign, which has
 * no run. MySQL does not treat NULLs as duplicates, which is why the two keys
 * both exist rather than one covering both cases.
 */
class QuizResultRepository {

	/** Columns a list returns — never SELECT *, and never the raw answers payload. */
	private const LIST_FIELDS = 'id, entity_name, campaign_id, campaign_run_id, gophish_rid, gophish_campaign_id, quiz_page_id, user_id, target_email, score, question_count, correct_count, passed, pass_score_used, completed_at, created_at';

	/**
	 * @return array<string, mixed>|null
	 */
	public function find_by_run_rid( int $campaign_run_id, string $rid ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$this->table()} WHERE campaign_run_id = %d AND gophish_rid = %s",
				$campaign_run_id,
				$rid
			),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function find_by_campaign_rid( int $gophish_campaign_id, string $rid ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$this->table()} WHERE gophish_campaign_id = %d AND gophish_rid = %s",
				$gophish_campaign_id,
				$rid
			),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Insert a graded arrival, or update the one already recorded for this rid.
	 *
	 * @param array<string, mixed> $data
	 * @return int The row id, or 0 on failure.
	 */
	public function upsert( array $data ): int {
		global $wpdb;

		$rid     = (string) ( $data['gophish_rid'] ?? '' );
		$run_id  = (int) ( $data['campaign_run_id'] ?? 0 );
		$camp_id = (int) ( $data['gophish_campaign_id'] ?? 0 );

		$existing = null;
		if ( '' !== $rid ) {
			$existing = $run_id > 0
				? $this->find_by_run_rid( $run_id, $rid )
				: ( $camp_id > 0 ? $this->find_by_campaign_rid( $camp_id, $rid ) : null );
		}

		if ( $existing ) {
			$wpdb->update( $this->table(), $data, [ 'id' => (int) $existing['id'] ] );
			return (int) $existing['id'];
		}

		return false === $wpdb->insert( $this->table(), $data ) ? 0 : (int) $wpdb->insert_id;
	}

	/**
	 * Every graded arrival for one Campaign Run, newest first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function list_for_run( int $campaign_run_id ): array {
		global $wpdb;

		return $wpdb->get_results(
			$wpdb->prepare(
				'SELECT ' . self::LIST_FIELDS . " FROM {$this->table()}
				WHERE campaign_run_id = %d
				ORDER BY completed_at DESC, id DESC",
				$campaign_run_id
			),
			ARRAY_A
		) ?: [];
	}

	/**
	 * Every graded arrival for one GoPhish campaign (a quiz master or an invite
	 * campaign), newest first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function list_for_campaign( int $gophish_campaign_id ): array {
		global $wpdb;

		return $wpdb->get_results(
			$wpdb->prepare(
				'SELECT ' . self::LIST_FIELDS . " FROM {$this->table()}
				WHERE gophish_campaign_id = %d OR campaign_id = %d
				ORDER BY completed_at DESC, id DESC",
				$gophish_campaign_id,
				$gophish_campaign_id
			),
			ARRAY_A
		) ?: [];
	}

	/**
	 * Graded arrivals for one entity, newest first, capped so a report page
	 * cannot ask for an unbounded table.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function list_for_entity( string $entity_name, int $limit = 200 ): array {
		global $wpdb;

		$limit = min( max( $limit, 1 ), 500 );

		return $wpdb->get_results(
			$wpdb->prepare(
				'SELECT ' . self::LIST_FIELDS . " FROM {$this->table()}
				WHERE LOWER(entity_name) = LOWER(%s)
				ORDER BY completed_at DESC, id DESC
				LIMIT %d",
				$entity_name,
				$limit
			),
			ARRAY_A
		) ?: [];
	}

	/**
	 * The stored answer payloads behind a set of result rows, keyed by row id.
	 * Kept out of the list queries on purpose — per-question analysis is the
	 * only reader, and a summary table has no business carrying each person's
	 * raw submission.
	 *
	 * @param array<int, int> $ids
	 * @return array<int, string>
	 */
	public function answers_for( array $ids ): array {
		global $wpdb;

		$ids = array_values( array_filter( array_map( 'intval', $ids ) ) );
		if ( ! $ids ) {
			return [];
		}

		$placeholders = implode( ', ', array_fill( 0, count( $ids ), '%d' ) );
		$rows         = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, answers FROM {$this->table()} WHERE id IN ({$placeholders})", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- placeholders built from an int count
				...$ids
			),
			ARRAY_A
		) ?: [];

		$out = [];
		foreach ( $rows as $row ) {
			$out[ (int) $row['id'] ] = (string) ( $row['answers'] ?? '' );
		}

		return $out;
	}

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_quiz_results';
	}
}
