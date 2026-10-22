<?php
/**
 * Quiz question bank database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_quiz_questions` — the per-entity question bank. Each
 * question owns an `input_name`, which is the only link between the bank and
 * the free-form quiz page HTML (docs/PRD_QUIZ_MODULE.md §5.1). Matched to
 * entities by string, like every other entity-scoped table.
 */
class QuizQuestionRepository {

	/** Columns a list/read returns — never SELECT * (AGENTS.md §5.2). */
	private const FIELDS = 'id, entity_name, question, input_name, options, explanation, difficulty, tags, is_active, created_by, created_at';

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_for_entity( string $entity_name, bool $only_active = false ): array {
		global $wpdb;

		$sql = "SELECT " . self::FIELDS . " FROM {$this->table()} WHERE LOWER(entity_name) = LOWER(%s)";
		if ( $only_active ) {
			$sql .= ' AND is_active = 1';
		}
		$sql .= ' ORDER BY input_name ASC, id ASC';

		return $wpdb->get_results( $wpdb->prepare( $sql, $entity_name ), ARRAY_A ) ?: [];
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function find( int $id ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT " . self::FIELDS . " FROM {$this->table()} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Selected questions for a quiz, scoped to the entity and returned in the
	 * caller's id order (the builder's display order). Ids not owned by the
	 * entity are silently dropped — the security boundary, since ids come from
	 * the client (Quiz Builder v2).
	 *
	 * @param array<int, int> $ids
	 * @return array<int, array<string, mixed>>
	 */
	public function find_selected_for_entity( array $ids, string $entity_name ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $ids ), static fn ( int $i ): bool => $i > 0 ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$params       = array_merge( $ids, [ $entity_name ] );
		$rows         = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT ' . self::FIELDS . " FROM {$this->table()} WHERE id IN ({$placeholders}) AND LOWER(entity_name) = LOWER(%s)",
				$params
			),
			ARRAY_A
		) ?: [];

		// Re-order to match the requested id order.
		$by_id = [];
		foreach ( $rows as $row ) {
			$by_id[ (int) $row['id'] ] = $row;
		}
		$ordered = [];
		foreach ( $ids as $id ) {
			if ( isset( $by_id[ $id ] ) ) {
				$ordered[] = $by_id[ $id ];
			}
		}

		return $ordered;
	}

	/**
	 * The question holding this input name in this entity, if any. Used to
	 * reject duplicates before the UNIQUE (entity_name, input_name) index does.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_by_input_name( string $entity_name, string $input_name ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT " . self::FIELDS . " FROM {$this->table()}
				WHERE LOWER(entity_name) = LOWER(%s) AND input_name = %s",
				$entity_name,
				$input_name
			),
			ARRAY_A
		);

		return $row ?: null;
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

		return $wpdb->prefix . 'pukat_quiz_questions';
	}
}
