<?php
/**
 * Entity Profile database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for `pukat_entity_profiles` (descriptive metadata for an
 * Entity) and `pukat_target_email_domains` (per-entity recipient domain
 * allow-list). Both are lookup tables keyed by `entity_name` string, not by
 * a foreign key into any other table — see
 * docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §6.
 */
class EntityProfileRepository {

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function all(): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			"SELECT * FROM {$this->table()} ORDER BY entity_name ASC",
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
	 * Case-insensitive lookup by name — mirrors the case-insensitive match
	 * `current_user_can_access_entity()` already uses everywhere else.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_by_name( string $entity_name ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->table()} WHERE LOWER(entity_name) = LOWER(%s)", $entity_name ),
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

	/**
	 * Deletes only the `pukat_entity_profiles` row itself. Deliberately does
	 * NOT touch any `entity`/`owner_entity` column on any other table, or any
	 * `pukat_target_email_domains` row — see
	 * docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §6/FR-3. Do not "fix" this
	 * into a cascading delete; that's a deliberate PRD decision, not an
	 * oversight.
	 */
	public function delete( int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->table(), [ 'id' => $id ] );
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_email_domains( string $entity_name ): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$this->domains_table()} WHERE LOWER(entity_name) = LOWER(%s) ORDER BY domain ASC",
				$entity_name
			),
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function find_email_domain( int $id ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->domains_table()} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * @param array<string, mixed> $data Row data.
	 * @return int|false
	 */
	public function add_email_domain( array $data ): int|false {
		global $wpdb;

		$result = $wpdb->insert( $this->domains_table(), $data );

		return false === $result ? false : (int) $wpdb->insert_id;
	}

	public function remove_email_domain( int $id ): bool {
		global $wpdb;

		return false !== $wpdb->delete( $this->domains_table(), [ 'id' => $id ] );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function find_report_contact( string $entity_name ): ?array {
		global $wpdb;

		$row = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$this->contacts_table()} WHERE LOWER(entity_name) = LOWER(%s)", $entity_name ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * One contact row per entity — updates the existing row, inserts if none.
	 *
	 * @param array<string, mixed> $data contact_name/contact_phone/contact_email/updated_by.
	 */
	public function upsert_report_contact( string $entity_name, array $data ): bool {
		global $wpdb;

		$existing = $this->find_report_contact( $entity_name );
		if ( $existing ) {
			return false !== $wpdb->update( $this->contacts_table(), $data, [ 'id' => (int) $existing['id'] ] );
		}

		return false !== $wpdb->insert( $this->contacts_table(), array_merge( $data, [ 'entity_name' => $entity_name ] ) );
	}

	/**
	 * Entities that have at least one contact field filled — for the admin
	 * oversight column, in one query. Keyed by lowercased name, value is the
	 * stored name (needed to display entities that have no profile yet).
	 *
	 * @return array<string, string>
	 */
	public function entities_with_report_contact(): array {
		global $wpdb;

		$names = $wpdb->get_col(
			"SELECT entity_name FROM {$this->contacts_table()}
			 WHERE COALESCE(contact_name, '') <> '' OR COALESCE(contact_phone, '') <> '' OR COALESCE(contact_email, '') <> ''"
		) ?: [];

		$map = [];
		foreach ( $names as $name ) {
			$map[ strtolower( (string) $name ) ] = (string) $name;
		}

		return $map;
	}

	public function update_email_domain_status( int $id, string $status ): bool {
		global $wpdb;

		return false !== $wpdb->update( $this->domains_table(), [ 'status' => $status ], [ 'id' => $id ] );
	}

	/**
	 * Per-entity guardrail counts for the admin oversight view — one grouped
	 * query per table instead of one query per entity. Keys are lowercased
	 * entity names (matching is case-insensitive everywhere else too).
	 *
	 * @return array{landing: array<string, array{name: string, total: int, available: int}>, email: array<string, array{name: string, total: int, active: int}>}
	 */
	public function guardrail_counts(): array {
		global $wpdb;

		$landing_rows = $wpdb->get_results(
			"SELECT LOWER(owner_entity) AS entity_key,
			        MIN(owner_entity) AS entity_name,
			        COUNT(*) AS total,
			        SUM(CASE WHEN status = 'active' AND authorization_status = 'authorized' THEN 1 ELSE 0 END) AS available
			 FROM {$wpdb->prefix}pukat_dynamic_domains
			 GROUP BY LOWER(owner_entity)",
			ARRAY_A
		) ?: [];

		$email_rows = $wpdb->get_results(
			"SELECT LOWER(entity_name) AS entity_key,
			        MIN(entity_name) AS entity_name,
			        COUNT(*) AS total,
			        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
			 FROM {$this->domains_table()}
			 GROUP BY LOWER(entity_name)",
			ARRAY_A
		) ?: [];

		$landing = [];
		foreach ( $landing_rows as $row ) {
			$landing[ (string) $row['entity_key'] ] = [ 'name' => (string) $row['entity_name'], 'total' => (int) $row['total'], 'available' => (int) $row['available'] ];
		}

		$email = [];
		foreach ( $email_rows as $row ) {
			$email[ (string) $row['entity_key'] ] = [ 'name' => (string) $row['entity_name'], 'total' => (int) $row['total'], 'active' => (int) $row['active'] ];
		}

		return [ 'landing' => $landing, 'email' => $email ];
	}

	/**
	 * Active (status = 'active') allowed domains for an entity — the exact
	 * set CampaignRunService::validate_target_email_domains() checks target
	 * emails against. An empty array means the guardrail is fail-open for
	 * this entity (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §11).
	 *
	 * @return string[]
	 */
	public function active_email_domains( string $entity_name ): array {
		global $wpdb;

		$domains = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT domain FROM {$this->domains_table()} WHERE LOWER(entity_name) = LOWER(%s) AND status = 'active'",
				$entity_name
			)
		);

		return $domains ?: [];
	}

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_entity_profiles';
	}

	private function domains_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_target_email_domains';
	}

	private function contacts_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_report_contacts';
	}
}
