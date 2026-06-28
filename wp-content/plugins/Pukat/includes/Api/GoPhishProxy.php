<?php
/**
 * GoPhish proxy REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\GoPhishService;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class GoPhishProxy
 *
 * Proxies requests from the React frontend through WordPress to GoPhish API.
 * The GoPhish API key is NEVER sent to the browser.
 *
 * Endpoints:
 *   GET  /pukat/v1/gophish/status           — Test connection
 *   GET  /pukat/v1/gophish/templates/email  — Email templates
 *   GET  /pukat/v1/gophish/templates/landing — Landing pages
 *   GET  /pukat/v1/gophish/smtp             — Sending profiles
 *   GET  /pukat/v1/gophish/groups           — Target groups
 */
class GoPhishProxy extends RestController {

	public function register_routes(): void {
		// Connection test.
		register_rest_route( $this->namespace, '/gophish/status', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_status' ],
			'permission_callback' => [ $this, 'permission_admin' ],
		] );

		// Email templates.
		register_rest_route( $this->namespace, '/gophish/templates/email', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_email_templates' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		// Landing pages.
		register_rest_route( $this->namespace, '/gophish/templates/landing', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_landing_pages' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		// Sending profiles.
		register_rest_route( $this->namespace, '/gophish/smtp', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_sending_profiles' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		// Groups.
		register_rest_route( $this->namespace, '/gophish/groups', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_groups' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );
	}

	public function get_status( WP_REST_Request $request ): WP_REST_Response {
		$result = ( new GoPhishService() )->test_connection();
		if ( $result['success'] ) {
			return $this->success( $result['data'] ?? [], 200 );
		}
		return $this->error( 'gophish_connection_failed', $result['message'], 502 );
	}

	public function get_email_templates( WP_REST_Request $request ): WP_REST_Response {
		$result = ( new GoPhishService() )->get_email_templates();
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}

	public function get_landing_pages( WP_REST_Request $request ): WP_REST_Response {
		$result = ( new GoPhishService() )->get_landing_pages();
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}

	public function get_sending_profiles( WP_REST_Request $request ): WP_REST_Response {
		$result = ( new GoPhishService() )->get_sending_profiles();
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}

	public function get_groups( WP_REST_Request $request ): WP_REST_Response {
		$result = ( new GoPhishService() )->get_groups();
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}
}
