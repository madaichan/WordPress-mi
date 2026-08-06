<?php
/**
 * Playbook REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\PermissionRegistry;
use Pukat\Services\PlaybookService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manages reusable campaign configurations linked to GoPhish assets.
 */
class PlaybookController extends RestController {

	private PlaybookService $playbooks;

	public function __construct( ?PlaybookService $playbooks = null ) {
		$this->playbooks = $playbooks ?? new PlaybookService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/playbooks', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_playbooks' ],
				'permission_callback' => [ $this, 'permission_view_playbook' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_playbook' ],
				'permission_callback' => [ $this, 'permission_create_playbook' ],
			],
		] );

		register_rest_route( $this->namespace, '/playbooks/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_playbook' ],
				'permission_callback' => [ $this, 'permission_view_playbook' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_playbook' ],
				'permission_callback' => [ $this, 'permission_edit_playbook' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_playbook' ],
				'permission_callback' => [ $this, 'permission_delete_playbook' ],
			],
		] );

		register_rest_route( $this->namespace, '/playbooks/(?P<id>\d+)/migrate-to-master', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'migrate_to_master' ],
			'permission_callback' => [ $this, 'permission_create_playbook' ], // creates a new playbook_masters row
		] );
	}

	/**
	 * Phase 3 of docs/IMPLEMENTATION_PLAN_RBAC.md: this whole controller is
	 * the deprecated pre-Playbook-Master legacy compat layer (every response
	 * goes through legacy_response(), pointing callers at /playbook-masters).
	 * It has no distinct Permission Registry entry of its own — it reuses
	 * master_playbooks.view/create/edit/delete, since managing a playbook
	 * here is the same conceptual action as managing one on the Master
	 * Playbooks page, just against the older table. Kept as 3 distinct
	 * per-verb checks (not one collapsed "manage" check) so a future custom
	 * role granted e.g. only master_playbooks.edit behaves the same way
	 * here as it would on the Master page — today's 3 default roles get
	 * create+edit+delete as one bundle either way, so this doesn't change
	 * their behavior, only future partial-grant custom roles.
	 */
	public function permission_view_playbook(): bool|WP_Error {
		return $this->require_capability( 'master_playbooks.view' );
	}

	public function permission_create_playbook(): bool|WP_Error {
		return $this->require_capability( 'master_playbooks.create' );
	}

	public function permission_edit_playbook(): bool|WP_Error {
		return $this->require_capability( 'master_playbooks.edit' );
	}

	public function permission_delete_playbook(): bool|WP_Error {
		return $this->require_capability( 'master_playbooks.delete' );
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

	public function get_playbooks( WP_REST_Request $request ): WP_REST_Response {
		return $this->legacy_playbook_response( $this->success( $this->playbooks->list() ) );
	}

	public function get_playbook( WP_REST_Request $request ): WP_REST_Response {
		$playbook = $this->playbooks->get( (int) $request->get_param( 'id' ) );

		if ( ! $playbook ) {
			return $this->legacy_playbook_response( $this->error( 'not_found', __( 'Playbook not found.', 'pukat' ), 404 ) );
		}

		return $this->legacy_playbook_response( $this->success( $playbook ) );
	}

	public function create_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->create( $request->get_params(), get_current_user_id() );

		if ( is_wp_error( $result ) ) {
			return $this->legacy_playbook_response( $this->from_wp_error( $result ) );
		}

		return $this->legacy_playbook_response( $this->success( $result ) );
	}

	public function update_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->update(
			(int) $request->get_param( 'id' ),
			$request->get_params()
		);

		if ( is_wp_error( $result ) ) {
			return $this->legacy_playbook_response( $this->from_wp_error( $result ) );
		}

		return $this->legacy_playbook_response( $this->success( $result ) );
	}

	public function delete_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->delete( (int) $request->get_param( 'id' ) );
		if ( is_wp_error( $result ) ) {
			return $this->legacy_playbook_response( $this->from_wp_error( $result ) );
		}

		return $this->legacy_playbook_response( $this->success( [ 'deleted' => true ] ) );
	}

	public function migrate_to_master( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->migrate_to_master( (int) $request->get_param( 'id' ), get_current_user_id() );

		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result, ! empty( $result['migrated'] ) ? 201 : 200 );
	}

	private function legacy_playbook_response( WP_REST_Response $response ): WP_REST_Response {
		return $this->legacy_response(
			$response,
			'/playbook-masters',
			__( 'The /playbooks endpoints are legacy compatibility endpoints. Use Playbook Master endpoints for new workflows.', 'pukat' )
		);
	}
}
