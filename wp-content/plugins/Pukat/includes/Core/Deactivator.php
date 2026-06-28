<?php
/**
 * Plugin deactivator.
 *
 * @package Pukat\Core
 */

declare(strict_types=1);

namespace Pukat\Core;

/**
 * Class Deactivator
 *
 * Runs on plugin deactivation. Cleans up scheduled events.
 * Note: DB tables and options are intentionally preserved for re-activation.
 * Use uninstall.php for full cleanup.
 */
class Deactivator {

	/**
	 * Deactivate the plugin.
	 */
	public static function deactivate(): void {
		self::clear_cron();
	}

	/**
	 * Remove all Pukat scheduled events.
	 */
	private static function clear_cron(): void {
		$timestamp = wp_next_scheduled( 'pukat_process_campaign_results' );
		if ( $timestamp ) {
			wp_unschedule_event( $timestamp, 'pukat_process_campaign_results' );
		}
	}
}
