<?php
/**
 * Playbook Master business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\PlaybookMasterRepository;
use WP_Error;

/**
 * Coordinates validation, persistence, lifecycle, and audit logging for Playbook Master.
 */
class PlaybookMasterService {

	private const GENERAL_ENTITY = 'General';

	private const STATUS_VALUES = [
		'draft',
		'review',
		'approved',
		'active',
		'deprecated',
		'archived',
	];

	private const READY_STATUSES = [ 'approved', 'active' ];

	private const ACTIVE_CAMPAIGN_RUN_STATUSES = [
		'ready_for_sync',
		'syncing',
		'sync_failed',
		'synced',
		'scheduled',
		'running',
	];

	private PlaybookMasterRepository $repository;

	public function __construct( ?PlaybookMasterRepository $repository = null ) {
		$this->repository = $repository ?? new PlaybookMasterRepository();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list(): array {
		return array_map(
			[ $this, 'prepare_playbook' ],
			$this->filter_playbooks_for_current_user( $this->repository->all() )
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get( int $id ): ?array {
		$playbook = $this->repository->find( $id );
		if ( ! $playbook || ! $this->current_user_can_access_playbook( $playbook ) ) {
			return null;
		}

		return $this->prepare_playbook( $playbook );
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
		$data = $this->sanitize_data( $params );
		if ( empty( $data['name'] ) ) {
			return $this->validation_error( __( 'Playbook Master name is required.', 'pukat' ) );
		}

		$permission_error = $this->enforce_write_entity( $data );
		if ( $permission_error ) {
			return $permission_error;
		}

		if ( in_array( $data['status'], self::READY_STATUSES, true ) ) {
			$readiness_error = $this->validate_ready_for_approval( $data );
			if ( $readiness_error ) {
				return $readiness_error;
			}
		}

		$data['created_by'] = $user_id;
		if ( in_array( $data['status'], self::READY_STATUSES, true ) ) {
			$data['approved_by'] = $user_id;
			$data['approved_at'] = current_time( 'mysql' );
		}

		$id = $this->repository->create( $data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create Playbook Master.', 'pukat' ) );
		}

		AuditLogService::log(
			'playbook_master.created',
			[ 'playbook_master_id' => $id, 'name' => $data['name'] ],
			null,
			'playbook_master',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Playbook Master not found.', 'pukat' ) );
		}

		$status_error = $this->enforce_not_active_playbook( $existing );
		if ( $status_error ) {
			return $status_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( $existing );
		if ( $usage_error ) {
			return $usage_error;
		}

		$data             = $this->sanitize_data( $params, $existing );
		$permission_error = $this->enforce_write_entity( $data, $existing );
		if ( $permission_error ) {
			return $permission_error;
		}

		if ( in_array( $data['status'], self::READY_STATUSES, true ) ) {
			$readiness_error = $this->validate_ready_for_approval( $data );
			if ( $readiness_error ) {
				return $readiness_error;
			}
		}

		$data['updated_by'] = $user_id;
		$this->repository->update( $id, $data );

		AuditLogService::log( 'playbook_master.updated', [ 'playbook_master_id' => $id ], null, 'playbook_master', $id );

		return $this->get( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function duplicate( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing || ! $this->current_user_can_access_playbook( $existing ) ) {
			return $this->not_found_error( __( 'Playbook Master not found.', 'pukat' ) );
		}

		$data = [
			'name'                                => sanitize_text_field( (string) ( $params['name'] ?? sprintf( 'Copy of %s', $existing['name'] ?? 'Playbook Master' ) ) ),
			'description'                         => sanitize_textarea_field( (string) ( $existing['description'] ?? '' ) ),
			'objective'                           => sanitize_textarea_field( (string) ( $existing['objective'] ?? '' ) ),
			'scenario'                            => sanitize_text_field( (string) ( $existing['scenario'] ?? '' ) ),
			'difficulty'                          => min( max( (int) ( $existing['difficulty'] ?? 1 ), 1 ), 5 ),
			'risk_level'                          => sanitize_text_field( (string) ( $existing['risk_level'] ?? '' ) ),
			'default_email_template_version_id'   => (int) ( $existing['default_email_template_version_id'] ?? 0 ) ?: null,
			'default_landing_page_version_id'     => (int) ( $existing['default_landing_page_version_id'] ?? 0 ) ?: null,
			'default_sending_profile_ref_id'      => (int) ( $existing['default_sending_profile_ref_id'] ?? 0 ) ?: null,
			'default_dynamic_domain_id'           => (int) ( $existing['default_dynamic_domain_id'] ?? 0 ) ?: null,
			'allowed_overrides_json'              => $existing['allowed_overrides_json'] ?? null,
			'rules_json'                          => $existing['rules_json'] ?? null,
			'metrics_json'                        => $existing['metrics_json'] ?? null,
			'entity'                              => sanitize_text_field( (string) ( $params['entity'] ?? $existing['entity'] ?? self::GENERAL_ENTITY ) ),
			'status'                              => 'draft',
			'version'                             => 1,
			'created_by'                          => $user_id,
		];

		$permission_error = $this->enforce_write_entity( $data );
		if ( $permission_error ) {
			return $permission_error;
		}

		$new_id = $this->repository->create( $data );
		if ( false === $new_id ) {
			return $this->db_error( __( 'Failed to duplicate Playbook Master.', 'pukat' ) );
		}

		AuditLogService::log(
			'playbook_master.duplicated',
			[ 'source_playbook_master_id' => $id, 'playbook_master_id' => $new_id ],
			null,
			'playbook_master',
			$new_id
		);

		return $this->get( $new_id ) ?: [];
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function submit_review( int $id, int $user_id ): array|WP_Error {
		return $this->transition_status(
			$id,
			'review',
			$user_id,
			'playbook_master.submitted_review',
			false
		);
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function approve( int $id, int $user_id ): array|WP_Error {
		return $this->transition_status(
			$id,
			'approved',
			$user_id,
			'playbook_master.approved',
			true
		);
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function archive( int $id, int $user_id ): array|WP_Error {
		return $this->transition_status(
			$id,
			'archived',
			$user_id,
			'playbook_master.archived',
			false
		);
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	private function transition_status( int $id, string $status, int $user_id, string $audit_action, bool $requires_ready ): array|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Playbook Master not found.', 'pukat' ) );
		}

		if ( 'active' === (string) ( $existing['status'] ?? '' ) && 'active' !== $status ) {
			return $this->active_playbook_error();
		}

		$permission_error = $this->enforce_existing_playbook_editable( $existing );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( $existing );
		if ( $usage_error ) {
			return $usage_error;
		}

		if ( 'archived' === (string) $existing['status'] && 'archived' !== $status ) {
			return new WP_Error(
				'playbook_archived',
				__( 'Archived Playbook Masters cannot change lifecycle status.', 'pukat' ),
				[ 'status' => 409 ]
			);
		}

		if ( $requires_ready ) {
			$readiness_error = $this->validate_ready_for_approval( $existing );
			if ( $readiness_error ) {
				return $readiness_error;
			}
		}

		$data = [
			'status'     => $status,
			'updated_by' => $user_id,
		];

		if ( 'approved' === $status ) {
			$data['approved_by'] = $user_id;
			$data['approved_at'] = current_time( 'mysql' );
		}

		$this->repository->update( $id, $data );

		AuditLogService::log( $audit_action, [ 'playbook_master_id' => $id ], null, 'playbook_master', $id );

		return $this->get( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $playbook DB row.
	 * @return array<string, mixed>
	 */
	private function prepare_playbook( array $playbook ): array {
		$components = $this->resolve_components( $playbook );
		$usage      = $this->active_campaign_run_usage( (int) ( $playbook['id'] ?? 0 ) );
		$status_locked = 'active' === (string) ( $playbook['status'] ?? '' );
		$usage_locked  = $usage['active_campaign_run_count'] > 0;
		$lock_reason   = '';
		if ( $status_locked ) {
			$lock_reason = __( 'This Playbook Master is active. Clone it or create a draft before changing it.', 'pukat' );
		} elseif ( $usage_locked ) {
			$lock_reason = __( 'This Playbook Master is used by an active Campaign Run.', 'pukat' );
		}

		return $this->decode_json_fields(
			array_merge(
				$playbook,
				[
					'components'        => $components,
					'readiness'         => $this->readiness_summary( $playbook ),
					'usage'             => $usage,
					'edit_locked'       => $usage_locked || $status_locked,
					'edit_lock_reason'  => $lock_reason,
				]
			),
			[
				'allowed_overrides_json' => 'allowed_overrides',
				'rules_json'             => 'rules',
				'metrics_json'           => 'metrics',
			]
		);
	}

	/**
	 * @param array<string, mixed> $playbook DB row.
	 * @return array<string, mixed>
	 */
	private function resolve_components( array $playbook ): array {
		$email_version_id   = (int) ( $playbook['default_email_template_version_id'] ?? 0 );
		$landing_version_id = (int) ( $playbook['default_landing_page_version_id'] ?? 0 );
		$sending_ref_id     = (int) ( $playbook['default_sending_profile_ref_id'] ?? 0 );
		$domain_id          = (int) ( $playbook['default_dynamic_domain_id'] ?? 0 );

		return [
			'email_template_version' => $email_version_id
				? $this->repository->find_component( 'email_template_versions', $email_version_id )
				: null,
			'landing_page_version'   => $landing_version_id
				? $this->repository->find_component( 'landing_page_versions', $landing_version_id )
				: null,
			'sending_profile_ref'    => $sending_ref_id
				? $this->decode_json_fields(
					$this->repository->find_component( 'sending_profile_refs', $sending_ref_id ) ?: [],
					[
						'allowed_domains_json' => 'allowed_domains',
						'rate_limit_json'      => 'rate_limit',
					]
				)
				: null,
			'dynamic_domain'         => $domain_id
				? $this->decode_json_fields(
					$this->repository->find_component( 'dynamic_domains', $domain_id ) ?: [],
					[
						'allowed_playbooks_json'        => 'allowed_playbooks',
						'allowed_sending_profiles_json' => 'allowed_sending_profiles',
					]
				)
				: null,
		];
	}

	/**
	 * @param array<string, mixed> $playbook Playbook row or sanitized data.
	 * @return array{ready: bool, errors: array<int, string>}
	 */
	private function readiness_summary( array $playbook ): array {
		$errors = $this->readiness_errors( $playbook );

		return [
			'ready'  => empty( $errors ),
			'errors' => $errors,
		];
	}

	/**
	 * @param array<string, mixed> $playbook Playbook row or sanitized data.
	 */
	private function validate_ready_for_approval( array $playbook ): ?WP_Error {
		$errors = $this->readiness_errors( $playbook );
		if ( empty( $errors ) ) {
			return null;
		}

		return new WP_Error(
			'playbook_not_ready',
			__( 'Playbook Master is not ready for approval or activation.', 'pukat' ),
			[
				'status' => 422,
				'errors' => $errors,
			]
		);
	}

	/**
	 * @return array{active_campaign_run_count: int, active_statuses: array<int, string>}
	 */
	private function active_campaign_run_usage( int $playbook_id ): array {
		$count = $playbook_id > 0
			? $this->repository->count_campaign_runs_for_playbook( $playbook_id, self::ACTIVE_CAMPAIGN_RUN_STATUSES )
			: 0;

		return [
			'active_campaign_run_count' => $count,
			'active_statuses'           => self::ACTIVE_CAMPAIGN_RUN_STATUSES,
		];
	}

	/**
	 * @param array<string, mixed> $playbook Existing DB row.
	 */
	private function enforce_not_used_by_active_campaign_run( array $playbook ): ?WP_Error {
		$usage = $this->active_campaign_run_usage( (int) ( $playbook['id'] ?? 0 ) );
		if ( $usage['active_campaign_run_count'] <= 0 ) {
			return null;
		}

		return new WP_Error(
			'playbook_locked_by_campaign_run',
			__( 'Playbook Master cannot be edited while it is used by an active Campaign Run.', 'pukat' ),
			[
				'status' => 409,
				'usage'  => $usage,
			]
		);
	}

	private function enforce_not_active_playbook( array $playbook ): ?WP_Error {
		if ( 'active' !== (string) ( $playbook['status'] ?? '' ) ) {
			return null;
		}

		return $this->active_playbook_error();
	}

	private function active_playbook_error(): WP_Error {
		return new WP_Error(
			'playbook_locked_by_active_status',
			__( 'Active Playbook Masters cannot be edited or archived. Clone it or create a draft before changing it.', 'pukat' ),
			[ 'status' => 409 ]
		);
	}

	/**
	 * @param array<string, mixed> $playbook Playbook row or sanitized data.
	 * @return array<int, string>
	 */
	private function readiness_errors( array $playbook ): array {
		$errors = [];

		$email_id = (int) ( $playbook['default_email_template_version_id'] ?? 0 );
		if ( ! $email_id ) {
			$errors[] = __( 'Default email template version is required.', 'pukat' );
		} else {
			$email = $this->repository->find_component( 'email_template_versions', $email_id );
			if ( ! $email ) {
				$errors[] = __( 'Default email template version was not found.', 'pukat' );
			} elseif ( ! in_array( (string) $email['status'], self::READY_STATUSES, true ) ) {
				$errors[] = __( 'Default email template version must be approved or active.', 'pukat' );
			}
		}

		$landing_id = (int) ( $playbook['default_landing_page_version_id'] ?? 0 );
		if ( ! $landing_id ) {
			$errors[] = __( 'Default landing page version is required.', 'pukat' );
		} else {
			$landing = $this->repository->find_component( 'landing_page_versions', $landing_id );
			if ( ! $landing ) {
				$errors[] = __( 'Default landing page version was not found.', 'pukat' );
			} elseif ( ! in_array( (string) $landing['status'], self::READY_STATUSES, true ) ) {
				$errors[] = __( 'Default landing page version must be approved or active.', 'pukat' );
			}
		}

		$sending_id = (int) ( $playbook['default_sending_profile_ref_id'] ?? 0 );
		if ( ! $sending_id ) {
			$errors[] = __( 'Default sending profile reference is required.', 'pukat' );
		} else {
			$sending = $this->repository->find_component( 'sending_profile_refs', $sending_id );
			if ( ! $sending ) {
				$errors[] = __( 'Default sending profile reference was not found.', 'pukat' );
			} elseif ( 'active' !== (string) $sending['status'] ) {
				$errors[] = __( 'Default sending profile reference must be active.', 'pukat' );
			} elseif ( empty( $sending['gophish_sending_profile_id'] ) ) {
				$errors[] = __( 'Default sending profile reference must map to a GoPhish sending profile ID.', 'pukat' );
			}
		}

		$domain_id = (int) ( $playbook['default_dynamic_domain_id'] ?? 0 );
		if ( $domain_id ) {
			$domain = $this->repository->find_component( 'dynamic_domains', $domain_id );
			if ( ! $domain ) {
				$errors[] = __( 'Default dynamic domain was not found.', 'pukat' );
			} elseif ( 'active' !== (string) $domain['status'] ) {
				$errors[] = __( 'Default dynamic domain must be active.', 'pukat' );
			} elseif ( 'authorized' !== (string) $domain['authorization_status'] ) {
				$errors[] = __( 'Default dynamic domain must be authorized.', 'pukat' );
			}
		}

		return $errors;
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 * @return array<string, mixed>
	 */
	private function sanitize_data( array $params, ?array $existing = null ): array {
		$status = $this->status_value( $params, $existing );

		return [
			'name'                                => $this->text_value( $params, 'name', $existing ),
			'description'                         => $this->textarea_value( $params, 'description', $existing ),
			'objective'                           => $this->textarea_value( $params, 'objective', $existing ),
			'scenario'                            => $this->text_value( $params, 'scenario', $existing ),
			'difficulty'                          => min( max( (int) $this->raw_value( $params, 'difficulty', $existing, 1 ), 1 ), 5 ),
			'risk_level'                          => $this->text_value( $params, 'risk_level', $existing ),
			'default_email_template_version_id'   => (int) $this->raw_value( $params, 'default_email_template_version_id', $existing ) ?: null,
			'default_landing_page_version_id'     => (int) $this->raw_value( $params, 'default_landing_page_version_id', $existing ) ?: null,
			'default_sending_profile_ref_id'      => (int) $this->raw_value( $params, 'default_sending_profile_ref_id', $existing ) ?: null,
			'default_dynamic_domain_id'           => (int) $this->raw_value( $params, 'default_dynamic_domain_id', $existing ) ?: null,
			'allowed_overrides_json'              => $this->json_value( $params, 'allowed_overrides', 'allowed_overrides_json', $existing ),
			'rules_json'                          => $this->json_value( $params, 'rules', 'rules_json', $existing ),
			'metrics_json'                        => $this->json_value( $params, 'metrics', 'metrics_json', $existing ),
			'entity'                              => $this->text_value( $params, 'entity', $existing, self::GENERAL_ENTITY ),
			'status'                              => $status,
			'version'                             => (int) $this->raw_value( $params, 'version', $existing, 1 ) ?: 1,
		];
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function text_value( array $params, string $key, ?array $existing = null, string $default = '' ): string {
		return sanitize_text_field( (string) $this->raw_value( $params, $key, $existing, $default ) );
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function textarea_value( array $params, string $key, ?array $existing = null, string $default = '' ): string {
		return sanitize_textarea_field( (string) $this->raw_value( $params, $key, $existing, $default ) );
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 * @return mixed
	 */
	private function raw_value( array $params, string $key, ?array $existing = null, mixed $default = '' ): mixed {
		if ( array_key_exists( $key, $params ) ) {
			return $params[ $key ];
		}

		return $existing[ $key ] ?? $default;
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function status_value( array $params, ?array $existing = null ): string {
		$status = sanitize_key( (string) $this->raw_value( $params, 'status', $existing, 'draft' ) );

		return in_array( $status, self::STATUS_VALUES, true ) ? $status : 'draft';
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function json_value( array $params, string $input_key, string $db_key, ?array $existing = null ): ?string {
		if ( ! array_key_exists( $input_key, $params ) && ! array_key_exists( $db_key, $params ) ) {
			return isset( $existing[ $db_key ] ) ? (string) $existing[ $db_key ] : null;
		}

		$value = array_key_exists( $input_key, $params ) ? $params[ $input_key ] : $params[ $db_key ];
		if ( null === $value || '' === $value ) {
			return null;
		}

		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			if ( JSON_ERROR_NONE === json_last_error() ) {
				return wp_json_encode( $decoded );
			}
		}

		return wp_json_encode( $value );
	}

	/**
	 * @param array<string, mixed>      $data     Sanitized row data.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function enforce_write_entity( array &$data, ?array $existing = null ): ?WP_Error {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity = $this->current_user_entity();
		if ( '' === trim( $user_entity ) ) {
			return $this->forbidden_error( __( 'Your user must have an entity before editing Playbook Masters.', 'pukat' ) );
		}

		if ( null !== $existing ) {
			$existing_error = $this->enforce_existing_playbook_editable( $existing );
			if ( $existing_error ) {
				return $existing_error;
			}
		}

		$requested_entity = trim( (string) ( $data['entity'] ?? '' ) );
		if ( '' !== $requested_entity && strtolower( $requested_entity ) !== strtolower( $user_entity ) ) {
			return $this->forbidden_error( __( 'Non-admin users can only write Playbook Masters assigned to their own entity.', 'pukat' ) );
		}

		$data['entity'] = sanitize_text_field( $user_entity );

		return null;
	}

	/**
	 * @param array<string, mixed> $playbook Existing DB row.
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

		return $this->forbidden_error( __( 'General Playbook Masters and Playbook Masters from other entities can only be edited by admins.', 'pukat' ) );
	}

	/**
	 * @param array<int, array<string, mixed>> $playbooks DB rows.
	 * @return array<int, array<string, mixed>>
	 */
	private function filter_playbooks_for_current_user( array $playbooks ): array {
		return array_values( array_filter(
			$playbooks,
			[ $this, 'current_user_can_access_playbook' ]
		) );
	}

	/**
	 * @param array<string, mixed> $playbook DB row.
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
	 * @param array<string, mixed> $row    DB row.
	 * @param array<string, string> $fields Map db_json_field => decoded_output_field.
	 * @return array<string, mixed>
	 */
	private function decode_json_fields( array $row, array $fields ): array {
		foreach ( $fields as $db_key => $output_key ) {
			$row[ $output_key ] = null;
			if ( ! empty( $row[ $db_key ] ) ) {
				$decoded            = json_decode( (string) $row[ $db_key ], true );
				$row[ $output_key ] = JSON_ERROR_NONE === json_last_error() ? $decoded : null;
			}
		}

		return $row;
	}

	private function current_user_can_admin_assets(): bool {
		return current_user_can( 'pukat_manage_settings' ) || current_user_can( 'administrator' );
	}

	private function current_user_entity(): string {
		$user_id = get_current_user_id();
		$entity  = (string) get_user_meta( $user_id, 'entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
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
