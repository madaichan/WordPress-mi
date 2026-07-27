<?php
/**
 * Campaign REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\AuditLogService;
use Pukat\Services\GoPhishService;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class CampaignController
 *
 * Handles CRUD and lifecycle for Pukat campaigns.
 * Syncs creation/deletion with GoPhish API.
 *
 * Routes:
 *   GET    /pukat/v1/campaigns
 *   POST   /pukat/v1/campaigns
 *   GET    /pukat/v1/campaigns/{id}
 *   DELETE /pukat/v1/campaigns/{id}
 *   POST   /pukat/v1/campaigns/{id}/launch
 *   POST   /pukat/v1/campaigns/{id}/complete
 *   GET    /pukat/v1/campaigns/{id}/results
 */
class CampaignController extends RestController {

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/campaigns', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_campaigns' ],
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_campaign' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/campaigns/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_campaign' ],
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_campaign' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/campaigns/(?P<id>\d+)/launch', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'launch_campaign' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/campaigns/(?P<id>\d+)/complete', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'complete_campaign' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/campaigns/(?P<id>\d+)/results', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_results' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );

		register_rest_route( $this->namespace, '/targets/import', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'import_targets' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/campaigns/(?P<id>\d+)/targets', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_targets' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );
	}

	// ---------------------------------------------------------------------------
	// Handlers
	// ---------------------------------------------------------------------------

	public function get_campaigns( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$table     = $wpdb->prefix . 'pukat_campaigns';
		$per_page  = min( (int) $request->get_param( 'per_page' ) ?: 20, 100 );
		$page      = max( (int) $request->get_param( 'page' ) ?: 1, 1 );
		$offset    = ( $page - 1 ) * $per_page;

		$campaigns = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} ORDER BY created_at DESC LIMIT %d OFFSET %d",
				$per_page,
				$offset
			),
			ARRAY_A
		);

		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table}" );

		return $this->success( [
			'items'      => $campaigns ?: [],
			'total'      => $total,
			'page'       => $page,
			'per_page'   => $per_page,
			'last_page'  => (int) ceil( $total / $per_page ),
		] );
	}

	public function get_campaign( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request->get_param( 'id' );

		$campaign = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}pukat_campaigns WHERE id = %d",
				$id
			),
			ARRAY_A
		);

		if ( ! $campaign ) {
			return $this->error( 'not_found', __( 'Campaign not found.', 'pukat' ), 404 );
		}

		return $this->success( $campaign );
	}

	public function create_campaign( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$name        = sanitize_text_field( (string) $request->get_param( 'name' ) );
		$playbook_id = (int) $request->get_param( 'playbook_id' );
		$difficulty  = min( max( (int) $request->get_param( 'difficulty' ), 1 ), 5 );
		$timezone    = sanitize_text_field( (string) ( $request->get_param( 'timezone' ) ?: 'UTC' ) );
		$scheduled   = sanitize_text_field( (string) $request->get_param( 'scheduled_at' ) );

		if ( empty( $name ) ) {
			return $this->error( 'validation_error', __( 'Campaign name is required.', 'pukat' ), 422 );
		}

		$result = $wpdb->insert(
			$wpdb->prefix . 'pukat_campaigns',
			[
				'name'         => $name,
				'status'       => 'draft',
				'playbook_id'  => $playbook_id ?: null,
				'difficulty'   => $difficulty,
				'timezone'     => $timezone,
				'scheduled_at' => $scheduled ?: null,
				'created_by'   => get_current_user_id(),
			]
		);

		if ( false === $result ) {
			return $this->error( 'db_error', __( 'Failed to create campaign.', 'pukat' ), 500 );
		}

		$campaign_id = $wpdb->insert_id;

		AuditLogService::log( 'campaign.created', [
			'campaign_id' => $campaign_id,
			'name'        => $name,
		], null, 'campaign', $campaign_id );

		$campaign = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pukat_campaigns WHERE id = %d", $campaign_id ),
			ARRAY_A
		);

		return $this->success( $campaign, 201 );
	}

	public function delete_campaign( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request->get_param( 'id' );

		$campaign = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pukat_campaigns WHERE id = %d", $id ),
			ARRAY_A
		);

		if ( ! $campaign ) {
			return $this->error( 'not_found', __( 'Campaign not found.', 'pukat' ), 404 );
		}

		// Also delete from GoPhish if linked.
		if ( $campaign['gophish_id'] ) {
			$gp_result = ( new GoPhishService() )->delete_campaign( (int) $campaign['gophish_id'] );
			if ( is_wp_error( $gp_result ) ) {
				return $this->from_wp_error( $gp_result );
			}
		}

		$wpdb->delete( $wpdb->prefix . 'pukat_campaigns', [ 'id' => $id ] );

		AuditLogService::log( 'campaign.deleted', [ 'campaign_id' => $id ], null, 'campaign', $id );

		return $this->success( [ 'deleted' => true ] );
	}

	public function launch_campaign( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request->get_param( 'id' );

		$campaign = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pukat_campaigns WHERE id = %d", $id ),
			ARRAY_A
		);

		if ( ! $campaign ) {
			return $this->legacy_campaign_launch_response( $this->error( 'not_found', __( 'Campaign not found.', 'pukat' ), 404 ) );
		}

		if ( 'active' === $campaign['status'] ) {
			return $this->legacy_campaign_launch_response( $this->error( 'already_active', __( 'Campaign is already running.', 'pukat' ), 409 ) );
		}

		// Build GoPhish campaign payload from our campaign + playbook.
		$gp_payload = $this->build_gophish_payload( $campaign, $request );
		if ( is_array( $gp_payload ) && isset( $gp_payload['error'] ) ) {
			return $this->legacy_campaign_launch_response( $this->error( 'payload_error', $gp_payload['error'], 422 ) );
		}

		$gp_result = ( new GoPhishService() )->create_campaign( $gp_payload );
		if ( is_wp_error( $gp_result ) ) {
			return $this->legacy_campaign_launch_response( $this->from_wp_error( $gp_result ) );
		}

		$gophish_id = (int) ( $gp_result['id'] ?? 0 );

		$wpdb->update(
			$wpdb->prefix . 'pukat_campaigns',
			[
				'status'      => 'active',
				'gophish_id'  => $gophish_id,
				'launched_at' => current_time( 'mysql' ),
			],
			[ 'id' => $id ]
		);

		AuditLogService::log( 'campaign.launched', [
			'campaign_id' => $id,
			'gophish_id'  => $gophish_id,
			'legacy'      => true,
			'replacement' => 'campaign_runs',
		], null, 'campaign', $id );

		return $this->legacy_campaign_launch_response( $this->success( [ 'gophish_id' => $gophish_id, 'status' => 'active' ] ) );
	}

	public function complete_campaign( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request->get_param( 'id' );

		$campaign = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pukat_campaigns WHERE id = %d", $id ),
			ARRAY_A
		);

		if ( ! $campaign ) {
			return $this->error( 'not_found', __( 'Campaign not found.', 'pukat' ), 404 );
		}

		if ( $campaign['gophish_id'] ) {
			$gp_result = ( new GoPhishService() )->complete_campaign( (int) $campaign['gophish_id'] );
			if ( is_wp_error( $gp_result ) ) {
				return $this->from_wp_error( $gp_result );
			}
		}

		$wpdb->update(
			$wpdb->prefix . 'pukat_campaigns',
			[ 'status' => 'completed', 'completed_at' => current_time( 'mysql' ) ],
			[ 'id' => $id ]
		);

		AuditLogService::log( 'campaign.completed', [ 'campaign_id' => $id ], null, 'campaign', $id );

		return $this->success( [ 'status' => 'completed' ] );
	}

	public function get_results( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request->get_param( 'id' );

		$campaign = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pukat_campaigns WHERE id = %d", $id ),
			ARRAY_A
		);

		if ( ! $campaign ) {
			return $this->error( 'not_found', __( 'Campaign not found.', 'pukat' ), 404 );
		}

		if ( empty( $campaign['gophish_id'] ) ) {
			return $this->success( [ 'results' => [], 'message' => 'Campaign not yet launched in GoPhish.' ] );
		}

		$results = ( new GoPhishService() )->get_campaign_results( (int) $campaign['gophish_id'] );
		if ( is_wp_error( $results ) ) {
			return $this->from_wp_error( $results );
		}

		return $this->success( $results );
	}

	/**
	 * Import targets (from CSV upload) into a campaign and sync to GoPhish as a group.
	 *
	 * Expects: { campaign_id: int, targets: [{ first_name, last_name, email, position, department }] }
	 */
	public function import_targets( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$campaign_id = (int) $request->get_param( 'campaign_id' );
		$targets     = $request->get_param( 'targets' );

		if ( ! $campaign_id ) {
			return $this->error( 'validation_error', __( 'campaign_id is required.', 'pukat' ), 422 );
		}

		if ( empty( $targets ) || ! is_array( $targets ) ) {
			return $this->error( 'validation_error', __( 'targets must be a non-empty array.', 'pukat' ), 422 );
		}

		$campaign = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pukat_campaigns WHERE id = %d", $campaign_id ),
			ARRAY_A
		);

		if ( ! $campaign ) {
			return $this->error( 'not_found', __( 'Campaign not found.', 'pukat' ), 404 );
		}

		// Delete existing targets for this campaign before re-importing.
		$wpdb->delete( $wpdb->prefix . 'pukat_targets', [ 'campaign_id' => $campaign_id ] );

		$inserted = 0;
		foreach ( $targets as $t ) {
			if ( empty( $t['email'] ) || ! is_email( $t['email'] ) ) {
				continue;
			}

			$wpdb->insert(
				$wpdb->prefix . 'pukat_targets',
				[
					'campaign_id' => $campaign_id,
					'email'       => sanitize_email( $t['email'] ),
					'first_name'  => sanitize_text_field( (string) ( $t['first_name'] ?? '' ) ),
					'last_name'   => sanitize_text_field( (string) ( $t['last_name']  ?? '' ) ),
					'position'    => sanitize_text_field( (string) ( $t['position']   ?? '' ) ),
					'department'  => sanitize_text_field( (string) ( $t['department'] ?? '' ) ),
				]
			);
			++$inserted;
		}

		if ( 0 === $inserted ) {
			return $this->error( 'validation_error', __( 'No valid target email addresses were found.', 'pukat' ), 422 );
		}

		// Push the group to GoPhish so it's ready when the campaign launches.
		$gophish_targets = array_map( static function ( array $t ): array {
			return [
				'first_name' => sanitize_text_field( (string) ( $t['first_name'] ?? '' ) ),
				'last_name'  => sanitize_text_field( (string) ( $t['last_name']  ?? '' ) ),
				'email'      => sanitize_email( $t['email'] ),
				'position'   => sanitize_text_field( (string) ( $t['position']   ?? '' ) ),
			];
		}, array_filter( $targets, static fn( $t ) => ! empty( $t['email'] ) && is_email( $t['email'] ) ) );

		$group_name = "Group-Campaign-{$campaign_id}";
		$gp         = new GoPhishService();

		// Delete old GoPhish group for this campaign if it exists, then recreate.
		$groups = $gp->get_groups();
		if ( ! is_wp_error( $groups ) && is_array( $groups ) ) {
			foreach ( $groups as $g ) {
				if ( ( $g['name'] ?? '' ) === $group_name ) {
					$gp->delete_group( (int) $g['id'] );
					break;
				}
			}
		}

		$gp_result = $gp->create_group( [ 'name' => $group_name, 'targets' => array_values( $gophish_targets ) ] );
		if ( is_wp_error( $gp_result ) ) {
			return $this->from_wp_error( $gp_result );
		}

		$gophish_group_id = $gp_result['id'] ?? null;

		AuditLogService::log(
			'targets.imported',
			[ 'campaign_id' => $campaign_id, 'count' => $inserted, 'gophish_group_id' => $gophish_group_id ],
			null,
			'campaign',
			$campaign_id
		);

		return $this->success( [
			'imported'         => $inserted,
			'gophish_group_id' => $gophish_group_id,
		], 201 );
	}

	/**
	 * Return the list of targets stored locally for a campaign.
	 */
	public function get_targets( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$id = (int) $request->get_param( 'id' );

		$targets = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}pukat_targets WHERE campaign_id = %d ORDER BY id ASC",
				$id
			),
			ARRAY_A
		);

		return $this->success( $targets ?: [] );
	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	/**
	 * Build GoPhish campaign creation payload from Pukat campaign + playbook.
	 *
	 * @param array           $campaign Campaign row.
	 * @param WP_REST_Request $request  Original request (contains group_ids, etc.)
	 * @return array GoPhish payload.
	 */
	private function build_gophish_payload( array $campaign, WP_REST_Request $request ): array {
		global $wpdb;

		$group_name    = sanitize_text_field( (string) ( $request->get_param( 'group_name' ) ?: "Group-Campaign-{$campaign['id']}" ) );
		$template_id   = (int) $request->get_param( 'gophish_template_id' );
		$page_id       = (int) $request->get_param( 'gophish_page_id' );
		$smtp_id       = (int) $request->get_param( 'gophish_smtp_id' );
		$url           = sanitize_url( (string) $request->get_param( 'url' ) );

		// Fall back to playbook if individual IDs not provided.
		if ( $campaign['playbook_id'] && ( ! $template_id || ! $page_id || ! $smtp_id ) ) {
			$playbook = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT * FROM {$wpdb->prefix}pukat_playbooks WHERE id = %d",
					$campaign['playbook_id']
				),
				ARRAY_A
			);
			if ( $playbook ) {
				$template_id = $template_id ?: (int) $playbook['gophish_template_id'];
				$page_id     = $page_id     ?: (int) $playbook['gophish_page_id'];
				$smtp_id     = $smtp_id     ?: (int) $playbook['gophish_smtp_id'];
			}
		}

		if ( ! $template_id || ! $page_id || ! $smtp_id ) {
			return [
				'error' => __( 'Select a GoPhish email template, landing page, and SMTP sending profile before launch.', 'pukat' ),
			];
		}

		$asset_names = $this->resolve_gophish_asset_names( $template_id, $page_id, $smtp_id, $group_name );
		if ( isset( $asset_names['error'] ) ) {
			return $asset_names;
		}

		return [
			'name'              => $campaign['name'],
			'template'          => [ 'name' => $asset_names['template'] ],
			'url'               => $url ?: home_url(),
			'page'              => [ 'name' => $asset_names['page'] ],
			'smtp'              => [ 'name' => $asset_names['smtp'] ],
			'launch_date'       => $this->format_gophish_datetime( $campaign['scheduled_at'] ?? null ),
			'send_by_date'      => null,
			'groups'            => [ [ 'name' => $group_name ] ],
		];
	}

	/**
	 * Resolve selected GoPhish IDs into resource names required by campaign creation.
	 *
	 * @return array{template?: string, page?: string, smtp?: string, error?: string}
	 */
	private function resolve_gophish_asset_names( int $template_id, int $page_id, int $smtp_id, string $group_name ): array {
		$gp = new GoPhishService();

		$template = $this->find_gophish_name_by_id( $gp->get_email_templates(), $template_id, __( 'email template', 'pukat' ) );
		if ( isset( $template['error'] ) ) {
			return $template;
		}

		$page = $this->find_gophish_name_by_id( $gp->get_landing_pages(), $page_id, __( 'landing page', 'pukat' ) );
		if ( isset( $page['error'] ) ) {
			return $page;
		}

		$smtp = $this->find_gophish_name_by_id( $gp->get_sending_profiles(), $smtp_id, __( 'SMTP sending profile', 'pukat' ) );
		if ( isset( $smtp['error'] ) ) {
			return $smtp;
		}

		$group = $this->find_gophish_group_by_name( $gp->get_groups(), $group_name );
		if ( isset( $group['error'] ) ) {
			return $group;
		}

		return [
			'template' => $template['name'],
			'page'     => $page['name'],
			'smtp'     => $smtp['name'],
		];
	}

	/**
	 * Find the name for a GoPhish resource by ID.
	 *
	 * @param mixed  $items Resource list or WP_Error from GoPhishService.
	 * @param int    $id    Selected GoPhish ID.
	 * @param string $label Human label for error messages.
	 * @return array{name?: string, error?: string}
	 */
	private function find_gophish_name_by_id( mixed $items, int $id, string $label ): array {
		if ( is_wp_error( $items ) ) {
			return [ 'error' => $items->get_error_message() ];
		}

		foreach ( (array) $items as $item ) {
			if ( $id === (int) ( $item['id'] ?? 0 ) && ! empty( $item['name'] ) ) {
				return [ 'name' => sanitize_text_field( (string) $item['name'] ) ];
			}
		}

		return [
			'error' => sprintf(
				/* translators: %s: GoPhish resource type. */
				__( 'Selected GoPhish %s was not found.', 'pukat' ),
				$label
			),
		];
	}

	/**
	 * Confirm the target group exists in GoPhish before launch.
	 *
	 * @param mixed  $groups     Group list or WP_Error from GoPhishService.
	 * @param string $group_name Expected group name.
	 * @return array{name?: string, error?: string}
	 */
	private function find_gophish_group_by_name( mixed $groups, string $group_name ): array {
		if ( is_wp_error( $groups ) ) {
			return [ 'error' => $groups->get_error_message() ];
		}

		foreach ( (array) $groups as $group ) {
			if ( $group_name === (string) ( $group['name'] ?? '' ) ) {
				return [ 'name' => $group_name ];
			}
		}

		return [
			'error' => __( 'Target group was not found in GoPhish. Import targets before launch.', 'pukat' ),
		];
	}

	/**
	 * Format campaign launch date for GoPhish.
	 */
	private function format_gophish_datetime( ?string $datetime ): string {
		if ( empty( $datetime ) ) {
			return gmdate( 'Y-m-d\TH:i:s+00:00' );
		}

		$timestamp = strtotime( $datetime );
		if ( false === $timestamp ) {
			return gmdate( 'Y-m-d\TH:i:s+00:00' );
		}

		return gmdate( 'Y-m-d\TH:i:s+00:00', $timestamp );
	}

	private function legacy_campaign_launch_response( WP_REST_Response $response ): WP_REST_Response {
		return $this->legacy_response(
			$response,
			'/campaign-runs',
			__( 'The /campaigns/{id}/launch endpoint uses the legacy campaign flow. Use Campaign Run endpoints for new launches.', 'pukat' )
		);
	}
}
