<?php
/**
 * Admin page renderer — the React SPA mount point.
 *
 * @package Pukat\Admin
 */

declare(strict_types=1);

namespace Pukat\Admin;

use Pukat\Services\AssetManifestService;
use Pukat\Services\UserContextService;

/**
 * Class AdminPage
 *
 * Outputs a minimal HTML container. The React bundle mounts into #pukat-root.
 */
class AdminPage {

	/**
	 * Output a fully standalone HTML page for Pukat Admin and exit.
	 *
	 * Called from the 'load-{hook}' action, which fires BEFORE WordPress outputs
	 * any admin HTML. By exiting here, we bypass the WP admin shell entirely —
	 * no admin-bar.js, no common.js, no jQuery — so React's DOM reconciliation
	 * never conflicts with WP scripts.
	 *
	 * @param string $initial_hash URL hash for the SPA to navigate to on load (e.g. '#/admin/settings').
	 */
	public static function render_standalone( string $initial_hash = '' ): void {
		if ( ! is_user_logged_in() || ! current_user_can( 'read' ) ) {
			wp_die( esc_html__( 'Access denied.', 'pukat' ) );
		}

		$assets     = ( new AssetManifestService() )->app_entry();
		$pukat_data = wp_json_encode( ( new UserContextService() )->app_context( 'admin' ) );
		?>
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<meta name="robots" content="noindex, nofollow" />
			<title>Pukat Admin</title>
			<?php if ( $assets['css_file'] && file_exists( $assets['dist_dir'] . $assets['css_file'] ) ) : ?>
			<link rel="stylesheet" href="<?php echo esc_url( $assets['dist_url'] . $assets['css_file'] ); ?>?v=<?php echo esc_attr( PUKAT_VERSION ); ?>" />
			<?php endif; ?>
		</head>
		<body style="margin:0;padding:0;background:#0F1629;">
			<div id="pukat-root"
			     data-initial-route="<?php echo esc_attr( $initial_hash ); ?>"
			     style="min-height:100vh;">
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

	/**
	 * Render the React app container (legacy fallback — used only if load-{hook} doesn't fire).
	 *
	 * @param string $initial_hash Optional URL hash to pass as initial route.
	 */
	public static function render( string $initial_hash = '' ): void {
		// Remove WP default admin notices for clean SPA look.
		remove_all_actions( 'admin_notices' );
		// CSS is output via admin_head in Plugin::enqueue_admin_assets() — not here,
		// because a <style> inside .wrap can be moved by WP/jQuery and confuse React.
		?>
		<div id="pukat-app-wrapper" style="
			position: fixed;
			inset: 0;
			z-index: 100000;
			overflow: auto;
			background: #0F1629;
		">
			<div id="pukat-root"
				 data-initial-route="<?php echo esc_attr( $initial_hash ); ?>"
				 style="min-height: 100vh;">
				<!-- React mounts here -->
				<div id="pukat-loading" style="
					display: flex;
					align-items: center;
					justify-content: center;
					min-height: 100vh;
					background: #0F1629;
					color: #6C63FF;
					font-family: Inter, sans-serif;
					flex-direction: column;
					gap: 16px;
				">
					<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"/>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
					</svg>
					<span style="font-size: 14px; opacity: 0.7;">Loading Pukat...</span>
				</div>
			</div>
		</div>
		<?php
	}
}
