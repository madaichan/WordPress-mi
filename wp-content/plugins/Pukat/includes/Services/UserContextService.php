<?php
/**
 * Current user context for the Pukat React app.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * Builds the browser-safe context injected into the React app.
 */
class UserContextService {

	/** Frontend SPA route landed on when no role override applies. */
	private const DEFAULT_LANDING_ROUTE = '/dashboard';

	/**
	 * Build the data exposed to window.PukatData.
	 *
	 * @param string $context Application context: admin|frontend.
	 * @return array<string, mixed>
	 */
	public function app_context( string $context ): array {
		$current_user = wp_get_current_user();

		return [
			'restUrl'   => esc_url_raw( rest_url( PUKAT_REST_NAMESPACE ) ),
			'nonce'     => wp_create_nonce( 'wp_rest' ),
			'adminUrl'  => esc_url_raw( admin_url() ),
			'logoutUrl' => esc_url_raw( wp_logout_url( admin_url() ) ),
			'pluginUrl' => esc_url_raw( PUKAT_PLUGIN_URL ),
			'version'   => PUKAT_VERSION,
			'context'   => $context,
			'user'      => [
				'id'          => $current_user->ID,
				'displayName' => $current_user->display_name,
				'email'       => $current_user->user_email,
				'role'        => $this->pukat_role( $current_user->roles ?? [] ),
				'entity'      => $this->user_entity( (int) $current_user->ID ),
			],
		];
	}

	/**
	 * Resolve the current user's entity code from WordPress user meta.
	 *
	 * `meta_entity` is the canonical key — every other entity-aware backend
	 * service (PlaybookMasterService, PlaybookService, CampaignRunService,
	 * CampaignGroupService, UserController) resolves it in this same
	 * `meta_entity` -> `entity` -> `pukat_entity` order. This was the one
	 * place still skipping `meta_entity`, so the frontend (`window.PukatData
	 * .user.entity`, read via `getUserEntity()`) saw an empty entity for any
	 * user whose entity actually lives under `meta_entity` — hiding
	 * entity-scoped Create/Edit actions the backend would otherwise allow.
	 */
	private function user_entity( int $user_id ): string {
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
	 * Resolve the frontend SPA hash route the given user should land on for a
	 * fresh visit to `/pukat` (login, or typing the bare URL with no hash
	 * already in the address bar — see `main.jsx`'s `data-initial-route`
	 * handling, which only ever applies when `window.location.hash` is empty).
	 *
	 * Looks up `wp_pukat_role_meta.landing_menu` for the first of the user's
	 * WP roles that has a row there (mirrors the single-active-Pukat-role
	 * model `UserController::update_role()` enforces). Falls back to
	 * `/dashboard` when: the user has no matching role row, the role has no
	 * `landing_menu` set, the menu has no frontend route (`PermissionRegistry
	 * ::landing_route_for_menu()`), or the user no longer actually holds the
	 * `<menu>.view` capability the configured page requires (e.g. permissions
	 * were edited after the landing page was set) — a misconfigured landing
	 * page should degrade to the safe default, not strand the user on
	 * `PermissionRoute`'s forbidden state on every login.
	 */
	public function resolve_landing_route( \WP_User $user ): string {
		global $wpdb;

		$roles = $user->roles ?? [];
		if ( ! $roles ) {
			return self::DEFAULT_LANDING_ROUTE;
		}

		$table       = $wpdb->prefix . 'pukat_role_meta';
		$placeholders = implode( ', ', array_fill( 0, count( $roles ), '%s' ) );
		$landing_menu = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT landing_menu FROM {$table} WHERE role_slug IN ({$placeholders}) AND landing_menu IS NOT NULL LIMIT 1",
				$roles
			)
		);

		if ( ! $landing_menu ) {
			return self::DEFAULT_LANDING_ROUTE;
		}

		$route = PermissionRegistry::landing_route_for_menu( $landing_menu );
		if ( ! $route ) {
			return self::DEFAULT_LANDING_ROUTE;
		}

		if ( ! user_can( $user, PermissionRegistry::capability_for( "{$landing_menu}.view" ) ) ) {
			return self::DEFAULT_LANDING_ROUTE;
		}

		return $route;
	}

	/**
	 * Resolve the Pukat application role from WordPress roles.
	 *
	 * @param array<int, string> $roles WordPress user roles.
	 */
	public function pukat_role( array $roles ): string {
		if ( in_array( 'pukat_admin', $roles, true ) || in_array( 'administrator', $roles, true ) ) {
			return 'admin';
		}

		if ( in_array( 'pukat_operator', $roles, true ) ) {
			return 'operator';
		}

		return 'viewer';
	}
}
