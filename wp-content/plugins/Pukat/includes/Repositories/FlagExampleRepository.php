<?php
/**
 * Flag example database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_flag_examples` — per-entity gallery rows, each
 * pointing at a WP Media Library attachment. Matched to entities by
 * entity_name string, like every other entity-scoped table.
 */
class FlagExampleRepository {

	/**
	 * @param string|null $entity_name Null = every entity (admin only — the caller enforces that).
	 * @return array<int, array<string, mixed>>
	 */
	public function list( ?string $entity_name, ?int $flag_id ): array {
		global $wpdb;

		$where  = [ '1=1' ];
		$params = [];

		if ( null !== $entity_name ) {
			$where[]  = 'LOWER(e.entity_name) = LOWER(%s)';
			$params[] = $entity_name;
		}
		if ( null !== $flag_id ) {
			$where[]  = 'e.flag_id = %d';
			$params[] = $flag_id;
		}

		$sql = "SELECT e.*, f.flag_key, f.label AS flag_label
		        FROM {$this->table()} e
		        LEFT JOIN {$wpdb->prefix}pukat_flags f ON f.id = e.flag_id
		        WHERE " . implode( ' AND ', $where ) . '
		        ORDER BY e.created_at DESC, e.id DESC';

		$rows = $params ? $wpdb->get_results( $wpdb->prepare( $sql, ...$params ), ARRAY_A ) : $wpdb->get_results( $sql, ARRAY_A );

		return $rows ?: [];
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function find( int $id ): ?array {
		global $wpdb;

		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->table()} WHERE id = %d", $id ), ARRAY_A );

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

	public function delete( int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->table(), [ 'id' => $id ] );
	}

	/**
	 * Example count per entity for the admin oversight view — one grouped
	 * query. Keyed by lowercased entity name.
	 *
	 * @return array<string, array{name: string, total: int}>
	 */
	public function counts_by_entity(): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT LOWER(entity_name) AS entity_key, MIN(entity_name) AS entity_name, COUNT(*) AS total
			 FROM {$this->table()} GROUP BY LOWER(entity_name)",
			ARRAY_A
		) ?: [];

		$counts = [];
		foreach ( $rows as $row ) {
			$counts[ (string) $row['entity_key'] ] = [ 'name' => (string) $row['entity_name'], 'total' => (int) $row['total'] ];
		}

		return $counts;
	}

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_flag_examples';
	}
}
