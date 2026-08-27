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
	 * Return Campaign Runs with a locked snapshot (i.e. permanently "used" for
	 * usage-lock purposes — see PRD §5.8), regardless of their current status.
	 * A Campaign Run only reaches this state once its snapshot has been
	 * locked/synced/launched; a `draft_run` with no snapshot yet never counts.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function campaign_runs_with_locked_snapshot(): array {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$sql   = "SELECT id, status, playbook_master_id, gophish_template_id, gophish_page_id, gophish_sending_profile_id, snapshot_json FROM {$table} WHERE snapshot_json IS NOT NULL AND snapshot_json != ''";

		$rows = $wpdb->get_results( $sql, ARRAY_A );

		return $rows ?: [];
	}

	/**
	 * Count legacy campaigns (any status) using a GoPhish asset through a legacy playbook.
	 * Permanent, all-history count — see PRD §5.8.
	 *
	 * @param string $gophish_column GoPhish asset ID column on pukat_playbooks.
	 * @param int    $gophish_id     GoPhish asset ID.
	 */
	public function count_legacy_campaigns_for_gophish_asset( string $gophish_column, int $gophish_id ): int {
		global $wpdb;

		$allowed_columns = [ 'gophish_template_id', 'gophish_page_id', 'gophish_smtp_id' ];
		if ( $gophish_id <= 0 || ! in_array( $gophish_column, $allowed_columns, true ) ) {
			return 0;
		}

		$campaigns = $this->table( 'campaigns' );
		$playbooks = $this->table( 'playbooks' );
		$sql       = "SELECT COUNT(*) FROM {$campaigns} c INNER JOIN {$playbooks} p ON p.id = c.playbook_id WHERE p.{$gophish_column} = %d";

		return (int) $wpdb->get_var( $wpdb->prepare( $sql, $gophish_id ) );
	}

	/**
	 * Count active Playbook Masters that reference a master component.
	 */
	public function count_active_playbook_masters_for_component( string $component_column, int $component_id ): int {
		global $wpdb;

		$allowed_columns = [
			'default_email_template_version_id',
			'default_landing_page_version_id',
			'default_sending_profile_ref_id',
			'default_dynamic_domain_id',
		];
		if ( $component_id <= 0 || ! in_array( $component_column, $allowed_columns, true ) ) {
			return 0;
		}

		$table = $this->table( 'playbook_masters' );
		$sql   = "SELECT COUNT(*) FROM {$table} WHERE {$component_column} = %d AND status = 'active'";

		return (int) $wpdb->get_var( $wpdb->prepare( $sql, $component_id ) );
	}

	/**
	 * Count active Playbook Masters using a GoPhish sending profile via master refs.
	 */
	public function count_active_playbook_masters_for_gophish_sending_profile( int $gophish_id ): int {
		global $wpdb;

		if ( $gophish_id <= 0 ) {
			return 0;
		}

		$playbooks = $this->table( 'playbook_masters' );
		$refs      = $this->table( 'sending_profile_refs' );
		$sql       = "SELECT COUNT(*) FROM {$playbooks} p INNER JOIN {$refs} s ON s.id = p.default_sending_profile_ref_id WHERE s.gophish_sending_profile_id = %d AND p.status = 'active'";

		return (int) $wpdb->get_var( $wpdb->prepare( $sql, $gophish_id ) );
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
