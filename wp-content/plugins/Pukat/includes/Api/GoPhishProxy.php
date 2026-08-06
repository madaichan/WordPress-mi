<?php
/**
 * GoPhish proxy REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\GoPhishService;
use Pukat\Services\MasterComponentService;
use WP_Error;
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
 *   CRUD /pukat/v1/gophish/templates/email  — Email templates
 *   CRUD /pukat/v1/gophish/templates/landing — Landing pages
 *   CRUD /pukat/v1/gophish/smtp             — Sending profiles
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
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_email_templates' ],
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_email_template' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/gophish/templates/email/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_email_template' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_email_template' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/gophish/templates/email/(?P<id>\d+)/entity', [
			'methods'             => 'PUT',
			'callback'            => [ $this, 'update_email_template_entity' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		// Landing pages.
		register_rest_route( $this->namespace, '/gophish/templates/landing', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_landing_pages' ],
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_landing_page' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/gophish/templates/landing/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_landing_page' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_landing_page' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/gophish/templates/landing/(?P<id>\d+)/entity', [
			'methods'             => 'PUT',
			'callback'            => [ $this, 'update_landing_page_entity' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		// Sending profiles.
		register_rest_route( $this->namespace, '/gophish/smtp', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_sending_profiles' ],
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_sending_profile' ],
				'permission_callback' => [ $this, 'permission_admin' ],
			],
		] );

		register_rest_route( $this->namespace, '/gophish/smtp/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_sending_profile' ],
				'permission_callback' => [ $this, 'permission_admin' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_sending_profile' ],
				'permission_callback' => [ $this, 'permission_admin' ],
			],
		] );

		register_rest_route( $this->namespace, '/gophish/smtp/test-email', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'send_test_email' ],
			'permission_callback' => [ $this, 'permission_admin' ],
		] );

		register_rest_route( $this->namespace, '/gophish/smtp/(?P<id>\d+)/entity', [
			'methods'             => 'PUT',
			'callback'            => [ $this, 'update_sending_profile_entity' ],
			'permission_callback' => [ $this, 'permission_admin' ],
		] );

		// Groups.
		register_rest_route( $this->namespace, '/gophish/groups', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_groups' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );
	}

	protected function success( mixed $data = null, int $status = 200 ): WP_REST_Response {
		return $this->proxy_mode_response( parent::success( $data, $status ) );
	}

	protected function error( string $code, string $message, int $status = 400 ): WP_REST_Response {
		return $this->proxy_mode_response( parent::error( $code, $message, $status ) );
	}

	protected function from_wp_error( WP_Error $wp_error, int $status = 500 ): WP_REST_Response {
		return $this->proxy_mode_response( parent::from_wp_error( $wp_error, $status ) );
	}

	private function proxy_mode_response( WP_REST_Response $response ): WP_REST_Response {
		$response->header( 'X-Pukat-Proxy-Mode', 'admin-debug' );
		$response->header( 'X-Pukat-Source-Of-Truth', 'wordpress-master' );

		$data = $response->get_data();
		if ( is_array( $data ) ) {
			$data['proxy'] = [
				'mode'            => 'admin_debug',
				'source_of_truth' => 'wordpress_playbook_master',
				'message'         => __( 'GoPhish proxy endpoints are for admin/debug access. Master assets should be managed from WordPress.', 'pukat' ),
			];
			$response->set_data( $data );
		}

		return $response;
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
		$result = $this->filter_assets_for_current_user( $result );
		return $this->success( $this->decorate_gophish_assets_with_usage( $result, 'email_template' ) );
	}

	public function create_email_template( WP_REST_Request $request ): WP_REST_Response {
		$payload = $this->build_email_template_payload( $request );
		if ( isset( $payload['error'] ) ) {
			return $this->error( 'validation_error', $payload['error'], 422 );
		}
		$permission_error = $this->enforce_write_payload_entity( $payload );
		if ( $permission_error ) {
			return $permission_error;
		}

		$result = ( new GoPhishService() )->create_email_template( $payload );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result, 201 );
	}

	public function update_email_template( WP_REST_Request $request ): WP_REST_Response {
		$id      = (int) $request->get_param( 'id' );
		$payload = $this->build_email_template_payload( $request );
		if ( isset( $payload['error'] ) ) {
			return $this->error( 'validation_error', $payload['error'], 422 );
		}

		$service  = new GoPhishService();
		$template = $service->get_email_template( $id );
		if ( is_wp_error( $template ) ) {
			return $this->from_wp_error( $template );
		}

		$permission_error = $this->enforce_write_payload_entity( $payload, $template );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_email_template_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$payload['id'] = $id;
		$result        = $service->update_email_template( $id, $payload );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}

	public function delete_email_template( WP_REST_Request $request ): WP_REST_Response {
		$id       = (int) $request->get_param( 'id' );
		$service  = new GoPhishService();
		$template = $service->get_email_template( $id );
		if ( is_wp_error( $template ) ) {
			return $this->from_wp_error( $template );
		}

		$permission_error = $this->enforce_existing_asset_editable( $template );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_email_template_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$result = $service->delete_email_template( $id );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}

	public function update_email_template_entity( WP_REST_Request $request ): WP_REST_Response {
		$id     = (int) $request->get_param( 'id' );
		$entity = $this->get_entity_param( $request );
		if ( isset( $entity['error'] ) ) {
			return $this->error( 'validation_error', $entity['error'], 422 );
		}

		$service  = new GoPhishService();
		$template = $service->get_email_template( $id );
		if ( is_wp_error( $template ) ) {
			return $this->from_wp_error( $template );
		}
		$permission_error = $this->enforce_write_entity_value( $entity['value'], $template );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_email_template_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$template['id']     = $id;
		$template['entity'] = $entity['value'];
		$result             = $service->update_email_template( $id, $template );
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
		$result = $this->filter_assets_for_current_user( $result );
		return $this->success( $this->decorate_gophish_assets_with_usage( $result, 'landing_page' ) );
	}

	public function create_landing_page( WP_REST_Request $request ): WP_REST_Response {
		$payload = $this->build_landing_page_payload( $request );
		if ( isset( $payload['error'] ) ) {
			return $this->error( 'validation_error', $payload['error'], 422 );
		}
		$permission_error = $this->enforce_write_payload_entity( $payload );
		if ( $permission_error ) {
			return $permission_error;
		}

		$result = ( new GoPhishService() )->create_landing_page( $payload );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result, 201 );
	}

	public function update_landing_page( WP_REST_Request $request ): WP_REST_Response {
		$id      = (int) $request->get_param( 'id' );
		$payload = $this->build_landing_page_payload( $request );
		if ( isset( $payload['error'] ) ) {
			return $this->error( 'validation_error', $payload['error'], 422 );
		}

		$service = new GoPhishService();
		$page    = $service->get_landing_page( $id );
		if ( is_wp_error( $page ) ) {
			return $this->from_wp_error( $page );
		}

		$permission_error = $this->enforce_write_payload_entity( $payload, $page );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_landing_page_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$payload['id'] = $id;
		$result        = $service->update_landing_page( $id, $payload );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}

	public function delete_landing_page( WP_REST_Request $request ): WP_REST_Response {
		$id      = (int) $request->get_param( 'id' );
		$service = new GoPhishService();
		$page    = $service->get_landing_page( $id );
		if ( is_wp_error( $page ) ) {
			return $this->from_wp_error( $page );
		}

		$permission_error = $this->enforce_existing_asset_editable( $page );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_landing_page_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$result = $service->delete_landing_page( $id );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}

	public function update_landing_page_entity( WP_REST_Request $request ): WP_REST_Response {
		$id     = (int) $request->get_param( 'id' );
		$entity = $this->get_entity_param( $request );
		if ( isset( $entity['error'] ) ) {
			return $this->error( 'validation_error', $entity['error'], 422 );
		}

		$service = new GoPhishService();
		$page    = $service->get_landing_page( $id );
		if ( is_wp_error( $page ) ) {
			return $this->from_wp_error( $page );
		}
		$permission_error = $this->enforce_write_entity_value( $entity['value'], $page );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_landing_page_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$page['id']     = $id;
		$page['entity'] = $entity['value'];
		$result         = $service->update_landing_page( $id, $page );
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
		$result = $this->filter_assets_for_current_user( $result );
		$result = $this->decorate_gophish_assets_with_usage( $result, 'sending_profile' );
		return $this->success( array_map( [ $this, 'prepare_smtp_profile_response' ], $result ) );
	}

	public function create_sending_profile( WP_REST_Request $request ): WP_REST_Response {
		$payload = $this->build_smtp_profile_payload( $request );
		if ( isset( $payload['error'] ) ) {
			return $this->error( 'validation_error', $payload['error'], 422 );
		}
		$permission_error = $this->enforce_write_payload_entity( $payload );
		if ( $permission_error ) {
			return $permission_error;
		}

		$result = ( new GoPhishService() )->create_sending_profile( $payload );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $this->prepare_smtp_profile_response( $result ), 201 );
	}

	public function update_sending_profile( WP_REST_Request $request ): WP_REST_Response {
		$id      = (int) $request->get_param( 'id' );
		$payload = $this->build_smtp_profile_payload( $request );
		if ( isset( $payload['error'] ) ) {
			return $this->error( 'validation_error', $payload['error'], 422 );
		}

		$service = new GoPhishService();
		$profile = $service->get_sending_profile( $id );
		if ( is_wp_error( $profile ) ) {
			return $this->from_wp_error( $profile );
		}

		$permission_error = $this->enforce_write_payload_entity( $payload, $profile );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_sending_profile_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$payload['id'] = $id;
		$result        = $service->update_sending_profile( $id, $payload );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $this->prepare_smtp_profile_response( $result ) );
	}

	public function delete_sending_profile( WP_REST_Request $request ): WP_REST_Response {
		$id      = (int) $request->get_param( 'id' );
		$service = new GoPhishService();
		$profile = $service->get_sending_profile( $id );
		if ( is_wp_error( $profile ) ) {
			return $this->from_wp_error( $profile );
		}

		$permission_error = $this->enforce_existing_asset_editable( $profile );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_sending_profile_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$result = $service->delete_sending_profile( $id );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}
		return $this->success( $result );
	}

	public function update_sending_profile_entity( WP_REST_Request $request ): WP_REST_Response {
		$id     = (int) $request->get_param( 'id' );
		$entity = $this->get_entity_param( $request );
		if ( isset( $entity['error'] ) ) {
			return $this->error( 'validation_error', $entity['error'], 422 );
		}

		$service = new GoPhishService();
		$profile = $service->get_sending_profile( $id );
		if ( is_wp_error( $profile ) ) {
			return $this->from_wp_error( $profile );
		}
		$permission_error = $this->enforce_write_entity_value( $entity['value'], $profile );
		if ( $permission_error ) {
			return $permission_error;
		}

		$usage_error = ( new MasterComponentService() )->enforce_gophish_sending_profile_not_used( $id );
		if ( $usage_error ) {
			return $this->from_wp_error( $usage_error );
		}

		$profile['id']     = $id;
		$profile['entity'] = $entity['value'];
		$result            = $service->update_sending_profile( $id, $profile );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $this->prepare_smtp_profile_response( $result ) );
	}

	public function send_test_email( WP_REST_Request $request ): WP_REST_Response {
		$payload = $this->build_smtp_profile_payload( $request );
		if ( isset( $payload['error'] ) ) {
			return $this->error( 'validation_error', $payload['error'], 422 );
		}

		$target = sanitize_email( (string) $request->get_param( 'target' ) );
		if ( empty( $target ) || ! is_email( $target ) ) {
			return $this->error( 'validation_error', __( 'A valid recipient email is required.', 'pukat' ), 422 );
		}

		$service = new GoPhishService();
		$id      = (int) $request->get_param( 'id' );

		if ( $id ) {
			$existing = $service->get_sending_profile( $id );
			if ( is_wp_error( $existing ) ) {
				return $this->from_wp_error( $existing );
			}

			$permission_error = $this->enforce_existing_asset_editable( $existing );
			if ( $permission_error ) {
				return $permission_error;
			}

			// Passwords are stripped from every GoPhish response before it reaches
			// the browser, so an unedited form legitimately submits an empty string.
			if ( empty( $payload['password'] ) ) {
				$payload['password'] = $existing['password'] ?? '';
			}
		}

		$result = $service->send_test_email( $payload, $target );
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

	/**
	 * Build a GoPhish email template payload from REST params.
	 *
	 * @return array<string, mixed>
	 */
	private function build_email_template_payload( WP_REST_Request $request ): array {
		$name    = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$subject = sanitize_text_field( (string) $request->get_param( 'subject' ) );
		$html    = (string) $request->get_param( 'html' );
		$text    = (string) $request->get_param( 'text' );
		$sender  = $this->sanitize_mailbox_label( (string) ( $request->get_param( 'envelope_sender' ) ?: $request->get_param( 'sender' ) ) );
		$entity  = sanitize_text_field( (string) $request->get_param( 'entity' ) );

		if ( empty( $name ) || empty( $subject ) || empty( trim( $html ) ) ) {
			return [ 'error' => __( 'Template name, subject, and HTML source are required.', 'pukat' ) ];
		}

		$attachments = [];
		foreach ( (array) $request->get_param( 'attachments' ) as $attachment ) {
			if ( is_array( $attachment ) ) {
				$attachments[] = $attachment;
			}
		}

		$payload = [
			'name'        => $name,
			'subject'     => $subject,
			'html'        => $html,
			'text'        => $text,
			'attachments' => $attachments,
			'entity'      => $entity,
		];

		if ( ! empty( $sender ) ) {
			$payload['envelope_sender'] = $sender;
		}

		return $payload;
	}

	/**
	 * Build a GoPhish landing page payload from REST params.
	 *
	 * @return array<string, mixed>
	 */
	private function build_landing_page_payload( WP_REST_Request $request ): array {
		$name         = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$html         = (string) $request->get_param( 'html' );
		$redirect_url = esc_url_raw( (string) $request->get_param( 'redirect_url' ) );
		$entity       = sanitize_text_field( (string) $request->get_param( 'entity' ) );

		if ( empty( $name ) || empty( trim( $html ) ) ) {
			return [ 'error' => __( 'Landing page name and HTML source are required.', 'pukat' ) ];
		}

		$payload = [
			'name'                => $name,
			'html'                => $html,
			'capture_credentials' => filter_var( $request->get_param( 'capture_credentials' ), FILTER_VALIDATE_BOOLEAN ),
			'capture_passwords'   => filter_var( $request->get_param( 'capture_passwords' ), FILTER_VALIDATE_BOOLEAN ),
			'redirect_url'        => $redirect_url,
			'entity'              => $entity,
		];

		return $payload;
	}

	/**
	 * Build a GoPhish sending profile payload from REST params.
	 *
	 * @return array<string, mixed>
	 */
	private function build_smtp_profile_payload( WP_REST_Request $request ): array {
		$name = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$host = trim( sanitize_text_field( (string) $request->get_param( 'host' ) ) );
		$port = (int) $request->get_param( 'port' );
		$from = $this->sanitize_mailbox_label( (string) ( $request->get_param( 'from_address' ) ?: $request->get_param( 'from' ) ) );
		$from = $this->extract_mailbox_address( $from );
		$entity = sanitize_text_field( (string) $request->get_param( 'entity' ) );

		if ( empty( $name ) || empty( $host ) || empty( $from ) ) {
			return [ 'error' => __( 'Profile name, SMTP host, and from address are required.', 'pukat' ) ];
		}

		if ( ! preg_match( '/:\d+$/', $host ) ) {
			$host .= ':' . ( $port ?: 587 );
		}

		$headers = [];
		foreach ( (array) $request->get_param( 'headers' ) as $header ) {
			$key   = sanitize_text_field( (string) ( $header['key'] ?? '' ) );
			$value = sanitize_text_field( (string) ( $header['value'] ?? $header['val'] ?? '' ) );
			if ( $key ) {
				$headers[] = [ 'key' => $key, 'value' => $value ];
			}
		}

		$payload = [
			'name'               => $name,
			'interface_type'     => 'SMTP',
			'host'               => $host,
			'from_address'       => $from,
			'username'           => sanitize_text_field( (string) $request->get_param( 'username' ) ),
			'password'           => (string) $request->get_param( 'password' ),
			'ignore_cert_errors' => filter_var( $request->get_param( 'ignore_cert_errors' ), FILTER_VALIDATE_BOOLEAN ),
			'headers'            => $headers,
		];

		if ( ! empty( $entity ) ) {
			$payload['entity'] = $entity;
		}

		return $payload;
	}

	/**
	 * Read and validate an entity code from the request.
	 *
	 * @return array{value?: string, error?: string}
	 */
	private function get_entity_param( WP_REST_Request $request ): array {
		$entity = trim( sanitize_text_field( (string) $request->get_param( 'entity' ) ) );

		if ( '' === $entity ) {
			return [ 'error' => __( 'Entity is required.', 'pukat' ) ];
		}

		return [ 'value' => $entity ];
	}

	/**
	 * Enforce entity-scoped writes for non-admin users.
	 *
	 * Admin users may edit General and any entity. Operators may only create or
	 * edit assets assigned to their own entity; General assets are read-only.
	 *
	 * @param array<string, mixed>      $payload  GoPhish payload that will be written.
	 * @param array<string, mixed>|null $existing Existing GoPhish asset for update/delete checks.
	 */
	private function enforce_write_payload_entity( array &$payload, ?array $existing = null ): ?WP_REST_Response {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity = $this->current_user_entity();
		if ( '' === trim( $user_entity ) ) {
			return $this->error(
				'entity_required',
				__( 'Your user must have an entity before editing assets.', 'pukat' ),
				403
			);
		}

		if ( null !== $existing ) {
			$existing_error = $this->enforce_existing_asset_editable( $existing );
			if ( $existing_error ) {
				return $existing_error;
			}
		}

		$requested_entity = trim( (string) ( $payload['entity'] ?? '' ) );
		if (
			'' !== $requested_entity
			&& strtolower( $requested_entity ) !== strtolower( $user_entity )
		) {
			return $this->error(
				'entity_forbidden',
				__( 'Non-admin users can only edit assets assigned to their own entity.', 'pukat' ),
				403
			);
		}

		$payload['entity'] = sanitize_text_field( $user_entity );

		return null;
	}

	/**
	 * Enforce entity-only assignment writes for non-admin users.
	 *
	 * @param array<string, mixed>|null $existing Existing GoPhish asset.
	 */
	private function enforce_write_entity_value( string $entity, ?array $existing = null ): ?WP_REST_Response {
		$payload = [ 'entity' => $entity ];
		return $this->enforce_write_payload_entity( $payload, $existing );
	}

	/**
	 * Ensure non-admin users can edit only assets scoped to their own entity.
	 *
	 * @param array<string, mixed> $asset Existing GoPhish asset.
	 */
	private function enforce_existing_asset_editable( array $asset ): ?WP_REST_Response {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity  = strtolower( $this->current_user_entity() );
		$asset_entity = strtolower( trim( (string) ( $asset['entity'] ?? '' ) ) );

		if ( '' !== $user_entity && '' !== $asset_entity && 'general' !== $asset_entity && $asset_entity === $user_entity ) {
			return null;
		}

		return $this->error(
			'entity_forbidden',
			__( 'General assets and assets from other entities can only be edited by admins.', 'pukat' ),
			403
		);
	}

	/**
	 * Limit asset lists to globally assigned assets plus the current user's entity.
	 *
	 * Admin users keep full visibility because the master pages use the same GoPhish
	 * endpoints to manage every entity's assets.
	 *
	 * @param array<int, array<string, mixed>> $assets GoPhish assets.
	 * @return array<int, array<string, mixed>>
	 */
	private function filter_assets_for_current_user( array $assets ): array {
		if ( $this->current_user_can_admin_assets() ) {
			return array_values( $assets );
		}

		$user_entity = strtolower( $this->current_user_entity() );

		return array_values( array_filter(
			$assets,
			static function ( array $asset ) use ( $user_entity ): bool {
				$asset_entity = strtolower( trim( (string) ( $asset['entity'] ?? '' ) ) );

				if ( 'general' === $asset_entity ) {
					return true;
				}

				return '' !== $user_entity && $asset_entity === $user_entity;
			}
		) );
	}

	/**
	 * Whether the current user may manage cross-entity or General assets.
	 */
	private function current_user_can_admin_assets(): bool {
		return current_user_can( 'pukat_manage_settings' ) || current_user_can( 'administrator' );
	}

	/**
	 * Resolve the current user's entity code from WordPress user meta.
	 */
	private function current_user_entity(): string {
		$user_id = get_current_user_id();
		$entity  = (string) get_user_meta( $user_id, 'entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
	}

	/**
	 * Add active campaign/playbook usage metadata to GoPhish assets.
	 *
	 * @param array<int, array<string, mixed>> $assets GoPhish assets.
	 * @return array<int, array<string, mixed>>
	 */
	private function decorate_gophish_assets_with_usage( array $assets, string $asset_type ): array {
		$service = new MasterComponentService();
		$label   = match ( $asset_type ) {
			'email_template'  => __( 'Email template', 'pukat' ),
			'landing_page'    => __( 'Landing page', 'pukat' ),
			'sending_profile' => __( 'Sending profile', 'pukat' ),
			default           => __( 'Asset', 'pukat' ),
		};

		return array_map(
			static function ( array $asset ) use ( $service, $asset_type, $label ): array {
				$usage  = $service->gophish_asset_usage( $asset_type, (int) ( $asset['id'] ?? 0 ) );
				$locked = (int) ( $usage['active_usage_count'] ?? 0 ) > 0;

				$asset['usage']            = $usage;
				$asset['edit_locked']      = $locked;
				$asset['edit_lock_reason'] = $locked
					? sprintf(
						/* translators: %s: GoPhish asset label. */
						__( '%s is used by an active Campaign or Playbook.', 'pukat' ),
						$label
					)
					: '';

				return $asset;
			},
			$assets
		);
	}

	/**
	 * Remove sensitive SMTP credentials before returning profiles to React.
	 *
	 * @param array<string, mixed> $profile GoPhish SMTP profile.
	 * @return array<string, mixed>
	 */
	private function prepare_smtp_profile_response( array $profile ): array {
		unset( $profile['password'] );
		return $profile;
	}

	/**
	 * Sanitize a mailbox label while preserving "Display Name <mailbox>" format.
	 */
	private function sanitize_mailbox_label( string $value ): string {
		$value = wp_unslash( $value );
		$value = (string) preg_replace( '/[\r\n\t]+/', ' ', $value );
		return trim( $value );
	}

	/**
	 * Extract the address from "Display Name <mailbox>" for GoPhish SMTP profiles.
	 */
	private function extract_mailbox_address( string $value ): string {
		if ( preg_match( '/<([^<>@\s]+@[^<>\s]+)>/', $value, $matches ) ) {
			return sanitize_email( $matches[1] );
		}

		return sanitize_email( $value );
	}
}
