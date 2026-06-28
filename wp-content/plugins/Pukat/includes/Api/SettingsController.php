<?php
/**
 * Settings REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\AuditLogService;
use Pukat\Services\EncryptionService;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class SettingsController
 *
 * Manages global plugin settings including GoPhish connection config.
 *
 * Routes:
 *   GET  /pukat/v1/settings
 *   PUT  /pukat/v1/settings
 */
class SettingsController extends RestController {

	/** Option keys that are safe to expose to the frontend (no secrets). */
	private const PUBLIC_SETTINGS = [
		'pukat_org_name',
		'pukat_org_logo',
		'pukat_timezone',
		'pukat_quiz_pass_score',
		'pukat_risk_thresholds',
		'pukat_blackout_dates',
		'pukat_gophish_url',
	];

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/settings', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_settings' ],
				'permission_callback' => [ $this, 'permission_admin' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_settings' ],
				'permission_callback' => [ $this, 'permission_admin' ],
			],
		] );
	}

	public function get_settings( WP_REST_Request $request ): WP_REST_Response {
		$settings = [];
		foreach ( self::PUBLIC_SETTINGS as $key ) {
			$settings[ $key ] = get_option( $key, '' );
		}
		// Indicate whether API key is set (without revealing it).
		$encrypted_key             = (string) get_option( 'pukat_gophish_api_key', '' );
		$settings['has_api_key']   = ! empty( $encrypted_key );
		$settings['pukat_version'] = PUKAT_VERSION;

		return $this->success( $settings );
	}

	public function update_settings( WP_REST_Request $request ): WP_REST_Response {
		$params  = $request->get_json_params() ?: [];
		$updated = [];

		// Plain text settings.
		$plain_keys = [
			'pukat_org_name',
			'pukat_org_logo',
			'pukat_timezone',
			'pukat_gophish_url',
			'pukat_quiz_pass_score',
			'pukat_risk_thresholds',
			'pukat_blackout_dates',
		];

		foreach ( $plain_keys as $key ) {
			if ( array_key_exists( $key, $params ) ) {
				$value = match ( $key ) {
					'pukat_quiz_pass_score' => min( max( (int) $params[ $key ], 0 ), 100 ),
					'pukat_gophish_url'     => sanitize_url( (string) $params[ $key ] ),
					'pukat_risk_thresholds',
					'pukat_blackout_dates'  => wp_json_encode( $params[ $key ] ),
					default                 => sanitize_text_field( (string) $params[ $key ] ),
				};
				update_option( $key, $value );
				$updated[] = $key;
			}
		}

		// API key — encrypt before storing.
		if ( ! empty( $params['pukat_gophish_api_key'] ) ) {
			$encrypted = EncryptionService::encrypt( sanitize_text_field( (string) $params['pukat_gophish_api_key'] ) );
			update_option( 'pukat_gophish_api_key', $encrypted );
			$updated[] = 'pukat_gophish_api_key';
		}

		AuditLogService::log( 'settings.updated', [ 'keys' => $updated ] );

		return $this->get_settings( $request );
	}
}
