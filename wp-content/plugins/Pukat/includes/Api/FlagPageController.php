<?php
/**
 * Flag education page REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\FlagPageService;
use Pukat\Services\PermissionRegistry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * One education page per entity (docs/PRD_FLAG_EDUCATION_PAGES.md §8).
 *
 * Routes:
 *   GET  /pukat/v1/flag-page?entity=   the entity's page (empty shell if none)
 *   PUT  /pukat/v1/flag-page           save draft (title, html_body)
 *   POST /pukat/v1/flag-page/publish   publish the saved draft
 *   POST /pukat/v1/flag-page/unpublish return to draft
 *
 * Admins pick an entity with `?entity=`; non-admins always get their own.
 */
class FlagPageController extends RestController {

	private FlagPageService $pages;

	public function __construct( ?FlagPageService $pages = null ) {
		$this->pages = $pages ?? new FlagPageService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/flag-page', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_page' ],
				'permission_callback' => fn () => $this->require_capability( 'flag_pages.view' ),
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'save_page' ],
				'permission_callback' => fn () => $this->require_capability( 'flag_pages.edit' ),
			],
		] );

		register_rest_route( $this->namespace, '/flag-page/publish', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'publish_page' ],
			'permission_callback' => fn () => $this->require_capability( 'flag_pages.publish' ),
		] );

		register_rest_route( $this->namespace, '/flag-page/unpublish', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'unpublish_page' ],
			'permission_callback' => fn () => $this->require_capability( 'flag_pages.publish' ),
		] );

		register_rest_route( $this->namespace, '/flag-page/sync', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'sync_page' ],
			'permission_callback' => fn () => $this->require_capability( 'flag_pages.publish' ),
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

	public function get_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->get( $request->get_params() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function save_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->save( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function publish_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->publish( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function unpublish_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->unpublish( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function sync_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->sync( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}
}
