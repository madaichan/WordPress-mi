<?php
/**
 * Playbook database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for the pukat_playbooks table.
 */
class PlaybookRepository {

	/**
	 * Return all playbooks ordered by newest first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function all(): array {
		global $wpdb;

		$table = $this->table();
		$rows = $wpdb->get_results(
			"SELECT * FROM {$table} ORDER BY created_at DESC",
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Find a playbook by ID.
	 *
	 * @param int $id Playbook ID.
	 * @return array<string, mixed>|null
	 */
	public function find( int $id ): ?array {
		global $wpdb;

		$table = $this->table();
		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Insert a playbook and return its ID.
	 *
	 * @param array<string, mixed> $data Playbook row data.
	 * @return int|false
	 */
	public function create( array $data ): int|false {
		global $wpdb;

		$result = $wpdb->insert( $this->table(), $data );

		return false === $result ? false : (int) $wpdb->insert_id;
	}

	/**
	 * Update a playbook.
	 *
	 * @param int                  $id   Playbook ID.
	 * @param array<string, mixed> $data Playbook row data.
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;

		return false !== $wpdb->update( $this->table(), $data, [ 'id' => $id ] );
	}

	/**
	 * Delete a playbook.
	 *
	 * @param int $id Playbook ID.
	 */
	public function delete( int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->table(), [ 'id' => $id ] );
	}

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_playbooks';
	}
}
