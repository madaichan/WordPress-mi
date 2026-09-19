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
use Pukat\Api\CampaignGroupController;
use Pukat\Api\CampaignRunController;
use Pukat\Api\GoPhishProxy;
use Pukat\Api\MasterComponentController;
use Pukat\Api\PlaybookController;
use Pukat\Api\PlaybookMasterController;
use Pukat\Api\QuizController;
use Pukat\Api\ReportController;
use Pukat\Api\RoleController;
use Pukat\Api\SettingsController;
use Pukat\Api\TableController;
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
	 * Allowed values for the admin-configurable GoPhish results sync interval
	 * (Settings page, `pukat_sync_interval_minutes` option). WP-Cron schedules
	 * a named interval rather than an arbitrary number of minutes, and a
	 * whitelist keeps an admin from accidentally hammering the GoPhish API
	 * with a too-aggressive value.
	 */
	public const SYNC_INTERVAL_CHOICES_MINUTES = [ 1, 5, 15, 30, 60 ];

	/** Default sync interval for installs that haven't configured one. */
	public const DEFAULT_SYNC_INTERVAL_MINUTES = 1;

	/**
	 * The configured GoPhish results sync interval, in minutes — clamped to
	 * SYNC_INTERVAL_CHOICES_MINUTES so a stray/invalid stored value can never
	 * schedule something outside the allowed range.
	 */
	public static function sync_interval_minutes(): int {
		$minutes = (int) get_option( 'pukat_sync_interval_minutes', self::DEFAULT_SYNC_INTERVAL_MINUTES );
		return in_array( $minutes, self::SYNC_INTERVAL_CHOICES_MINUTES, true )
			? $minutes
			: self::DEFAULT_SYNC_INTERVAL_MINUTES;
	}

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
		$this->ensure_campaign_results_cron_scheduled();

		// Reschedule immediately when the Settings page saves a new sync
		// interval, rather than waiting for the next unrelated request to
		// self-heal it (see ensure_campaign_results_cron_scheduled()).
		add_action( 'update_option_pukat_sync_interval_minutes', [ $this, 'ensure_campaign_results_cron_scheduled' ] );
		add_action( 'add_option_pukat_sync_interval_minutes', [ $this, 'ensure_campaign_results_cron_scheduled' ] );
	}

	/**
	 * Self-heals the recurring GoPhish results sync if it's ever missing, and
	 * migrates an already-scheduled event onto the currently configured
	 * interval — WP-Cron keeps whatever schedule was passed to
	 * wp_schedule_event() at the time it was scheduled, so a stored option
	 * change alone doesn't move an event that's already running. Checking on
	 * every request is cheap (single autoloaded option); also invoked
	 * directly when the option changes (see init_hooks()).
	 */
	public function ensure_campaign_results_cron_scheduled(): void {
		$next_run        = wp_next_scheduled( 'pukat_process_campaign_results' );
		$desired_interval = self::sync_interval_minutes() * MINUTE_IN_SECONDS;

		if ( ! $next_run ) {
			wp_schedule_event( time(), 'pukat_sync_interval', 'pukat_process_campaign_results' );
			return;
		}

		$event = wp_get_scheduled_event( 'pukat_process_campaign_results' );
		if ( $event && ( 'pukat_sync_interval' !== $event->schedule || (int) $event->interval !== $desired_interval ) ) {
			wp_unschedule_event( $next_run, 'pukat_process_campaign_results' );
			wp_schedule_event( time(), 'pukat_sync_interval', 'pukat_process_campaign_results' );
		}
	}

	/**
	 * Register the custom cron interval so WP recognises it at runtime. The
	 * interval is computed from the admin-configured option on every request
	 * (WP-Cron doesn't cache this filter's result across requests), so
	 * ensure_campaign_results_cron_scheduled() is what actually detects and
	 * applies a changed value onto the live scheduled event.
	 *
	 * @param array $schedules Existing schedules.
	 * @return array
	 */
	public function register_cron_schedules( array $schedules ): array {
		$minutes = self::sync_interval_minutes();
		$schedules['pukat_sync_interval'] = [
			'interval' => $minutes * MINUTE_IN_SECONDS,
			/* translators: %d: sync interval in minutes. */
			'display'  => sprintf( _n( 'Every %d Minute (Pukat sync)', 'Every %d Minutes (Pukat sync)', $minutes, 'pukat' ), $minutes ),
		];
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

		$dev_server = $this->vite_dev_server_url();

		if ( null !== $dev_server ) {
			add_action( 'admin_head', static function () use ( $dev_server ): void {
				?>
				<script type="module">
				import RefreshRuntime from '<?php echo esc_url( $dev_server . '/@react-refresh' ); ?>';
				RefreshRuntime.injectIntoGlobalHook(window);
				window.$RefreshReg$ = () => {};
				window.$RefreshSig$ = () => (type) => type;
				window.__vite_plugin_react_preamble_installed__ = true;
				</script>
				<?php
			} );

			wp_enqueue_script(
				'pukat-vite-client',
				$dev_server . '/@vite/client',
				[],
				null,
				true
			);
			wp_enqueue_script(
				'pukat-app',
				$dev_server . '/src/main.jsx',
				[ 'pukat-vite-client' ],
				null,
				true
			);

			add_filter( 'script_loader_tag', static function ( string $tag, string $handle ): string {
				if ( in_array( $handle, [ 'pukat-vite-client', 'pukat-app' ], true ) ) {
					return str_replace( '<script ', '<script type="module" ', $tag );
				}
				return $tag;
			}, 10, 2 );

			wp_localize_script(
				'pukat-app',
				'PukatData',
				( new UserContextService() )->app_context( 'admin' )
			);

			return;
		}

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
		// $ver is deliberately null, not PUKAT_VERSION: passing a version
		// string makes WP append `?ver=X` to the src, which duplicates this
		// module under the ESM loader (Vite's chunk-to-chunk imports for lazy
		// routes reference this file with no querystring) — see the matching
		// fix + full explanation in FrontendPage.php. The filename is already
		// content-hashed by Vite, so no manual cache-buster is needed anyway.
		wp_enqueue_script(
			'pukat-app',
			$assets['dist_url'] . $assets['js_file'],
			[],
			null,
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
	 * Resolve a browser-accessible Vite dev server URL when dev mode is enabled.
	 */
	private function vite_dev_server_url(): ?string {
		if ( defined( 'PUKAT_VITE_DEV_SERVER' ) && PUKAT_VITE_DEV_SERVER ) {
			return untrailingslashit( (string) PUKAT_VITE_DEV_SERVER );
		}

		$dev_server = getenv( 'PUKAT_VITE_DEV_SERVER' );

		if ( false !== $dev_server && '' !== trim( $dev_server ) ) {
			return untrailingslashit( $dev_server );
		}

		return null;
	}

	/**
	 * Register all REST API routes.
	 */
	public function register_rest_routes(): void {
		self::register_binary_response_support();

		( new GoPhishProxy() )->register_routes();
		( new MasterComponentController() )->register_routes();
		( new PlaybookMasterController() )->register_routes();
		( new CampaignRunController() )->register_routes();
		( new CampaignGroupController() )->register_routes();
		( new CampaignController() )->register_routes();
		( new PlaybookController() )->register_routes();
		( new SettingsController() )->register_routes();
		( new ReportController() )->register_routes();
		( new QuizController() )->register_routes();
		( new UserController() )->register_routes();
		( new TableController() )->register_routes();
		( new RoleController() )->register_routes();
	}

	/**
	 * Every Pukat REST response is JSON except the PDF export endpoints
	 * (RestController::binary_response(), used by CampaignGroupController/
	 * CampaignRunController for docs/PRD_CAMPAIGN_GROUP_MONITORING.md §7.5
	 * FR-11) — those set a non-JSON Content-Type, which this filter uses as
	 * the signal to echo the raw body instead of letting WP's REST server
	 * JSON-encode it. Registered once here rather than per-controller so the
	 * hook is never attached twice.
	 */
	private static function register_binary_response_support(): void {
		add_filter( 'rest_pre_serve_request', function ( bool $served, \WP_REST_Response $result ): bool {
			$content_type = $result->get_headers()['Content-Type'] ?? '';
			if ( ! $content_type || false !== strpos( $content_type, 'json' ) ) {
				return $served;
			}

			foreach ( $result->get_headers() as $header => $value ) {
				header( "{$header}: {$value}" );
			}
			echo $result->get_data(); // phpcs:ignore -- raw binary (PDF) body, not HTML output.

			return true;
		}, 10, 2 );
	}

	/**
	 * Cron callback — pull fresh results from GoPhish for active campaigns.
	 */
	public function process_campaign_results_cron(): void {
		// Implemented in GoPhishService::sync_campaign_results().
		( new \Pukat\Services\GoPhishService() )->sync_all_active_campaigns();
	}
}
