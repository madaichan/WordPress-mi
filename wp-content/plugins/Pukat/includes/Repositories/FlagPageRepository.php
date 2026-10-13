<?php
/**
 * Flag education page database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_flag_pages` — one education page per entity (keyed by
 * entity_name). Matched to entities by string, like every other entity-scoped
 * table.
 */
class FlagPageRepository {

	/**
	 * @return array<string, mixed>|null
	 */
	public function find_for_entity( string $entity_name ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$this->table()} WHERE LOWER(entity_name) = LOWER(%s)",
				$entity_name
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

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_flag_pages';
	}
}
