<?php
/**
 * Report REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\CampaignRunService;
use Pukat\Services\GoPhishService;
use Pukat\Services\RiskScoringService;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class ReportController
 *
 * Generates campaign reports combining GoPhish event data + local risk scores.
 *
 * Routes:
 *   GET /pukat/v1/reports/{campaign_id}
 *   GET /pukat/v1/reports/{campaign_id}/export
 *   GET /pukat/v1/risk-scores/{email}
 */
class ReportController extends RestController {

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/reports/(?P<campaign_id>\d+)', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_report' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );

		register_rest_route( $this->namespace, '/reports/(?P<campaign_id>\d+)/export', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'export_csv' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );

		register_rest_route( $this->namespace, '/reports/campaign-runs/(?P<campaign_run_id>\d+)', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_campaign_run_report' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );

		register_rest_route( $this->namespace, '/reports/campaign-runs/(?P<campaign_run_id>\d+)/export', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'export_campaign_run_csv' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );

		register_rest_route( $this->namespace, '/risk-scores', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_all_risk_scores' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );

		register_rest_route( $this->namespace, '/risk-scores/(?P<email>[^/]+)', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_user_risk_score' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );
	}

	public function get_report( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$campaign_id = (int) $request->get_param( 'campaign_id' );

		$campaign = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pukat_campaigns WHERE id = %d", $campaign_id ),
			ARRAY_A
		);

		if ( ! $campaign ) {
			return $this->error( 'not_found', __( 'Campaign not found.', 'pukat' ), 404 );
		}

		// GoPhish raw results.
		$gp_results = null;
		$gp_stats   = [
			'total'          => 0,
			'email_sent'     => 0,
			'email_opened'   => 0,
			'clicked'        => 0,
			'submitted_data' => 0,
			'click_rate'     => 0,
			'submit_rate'    => 0,
		];

		if ( $campaign['gophish_id'] ) {
			$gp_response = ( new GoPhishService() )->get_campaign_results( (int) $campaign['gophish_id'] );
			if ( ! is_wp_error( $gp_response ) ) {
				$gp_results = $gp_response;
				$gp_stats   = $this->aggregate_stats( $gp_results );
			}
		}

		// Risk scoring summary.
		$risk_summary = ( new RiskScoringService() )->get_campaign_summary( $campaign_id );

		// Quiz summary.
		$quiz_stats = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					COUNT(*) as total,
					SUM(passed) as passed,
					AVG(score) as avg_score
				 FROM {$wpdb->prefix}pukat_quiz_results
				 WHERE campaign_id = %d",
				$campaign_id
			),
			ARRAY_A
		) ?: [ 'total' => 0, 'passed' => 0, 'avg_score' => 0 ];

		// Benchmark: compare to previous campaign.
		$prev_click_rate = $this->get_previous_campaign_click_rate( $campaign_id );

		return $this->success( [
			'campaign'        => $campaign,
			'gophish_stats'   => $gp_stats,
			'risk_summary'    => $risk_summary,
			'quiz_summary'    => $quiz_stats,
			'benchmark'       => [
				'previous_click_rate' => $prev_click_rate,
				'current_click_rate'  => $gp_stats['click_rate'],
				'improvement'         => $prev_click_rate - $gp_stats['click_rate'],
			],
			'generated_at'    => current_time( 'mysql' ),
		] );
	}

	public function export_csv( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$campaign_id = (int) $request->get_param( 'campaign_id' );

		$targets = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT t.email, t.first_name, t.last_name, t.department,
					rs.total_score, rs.risk_tier,
					qr.score as quiz_score, qr.passed as quiz_passed
				 FROM {$wpdb->prefix}pukat_targets t
				 LEFT JOIN {$wpdb->prefix}pukat_risk_scores rs
					ON rs.target_email = t.email AND rs.campaign_id = t.campaign_id
				 LEFT JOIN {$wpdb->prefix}pukat_quiz_results qr
					ON qr.target_email = t.email AND qr.campaign_id = t.campaign_id
				 WHERE t.campaign_id = %d",
				$campaign_id
			),
			ARRAY_A
		);

		return $this->success( [
			'rows'     => $targets ?: [],
			'filename' => "pukat-report-campaign-{$campaign_id}-" . gmdate( 'Ymd' ) . '.csv',
		] );
	}

	public function get_campaign_run_report( WP_REST_Request $request ): WP_REST_Response {
		$result = ( new CampaignRunService() )->report( (int) $request->get_param( 'campaign_run_id' ) );

		return $this->result_response( $result );
	}

	public function export_campaign_run_csv( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$campaign_run_id = (int) $request->get_param( 'campaign_run_id' );

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT target_email, user_id, click_score, quiz_score, total_score, risk_tier, created_at
				 FROM {$wpdb->prefix}pukat_risk_scores
				 WHERE campaign_run_id = %d
				 ORDER BY total_score DESC",
				$campaign_run_id
			),
			ARRAY_A
		);

		return $this->success( [
			'rows'     => $rows ?: [],
			'filename' => "pukat-report-campaign-run-{$campaign_run_id}-" . gmdate( 'Ymd' ) . '.csv',
		] );
	}

	public function get_user_risk_score( WP_REST_Request $request ): WP_REST_Response {
		$email  = sanitize_email( urldecode( (string) $request->get_param( 'email' ) ) );
		$score  = ( new RiskScoringService() )->get_latest_score( $email );

		if ( ! $score ) {
			return $this->error( 'not_found', __( 'No risk score found for this user.', 'pukat' ), 404 );
		}

		return $this->success( $score );
	}

	public function get_all_risk_scores( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$campaign_id = (int) $request->get_param( 'campaign_id' );
		$campaign_run_id = (int) $request->get_param( 'campaign_run_id' );
		$tier        = sanitize_text_field( (string) $request->get_param( 'tier' ) );

		$where  = [];
		$params = [];

		if ( $campaign_id ) {
			$where[]  = 'campaign_id = %d';
			$params[] = $campaign_id;
		}
		if ( $campaign_run_id ) {
			$where[]  = 'campaign_run_id = %d';
			$params[] = $campaign_run_id;
		}
		if ( $tier ) {
			$where[]  = 'risk_tier = %s';
			$params[] = $tier;
		}

		$where_sql = $where ? 'WHERE ' . implode( ' AND ', $where ) : '';

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $params
			? $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}pukat_risk_scores {$where_sql} ORDER BY total_score DESC", ...$params ), ARRAY_A )
			: $wpdb->get_results( "SELECT * FROM {$wpdb->prefix}pukat_risk_scores ORDER BY total_score DESC", ARRAY_A );

		return $this->success( $rows ?: [] );
	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	private function aggregate_stats( array $gp_results ): array {
		$targets    = $gp_results['results'] ?? [];
		$total      = count( $targets );
		$sent       = 0;
		$opened     = 0;
		$clicked    = 0;
		$submitted  = 0;

		foreach ( $targets as $target ) {
			$status = $target['status'] ?? '';
			if ( str_contains( $status, 'Sent' ) || $status !== 'Unknown' ) {
				$sent++;
			}
			$timeline = $target['timeline'] ?? [];
			foreach ( $timeline as $event ) {
				$msg = $event['message'] ?? '';
				if ( 'Email Opened' === $msg ) {
					$opened++;
				} elseif ( 'Clicked Link' === $msg ) {
					$clicked++;
				} elseif ( 'Submitted Data' === $msg ) {
					$submitted++;
				}
			}
		}

		return [
			'total'          => $total,
			'email_sent'     => $sent,
			'email_opened'   => $opened,
			'clicked'        => $clicked,
			'submitted_data' => $submitted,
			'click_rate'     => $total > 0 ? round( ( $clicked / $total ) * 100, 1 ) : 0,
			'submit_rate'    => $total > 0 ? round( ( $submitted / $total ) * 100, 1 ) : 0,
		];
	}

	private function get_previous_campaign_click_rate( int $current_id ): float {
		global $wpdb;

		$prev = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}pukat_campaigns WHERE id < %d AND status = 'completed' ORDER BY id DESC LIMIT 1",
				$current_id
			)
		);

		if ( ! $prev ) {
			return 0.0;
		}

		$prev_risk = ( new RiskScoringService() )->get_campaign_summary( (int) $prev->id );
		$total     = array_sum( array_map(
			fn( $k ) => $prev_risk[ $k ] ?? 0,
			[ 'low', 'medium', 'high', 'critical' ]
		) );
		$clicked   = ( $prev_risk['high'] ?? 0 ) + ( $prev_risk['critical'] ?? 0 );

		return $total > 0 ? round( ( $clicked / $total ) * 100, 1 ) : 0.0;
	}

	private function result_response( mixed $result, int $success_status = 200 ): WP_REST_Response {
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result, $success_status );
	}
}
