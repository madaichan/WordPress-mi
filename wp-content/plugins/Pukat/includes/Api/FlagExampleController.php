<?php
/**
 * Flag example REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\FlagExampleService;
use Pukat\Services\PermissionRegistry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Routes:
 *   GET    /pukat/v1/flag-examples?flag_id=&entity=   entity only honored for admins
 *   POST   /pukat/v1/flag-examples                    multipart/form-data: file, flag_id, caption?
 *   DELETE /pukat/v1/flag-examples/{id}
 */
class FlagExampleController extends RestController {

	private FlagExampleService $examples;

	public function __construct( ?FlagExampleService $examples = null ) {
		$this->examples = $examples ?? new FlagExampleService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/flag-examples', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_examples' ],
				'permission_callback' => fn () => $this->require_capability( 'flag_examples.view' ),
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'upload_example' ],
				'permission_callback' => fn () => $this->require_capability( 'flag_examples.upload' ),
			],
		] );

		register_rest_route( $this->namespace, '/flag-examples/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'delete_example' ],
			'permission_callback' => fn () => $this->require_capability( 'flag_examples.delete' ),
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

	public function list_examples( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( [
			'examples'         => $this->examples->list( $request->get_params() ),
			'max_upload_bytes' => FlagExampleService::max_upload_bytes(),
		] );
	}

	public function upload_example( WP_REST_Request $request ): WP_REST_Response {
		$files  = $request->get_file_params();
		$result = $this->examples->upload( $files['file'] ?? null, $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result, 201 );
	}

	public function delete_example( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->examples->delete( (int) $request->get_param( 'id' ), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( [ 'deleted' => true ] );
	}
}
