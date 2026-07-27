<?php
/**
 * Campaign Run REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\CampaignRunService;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manages Campaign Run instances created from Playbook Master.
 */
class CampaignRunController extends RestController {

	private CampaignRunService $campaign_runs;

	public function __construct( ?CampaignRunService $campaign_runs = null ) {
		$this->campaign_runs = $campaign_runs ?? new CampaignRunService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/campaign-runs', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_campaign_runs' ],
				'permission_callback' => [ $this, 'permission_read' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_campaign_run' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_campaign_run' ],
				'permission_callback' => [ $this, 'permission_read' ],
			],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/lock-snapshot', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'lock_snapshot' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/sync', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'sync_campaign_run' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/launch', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'launch_campaign_run' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/cancel', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'cancel_campaign_run' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/results', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_results' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/sync-results', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'sync_results' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/campaign-runs/(?P<id>\d+)/report', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_report' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );
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
