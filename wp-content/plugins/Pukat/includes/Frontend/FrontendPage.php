<?php
/**
 * Frontend page renderer — React SPA mount point for the public-facing front page.
 *
 * @package Pukat\Frontend
 */

declare(strict_types=1);

namespace Pukat\Frontend;

use Pukat\Services\AssetManifestService;
use Pukat\Services\UserContextService;

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

		$assets     = ( new AssetManifestService() )->app_entry();
		$pukat_data = wp_json_encode( ( new UserContextService() )->app_context( 'frontend' ) );

		// Output standalone HTML page.
		?>
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="robots" content="noindex, nofollow" />
			<title>Pukat — Phishing Simulation Platform</title>
			<?php if ( $assets['css_file'] && file_exists( $assets['dist_dir'] . $assets['css_file'] ) ) : ?>
			<link rel="stylesheet" href="<?php echo esc_url( $assets['dist_url'] . $assets['css_file'] ); ?>?v=<?php echo esc_attr( PUKAT_VERSION ); ?>" />
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
			<script type="module" src="<?php echo esc_url( $assets['dist_url'] . $assets['js_file'] ); ?>?v=<?php echo esc_attr( PUKAT_VERSION ); ?>"></script>
		</body>
		</html>
		<?php
		exit;
	}
}
