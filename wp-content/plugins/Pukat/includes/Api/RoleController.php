<?php
/**
 * RBAC role management REST controller.
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
 * Class RoleController
 *
 * CRUD for dynamic RBAC roles, backed by WP's native role/capability
 * storage plus the `wp_pukat_role_meta` table for display metadata (see
 * `Activator::seed_rbac_defaults()`). Every permission a role can be
 * granted must exist in `PermissionRegistry` — this controller is the
 * only place role/capability grants change, so it's also the only place
 * that needs to enforce the whitelist and the Admin lockout guard.
 *
 * Routes:
 *   GET    /pukat/v1/roles
 *   POST   /pukat/v1/roles
 *   PUT    /pukat/v1/roles/{slug}
 *   DELETE /pukat/v1/roles/{slug}
 *   GET    /pukat/v1/permissions/registry
 *   GET    /pukat/v1/me/permissions
 */
class RoleController extends RestController {

	/** Slug prefix for admin-created custom roles — never collides with the 4 system role slugs. */
	private const CUSTOM_ROLE_PREFIX = 'pukat_role_';

	/** Max length of a WP role slug this controller will generate/accept. */
	private const MAX_SLUG_LENGTH = 60;

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/roles', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_roles' ],
				'permission_callback' => [ $this, 'permission_manage_roles' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_role' ],
				'permission_callback' => [ $this, 'permission_manage_roles' ],
			],
		] );

		register_rest_route( $this->namespace, '/roles/(?P<slug>[a-z0-9_]+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_role' ],
				'permission_callback' => [ $this, 'permission_manage_roles' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_role' ],
				'permission_callback' => [ $this, 'permission_manage_roles' ],
			],
		] );

		register_rest_route( $this->namespace, '/permissions/registry', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_permissions_registry' ],
			'permission_callback' => [ $this, 'permission_manage_roles' ],
		] );

		register_rest_route( $this->namespace, '/me/permissions', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_my_permissions' ],
			'permission_callback' => [ $this, 'permission_logged_in' ],
		] );
	}

	// ---------------------------------------------------------------------------
	// Permission callbacks
	// ---------------------------------------------------------------------------

	/**
	 * Permission: user must hold the `users.manage_roles` registry capability.
	 * Seeded onto `pukat_admin`/`administrator` in Phase 1 (Activator::seed_rbac_defaults()).
	 */
	public function permission_manage_roles(): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		if ( ! current_user_can( PermissionRegistry::capability_for( 'users.manage_roles' ) ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Role management access required.', 'pukat' ), [ 'status' => 403 ] );
		}
		return true;
	}

	/**
	 * Permission: any logged-in user can read their own permission set —
	 * this is what an empty-permission role uses to render an empty nav.
	 */
	public function permission_logged_in(): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		return true;
	}

	// ---------------------------------------------------------------------------
	// Roles
	// ---------------------------------------------------------------------------

	public function get_roles( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_role_meta';
		$slugs = $wpdb->get_col( "SELECT role_slug FROM {$table} ORDER BY is_system_role DESC, display_name ASC" );

		return $this->success( array_map( [ $this, 'present_role' ], $slugs ) );
	}

	public function create_role( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$display_name = sanitize_text_field( (string) $request->get_param( 'display_name' ) );
		$description  = sanitize_textarea_field( (string) $request->get_param( 'description' ) );
		$permissions  = $this->sanitize_permission_keys( $request->get_param( 'permissions' ) );

		if ( '' === trim( $display_name ) ) {
			return $this->error( 'validation_error', __( 'display_name is required.', 'pukat' ), 422 );
		}

		$unknown = $this->unknown_permission_keys( $permissions );
		if ( $unknown ) {
			return $this->error(
				'invalid_permission_key',
				sprintf( __( 'Unknown permission key(s): %s', 'pukat' ), implode( ', ', $unknown ) ),
				422
			);
		}

		$slug = $this->generate_unique_slug( $display_name );
		if ( ! $slug ) {
			return $this->error( 'validation_error', __( 'Could not derive a role slug from display_name.', 'pukat' ), 422 );
		}

		add_role( $slug, $display_name, [ 'read' => true ] );
		$role = get_role( $slug );
		foreach ( $permissions as $key ) {
			$role->add_cap( PermissionRegistry::capability_for( $key ) );
		}

		$table = $wpdb->prefix . 'pukat_role_meta';
		$wpdb->insert(
			$table,
			[
				'role_slug'      => $slug,
				'display_name'   => $display_name,
				'description'    => $description,
				'is_system_role' => 0,
				'created_by'     => get_current_user_id(),
				'created_at'     => current_time( 'mysql' ),
				'updated_at'     => current_time( 'mysql' ),
			],
			[ '%s', '%s', '%s', '%d', '%d', '%s', '%s' ]
		);

		AuditLogService::log( 'role.created', [
			'role_slug'    => $slug,
			'display_name' => $display_name,
			'permissions'  => $permissions,
		], null, 'role', null );

		return $this->success( $this->present_role( $slug ), 201 );
	}

	public function update_role( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$slug      = sanitize_key( (string) $request->get_param( 'slug' ) );
		$role_meta = $this->get_role_meta_row( $slug );

		if ( ! $role_meta ) {
			return $this->error( 'not_found', __( 'Role not found.', 'pukat' ), 404 );
		}

		$role = get_role( $slug );
		if ( ! $role ) {
			return $this->error( 'not_found', __( 'Role not found.', 'pukat' ), 404 );
		}

		$table  = $wpdb->prefix . 'pukat_role_meta';
		$update = [ 'updated_by' => get_current_user_id(), 'updated_at' => current_time( 'mysql' ) ];

		if ( null !== $request->get_param( 'display_name' ) ) {
			$display_name = sanitize_text_field( (string) $request->get_param( 'display_name' ) );
			if ( '' === trim( $display_name ) ) {
				return $this->error( 'validation_error', __( 'display_name cannot be empty.', 'pukat' ), 422 );
			}
			$update['display_name'] = $display_name;
		}

		if ( null !== $request->get_param( 'description' ) ) {
			$update['description'] = sanitize_textarea_field( (string) $request->get_param( 'description' ) );
		}

		$granted = [];
		$revoked = [];

		if ( null !== $request->get_param( 'permissions' ) ) {
			$permissions = $this->sanitize_permission_keys( $request->get_param( 'permissions' ) );

			$unknown = $this->unknown_permission_keys( $permissions );
			if ( $unknown ) {
				return $this->error(
					'invalid_permission_key',
					sprintf( __( 'Unknown permission key(s): %s', 'pukat' ), implode( ', ', $unknown ) ),
					422
				);
			}

			if ( 'pukat_admin' === $slug && ! in_array( 'users.manage_roles', $permissions, true ) ) {
				return $this->error(
					'lockout_prevented',
					__( 'The Admin role cannot lose its own role-management permission.', 'pukat' ),
					400
				);
			}

			foreach ( PermissionRegistry::all() as $entry ) {
				$capability = $entry['capability'];
				$should_have = in_array( $entry['key'], $permissions, true );
				$has_now     = $role->has_cap( $capability );

				if ( $should_have && ! $has_now ) {
					$role->add_cap( $capability );
					$granted[] = $entry['key'];
				} elseif ( ! $should_have && $has_now ) {
					$role->remove_cap( $capability );
					$revoked[] = $entry['key'];
				}
			}
		}

		$wpdb->update( $table, $update, [ 'role_slug' => $slug ], null, [ '%s' ] );

		AuditLogService::log( 'role.updated', [
			'role_slug' => $slug,
			'changes'   => array_diff_key( $update, [ 'updated_by' => 1, 'updated_at' => 1 ] ),
		], null, 'role', null );

		if ( $granted ) {
			AuditLogService::log( 'role.permission_granted', [ 'role_slug' => $slug, 'permissions' => $granted ], null, 'role', null );
		}
		if ( $revoked ) {
			AuditLogService::log( 'role.permission_revoked', [ 'role_slug' => $slug, 'permissions' => $revoked ], null, 'role', null );
		}

		return $this->success( $this->present_role( $slug ) );
	}

	public function delete_role( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$slug      = sanitize_key( (string) $request->get_param( 'slug' ) );
		$role_meta = $this->get_role_meta_row( $slug );

		if ( ! $role_meta ) {
			return $this->error( 'not_found', __( 'Role not found.', 'pukat' ), 404 );
		}

		if ( '1' === (string) $role_meta['is_system_role'] ) {
			return $this->error( 'system_role', __( 'System roles cannot be deleted.', 'pukat' ), 400 );
		}

		$users_with_role = get_users( [ 'role' => $slug, 'fields' => 'ID', 'number' => 1 ] );
		if ( $users_with_role ) {
			return $this->error( 'role_in_use', __( 'This role is still assigned to at least one user.', 'pukat' ), 409 );
		}

		remove_role( $slug );

		$table = $wpdb->prefix . 'pukat_role_meta';
		$wpdb->delete( $table, [ 'role_slug' => $slug ], [ '%s' ] );

		AuditLogService::log( 'role.deleted', [ 'role_slug' => $slug ], null, 'role', null );

		return $this->success( [ 'role_slug' => $slug ] );
	}

	// ---------------------------------------------------------------------------
	// Permission registry / self permissions
	// ---------------------------------------------------------------------------

	public function get_permissions_registry( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( PermissionRegistry::grouped() );
	}

	public function get_my_permissions( WP_REST_Request $request ): WP_REST_Response {
		$granted = [];

		foreach ( PermissionRegistry::all() as $entry ) {
			if ( current_user_can( $entry['capability'] ) ) {
				$granted[] = $entry['key'];
			}
		}

		return $this->success( [ 'permissions' => $granted ] );
	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	/**
	 * @return array<string, mixed>|null
	 */
	private function get_role_meta_row( string $slug ): ?array {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_role_meta';
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE role_slug = %s", $slug ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Build the API representation of a role: metadata + granted permission keys + user count.
	 */
	private function present_role( string $slug ): array {
		$role_meta = $this->get_role_meta_row( $slug );
		$role      = get_role( $slug );

		$permissions = [];
		if ( $role ) {
			foreach ( PermissionRegistry::all() as $entry ) {
				if ( $role->has_cap( $entry['capability'] ) ) {
					$permissions[] = $entry['key'];
				}
			}
		}

		$user_count = count( get_users( [ 'role' => $slug, 'fields' => 'ID' ] ) );

		return [
			'role_slug'      => $slug,
			'display_name'   => $role_meta['display_name'] ?? $slug,
			'description'    => $role_meta['description'] ?? '',
			'is_system_role' => isset( $role_meta['is_system_role'] ) && '1' === (string) $role_meta['is_system_role'],
			'user_count'     => $user_count,
			'permissions'    => $permissions,
		];
	}

	/**
	 * @return string[]
	 */
	private function sanitize_permission_keys( mixed $raw ): array {
		if ( ! is_array( $raw ) ) {
			return [];
		}

		return array_values( array_unique( array_map( 'sanitize_text_field', $raw ) ) );
	}

	/**
	 * @param string[] $keys
	 * @return string[] the subset of $keys that are NOT in the Permission Registry
	 */
	private function unknown_permission_keys( array $keys ): array {
		return array_values( array_filter( $keys, static fn( string $key ): bool => ! PermissionRegistry::has_key( $key ) ) );
	}

	/**
	 * Derive a unique, bounded-length WP role slug from a display name.
	 * Returns null if the display name has no usable characters.
	 */
	private function generate_unique_slug( string $display_name ): ?string {
		$base = sanitize_key( $display_name );
		if ( '' === $base ) {
			return null;
		}

		$max_base_length = self::MAX_SLUG_LENGTH - strlen( self::CUSTOM_ROLE_PREFIX );
		$base            = substr( $base, 0, $max_base_length );
		$slug            = self::CUSTOM_ROLE_PREFIX . $base;

		$suffix = 2;
		while ( get_role( $slug ) || $this->get_role_meta_row( $slug ) ) {
			$candidate_suffix = '_' . $suffix;
			$slug             = self::CUSTOM_ROLE_PREFIX . substr( $base, 0, $max_base_length - strlen( $candidate_suffix ) ) . $candidate_suffix;
			++$suffix;
		}

		return $slug;
	}
}
