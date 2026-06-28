<?php
/**
 * Playbook REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\PlaybookService;
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
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_playbook' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/playbooks/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_playbook' ],
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_playbook' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_playbook' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );
	}

	public function get_playbooks( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->playbooks->list() );
	}

	public function get_playbook( WP_REST_Request $request ): WP_REST_Response {
		$playbook = $this->playbooks->get( (int) $request->get_param( 'id' ) );

		if ( ! $playbook ) {
			return $this->error( 'not_found', __( 'Playbook not found.', 'pukat' ), 404 );
		}

		return $this->success( $playbook );
	}

	public function create_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->create( $request->get_params(), get_current_user_id() );

		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result );
	}

	public function update_playbook( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->playbooks->update(
			(int) $request->get_param( 'id' ),
			$request->get_params()
		);

		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result );
	}

	public function delete_playbook( WP_REST_Request $request ): WP_REST_Response {
		$this->playbooks->delete( (int) $request->get_param( 'id' ) );

		return $this->success( [ 'deleted' => true ] );
	}
}
