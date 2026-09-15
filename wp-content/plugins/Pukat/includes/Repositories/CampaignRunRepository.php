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
	 * Delete a Campaign Run and any targets imported against it.
	 */
	public function delete( int $id ): bool {
		global $wpdb;

		$wpdb->delete( $this->table( 'targets' ), [ 'campaign_run_id' => $id ] );

		return false !== $wpdb->delete( $this->table( 'campaign_runs' ), [ 'id' => $id ] );
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
	 * Find imported targets for a Campaign Run.
	 *
	 * @return array<int, array<string, string>>
	 */
	public function find_targets( int $campaign_run_id ): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT first_name, last_name, email, position, department
				 FROM {$this->table( 'targets' )}
				 WHERE campaign_run_id = %d
				 ORDER BY id ASC",
				$campaign_run_id
			),
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Batched Playbook Master name lookup for a set of Campaign Runs — one
	 * query for the whole set instead of one per row (used by
	 * CampaignGroupService::aggregate() to enrich its per-run breakdown).
	 *
	 * @param array<int, int|string> $playbook_master_ids
	 * @return array<int, string> playbook_master_id => name
	 */
	public function playbook_names_by_id( array $playbook_master_ids ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $playbook_master_ids ) ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$rows         = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, name FROM {$this->table( 'playbook_masters' )} WHERE id IN ({$placeholders})",
				$ids
			),
			ARRAY_A
		) ?: [];

		return array_map( 'strval', array_column( $rows, 'name', 'id' ) );
	}

	/**
	 * Batched target counts for a set of Campaign Runs — one query for the
	 * whole set instead of one per row (used by CampaignGroupService::aggregate()
	 * to enrich its per-run breakdown).
	 *
	 * @param array<int, int|string> $campaign_run_ids
	 * @return array<int, int> campaign_run_id => count
	 */
	public function target_counts_by_campaign_run_id( array $campaign_run_ids ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $campaign_run_ids ) ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$rows         = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT campaign_run_id, COUNT(*) AS cnt FROM {$this->table( 'targets' )} WHERE campaign_run_id IN ({$placeholders}) GROUP BY campaign_run_id",
				$ids
			),
			ARRAY_A
		) ?: [];

		return array_map( 'intval', array_column( $rows, 'cnt', 'campaign_run_id' ) );
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
