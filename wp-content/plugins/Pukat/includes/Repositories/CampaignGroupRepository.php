<?php
/**
 * Campaign Group database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_campaign_groups` — organizational grouping for
 * Campaign Runs (Monitoring dashboard filter, Manage Campaigns page). See
 * docs/PRD_CAMPAIGN_GROUP_MONITORING.md.
 */
class CampaignGroupRepository {

	/**
	 * Return all Campaign Groups ordered by name.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function all(): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT * FROM {$this->table()} ORDER BY name ASC",
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
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
	 * @param array<string, mixed> $data Row data.
	 * @return int|false
	 */
	public function create( array $data ): int|false {
		global $wpdb;

		$result = $wpdb->insert( $this->table(), $data );

		return false === $result ? false : (int) $wpdb->insert_id;
	}

	/**
	 * @param array<string, mixed> $data Row data.
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;

		return false !== $wpdb->update( $this->table(), $data, [ 'id' => $id ] );
	}

	public function delete( int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->table(), [ 'id' => $id ] );
	}

	/**
	 * Ungroup every Campaign Run currently assigned to this group (sets
	 * campaign_group_id back to NULL). Called before delete() so removing a
	 * group never leaves dangling references.
	 */
	public function ungroup_members( int $id ): void {
		global $wpdb;

		$campaign_runs_table = $wpdb->prefix . 'pukat_campaign_runs';

		$wpdb->update( $campaign_runs_table, [ 'campaign_group_id' => null ], [ 'campaign_group_id' => $id ] );
	}

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_campaign_groups';
	}
}
