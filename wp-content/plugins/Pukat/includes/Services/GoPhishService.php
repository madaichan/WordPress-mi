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
	 * Get all campaigns, optionally filtered.
	 *
	 * @param array<string, mixed> $filters campaign_type?, entity?, is_master? (bool).
	 *                                       See docs/api_campaignnew.md §1/§2.6.
	 * @return array|WP_Error
	 */
	public function get_campaigns( array $filters = [] ): array|WP_Error {
		return $this->get( '/api/campaigns/' . $this->query_string( $this->campaign_filters( $filters ) ) );
	}

	/**
	 * Get the summary list of campaigns, optionally filtered. Each master item
	 * also carries `master_stats` (docs/api_campaignnew.md §2.7).
	 *
	 * @param array<string, mixed> $filters campaign_type?, entity?, is_master? (bool).
	 * @return array|WP_Error
	 */
	public function get_campaigns_summary( array $filters = [] ): array|WP_Error {
		return $this->get( '/api/campaigns/summary' . $this->query_string( $this->campaign_filters( $filters ) ) );
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
	 * Create a new campaign. The caller supplies all fields; for an education
	 * or quiz master, include `campaign_type` and `is_master => true`, and omit
	 * `groups` (docs/api_campaignnew.md §1/§2.1/§2.3). A master is not
	 * auto-launched — participants arrive via add_recipients().
	 *
	 * @param array $data Campaign data.
	 * @return array|WP_Error
	 */
	public function create_campaign( array $data ): array|WP_Error {
		return $this->post( '/api/campaigns/', $data );
	}

	/**
	 * Delete a campaign. A master is refused with HTTP 409 unless
	 * $confirm_master is true (docs/api_campaignnew.md §2.3).
	 *
	 * @param int  $id             GoPhish campaign ID.
	 * @param bool $confirm_master Pass true to delete a master.
	 * @return array|WP_Error
	 */
	public function delete_campaign( int $id, bool $confirm_master = false ): array|WP_Error {
		return $this->delete( "/api/campaigns/{$id}" . ( $confirm_master ? '?confirm_master=true' : '' ) );
	}

	/**
	 * Complete a campaign (stop it). A master is refused with HTTP 409 unless
	 * $confirm_master is true (docs/api_campaignnew.md §2.3).
	 *
	 * @param int  $id             GoPhish campaign ID.
	 * @param bool $confirm_master Pass true to complete a master.
	 * @return array|WP_Error
	 */
	public function complete_campaign( int $id, bool $confirm_master = false ): array|WP_Error {
		return $this->get( "/api/campaigns/{$id}/complete" . ( $confirm_master ? '?confirm_master=true' : '' ) );
	}

	/**
	 * Add participants to a master campaign (docs/api_campaignnew.md §2.4).
	 * Each item always creates a new entry (no dedupe); the response's
	 * `results[].id` is that entry's rid, which the orchestrator must store.
	 * `send_email=false` records the entry as status `Added` without sending;
	 * `true` sends using the master's template/page/profile (status `Scheduled`).
	 *
	 * @param int                               $id         Master campaign ID (must be In progress).
	 * @param array<int, array<string, mixed>>  $recipients Each: email, first_name?, last_name?, position?.
	 * @param bool                              $send_email Whether to send the master email.
	 * @return array|WP_Error
	 */
	public function add_recipients( int $id, array $recipients, bool $send_email = false ): array|WP_Error {
		return $this->post( "/api/campaigns/{$id}/recipients", [
			'send_email' => $send_email,
			'recipients' => array_values( $recipients ),
		] );
	}

	/**
	 * Reopen a Completed master back to In progress (docs/api_campaignnew.md §2.5).
	 * No body. Emails already dequeued at Complete are not re-sent.
	 *
	 * @param int $id Master campaign ID (must be Completed).
	 * @return array|WP_Error
	 */
	public function reactivate_campaign( int $id ): array|WP_Error {
		return $this->post( "/api/campaigns/{$id}/reactivate" );
	}

	/**
	 * Set or clear the redirect-chain link on an existing campaign
	 * (docs/api_campaignnew.md §3.1.1 — Rilis 3). `next_campaign_id` must point
	 * to an education/quiz master owned by the same account, and may not be the
	 * campaign itself; 0 clears the link. On submit of this campaign's landing
	 * page, the target is auto-registered into the target campaign and
	 * redirected there — no manual recipients needed for the chain.
	 *
	 * Note: `next_campaign_id` is a property of the TARGET campaign that is
	 * shared, so changing it reroutes every target passing through it.
	 *
	 * @param int $id               Campaign to update.
	 * @param int $next_campaign_id Target master id, or 0 to clear.
	 * @return array|WP_Error
	 */
	public function set_next_campaign( int $id, int $next_campaign_id ): array|WP_Error {
		return $this->post( "/api/campaigns/{$id}/next", [ 'next_campaign_id' => $next_campaign_id ] );
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
	 * Get a single email template by ID.
	 *
	 * @param int $id Template ID.
	 * @return array|WP_Error
	 */
	public function get_email_template( int $id ): array|WP_Error {
		return $this->get( "/api/templates/{$id}" );
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
	 * Update an email template.
	 *
	 * @param int   $id   Template ID.
	 * @param array $data Full template data.
	 * @return array|WP_Error
	 */
	public function update_email_template( int $id, array $data ): array|WP_Error {
		return $this->put_merged( "/api/templates/{$id}", $data );
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
	 * Get a single landing page by ID.
	 *
	 * @param int $id Page ID.
	 * @return array|WP_Error
	 */
	public function get_landing_page( int $id ): array|WP_Error {
		return $this->get( "/api/pages/{$id}" );
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

	/**
	 * Update a landing page.
	 *
	 * @param int   $id   Page ID.
	 * @param array $data Full page data.
	 * @return array|WP_Error
	 */
	public function update_landing_page( int $id, array $data ): array|WP_Error {
		return $this->put_merged( "/api/pages/{$id}", $data );
	}

	/**
	 * Delete a landing page.
	 *
	 * @param int $id Page ID.
	 * @return array|WP_Error
	 */
	public function delete_landing_page( int $id ): array|WP_Error {
		return $this->delete( "/api/pages/{$id}" );
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

	/**
	 * Get a sending profile by ID.
	 *
	 * @param int $id Sending profile ID.
	 * @return array|WP_Error
	 */
	public function get_sending_profile( int $id ): array|WP_Error {
		return $this->get( "/api/smtp/{$id}" );
	}

	/**
	 * Create a sending profile.
	 *
	 * @param array $data Sending profile data.
	 * @return array|WP_Error
	 */
	public function create_sending_profile( array $data ): array|WP_Error {
		return $this->post( '/api/smtp/', $data );
	}

	/**
	 * Update a sending profile.
	 *
	 * @param int   $id   Sending profile ID.
	 * @param array $data Full sending profile data.
	 * @return array|WP_Error
	 */
	public function update_sending_profile( int $id, array $data ): array|WP_Error {
		return $this->put_merged( "/api/smtp/{$id}", $data );
	}

	/**
	 * Delete a sending profile.
	 *
	 * @param int $id Sending profile ID.
	 * @return array|WP_Error
	 */
	public function delete_sending_profile( int $id ): array|WP_Error {
		return $this->delete( "/api/smtp/{$id}" );
	}

	/**
	 * Send a real test email through GoPhish using the given SMTP settings.
	 *
	 * Unlike test_connection() (which only checks the GoPhish API itself is
	 * reachable), this calls GoPhish's own /api/util/send_test_email endpoint,
	 * which performs a genuine SMTP delivery attempt (auth + MAIL FROM/RCPT
	 * TO/DATA) and reports the real outcome.
	 *
	 * @param array  $smtp   Sending profile payload (host, from_address, username, password, ...).
	 * @param string $target Recipient email address for the test message.
	 * @return array|WP_Error
	 */
	public function send_test_email( array $smtp, string $target ): array|WP_Error {
		return $this->post( '/api/util/send_test_email', [
			'first_name' => 'Test',
			'last_name'  => 'Recipient',
			'email'      => $target,
			'position'   => '',
			'url'        => '',
			'smtp'       => $smtp,
		] );
	}

	// ===========================================================================
	// Cron: Sync active campaigns
	// ===========================================================================

	/**
	 * Pull results for active legacy campaigns and Campaign Runs from GoPhish.
	 * Called by WP-Cron every minute.
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

		if ( ! empty( $active ) ) {
			foreach ( $active as $campaign ) {
				$results = $this->get_campaign_results( (int) $campaign->gophish_id );
				if ( is_wp_error( $results ) ) {
					continue;
				}
				// Trigger event for other services to process results.
				do_action( 'pukat_campaign_results_synced', (int) $campaign->id, $results );
			}
		}

		( new CampaignRunService() )->sync_all_results();
	}

	// ===========================================================================
	// HTTP Helpers
	// ===========================================================================

	/**
	 * Whitelist and normalize campaign list/summary filters
	 * (docs/api_campaignnew.md §1/§2.6). `is_master` is coerced to the
	 * string `true`/`false` GoPhish expects; empty values are dropped.
	 *
	 * @param array<string, mixed> $filters
	 * @return array<string, string>
	 */
	private function campaign_filters( array $filters ): array {
		$out = [];

		foreach ( [ 'campaign_type', 'entity' ] as $key ) {
			if ( isset( $filters[ $key ] ) && '' !== (string) $filters[ $key ] ) {
				$out[ $key ] = (string) $filters[ $key ];
			}
		}

		if ( array_key_exists( 'is_master', $filters ) && null !== $filters['is_master'] ) {
			$out['is_master'] = filter_var( $filters['is_master'], FILTER_VALIDATE_BOOLEAN ) ? 'true' : 'false';
		}

		return $out;
	}

	/**
	 * @param array<string, string> $params
	 */
	private function query_string( array $params ): string {
		return empty( $params ) ? '' : '?' . http_build_query( $params );
	}

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
	 * Read an object from GoPhish, merge the given changes over it, then write
	 * the whole thing back.
	 *
	 * GoPhish's PUT endpoints are full-replace: the body becomes the object.
	 * Pukat does not own these objects, so any key it leaves out of the body
	 * would be wiped — either because Pukat strips it on the way to the browser
	 * (SMTP passwords) or because the GoPhish fork grew a field Pukat has never
	 * heard of. Merging the caller's changes over the current object makes an
	 * absent key mean "leave this alone" instead of "delete this", which is the
	 * only safe default when editing someone else's record.
	 *
	 * A key that IS present still wins, empty string included, so callers can
	 * still clear a field on purpose.
	 *
	 * @param string $endpoint API endpoint path of the object being updated.
	 * @param array  $changes  Fields to write over the current object.
	 * @return array|WP_Error Decoded JSON array or WP_Error.
	 */
	private function put_merged( string $endpoint, array $changes ): array|WP_Error {
		$current = $this->get( $endpoint );
		if ( is_wp_error( $current ) ) {
			return $current;
		}

		$merged = array_merge( $current, $changes );

		// GoPhish matches the body's id against the URL; the stored one is
		// authoritative even if a caller passed something else.
		if ( isset( $current['id'] ) ) {
			$merged['id'] = $current['id'];
		}

		return $this->put( $endpoint, $merged );
	}

	/**
	 * Perform a PUT request to GoPhish API.
	 *
	 * @param string $endpoint API endpoint path.
	 * @param array  $body     Request body (will be JSON-encoded).
	 * @return array|WP_Error Decoded JSON array or WP_Error.
	 */
	private function put( string $endpoint, array $body = [] ): array|WP_Error {
		$args          = $this->build_request_args();
		$args['method'] = 'PUT';
		$args['body']   = wp_json_encode( $body );
		$args['headers']['Content-Type'] = 'application/json';

		$response = wp_remote_request( $this->base_url . $endpoint, $args );
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
