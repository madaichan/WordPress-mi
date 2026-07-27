<?php
/**
 * Campaign Run database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for Campaign Run snapshots and referenced Playbook Master data.
 */
class CampaignRunRepository {

	/**
	 * Return all Campaign Runs ordered by newest first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function all(): array {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$rows  = $wpdb->get_results(
			"SELECT * FROM {$table} ORDER BY created_at DESC",
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Return Campaign Runs that can have GoPhish results refreshed by cron.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function result_sync_candidates( int $limit = 25 ): array {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$limit = max( 1, min( 100, $limit ) );
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table}
				 WHERE gophish_campaign_id IS NOT NULL
				   AND status IN ('synced', 'scheduled', 'running')
				 ORDER BY updated_at ASC
				 LIMIT %d",
				$limit
			),
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Find a Campaign Run by ID.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find( int $id ): ?array {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Insert a Campaign Run and return its ID.
	 *
	 * @param array<string, mixed> $data Row data.
	 * @return int|false
	 */
	public function create( array $data ): int|false {
		global $wpdb;

		$result = $wpdb->insert( $this->table( 'campaign_runs' ), $data );

		return false === $result ? false : (int) $wpdb->insert_id;
	}

	/**
	 * Update a Campaign Run.
	 *
	 * @param array<string, mixed> $data Row data.
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;

		return false !== $wpdb->update( $this->table( 'campaign_runs' ), $data, [ 'id' => $id ] );
	}

	/**
	 * Find a Playbook Master by ID.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_playbook_master( int $id ): ?array {
		return $this->find_row( 'playbook_masters', $id );
	}

	/**
	 * Find a referenced component row by table suffix and ID.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_component( string $table_suffix, int $id ): ?array {
		return $this->find_row( $table_suffix, $id );
	}

	/**
	 * Find a generic row by table suffix and ID.
	 *
	 * @return array<string, mixed>|null
	 */
	private function find_row( string $table_suffix, int $id ): ?array {
		global $wpdb;

		$table = $this->table( $table_suffix );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	private function table( string $table_suffix ): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_' . $table_suffix;
	}
}
