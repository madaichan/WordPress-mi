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
	 * Count Campaign Runs that permanently lock a Playbook Master for editing
	 * (PRD §5.8) — any Campaign Run whose snapshot was ever locked, regardless
	 * of its current status. A `draft_run` with no snapshot yet never counts.
	 */
	public function count_campaign_runs_for_playbook( int $playbook_id ): int {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$sql   = "SELECT COUNT(*) FROM {$table} WHERE playbook_master_id = %d AND snapshot_json IS NOT NULL AND snapshot_json != ''";

		return (int) $wpdb->get_var( $wpdb->prepare( $sql, $playbook_id ) );
	}

	private function table( string $table_suffix ): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_' . $table_suffix;
	}
}
