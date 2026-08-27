<?php
/**
 * Playbook business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\PlaybookMasterRepository;
use Pukat\Repositories\PlaybookRepository;
use WP_Error;

/**
 * Coordinates validation, persistence, and audit logging for playbooks.
 */
class PlaybookService {

	private const GENERAL_ENTITY = 'General';

	private PlaybookRepository $repository;

	public function __construct( ?PlaybookRepository $repository = null ) {
		$this->repository = $repository ?? new PlaybookRepository();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list(): array {
		return $this->filter_playbooks_for_current_user(
			array_map( [ $this, 'normalize_playbook' ], $this->repository->all() )
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get( int $id ): ?array {
		$playbook = $this->repository->find( $id );
		if ( ! $playbook ) {
			return null;
		}

		$playbook = $this->normalize_playbook( $playbook );

		return $this->current_user_can_access_playbook( $playbook ) ? $playbook : null;
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
		$data = $this->sanitize_data( $params );

		if ( empty( $data['name'] ) ) {
			return new WP_Error(
				'validation_error',
				__( 'Playbook name is required.', 'pukat' ),
				[ 'status' => 422 ]
			);
		}

		$permission_error = $this->enforce_write_entity( $data );
		if ( $permission_error ) {
			return $permission_error;
		}

		$data['created_by'] = $user_id;
		$id                 = $this->repository->create( $data );

		if ( false === $id ) {
			return new WP_Error(
				'db_error',
				__( 'Failed to create playbook.', 'pukat' ),
				[ 'status' => 500 ]
			);
		}

		AuditLogService::log(
			'playbook.created',
			[ 'playbook_id' => $id, 'name' => $data['name'] ],
			null,
			'playbook',
			$id
		);

		return $this->repository->find( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update( int $id, array $params ): array|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing ) {
			return new WP_Error(
				'not_found',
				__( 'Playbook not found.', 'pukat' ),
				[ 'status' => 404 ]
			);
		}

		$data             = $this->sanitize_data( $params );
		$permission_error = $this->enforce_write_entity( $data, $this->normalize_playbook( $existing ) );
		if ( $permission_error ) {
			return $permission_error;
		}

		$this->repository->update( $id, $data );

		AuditLogService::log( 'playbook.updated', [ 'playbook_id' => $id ], null, 'playbook', $id );

		return $this->repository->find( $id ) ?: [];
	}

	public function delete( int $id ): bool|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing ) {
			return new WP_Error(
				'not_found',
				__( 'Playbook not found.', 'pukat' ),
				[ 'status' => 404 ]
			);
		}

		$permission_error = $this->enforce_existing_playbook_editable( $this->normalize_playbook( $existing ) );
		if ( $permission_error ) {
			return $permission_error;
		}

		$this->repository->delete( $id );

		AuditLogService::log( 'playbook.deleted', [ 'playbook_id' => $id ], null, 'playbook', $id );

		return true;
	}

	/**
	 * Create a draft Playbook Master from a legacy playbook.
	 *
	 * The legacy playbook stores direct GoPhish asset IDs, so the migrated
	 * master is intentionally left in draft until component masters are mapped.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function migrate_to_master( int $id, int $user_id ): array|WP_Error {
		$legacy = $this->repository->find( $id );
		if ( ! $legacy ) {
			return new WP_Error(
				'not_found',
				__( 'Playbook not found.', 'pukat' ),
				[ 'status' => 404 ]
			);
		}

		$legacy           = $this->normalize_playbook( $legacy );
		$permission_error = $this->enforce_existing_playbook_editable( $legacy );
		if ( $permission_error ) {
			return $permission_error;
		}

		$master_repository = new PlaybookMasterRepository();
		$existing_master   = $master_repository->find_by_legacy_playbook_id( $id );
		if ( $existing_master ) {
			return [
				'migrated'        => false,
				'already_exists'  => true,
				'legacy_playbook' => $legacy,
				'playbook_master' => ( new PlaybookMasterService() )->get( (int) $existing_master['id'] ) ?: $existing_master,
			];
		}

		$rules = [
			'legacy' => [
				'playbook_id'                    => (int) $legacy['id'],
				'gophish_template_id'            => (int) ( $legacy['gophish_template_id'] ?? 0 ) ?: null,
				'gophish_page_id'                => (int) ( $legacy['gophish_page_id'] ?? 0 ) ?: null,
				'gophish_smtp_id'                => (int) ( $legacy['gophish_smtp_id'] ?? 0 ) ?: null,
				'migration_status'               => 'requires_master_component_mapping',
				'migrated_at'                    => current_time( 'mysql' ),
			],
		];

		$allowed_overrides = [
			'default_email_template_version_id' => true,
			'default_landing_page_version_id'   => true,
			'default_sending_profile_ref_id'    => true,
			'default_dynamic_domain_id'         => true,
		];

		$master_id = $master_repository->create(
			[
				'name'                   => sanitize_text_field( (string) $legacy['name'] ),
				'description'            => sanitize_textarea_field( (string) ( $legacy['description'] ?? '' ) ),
				'objective'              => sprintf(
					/* translators: %d: legacy playbook ID. */
					__( 'Migrated from legacy playbook #%d. Review and attach master component versions before approval.', 'pukat' ),
					$id
				),
				'scenario'               => 'legacy_migrated',
				'difficulty'             => min( max( (int) ( $legacy['difficulty'] ?? 1 ), 1 ), 5 ),
				'risk_level'             => null,
				'allowed_overrides_json' => wp_json_encode( $allowed_overrides ),
				'rules_json'             => wp_json_encode( $rules ),
				'metrics_json'           => null,
				'entity'                 => sanitize_text_field( (string) ( $legacy['entity'] ?? self::GENERAL_ENTITY ) ),
				'status'                 => 'draft',
				'version'                => 1,
				'legacy_playbook_id'     => $id,
				'created_by'             => $user_id,
			]
		);

		if ( false === $master_id ) {
			return new WP_Error(
				'db_error',
				__( 'Failed to migrate legacy playbook to Playbook Master.', 'pukat' ),
				[ 'status' => 500 ]
			);
		}

		AuditLogService::log(
			'playbook.migrated_to_master',
			[
				'legacy_playbook_id' => $id,
				'playbook_master_id' => $master_id,
			],
			null,
			'playbook_master',
			$master_id
		);

		return [
			'migrated'        => true,
			'already_exists'  => false,
			'legacy_playbook' => $legacy,
			'playbook_master' => ( new PlaybookMasterService() )->get( $master_id ) ?: $master_repository->find( $master_id ),
		];
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>
	 */
	private function sanitize_data( array $params ): array {
		return [
			'name'                => sanitize_text_field( (string) ( $params['name'] ?? '' ) ),
			'description'         => sanitize_textarea_field( (string) ( $params['description'] ?? '' ) ),
			'gophish_template_id' => (int) ( $params['gophish_template_id'] ?? 0 ) ?: null,
			'gophish_page_id'     => (int) ( $params['gophish_page_id'] ?? 0 ) ?: null,
			'gophish_smtp_id'     => (int) ( $params['gophish_smtp_id'] ?? 0 ) ?: null,
			'difficulty'          => min( max( (int) ( $params['difficulty'] ?? 0 ), 1 ), 5 ),
			'entity'              => sanitize_text_field( (string) ( $params['entity'] ?? self::GENERAL_ENTITY ) ) ?: self::GENERAL_ENTITY,
		];
	}

	/**
	 * @param array<string, mixed> $playbook Raw DB row.
	 * @return array<string, mixed>
	 */
	private function normalize_playbook( array $playbook ): array {
		$playbook['entity'] = sanitize_text_field( (string) ( $playbook['entity'] ?? '' ) ) ?: self::GENERAL_ENTITY;
		return $playbook;
	}

	/**
	 * @param array<int, array<string, mixed>> $playbooks Playbook rows.
	 * @return array<int, array<string, mixed>>
	 */
	private function filter_playbooks_for_current_user( array $playbooks ): array {
		return array_values( array_filter(
			$playbooks,
			[ $this, 'current_user_can_access_playbook' ]
		) );
	}

	/**
	 * @param array<string, mixed> $playbook Playbook row.
	 */
	private function current_user_can_access_playbook( array $playbook ): bool {
		if ( $this->current_user_can_admin_assets() ) {
			return true;
		}

		$playbook_entity = strtolower( trim( (string) ( $playbook['entity'] ?? '' ) ) );
		if ( strtolower( self::GENERAL_ENTITY ) === $playbook_entity ) {
			return true;
		}

		$user_entity = strtolower( $this->current_user_entity() );

		return '' !== $user_entity && $playbook_entity === $user_entity;
	}

	/**
	 * @param array<string, mixed>      $data     Sanitized playbook data to write.
	 * @param array<string, mixed>|null $existing Existing playbook row for update checks.
	 */
	private function enforce_write_entity( array &$data, ?array $existing = null ): ?WP_Error {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity = $this->current_user_entity();
		if ( '' === trim( $user_entity ) ) {
			return new WP_Error(
				'entity_required',
				__( 'Your user must have an entity before editing playbooks.', 'pukat' ),
				[ 'status' => 403 ]
			);
		}

		if ( null !== $existing ) {
			$existing_error = $this->enforce_existing_playbook_editable( $existing );
			if ( $existing_error ) {
				return $existing_error;
			}
		}

		$requested_entity = trim( (string) ( $data['entity'] ?? '' ) );
		if ( '' !== $requested_entity && strtolower( $requested_entity ) !== strtolower( $user_entity ) ) {
			return new WP_Error(
				'entity_forbidden',
				__( 'Non-admin users can only edit playbooks assigned to their own entity.', 'pukat' ),
				[ 'status' => 403 ]
			);
		}

		$data['entity'] = sanitize_text_field( $user_entity );

		return null;
	}

	/**
	 * @param array<string, mixed> $playbook Existing playbook row.
	 */
	private function enforce_existing_playbook_editable( array $playbook ): ?WP_Error {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity     = strtolower( $this->current_user_entity() );
		$playbook_entity = strtolower( trim( (string) ( $playbook['entity'] ?? '' ) ) );

		if ( '' !== $user_entity && '' !== $playbook_entity && strtolower( self::GENERAL_ENTITY ) !== $playbook_entity && $playbook_entity === $user_entity ) {
			return null;
		}

		return new WP_Error(
			'entity_forbidden',
			__( 'General playbooks and playbooks from other entities can only be edited by admins.', 'pukat' ),
			[ 'status' => 403 ]
		);
	}

	/**
	 * Whether the current user may manage cross-entity or General assets.
	 */
	private function current_user_can_admin_assets(): bool {
		return current_user_can( 'pukat_manage_settings' ) || current_user_can( 'administrator' );
	}

	/**
	 * Resolve the current user's entity code from WordPress user meta.
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
}
