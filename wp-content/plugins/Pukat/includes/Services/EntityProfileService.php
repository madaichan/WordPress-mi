<?php
/**
 * Entity Profile business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\EntityProfileRepository;
use WP_Error;

/**
 * Descriptive metadata for an Entity (contact info, description, status)
 * plus its per-entity recipient email-domain allow-list. Entirely additive
 * on top of the existing free-text `entity`/`owner_entity` columns used
 * everywhere else in this codebase — never a foreign-key source of truth,
 * never touches those columns. See
 * docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §6.
 *
 * Access model (corrected 2026-09-25 — see the PRD's revision note): creating
 * and deleting an Entity Profile stays admin-only (governance — who gets to
 * exist as an entity at all), but VIEWING and EDITING an existing profile
 * (contact info, description, email-domain allow-list) is self-service —
 * the entity's own non-admin users manage it, since they're the ones who
 * actually know that information, not central admin. This mirrors the
 * read/write asymmetry already established for "General" elsewhere in this
 * codebase (see current_user_can_view_entity() vs enforce_entity_editable()
 * below, and CampaignRunService::enforce_existing_run_editable()): General is
 * readable by everyone but only admin-editable, because nobody specifically
 * owns it.
 */
class EntityProfileService {

	private const GENERAL_ENTITY = 'General';

	private const VALID_STATUSES = [ 'active', 'inactive' ];

	/** Basic domain-format check — rejects schemes/paths/spaces, not a full RFC validator. */
	private const DOMAIN_PATTERN = '/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i';

	private EntityProfileRepository $repository;

	public function __construct( ?EntityProfileRepository $repository = null ) {
		$this->repository = $repository ?? new EntityProfileRepository();
	}

	/**
	 * Admin sees every Entity Profile; a non-admin only ever sees their own
	 * entity's (plus General, which is readable by everyone — see class
	 * docblock) — never the full catalog of other entities' contact info.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function list(): array {
		$rows = $this->repository->all();
		if ( ! $this->current_user_can_admin_assets() ) {
			$rows = array_filter( $rows, fn ( array $row ): bool => $this->current_user_can_view_entity( (string) $row['entity_name'] ) );
		}

		return array_map( [ $this, 'prepare' ], array_values( $rows ) );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get( int $id ): ?array {
		$row = $this->repository->find( $id );
		if ( ! $row || ! $this->current_user_can_view_entity( (string) $row['entity_name'] ) ) {
			return null;
		}

		return $this->prepare( $row );
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
		$entity_name = sanitize_text_field( (string) ( $params['entity_name'] ?? '' ) );
		if ( '' === trim( $entity_name ) ) {
			return $this->validation_error( __( 'Entity name is required.', 'pukat' ) );
		}

		if ( $this->repository->find_by_name( $entity_name ) ) {
			return new WP_Error(
				'entity_already_exists',
				__( 'An Entity Profile with this name already exists.', 'pukat' ),
				[ 'status' => 409 ]
			);
		}

		$status = $this->sanitize_status( $params['status'] ?? 'active' );

		$id = $this->repository->create( [
			'entity_name'   => $entity_name,
			'description'   => $this->sanitize_optional_textarea( $params['description'] ?? null ),
			'contact_name'  => $this->sanitize_optional_text( $params['contact_name'] ?? null ),
			'contact_email' => $this->sanitize_optional_email( $params['contact_email'] ?? null ),
			'contact_phone' => $this->sanitize_optional_text( $params['contact_phone'] ?? null ),
			'status'        => $status,
			'created_by'    => $user_id,
		] );

		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create Entity Profile.', 'pukat' ) );
		}

		AuditLogService::log(
			'entity_profile.created',
			[ 'entity_profile_id' => $id, 'entity_name' => $entity_name ],
			$user_id,
			'entity_profile',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * `entity_name` is deliberately immutable once created — every other
	 * table matches entities by this exact string (no FK), so silently
	 * renaming it here would orphan every row elsewhere that still uses the
	 * old name. Any `entity_name` in $params is ignored, not rejected.
	 *
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	public function update( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Entity Profile not found.', 'pukat' ) );
		}

		$edit_error = $this->enforce_entity_editable( (string) $existing['entity_name'] );
		if ( $edit_error ) {
			return $edit_error;
		}

		$data = [ 'updated_by' => $user_id ];

		if ( array_key_exists( 'description', $params ) ) {
			$data['description'] = $this->sanitize_optional_textarea( $params['description'] );
		}
		if ( array_key_exists( 'contact_name', $params ) ) {
			$data['contact_name'] = $this->sanitize_optional_text( $params['contact_name'] );
		}
		if ( array_key_exists( 'contact_email', $params ) ) {
			$data['contact_email'] = $this->sanitize_optional_email( $params['contact_email'] );
		}
		if ( array_key_exists( 'contact_phone', $params ) ) {
			$data['contact_phone'] = $this->sanitize_optional_text( $params['contact_phone'] );
		}
		if ( array_key_exists( 'status', $params ) ) {
			$data['status'] = $this->sanitize_status( $params['status'] );
		}

		if ( ! $this->repository->update( $id, $data ) ) {
			return $this->db_error( __( 'Failed to update Entity Profile.', 'pukat' ) );
		}

		AuditLogService::log(
			'entity_profile.updated',
			[ 'entity_profile_id' => $id ],
			$user_id,
			'entity_profile',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * Deletes only the profile row — see
	 * EntityProfileRepository::delete()'s docblock for why this never
	 * cascades to other tables.
	 *
	 * @return true|WP_Error
	 */
	public function delete( int $id, int $user_id ): bool|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Entity Profile not found.', 'pukat' ) );
		}

		if ( ! $this->repository->delete( $id ) ) {
			return $this->db_error( __( 'Failed to delete Entity Profile.', 'pukat' ) );
		}

		AuditLogService::log(
			'entity_profile.deleted',
			[ 'entity_profile_id' => $id, 'entity_name' => $existing['entity_name'] ],
			$user_id,
			'entity_profile',
			$id
		);

		return true;
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_email_domains( string $entity_name ): array {
		if ( ! $this->current_user_can_view_entity( $entity_name ) ) {
			return [];
		}

		return array_map(
			static fn ( array $row ): array => [
				'id'          => (int) $row['id'],
				'entity_name' => (string) $row['entity_name'],
				'domain'      => (string) $row['domain'],
				'status'      => (string) $row['status'],
				'created_at'  => $row['created_at'] ?? null,
			],
			$this->repository->list_email_domains( $entity_name )
		);
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function add_email_domain( string $entity_name, string $domain, int $user_id ): array|WP_Error {
		$edit_error = $this->enforce_entity_editable( $entity_name );
		if ( $edit_error ) {
			return $edit_error;
		}

		$domain = strtolower( trim( $domain ) );

		if ( '' === $domain || ! preg_match( self::DOMAIN_PATTERN, $domain ) ) {
			return $this->validation_error( __( 'Please provide a valid domain (e.g. example.com).', 'pukat' ) );
		}

		global $wpdb;
		$id = $this->repository->add_email_domain( [
			'entity_name' => $entity_name,
			'domain'      => $domain,
			'status'      => 'active',
			'created_by'  => $user_id,
		] );

		if ( false === $id ) {
			// UNIQUE KEY entity_domain (entity_name, domain) — the only realistic
			// insert failure here besides a genuine DB outage.
			if ( str_contains( (string) $wpdb->last_error, 'Duplicate entry' ) ) {
				return new WP_Error(
					'domain_already_allowed',
					__( 'This domain is already in the allow-list for this entity.', 'pukat' ),
					[ 'status' => 409 ]
				);
			}

			return $this->db_error( __( 'Failed to add domain.', 'pukat' ) );
		}

		AuditLogService::log(
			'entity_profile.email_domain_added',
			[ 'entity_name' => $entity_name, 'domain' => $domain ],
			$user_id,
			'entity_profile',
			null
		);

		return [ 'id' => $id, 'entity_name' => $entity_name, 'domain' => $domain, 'status' => 'active' ];
	}

	/**
	 * @return true|WP_Error
	 */
	public function remove_email_domain( int $id, string $entity_name, int $user_id ): bool|WP_Error {
		$existing = $this->repository->find_email_domain( $id );
		if ( ! $existing || strtolower( (string) $existing['entity_name'] ) !== strtolower( $entity_name ) ) {
			return $this->not_found_error( __( 'Domain not found for this entity.', 'pukat' ) );
		}

		$edit_error = $this->enforce_entity_editable( $entity_name );
		if ( $edit_error ) {
			return $edit_error;
		}

		if ( ! $this->repository->remove_email_domain( $id ) ) {
			return $this->db_error( __( 'Failed to remove domain.', 'pukat' ) );
		}

		AuditLogService::log(
			'entity_profile.email_domain_removed',
			[ 'entity_name' => $entity_name, 'domain' => $existing['domain'] ],
			$user_id,
			'entity_profile',
			null
		);

		return true;
	}

	/**
	 * Enable/disable (not delete) an allow-listed email domain — the admin
	 * oversight lever from docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §14.2.
	 * The guardrail only ever reads `active` rows (EntityProfileRepository::
	 * active_email_domains()), so disabling takes a domain out of the
	 * allow-list while keeping its record. Same edit scope as add/remove.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function set_email_domain_status( int $id, string $entity_name, string $status, int $user_id ): array|WP_Error {
		if ( ! in_array( $status, self::VALID_STATUSES, true ) ) {
			return $this->validation_error( __( 'Status must be active or inactive.', 'pukat' ) );
		}

		$existing = $this->repository->find_email_domain( $id );
		if ( ! $existing || strtolower( (string) $existing['entity_name'] ) !== strtolower( $entity_name ) ) {
			return $this->not_found_error( __( 'Domain not found for this entity.', 'pukat' ) );
		}

		$edit_error = $this->enforce_entity_editable( $entity_name );
		if ( $edit_error ) {
			return $edit_error;
		}

		if ( ! $this->repository->update_email_domain_status( $id, $status ) ) {
			return $this->db_error( __( 'Failed to update domain status.', 'pukat' ) );
		}

		AuditLogService::log(
			'entity_profile.email_domain_status_changed',
			[ 'entity_name' => $entity_name, 'domain' => $existing['domain'], 'status' => $status ],
			$user_id,
			'entity_profile',
			null
		);

		return [
			'id'          => $id,
			'entity_name' => (string) $existing['entity_name'],
			'domain'      => (string) $existing['domain'],
			'status'      => $status,
		];
	}

	/**
	 * Admin oversight summary (§14.2): every visible Entity Profile plus its
	 * guardrail counts — AND every entity that has guardrail data but no
	 * profile yet. Guardrail rows are keyed by entity_name string, not by a
	 * profile FK (§6), so an entity's users can register domains before an
	 * admin ever creates its profile; oversight must still see those, since
	 * they affect campaigns either way. Such rows come back with `id` null and
	 * `has_profile` false. The route is admin-only (master_entities.oversee);
	 * extra rows still pass through current_user_can_view_entity().
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function guardrails_overview(): array {
		$counts = $this->repository->guardrail_counts();

		$rows = array_map( fn ( array $profile ): array => $this->with_guardrail_counts( array_merge( $profile, [ 'has_profile' => true ] ), $counts ), $this->list() );

		$known = array_map( static fn ( array $row ): string => strtolower( (string) $row['entity_name'] ), $rows );
		$orphans = [];
		foreach ( [ 'email', 'landing' ] as $kind ) {
			foreach ( $counts[ $kind ] as $key => $entry ) {
				if ( '' === $key || in_array( $key, $known, true ) || isset( $orphans[ $key ] ) ) {
					continue;
				}
				if ( ! $this->current_user_can_view_entity( $entry['name'] ) ) {
					continue;
				}
				$orphans[ $key ] = $this->with_guardrail_counts( [
					'id'            => null,
					'entity_name'   => $entry['name'],
					'description'   => null,
					'contact_name'  => null,
					'contact_email' => null,
					'contact_phone' => null,
					'status'        => null,
					'has_profile'   => false,
				], $counts );
			}
		}

		return array_merge( $rows, array_values( $orphans ) );
	}

	/**
	 * @param array<string, mixed> $row
	 * @param array<string, mixed> $counts From EntityProfileRepository::guardrail_counts().
	 * @return array<string, mixed>
	 */
	private function with_guardrail_counts( array $row, array $counts ): array {
		$key     = strtolower( (string) $row['entity_name'] );
		$landing = $counts['landing'][ $key ] ?? [ 'total' => 0, 'available' => 0 ];
		$email   = $counts['email'][ $key ] ?? [ 'total' => 0, 'active' => 0 ];

		return array_merge( $row, [
			'landing_domains_total'     => $landing['total'],
			'landing_domains_available' => $landing['available'],
			'email_domains_total'       => $email['total'],
			'email_domains_active'      => $email['active'],
		] );
	}

	/**
	 * @param array<string, mixed> $row
	 * @return array<string, mixed>
	 */
	private function prepare( array $row ): array {
		return [
			'id'            => (int) $row['id'],
			'entity_name'   => (string) $row['entity_name'],
			'description'   => $row['description'] ?? null,
			'contact_name'  => $row['contact_name'] ?? null,
			'contact_email' => $row['contact_email'] ?? null,
			'contact_phone' => $row['contact_phone'] ?? null,
			'status'        => (string) $row['status'],
			'created_at'    => $row['created_at'] ?? null,
			'updated_at'    => $row['updated_at'] ?? null,
		];
	}

	private function sanitize_status( mixed $status ): string {
		$status = (string) $status;

		return in_array( $status, self::VALID_STATUSES, true ) ? $status : 'active';
	}

	private function sanitize_optional_text( mixed $value ): ?string {
		if ( null === $value || '' === trim( (string) $value ) ) {
			return null;
		}

		return sanitize_text_field( (string) $value );
	}

	private function sanitize_optional_textarea( mixed $value ): ?string {
		if ( null === $value || '' === trim( (string) $value ) ) {
			return null;
		}

		return sanitize_textarea_field( (string) $value );
	}

	private function sanitize_optional_email( mixed $value ): ?string {
		if ( null === $value || '' === trim( (string) $value ) ) {
			return null;
		}

		return sanitize_email( (string) $value );
	}

	/**
	 * Read access: admin sees everything, General is open to everyone (same
	 * semantics as CampaignRunService::current_user_can_access_entity()) —
	 * otherwise the entity must match the current user's own entity meta.
	 */
	private function current_user_can_view_entity( string $entity_name ): bool {
		if ( $this->current_user_can_admin_assets() ) {
			return true;
		}

		$entity_name = strtolower( trim( $entity_name ) );
		if ( strtolower( self::GENERAL_ENTITY ) === $entity_name ) {
			return true;
		}

		$user_entity = strtolower( $this->current_user_entity() );

		return '' !== $user_entity && $entity_name === $user_entity;
	}

	/**
	 * Write access: stricter than view access — General is NOT editable by a
	 * non-admin (nobody specifically owns it, so letting any operator edit
	 * its shared contact info/allow-list would be a free-for-all). Mirrors
	 * CampaignRunService::enforce_existing_run_editable()'s identical
	 * General-is-admin-only-to-edit rule.
	 */
	private function enforce_entity_editable( string $entity_name ): ?WP_Error {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity   = strtolower( $this->current_user_entity() );
		$target_entity = strtolower( trim( $entity_name ) );

		if ( '' !== $user_entity && '' !== $target_entity && strtolower( self::GENERAL_ENTITY ) !== $target_entity && $target_entity === $user_entity ) {
			return null;
		}

		return $this->forbidden_error( __( 'The General entity and entities other than your own can only be edited by admins.', 'pukat' ) );
	}

	/**
	 * Same 3-key fallback (meta_entity -> entity -> pukat_entity) used
	 * throughout this codebase — see ProfileController::current_user_entity()
	 * for the fuller explanation of why this is duplicated rather than shared.
	 */
	private function current_user_entity(): string {
		$user_id = get_current_user_id();
		$entity  = (string) get_user_meta( $user_id, 'meta_entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'entity', true );
		}

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
	}

	private function current_user_can_admin_assets(): bool {
		return current_user_can( 'pukat_manage_settings' ) || current_user_can( 'administrator' );
	}

	private function validation_error( string $message ): WP_Error {
		return new WP_Error( 'validation_error', $message, [ 'status' => 422 ] );
	}

	private function not_found_error( string $message ): WP_Error {
		return new WP_Error( 'not_found', $message, [ 'status' => 404 ] );
	}

	private function forbidden_error( string $message ): WP_Error {
		return new WP_Error( 'entity_forbidden', $message, [ 'status' => 403 ] );
	}

	private function db_error( string $message ): WP_Error {
		return new WP_Error( 'db_error', $message, [ 'status' => 500 ] );
	}
}
