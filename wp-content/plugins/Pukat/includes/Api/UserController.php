<?php
/**
 * User access management REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\AuditLogService;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class UserController
 *
 * RBAC user management and audit log retrieval.
 *
 * Routes:
 *   GET    /pukat/v1/users
 *   PUT    /pukat/v1/users/{id}/role
 *   GET    /pukat/v1/audit-logs
 */
class UserController extends RestController {

	/** Allowed Pukat roles. */
	private const PUKAT_ROLES = [ 'pukat_admin', 'pukat_operator', 'pukat_viewer' ];

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/users', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_users' ],
			'permission_callback' => [ $this, 'permission_admin' ],
		] );

		register_rest_route( $this->namespace, '/users/(?P<id>\d+)/role', [
			'methods'             => 'PUT',
			'callback'            => [ $this, 'update_role' ],
			'permission_callback' => [ $this, 'permission_admin' ],
		] );

		register_rest_route( $this->namespace, '/audit-logs', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_audit_logs' ],
			'permission_callback' => [ $this, 'permission_admin' ],
		] );
	}

	public function get_users( WP_REST_Request $request ): WP_REST_Response {
		$search  = sanitize_text_field( (string) $request->get_param( 'search' ) );
		$page    = max( 1, (int) $request->get_param( 'page' ) );
		$per_page = min( (int) $request->get_param( 'per_page' ) ?: 20, 100 );

		$args = [
			'number'  => $per_page,
			'offset'  => ( $page - 1 ) * $per_page,
			'orderby' => 'display_name',
			'order'   => 'ASC',
		];

		if ( $search ) {
			$args['search']         = '*' . $search . '*';
			$args['search_columns'] = [ 'user_login', 'user_email', 'display_name' ];
		}

		$users       = get_users( $args );
		$total       = count( get_users( array_merge( $args, [ 'number' => -1, 'fields' => 'ids' ] ) ) );
		$result      = [];

		foreach ( $users as $user ) {
			$roles      = $user->roles;
			$pukat_role = 'none';

			foreach ( self::PUKAT_ROLES as $r ) {
				if ( in_array( $r, $roles, true ) ) {
					$pukat_role = $r;
					break;
				}
			}

			if ( in_array( 'administrator', $roles, true ) ) {
				$pukat_role = 'pukat_admin'; // WP admins get full access.
			}

			$result[] = [
				'id'           => $user->ID,
				'display_name' => $user->display_name,
				'email'        => $user->user_email,
				'wp_roles'     => $roles,
				'pukat_role'   => $pukat_role,
				'entity'       => $this->get_user_entity( (int) $user->ID ),
			];
		}

		return $this->success( [
			'users'     => $result,
			'total'     => $total,
			'page'      => $page,
			'per_page'  => $per_page,
			'last_page' => (int) ceil( $total / $per_page ),
		] );
	}

	public function update_role( WP_REST_Request $request ): WP_REST_Response {
		$user_id   = (int) $request->get_param( 'id' );
		$new_role  = sanitize_text_field( (string) $request->get_param( 'pukat_role' ) );
		$user      = get_userdata( $user_id );

		if ( ! $user ) {
			return $this->error( 'not_found', __( 'User not found.', 'pukat' ), 404 );
		}

		if ( ! in_array( $new_role, array_merge( self::PUKAT_ROLES, [ 'none' ] ), true ) ) {
			return $this->error( 'invalid_role', __( 'Invalid Pukat role.', 'pukat' ), 422 );
		}

		// Remove all existing Pukat roles.
		foreach ( self::PUKAT_ROLES as $role ) {
			$user->remove_role( $role );
		}

		// Assign the new role.
		if ( 'none' !== $new_role ) {
			$user->add_role( $new_role );
		}

		AuditLogService::log( 'user.role_updated', [
			'target_user_id' => $user_id,
			'new_role'       => $new_role,
		], null, 'user', $user_id );

		return $this->success( [
			'user_id'    => $user_id,
			'pukat_role' => $new_role,
		] );
	}

	/**
	 * Resolve a user's entity code from WordPress user meta.
	 */
	private function get_user_entity( int $user_id ): string {
		$entity = (string) get_user_meta( $user_id, 'entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
	}

	public function get_audit_logs( WP_REST_Request $request ): WP_REST_Response {
		$logs = AuditLogService::get_logs( [
			'limit'   => (int) $request->get_param( 'limit' ) ?: 50,
			'offset'  => (int) $request->get_param( 'offset' ) ?: 0,
			'user_id' => (int) $request->get_param( 'user_id' ) ?: 0,
			'action'  => sanitize_text_field( (string) $request->get_param( 'action' ) ),
		] );

		return $this->success( $logs );
	}
}
