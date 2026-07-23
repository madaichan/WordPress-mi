<?php
/**
 * GoPhish API Service — all HTTP communication with the GoPhish server.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use WP_Error;

/**
 * Class GoPhishService
 *
 * Wraps wp_remote_* calls to GoPhish REST API.
 * All requests are authenticated via the API key stored encrypted in wp_options.
 * The API key is NEVER exposed to the browser.
 *
 * @see https://docs.getgophish.com/api-documentation/
 */
class GoPhishService {

	/** @var string GoPhish API base URL. */
	private string $base_url;

	/** @var string Decrypted API key. */
	private string $api_key;

	/** @var int HTTP request timeout in seconds. */
	private int $timeout = 15;

	public function __construct() {
		$this->base_url = self::normalize_base_url( (string) get_option( 'pukat_gophish_url', '' ) );
		$this->api_key  = EncryptionService::decrypt(
			(string) get_option( 'pukat_gophish_api_key', '' )
		);
	}

	/**
	 * Normalize the configured GoPhish base URL.
	 *
	 * The service appends GoPhish API paths itself, but users sometimes paste
	 * a tested endpoint prefix like https://host:3333/api/.
	 */
	public static function normalize_base_url( string $url ): string {
		$url = rtrim( trim( $url ), '/' );

		if ( preg_match( '#/api$#i', $url ) ) {
			$url = substr( $url, 0, -4 );
		}

		return rtrim( $url, '/' );
	}

	// ===========================================================================
	// Connection
	// ===========================================================================

	/**
	 * Test connectivity to GoPhish API.
	 *
	 * @return array{success: bool, message: string, data?: array}
	 */
	public function test_connection(): array {
		if ( empty( $this->base_url ) || empty( $this->api_key ) ) {
			return [
				'success' => false,
				'message' => __( 'GoPhish URL or API key is not configured.', 'pukat' ),
			];
		}

		$response = $this->get( '/api/campaigns/?page=1&results_per_page=1' );

		if ( is_wp_error( $response ) ) {
			return [
				'success' => false,
				'message' => $response->get_error_message(),
			];
		}

		return [
			'success' => true,
			'message' => __( 'Connected to GoPhish successfully.', 'pukat' ),
			'data'    => [ 'url' => $this->base_url ],
		];
	}

	// ===========================================================================
	// Campaigns
	// ===========================================================================

	/**
	 * Get all campaigns.
	 *
	 * @return array|WP_Error
	 */
	public function get_campaigns(): array|WP_Error {
		return $this->get( '/api/campaigns/' );
	}

	/**
	 * Get a single campaign by ID.
	 *
	 * @param int $id GoPhish campaign ID.
	 * @return array|WP_Error
	 */
	public function get_campaign( int $id ): array|WP_Error {
		return $this->get( "/api/campaigns/{$id}" );
	}

	/**
	 * Get campaign results (events: clicked, submitted_data, etc.).
	 *
	 * @param int $id GoPhish campaign ID.
	 * @return array|WP_Error
	 */
	public function get_campaign_results( int $id ): array|WP_Error {
		return $this->get( "/api/campaigns/{$id}/results" );
	}

	/**
	 * Get campaign summary.
	 *
	 * @param int $id GoPhish campaign ID.
	 * @return array|WP_Error
	 */
	public function get_campaign_summary( int $id ): array|WP_Error {
		return $this->get( "/api/campaigns/{$id}/summary" );
	}

	/**
	 * Create a new campaign.
	 *
	 * @param array $data Campaign data.
	 * @return array|WP_Error
	 */
	public function create_campaign( array $data ): array|WP_Error {
		return $this->post( '/api/campaigns/', $data );
	}

	/**
	 * Delete a campaign.
	 *
	 * @param int $id GoPhish campaign ID.
	 * @return array|WP_Error
	 */
	public function delete_campaign( int $id ): array|WP_Error {
		return $this->delete( "/api/campaigns/{$id}" );
	}

	/**
	 * Complete a campaign (stop it).
	 *
	 * @param int $id GoPhish campaign ID.
	 * @return array|WP_Error
	 */
	public function complete_campaign( int $id ): array|WP_Error {
		return $this->get( "/api/campaigns/{$id}/complete" );
	}

	// ===========================================================================
	// Groups (Target Lists)
	// ===========================================================================

	/**
	 * Get all groups.
	 *
	 * @return array|WP_Error
	 */
	public function get_groups(): array|WP_Error {
		return $this->get( '/api/groups/' );
	}

	/**
	 * Create a target group.
	 *
	 * @param array $data Group data (name + targets array).
	 * @return array|WP_Error
	 */
	public function create_group( array $data ): array|WP_Error {
		return $this->post( '/api/groups/', $data );
	}

	/**
	 * Delete a group.
	 *
	 * @param int $id GoPhish group ID.
	 * @return array|WP_Error
	 */
	public function delete_group( int $id ): array|WP_Error {
		return $this->delete( "/api/groups/{$id}" );
	}

	// ===========================================================================
	// Email Templates
	// ===========================================================================

	/**
	 * Get all email templates.
	 *
	 * @return array|WP_Error
	 */
	public function get_email_templates(): array|WP_Error {
		return $this->get( '/api/templates/' );
	}

	/**
	 * Create an email template.
	 *
	 * @param array $data Template data.
	 * @return array|WP_Error
	 */
	public function create_email_template( array $data ): array|WP_Error {
		return $this->post( '/api/templates/', $data );
	}

	/**
	 * Delete an email template.
	 *
	 * @param int $id Template ID.
	 * @return array|WP_Error
	 */
	public function delete_email_template( int $id ): array|WP_Error {
		return $this->delete( "/api/templates/{$id}" );
	}

	// ===========================================================================
	// Landing Pages
	// ===========================================================================

	/**
	 * Get all landing pages.
	 *
	 * @return array|WP_Error
	 */
	public function get_landing_pages(): array|WP_Error {
		return $this->get( '/api/pages/' );
	}

	/**
	 * Create a landing page.
	 *
	 * @param array $data Page data.
	 * @return array|WP_Error
	 */
	public function create_landing_page( array $data ): array|WP_Error {
		return $this->post( '/api/pages/', $data );
	}

	// ===========================================================================
	// Sending Profiles (SMTP)
	// ===========================================================================

	/**
	 * Get all sending profiles.
	 *
	 * @return array|WP_Error
	 */
	public function get_sending_profiles(): array|WP_Error {
		return $this->get( '/api/smtp/' );
	}

	// ===========================================================================
	// Cron: Sync active campaigns
	// ===========================================================================

	/**
	 * Pull results for all active Pukat campaigns from GoPhish.
	 * Called by WP-Cron every 5 minutes.
	 */
	public function sync_all_active_campaigns(): void {
		global $wpdb;
		$table = $wpdb->prefix . 'pukat_campaigns';

		$active = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, gophish_id FROM {$table} WHERE status = %s AND gophish_id IS NOT NULL",
				'active'
			)
		);

		if ( empty( $active ) ) {
			return;
		}

		foreach ( $active as $campaign ) {
			$results = $this->get_campaign_results( (int) $campaign->gophish_id );
			if ( is_wp_error( $results ) ) {
				continue;
			}
			// Trigger event for other services to process results.
			do_action( 'pukat_campaign_results_synced', (int) $campaign->id, $results );
		}
	}

	// ===========================================================================
	// HTTP Helpers
	// ===========================================================================

	/**
	 * Perform a GET request to GoPhish API.
	 *
	 * @param string $endpoint API endpoint path.
	 * @return array|WP_Error Decoded JSON array or WP_Error.
	 */
	private function get( string $endpoint ): array|WP_Error {
		$response = wp_remote_get(
			$this->base_url . $endpoint,
			$this->build_request_args()
		);
		return $this->parse_response( $response );
	}

	/**
	 * Perform a POST request to GoPhish API.
	 *
	 * @param string $endpoint API endpoint path.
	 * @param array  $body     Request body (will be JSON-encoded).
	 * @return array|WP_Error Decoded JSON array or WP_Error.
	 */
	private function post( string $endpoint, array $body = [] ): array|WP_Error {
		$args          = $this->build_request_args();
		$args['method'] = 'POST';
		$args['body']   = wp_json_encode( $body );
		$args['headers']['Content-Type'] = 'application/json';

		$response = wp_remote_post( $this->base_url . $endpoint, $args );
		return $this->parse_response( $response );
	}

	/**
	 * Perform a DELETE request to GoPhish API.
	 *
	 * @param string $endpoint API endpoint path.
	 * @return array|WP_Error Decoded JSON array or WP_Error.
	 */
	private function delete( string $endpoint ): array|WP_Error {
		$args           = $this->build_request_args();
		$args['method'] = 'DELETE';

		$response = wp_remote_request( $this->base_url . $endpoint, $args );
		return $this->parse_response( $response );
	}

	/**
	 * Build common request arguments.
	 *
	 * @return array
	 */
	private function build_request_args(): array {
		return [
			'timeout'   => $this->timeout,
			'sslverify' => apply_filters( 'pukat_gophish_ssl_verify', false ),
			'headers'   => [
				'Authorization' => "Bearer {$this->api_key}",
				'Accept'        => 'application/json',
			],
		];
	}

	/**
	 * Parse and validate an HTTP response.
	 *
	 * @param array|WP_Error $response wp_remote_* response.
	 * @return array|WP_Error Decoded data or WP_Error.
	 */
	private function parse_response( array|WP_Error $response ): array|WP_Error {
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( $code < 200 || $code >= 300 ) {
			$message = $data['message'] ?? sprintf(
				/* translators: %d HTTP status code */
				__( 'GoPhish API returned HTTP %d', 'pukat' ),
				$code
			);
			return new WP_Error( 'gophish_api_error', $message, [ 'status' => $code ] );
		}

		return is_array( $data ) ? $data : [];
	}
}
