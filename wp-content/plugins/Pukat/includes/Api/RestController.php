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
	 * @param string               $code    Error code.
	 * @param string               $message Human-readable error message.
	 * @param int                  $status  HTTP status code.
	 * @param array<string, mixed> $extra   Additional top-level fields to merge into the
	 *                                      response body (e.g. `details` — a per-item
	 *                                      breakdown of a bulk validation failure).
	 * @return WP_REST_Response
	 */
	protected function error( string $code, string $message, int $status = 400, array $extra = [] ): WP_REST_Response {
		return new WP_REST_Response(
			array_merge( [ 'success' => false, 'code' => $code, 'message' => $message ], $extra ),
			$status
		);
	}

	/**
	 * Convert a WP_Error to a WP_REST_Response. Any WP_Error data key besides
	 * `status` (e.g. `details`) is passed through as an extra top-level field
	 * on the response body — see error()'s $extra param.
	 *
	 * @param WP_Error $wp_error WP error instance.
	 * @param int      $status   Default HTTP status if WP_Error has no data.
	 * @return WP_REST_Response
	 */
	protected function from_wp_error( WP_Error $wp_error, int $status = 500 ): WP_REST_Response {
		$data  = $wp_error->get_error_data();
		$http  = ( is_array( $data ) && isset( $data['status'] ) ) ? (int) $data['status'] : $status;
		$extra = is_array( $data ) ? array_diff_key( $data, [ 'status' => true ] ) : [];

		return $this->error(
			$wp_error->get_error_code(),
			$wp_error->get_error_message(),
			$http,
			$extra
		);
	}

	/**
	 * Return a raw binary file download (e.g. a generated PDF) — bypasses the
	 * `{success, data}` JSON envelope every other response in this codebase
	 * uses, since the REST server would otherwise try to JSON-encode the
	 * binary body. Callers are responsible for authorizing/generating
	 * `$binary` before calling this; this only handles the HTTP response shape.
	 */
	protected function binary_response( string $binary, string $filename, string $content_type ): WP_REST_Response {
		$response = new WP_REST_Response( $binary, 200 );
		$response->header( 'Content-Type', $content_type );
		$response->header( 'Content-Disposition', 'attachment; filename="' . $filename . '"' );
		$response->header( 'Content-Length', (string) strlen( $binary ) );

		// Every other endpoint returns structured data that WP's REST server
		// JSON-encodes; a raw PDF/binary body must bypass that serialization
		// entirely, so this response is only ever safe to return from a route
		// filtered through rest_pre_serve_request (see register_routes() in
		// CampaignGroupController/CampaignRunController for the matching filter).
		return $response;
	}

	/**
	 * Mark a still-supported endpoint as legacy without changing its data shape.
	 */
	protected function legacy_response( WP_REST_Response $response, string $successor_route, string $message ): WP_REST_Response {
		$successor_url = rest_url( $this->namespace . $successor_route );

		$response->header( 'X-Pukat-Legacy', 'true' );
		$response->header( 'X-Pukat-Replacement', $successor_url );
		$response->header( 'Deprecation', 'true' );
		$response->header( 'Link', '<' . $successor_url . '>; rel="successor-version"', false );

		$data = $response->get_data();
		if ( is_array( $data ) ) {
			$data['legacy'] = [
				'status'      => 'legacy_supported',
				'message'     => $message,
				'replacement' => $successor_url,
			];
			$response->set_data( $data );
		}

		return $response;
	}

	// The 3 blanket permission callbacks that used to live here
	// (`permission_read()`/`permission_manage()`/`permission_admin()`) are gone.
	// Phase 3 of docs/IMPLEMENTATION_PLAN_RBAC.md migrated every route to a
	// granular Permission Registry capability, leaving these with no callers,
	// and docs/PRD_RBAC_COVERAGE_COMPLETION.md §15.6 removed them. They were the
	// last readers of the legacy `pukat_view_reports`/`pukat_manage_campaigns`/
	// `pukat_manage_settings` capabilities; those are still granted by
	// `Activator::add_roles()` on purpose, in case anything outside this plugin
	// relies on them.
	//
	// New routes gate on a registry key instead:
	// `current_user_can( PermissionRegistry::capability_for( '<menu>.<action>' ) )`,
	// as every controller in includes/Api/ now does.
}
