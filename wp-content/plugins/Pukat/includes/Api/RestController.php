<?php
/**
 * Base REST controller with shared helpers.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class RestController
 *
 * Abstract base for all Pukat REST controllers.
 * Provides consistent response formatting, permission helpers, and input sanitisation.
 */
abstract class RestController {

	/** @var string REST namespace — 'pukat/v1' */
	protected string $namespace = PUKAT_REST_NAMESPACE;

	/**
	 * Register this controller's routes. Implemented by each subclass.
	 */
	abstract public function register_routes(): void;

	// ---------------------------------------------------------------------------
	// Response helpers
	// ---------------------------------------------------------------------------

	/**
	 * Return a success JSON response.
	 *
	 * @param mixed $data    Response data.
	 * @param int   $status  HTTP status code.
	 * @return WP_REST_Response
	 */
	protected function success( mixed $data = null, int $status = 200 ): WP_REST_Response {
		return new WP_REST_Response(
			[ 'success' => true, 'data' => $data ],
			$status
		);
	}

	/**
	 * Return an error JSON response.
	 *
	 * @param string $code    Error code.
	 * @param string $message Human-readable error message.
	 * @param int    $status  HTTP status code.
	 * @return WP_REST_Response
	 */
	protected function error( string $code, string $message, int $status = 400 ): WP_REST_Response {
		return new WP_REST_Response(
			[ 'success' => false, 'code' => $code, 'message' => $message ],
			$status
		);
	}

	/**
	 * Convert a WP_Error to a WP_REST_Response.
	 *
	 * @param WP_Error $wp_error WP error instance.
	 * @param int      $status   Default HTTP status if WP_Error has no data.
	 * @return WP_REST_Response
	 */
	protected function from_wp_error( WP_Error $wp_error, int $status = 500 ): WP_REST_Response {
		$data    = $wp_error->get_error_data();
		$http    = ( is_array( $data ) && isset( $data['status'] ) ) ? (int) $data['status'] : $status;
		return $this->error(
			$wp_error->get_error_code(),
			$wp_error->get_error_message(),
			$http
		);
	}

	// ---------------------------------------------------------------------------
	// Permission callbacks
	// ---------------------------------------------------------------------------

	/**
	 * Permission: user must be logged in and have read access.
	 *
	 * @return bool|WP_Error
	 */
	public function permission_read(): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'You must be logged in to access Pukat.', 'pukat' ),
				[ 'status' => 401 ]
			);
		}
		if ( ! current_user_can( 'pukat_view_reports' ) && ! current_user_can( 'pukat_manage_campaigns' ) && ! current_user_can( 'administrator' ) ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to view this resource.', 'pukat' ),
				[ 'status' => 403 ]
			);
		}
		return true;
	}

	/**
	 * Permission: manage campaigns (admin + operator).
	 *
	 * @return bool|WP_Error
	 */
	public function permission_manage(): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		if ( ! current_user_can( 'pukat_manage_campaigns' ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Insufficient permissions.', 'pukat' ), [ 'status' => 403 ] );
		}
		return true;
	}

	/**
	 * Permission: admin only.
	 *
	 * @return bool|WP_Error
	 */
	public function permission_admin(): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		if ( ! current_user_can( 'pukat_manage_settings' ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Admin access required.', 'pukat' ), [ 'status' => 403 ] );
		}
		return true;
	}
}
