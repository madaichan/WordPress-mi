<?php
/**
 * Risk scoring service.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * Class RiskScoringService
 *
 * Computes and persists per-user risk scores based on:
 * - Click behaviour (0–50 pts)
 * - Quiz performance (0–50 pts)
 *
 * Total 0–100 → risk tier: low (0-29) | medium (30-59) | high (60-79) | critical (80-100)
 */
class RiskScoringService {

	/** @var array Risk tier thresholds. */
	private array $thresholds;

	private ?bool $quiz_results_has_campaign_run_id = null;

	public function __construct() {
		$raw              = get_option( 'pukat_risk_thresholds', '' );
		$this->thresholds = $raw ? (array) json_decode( $raw, true ) : [
			'low'      => [ 'min' => 0,  'max' => 29 ],
			'medium'   => [ 'min' => 30, 'max' => 59 ],
			'high'     => [ 'min' => 60, 'max' => 79 ],
			'critical' => [ 'min' => 80, 'max' => 100 ],
		];
	}

	/**
	 * Calculate and store risk score for a target after campaign completion.
	 *
	 * @param int    $campaign_id  Pukat campaign ID.
	 * @param string $email        Target email address.
	 * @param array  $event_data   GoPhish event data for this target.
	 * @return array Computed score record.
	 */
	public function compute_and_store( int $campaign_id, string $email, array $event_data ): array {
		global $wpdb;

		$click_score = $this->compute_click_score( $event_data );
		$quiz_score  = $this->compute_quiz_score( $campaign_id, $email );
		$total       = $click_score + $quiz_score;
		$tier        = $this->get_tier( $total );

		// Look up WP user by email.
		$user    = get_user_by( 'email', $email );
		$user_id = $user ? $user->ID : null;

		$record = [
			'target_email' => $email,
			'user_id'      => $user_id,
			'campaign_id'  => $campaign_id,
			'click_score'  => $click_score,
			'quiz_score'   => $quiz_score,
			'total_score'  => $total,
			'risk_tier'    => $tier,
		];

		$wpdb->insert( $wpdb->prefix . 'pukat_risk_scores', $record );

		// If high risk, schedule coaching.
		if ( in_array( $tier, [ 'high', 'critical' ], true ) ) {
			do_action( 'pukat_high_risk_detected', $email, $campaign_id, $tier );
		}

		return $record;
	}

	/**
	 * Calculate and store risk score for a target in the Playbook Master flow.
	 *
	 * @param int    $campaign_run_id Campaign Run ID.
	 * @param string $email           Target email address.
	 * @param array  $event_data      GoPhish event data for this target.
	 * @return array Computed score record.
	 */
	public function compute_and_store_for_campaign_run( int $campaign_run_id, string $email, array $event_data ): array {
		global $wpdb;

		$click_score = $this->compute_click_score( $event_data );
		$quiz_score  = $this->compute_campaign_run_quiz_score( $campaign_run_id, $email );
		$total       = $click_score + $quiz_score;
		$tier        = $this->get_tier( $total );
		$user        = get_user_by( 'email', $email );
		$user_id     = $user ? $user->ID : null;

		$record = [
			'target_email'    => $email,
			'user_id'         => $user_id,
			'campaign_id'     => 0,
			'campaign_run_id' => $campaign_run_id,
			'click_score'     => $click_score,
			'quiz_score'      => $quiz_score,
			'total_score'     => $total,
			'risk_tier'       => $tier,
		];

		$wpdb->insert( $wpdb->prefix . 'pukat_risk_scores', $record );

		if ( in_array( $tier, [ 'high', 'critical' ], true ) ) {
			do_action( 'pukat_campaign_run_high_risk_detected', $email, $campaign_run_id, $tier );
		}

		return $record;
	}

	/**
	 * Delete previously derived scores for a Campaign Run before a fresh sync.
	 */
	public function delete_campaign_run_scores( int $campaign_run_id ): void {
		global $wpdb;

		$wpdb->delete(
			$wpdb->prefix . 'pukat_risk_scores',
			[ 'campaign_run_id' => $campaign_run_id ],
			[ '%d' ]
		);
	}

	/**
	 * Get the latest risk score for a target.
	 *
	 * @param string $email Target email.
	 * @return array|null Latest risk score row or null.
	 */
	public function get_latest_score( string $email ): ?array {
		global $wpdb;
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}pukat_risk_scores
				 WHERE target_email = %s
				 ORDER BY created_at DESC LIMIT 1",
				$email
			),
			ARRAY_A
		);
		return $row ?: null;
	}

	/**
	 * Get risk summary for all targets in a campaign.
	 *
	 * @param int $campaign_id Pukat campaign ID.
	 * @return array Counts per tier + list of high-risk targets.
	 */
	public function get_campaign_summary( int $campaign_id ): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT target_email, risk_tier, total_score
				 FROM {$wpdb->prefix}pukat_risk_scores
				 WHERE campaign_id = %d
				 ORDER BY total_score DESC",
				$campaign_id
			),
			ARRAY_A
		);

		$summary = [
			'low'      => 0,
			'medium'   => 0,
			'high'     => 0,
			'critical' => 0,
			'targets'  => $rows,
		];

		foreach ( $rows as $row ) {
			$tier = $row['risk_tier'] ?? 'low';
			$summary[ $tier ] = ( $summary[ $tier ] ?? 0 ) + 1;
		}

		return $summary;
	}

	/**
	 * Get risk summary for all targets in a Campaign Run.
	 *
	 * @param int $campaign_run_id Campaign Run ID.
	 * @return array Counts per tier + list of high-risk targets.
	 */
	public function get_campaign_run_summary( int $campaign_run_id ): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT target_email, risk_tier, total_score
				 FROM {$wpdb->prefix}pukat_risk_scores
				 WHERE campaign_run_id = %d
				 ORDER BY total_score DESC",
				$campaign_run_id
			),
			ARRAY_A
		);

		return $this->summarize_rows( $rows ?: [] );
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Compute click-based risk score (0–50).
	 *
	 * Scoring:
	 * - Clicked the link:     +25 pts
	 * - Submitted data:       +25 pts (total 50)
	 * - Email opened only:    +0 pts (awareness)
	 *
	 * @param array $event_data GoPhish target event data.
	 * @return int Score 0–50.
	 */
	private function compute_click_score( array $event_data ): int {
		$score    = 0;
		$timeline = $event_data['timeline'] ?? [];

		foreach ( $timeline as $event ) {
			$message = $event['message'] ?? '';
			if ( 'Clicked Link' === $message ) {
				$score += 25;
			} elseif ( 'Submitted Data' === $message ) {
				$score += 25;
			}
		}

		return min( $score, 50 );
	}

	/**
	 * Compute quiz-based risk score (0–50).
	 *
	 * Score = 50 - (quiz_percentage * 0.5)
	 * A perfect quiz (100%) contributes 0 risk; failed (0%) contributes 50 risk.
	 *
	 * @param int    $campaign_id Pukat campaign ID.
	 * @param string $email       Target email.
	 * @return int Score 0–50.
	 */
	private function compute_quiz_score( int $campaign_id, string $email ): int {
		global $wpdb;

		$quiz_score = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT score FROM {$wpdb->prefix}pukat_quiz_results
				 WHERE campaign_id = %d AND target_email = %s
				 ORDER BY created_at DESC LIMIT 1",
				$campaign_id,
				$email
			)
		);

		if ( null === $quiz_score ) {
			// No quiz taken → max risk contribution.
			return 50;
		}

		// Invert: lower quiz score = higher risk contribution.
		return (int) round( 50 - ( (int) $quiz_score * 0.5 ) );
	}

	/**
	 * Compute quiz contribution for Campaign Run risk scoring.
	 */
	private function compute_campaign_run_quiz_score( int $campaign_run_id, string $email ): int {
		global $wpdb;

		if ( ! $this->quiz_results_has_campaign_run_id() ) {
			return 50;
		}

		$quiz_score = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT score FROM {$wpdb->prefix}pukat_quiz_results
				 WHERE campaign_run_id = %d AND target_email = %s
				 ORDER BY created_at DESC LIMIT 1",
				$campaign_run_id,
				$email
			)
		);

		if ( null === $quiz_score ) {
			return 50;
		}

		return (int) round( 50 - ( (int) $quiz_score * 0.5 ) );
	}

	private function quiz_results_has_campaign_run_id(): bool {
		if ( null !== $this->quiz_results_has_campaign_run_id ) {
			return $this->quiz_results_has_campaign_run_id;
		}

		global $wpdb;

		$column = $wpdb->get_var(
			$wpdb->prepare( "SHOW COLUMNS FROM {$wpdb->prefix}pukat_quiz_results LIKE %s", 'campaign_run_id' )
		);

		$this->quiz_results_has_campaign_run_id = (bool) $column;

		return $this->quiz_results_has_campaign_run_id;
	}

	/**
	 * @param array<int, array<string, mixed>> $rows Risk score rows.
	 */
	private function summarize_rows( array $rows ): array {
		$summary = [
			'low'      => 0,
			'medium'   => 0,
			'high'     => 0,
			'critical' => 0,
			'targets'  => $rows,
		];

		foreach ( $rows as $row ) {
			$tier = $row['risk_tier'] ?? 'low';
			$summary[ $tier ] = ( $summary[ $tier ] ?? 0 ) + 1;
		}

		return $summary;
	}

	/**
	 * Determine risk tier from total score.
	 *
	 * @param int $total Total score 0–100.
	 * @return string 'low'|'medium'|'high'|'critical'
	 */
	private function get_tier( int $total ): string {
		foreach ( $this->thresholds as $tier => $range ) {
			if ( $total >= $range['min'] && $total <= $range['max'] ) {
				return $tier;
			}
		}
		return 'low';
	}
}
