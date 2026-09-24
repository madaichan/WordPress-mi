<?php
/**
 * Self-service user profile REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\AuditLogService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class ProfileController
 *
 * Lets the logged-in user view/edit their OWN profile — distinct from
 * UserController, which manages OTHER users' roles and is admin-gated. Every
 * method here always operates on get_current_user_id(); no endpoint accepts
 * a user ID from the client (see docs/PRD_USER_PROFILE.md §10).
 *
 * Routes:
 *   GET  /pukat/v1/me
 *   PUT  /pukat/v1/me
 *   POST /pukat/v1/me/change-password
 */
class ProfileController extends RestController {

	/** Fields update_me() is allowed to change — everything else in the request body is ignored. */
	private const UPDATABLE_FIELDS = [ 'display_name', 'email', 'phone' ];

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/me', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_me' ],
				'permission_callback' => [ $this, 'permission_logged_in' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_me' ],
				'permission_callback' => [ $this, 'permission_logged_in' ],
			],
		] );

		register_rest_route( $this->namespace, '/me/change-password', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'change_password' ],
			'permission_callback' => [ $this, 'permission_logged_in' ],
		] );
	}

	/**
	 * Self-service scope is intrinsic to get_current_user_id() — no Permission
	 * Registry capability is needed on top (docs/PRD_USER_PROFILE.md §8),
	 * unlike every other controller in this codebase which gates by role.
	 */
	public function permission_logged_in(): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		return true;
	}

	public function get_me( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		$user    = get_userdata( $user_id );

		return $this->success( [
			'id'           => $user_id,
			'display_name' => $user->display_name,
			'email'        => $user->user_email,
			'phone'        => (string) get_user_meta( $user_id, 'pukat_phone', true ),
			'avatar_url'   => get_avatar_url( $user_id ),
			'role'         => $this->current_pukat_role( $user ),
			'entity'       => $this->current_user_entity( $user_id ),
		] );
	}

	/**
	 * Only self::UPDATABLE_FIELDS is ever read from the request body — role,
	 * entity, capabilities, or any other field the client sends is silently
	 * ignored rather than rejected, so this endpoint can never be used to
	 * self-elevate (docs/PRD_USER_PROFILE.md §10). Role/entity changes only
	 * ever happen through UserController, which is admin-gated.
	 */
	public function update_me( WP_REST_Request $request ): WP_REST_Response {
		$user_id = get_current_user_id();
		$params  = $request->get_json_params() ?: [];

		$update = [ 'ID' => $user_id ];

		if ( array_key_exists( 'display_name', $params ) ) {
			$update['display_name'] = sanitize_text_field( (string) $params['display_name'] );
		}

		if ( array_key_exists( 'email', $params ) ) {
			$email = sanitize_email( (string) $params['email'] );
			if ( '' === $email || ! is_email( $email ) ) {
				return $this->error( 'invalid_email', __( 'Please provide a valid email address.', 'pukat' ), 422 );
			}
			$existing = email_exists( $email );
			if ( $existing && (int) $existing !== $user_id ) {
				return $this->error( 'email_in_use', __( 'This email address is already in use.', 'pukat' ), 409 );
			}
			$update['user_email'] = $email;
		}

		$result = wp_update_user( $update );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result, 500 );
		}

		if ( array_key_exists( 'phone', $params ) ) {
			update_user_meta( $user_id, 'pukat_phone', sanitize_text_field( (string) $params['phone'] ) );
		}

		AuditLogService::log( 'user.profile_updated', [], $user_id, 'user', $user_id );

		return $this->get_me( $request );
	}

	/**
	 * wp_set_password() invalidates every auth session for this user,
	 * including the one making this very request — the frontend must treat a
	 * successful response as "you're being logged out", not "keep going"
	 * (docs/IMPLEMENTATION_PLAN_USER_PROFILE.md §3).
	 */
	public function change_password( WP_REST_Request $request ): WP_REST_Response {
		$user_id         = get_current_user_id();
		$user            = wp_get_current_user();
		$current_password = (string) $request->get_param( 'current_password' );
		$new_password      = (string) $request->get_param( 'new_password' );

		if ( ! wp_check_password( $current_password, $user->user_pass, $user_id ) ) {
			return $this->error( 'invalid_current_password', __( 'Current password is incorrect.', 'pukat' ), 401 );
		}

		if ( '' === trim( $new_password ) ) {
			return $this->error( 'invalid_new_password', __( 'New password cannot be empty.', 'pukat' ), 422 );
		}

		wp_set_password( $new_password, $user_id );

		AuditLogService::log( 'user.password_changed', [], $user_id, 'user', $user_id );

		return $this->success( [ 'message' => __( 'Password changed. Please log in again.', 'pukat' ) ] );
	}

	/**
	 * Same 3-key fallback (meta_entity -> entity -> pukat_entity) as
	 * UserController::get_user_entity() and CampaignRunService::current_user_entity()
	 * — kept duplicated here to match the existing pattern in this codebase
	 * rather than introducing a new shared dependency for a 5-line lookup.
	 */
	private function current_user_entity( int $user_id ): string {
		$entity = (string) get_user_meta( $user_id, 'meta_entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'entity', true );
		}

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
	}

	/**
	 * Mirrors UserController::pukat_role_slugs()/get_users() role resolution
	 * so "My Profile" shows the same role label the User Access admin table
	 * shows for this same user.
	 */
	private function current_pukat_role( \WP_User $user ): string {
		global $wpdb;

		if ( in_array( 'administrator', $user->roles, true ) ) {
			return 'pukat_admin';
		}

		$role_slugs = $wpdb->get_col( "SELECT role_slug FROM {$wpdb->prefix}pukat_role_meta" );

		foreach ( $role_slugs as $slug ) {
			if ( in_array( $slug, $user->roles, true ) ) {
				return $slug;
			}
		}

		return 'none';
	}
}
