<?php
/**
 * Playbook Master REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\PlaybookMasterService;
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
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_playbook' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)', [
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
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)/duplicate', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'duplicate_playbook' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)/submit-review', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'submit_review' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)/approve', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'approve_playbook' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/playbook-masters/(?P<id>\d+)/archive', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'archive_playbook' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );
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
		$result = $this->playbooks->approve( (int) $request->get_param( 'id' ), get_current_user_id() );

		return $this->result_response( $result );
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
