<?php
/**
 * Plugin bootstrap singleton.
 *
 * @package Pukat\Core
 */

declare(strict_types=1);

namespace Pukat\Core;

use Pukat\Admin\AdminMenu;
use Pukat\Api\CampaignController;
use Pukat\Api\GoPhishProxy;
use Pukat\Api\PlaybookController;
use Pukat\Api\QuizController;
use Pukat\Api\ReportController;
use Pukat\Api\SettingsController;
use Pukat\Api\UserController;
use Pukat\Frontend\FrontendRouter;

/**
 * Class Plugin
 *
 * Central bootstrap class. Registered via add_action('plugins_loaded').
 */
final class Plugin {

	/** @var Plugin|null */
	private static ?Plugin $instance = null;

	/** @var string Plugin version. */
	public string $version = PUKAT_VERSION;

	/**
	 * Private constructor — use ::instance().
	 */
	private function __construct() {
		$this->load_textdomain();
		$this->init_hooks();
	}

	/**
	 * Retrieve or create the singleton instance.
	 */
	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Load plugin i18n.
	 */
	private function load_textdomain(): void {
		load_plugin_textdomain(
			'pukat',
			false,
			dirname( plugin_basename( PUKAT_PLUGIN_FILE ) ) . '/languages'
		);
	}

	/**
	 * Register all WordPress hooks.
	 */
	private function init_hooks(): void {
		// Admin UI.
		add_action( 'admin_menu', [ new AdminMenu(), 'register' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );

		// Frontend SPA (public-facing /pukat page).
		( new FrontendRouter() )->register();

		// REST API.
		add_action( 'rest_api_init', [ $this, 'register_rest_routes' ] );

		// Cron: register custom interval at runtime (required every request, not just on activation).
		add_filter( 'cron_schedules', [ $this, 'register_cron_schedules' ] );
		add_action( 'pukat_process_campaign_results', [ $this, 'process_campaign_results_cron' ] );
	}

	/**
	 * Register the custom cron interval so WP recognises it at runtime.
	 *
	 * @param array $schedules Existing schedules.
	 * @return array
	 */
	public function register_cron_schedules( array $schedules ): array {
		if ( ! isset( $schedules['every_5_minutes'] ) ) {
			$schedules['every_5_minutes'] = [
				'interval' => 5 * MINUTE_IN_SECONDS,
				'display'  => __( 'Every 5 Minutes', 'pukat' ),
			];
		}
		return $schedules;
	}

	/**
	 * Enqueue the React app bundle in WP Admin for Pukat pages.
	 *
	 * @param string $hook_suffix Current admin page hook.
	 */
	public function enqueue_admin_assets( string $hook_suffix ): void {
		// Only load on Pukat admin pages.
		if ( ! str_contains( $hook_suffix, 'pukat' ) ) {
			return;
		}

		// Hide WP chrome and dequeue scripts that modify document.body after React mounts.
		// CSS goes in <head> via admin_head — never inside .wrap where WP/jQuery can move it.
		add_action( 'admin_head', static function (): void {
			?>
			<style id="pukat-admin-chrome">
			#wpadminbar, #adminmenuback, #adminmenuwrap { display: none !important; }
			html.wp-toolbar  { padding-top: 0 !important; }
			body.wp-admin    { overflow: hidden !important; }
			#wpcontent, #wpbody { margin-left: 0 !important; padding: 0 !important; }
			#wpbody-content  { padding-bottom: 0 !important; }
			</style>
			<?php
		} );

		// Dequeue WP admin scripts that inject elements into document.body after React mounts,
		// which corrupts React's DOM reconciliation and causes removeChild errors.
		wp_dequeue_script( 'heartbeat' );
		wp_dequeue_script( 'wp-auth-check' );
		wp_dequeue_script( 'admin-bar' );

		$dist_dir = PUKAT_PLUGIN_DIR . 'assets/dist/';
		$dist_url = PUKAT_PLUGIN_URL . 'assets/dist/';

		// Vite produces a manifest.json — use it to get hashed filenames.
		$manifest_path = $dist_dir . '.vite/manifest.json';
		$js_file  = 'assets/index.js';
		$css_file = null;

		if ( file_exists( $manifest_path ) ) {
			$manifest = json_decode( (string) file_get_contents( $manifest_path ), true );
			if ( isset( $manifest['src/main.jsx']['file'] ) ) {
				$js_file = $manifest['src/main.jsx']['file'];
			}
			if ( isset( $manifest['src/main.jsx']['css'][0] ) ) {
				$css_file = $manifest['src/main.jsx']['css'][0];
			}
		}

		// CSS.
		if ( $css_file && file_exists( $dist_dir . $css_file ) ) {
			wp_enqueue_style(
				'pukat-app',
				$dist_url . $css_file,
				[],
				PUKAT_VERSION
			);
		}

		// JS (module type for ESM Vite output).
		wp_enqueue_script(
			'pukat-app',
			$dist_url . $js_file,
			[],
			PUKAT_VERSION,
			true
		);

		// Mark as ES module.
		add_filter( 'script_loader_tag', static function ( string $tag, string $handle ): string {
			if ( 'pukat-app' === $handle ) {
				return str_replace( '<script ', '<script type="module" ', $tag );
			}
			return $tag;
		}, 10, 2 );

		// Pass WP context to React.
		$current_user = wp_get_current_user();
		$user_roles   = $current_user->roles ?? [];

		// Determine Pukat role.
		$pukat_role = 'viewer';
		if ( in_array( 'pukat_admin', $user_roles, true ) || in_array( 'administrator', $user_roles, true ) ) {
			$pukat_role = 'admin';
		} elseif ( in_array( 'pukat_operator', $user_roles, true ) ) {
			$pukat_role = 'operator';
		}

		wp_localize_script(
			'pukat-app',
			'PukatData',
			[
				'restUrl'   => esc_url_raw( rest_url( PUKAT_REST_NAMESPACE ) ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'adminUrl'  => esc_url_raw( admin_url() ),
				'pluginUrl' => esc_url_raw( PUKAT_PLUGIN_URL ),
				'version'   => PUKAT_VERSION,
				'context'   => 'admin',
				'user'      => [
					'id'          => $current_user->ID,
					'displayName' => $current_user->display_name,
					'email'       => $current_user->user_email,
					'role'        => $pukat_role,
				],
			]
		);
	}

	/**
	 * Register all REST API routes.
	 */
	public function register_rest_routes(): void {
		( new GoPhishProxy() )->register_routes();
		( new CampaignController() )->register_routes();
		( new PlaybookController() )->register_routes();
		( new SettingsController() )->register_routes();
		( new ReportController() )->register_routes();
		( new QuizController() )->register_routes();
		( new UserController() )->register_routes();
	}

	/**
	 * Cron callback — pull fresh results from GoPhish for active campaigns.
	 */
	public function process_campaign_results_cron(): void {
		// Implemented in GoPhishService::sync_campaign_results().
		( new \Pukat\Services\GoPhishService() )->sync_all_active_campaigns();
	}
}
