<?php
/**
 * Quiz template catalogue REST controller (admin-only).
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\PermissionRegistry;
use Pukat\Services\QuizTemplateService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * The admin-authored quiz template catalogue (docs/PRD_QUIZ_MODULE.md §13).
 *
 * Routes:
 *   GET    /pukat/v1/quiz/templates          list (metadata only)
 *   POST   /pukat/v1/quiz/templates          create
 *   GET    /pukat/v1/quiz/templates/{id}     one template, with html_body
 *   PUT    /pukat/v1/quiz/templates/{id}     update
 *   DELETE /pukat/v1/quiz/templates/{id}     delete (blocked when in use)
 *
 * Templates are shared across entities and only admins may manage them, so the
 * whole surface is gated by the `quiz_templates` resource — separate from
 * `quiz_pages`, which operators hold.
 */
class QuizTemplateController extends RestController {

	private QuizTemplateService $templates;

	public function __construct( ?QuizTemplateService $templates = null ) {
		$this->templates = $templates ?? new QuizTemplateService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/quiz/templates', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_templates' ],
				// Operators pick a template in the builder, so listing is open to
				// quiz_pages.edit holders; only admins (quiz_templates.*) author.
				'permission_callback' => fn () => $this->require_any_capability( [ 'quiz_templates.view', 'quiz_pages.edit' ] ),
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_template' ],
				'permission_callback' => fn () => $this->require_capability( 'quiz_templates.create' ),
			],
		] );

		register_rest_route( $this->namespace, '/quiz/templates/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_template' ],
				'permission_callback' => fn () => $this->require_capability( 'quiz_templates.view' ),
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_template' ],
				'permission_callback' => fn () => $this->require_capability( 'quiz_templates.edit' ),
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_template' ],
				'permission_callback' => fn () => $this->require_capability( 'quiz_templates.delete' ),
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

	/**
	 * Allow the request when the user holds any one of the given permission
	 * keys — used so operators can list templates while only admins author.
	 *
	 * @param array<int, string> $permission_keys
	 */
	private function require_any_capability( array $permission_keys ): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		foreach ( $permission_keys as $key ) {
			if ( current_user_can( PermissionRegistry::capability_for( $key ) ) ) {
				return true;
			}
		}
		return new WP_Error( 'rest_forbidden', __( 'Insufficient permissions.', 'pukat' ), [ 'status' => 403 ] );
	}

	public function list_templates( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->templates->list( $request->get_params() ) );
	}

	public function get_template( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->templates->get( [ 'id' => (int) $request['id'] ] );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function create_template( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->templates->create( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function update_template( WP_REST_Request $request ): WP_REST_Response {
		$params       = $request->get_params();
		$params['id'] = (int) $request['id'];
		$result       = $this->templates->update( $params, get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function delete_template( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->templates->delete( [ 'id' => (int) $request['id'] ], get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}
}
