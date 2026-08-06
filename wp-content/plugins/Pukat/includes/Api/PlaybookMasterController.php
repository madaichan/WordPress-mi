<?php
/**
 * Playbook Master REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\PermissionRegistry;
use Pukat\Services\PlaybookMasterService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manages WordPress-owned Playbook Master records.
 */
class PlaybookMasterController extends RestController {

	private PlaybookMasterService $playbooks;

	public function __construct( ?PlaybookMasterService $playbooks = null ) {
		$this->playbooks = $playbooks ?? new PlaybookMasterService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/playbook-masters', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_playbooks' ],
				'permission_callback' => [ $this, 'permission_view_playbook_master' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_playbook' ],
				'permission_callback' => [ $this, 'permission_create_playbook_master' ],
			],
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_playbook' ],
				'permission_callback' => [ $this, 'permission_view_playbook_master' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_playbook' ],
				'permission_callback' => [ $this, 'permission_edit_playbook_master' ],
			],
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)/duplicate', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'duplicate_playbook' ],
			'permission_callback' => [ $this, 'permission_create_playbook_master' ], // creates a new row
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)/submit-review', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'submit_review' ],
			'permission_callback' => [ $this, 'permission_edit_playbook_master' ], // status transition on an existing row
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)/approve', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'approve_playbook' ],
			'permission_callback' => [ $this, 'permission_approve_playbook_master' ],
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)/archive', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'archive_playbook' ],
			'permission_callback' => [ $this, 'permission_edit_playbook_master' ], // status transition on an existing row, same as submit-review
		] );
	}

	/**
	 * Phase 3 of docs/IMPLEMENTATION_PLAN_RBAC.md: granular capability checks.
	 * duplicate reuses .create (makes a new row); submit-review and archive
	 * both reuse .edit (status transitions on an existing row — draft->review
	 * and X->archived are the same kind of action as any other field edit,
	 * not a create or a destructive delete).
	 *
	 * Phase 4: /approve now checks master_playbooks.approve (its own gate,
	 * excluded from Operator — see PermissionRegistry's `approve` gate and
	 * Activator::grant_rbac_capabilities()) instead of permission_manage().
	 * See approve_playbook() for the accompanying self-approval guard.
	 */
	public function permission_view_playbook_master(): bool|WP_Error {
		return $this->require_capability( 'master_playbooks.view' );
	}

	public function permission_create_playbook_master(): bool|WP_Error {
		return $this->require_capability( 'master_playbooks.create' );
	}

	public function permission_edit_playbook_master(): bool|WP_Error {
		return $this->require_capability( 'master_playbooks.edit' );
	}

	public function permission_approve_playbook_master(): bool|WP_Error {
		return $this->require_capability( 'master_playbooks.approve' );
	}

	private function require_capability( string $permission_key ): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		if ( ! current_user_can( PermissionRegistry::capability_for( $permission_key ) ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Insufficient permissions.', 'pukat' ), [ 'status' => 403 ] );
		}
		return true;
	}

	public function list_playbooks( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->playbooks->list() );
	}

	public function get_playbook( WP_REST_Request $request ): WP_REST_Response {
		$playbook = $this->playbooks->get( (int) $request->get_param( 'id' ) );

		if ( ! $playbook ) {
			return $this->error( 'not_found', __( 'Playbook Master not found.', 'pukat' ), 404 );
		}

		return $this->success( $playbook );
	}

	public function create_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->create( $this->request_params( $request ), get_current_user_id() );

		return $this->result_response( $result, 201 );
	}

	public function update_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->update(
			(int) $request->get_param( 'id' ),
			$this->request_params( $request ),
			get_current_user_id()
		);

		return $this->result_response( $result );
	}

	public function duplicate_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->duplicate(
			(int) $request->get_param( 'id' ),
			$this->request_params( $request ),
			get_current_user_id()
		);

		return $this->result_response( $result, 201 );
	}

	public function submit_review( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->submit_review( (int) $request->get_param( 'id' ), get_current_user_id() );

		return $this->result_response( $result );
	}

	public function approve_playbook( WP_REST_Request $request ): WP_REST_Response {
		$id = (int) $request->get_param( 'id' );

		$self_approval_error = $this->reject_self_approval( $this->playbooks->get( $id ) );
		if ( $self_approval_error ) {
			return $self_approval_error;
		}

		$result = $this->playbooks->approve( $id, get_current_user_id() );

		return $this->result_response( $result );
	}

	/**
	 * PRD_RBAC.md §12/§18: whoever created or last updated a draft may never
	 * approve it themselves, even with the .approve capability — segregation
	 * of duties is the whole point of the Reviewer/Approver role. A missing
	 * row is not this method's concern (the real not_found_error from
	 * approve() itself is what should surface), so it only blocks on an
	 * actual creator/updater match.
	 *
	 * @param array<string, mixed>|null $existing
	 */
	private function reject_self_approval( ?array $existing ): ?WP_REST_Response {
		if ( ! $existing ) {
			return null;
		}

		$current_user_id = get_current_user_id();
		$created_by      = (int) ( $existing['created_by'] ?? 0 );
		$updated_by      = (int) ( $existing['updated_by'] ?? 0 );

		if ( $current_user_id === $created_by || $current_user_id === $updated_by ) {
			return $this->error(
				'self_approval_forbidden',
				__( 'You cannot approve a draft you created or last edited yourself.', 'pukat' ),
				403
			);
		}

		return null;
	}

	public function archive_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->archive( (int) $request->get_param( 'id' ), get_current_user_id() );

		return $this->result_response( $result );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function request_params( WP_REST_Request $request ): array {
		$params = $request->get_params();
		$json   = $request->get_json_params();

		if ( is_array( $json ) ) {
			$params = array_merge( $params, $json );
		}

		return $params;
	}

	private function result_response( mixed $result, int $success_status = 200 ): WP_REST_Response {
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result, $success_status );
	}
}
