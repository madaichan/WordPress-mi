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
	 */
	private function user_entity( int $user_id ): string {
		$entity = (string) get_user_meta( $user_id, 'entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
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
