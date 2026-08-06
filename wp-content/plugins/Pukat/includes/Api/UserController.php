<?php
/**
 * User access management REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\AuditLogService;
use Pukat\Services\PermissionRegistry;
use WP_Error;
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

	/**
	 * All RBAC-managed role slugs (system + custom), read from
	 * `wp_pukat_role_meta` — the single source of truth for "what roles
	 * exist" since Activator::seed_rbac_defaults() and RoleController both
	 * write there (see docs/PRD_RBAC.md). Not cached: role list changes are
	 * rare and always admin-driven, a per-request query is cheap enough.
	 *
	 * @return string[]
	 */
	private function pukat_role_slugs(): array {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_role_meta';
		return $wpdb->get_col( "SELECT role_slug FROM {$table}" );
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/users', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_users' ],
			'permission_callback' => [ $this, 'permission_view_users' ],
		] );

		register_rest_route( $this->namespace, '/users/(?P<id>\d+)/role', [
			'methods'             => 'PUT',
			'callback'            => [ $this, 'update_role' ],
			'permission_callback' => [ $this, 'permission_assign_role' ],
		] );

		register_rest_route( $this->namespace, '/audit-logs', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_audit_logs' ],
			'permission_callback' => [ $this, 'permission_view_audit_logs' ],
		] );
	}

	/**
	 * Phase 3 of docs/IMPLEMENTATION_PLAN_RBAC.md: granular capability checks
	 * replacing the blanket permission_admin() on all 3 routes here. All 3
	 * registry keys (users.view, users.assign_role, audit_logs.view) are
	 * `admin`-gated in Phase 1, matching who passed permission_admin() before.
	 *
	 * /audit-logs deliberately checks audit_logs.view, not users.view, even
	 * though the implementation plan's prose sketch (written before the
	 * Permission Registry existed) named users.view for both routes — the
	 * actual registry gives audit log data its own key (also used by
	 * TableController's /tables/audit_logs/* route in Phase 3.2), and using
	 * a different key for the same data on this sibling route would
	 * reintroduce the exact inconsistency Phase 3.2 just closed.
	 */
	public function permission_view_users(): bool|WP_Error {
		return $this->require_capability( 'users.view' );
	}

	public function permission_assign_role(): bool|WP_Error {
		return $this->require_capability( 'users.assign_role' );
	}

	public function permission_view_audit_logs(): bool|WP_Error {
		return $this->require_capability( 'audit_logs.view' );
	}

	private function require_capability( string $permission_key ): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		if ( ! current_user_can( PermissionRegistry::capability_for( $permission_key ) ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Admin access required.', 'pukat' ), [ 'status' => 403 ] );
		}
		return true;
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
		$role_slugs  = $this->pukat_role_slugs();

		foreach ( $users as $user ) {
			$roles      = $user->roles;
			$pukat_role = 'none';

			foreach ( $role_slugs as $r ) {
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

		$role_slugs = $this->pukat_role_slugs();

		if ( ! in_array( $new_role, array_merge( $role_slugs, [ 'none' ] ), true ) ) {
			return $this->error( 'invalid_role', __( 'Invalid Pukat role.', 'pukat' ), 422 );
		}

		// Remove all existing Pukat roles.
		foreach ( $role_slugs as $role ) {
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
