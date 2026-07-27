<?php
/**
 * Playbook Master database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for Playbook Master and its referenced master components.
 */
class PlaybookMasterRepository {

	/**
	 * Return all Playbook Masters ordered by newest first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function all(): array {
		global $wpdb;

		$table = $this->table( 'playbook_masters' );
		$rows  = $wpdb->get_results(
			"SELECT * FROM {$table} ORDER BY created_at DESC",
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Find a Playbook Master by ID.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find( int $id ): ?array {
		global $wpdb;

		$table = $this->table( 'playbook_masters' );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Find a Playbook Master migrated from a legacy playbook.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_by_legacy_playbook_id( int $legacy_playbook_id ): ?array {
		global $wpdb;

		$table = $this->table( 'playbook_masters' );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE legacy_playbook_id = %d ORDER BY id DESC LIMIT 1", $legacy_playbook_id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Insert a Playbook Master and return its ID.
	 *
	 * @param array<string, mixed> $data Row data.
	 * @return int|false
	 */
	public function create( array $data ): int|false {
		global $wpdb;

		$result = $wpdb->insert( $this->table( 'playbook_masters' ), $data );

		return false === $result ? false : (int) $wpdb->insert_id;
	}

	/**
	 * Update a Playbook Master.
	 *
	 * @param array<string, mixed> $data Row data.
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;

		return false !== $wpdb->update( $this->table( 'playbook_masters' ), $data, [ 'id' => $id ] );
	}

	/**
	 * Find a referenced master component row by table suffix and ID.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_component( string $table_suffix, int $id ): ?array {
		global $wpdb;

		$table = $this->table( $table_suffix );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Count Campaign Runs that currently lock a Playbook Master for editing.
	 *
	 * @param array<int, string> $statuses Campaign Run statuses considered active.
	 */
	public function count_campaign_runs_for_playbook( int $playbook_id, array $statuses ): int {
		global $wpdb;

		if ( empty( $statuses ) ) {
			return 0;
		}

		$table        = $this->table( 'campaign_runs' );
		$placeholders = implode( ', ', array_fill( 0, count( $statuses ), '%s' ) );
		$sql          = "SELECT COUNT(*) FROM {$table} WHERE playbook_master_id = %d AND status IN ({$placeholders})";
		$params       = array_merge( [ $playbook_id ], $statuses );

		return (int) $wpdb->get_var( $wpdb->prepare( $sql, $params ) );
	}

	private function table( string $table_suffix ): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_' . $table_suffix;
	}
}
