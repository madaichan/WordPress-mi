<?php
/**
 * Master component database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Shared repository for Playbook Master component tables.
 */
class MasterComponentRepository {

	/**
	 * Return all rows from a Pukat table suffix ordered by newest first.
	 *
	 * @param string $table_suffix Table suffix after wp_pukat_.
	 * @return array<int, array<string, mixed>>
	 */
	public function all( string $table_suffix ): array {
		global $wpdb;

		$table = $this->table( $table_suffix );
		$rows  = $wpdb->get_results(
			"SELECT * FROM {$table} ORDER BY created_at DESC",
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Find a row by ID.
	 *
	 * @param string $table_suffix Table suffix after wp_pukat_.
	 * @param int    $id           Row ID.
	 * @return array<string, mixed>|null
	 */
	public function find( string $table_suffix, int $id ): ?array {
		global $wpdb;

		$table = $this->table( $table_suffix );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Insert a row and return its ID.
	 *
	 * @param string               $table_suffix Table suffix after wp_pukat_.
	 * @param array<string, mixed> $data         Row data.
	 * @return int|false
	 */
	public function create( string $table_suffix, array $data ): int|false {
		global $wpdb;

		$result = $wpdb->insert( $this->table( $table_suffix ), $data );

		return false === $result ? false : (int) $wpdb->insert_id;
	}

	/**
	 * Update a row.
	 *
	 * @param string               $table_suffix Table suffix after wp_pukat_.
	 * @param int                  $id           Row ID.
	 * @param array<string, mixed> $data         Row data.
	 */
	public function update( string $table_suffix, int $id, array $data ): bool {
		global $wpdb;

		return false !== $wpdb->update( $this->table( $table_suffix ), $data, [ 'id' => $id ] );
	}

	/**
	 * Delete a row by ID.
	 *
	 * @param string $table_suffix Table suffix after wp_pukat_.
	 * @param int    $id           Row ID.
	 */
	public function delete( string $table_suffix, int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->table( $table_suffix ), [ 'id' => $id ] );
	}

	/**
	 * Delete rows matching a simple equality map.
	 *
	 * @param string               $table_suffix Table suffix after wp_pukat_.
	 * @param array<string, mixed> $where        Equality filters.
	 */
	public function delete_where( string $table_suffix, array $where ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->table( $table_suffix ), $where );
	}

	/**
	 * Return version rows for a master record.
	 *
	 * @param string $table_suffix Table suffix after wp_pukat_.
	 * @param string $foreign_key  Version table foreign key column.
	 * @param int    $master_id    Master record ID.
	 * @return array<int, array<string, mixed>>
	 */
	public function versions( string $table_suffix, string $foreign_key, int $master_id ): array {
		global $wpdb;

		$table = $this->table( $table_suffix );
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} WHERE {$foreign_key} = %d ORDER BY version DESC",
				$master_id
			),
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Return the next version number for a master record.
	 *
	 * @param string $table_suffix Table suffix after wp_pukat_.
	 * @param string $foreign_key  Version table foreign key column.
	 * @param int    $master_id    Master record ID.
	 */
	public function next_version( string $table_suffix, string $foreign_key, int $master_id ): int {
		global $wpdb;

		$table = $this->table( $table_suffix );
		$max   = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT MAX(version) FROM {$table} WHERE {$foreign_key} = %d",
				$master_id
			)
		);

		return (int) $max + 1;
	}

	private function table( string $table_suffix ): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_' . $table_suffix;
	}
}
