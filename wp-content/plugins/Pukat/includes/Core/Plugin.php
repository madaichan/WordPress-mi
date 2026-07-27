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
use Pukat\Api\CampaignRunController;
use Pukat\Api\GoPhishProxy;
use Pukat\Api\MasterComponentController;
use Pukat\Api\PlaybookController;
use Pukat\Api\PlaybookMasterController;
use Pukat\Api\QuizController;
use Pukat\Api\ReportController;
use Pukat\Api\SettingsController;
use Pukat\Api\UserController;
use Pukat\Frontend\FrontendRouter;
use Pukat\Services\AssetManifestService;
use Pukat\Services\UserContextService;

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
		Activator::maybe_upgrade();

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

		$assets = ( new AssetManifestService() )->app_entry();

		// CSS.
		if ( $assets['css_file'] && file_exists( $assets['dist_dir'] . $assets['css_file'] ) ) {
			wp_enqueue_style(
				'pukat-app',
				$assets['dist_url'] . $assets['css_file'],
				[],
				PUKAT_VERSION
			);
		}

		// JS (module type for ESM Vite output).
		wp_enqueue_script(
			'pukat-app',
			$assets['dist_url'] . $assets['js_file'],
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

		wp_localize_script(
			'pukat-app',
			'PukatData',
			( new UserContextService() )->app_context( 'admin' )
		);
	}

	/**
	 * Register all REST API routes.
	 */
	public function register_rest_routes(): void {
		( new GoPhishProxy() )->register_routes();
		( new MasterComponentController() )->register_routes();
		( new PlaybookMasterController() )->register_routes();
		( new CampaignRunController() )->register_routes();
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
