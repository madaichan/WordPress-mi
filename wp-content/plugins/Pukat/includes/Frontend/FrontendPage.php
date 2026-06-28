<?php
/**
 * Frontend page renderer — React SPA mount point for the public-facing front page.
 *
 * @package Pukat\Frontend
 */

declare(strict_types=1);

namespace Pukat\Frontend;

/**
 * Class FrontendPage
 *
 * Outputs a full standalone HTML page that mounts the React SPA
 * in "frontend" context at the /pukat URL.
 */
class FrontendPage {

	/**
	 * Render the full standalone HTML page for the Pukat front page.
	 */
	public static function render(): void {
		// Require WP login to access the frontend app.
		if ( ! is_user_logged_in() ) {
			wp_redirect( wp_login_url( home_url( '/pukat' ) ) );
			exit;
		}

		$current_user = wp_get_current_user();
		$user_roles   = $current_user->roles ?? [];

		// Determine Pukat role.
		$pukat_role = 'viewer';
		if ( in_array( 'pukat_admin', $user_roles, true ) || in_array( 'administrator', $user_roles, true ) ) {
			$pukat_role = 'admin';
		} elseif ( in_array( 'pukat_operator', $user_roles, true ) ) {
			$pukat_role = 'operator';
		}

		$dist_url      = PUKAT_PLUGIN_URL . 'assets/dist/';
		$dist_dir      = PUKAT_PLUGIN_DIR . 'assets/dist/';
		$manifest_path = $dist_dir . '.vite/manifest.json';
		$js_file       = 'assets/index.js';
		$css_file      = null;

		if ( file_exists( $manifest_path ) ) {
			$manifest = json_decode( (string) file_get_contents( $manifest_path ), true );
			if ( isset( $manifest['src/main.jsx']['file'] ) ) {
				$js_file = $manifest['src/main.jsx']['file'];
			}
			if ( isset( $manifest['src/main.jsx']['css'][0] ) ) {
				$css_file = $manifest['src/main.jsx']['css'][0];
			}
		}

		$nonce   = wp_create_nonce( 'wp_rest' );
		$rest_url = esc_url_raw( rest_url( PUKAT_REST_NAMESPACE ) );

		// Encode user data for the JS context.
		$pukat_data = wp_json_encode( [
			'restUrl'   => $rest_url,
			'nonce'     => $nonce,
			'adminUrl'  => esc_url_raw( admin_url() ),
			'pluginUrl' => esc_url_raw( PUKAT_PLUGIN_URL ),
			'version'   => PUKAT_VERSION,
			'context'   => 'frontend',
			'user'      => [
				'id'          => $current_user->ID,
				'displayName' => $current_user->display_name,
				'email'       => $current_user->user_email,
				'role'        => $pukat_role,
			],
		] );

		// Output standalone HTML page.
		?>
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="robots" content="noindex, nofollow" />
			<title>Pukat — Phishing Simulation Platform</title>
			<?php if ( $css_file && file_exists( $dist_dir . $css_file ) ) : ?>
			<link rel="stylesheet" href="<?php echo esc_url( $dist_url . $css_file ); ?>?v=<?php echo esc_attr( PUKAT_VERSION ); ?>" />
			<?php endif; ?>
		</head>
		<body style="margin:0;padding:0;background:#0F1629;">
			<div id="pukat-root"
			     data-initial-route="#/dashboard"
			     style="min-height:100vh;"
			>
				<!-- React mounts here -->
				<div id="pukat-loading" style="
					display:flex;
					align-items:center;
					justify-content:center;
					min-height:100vh;
					background:#0F1629;
					color:#6C63FF;
					font-family:Inter,sans-serif;
					flex-direction:column;
					gap:16px;
				">
					<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"/>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
					</svg>
					<span style="font-size:14px;opacity:0.7;">Loading Pukat...</span>
				</div>
			</div>

			<script>
				window.PukatData = <?php echo $pukat_data; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>;
			</script>
			<script type="module" src="<?php echo esc_url( $dist_url . $js_file ); ?>?v=<?php echo esc_attr( PUKAT_VERSION ); ?>"></script>
		</body>
		</html>
		<?php
		exit;
	}
}
