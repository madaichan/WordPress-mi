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
		$dev_server = self::vite_dev_server_url();
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
			<?php if ( null === $dev_server && $assets['css_file'] && file_exists( $assets['dist_dir'] . $assets['css_file'] ) ) : ?>
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
			<?php
			/*
			 * No manual ?v= cache-buster here: Vite already content-hashes
			 * this filename (main-<hash>.js), and appending one anyway broke
			 * the app. Vite's chunk-to-chunk imports (e.g. a lazy route
			 * pulling `useNavigate` from this main chunk) use a bare relative
			 * specifier with no query string. A querystring on THIS script
			 * tag made the browser's ES module loader treat
			 * "main-<hash>.js?v=X" and "main-<hash>.js" as two different
			 * modules, instantiating React twice — any lazy-loaded page
			 * whose hooks resolved through the second copy crashed with
			 * "Invalid hook call" (React never activated that copy's
			 * dispatcher), which then surfaced as a removeChild NotFoundError
			 * during the failed render's cleanup.
			 */
			?>
			<?php if ( null !== $dev_server ) : ?>
			<script type="module">
				import RefreshRuntime from '<?php echo esc_url( $dev_server . '/@react-refresh' ); ?>';
				RefreshRuntime.injectIntoGlobalHook(window);
				window.$RefreshReg$ = () => {};
				window.$RefreshSig$ = () => (type) => type;
				window.__vite_plugin_react_preamble_installed__ = true;
			</script>
			<script type="module" src="<?php echo esc_url( $dev_server . '/@vite/client' ); ?>"></script>
			<script type="module" src="<?php echo esc_url( $dev_server . '/src/main.jsx' ); ?>"></script>
			<?php else : ?>
			<script type="module" src="<?php echo esc_url( $assets['dist_url'] . $assets['js_file'] ); ?>"></script>
			<?php endif; ?>
		</body>
		</html>
		<?php
		exit;
	}

	/**
	 * Resolve the configured Vite dev server URL.
	 */
	private static function vite_dev_server_url(): ?string {
		if ( defined( 'PUKAT_VITE_DEV_SERVER' ) && PUKAT_VITE_DEV_SERVER ) {
			return untrailingslashit( (string) PUKAT_VITE_DEV_SERVER );
		}

		$dev_server = getenv( 'PUKAT_VITE_DEV_SERVER' );

		if ( false !== $dev_server && '' !== trim( $dev_server ) ) {
			return untrailingslashit( $dev_server );
		}

		return null;
	}
}
