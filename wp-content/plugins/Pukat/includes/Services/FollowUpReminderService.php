<?php
/**
 * Post-launch Follow-Up reminder service.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\CampaignRunRepository;
use WP_Error;

/**
 * Class FollowUpReminderService
 *
 * Sends the wizard's "Force Reset Password" Follow-Up as a plain email reminder —
 * not a real password reset — to targets a Campaign Run's risk scoring flagged
 * high/critical risk. Triggered manually (see CampaignRunController), not automatically.
 */
class FollowUpReminderService {

	private const REMINDER_TYPE = 'password_reminder';
	private const TARGET_TIERS  = [ 'high', 'critical' ];

	private CampaignRunRepository $repository;
	private RiskScoringService $risk_scoring;

	public function __construct( ?CampaignRunRepository $repository = null, ?RiskScoringService $risk_scoring = null ) {
		$this->repository   = $repository ?? new CampaignRunRepository();
		$this->risk_scoring = $risk_scoring ?? new RiskScoringService();
	}

	/**
	 * Send a password-reset reminder email to every high/critical-risk target of a
	 * Campaign Run that doesn't already have one logged.
	 *
	 * @return array{sent: int, skipped: int, failed: int}|WP_Error
	 */
	public function send_for_campaign_run( int $campaign_run_id ): array|WP_Error {
		$run = $this->repository->find( $campaign_run_id );
		if ( ! $run ) {
			return new WP_Error( 'not_found', __( 'Campaign Run not found.', 'pukat' ), [ 'status' => 404 ] );
		}

		$follow_up = json_decode( (string) ( $run['follow_up_json'] ?? '' ), true );
		if ( empty( $follow_up['force_reset_password_reminder_enabled'] ) ) {
			return new WP_Error(
				'reminder_not_enabled',
				__( 'Force Reset Password reminder was not enabled for this Campaign Run.', 'pukat' ),
				[ 'status' => 422 ]
			);
		}

		$summary = $this->risk_scoring->get_campaign_run_summary( $campaign_run_id );
		$targets = array_filter(
			$summary['targets'] ?? [],
			static fn( array $target ): bool => in_array( (string) ( $target['risk_tier'] ?? '' ), self::TARGET_TIERS, true )
		);

		$result = [ 'sent' => 0, 'skipped' => 0, 'failed' => 0 ];

		foreach ( $targets as $target ) {
			$email = sanitize_email( (string) ( $target['target_email'] ?? '' ) );
			if ( ! $email ) {
				continue;
			}

			if ( $this->already_reminded( $campaign_run_id, $email ) ) {
				++$result['skipped'];
				continue;
			}

			if ( $this->send_reminder_email( $email, (string) ( $run['name'] ?? '' ) ) ) {
				$this->log_reminder( $campaign_run_id, $email, 'sent' );
				++$result['sent'];
			} else {
				$this->log_reminder( $campaign_run_id, $email, 'failed' );
				++$result['failed'];
			}
		}

		return $result;
	}

	private function already_reminded( int $campaign_run_id, string $email ): bool {
		global $wpdb;

		$existing = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT id FROM {$wpdb->prefix}pukat_socialization_logs
				 WHERE campaign_run_id = %d AND recipient = %s AND type = %s AND status = 'sent'
				 LIMIT 1",
				$campaign_run_id,
				$email,
				self::REMINDER_TYPE
			)
		);

		return (bool) $existing;
	}

	private function send_reminder_email( string $email, string $campaign_name ): bool {
		$subject = __( 'Security reminder: please update your password', 'pukat' );
		$body    = sprintf(
			/* translators: %s: Campaign Run name. */
			__(
				"Hi,\n\nAs part of our \"%s\" security awareness exercise, our records show you interacted with a simulated phishing message. No action was taken against your account, but as a precaution we recommend changing your password soon and reviewing our phishing awareness guidance.\n\nThis is an automated reminder from Pukat.",
				'pukat'
			),
			$campaign_name
		);

		return (bool) wp_mail( $email, $subject, $body );
	}

	private function log_reminder( int $campaign_run_id, string $email, string $status ): void {
		global $wpdb;

		$wpdb->insert(
			$wpdb->prefix . 'pukat_socialization_logs',
			[
				'campaign_run_id' => $campaign_run_id,
				'recipient'       => $email,
				'type'            => self::REMINDER_TYPE,
				'subject'         => __( 'Security reminder: please update your password', 'pukat' ),
				'status'          => $status,
				'sent_at'         => current_time( 'mysql' ),
			]
		);
	}
}
