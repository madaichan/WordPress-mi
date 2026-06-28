<?php
/**
 * Plugin Name:       Pukat — Phishing Simulation Platform
 * Plugin URI:        https://github.com/your-org/pukat
 * Description:       Comprehensive phishing simulation management platform powered by GoPhish engine. Manage campaigns, targets, quiz modules, risk scoring, and reporting — all from WordPress.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      8.1
 * Author:            Flow Beyond Team
 * Author URI:        https://flowbeyond.id
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       pukat
 * Domain Path:       /languages
 *
 * @package Pukat
 */

declare(strict_types=1);

// Abort if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

define( 'PUKAT_VERSION',       '1.0.0' );
define( 'PUKAT_PLUGIN_DIR',    plugin_dir_path( __FILE__ ) );
define( 'PUKAT_PLUGIN_URL',    plugin_dir_url( __FILE__ ) );
define( 'PUKAT_PLUGIN_FILE',   __FILE__ );
define( 'PUKAT_REST_NAMESPACE', 'pukat/v1' );
define( 'PUKAT_MIN_PHP',       '8.1' );
define( 'PUKAT_MIN_WP',        '6.0' );

// ---------------------------------------------------------------------------
// PHP version guard
// ---------------------------------------------------------------------------

if ( version_compare( PHP_VERSION, PUKAT_MIN_PHP, '<' ) ) {
	add_action( 'admin_notices', static function (): void {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			sprintf(
				/* translators: 1: required PHP version, 2: current PHP version */
				esc_html__( 'Pukat requires PHP %1$s or higher. Your server is running PHP %2$s.', 'pukat' ),
				esc_html( PUKAT_MIN_PHP ),
				esc_html( PHP_VERSION )
			)
		);
	} );
	return;
}

// ---------------------------------------------------------------------------
// Autoloader — Composer (preferred) or manual PSR-4 fallback
// ---------------------------------------------------------------------------

$pukat_autoload = PUKAT_PLUGIN_DIR . 'vendor/autoload.php';
if ( file_exists( $pukat_autoload ) ) {
	require_once $pukat_autoload;
} else {
	spl_autoload_register( static function ( string $class ): void {
		$prefix   = 'Pukat\\';
		$base_dir = PUKAT_PLUGIN_DIR . 'includes/';
		$len      = strlen( $prefix );

		if ( strncmp( $prefix, $class, $len ) !== 0 ) {
			return;
		}

		$relative_class = substr( $class, $len );
		$file           = $base_dir . str_replace( '\\', '/', $relative_class ) . '.php';

		if ( file_exists( $file ) ) {
			require_once $file;
		}
	} );
}

// ---------------------------------------------------------------------------
// Activation / Deactivation hooks
// ---------------------------------------------------------------------------

register_activation_hook( __FILE__, [ 'Pukat\\Core\\Activator', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'Pukat\\Core\\Deactivator', 'deactivate' ] );

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Returns the singleton plugin instance.
 *
 * @return \Pukat\Core\Plugin
 */
function pukat(): \Pukat\Core\Plugin {
	return \Pukat\Core\Plugin::instance();
}

// Boot after all plugins are loaded.
add_action( 'plugins_loaded', 'pukat' );
