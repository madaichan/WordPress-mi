<?php
/**
 * Quiz page REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\PermissionRegistry;
use Pukat\Services\QuizPageService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * One quiz page per entity (docs/PRD_QUIZ_MODULE.md §8).
 *
 * Routes:
 *   GET  /pukat/v1/quiz-page?entity=    the entity's page (empty shell if none)
 *   PUT  /pukat/v1/quiz-page            save draft
 *   POST /pukat/v1/quiz-page/validate   lint without saving
 *   POST /pukat/v1/quiz-page/publish    publish the saved draft
 *   POST /pukat/v1/quiz-page/unpublish  return to draft
 *   POST /pukat/v1/quiz-page/sync       retry the GoPhish sync
 *
 * Admins pick an entity with `?entity=`; non-admins always get their own.
 */
class QuizPageController extends RestController {

	private QuizPageService $pages;

	public function __construct( ?QuizPageService $pages = null ) {
		$this->pages = $pages ?? new QuizPageService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/quiz-pages', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_pages' ],
				'permission_callback' => fn () => $this->require_capability( 'quiz_pages.view' ),
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_page' ],
				'permission_callback' => fn () => $this->require_capability( 'quiz_pages.edit' ),
			],
		] );

		register_rest_route( $this->namespace, '/quiz-pages/overview', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'overview_pages' ],
			// Cross-entity admin oversight — gated by the admin-only templates key.
			'permission_callback' => fn () => $this->require_capability( 'quiz_templates.view' ),
		] );

		register_rest_route( $this->namespace, '/quiz-page/default', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'set_default_page' ],
			'permission_callback' => fn () => $this->require_capability( 'quiz_pages.publish' ),
		] );

		register_rest_route( $this->namespace, '/quiz-page/delete', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'delete_page' ],
			'permission_callback' => fn () => $this->require_capability( 'quiz_pages.edit' ),
		] );

		register_rest_route( $this->namespace, '/quiz-page', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_page' ],
				'permission_callback' => fn () => $this->require_capability( 'quiz_pages.view' ),
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'save_page' ],
				'permission_callback' => fn () => $this->require_capability( 'quiz_pages.edit' ),
			],
		] );

		register_rest_route( $this->namespace, '/quiz-page/preview', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'preview_page' ],
			'permission_callback' => fn () => $this->require_capability( 'quiz_pages.edit' ),
		] );

		register_rest_route( $this->namespace, '/quiz-page/validate', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'validate_page' ],
			'permission_callback' => fn () => $this->require_capability( 'quiz_pages.edit' ),
		] );

		register_rest_route( $this->namespace, '/quiz-page/publish', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'publish_page' ],
			'permission_callback' => fn () => $this->require_capability( 'quiz_pages.publish' ),
		] );

		register_rest_route( $this->namespace, '/quiz-page/unpublish', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'unpublish_page' ],
			'permission_callback' => fn () => $this->require_capability( 'quiz_pages.publish' ),
		] );

		register_rest_route( $this->namespace, '/quiz-page/sync', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'sync_page' ],
			'permission_callback' => fn () => $this->require_capability( 'quiz_pages.publish' ),
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

	public function list_pages( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->list( $request->get_params() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function create_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->create( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function overview_pages(): WP_REST_Response {
		return $this->success( $this->pages->overview() );
	}

	public function set_default_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->set_default( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function delete_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->delete( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function get_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->get( $request->get_params() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function save_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->save( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function preview_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->preview( $request->get_params() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function validate_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->pages->validate( $request->get_params() );

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
