<?php
/**
 * Quiz page database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_quiz_pages`. An entity may own several quizzes (Quiz
 * Builder v2); one may be flagged is_default_followup, which is the quiz the
 * education -> quiz chain uses. Matched to entities by string, like every
 * other entity-scoped table.
 */
class QuizPageRepository {

	/** List columns for the builder's quiz list — never the large html_body. */
	private const LIST_FIELDS = 'id, entity_name, title, template_id, is_default_followup, status, gophish_page_id, gophish_master_id, synced_at, updated_at, published_at';

	/**
	 * A single quiz by id.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find( int $id ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->table()} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * The entity's quizzes (metadata only), newest first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function list_for_entity( string $entity_name ): array {
		global $wpdb;

		return $wpdb->get_results(
			$wpdb->prepare(
				'SELECT ' . self::LIST_FIELDS . " FROM {$this->table()} WHERE LOWER(entity_name) = LOWER(%s) ORDER BY is_default_followup DESC, id DESC",
				$entity_name
			),
			ARRAY_A
		) ?: [];
	}

	/**
	 * Every published quiz of an entity (full rows, with the answer-key
	 * snapshot) — so scoring can grade each submission against the quiz it was
	 * actually submitted to (Quiz Builder v2).
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function published_rows_for_entity( string $entity_name ): array {
		global $wpdb;

		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$this->table()} WHERE LOWER(entity_name) = LOWER(%s) AND status = 'published'",
				$entity_name
			),
			ARRAY_A
		) ?: [];
	}

	public function count_for_entity( string $entity_name ): int {
		global $wpdb;

		return (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$this->table()} WHERE LOWER(entity_name) = LOWER(%s)", $entity_name )
		);
	}

	/**
	 * The entity's default-followup quiz — the one the education -> quiz chain
	 * uses (PRD §13.9). Deterministic: the flagged row if any, otherwise the
	 * lowest id, so legacy single-quiz entities resolve to their only row.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_default_for_entity( string $entity_name ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$this->table()} WHERE LOWER(entity_name) = LOWER(%s) ORDER BY is_default_followup DESC, id ASC LIMIT 1",
				$entity_name
			),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Clear the default flag on an entity's quizzes, optionally except one —
	 * used to keep a single default per entity.
	 */
	public function clear_default_for_entity( string $entity_name, int $except_id = 0 ): void {
		global $wpdb;

		$wpdb->query(
			$wpdb->prepare(
				"UPDATE {$this->table()} SET is_default_followup = 0 WHERE LOWER(entity_name) = LOWER(%s) AND id <> %d",
				$entity_name,
				$except_id
			)
		);
	}

	/**
	 * Back-compat accessor for callers that still think one quiz per entity
	 * (scoring, invite): resolves to the entity's default-followup quiz.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_for_entity( string $entity_name ): ?array {
		return $this->find_default_for_entity( $entity_name );
	}

	/**
	 * How many quiz pages reference a given template — used to block deleting
	 * a template that is still in use (Quiz Builder v2).
	 */
	public function count_using_template( int $template_id ): int {
		global $wpdb;

		return (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$this->table()} WHERE template_id = %d", $template_id )
		);
	}

	/**
	 * @param array<string, mixed> $data
	 * @return int|false
	 */
	public function create( array $data ): int|false {
		global $wpdb;

		return false === $wpdb->insert( $this->table(), $data ) ? false : (int) $wpdb->insert_id;
	}

	/**
	 * @param array<string, mixed> $data
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;

		return false !== $wpdb->update( $this->table(), $data, [ 'id' => $id ] );
	}

	public function delete( int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->table(), [ 'id' => $id ] );
	}

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_quiz_pages';
	}
}
