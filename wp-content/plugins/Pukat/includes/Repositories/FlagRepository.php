<?php
/**
 * Flag category database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_flags` — the shared Flag categories. See
 * docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md.
 */
class FlagRepository {

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function all(): array {
		global $wpdb;

		return $wpdb->get_results( "SELECT * FROM {$this->table()} ORDER BY id ASC", ARRAY_A ) ?: [];
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
	 * @return array<string, mixed>|null
	 */
	public function find_by_key( string $flag_key ): ?array {
		global $wpdb;

		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$this->table()} WHERE flag_key = %s", $flag_key ), ARRAY_A );

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

	public function delete( int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->table(), [ 'id' => $id ] );
	}

	public function count_examples( int $flag_id ): int {
		global $wpdb;

		return (int) $wpdb->get_var(
			$wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->prefix}pukat_flag_examples WHERE flag_id = %d", $flag_id )
		);
	}

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_flags';
	}
}
