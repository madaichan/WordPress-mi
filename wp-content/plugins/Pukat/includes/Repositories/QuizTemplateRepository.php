<?php
/**
 * Quiz template catalogue database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_quiz_templates` — admin-authored quiz shells reused
 * across entities (docs/PRD_QUIZ_MODULE.md §13). The `html_body` carries the
 * placeholder and question-slot markers; `placeholders` is the JSON field
 * declaration the builder renders a form from.
 */
class QuizTemplateRepository {

	/** List columns — never the large html_body (AGENTS.md §5.2). */
	private const LIST_FIELDS = 'id, name, description, placeholders, is_active, created_by, updated_by, created_at, updated_at';

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_all( bool $only_active = false ): array {
		global $wpdb;

		$sql = 'SELECT ' . self::LIST_FIELDS . " FROM {$this->table()}";
		if ( $only_active ) {
			$sql .= ' WHERE is_active = 1';
		}
		$sql .= ' ORDER BY name ASC, id ASC';

		return $wpdb->get_results( $sql, ARRAY_A ) ?: [];
	}

	/**
	 * Full row including html_body — used when editing or generating a page.
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

		return $wpdb->prefix . 'pukat_quiz_templates';
	}
}
