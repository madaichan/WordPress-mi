<?php
/**
 * Flag category REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\FlagService;
use Pukat\Services\PermissionRegistry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Routes:
 *   GET    /pukat/v1/flags
 *   POST   /pukat/v1/flags
 *   PUT    /pukat/v1/flags/{id}
 *   DELETE /pukat/v1/flags/{id}
 */
class FlagController extends RestController {

	private FlagService $flags;

	public function __construct( ?FlagService $flags = null ) {
		$this->flags = $flags ?? new FlagService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/flags', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_flags' ],
				'permission_callback' => fn () => $this->require_capability( 'flags.view' ),
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_flag' ],
				'permission_callback' => fn () => $this->require_capability( 'flags.create' ),
			],
		] );

		register_rest_route( $this->namespace, '/flags/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_flag' ],
				'permission_callback' => fn () => $this->require_capability( 'flags.edit' ),
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_flag' ],
				'permission_callback' => fn () => $this->require_capability( 'flags.delete' ),
			],
		] );
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

	public function list_flags( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->flags->list() );
	}

	public function create_flag( WP_REST_Request $request ): WP_REST_Response {
		return $this->result_response( $this->flags->create( $this->request_params( $request ), get_current_user_id() ), 201 );
	}

	public function update_flag( WP_REST_Request $request ): WP_REST_Response {
		return $this->result_response( $this->flags->update( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() ) );
	}

	public function delete_flag( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->flags->delete( (int) $request->get_param( 'id' ), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( [ 'deleted' => true ] );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function request_params( WP_REST_Request $request ): array {
		$json = $request->get_json_params();

		return is_array( $json ) ? array_merge( $request->get_params(), $json ) : $request->get_params();
	}

	private function result_response( mixed $result, int $success_status = 200 ): WP_REST_Response {
		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result, $success_status );
	}
}
