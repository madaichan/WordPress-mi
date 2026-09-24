<?php
/**
 * Entity Profile REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\EntityProfileService;
use Pukat\Services\PermissionRegistry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manages Entity Profiles (descriptive metadata for an Entity) and their
 * per-entity recipient email-domain allow-list. Pure central-admin
 * governance content — every route here is gated by `master_entities.*`,
 * admin-only, no per-user entity-scoped visibility (unlike Campaign
 * Group/Campaign Run). See docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md.
 *
 * Routes:
 *   GET    /pukat/v1/entities
 *   POST   /pukat/v1/entities
 *   GET    /pukat/v1/entities/{id}
 *   PUT    /pukat/v1/entities/{id}
 *   DELETE /pukat/v1/entities/{id}
 *   GET    /pukat/v1/entities/by-name/{entity_name}/email-domains
 *   POST   /pukat/v1/entities/by-name/{entity_name}/email-domains
 *   DELETE /pukat/v1/entities/by-name/{entity_name}/email-domains/{id}
 */
class EntityController extends RestController {

	private EntityProfileService $entities;

	public function __construct( ?EntityProfileService $entities = null ) {
		$this->entities = $entities ?? new EntityProfileService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/entities', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_entities' ],
				'permission_callback' => [ $this, 'permission_view_entity' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_entity' ],
				'permission_callback' => [ $this, 'permission_create_entity' ],
			],
		] );

		// `by-name` prefix disambiguates from the numeric {id} routes below —
		// entity_name is an arbitrary string (may contain spaces/punctuation),
		// so it can't safely share a path segment with a `\d+`-only pattern.
		register_rest_route( $this->namespace, '/entities/by-name/(?P<entity_name>[^/]+)/email-domains', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_email_domains' ],
				'permission_callback' => [ $this, 'permission_view_entity' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'add_email_domain' ],
				'permission_callback' => [ $this, 'permission_edit_entity' ],
			],
		] );

		register_rest_route( $this->namespace, '/entities/by-name/(?P<entity_name>[^/]+)/email-domains/(?P<id>\d+)', [
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'remove_email_domain' ],
				'permission_callback' => [ $this, 'permission_edit_entity' ],
			],
			[
				'methods'             => 'PATCH',
				'callback'            => [ $this, 'set_email_domain_status' ],
				'permission_callback' => [ $this, 'permission_edit_entity' ],
			],
		] );

		// Admin oversight summary (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §14.2).
		register_rest_route( $this->namespace, '/entities/guardrails-overview', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'guardrails_overview' ],
			'permission_callback' => [ $this, 'permission_oversee_entities' ],
		] );

		register_rest_route( $this->namespace, '/entities/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_entity' ],
				'permission_callback' => [ $this, 'permission_view_entity' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_entity' ],
				'permission_callback' => [ $this, 'permission_edit_entity' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_entity' ],
				'permission_callback' => [ $this, 'permission_delete_entity' ],
			],
		] );
	}

	public function permission_view_entity(): bool|WP_Error {
		return $this->require_capability( 'master_entities.view' );
	}

	public function permission_create_entity(): bool|WP_Error {
		return $this->require_capability( 'master_entities.create' );
	}

	public function permission_edit_entity(): bool|WP_Error {
		return $this->require_capability( 'master_entities.edit' );
	}

	public function permission_delete_entity(): bool|WP_Error {
		return $this->require_capability( 'master_entities.delete' );
	}

	public function permission_oversee_entities(): bool|WP_Error {
		return $this->require_capability( 'master_entities.oversee' );
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

	public function list_entities( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->entities->list() );
	}

	public function get_entity( WP_REST_Request $request ): WP_REST_Response {
		$entity = $this->entities->get( (int) $request->get_param( 'id' ) );

		if ( ! $entity ) {
			return $this->error( 'not_found', __( 'Entity Profile not found.', 'pukat' ), 404 );
		}

		return $this->success( $entity );
	}

	public function create_entity( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->entities->create( $this->request_params( $request ), get_current_user_id() );

		return $this->result_response( $result, 201 );
	}

	public function update_entity( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->entities->update(
			(int) $request->get_param( 'id' ),
			$this->request_params( $request ),
			get_current_user_id()
		);

		return $this->result_response( $result );
	}

	public function delete_entity( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->entities->delete( (int) $request->get_param( 'id' ), get_current_user_id() );

		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( [ 'deleted' => true ] );
	}

	public function list_email_domains( WP_REST_Request $request ): WP_REST_Response {
		$entity_name = (string) $request->get_param( 'entity_name' );

		return $this->success( $this->entities->list_email_domains( $entity_name ) );
	}

	public function add_email_domain( WP_REST_Request $request ): WP_REST_Response {
		$entity_name = (string) $request->get_param( 'entity_name' );
		$params      = $this->request_params( $request );

		$result = $this->entities->add_email_domain(
			$entity_name,
			(string) ( $params['domain'] ?? '' ),
			get_current_user_id()
		);

		return $this->result_response( $result, 201 );
	}

	public function remove_email_domain( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->entities->remove_email_domain(
			(int) $request->get_param( 'id' ),
			(string) $request->get_param( 'entity_name' ),
			get_current_user_id()
		);

		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( [ 'deleted' => true ] );
	}

	public function set_email_domain_status( WP_REST_Request $request ): WP_REST_Response {
		$params = $this->request_params( $request );

		$result = $this->entities->set_email_domain_status(
			(int) $request->get_param( 'id' ),
			(string) $request->get_param( 'entity_name' ),
			(string) ( $params['status'] ?? '' ),
			get_current_user_id()
		);

		return $this->result_response( $result );
	}

	public function guardrails_overview( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->entities->guardrails_overview() );
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
