<?php
/**
 * Campaign Run REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\CampaignRunService;
use Pukat\Services\FollowUpReminderService;
use Pukat\Services\PermissionRegistry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manages Campaign Run instances created from Playbook Master.
 */
class CampaignRunController extends RestController {

	private CampaignRunService $campaign_runs;
	private FollowUpReminderService $follow_up_reminders;

	public function __construct( ?CampaignRunService $campaign_runs = null, ?FollowUpReminderService $follow_up_reminders = null ) {
		$this->campaign_runs       = $campaign_runs ?? new CampaignRunService();
		$this->follow_up_reminders = $follow_up_reminders ?? new FollowUpReminderService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/campaign-runs', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_campaign_runs' ],
				'permission_callback' => [ $this, 'permission_view_campaign_run' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_campaign_run' ],
				'permission_callback' => [ $this, 'permission_create_campaign_run' ],
			],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_campaign_run' ],
				'permission_callback' => [ $this, 'permission_view_campaign_run' ],
			],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/lock-snapshot', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'lock_snapshot' ],
			'permission_callback' => [ $this, 'permission_edit_campaign_run' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/sync', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'sync_campaign_run' ],
			'permission_callback' => [ $this, 'permission_edit_campaign_run' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/launch', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'launch_campaign_run' ],
			'permission_callback' => [ $this, 'permission_launch_campaign_run' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/cancel', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'cancel_campaign_run' ],
			'permission_callback' => [ $this, 'permission_cancel_campaign_run' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/results', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_results' ],
			'permission_callback' => [ $this, 'permission_view_campaign_run' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/sync-results', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'sync_results' ],
			'permission_callback' => [ $this, 'permission_edit_campaign_run' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/report', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_report' ],
			'permission_callback' => [ $this, 'permission_view_campaign_run' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/send-follow-up-reminder', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'send_follow_up_reminder' ],
			'permission_callback' => [ $this, 'permission_edit_campaign_run' ], // ancillary action on an existing run, no better fit
		] );
	}

	/**
	 * Phase 3 of docs/IMPLEMENTATION_PLAN_RBAC.md: granular capability checks
	 * replacing permission_read()/permission_manage(). Shares the same
	 * campaigns.* registry keys as CampaignController — lock-snapshot, sync,
	 * sync-results, and send-follow-up-reminder all reuse .edit (operational
	 * state changes on an existing run, none of them a create/delete/launch/
	 * cancel). .cancel gets its first real use here. All shared/operator-
	 * gated in Phase 1, same population as before.
	 */
	public function permission_view_campaign_run(): bool|WP_Error {
		return $this->require_capability( 'campaigns.view' );
	}

	public function permission_create_campaign_run(): bool|WP_Error {
		return $this->require_capability( 'campaigns.create' );
	}

	public function permission_edit_campaign_run(): bool|WP_Error {
		return $this->require_capability( 'campaigns.edit' );
	}

	public function permission_launch_campaign_run(): bool|WP_Error {
		return $this->require_capability( 'campaigns.launch' );
	}

	public function permission_cancel_campaign_run(): bool|WP_Error {
		return $this->require_capability( 'campaigns.cancel' );
	}

	private function require_capability( string $permission_key ): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		if ( ! current_user_can( PermissionRegistry::capability_for( $permission_key ) ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Insufficient permissions.', 'pukat' ), [ 'status' => 403 ] );
		}
		return true;
	}

	public function list_campaign_runs( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->campaign_runs->list() );
	}

	public function get_campaign_run( WP_REST_Request $request ): WP_REST_Response {
		$run = $this->campaign_runs->get( (int) $request->get_param( 'id' ) );

		if ( ! $run ) {
			return $this->error( 'not_found', __( 'Campaign Run not found.', 'pukat' ), 404 );
		}

		return $this->success( $run );
	}

	public function create_campaign_run( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_runs->create( $this->request_params( $request ), get_current_user_id() );

		return $this->result_response( $result, 201 );
	}

	public function lock_snapshot( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_runs->lock_snapshot( (int) $request->get_param( 'id' ), get_current_user_id() );

		return $this->result_response( $result );
	}

	public function sync_campaign_run( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_runs->sync( (int) $request->get_param( 'id' ), get_current_user_id() );

		return $this->result_response( $result );
	}

	public function launch_campaign_run( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_runs->launch( (int) $request->get_param( 'id' ), get_current_user_id() );

		return $this->result_response( $result );
	}

	public function cancel_campaign_run( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_runs->cancel( (int) $request->get_param( 'id' ), get_current_user_id() );

		return $this->result_response( $result );
	}

	public function get_results( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_runs->results( (int) $request->get_param( 'id' ) );

		return $this->result_response( $result );
	}

	public function sync_results( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_runs->sync_results( (int) $request->get_param( 'id' ), get_current_user_id() );

		return $this->result_response( $result );
	}

	public function get_report( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_runs->report( (int) $request->get_param( 'id' ) );

		return $this->result_response( $result );
	}

	public function send_follow_up_reminder( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->follow_up_reminders->send_for_campaign_run( (int) $request->get_param( 'id' ) );

		return $this->result_response( $result );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function request_params( WP_REST_Request $request ): array {
		$params = $request->get_params();
		$json   = $request->get_json_params();

		if ( is_array( $json ) ) {
			$params = array_merge( $params, $json );
		}

		return $params;
	}

	private function result_response( mixed $result, int $success_status = 200 ): WP_REST_Response {
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result, $success_status );
	}
}
