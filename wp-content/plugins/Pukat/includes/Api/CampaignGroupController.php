<?php
/**
 * Campaign Group REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\CampaignGroupService;
use Pukat\Services\CampaignReportPdfService;
use Pukat\Services\PermissionRegistry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manages Campaign Groups — organizational grouping for Campaign Runs, used
 * to filter the Monitoring dashboard and the Manage Campaigns page. Reuses
 * the existing campaigns.* capabilities rather than a new registry menu:
 * group management is a sub-concern of campaign management, same audience.
 * See docs/PRD_CAMPAIGN_GROUP_MONITORING.md.
 */
class CampaignGroupController extends RestController {

	private CampaignGroupService $campaign_groups;
	private CampaignReportPdfService $pdf;

	public function __construct( ?CampaignGroupService $campaign_groups = null, ?CampaignReportPdfService $pdf = null ) {
		$this->campaign_groups = $campaign_groups ?? new CampaignGroupService();
		$this->pdf             = $pdf ?? new CampaignReportPdfService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/campaign-groups', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_campaign_groups' ],
				'permission_callback' => [ $this, 'permission_view_campaign_group' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_campaign_group' ],
				'permission_callback' => [ $this, 'permission_edit_campaign_group' ],
			],
		] );

		// Static "active" bucket must be registered before the numeric {id}
		// routes below — WP REST tries routes in registration order and the
		// {id} pattern is digits-only, so there's no real collision risk, but
		// keeping the literal route first mirrors the pattern this project
		// already uses (see CampaignRunController) and reads more obviously.
		register_rest_route( $this->namespace, '/campaign-groups/active/report', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_active_report' ],
			'permission_callback' => [ $this, 'permission_view_campaign_group' ],
		] );

		register_rest_route( $this->namespace, '/campaign-groups/active/report/export', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'export_active_report' ],
			'permission_callback' => [ $this, 'permission_view_campaign_group' ],
		] );

		register_rest_route( $this->namespace, '/campaign-groups/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_campaign_group' ],
				'permission_callback' => [ $this, 'permission_view_campaign_group' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_campaign_group' ],
				'permission_callback' => [ $this, 'permission_edit_campaign_group' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_campaign_group' ],
				'permission_callback' => [ $this, 'permission_delete_campaign_group' ],
			],
		] );

		register_rest_route( $this->namespace, '/campaign-groups/(?P<id>\d+)/report', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_report' ],
			'permission_callback' => [ $this, 'permission_view_campaign_group' ],
		] );

		register_rest_route( $this->namespace, '/campaign-groups/(?P<id>\d+)/report/export', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'export_report' ],
			'permission_callback' => [ $this, 'permission_view_campaign_group' ],
		] );
	}

	public function permission_view_campaign_group(): bool|WP_Error {
		return $this->require_capability( 'campaigns.view' );
	}

	public function permission_edit_campaign_group(): bool|WP_Error {
		return $this->require_capability( 'campaigns.edit' );
	}

	public function permission_delete_campaign_group(): bool|WP_Error {
		return $this->require_capability( 'campaigns.delete' );
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

	public function list_campaign_groups( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->campaign_groups->list() );
	}

	public function get_campaign_group( WP_REST_Request $request ): WP_REST_Response {
		$group = $this->campaign_groups->get( (int) $request->get_param( 'id' ) );

		if ( ! $group ) {
			return $this->error( 'not_found', __( 'Campaign Group not found.', 'pukat' ), 404 );
		}

		return $this->success( $group );
	}

	public function create_campaign_group( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_groups->create( $this->request_params( $request ), get_current_user_id() );

		return $this->result_response( $result, 201 );
	}

	public function update_campaign_group( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_groups->update( (int) $request->get_param( 'id' ), $this->request_params( $request ) );

		return $this->result_response( $result );
	}

	public function delete_campaign_group( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_groups->delete( (int) $request->get_param( 'id' ) );

		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( [ 'deleted' => true ] );
	}

	public function get_report( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->campaign_groups->report( (int) $request->get_param( 'id' ) );

		return $this->result_response( $result );
	}

	public function get_active_report( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->campaign_groups->report_active() );
	}

	public function export_report( WP_REST_Request $request ): WP_REST_Response {
		$id     = (int) $request->get_param( 'id' );
		$report = $this->campaign_groups->report( $id );

		if ( is_wp_error( $report ) ) {
			return $this->from_wp_error( $report );
		}

		$group = $this->campaign_groups->get( $id );
		$title = 'Campaign Group Report — ' . ( $group['name'] ?? "#{$id}" );

		return $this->binary_response(
			$this->pdf->render( $title, $report ),
			"pukat-campaign-group-{$id}-report.pdf",
			'application/pdf'
		);
	}

	public function export_active_report( WP_REST_Request $request ): WP_REST_Response {
		$report = $this->campaign_groups->report_active();

		return $this->binary_response(
			$this->pdf->render( 'Active Campaign Groups Report', $report ),
			'pukat-campaign-groups-active-report.pdf',
			'application/pdf'
		);
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
