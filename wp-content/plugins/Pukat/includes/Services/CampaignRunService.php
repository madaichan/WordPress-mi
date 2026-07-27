<?php
/**
 * Campaign Run business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\CampaignRunRepository;
use WP_Error;

/**
 * Coordinates Campaign Run creation and immutable snapshot locking.
 */
class CampaignRunService {

	private const GENERAL_ENTITY = 'General';

	private const PLAYBOOK_RUNNABLE_STATUS = 'active';
	private const COMPONENT_READY_STATUSES = [ 'approved', 'active' ];

	private CampaignRunRepository $repository;

	public function __construct( ?CampaignRunRepository $repository = null ) {
		$this->repository = $repository ?? new CampaignRunRepository();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list(): array {
		return array_map(
			[ $this, 'prepare_run' ],
			$this->filter_runs_for_current_user( $this->repository->all() )
		);
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get( int $id ): ?array {
		$run = $this->repository->find( $id );
		if ( ! $run || ! $this->current_user_can_access_run( $run ) ) {
			return null;
		}

		return $this->prepare_run( $run );
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
		$playbook_id = (int) ( $params['playbook_master_id'] ?? $params['playbook_id'] ?? 0 );
		if ( ! $playbook_id ) {
			return $this->validation_error( __( 'playbook_master_id is required.', 'pukat' ) );
		}

		$playbook = $this->repository->find_playbook_master( $playbook_id );
		if ( ! $playbook || ! $this->current_user_can_access_playbook( $playbook ) ) {
			return $this->not_found_error( __( 'Playbook Master not found.', 'pukat' ) );
		}

		if ( self::PLAYBOOK_RUNNABLE_STATUS !== (string) $playbook['status'] ) {
			return new WP_Error(
				'playbook_not_active',
				__( 'Campaign Runs can only be created from an active Playbook Master.', 'pukat' ),
				[ 'status' => 422 ]
			);
		}

		$readiness_error = $this->validate_playbook_ready( $playbook );
		if ( $readiness_error ) {
			return $readiness_error;
		}

		$data = [
			'playbook_master_id' => $playbook_id,
			'playbook_version'   => (int) ( $playbook['version'] ?? 1 ) ?: 1,
			'name'               => sanitize_text_field( (string) ( $params['name'] ?? $playbook['name'] ?? '' ) ),
			'target_segment_id'  => (int) ( $params['target_segment_id'] ?? 0 ) ?: null,
			'target_group_name'  => sanitize_text_field( (string) ( $params['target_group_name'] ?? '' ) ),
			'schedule_at'        => $this->sanitize_datetime( (string) ( $params['schedule_at'] ?? $params['scheduled_at'] ?? '' ) ),
			'timezone'           => $this->sanitize_timezone( (string) ( $params['timezone'] ?? 'UTC' ) ),
			'status'             => 'draft_run',
			'metrics_json'       => $this->json_value( $params, 'metrics', 'metrics_json' ),
			'created_by'         => $user_id,
		];

		if ( '' === trim( $data['name'] ) ) {
			return $this->validation_error( __( 'Campaign Run name is required.', 'pukat' ) );
		}

		$id = $this->repository->create( $data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create Campaign Run.', 'pukat' ) );
		}

		AuditLogService::log(
			'campaign_run.created',
			[
				'campaign_run_id'    => $id,
				'playbook_master_id' => $playbook_id,
				'name'               => $data['name'],
			],
			null,
			'campaign_run',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function lock_snapshot( int $id, int $user_id ): array|WP_Error {
		$run = $this->repository->find( $id );
		if ( ! $run ) {
			return $this->not_found_error( __( 'Campaign Run not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_run_editable( $run );
		if ( $permission_error ) {
			return $permission_error;
		}

		if ( ! empty( $run['snapshot_json'] ) ) {
			return $this->prepare_run( $run );
		}

		if ( ! in_array( (string) $run['status'], [ 'draft_run', 'ready_for_sync' ], true ) ) {
			return new WP_Error(
				'campaign_run_locked',
				__( 'Only draft Campaign Runs can lock a snapshot.', 'pukat' ),
				[ 'status' => 409 ]
			);
		}

		$playbook = $this->repository->find_playbook_master( (int) $run['playbook_master_id'] );
		if ( ! $playbook || ! $this->current_user_can_access_playbook( $playbook ) ) {
			return $this->not_found_error( __( 'Source Playbook Master not found.', 'pukat' ) );
		}

		if ( self::PLAYBOOK_RUNNABLE_STATUS !== (string) $playbook['status'] ) {
			return new WP_Error(
				'playbook_not_active',
				__( 'The source Playbook Master must be active before locking a snapshot.', 'pukat' ),
				[ 'status' => 422 ]
			);
		}

		$readiness_error = $this->validate_playbook_ready( $playbook );
		if ( $readiness_error ) {
			return $readiness_error;
		}

		if ( empty( $run['target_segment_id'] ) && empty( $run['target_group_name'] ) ) {
			return $this->validation_error( __( 'Target segment ID or target group name is required before locking a snapshot.', 'pukat' ) );
		}

		$snapshot = $this->build_snapshot( $run, $playbook );

		$this->repository->update(
			$id,
			[
				'playbook_version' => (int) $playbook['version'],
				'status'           => 'ready_for_sync',
				'snapshot_json'    => wp_json_encode( $snapshot ),
			]
		);

		AuditLogService::log(
			'campaign_run.snapshot_locked',
			[
				'campaign_run_id'    => $id,
				'playbook_master_id' => (int) $playbook['id'],
				'playbook_version'   => (int) $playbook['version'],
			],
			null,
			'campaign_run',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * Sync a locked Campaign Run snapshot to GoPhish.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function sync( int $id, int $user_id ): array|WP_Error {
		$run = $this->repository->find( $id );
		if ( ! $run ) {
			return $this->not_found_error( __( 'Campaign Run not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_run_editable( $run );
		if ( $permission_error ) {
			return $permission_error;
		}

		if ( empty( $run['snapshot_json'] ) ) {
			$locked = $this->lock_snapshot( $id, $user_id );
			if ( is_wp_error( $locked ) ) {
				return $locked;
			}
			$run = $this->repository->find( $id ) ?: $run;
		}

		if ( ! empty( $run['gophish_campaign_id'] ) ) {
			$this->repository->update(
				$id,
				[
					'status'          => 'synced',
					'sync_state_json' => wp_json_encode( $this->sync_state( $run, 'synced' ) ),
				]
			);

			return $this->get( $id ) ?: [];
		}

		if ( ! in_array( (string) $run['status'], [ 'ready_for_sync', 'sync_failed', 'syncing', 'synced' ], true ) ) {
			return new WP_Error(
				'campaign_run_not_ready',
				__( 'Campaign Run must have a locked snapshot before sync.', 'pukat' ),
				[ 'status' => 409 ]
			);
		}

		$connection = ( new GoPhishService() )->test_connection();
		if ( empty( $connection['success'] ) ) {
			$this->mark_sync_failed( $id, $run, 'connection', (string) ( $connection['message'] ?? __( 'GoPhish connection failed.', 'pukat' ) ) );
			return new WP_Error(
				'gophish_connection_failed',
				(string) ( $connection['message'] ?? __( 'GoPhish connection failed.', 'pukat' ) ),
				[ 'status' => 502 ]
			);
		}

		$sync_state = $this->sync_state( $run, 'syncing' );
		$sync_state['started_at'] = current_time( 'mysql' );
		$this->repository->update(
			$id,
			[
				'status'          => 'syncing',
				'sync_state_json' => wp_json_encode( $sync_state ),
			]
		);

		AuditLogService::log( 'campaign_run.sync_started', [ 'campaign_run_id' => $id ], null, 'campaign_run', $id );

		$run      = $this->repository->find( $id ) ?: $run;
		$snapshot = $this->snapshot_from_run( $run );
		if ( is_wp_error( $snapshot ) ) {
			return $snapshot;
		}
		$gp       = new GoPhishService();

		$email = $this->sync_email_template( $id, $run, $snapshot, $gp );
		if ( is_wp_error( $email ) ) {
			return $email;
		}
		$run = $this->repository->find( $id ) ?: $run;

		$page = $this->sync_landing_page( $id, $run, $snapshot, $gp );
		if ( is_wp_error( $page ) ) {
			return $page;
		}
		$run = $this->repository->find( $id ) ?: $run;

		$smtp = $this->resolve_sending_profile( $id, $run, $snapshot, $gp );
		if ( is_wp_error( $smtp ) ) {
			return $smtp;
		}
		$run = $this->repository->find( $id ) ?: $run;

		$group = $this->resolve_or_create_group( $id, $run, $snapshot, $gp );
		if ( is_wp_error( $group ) ) {
			return $group;
		}
		$run = $this->repository->find( $id ) ?: $run;

		$campaign = $this->sync_campaign( $id, $run, $snapshot, $gp, $email, $page, $smtp, $group );
		if ( is_wp_error( $campaign ) ) {
			return $campaign;
		}

		$sync_state                 = $this->sync_state( $this->repository->find( $id ) ?: $run, 'synced' );
		$sync_state['completed_at'] = current_time( 'mysql' );
		unset( $sync_state['error'] );

		$this->repository->update(
			$id,
			[
				'status'          => 'synced',
				'sync_state_json' => wp_json_encode( $sync_state ),
			]
		);

		AuditLogService::log(
			'campaign_run.sync_completed',
			[
				'campaign_run_id'     => $id,
				'gophish_campaign_id' => (int) $campaign['id'],
			],
			null,
			'campaign_run',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * Mark a synced Campaign Run as scheduled or running.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function launch( int $id, int $user_id ): array|WP_Error {
		$run = $this->repository->find( $id );
		if ( ! $run ) {
			return $this->not_found_error( __( 'Campaign Run not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_run_editable( $run );
		if ( $permission_error ) {
			return $permission_error;
		}

		if ( empty( $run['gophish_campaign_id'] ) ) {
			$synced = $this->sync( $id, $user_id );
			if ( is_wp_error( $synced ) ) {
				return $synced;
			}
			$run = $this->repository->find( $id ) ?: $run;
		}

		$status = $this->campaign_run_launch_status( $run );
		$this->repository->update(
			$id,
			[
				'status'      => $status,
				'launched_by' => $user_id,
				'launched_at' => current_time( 'mysql' ),
			]
		);

		AuditLogService::log(
			'campaign_run.launched',
			[
				'campaign_run_id'     => $id,
				'gophish_campaign_id' => (int) $run['gophish_campaign_id'],
				'status'              => $status,
			],
			null,
			'campaign_run',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * Cancel or stop a Campaign Run.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function cancel( int $id, int $user_id ): array|WP_Error {
		$run = $this->repository->find( $id );
		if ( ! $run ) {
			return $this->not_found_error( __( 'Campaign Run not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_run_editable( $run );
		if ( $permission_error ) {
			return $permission_error;
		}

		if ( ! empty( $run['gophish_campaign_id'] ) ) {
			$result = ( new GoPhishService() )->complete_campaign( (int) $run['gophish_campaign_id'] );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
		}

		$this->repository->update(
			$id,
			[
				'status'       => 'cancelled',
				'completed_at' => current_time( 'mysql' ),
			]
		);

		AuditLogService::log(
			'campaign_run.cancelled',
			[
				'campaign_run_id'     => $id,
				'gophish_campaign_id' => (int) ( $run['gophish_campaign_id'] ?? 0 ),
			],
			null,
			'campaign_run',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * Return GoPhish results for a synced Campaign Run.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function results( int $id ): array|WP_Error {
		$run = $this->repository->find( $id );
		if ( ! $run || ! $this->current_user_can_access_run( $run ) ) {
			return $this->not_found_error( __( 'Campaign Run not found.', 'pukat' ) );
		}

		if ( empty( $run['gophish_campaign_id'] ) ) {
			return [
				'results' => [],
				'metrics' => $this->decode_json_value( $run['metrics_json'] ?? null ),
				'message' => __( 'Campaign Run is not synced to GoPhish yet.', 'pukat' ),
			];
		}

		$results = ( new GoPhishService() )->get_campaign_results( (int) $run['gophish_campaign_id'] );
		if ( is_wp_error( $results ) ) {
			return $results;
		}

		return [
			'campaign_run_id'     => $id,
			'gophish_campaign_id' => (int) $run['gophish_campaign_id'],
			'metrics'             => $this->decode_json_value( $run['metrics_json'] ?? null ),
			'results'             => $results,
		];
	}

	/**
	 * Pull GoPhish results into Campaign Run metrics and risk scores.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function sync_results( int $id, int $user_id ): array|WP_Error {
		$run = $this->repository->find( $id );
		if ( ! $run ) {
			return $this->not_found_error( __( 'Campaign Run not found.', 'pukat' ) );
		}

		$permission_error = $this->enforce_existing_run_editable( $run );
		if ( $permission_error ) {
			return $permission_error;
		}

		return $this->sync_results_for_run( $run, $user_id );
	}

	/**
	 * Pull result metrics for all active Campaign Runs.
	 *
	 * @return array<string, mixed>
	 */
	public function sync_all_results( int $limit = 25 ): array {
		$summary = [
			'processed' => 0,
			'succeeded' => 0,
			'failed'    => 0,
			'errors'    => [],
		];

		foreach ( $this->repository->result_sync_candidates( $limit ) as $run ) {
			$summary['processed']++;
			$result = $this->sync_results_for_run( $run, 0 );
			if ( is_wp_error( $result ) ) {
				$summary['failed']++;
				$summary['errors'][] = [
					'campaign_run_id' => (int) ( $run['id'] ?? 0 ),
					'message'         => $result->get_error_message(),
				];
				continue;
			}

			$summary['succeeded']++;
		}

		return $summary;
	}

	/**
	 * Return stored report data for the Campaign Run flow.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function report( int $id ): array|WP_Error {
		$run = $this->repository->find( $id );
		if ( ! $run || ! $this->current_user_can_access_run( $run ) ) {
			return $this->not_found_error( __( 'Campaign Run not found.', 'pukat' ) );
		}

		return $this->report_from_run( $run );
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 * @return array<string, mixed>
	 */
	private function report_from_run( array $run ): array {
		$id           = (int) $run['id'];
		$metrics      = $this->decode_json_value( $run['metrics_json'] ?? null ) ?: [];
		$risk_summary = ( new RiskScoringService() )->get_campaign_run_summary( $id );
		$stats        = is_array( $metrics['stats'] ?? null ) ? $metrics['stats'] : $this->empty_result_stats();

		return [
			'campaign_run'  => $this->prepare_run( $run ),
			'gophish_stats' => $stats,
			'risk_summary'  => $risk_summary,
			'metrics'       => $metrics,
			'generated_at'  => current_time( 'mysql' ),
		];
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 * @return array<string, mixed>|WP_Error
	 */
	private function sync_results_for_run( array $run, int $user_id ): array|WP_Error {
		$id = (int) ( $run['id'] ?? 0 );
		if ( empty( $run['gophish_campaign_id'] ) ) {
			return new WP_Error(
				'campaign_run_not_synced',
				__( 'Campaign Run must be synced to GoPhish before results can be refreshed.', 'pukat' ),
				[ 'status' => 409 ]
			);
		}

		$results = ( new GoPhishService() )->get_campaign_results( (int) $run['gophish_campaign_id'] );
		if ( is_wp_error( $results ) ) {
			$this->mark_results_sync_failed( $id, $run, $results->get_error_message() );
			return $results;
		}

		$metrics = $this->build_result_metrics( $run, $results );
		$risk    = new RiskScoringService();
		$risk->delete_campaign_run_scores( $id );

		foreach ( $this->result_targets( $results ) as $target ) {
			$email = sanitize_email( (string) ( $target['email'] ?? '' ) );
			if ( ! is_email( $email ) ) {
				continue;
			}

			$risk->compute_and_store_for_campaign_run( $id, $email, $target );
		}

		$metrics['risk_summary'] = $risk->get_campaign_run_summary( $id );
		$status                 = $this->campaign_run_status_from_results( $run, $results );
		$update                 = [
			'status'       => $status,
			'metrics_json' => wp_json_encode( $metrics ),
		];

		if ( 'completed' === $status && empty( $run['completed_at'] ) ) {
			$update['completed_at'] = current_time( 'mysql' );
		}

		$this->repository->update( $id, $update );

		AuditLogService::log(
			'campaign_run.results_synced',
			[
				'campaign_run_id'     => $id,
				'gophish_campaign_id' => (int) $run['gophish_campaign_id'],
				'total_targets'       => (int) $metrics['stats']['total'],
				'user_id'             => $user_id,
			],
			null,
			'campaign_run',
			$id
		);

		return $this->report_from_run( $this->repository->find( $id ) ?: $run );
	}

	/**
	 * @param array<string, mixed> $run     Campaign Run row.
	 * @param array<string, mixed> $results GoPhish campaign results.
	 * @return array<string, mixed>
	 */
	private function build_result_metrics( array $run, array $results ): array {
		$stats = $this->aggregate_result_stats( $results );

		return [
			'source'              => 'gophish',
			'synced_at'           => current_time( 'mysql' ),
			'gophish_campaign_id' => (int) $run['gophish_campaign_id'],
			'gophish_status'      => sanitize_text_field( (string) ( $results['status'] ?? '' ) ),
			'stats'               => $stats,
			'status_counts'       => $stats['status_counts'],
			'timeline_counts'     => $stats['timeline_counts'],
		];
	}

	/**
	 * @param array<string, mixed> $results GoPhish campaign results.
	 * @return array<string, mixed>
	 */
	private function aggregate_result_stats( array $results ): array {
		$targets         = $this->result_targets( $results );
		$total           = count( $targets );
		$sent            = 0;
		$opened          = 0;
		$clicked         = 0;
		$submitted       = 0;
		$reported        = 0;
		$status_counts   = [];
		$timeline_counts = [];

		foreach ( $targets as $target ) {
			$status = sanitize_text_field( (string) ( $target['status'] ?? 'Unknown' ) );
			$status_counts[ $status ] = ( $status_counts[ $status ] ?? 0 ) + 1;

			$target_sent      = 'Unknown' !== $status;
			$target_opened    = false;
			$target_clicked   = false;
			$target_submitted = false;
			$target_reported  = false;

			foreach ( (array) ( $target['timeline'] ?? [] ) as $event ) {
				if ( ! is_array( $event ) ) {
					continue;
				}

				$message = sanitize_text_field( (string) ( $event['message'] ?? '' ) );
				if ( '' === $message ) {
					continue;
				}

				$timeline_counts[ $message ] = ( $timeline_counts[ $message ] ?? 0 ) + 1;

				if ( 'Email Sent' === $message ) {
					$target_sent = true;
				} elseif ( 'Email Opened' === $message ) {
					$target_opened = true;
				} elseif ( 'Clicked Link' === $message ) {
					$target_clicked = true;
				} elseif ( 'Submitted Data' === $message ) {
					$target_submitted = true;
				} elseif ( 'Email Reported' === $message ) {
					$target_reported = true;
				}
			}

			$sent      += $target_sent ? 1 : 0;
			$opened    += $target_opened ? 1 : 0;
			$clicked   += $target_clicked ? 1 : 0;
			$submitted += $target_submitted ? 1 : 0;
			$reported  += $target_reported ? 1 : 0;
		}

		return [
			'total'           => $total,
			'email_sent'      => $sent,
			'email_opened'    => $opened,
			'clicked'         => $clicked,
			'submitted_data'  => $submitted,
			'email_reported'  => $reported,
			'open_rate'       => $total > 0 ? round( ( $opened / $total ) * 100, 1 ) : 0,
			'click_rate'      => $total > 0 ? round( ( $clicked / $total ) * 100, 1 ) : 0,
			'submit_rate'     => $total > 0 ? round( ( $submitted / $total ) * 100, 1 ) : 0,
			'report_rate'     => $total > 0 ? round( ( $reported / $total ) * 100, 1 ) : 0,
			'status_counts'   => $status_counts,
			'timeline_counts' => $timeline_counts,
		];
	}

	/**
	 * @param array<string, mixed> $results GoPhish campaign results.
	 * @return array<int, array<string, mixed>>
	 */
	private function result_targets( array $results ): array {
		$targets = $results['results'] ?? [];

		return is_array( $targets ) ? array_values( array_filter( $targets, 'is_array' ) ) : [];
	}

	/**
	 * @return array<string, mixed>
	 */
	private function empty_result_stats(): array {
		return [
			'total'           => 0,
			'email_sent'      => 0,
			'email_opened'    => 0,
			'clicked'         => 0,
			'submitted_data'  => 0,
			'email_reported'  => 0,
			'open_rate'       => 0,
			'click_rate'      => 0,
			'submit_rate'     => 0,
			'report_rate'     => 0,
			'status_counts'   => [],
			'timeline_counts' => [],
		];
	}

	/**
	 * @param array<string, mixed> $run     Campaign Run row.
	 * @param array<string, mixed> $results GoPhish campaign results.
	 */
	private function campaign_run_status_from_results( array $run, array $results ): string {
		$status = strtolower( sanitize_text_field( (string) ( $results['status'] ?? '' ) ) );

		if ( str_contains( $status, 'complete' ) ) {
			return 'completed';
		}

		if ( str_contains( $status, 'progress' ) || str_contains( $status, 'running' ) || str_contains( $status, 'sending' ) ) {
			return 'running';
		}

		if ( str_contains( $status, 'scheduled' ) || str_contains( $status, 'queued' ) ) {
			return 'scheduled';
		}

		return (string) ( $run['status'] ?? 'synced' );
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 */
	private function mark_results_sync_failed( int $id, array $run, string $message ): void {
		$metrics                  = $this->decode_json_value( $run['metrics_json'] ?? null ) ?: [];
		$metrics['result_sync']   = [
			'status'    => 'failed',
			'message'   => $message,
			'failed_at' => current_time( 'mysql' ),
		];

		$this->repository->update( $id, [ 'metrics_json' => wp_json_encode( $metrics ) ] );

		AuditLogService::log(
			'campaign_run.results_sync_failed',
			[ 'campaign_run_id' => $id, 'message' => $message ],
			null,
			'campaign_run',
			$id
		);
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 * @return array<string, mixed>|WP_Error
	 */
	private function snapshot_from_run( array $run ): array|WP_Error {
		$snapshot = json_decode( (string) ( $run['snapshot_json'] ?? '' ), true );
		if ( ! is_array( $snapshot ) || empty( $snapshot ) ) {
			return $this->validation_error( __( 'Campaign Run snapshot is missing or invalid.', 'pukat' ) );
		}

		return $snapshot;
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 * @return array<string, mixed>
	 */
	private function sync_state( array $run, string $status ): array {
		$state = json_decode( (string) ( $run['sync_state_json'] ?? '' ), true );
		if ( ! is_array( $state ) ) {
			$state = [];
		}

		$state['status'] = $status;
		if ( empty( $state['steps'] ) || ! is_array( $state['steps'] ) ) {
			$state['steps'] = [];
		}

		return $state;
	}

	/**
	 * @param array<string, mixed> $run      Campaign Run row.
	 * @param array<string, mixed> $snapshot Locked snapshot.
	 * @return array{id: int, name: string}|WP_Error
	 */
	private function sync_email_template( int $id, array $run, array $snapshot, GoPhishService $gp ): array|WP_Error {
		$email = $snapshot['email_template'] ?? null;
		if ( ! is_array( $email ) ) {
			return $this->mark_sync_failed( $id, $run, 'email_template', __( 'Email template snapshot is missing.', 'pukat' ) );
		}

		$name = $this->snapshot_asset_name( $id, (string) $run['name'], 'Email' );
		if ( ! empty( $run['gophish_template_id'] ) ) {
			$template = $gp->get_email_template( (int) $run['gophish_template_id'] );
			if ( is_wp_error( $template ) ) {
				return $this->mark_sync_failed_from_error( $id, $run, 'email_template', $template );
			}

			$template_name = sanitize_text_field( (string) ( $template['name'] ?? $name ) );
			$this->update_sync_step( $id, $run, 'email_template', [ 'gophish_id' => (int) $run['gophish_template_id'], 'name' => $template_name ] );
			return [ 'id' => (int) $run['gophish_template_id'], 'name' => $template_name ];
		}

		$existing = $this->find_gophish_asset_by_name( $gp->get_email_templates(), $name, 'email_template' );
		if ( is_wp_error( $existing ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'email_template', $existing );
		}

		if ( $existing ) {
			$gophish_id = (int) $existing['id'];
			$this->repository->update( $id, [ 'gophish_template_id' => $gophish_id ] );
			$this->update_sync_step( $id, $run, 'email_template', [ 'gophish_id' => $gophish_id, 'name' => $name, 'reused' => true ] );
			return [ 'id' => $gophish_id, 'name' => $name ];
		}

		$result = $gp->create_email_template(
			[
				'name'        => $name,
				'subject'     => sanitize_text_field( (string) ( $email['subject'] ?? '' ) ),
				'html'        => (string) ( $email['html_body'] ?? '' ),
				'text'        => (string) ( $email['text_body'] ?? '' ),
				'attachments' => [],
			]
		);
		if ( is_wp_error( $result ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'email_template', $result );
		}

		$gophish_id = (int) ( $result['id'] ?? 0 );
		$this->repository->update( $id, [ 'gophish_template_id' => $gophish_id ] );
		$this->update_sync_step( $id, $run, 'email_template', [ 'gophish_id' => $gophish_id, 'name' => $name ] );

		return [ 'id' => $gophish_id, 'name' => $name ];
	}

	/**
	 * @param array<string, mixed> $run      Campaign Run row.
	 * @param array<string, mixed> $snapshot Locked snapshot.
	 * @return array{id: int, name: string}|WP_Error
	 */
	private function sync_landing_page( int $id, array $run, array $snapshot, GoPhishService $gp ): array|WP_Error {
		$page = $snapshot['landing_page'] ?? null;
		if ( ! is_array( $page ) ) {
			return $this->mark_sync_failed( $id, $run, 'landing_page', __( 'Landing page snapshot is missing.', 'pukat' ) );
		}

		$name = $this->snapshot_asset_name( $id, (string) $run['name'], 'Landing Page' );
		if ( ! empty( $run['gophish_page_id'] ) ) {
			$landing_page = $gp->get_landing_page( (int) $run['gophish_page_id'] );
			if ( is_wp_error( $landing_page ) ) {
				return $this->mark_sync_failed_from_error( $id, $run, 'landing_page', $landing_page );
			}

			$page_name = sanitize_text_field( (string) ( $landing_page['name'] ?? $name ) );
			$this->update_sync_step( $id, $run, 'landing_page', [ 'gophish_id' => (int) $run['gophish_page_id'], 'name' => $page_name ] );
			return [ 'id' => (int) $run['gophish_page_id'], 'name' => $page_name ];
		}

		$existing = $this->find_gophish_asset_by_name( $gp->get_landing_pages(), $name, 'landing_page' );
		if ( is_wp_error( $existing ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'landing_page', $existing );
		}

		if ( $existing ) {
			$gophish_id = (int) $existing['id'];
			$this->repository->update( $id, [ 'gophish_page_id' => $gophish_id ] );
			$this->update_sync_step( $id, $run, 'landing_page', [ 'gophish_id' => $gophish_id, 'name' => $name, 'reused' => true ] );
			return [ 'id' => $gophish_id, 'name' => $name ];
		}

		$capture_settings = is_array( $page['capture_settings'] ?? null ) ? $page['capture_settings'] : [];
		$result           = $gp->create_landing_page(
			[
				'name'                => $name,
				'html'                => (string) ( $page['html_body'] ?? '' ),
				'capture_credentials' => (bool) ( $capture_settings['capture_credentials'] ?? false ),
				'capture_passwords'   => false,
				'redirect_url'        => esc_url_raw( (string) ( $page['redirect_settings']['redirect_url'] ?? '' ) ),
			]
		);
		if ( is_wp_error( $result ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'landing_page', $result );
		}

		$gophish_id = (int) ( $result['id'] ?? 0 );
		$this->repository->update( $id, [ 'gophish_page_id' => $gophish_id ] );
		$this->update_sync_step( $id, $run, 'landing_page', [ 'gophish_id' => $gophish_id, 'name' => $name ] );

		return [ 'id' => $gophish_id, 'name' => $name ];
	}

	/**
	 * @param array<string, mixed> $run      Campaign Run row.
	 * @param array<string, mixed> $snapshot Locked snapshot.
	 * @return array{id: int, name: string}|WP_Error
	 */
	private function resolve_sending_profile( int $id, array $run, array $snapshot, GoPhishService $gp ): array|WP_Error {
		$sending = $snapshot['sending_profile'] ?? null;
		if ( ! is_array( $sending ) ) {
			return $this->mark_sync_failed( $id, $run, 'sending_profile', __( 'Sending profile snapshot is missing.', 'pukat' ) );
		}

		$gophish_id = (int) ( $run['gophish_sending_profile_id'] ?: $sending['gophish_sending_profile_id'] ?? 0 );
		if ( ! $gophish_id ) {
			return $this->mark_sync_failed( $id, $run, 'sending_profile', __( 'GoPhish sending profile ID is missing.', 'pukat' ) );
		}

		$result = $gp->get_sending_profile( $gophish_id );
		if ( is_wp_error( $result ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'sending_profile', $result );
		}

		$name = sanitize_text_field( (string) ( $result['name'] ?? $sending['name'] ?? "Sending Profile {$gophish_id}" ) );
		$this->repository->update( $id, [ 'gophish_sending_profile_id' => $gophish_id ] );
		$this->update_sync_step( $id, $run, 'sending_profile', [ 'gophish_id' => $gophish_id, 'name' => $name ] );

		return [ 'id' => $gophish_id, 'name' => $name ];
	}

	/**
	 * @param array<string, mixed> $run      Campaign Run row.
	 * @param array<string, mixed> $snapshot Locked snapshot.
	 * @return array{id: int, name: string}|WP_Error
	 */
	private function resolve_or_create_group( int $id, array $run, array $snapshot, GoPhishService $gp ): array|WP_Error {
		$target = is_array( $snapshot['target'] ?? null ) ? $snapshot['target'] : [];
		$name   = sanitize_text_field( (string) ( $target['target_group_name'] ?? $run['target_group_name'] ?? '' ) );
		if ( '' === $name ) {
			$name = "Pukat Run #{$id} Targets";
		}

		if ( ! empty( $run['gophish_group_id'] ) ) {
			$this->update_sync_step( $id, $run, 'target_group', [ 'gophish_id' => (int) $run['gophish_group_id'], 'name' => $name ] );
			return [ 'id' => (int) $run['gophish_group_id'], 'name' => $name ];
		}

		$existing = $this->find_gophish_asset_by_name( $gp->get_groups(), $name, 'target_group' );
		if ( is_wp_error( $existing ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'target_group', $existing );
		}

		if ( $existing ) {
			$gophish_id = (int) $existing['id'];
			$this->repository->update( $id, [ 'gophish_group_id' => $gophish_id ] );
			$this->update_sync_step( $id, $run, 'target_group', [ 'gophish_id' => $gophish_id, 'name' => $name, 'reused' => true ] );
			return [ 'id' => $gophish_id, 'name' => $name ];
		}

		$targets = $this->snapshot_targets( $target );
		if ( empty( $targets ) ) {
			return $this->mark_sync_failed( $id, $run, 'target_group', __( 'Target group was not found in GoPhish, and no target snapshot is available to create it.', 'pukat' ) );
		}

		$result = $gp->create_group( [ 'name' => $name, 'targets' => $targets ] );
		if ( is_wp_error( $result ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'target_group', $result );
		}

		$gophish_id = (int) ( $result['id'] ?? 0 );
		$this->repository->update( $id, [ 'gophish_group_id' => $gophish_id ] );
		$this->update_sync_step( $id, $run, 'target_group', [ 'gophish_id' => $gophish_id, 'name' => $name ] );

		return [ 'id' => $gophish_id, 'name' => $name ];
	}

	/**
	 * @param array<string, mixed> $run      Campaign Run row.
	 * @param array<string, mixed> $snapshot Locked snapshot.
	 * @param array{id: int, name: string} $email Synced email template.
	 * @param array{id: int, name: string} $page Synced landing page.
	 * @param array{id: int, name: string} $smtp Resolved sending profile.
	 * @param array{id: int, name: string} $group Resolved target group.
	 * @return array{id: int, name: string}|WP_Error
	 */
	private function sync_campaign( int $id, array $run, array $snapshot, GoPhishService $gp, array $email, array $page, array $smtp, array $group ): array|WP_Error {
		$name = $this->snapshot_asset_name( $id, (string) $run['name'], 'Campaign' );
		if ( ! empty( $run['gophish_campaign_id'] ) ) {
			$campaign = $gp->get_campaign( (int) $run['gophish_campaign_id'] );
			if ( is_wp_error( $campaign ) ) {
				return $this->mark_sync_failed_from_error( $id, $run, 'campaign', $campaign );
			}

			$campaign_name = sanitize_text_field( (string) ( $campaign['name'] ?? $name ) );
			$this->update_sync_step( $id, $run, 'campaign', [ 'gophish_id' => (int) $run['gophish_campaign_id'], 'name' => $campaign_name ] );
			return [ 'id' => (int) $run['gophish_campaign_id'], 'name' => $campaign_name ];
		}

		$existing = $this->find_gophish_asset_by_name( $gp->get_campaigns(), $name, 'campaign' );
		if ( is_wp_error( $existing ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'campaign', $existing );
		}

		if ( $existing ) {
			$gophish_id = (int) $existing['id'];
			$this->repository->update( $id, [ 'gophish_campaign_id' => $gophish_id ] );
			$this->update_sync_step( $id, $run, 'campaign', [ 'gophish_id' => $gophish_id, 'name' => $name, 'reused' => true ] );
			return [ 'id' => $gophish_id, 'name' => $name ];
		}

		$url    = $this->campaign_url_from_snapshot( $snapshot );
		$result = $gp->create_campaign(
			[
				'name'         => $name,
				'template'     => [ 'name' => $email['name'] ],
				'url'          => $url,
				'page'         => [ 'name' => $page['name'] ],
				'smtp'         => [ 'name' => $smtp['name'] ],
				'launch_date'  => $this->format_gophish_datetime( $run['schedule_at'] ?? null ),
				'send_by_date' => null,
				'groups'       => [ [ 'name' => $group['name'] ] ],
			]
		);
		if ( is_wp_error( $result ) ) {
			return $this->mark_sync_failed_from_error( $id, $run, 'campaign', $result );
		}

		$gophish_id = (int) ( $result['id'] ?? 0 );
		$this->repository->update( $id, [ 'gophish_campaign_id' => $gophish_id ] );
		$this->update_sync_step( $id, $run, 'campaign', [ 'gophish_id' => $gophish_id, 'name' => $name ] );

		return [ 'id' => $gophish_id, 'name' => $name ];
	}

	/**
	 * @param array<int, array<string, mixed>>|WP_Error $items GoPhish list result.
	 * @return array<string, mixed>|null|WP_Error
	 */
	private function find_gophish_asset_by_name( array|WP_Error $items, string $name, string $step ): array|null|WP_Error {
		if ( is_wp_error( $items ) ) {
			return $items;
		}

		foreach ( $items as $item ) {
			if ( $name === (string) ( $item['name'] ?? '' ) ) {
				return $item;
			}
		}

		return null;
	}

	/**
	 * @param array<string, mixed> $run  Campaign Run row.
	 * @param array<string, mixed> $data Step metadata.
	 */
	private function update_sync_step( int $id, array $run, string $step, array $data ): void {
		$current = $this->repository->find( $id ) ?: $run;
		$state   = $this->sync_state( $current, 'syncing' );

		$state['steps'][ $step ] = array_merge(
			[
				'status'     => 'completed',
				'updated_at' => current_time( 'mysql' ),
			],
			$data
		);

		$this->repository->update( $id, [ 'sync_state_json' => wp_json_encode( $state ) ] );

		AuditLogService::log(
			'campaign_run.sync_step_completed',
			[ 'campaign_run_id' => $id, 'step' => $step ] + $data,
			null,
			'campaign_run',
			$id
		);
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 */
	private function mark_sync_failed( int $id, array $run, string $step, string $message ): WP_Error {
		$current = $this->repository->find( $id ) ?: $run;
		$state   = $this->sync_state( $current, 'failed' );

		$state['failed_at'] = current_time( 'mysql' );
		$state['error']     = [
			'step'    => $step,
			'message' => $message,
		];
		$state['steps'][ $step ] = [
			'status'     => 'failed',
			'message'    => $message,
			'updated_at' => current_time( 'mysql' ),
		];

		$this->repository->update(
			$id,
			[
				'status'          => 'sync_failed',
				'sync_state_json' => wp_json_encode( $state ),
			]
		);

		AuditLogService::log(
			'campaign_run.sync_failed',
			[ 'campaign_run_id' => $id, 'step' => $step, 'message' => $message ],
			null,
			'campaign_run',
			$id
		);

		return new WP_Error( 'campaign_run_sync_failed', $message, [ 'status' => 422, 'step' => $step ] );
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 */
	private function mark_sync_failed_from_error( int $id, array $run, string $step, WP_Error $error ): WP_Error {
		$this->mark_sync_failed( $id, $run, $step, $error->get_error_message() );

		return $error;
	}

	private function snapshot_asset_name( int $id, string $run_name, string $type ): string {
		return sanitize_text_field( "[Pukat Run #{$id}] {$run_name} {$type}" );
	}

	/**
	 * @param array<string, mixed> $target Snapshot target block.
	 * @return array<int, array<string, string>>
	 */
	private function snapshot_targets( array $target ): array {
		$targets = [];
		foreach ( (array) ( $target['targets'] ?? [] ) as $target_row ) {
			if ( ! is_array( $target_row ) || empty( $target_row['email'] ) || ! is_email( $target_row['email'] ) ) {
				continue;
			}

			$targets[] = [
				'first_name' => sanitize_text_field( (string) ( $target_row['first_name'] ?? '' ) ),
				'last_name'  => sanitize_text_field( (string) ( $target_row['last_name'] ?? '' ) ),
				'email'      => sanitize_email( (string) $target_row['email'] ),
				'position'   => sanitize_text_field( (string) ( $target_row['position'] ?? '' ) ),
			];
		}

		return $targets;
	}

	/**
	 * @param array<string, mixed> $snapshot Locked snapshot.
	 */
	private function campaign_url_from_snapshot( array $snapshot ): string {
		$domain = is_array( $snapshot['dynamic_domain'] ?? null ) ? $snapshot['dynamic_domain'] : [];
		$url    = (string) ( $domain['base_landing_url'] ?? $domain['tracking_url'] ?? '' );

		return $url ? esc_url_raw( $url ) : home_url();
	}

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

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 */
	private function campaign_run_launch_status( array $run ): string {
		$schedule_at = (string) ( $run['schedule_at'] ?? '' );
		if ( '' !== $schedule_at ) {
			$timestamp = strtotime( $schedule_at );
			if ( false !== $timestamp && $timestamp > time() ) {
				return 'scheduled';
			}
		}

		return 'running';
	}

	/**
	 * @param array<string, mixed> $run DB row.
	 * @return array<string, mixed>
	 */
	private function prepare_run( array $run ): array {
		$playbook = $this->repository->find_playbook_master( (int) $run['playbook_master_id'] );

		$run = $this->decode_json_fields(
			$run,
			[
				'snapshot_json'   => 'snapshot',
				'sync_state_json' => 'sync_state',
				'metrics_json'    => 'metrics',
			]
		);

		$run['source_playbook'] = $playbook ? [
			'id'       => (int) $playbook['id'],
			'name'     => (string) $playbook['name'],
			'version'  => (int) $playbook['version'],
			'status'   => (string) $playbook['status'],
			'entity'   => (string) $playbook['entity'],
		] : null;

		$run['snapshot_locked'] = ! empty( $run['snapshot_json'] );

		return $run;
	}

	/**
	 * @param array<string, mixed> $run      Campaign Run row.
	 * @param array<string, mixed> $playbook Playbook Master row.
	 * @return array<string, mixed>
	 */
	private function build_snapshot( array $run, array $playbook ): array {
		$email   = $this->repository->find_component( 'email_template_versions', (int) $playbook['default_email_template_version_id'] );
		$landing = $this->repository->find_component( 'landing_page_versions', (int) $playbook['default_landing_page_version_id'] );
		$sending = $this->repository->find_component( 'sending_profile_refs', (int) $playbook['default_sending_profile_ref_id'] );
		$domain  = ! empty( $playbook['default_dynamic_domain_id'] )
			? $this->repository->find_component( 'dynamic_domains', (int) $playbook['default_dynamic_domain_id'] )
			: null;

		return [
			'locked_at' => current_time( 'mysql' ),
			'playbook' => $this->decode_json_fields(
				[
					'id'                 => (int) $playbook['id'],
					'name'               => (string) $playbook['name'],
					'version'            => (int) $playbook['version'],
					'description'        => (string) ( $playbook['description'] ?? '' ),
					'objective'          => (string) ( $playbook['objective'] ?? '' ),
					'scenario'           => (string) ( $playbook['scenario'] ?? '' ),
					'difficulty'         => (int) ( $playbook['difficulty'] ?? 1 ),
					'risk_level'         => (string) ( $playbook['risk_level'] ?? '' ),
					'entity'             => (string) ( $playbook['entity'] ?? self::GENERAL_ENTITY ),
					'rules_json'         => $playbook['rules_json'] ?? null,
					'metrics_json'       => $playbook['metrics_json'] ?? null,
					'allowed_overrides_json' => $playbook['allowed_overrides_json'] ?? null,
				],
				[
					'rules_json'             => 'rules',
					'metrics_json'           => 'metrics',
					'allowed_overrides_json' => 'allowed_overrides',
				]
			),
			'email_template' => $email ? $this->decode_json_fields(
				[
					'master_id'  => (int) $email['template_master_id'],
					'version_id' => (int) $email['id'],
					'version'    => (int) $email['version'],
					'subject'    => (string) $email['subject'],
					'html_body'  => (string) $email['html_body'],
					'text_body'  => (string) ( $email['text_body'] ?? '' ),
					'language'   => (string) ( $email['language'] ?? '' ),
					'status'     => (string) $email['status'],
					'variables_json' => $email['variables_json'] ?? null,
				],
				[ 'variables_json' => 'variables' ]
			) : null,
			'landing_page' => $landing ? $this->decode_json_fields(
				[
					'master_id'  => (int) $landing['landing_page_master_id'],
					'version_id' => (int) $landing['id'],
					'version'    => (int) $landing['version'],
					'html_body'  => (string) $landing['html_body'],
					'language'   => (string) ( $landing['language'] ?? '' ),
					'status'     => (string) $landing['status'],
					'capture_settings_json'  => $landing['capture_settings_json'] ?? null,
					'redirect_settings_json' => $landing['redirect_settings_json'] ?? null,
					'variables_json'         => $landing['variables_json'] ?? null,
				],
				[
					'capture_settings_json'  => 'capture_settings',
					'redirect_settings_json' => 'redirect_settings',
					'variables_json'         => 'variables',
				]
			) : null,
			'sending_profile' => $sending ? $this->decode_json_fields(
				[
					'ref_id'                     => (int) $sending['id'],
					'name'                       => (string) $sending['name'],
					'from_name'                  => (string) ( $sending['from_name'] ?? '' ),
					'from_email'                 => (string) $sending['from_email'],
					'reply_to'                   => (string) ( $sending['reply_to'] ?? '' ),
					'gophish_sending_profile_id' => (int) $sending['gophish_sending_profile_id'],
					'environment'                => (string) $sending['environment'],
					'status'                     => (string) $sending['status'],
					'allowed_domains_json'       => $sending['allowed_domains_json'] ?? null,
					'rate_limit_json'            => $sending['rate_limit_json'] ?? null,
				],
				[
					'allowed_domains_json' => 'allowed_domains',
					'rate_limit_json'      => 'rate_limit',
				]
			) : null,
			'dynamic_domain' => $domain ? $this->decode_json_fields(
				[
					'id'                    => (int) $domain['id'],
					'domain'                => (string) $domain['domain'],
					'base_landing_url'      => (string) ( $domain['base_landing_url'] ?? '' ),
					'tracking_url'          => (string) ( $domain['tracking_url'] ?? '' ),
					'environment'           => (string) $domain['environment'],
					'owner_entity'          => (string) $domain['owner_entity'],
					'authorization_status'  => (string) $domain['authorization_status'],
					'dns_status'            => (string) $domain['dns_status'],
					'tls_status'            => (string) $domain['tls_status'],
					'status'                => (string) $domain['status'],
					'allowed_playbooks_json'        => $domain['allowed_playbooks_json'] ?? null,
					'allowed_sending_profiles_json' => $domain['allowed_sending_profiles_json'] ?? null,
				],
				[
					'allowed_playbooks_json'        => 'allowed_playbooks',
					'allowed_sending_profiles_json' => 'allowed_sending_profiles',
				]
			) : null,
			'target' => [
				'target_segment_id' => (int) ( $run['target_segment_id'] ?? 0 ) ?: null,
				'target_group_name' => (string) ( $run['target_group_name'] ?? '' ),
			],
			'schedule' => [
				'schedule_at' => $run['schedule_at'] ?? null,
				'timezone'    => (string) ( $run['timezone'] ?? 'UTC' ),
			],
		];
	}

	/**
	 * @param array<string, mixed> $playbook Playbook Master row.
	 */
	private function validate_playbook_ready( array $playbook ): ?WP_Error {
		$errors = [];

		$email = $this->repository->find_component( 'email_template_versions', (int) ( $playbook['default_email_template_version_id'] ?? 0 ) );
		if ( ! $email ) {
			$errors[] = __( 'Default email template version was not found.', 'pukat' );
		} elseif ( ! in_array( (string) $email['status'], self::COMPONENT_READY_STATUSES, true ) ) {
			$errors[] = __( 'Default email template version must be approved or active.', 'pukat' );
		}

		$landing = $this->repository->find_component( 'landing_page_versions', (int) ( $playbook['default_landing_page_version_id'] ?? 0 ) );
		if ( ! $landing ) {
			$errors[] = __( 'Default landing page version was not found.', 'pukat' );
		} elseif ( ! in_array( (string) $landing['status'], self::COMPONENT_READY_STATUSES, true ) ) {
			$errors[] = __( 'Default landing page version must be approved or active.', 'pukat' );
		}

		$sending = $this->repository->find_component( 'sending_profile_refs', (int) ( $playbook['default_sending_profile_ref_id'] ?? 0 ) );
		if ( ! $sending ) {
			$errors[] = __( 'Default sending profile reference was not found.', 'pukat' );
		} elseif ( 'active' !== (string) $sending['status'] ) {
			$errors[] = __( 'Default sending profile reference must be active.', 'pukat' );
		} elseif ( empty( $sending['gophish_sending_profile_id'] ) ) {
			$errors[] = __( 'Default sending profile reference must map to a GoPhish sending profile ID.', 'pukat' );
		}

		if ( ! empty( $playbook['default_dynamic_domain_id'] ) ) {
			$domain = $this->repository->find_component( 'dynamic_domains', (int) $playbook['default_dynamic_domain_id'] );
			if ( ! $domain ) {
				$errors[] = __( 'Default dynamic domain was not found.', 'pukat' );
			} elseif ( 'active' !== (string) $domain['status'] ) {
				$errors[] = __( 'Default dynamic domain must be active.', 'pukat' );
			} elseif ( 'authorized' !== (string) $domain['authorization_status'] ) {
				$errors[] = __( 'Default dynamic domain must be authorized.', 'pukat' );
			}
		}

		if ( empty( $errors ) ) {
			return null;
		}

		return new WP_Error(
			'playbook_not_ready',
			__( 'Playbook Master is not ready to create or lock a Campaign Run.', 'pukat' ),
			[
				'status' => 422,
				'errors' => $errors,
			]
		);
	}

	private function sanitize_datetime( string $datetime ): ?string {
		$datetime = trim( sanitize_text_field( $datetime ) );
		if ( '' === $datetime ) {
			return null;
		}

		$timestamp = strtotime( $datetime );
		if ( false === $timestamp ) {
			return null;
		}

		return gmdate( 'Y-m-d H:i:s', $timestamp );
	}

	private function sanitize_timezone( string $timezone ): string {
		$timezone = sanitize_text_field( $timezone );

		return in_array( $timezone, timezone_identifiers_list(), true ) ? $timezone : 'UTC';
	}

	/**
	 * @param array<string, mixed> $params Raw request params.
	 */
	private function json_value( array $params, string $input_key, string $db_key ): ?string {
		if ( ! array_key_exists( $input_key, $params ) && ! array_key_exists( $db_key, $params ) ) {
			return null;
		}

		$value = array_key_exists( $input_key, $params ) ? $params[ $input_key ] : $params[ $db_key ];
		if ( null === $value || '' === $value ) {
			return null;
		}

		if ( is_string( $value ) ) {
			$decoded = json_decode( $value, true );
			if ( JSON_ERROR_NONE === json_last_error() ) {
				return wp_json_encode( $decoded );
			}
		}

		return wp_json_encode( $value );
	}

	/**
	 * @param array<int, array<string, mixed>> $runs DB rows.
	 * @return array<int, array<string, mixed>>
	 */
	private function filter_runs_for_current_user( array $runs ): array {
		return array_values( array_filter(
			$runs,
			[ $this, 'current_user_can_access_run' ]
		) );
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 */
	private function current_user_can_access_run( array $run ): bool {
		$playbook = $this->repository->find_playbook_master( (int) ( $run['playbook_master_id'] ?? 0 ) );

		return $playbook ? $this->current_user_can_access_playbook( $playbook ) : $this->current_user_can_admin_assets();
	}

	/**
	 * @param array<string, mixed> $run Campaign Run row.
	 */
	private function enforce_existing_run_editable( array $run ): ?WP_Error {
		$playbook = $this->repository->find_playbook_master( (int) ( $run['playbook_master_id'] ?? 0 ) );
		if ( ! $playbook ) {
			return $this->not_found_error( __( 'Source Playbook Master not found.', 'pukat' ) );
		}

		return $this->enforce_existing_playbook_editable( $playbook );
	}

	/**
	 * @param array<string, mixed> $playbook Playbook Master row.
	 */
	private function enforce_existing_playbook_editable( array $playbook ): ?WP_Error {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$user_entity     = strtolower( $this->current_user_entity() );
		$playbook_entity = strtolower( trim( (string) ( $playbook['entity'] ?? '' ) ) );

		if ( '' !== $user_entity && '' !== $playbook_entity && strtolower( self::GENERAL_ENTITY ) !== $playbook_entity && $playbook_entity === $user_entity ) {
			return null;
		}

		return $this->forbidden_error( __( 'General Campaign Runs and Campaign Runs from other entities can only be edited by admins.', 'pukat' ) );
	}

	/**
	 * @param array<string, mixed> $playbook Playbook Master row.
	 */
	private function current_user_can_access_playbook( array $playbook ): bool {
		if ( $this->current_user_can_admin_assets() ) {
			return true;
		}

		$playbook_entity = strtolower( trim( (string) ( $playbook['entity'] ?? '' ) ) );
		if ( strtolower( self::GENERAL_ENTITY ) === $playbook_entity ) {
			return true;
		}

		$user_entity = strtolower( $this->current_user_entity() );

		return '' !== $user_entity && $playbook_entity === $user_entity;
	}

	/**
	 * @return mixed
	 */
	private function decode_json_value( mixed $value ): mixed {
		if ( null === $value || '' === $value ) {
			return null;
		}

		if ( is_array( $value ) ) {
			return $value;
		}

		$decoded = json_decode( (string) $value, true );

		return JSON_ERROR_NONE === json_last_error() ? $decoded : null;
	}

	/**
	 * @param array<string, mixed> $row    DB row.
	 * @param array<string, string> $fields Map db_json_field => decoded_output_field.
	 * @return array<string, mixed>
	 */
	private function decode_json_fields( array $row, array $fields ): array {
		foreach ( $fields as $db_key => $output_key ) {
			$row[ $output_key ] = null;
			if ( ! empty( $row[ $db_key ] ) ) {
				$decoded            = json_decode( (string) $row[ $db_key ], true );
				$row[ $output_key ] = JSON_ERROR_NONE === json_last_error() ? $decoded : null;
			}
		}

		return $row;
	}

	private function current_user_can_admin_assets(): bool {
		return current_user_can( 'pukat_manage_settings' ) || current_user_can( 'administrator' );
	}

	private function current_user_entity(): string {
		$user_id = get_current_user_id();
		$entity  = (string) get_user_meta( $user_id, 'entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
	}

	private function validation_error( string $message ): WP_Error {
		return new WP_Error( 'validation_error', $message, [ 'status' => 422 ] );
	}

	private function not_found_error( string $message ): WP_Error {
		return new WP_Error( 'not_found', $message, [ 'status' => 404 ] );
	}

	private function forbidden_error( string $message ): WP_Error {
		return new WP_Error( 'entity_forbidden', $message, [ 'status' => 403 ] );
	}

	private function db_error( string $message ): WP_Error {
		return new WP_Error( 'db_error', $message, [ 'status' => 500 ] );
	}
}
