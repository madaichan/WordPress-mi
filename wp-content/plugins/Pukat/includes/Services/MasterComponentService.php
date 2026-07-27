<?php
/**
 * Master component business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\MasterComponentRepository;
use WP_Error;

/**
 * Coordinates validation, persistence, and audit logging for master components.
 */
class MasterComponentService {

	private const GENERAL_ENTITY = 'General';

	private const EMAIL_MASTER_TABLE   = 'email_template_masters';
	private const EMAIL_VERSION_TABLE  = 'email_template_versions';
	private const EMAIL_VERSION_FK     = 'template_master_id';
	private const LANDING_MASTER_TABLE = 'landing_page_masters';
	private const LANDING_VERSION_TABLE = 'landing_page_versions';
	private const LANDING_VERSION_FK   = 'landing_page_master_id';
	private const SENDING_TABLE        = 'sending_profile_refs';
	private const DOMAIN_TABLE         = 'dynamic_domains';

	private const STATUS_VALUES = [
		'draft',
		'review',
		'approved',
		'active',
		'inactive',
		'deprecated',
		'archived',
	];

	private const ACTIVE_CAMPAIGN_RUN_STATUSES = [
		'ready_for_sync',
		'syncing',
		'sync_failed',
		'synced',
		'scheduled',
		'running',
	];

	private const ACTIVE_LEGACY_CAMPAIGN_STATUSES = [
		'active',
		'scheduled',
		'running',
	];

	private MasterComponentRepository $repository;

	/**
	 * @var array<int, array<string, mixed>>|null
	 */
	private ?array $active_campaign_run_rows = null;

	public function __construct( ?MasterComponentRepository $repository = null ) {
		$this->repository = $repository ?? new MasterComponentRepository();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_email_templates(): array {
		return array_map(
			[ $this, 'prepare_email_template_master' ],
			$this->filter_rows_for_current_user( $this->repository->all( self::EMAIL_MASTER_TABLE ), 'entity' )
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get_email_template( int $id ): ?array {
		$master = $this->repository->find( self::EMAIL_MASTER_TABLE, $id );
		if ( ! $master || ! $this->current_user_can_access_row( $master, 'entity' ) ) {
			return null;
		}

		return $this->prepare_email_template_master( $master );
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create_email_template( array $params, int $user_id ): array|WP_Error {
		$master_data = $this->sanitize_email_template_master_data( $params );
		if ( empty( $master_data['name'] ) ) {
			return $this->validation_error( __( 'Email template name is required.', 'pukat' ) );
		}

		$version_data = null;
		if ( $this->has_email_version_payload( $params ) ) {
			$version_data = $this->sanitize_email_template_version_data( $params );
			if ( is_wp_error( $version_data ) ) {
				return $version_data;
			}
		}

		$permission_error = $this->enforce_write_entity( $master_data, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$master_data['created_by'] = $user_id;
		$id                        = $this->repository->create( self::EMAIL_MASTER_TABLE, $master_data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create email template master.', 'pukat' ) );
		}

		if ( null !== $version_data ) {
			$version_data[ self::EMAIL_VERSION_FK ] = $id;
			$version_data['version']                = 1;
			$version_data['created_by']             = $user_id;
			$this->repository->create( self::EMAIL_VERSION_TABLE, $version_data );
		}

		AuditLogService::log(
			'master.email_template.created',
			[ 'email_template_master_id' => $id, 'name' => $master_data['name'] ],
			null,
			'email_template_master',
			$id
		);

		return $this->get_email_template( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update_email_template( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( self::EMAIL_MASTER_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Email template master not found.', 'pukat' ) );
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'email_template', $id, __( 'Email template master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$data             = $this->sanitize_email_template_master_data( $params, $existing );
		$permission_error = $this->enforce_write_entity( $data, 'entity', $existing );
		if ( $permission_error ) {
			return $permission_error;
		}

		$data['updated_by'] = $user_id;
		$this->repository->update( self::EMAIL_MASTER_TABLE, $id, $data );

		AuditLogService::log( 'master.email_template.updated', [ 'email_template_master_id' => $id ], null, 'email_template_master', $id );

		return $this->get_email_template( $id ) ?: [];
	}

	public function delete_email_template( int $id ): bool|WP_Error {
		$existing = $this->repository->find( self::EMAIL_MASTER_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Email template master not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $existing, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'email_template', $id, __( 'Email template master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$this->repository->delete_where( self::EMAIL_VERSION_TABLE, [ self::EMAIL_VERSION_FK => $id ] );
		$this->repository->delete( self::EMAIL_MASTER_TABLE, $id );

		AuditLogService::log( 'master.email_template.deleted', [ 'email_template_master_id' => $id ], null, 'email_template_master', $id );

		return true;
	}

	/**
	 * @return array<int, array<string, mixed>>|WP_Error
	 */
	public function list_email_template_versions( int $master_id ): array|WP_Error {
		$master = $this->repository->find( self::EMAIL_MASTER_TABLE, $master_id );
		if ( ! $master ) {
			return $this->not_found_error( __( 'Email template master not found.', 'pukat' ) );
		}
		if ( ! $this->current_user_can_access_row( $master, 'entity' ) ) {
			return $this->forbidden_error( __( 'You do not have access to this email template master.', 'pukat' ) );
		}

		return array_map(
			[ $this, 'prepare_email_template_version' ],
			$this->repository->versions( self::EMAIL_VERSION_TABLE, self::EMAIL_VERSION_FK, $master_id )
		);
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create_email_template_version( int $master_id, array $params, int $user_id ): array|WP_Error {
		$master = $this->repository->find( self::EMAIL_MASTER_TABLE, $master_id );
		if ( ! $master ) {
			return $this->not_found_error( __( 'Email template master not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $master, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'email_template', $master_id, __( 'Email template master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$data = $this->sanitize_email_template_version_data( $params );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$data[ self::EMAIL_VERSION_FK ] = $master_id;
		$data['version']                = $this->repository->next_version( self::EMAIL_VERSION_TABLE, self::EMAIL_VERSION_FK, $master_id );
		$data['created_by']             = $user_id;

		$id = $this->repository->create( self::EMAIL_VERSION_TABLE, $data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create email template version.', 'pukat' ) );
		}

		AuditLogService::log(
			'master.email_template_version.created',
			[ 'email_template_master_id' => $master_id, 'email_template_version_id' => $id ],
			null,
			'email_template_version',
			$id
		);

		return $this->prepare_email_template_version( $this->repository->find( self::EMAIL_VERSION_TABLE, $id ) ?: [] );
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update_email_template_version( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( self::EMAIL_VERSION_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Email template version not found.', 'pukat' ) );
		}

		if ( in_array( (string) $existing['status'], [ 'approved', 'active' ], true ) ) {
			return new WP_Error(
				'version_locked',
				__( 'Approved or active email template versions cannot be edited. Create a new version instead.', 'pukat' ),
				[ 'status' => 409 ]
			);
		}

		$master = $this->repository->find( self::EMAIL_MASTER_TABLE, (int) $existing[ self::EMAIL_VERSION_FK ] );
		if ( ! $master ) {
			return $this->not_found_error( __( 'Email template master not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $master, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'email_template', (int) $existing[ self::EMAIL_VERSION_FK ], __( 'Email template master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$data = $this->sanitize_email_template_version_data( $params, $existing );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$data['updated_by'] = $user_id;
		$this->repository->update( self::EMAIL_VERSION_TABLE, $id, $data );

		AuditLogService::log( 'master.email_template_version.updated', [ 'email_template_version_id' => $id ], null, 'email_template_version', $id );

		return $this->prepare_email_template_version( $this->repository->find( self::EMAIL_VERSION_TABLE, $id ) ?: [] );
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function approve_email_template_version( int $id, int $user_id ): array|WP_Error {
		$version = $this->repository->find( self::EMAIL_VERSION_TABLE, $id );
		if ( ! $version ) {
			return $this->not_found_error( __( 'Email template version not found.', 'pukat' ) );
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'email_template', (int) $version[ self::EMAIL_VERSION_FK ], __( 'Email template master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		return $this->approve_version(
			self::EMAIL_VERSION_TABLE,
			self::EMAIL_MASTER_TABLE,
			self::EMAIL_VERSION_FK,
			$id,
			$user_id,
			'master.email_template_version.approved',
			'email_template_version',
			[ $this, 'prepare_email_template_version' ],
			__( 'Email template version not found.', 'pukat' )
		);
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_landing_pages(): array {
		return array_map(
			[ $this, 'prepare_landing_page_master' ],
			$this->filter_rows_for_current_user( $this->repository->all( self::LANDING_MASTER_TABLE ), 'entity' )
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get_landing_page( int $id ): ?array {
		$master = $this->repository->find( self::LANDING_MASTER_TABLE, $id );
		if ( ! $master || ! $this->current_user_can_access_row( $master, 'entity' ) ) {
			return null;
		}

		return $this->prepare_landing_page_master( $master );
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create_landing_page( array $params, int $user_id ): array|WP_Error {
		$master_data = $this->sanitize_landing_page_master_data( $params );
		if ( empty( $master_data['name'] ) ) {
			return $this->validation_error( __( 'Landing page name is required.', 'pukat' ) );
		}

		$version_data = null;
		if ( $this->has_landing_version_payload( $params ) ) {
			$version_data = $this->sanitize_landing_page_version_data( $params );
			if ( is_wp_error( $version_data ) ) {
				return $version_data;
			}
		}

		$permission_error = $this->enforce_write_entity( $master_data, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$master_data['created_by'] = $user_id;
		$id                        = $this->repository->create( self::LANDING_MASTER_TABLE, $master_data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create landing page master.', 'pukat' ) );
		}

		if ( null !== $version_data ) {
			$version_data[ self::LANDING_VERSION_FK ] = $id;
			$version_data['version']                  = 1;
			$version_data['created_by']               = $user_id;
			$this->repository->create( self::LANDING_VERSION_TABLE, $version_data );
		}

		AuditLogService::log(
			'master.landing_page.created',
			[ 'landing_page_master_id' => $id, 'name' => $master_data['name'] ],
			null,
			'landing_page_master',
			$id
		);

		return $this->get_landing_page( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update_landing_page( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( self::LANDING_MASTER_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Landing page master not found.', 'pukat' ) );
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'landing_page', $id, __( 'Landing page master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$data             = $this->sanitize_landing_page_master_data( $params, $existing );
		$permission_error = $this->enforce_write_entity( $data, 'entity', $existing );
		if ( $permission_error ) {
			return $permission_error;
		}

		$data['updated_by'] = $user_id;
		$this->repository->update( self::LANDING_MASTER_TABLE, $id, $data );

		AuditLogService::log( 'master.landing_page.updated', [ 'landing_page_master_id' => $id ], null, 'landing_page_master', $id );

		return $this->get_landing_page( $id ) ?: [];
	}

	public function delete_landing_page( int $id ): bool|WP_Error {
		$existing = $this->repository->find( self::LANDING_MASTER_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Landing page master not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $existing, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'landing_page', $id, __( 'Landing page master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$this->repository->delete_where( self::LANDING_VERSION_TABLE, [ self::LANDING_VERSION_FK => $id ] );
		$this->repository->delete( self::LANDING_MASTER_TABLE, $id );

		AuditLogService::log( 'master.landing_page.deleted', [ 'landing_page_master_id' => $id ], null, 'landing_page_master', $id );

		return true;
	}

	/**
	 * @return array<int, array<string, mixed>>|WP_Error
	 */
	public function list_landing_page_versions( int $master_id ): array|WP_Error {
		$master = $this->repository->find( self::LANDING_MASTER_TABLE, $master_id );
		if ( ! $master ) {
			return $this->not_found_error( __( 'Landing page master not found.', 'pukat' ) );
		}
		if ( ! $this->current_user_can_access_row( $master, 'entity' ) ) {
			return $this->forbidden_error( __( 'You do not have access to this landing page master.', 'pukat' ) );
		}

		return array_map(
			[ $this, 'prepare_landing_page_version' ],
			$this->repository->versions( self::LANDING_VERSION_TABLE, self::LANDING_VERSION_FK, $master_id )
		);
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create_landing_page_version( int $master_id, array $params, int $user_id ): array|WP_Error {
		$master = $this->repository->find( self::LANDING_MASTER_TABLE, $master_id );
		if ( ! $master ) {
			return $this->not_found_error( __( 'Landing page master not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $master, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'landing_page', $master_id, __( 'Landing page master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$data = $this->sanitize_landing_page_version_data( $params );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$data[ self::LANDING_VERSION_FK ] = $master_id;
		$data['version']                  = $this->repository->next_version( self::LANDING_VERSION_TABLE, self::LANDING_VERSION_FK, $master_id );
		$data['created_by']               = $user_id;

		$id = $this->repository->create( self::LANDING_VERSION_TABLE, $data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create landing page version.', 'pukat' ) );
		}

		AuditLogService::log(
			'master.landing_page_version.created',
			[ 'landing_page_master_id' => $master_id, 'landing_page_version_id' => $id ],
			null,
			'landing_page_version',
			$id
		);

		return $this->prepare_landing_page_version( $this->repository->find( self::LANDING_VERSION_TABLE, $id ) ?: [] );
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update_landing_page_version( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( self::LANDING_VERSION_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Landing page version not found.', 'pukat' ) );
		}

		if ( in_array( (string) $existing['status'], [ 'approved', 'active' ], true ) ) {
			return new WP_Error(
				'version_locked',
				__( 'Approved or active landing page versions cannot be edited. Create a new version instead.', 'pukat' ),
				[ 'status' => 409 ]
			);
		}

		$master = $this->repository->find( self::LANDING_MASTER_TABLE, (int) $existing[ self::LANDING_VERSION_FK ] );
		if ( ! $master ) {
			return $this->not_found_error( __( 'Landing page master not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $master, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'landing_page', (int) $existing[ self::LANDING_VERSION_FK ], __( 'Landing page master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$data = $this->sanitize_landing_page_version_data( $params, $existing );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$data['updated_by'] = $user_id;
		$this->repository->update( self::LANDING_VERSION_TABLE, $id, $data );

		AuditLogService::log( 'master.landing_page_version.updated', [ 'landing_page_version_id' => $id ], null, 'landing_page_version', $id );

		return $this->prepare_landing_page_version( $this->repository->find( self::LANDING_VERSION_TABLE, $id ) ?: [] );
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function approve_landing_page_version( int $id, int $user_id ): array|WP_Error {
		$version = $this->repository->find( self::LANDING_VERSION_TABLE, $id );
		if ( ! $version ) {
			return $this->not_found_error( __( 'Landing page version not found.', 'pukat' ) );
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'landing_page', (int) $version[ self::LANDING_VERSION_FK ], __( 'Landing page master', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		return $this->approve_version(
			self::LANDING_VERSION_TABLE,
			self::LANDING_MASTER_TABLE,
			self::LANDING_VERSION_FK,
			$id,
			$user_id,
			'master.landing_page_version.approved',
			'landing_page_version',
			[ $this, 'prepare_landing_page_version' ],
			__( 'Landing page version not found.', 'pukat' )
		);
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_sending_profiles(): array {
		return array_map(
			[ $this, 'prepare_sending_profile' ],
			$this->filter_rows_for_current_user( $this->repository->all( self::SENDING_TABLE ), 'entity' )
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get_sending_profile( int $id ): ?array {
		$profile = $this->repository->find( self::SENDING_TABLE, $id );
		if ( ! $profile || ! $this->current_user_can_access_row( $profile, 'entity' ) ) {
			return null;
		}

		return $this->prepare_sending_profile( $profile );
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create_sending_profile( array $params, int $user_id ): array|WP_Error {
		$data = $this->sanitize_sending_profile_data( $params );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$permission_error = $this->enforce_write_entity( $data, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$data['created_by'] = $user_id;
		$id                 = $this->repository->create( self::SENDING_TABLE, $data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create sending profile reference.', 'pukat' ) );
		}

		AuditLogService::log(
			'master.sending_profile.created',
			[ 'sending_profile_ref_id' => $id, 'name' => $data['name'] ],
			null,
			'sending_profile_ref',
			$id
		);

		return $this->get_sending_profile( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update_sending_profile( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( self::SENDING_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Sending profile reference not found.', 'pukat' ) );
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'sending_profile', $id, __( 'Sending profile reference', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$data = $this->sanitize_sending_profile_data( $params, $existing );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$permission_error = $this->enforce_write_entity( $data, 'entity', $existing );
		if ( $permission_error ) {
			return $permission_error;
		}

		$data['updated_by'] = $user_id;
		$this->repository->update( self::SENDING_TABLE, $id, $data );

		AuditLogService::log( 'master.sending_profile.updated', [ 'sending_profile_ref_id' => $id ], null, 'sending_profile_ref', $id );

		return $this->get_sending_profile( $id ) ?: [];
	}

	public function delete_sending_profile( int $id ): bool|WP_Error {
		$existing = $this->repository->find( self::SENDING_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Sending profile reference not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $existing, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = $this->enforce_not_used_by_active_campaign_run( 'sending_profile', $id, __( 'Sending profile reference', 'pukat' ) );
		if ( $usage_error ) {
			return $usage_error;
		}

		$this->repository->delete( self::SENDING_TABLE, $id );

		AuditLogService::log( 'master.sending_profile.deleted', [ 'sending_profile_ref_id' => $id ], null, 'sending_profile_ref', $id );

		return true;
	}

	public function enforce_gophish_sending_profile_not_used( int $gophish_id ): ?WP_Error {
		$usage = $this->gophish_asset_usage( 'sending_profile', $gophish_id );
		if ( $usage['active_usage_count'] <= 0 ) {
			return null;
		}

		return new WP_Error(
			'master_component_locked_by_campaign_run',
			__( 'Sending profile cannot be edited or deleted while it is used by an active Campaign or Playbook.', 'pukat' ),
			[
				'status' => 409,
				'usage'  => $usage,
			]
		);
	}

	public function enforce_gophish_email_template_not_used( int $gophish_id ): ?WP_Error {
		$usage = $this->gophish_asset_usage( 'email_template', $gophish_id );
		if ( $usage['active_usage_count'] <= 0 ) {
			return null;
		}

		return new WP_Error(
			'master_component_locked_by_campaign_run',
			__( 'Email template cannot be edited or deleted while it is used by an active Campaign or Playbook.', 'pukat' ),
			[
				'status' => 409,
				'usage'  => $usage,
			]
		);
	}

	public function enforce_gophish_landing_page_not_used( int $gophish_id ): ?WP_Error {
		$usage = $this->gophish_asset_usage( 'landing_page', $gophish_id );
		if ( $usage['active_usage_count'] <= 0 ) {
			return null;
		}

		return new WP_Error(
			'master_component_locked_by_campaign_run',
			__( 'Landing page cannot be edited or deleted while it is used by an active Campaign or Playbook.', 'pukat' ),
			[
				'status' => 409,
				'usage'  => $usage,
			]
		);
	}

	/**
	 * Return usage metadata for GoPhish assets shown on non-master pages.
	 *
	 * @return array<string, mixed>
	 */
	public function gophish_asset_usage( string $asset_type, int $gophish_id ): array {
		if ( $gophish_id <= 0 ) {
			return $this->empty_active_usage();
		}

		return match ( $asset_type ) {
			'email_template'  => $this->gophish_asset_usage_from_columns( 'gophish_template_id', 'gophish_template_id', $gophish_id ),
			'landing_page'    => $this->gophish_asset_usage_from_columns( 'gophish_page_id', 'gophish_page_id', $gophish_id ),
			'sending_profile' => $this->gophish_sending_profile_usage( $gophish_id ),
			default           => $this->empty_active_usage(),
		};
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function validate_sending_profile_gophish_mapping( int $id ): array|WP_Error {
		$profile = $this->repository->find( self::SENDING_TABLE, $id );
		if ( ! $profile ) {
			return $this->not_found_error( __( 'Sending profile reference not found.', 'pukat' ) );
		}
		if ( ! $this->current_user_can_access_row( $profile, 'entity' ) ) {
			return $this->forbidden_error( __( 'You do not have access to this sending profile reference.', 'pukat' ) );
		}

		$gophish_id = (int) ( $profile['gophish_sending_profile_id'] ?? 0 );
		if ( ! $gophish_id ) {
			return $this->validation_error( __( 'GoPhish sending profile ID is required before validation.', 'pukat' ) );
		}

		$gophish_profile = ( new GoPhishService() )->get_sending_profile( $gophish_id );
		if ( is_wp_error( $gophish_profile ) ) {
			return $gophish_profile;
		}

		unset( $gophish_profile['password'] );

		AuditLogService::log( 'master.sending_profile.validated', [ 'sending_profile_ref_id' => $id, 'gophish_id' => $gophish_id ], null, 'sending_profile_ref', $id );

		return [
			'valid'           => true,
			'sending_profile' => $this->prepare_sending_profile( $profile ),
			'gophish_profile' => $gophish_profile,
		];
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list_dynamic_domains(): array {
		return array_map(
			[ $this, 'prepare_dynamic_domain' ],
			$this->filter_rows_for_current_user( $this->repository->all( self::DOMAIN_TABLE ), 'owner_entity' )
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get_dynamic_domain( int $id ): ?array {
		$domain = $this->repository->find( self::DOMAIN_TABLE, $id );
		if ( ! $domain || ! $this->current_user_can_access_row( $domain, 'owner_entity' ) ) {
			return null;
		}

		return $this->prepare_dynamic_domain( $domain );
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create_dynamic_domain( array $params, int $user_id ): array|WP_Error {
		$data = $this->sanitize_dynamic_domain_data( $params );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$permission_error = $this->enforce_write_entity( $data, 'owner_entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$data['created_by'] = $user_id;
		$id                 = $this->repository->create( self::DOMAIN_TABLE, $data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create dynamic domain.', 'pukat' ) );
		}

		AuditLogService::log(
			'master.dynamic_domain.created',
			[ 'dynamic_domain_id' => $id, 'domain' => $data['domain'] ],
			null,
			'dynamic_domain',
			$id
		);

		return $this->get_dynamic_domain( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update_dynamic_domain( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( self::DOMAIN_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Dynamic domain not found.', 'pukat' ) );
		}

		$data = $this->sanitize_dynamic_domain_data( $params, $existing );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$permission_error = $this->enforce_write_entity( $data, 'owner_entity', $existing );
		if ( $permission_error ) {
			return $permission_error;
		}

		$data['updated_by'] = $user_id;
		$this->repository->update( self::DOMAIN_TABLE, $id, $data );

		AuditLogService::log( 'master.dynamic_domain.updated', [ 'dynamic_domain_id' => $id ], null, 'dynamic_domain', $id );

		return $this->get_dynamic_domain( $id ) ?: [];
	}

	public function delete_dynamic_domain( int $id ): bool|WP_Error {
		$existing = $this->repository->find( self::DOMAIN_TABLE, $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Dynamic domain not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $existing, 'owner_entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$this->repository->delete( self::DOMAIN_TABLE, $id );

		AuditLogService::log( 'master.dynamic_domain.deleted', [ 'dynamic_domain_id' => $id ], null, 'dynamic_domain', $id );

		return true;
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function health_check_dynamic_domain( int $id ): array|WP_Error {
		$domain = $this->repository->find( self::DOMAIN_TABLE, $id );
		if ( ! $domain ) {
			return $this->not_found_error( __( 'Dynamic domain not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $domain, 'owner_entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$domain_name = (string) $domain['domain'];
		$dns_status  = $this->domain_has_dns_record( $domain_name ) ? 'healthy' : 'unhealthy';
		$tls_status  = $this->domain_has_tls( (string) ( $domain['base_landing_url'] ?: $domain_name ) ) ? 'healthy' : 'unhealthy';

		$this->repository->update(
			self::DOMAIN_TABLE,
			$id,
			[
				'dns_status' => $dns_status,
				'tls_status' => $tls_status,
			]
		);

		AuditLogService::log(
			'master.dynamic_domain.health_checked',
			[ 'dynamic_domain_id' => $id, 'dns_status' => $dns_status, 'tls_status' => $tls_status ],
			null,
			'dynamic_domain',
			$id
		);

		return $this->get_dynamic_domain( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $row DB row.
	 * @return array<string, mixed>
	 */
	private function prepare_email_template_master( array $row ): array {
		$row['versions']       = array_map(
			[ $this, 'prepare_email_template_version' ],
			$this->repository->versions( self::EMAIL_VERSION_TABLE, self::EMAIL_VERSION_FK, (int) $row['id'] )
		);
		$row['latest_version'] = $row['versions'][0] ?? null;

		return $this->with_component_usage( $row, 'email_template', (int) $row['id'], __( 'Email template master', 'pukat' ) );
	}

	/**
	 * @param array<string, mixed> $row DB row.
	 * @return array<string, mixed>
	 */
	private function prepare_email_template_version( array $row ): array {
		return $this->decode_json_fields( $row, [ 'variables_json' => 'variables' ] );
	}

	/**
	 * @param array<string, mixed> $row DB row.
	 * @return array<string, mixed>
	 */
	private function prepare_landing_page_master( array $row ): array {
		$row['versions']       = array_map(
			[ $this, 'prepare_landing_page_version' ],
			$this->repository->versions( self::LANDING_VERSION_TABLE, self::LANDING_VERSION_FK, (int) $row['id'] )
		);
		$row['latest_version'] = $row['versions'][0] ?? null;

		return $this->with_component_usage( $row, 'landing_page', (int) $row['id'], __( 'Landing page master', 'pukat' ) );
	}

	/**
	 * @param array<string, mixed> $row DB row.
	 * @return array<string, mixed>
	 */
	private function prepare_landing_page_version( array $row ): array {
		return $this->decode_json_fields(
			$row,
			[
				'capture_settings_json'  => 'capture_settings',
				'redirect_settings_json' => 'redirect_settings',
				'variables_json'         => 'variables',
			]
		);
	}

	/**
	 * @param array<string, mixed> $row DB row.
	 * @return array<string, mixed>
	 */
	private function prepare_sending_profile( array $row ): array {
		$row = $this->decode_json_fields(
			$row,
			[
				'allowed_domains_json' => 'allowed_domains',
				'rate_limit_json'      => 'rate_limit',
			]
		);

		return $this->with_component_usage( $row, 'sending_profile', (int) $row['id'], __( 'Sending profile reference', 'pukat' ) );
	}

	/**
	 * @param array<string, mixed> $row DB row.
	 * @return array<string, mixed>
	 */
	private function prepare_dynamic_domain( array $row ): array {
		return $this->decode_json_fields(
			$row,
			[
				'allowed_playbooks_json'        => 'allowed_playbooks',
				'allowed_sending_profiles_json' => 'allowed_sending_profiles',
			]
		);
	}

	/**
	 * Add Campaign Run usage metadata used by the frontend to lock edits.
	 *
	 * @param array<string, mixed> $row DB row.
	 * @return array<string, mixed>
	 */
	private function with_component_usage( array $row, string $component, int $component_id, string $label ): array {
		$usage  = $this->active_component_usage( $component, $component_id );
		$locked = $usage['active_usage_count'] > 0;

		$row['usage']            = $usage;
		$row['edit_locked']      = $locked;
		$row['edit_lock_reason'] = $locked
			? sprintf(
				/* translators: %s: master component label. */
				__( '%s is used by an active Campaign or Playbook.', 'pukat' ),
				$label
			)
			: '';

		return $row;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function active_component_usage( string $component, int $component_id ): array {
		$campaign_usage       = $this->active_campaign_run_usage( $component, $component_id );
		$active_playbook_count = $this->active_playbook_usage_count( $component, $component_id );

		return $this->usage_summary(
			$campaign_usage['active_campaign_run_count'],
			$active_playbook_count,
			0
		);
	}

	/**
	 * @return array{active_campaign_run_count: int}
	 */
	private function active_campaign_run_usage( string $component, int $component_id ): array {
		$count = 0;

		foreach ( $this->active_campaign_run_rows() as $run ) {
			if ( $this->campaign_run_snapshot_uses_component( $run, $component, $component_id ) ) {
				$count++;
			}
		}

		return [
			'active_campaign_run_count' => $count,
		];
	}

	private function active_playbook_usage_count( string $component, int $component_id ): int {
		if ( $component_id <= 0 ) {
			return 0;
		}

		return match ( $component ) {
			'email_template'  => $this->active_playbook_usage_count_for_master_versions( self::EMAIL_VERSION_TABLE, self::EMAIL_VERSION_FK, $component_id, 'default_email_template_version_id' ),
			'landing_page'    => $this->active_playbook_usage_count_for_master_versions( self::LANDING_VERSION_TABLE, self::LANDING_VERSION_FK, $component_id, 'default_landing_page_version_id' ),
			'sending_profile' => $this->repository->count_active_playbook_masters_for_component( 'default_sending_profile_ref_id', $component_id ),
			default           => 0,
		};
	}

	private function active_playbook_usage_count_for_master_versions( string $version_table, string $foreign_key, int $master_id, string $playbook_column ): int {
		$count = 0;
		foreach ( $this->repository->versions( $version_table, $foreign_key, $master_id ) as $version ) {
			$count += $this->repository->count_active_playbook_masters_for_component( $playbook_column, (int) ( $version['id'] ?? 0 ) );
		}

		return $count;
	}

	/**
	 * @return array<string, mixed>
	 */
	private function active_campaign_run_usage_for_gophish_sending_profile( int $gophish_id ): array {
		if ( $gophish_id <= 0 ) {
			return $this->usage_summary( 0, 0, 0 );
		}

		$matching_ref_ids = [];
		foreach ( $this->repository->all( self::SENDING_TABLE ) as $profile ) {
			if ( (int) ( $profile['gophish_sending_profile_id'] ?? 0 ) === $gophish_id ) {
				$matching_ref_ids[] = (int) ( $profile['id'] ?? 0 );
			}
		}

		$count = 0;
		foreach ( $this->active_campaign_run_rows() as $run ) {
			$direct_match = (int) ( $run['gophish_sending_profile_id'] ?? 0 ) === $gophish_id;
			$snapshot     = json_decode( (string) ( $run['snapshot_json'] ?? '' ), true );
			$ref_id       = is_array( $snapshot ) ? (int) ( $snapshot['sending_profile']['ref_id'] ?? 0 ) : 0;

			if ( $direct_match || in_array( $ref_id, $matching_ref_ids, true ) ) {
				$count++;
			}
		}

		return $this->usage_summary(
			$count,
			$this->repository->count_active_playbook_masters_for_gophish_sending_profile( $gophish_id ),
			$this->repository->count_legacy_campaigns_for_gophish_asset( 'gophish_smtp_id', $gophish_id, self::ACTIVE_LEGACY_CAMPAIGN_STATUSES )
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	private function active_campaign_run_usage_for_gophish_asset( string $column, int $gophish_id ): array {
		if ( $gophish_id <= 0 ) {
			return $this->usage_summary( 0, 0, 0 );
		}

		$count = 0;
		foreach ( $this->active_campaign_run_rows() as $run ) {
			if ( (int) ( $run[ $column ] ?? 0 ) === $gophish_id ) {
				$count++;
			}
		}

		return $this->usage_summary( $count, 0, 0 );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function gophish_asset_usage_from_columns( string $run_column, string $legacy_playbook_column, int $gophish_id ): array {
		$campaign_usage = $this->active_campaign_run_usage_for_gophish_asset( $run_column, $gophish_id );

		return $this->usage_summary(
			(int) $campaign_usage['active_campaign_run_count'],
			0,
			$this->repository->count_legacy_campaigns_for_gophish_asset( $legacy_playbook_column, $gophish_id, self::ACTIVE_LEGACY_CAMPAIGN_STATUSES )
		);
	}

	/**
	 * @return array<string, mixed>
	 */
	private function gophish_sending_profile_usage( int $gophish_id ): array {
		return $this->active_campaign_run_usage_for_gophish_sending_profile( $gophish_id );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function empty_active_usage(): array {
		return $this->usage_summary( 0, 0, 0 );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function usage_summary( int $campaign_run_count, int $playbook_count, int $legacy_campaign_count ): array {
		return [
			'active_campaign_run_count'      => $campaign_run_count,
			'active_playbook_count'          => $playbook_count,
			'active_legacy_campaign_count'   => $legacy_campaign_count,
			'active_usage_count'             => $campaign_run_count + $playbook_count + $legacy_campaign_count,
			'active_statuses'                => self::ACTIVE_CAMPAIGN_RUN_STATUSES,
			'active_playbook_statuses'       => [ 'active' ],
			'active_legacy_campaign_statuses' => self::ACTIVE_LEGACY_CAMPAIGN_STATUSES,
		];
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	private function active_campaign_run_rows(): array {
		if ( null === $this->active_campaign_run_rows ) {
			$this->active_campaign_run_rows = $this->repository->campaign_runs_by_status( self::ACTIVE_CAMPAIGN_RUN_STATUSES );
		}

		return $this->active_campaign_run_rows;
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 */
	private function campaign_run_snapshot_uses_component( array $run, string $component, int $component_id ): bool {
		if ( $component_id <= 0 || empty( $run['snapshot_json'] ) ) {
			return false;
		}

		$snapshot = json_decode( (string) $run['snapshot_json'], true );
		if ( ! is_array( $snapshot ) ) {
			return false;
		}

		return match ( $component ) {
			'email_template'  => (int) ( $snapshot['email_template']['master_id'] ?? 0 ) === $component_id,
			'landing_page'    => (int) ( $snapshot['landing_page']['master_id'] ?? 0 ) === $component_id,
			'sending_profile' => (int) ( $snapshot['sending_profile']['ref_id'] ?? 0 ) === $component_id,
			default           => false,
		};
	}

	private function enforce_not_used_by_active_campaign_run( string $component, int $component_id, string $label ): ?WP_Error {
		$usage = $this->active_component_usage( $component, $component_id );
		if ( $usage['active_usage_count'] <= 0 ) {
			return null;
		}

		return new WP_Error(
			'master_component_locked_by_campaign_run',
			sprintf(
				/* translators: %s: master component label. */
				__( '%s cannot be edited or deleted while it is used by an active Campaign or Playbook.', 'pukat' ),
				$label
			),
			[
				'status' => 409,
				'usage'  => $usage,
			]
		);
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 * @return array<string, mixed>
	 */
	private function sanitize_email_template_master_data( array $params, ?array $existing = null ): array {
		return [
			'name'        => $this->text_value( $params, 'name', $existing ),
			'description' => $this->textarea_value( $params, 'description', $existing ),
			'category'    => $this->text_value( $params, 'category', $existing ),
			'entity'      => $this->text_value( $params, 'entity', $existing, self::GENERAL_ENTITY ),
			'status'      => $this->status_value( $params, 'status', $existing ),
		];
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 * @return array<string, mixed>|WP_Error
	 */
	private function sanitize_email_template_version_data( array $params, ?array $existing = null ): array|WP_Error {
		$data = [
			'subject'        => $this->text_value( $params, 'subject', $existing ),
			'html_body'      => $this->html_value( $params, [ 'html_body', 'html' ], $existing ),
			'text_body'      => $this->textarea_value( $params, 'text_body', $existing ),
			'variables_json' => $this->json_value( $params, 'variables', 'variables_json', $existing ),
			'language'       => $this->text_value( $params, 'language', $existing ),
			'status'         => $this->status_value( $params, 'status', $existing ),
		];

		if ( '' === trim( (string) $data['subject'] ) || '' === trim( (string) $data['html_body'] ) ) {
			return $this->validation_error( __( 'Email template subject and HTML body are required for a version.', 'pukat' ) );
		}

		return $data;
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 * @return array<string, mixed>
	 */
	private function sanitize_landing_page_master_data( array $params, ?array $existing = null ): array {
		return [
			'name'        => $this->text_value( $params, 'name', $existing ),
			'description' => $this->textarea_value( $params, 'description', $existing ),
			'category'    => $this->text_value( $params, 'category', $existing ),
			'entity'      => $this->text_value( $params, 'entity', $existing, self::GENERAL_ENTITY ),
			'status'      => $this->status_value( $params, 'status', $existing ),
		];
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 * @return array<string, mixed>|WP_Error
	 */
	private function sanitize_landing_page_version_data( array $params, ?array $existing = null ): array|WP_Error {
		$data = [
			'html_body'              => $this->html_value( $params, [ 'html_body', 'html' ], $existing ),
			'capture_settings_json'  => $this->json_value( $params, 'capture_settings', 'capture_settings_json', $existing ),
			'redirect_settings_json' => $this->json_value( $params, 'redirect_settings', 'redirect_settings_json', $existing ),
			'variables_json'         => $this->json_value( $params, 'variables', 'variables_json', $existing ),
			'language'               => $this->text_value( $params, 'language', $existing ),
			'status'                 => $this->status_value( $params, 'status', $existing ),
		];

		if ( '' === trim( (string) $data['html_body'] ) ) {
			return $this->validation_error( __( 'Landing page HTML body is required for a version.', 'pukat' ) );
		}

		return $data;
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 * @return array<string, mixed>|WP_Error
	 */
	private function sanitize_sending_profile_data( array $params, ?array $existing = null ): array|WP_Error {
		$from_email = sanitize_email( $this->raw_value( $params, 'from_email', $existing ) ?: $this->raw_value( $params, 'from', $existing ) );

		$data = [
			'name'                       => $this->text_value( $params, 'name', $existing ),
			'from_name'                  => $this->text_value( $params, 'from_name', $existing ),
			'from_email'                 => $from_email,
			'reply_to'                   => sanitize_email( $this->raw_value( $params, 'reply_to', $existing ) ),
			'gophish_sending_profile_id' => (int) $this->raw_value( $params, 'gophish_sending_profile_id', $existing ) ?: null,
			'environment'                => $this->text_value( $params, 'environment', $existing, 'production' ),
			'allowed_domains_json'       => $this->json_value( $params, 'allowed_domains', 'allowed_domains_json', $existing ),
			'rate_limit_json'            => $this->json_value( $params, 'rate_limit', 'rate_limit_json', $existing ),
			'entity'                     => $this->text_value( $params, 'entity', $existing, self::GENERAL_ENTITY ),
			'status'                     => $this->status_value( $params, 'status', $existing ),
		];

		if ( '' === trim( (string) $data['name'] ) || ! is_email( $data['from_email'] ) ) {
			return $this->validation_error( __( 'Sending profile name and valid from email are required.', 'pukat' ) );
		}

		return $data;
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 * @return array<string, mixed>|WP_Error
	 */
	private function sanitize_dynamic_domain_data( array $params, ?array $existing = null ): array|WP_Error {
		$domain = $this->normalize_domain( (string) $this->raw_value( $params, 'domain', $existing ) );
		if ( '' === $domain ) {
			return $this->validation_error( __( 'A valid domain is required.', 'pukat' ) );
		}

		return [
			'domain'                         => $domain,
			'base_landing_url'               => esc_url_raw( (string) $this->raw_value( $params, 'base_landing_url', $existing ) ),
			'tracking_url'                   => esc_url_raw( (string) $this->raw_value( $params, 'tracking_url', $existing ) ),
			'environment'                    => $this->text_value( $params, 'environment', $existing, 'production' ),
			'owner_entity'                   => $this->text_value( $params, 'owner_entity', $existing, self::GENERAL_ENTITY ),
			'authorization_status'           => $this->authorization_status_value( $params, $existing ),
			'dns_status'                     => $this->text_value( $params, 'dns_status', $existing, 'unknown' ),
			'tls_status'                     => $this->text_value( $params, 'tls_status', $existing, 'unknown' ),
			'allowed_playbooks_json'         => $this->json_value( $params, 'allowed_playbooks', 'allowed_playbooks_json', $existing ),
			'allowed_sending_profiles_json'  => $this->json_value( $params, 'allowed_sending_profiles', 'allowed_sending_profiles_json', $existing ),
			'status'                         => $this->status_value( $params, 'status', $existing ),
		];
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 */
	private function has_email_version_payload( array $params ): bool {
		return array_key_exists( 'subject', $params )
			|| array_key_exists( 'html_body', $params )
			|| array_key_exists( 'html', $params )
			|| array_key_exists( 'text_body', $params );
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 */
	private function has_landing_version_payload( array $params ): bool {
		return array_key_exists( 'html_body', $params ) || array_key_exists( 'html', $params );
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
	 * @param array<int, string>        $keys     Accepted request keys.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function html_value( array $params, array $keys, ?array $existing = null ): string {
		foreach ( $keys as $key ) {
			if ( array_key_exists( $key, $params ) ) {
				return (string) $params[ $key ];
			}
		}

		return (string) ( $existing['html_body'] ?? '' );
	}

	/**
	 * @param array<string, mixed>      $params    Raw request params.
	 * @param array<string, mixed>|null $existing  Existing row.
	 * @return mixed
	 */
	private function raw_value( array $params, string $key, ?array $existing = null, mixed $default = '' ): mixed {
		if ( array_key_exists( $key, $params ) ) {
			return $params[ $key ];
		}

		return $existing[ $key ] ?? $default;
	}

	/**
	 * @param array<string, mixed>      $params       Raw request params.
	 * @param array<string, mixed>|null $existing     Existing row.
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
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function status_value( array $params, string $key = 'status', ?array $existing = null, string $default = 'draft' ): string {
		$status = sanitize_key( (string) $this->raw_value( $params, $key, $existing, $default ) );

		return in_array( $status, self::STATUS_VALUES, true ) ? $status : $default;
	}

	/**
	 * @param array<string, mixed>      $params   Raw request params.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function authorization_status_value( array $params, ?array $existing = null ): string {
		$status  = sanitize_key( (string) $this->raw_value( $params, 'authorization_status', $existing, 'pending' ) );
		$allowed = [ 'pending', 'authorized', 'rejected', 'expired' ];

		return in_array( $status, $allowed, true ) ? $status : 'pending';
	}

	/**
	 * @param array<string, mixed>      $data     Sanitized row data.
	 * @param array<string, mixed>|null $existing Existing row.
	 */
	private function enforce_write_entity( array &$data, string $entity_key, ?array $existing = null ): ?WP_Error {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity = $this->current_user_entity();
		if ( '' === trim( $user_entity ) ) {
			return $this->forbidden_error( __( 'Your user must have an entity before editing master components.', 'pukat' ) );
		}

		if ( null !== $existing ) {
			$existing_error = $this->enforce_existing_row_editable( $existing, $entity_key );
			if ( $existing_error ) {
				return $existing_error;
			}
		}

		$requested_entity = trim( (string) ( $data[ $entity_key ] ?? '' ) );
		if ( '' !== $requested_entity && strtolower( $requested_entity ) !== strtolower( $user_entity ) ) {
			return $this->forbidden_error( __( 'Non-admin users can only write master components assigned to their own entity.', 'pukat' ) );
		}

		$data[ $entity_key ] = sanitize_text_field( $user_entity );

		return null;
	}

	/**
	 * @param array<string, mixed> $row DB row.
	 */
	private function enforce_existing_row_editable( array $row, string $entity_key ): ?WP_Error {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity = strtolower( $this->current_user_entity() );
		$row_entity  = strtolower( trim( (string) ( $row[ $entity_key ] ?? '' ) ) );

		if ( '' !== $user_entity && '' !== $row_entity && strtolower( self::GENERAL_ENTITY ) !== $row_entity && $row_entity === $user_entity ) {
			return null;
		}

		return $this->forbidden_error( __( 'General components and components from other entities can only be edited by admins.', 'pukat' ) );
	}

	/**
	 * @param array<int, array<string, mixed>> $rows       DB rows.
	 * @return array<int, array<string, mixed>>
	 */
	private function filter_rows_for_current_user( array $rows, string $entity_key ): array {
		return array_values( array_filter(
			$rows,
			fn( array $row ): bool => $this->current_user_can_access_row( $row, $entity_key )
		) );
	}

	/**
	 * @param array<string, mixed> $row DB row.
	 */
	private function current_user_can_access_row( array $row, string $entity_key ): bool {
		if ( $this->current_user_can_admin_assets() ) {
			return true;
		}

		$row_entity = strtolower( trim( (string) ( $row[ $entity_key ] ?? '' ) ) );
		if ( strtolower( self::GENERAL_ENTITY ) === $row_entity ) {
			return true;
		}

		$user_entity = strtolower( $this->current_user_entity() );

		return '' !== $user_entity && $row_entity === $user_entity;
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

	/**
	 * @param callable(array<string, mixed>): array<string, mixed> $prepare_callback
	 * @return array<string, mixed>|WP_Error
	 */
	private function approve_version(
		string $version_table,
		string $master_table,
		string $foreign_key,
		int $id,
		int $user_id,
		string $audit_action,
		string $object_type,
		callable $prepare_callback,
		string $not_found_message
	): array|WP_Error {
		$version = $this->repository->find( $version_table, $id );
		if ( ! $version ) {
			return $this->not_found_error( $not_found_message );
		}

		$master = $this->repository->find( $master_table, (int) $version[ $foreign_key ] );
		if ( ! $master ) {
			return $this->not_found_error( __( 'Parent master component not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_row_editable( $master, 'entity' );
		if ( $permission_error ) {
			return $permission_error;
		}

		$this->repository->update(
			$version_table,
			$id,
			[
				'status'      => 'approved',
				'approved_by' => $user_id,
				'approved_at' => current_time( 'mysql' ),
			]
		);

		AuditLogService::log( $audit_action, [ 'version_id' => $id ], null, $object_type, $id );

		return $prepare_callback( $this->repository->find( $version_table, $id ) ?: [] );
	}

	private function normalize_domain( string $domain ): string {
		$domain = strtolower( trim( $domain ) );
		if ( str_contains( $domain, '://' ) ) {
			$host = parse_url( $domain, PHP_URL_HOST );
			$domain = is_string( $host ) ? $host : '';
		}

		$domain = trim( $domain, " \t\n\r\0\x0B/" );

		if ( ! preg_match( '/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/', $domain ) ) {
			return '';
		}

		return $domain;
	}

	private function domain_has_dns_record( string $domain ): bool {
		if ( function_exists( 'checkdnsrr' ) ) {
			return checkdnsrr( $domain, 'A' ) || checkdnsrr( $domain, 'AAAA' ) || checkdnsrr( $domain, 'CNAME' );
		}

		return false;
	}

	private function domain_has_tls( string $url_or_domain ): bool {
		$host = str_contains( $url_or_domain, '://' )
			? parse_url( $url_or_domain, PHP_URL_HOST )
			: $url_or_domain;

		if ( ! is_string( $host ) || '' === trim( $host ) ) {
			return false;
		}

		$context = stream_context_create(
			[
				'ssl' => [
					'verify_peer'      => true,
					'verify_peer_name' => true,
					'peer_name'        => $host,
				],
			]
		);

		$socket = @stream_socket_client(
			"ssl://{$host}:443",
			$error_code,
			$error_message,
			5,
			STREAM_CLIENT_CONNECT,
			$context
		);

		if ( is_resource( $socket ) ) {
			fclose( $socket );
			return true;
		}

		return false;
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
