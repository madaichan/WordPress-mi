<?php
/**
 * Campaign Group REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\CampaignDataExportService;
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
	private CampaignDataExportService $data_export;

	public function __construct(
		?CampaignGroupService $campaign_groups = null,
		?CampaignReportPdfService $pdf = null,
		?CampaignDataExportService $data_export = null
	) {
		$this->campaign_groups = $campaign_groups ?? new CampaignGroupService();
		$this->pdf             = $pdf ?? new CampaignReportPdfService();
		$this->data_export     = $data_export ?? new CampaignDataExportService();
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

		register_rest_route( $this->namespace, '/campaign-groups/active/report/export-data', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'export_active_report_data' ],
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

		register_rest_route( $this->namespace, '/campaign-groups/(?P<id>\d+)/report/export-data', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'export_report_data' ],
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

		$pdf = $this->pdf->render_campaign_group( [
			'report'             => $report,
			'campaign_group_id'  => $id,
			'group_name'         => $group['name'] ?? null,
			'groups_by_id'       => $this->groups_by_id(),
		] );

		if ( is_wp_error( $pdf ) ) {
			return $this->from_wp_error( $pdf );
		}

		return $this->binary_response( $pdf, "pukat-campaign-group-{$id}-report.pdf", 'application/pdf' );
	}

	public function export_active_report( WP_REST_Request $request ): WP_REST_Response {
		$report = $this->campaign_groups->report_active();

		$pdf = $this->pdf->render_campaign_group( [
			'report'             => $report,
			'campaign_group_id'  => null,
			'group_name'         => null,
			'groups_by_id'       => $this->groups_by_id(),
		] );

		if ( is_wp_error( $pdf ) ) {
			return $this->from_wp_error( $pdf );
		}

		return $this->binary_response( $pdf, 'pukat-campaign-groups-active-report.pdf', 'application/pdf' );
	}

	/**
	 * "Download data" (CSV/XLSX) for the Monitoring page, scoped to one
	 * Campaign Group — docs/PRD_MONITORING_DATA_EXPORT.md FR-6/7/8/§7.8. Two
	 * tables in one file: the "Campaign funnel" summary, and every
	 * responding user tagged with their campaign and group. Reuses report()
	 * (same entity-scoped access guard as export_report()/get_report()
	 * above) and groups_by_id() (same group-name resolution as the PDF
	 * export).
	 */
	public function export_report_data( WP_REST_Request $request ): WP_REST_Response {
		$id = (int) $request->get_param( 'id' );

		return $this->export_data_response(
			$request,
			$this->campaign_groups->report( $id ),
			$id,
			"pukat-monitoring-campaign-summary-{$id}"
		);
	}

	/**
	 * Same as export_report_data() above, for the "all active groups"
	 * selection (no single group id).
	 */
	public function export_active_report_data( WP_REST_Request $request ): WP_REST_Response {
		return $this->export_data_response(
			$request,
			$this->campaign_groups->report_active(),
			null,
			'pukat-monitoring-campaign-summary-active'
		);
	}

	/**
	 * @param array<string, mixed>|WP_Error $report
	 */
	private function export_data_response( WP_REST_Request $request, $report, ?int $group_id, string $filename_prefix ): WP_REST_Response {
		$format = $this->data_export->resolve_format( (string) $request->get_param( 'format' ) );
		if ( is_wp_error( $format ) ) {
			return $this->from_wp_error( $format );
		}

		if ( is_wp_error( $report ) ) {
			return $this->from_wp_error( $report );
		}

		$group_name = null;
		if ( null !== $group_id ) {
			$group      = $this->campaign_groups->get( $group_id );
			$group_name = $group['name'] ?? null;
		}

		$groups_by_id = $this->groups_by_id();
		$sections     = [
			[ 'title' => 'Campaign Summary', 'table' => $this->data_export->campaign_summary_table( $report, $groups_by_id, $group_id, $group_name ) ],
			[ 'title' => 'Responders', 'table' => $this->data_export->responder_details_table( $report, $groups_by_id, $group_id, $group_name ) ],
		];

		$binary = CampaignDataExportService::FORMAT_XLSX === $format
			? $this->data_export->to_xlsx_sections( $sections )
			: $this->data_export->to_csv_sections( $sections );

		if ( is_wp_error( $binary ) ) {
			return $this->from_wp_error( $binary );
		}

		return $this->binary_response(
			$binary,
			"{$filename_prefix}-" . gmdate( 'Ymd' ) . ".{$format}",
			$this->data_export->content_type_for( $format )
		);
	}

	/**
	 * Authorised id => name map for every group the current user can see —
	 * used by the multi-campaign report to label each campaign's group in
	 * the "active groups" selection, where campaign_runs.campaign_group_id
	 * isn't otherwise resolved to a name (see the report/export data prep
	 * in CampaignReportPdfService::campaign_group_report_data()).
	 *
	 * @return array<int, string>
	 */
	private function groups_by_id(): array {
		$map = [];
		foreach ( $this->campaign_groups->list() as $group ) {
			$map[ (int) $group['id'] ] = (string) $group['name'];
		}
		return $map;
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
