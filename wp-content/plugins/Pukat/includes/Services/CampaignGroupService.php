<?php
/**
 * Campaign Group business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\CampaignGroupRepository;
use Pukat\Repositories\CampaignRunRepository;
use WP_Error;

/**
 * Organizational grouping for Campaign Runs — used to filter the Monitoring
 * dashboard and the Manage Campaigns page. One group per Campaign Run
 * (folder-style), unrelated to GoPhish's own "target group" (recipient
 * list). See docs/PRD_CAMPAIGN_GROUP_MONITORING.md.
 *
 * `entity` is always server-assigned from the creator and never accepted
 * from the client (§8 of the PRD — prevents entity spoofing). `status`
 * (Active/Selesai) is never stored — it's computed from member Campaign Run
 * statuses on every read (§7.2 FR-5), so it can never go stale.
 */
class CampaignGroupService {

	/** Statuses a Campaign Run is considered "done" at — see compute_status(). */
	private const TERMINAL_RUN_STATUSES = [ 'completed', 'cancelled' ];

	private CampaignGroupRepository $repository;
	private CampaignRunRepository $campaign_runs;

	public function __construct( ?CampaignGroupRepository $repository = null, ?CampaignRunRepository $campaign_runs = null ) {
		$this->repository    = $repository ?? new CampaignGroupRepository();
		$this->campaign_runs = $campaign_runs ?? new CampaignRunRepository();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list(): array {
		$all_runs = $this->campaign_runs->all();

		return array_values( array_map(
			fn ( array $group ): array => $this->prepare_group( $group, $this->runs_for_group( $all_runs, (int) $group['id'] ) ),
			array_filter( $this->repository->all(), [ $this, 'current_user_can_access_group' ] )
		) );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get( int $id ): ?array {
		$group = $this->repository->find( $id );
		if ( ! $group || ! $this->current_user_can_access_group( $group ) ) {
			return null;
		}

		return $this->prepare_group( $group, $this->runs_for_group( $this->campaign_runs->all(), $id ) );
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters. `entity` is
	 *                                     deliberately never read from here.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
		$name = sanitize_text_field( (string) ( $params['name'] ?? '' ) );
		if ( '' === trim( $name ) ) {
			return $this->validation_error( __( 'Campaign Group name is required.', 'pukat' ) );
		}

		$id = $this->repository->create( [
			'name'        => $name,
			'description' => sanitize_textarea_field( (string) ( $params['description'] ?? '' ) ) ?: null,
			'entity'      => $this->user_entity( $user_id ),
			'created_by'  => $user_id,
		] );

		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create Campaign Group.', 'pukat' ) );
		}

		AuditLogService::log(
			'campaign_group.created',
			[ 'campaign_group_id' => $id, 'name' => $name ],
			null,
			'campaign_group',
			$id
		);

		return $this->get( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update( int $id, array $params ): array|WP_Error {
		$group = $this->repository->find( $id );
		if ( ! $group || ! $this->current_user_can_access_group( $group ) ) {
			return $this->not_found_error( __( 'Campaign Group not found.', 'pukat' ) );
		}

		$data = [];

		if ( array_key_exists( 'name', $params ) ) {
			$name = sanitize_text_field( (string) $params['name'] );
			if ( '' === trim( $name ) ) {
				return $this->validation_error( __( 'Campaign Group name is required.', 'pukat' ) );
			}
			$data['name'] = $name;
		}

		if ( array_key_exists( 'description', $params ) ) {
			$data['description'] = sanitize_textarea_field( (string) $params['description'] ) ?: null;
		}

		if ( $data ) {
			$this->repository->update( $id, $data );

			AuditLogService::log(
				'campaign_group.updated',
				array_merge( [ 'campaign_group_id' => $id ], $data ),
				null,
				'campaign_group',
				$id
			);
		}

		return $this->get( $id ) ?: [];
	}

	/**
	 * Delete a Campaign Group. Member Campaign Runs are ungrouped (not
	 * deleted) rather than the delete being blocked.
	 *
	 * @return true|WP_Error
	 */
	public function delete( int $id ): bool|WP_Error {
		$group = $this->repository->find( $id );
		if ( ! $group || ! $this->current_user_can_access_group( $group ) ) {
			return $this->not_found_error( __( 'Campaign Group not found.', 'pukat' ) );
		}

		$this->repository->ungroup_members( $id );
		$this->repository->delete( $id );

		AuditLogService::log( 'campaign_group.deleted', [ 'campaign_group_id' => $id ], null, 'campaign_group', $id );

		return true;
	}

	/**
	 * Aggregate funnel stats (sent/opened/clicked/submitted + rates) across
	 * every Campaign Run in the group, summed from each run's already-stored
	 * metrics_json.stats (no live GoPhish calls). Pass $id = null for the
	 * "Ungrouped" bucket (runs with no campaign_group_id).
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function report( ?int $id ): array|WP_Error {
		if ( null !== $id ) {
			$group = $this->repository->find( $id );
			if ( ! $group || ! $this->current_user_can_access_group( $group ) ) {
				return $this->not_found_error( __( 'Campaign Group not found.', 'pukat' ) );
			}
		}

		$runs = array_filter(
			$this->visible_runs( $this->campaign_runs->all() ),
			static fn ( array $run ): bool => (int) ( $run['campaign_group_id'] ?? 0 ) === (int) $id
		);

		return array_merge( [ 'campaign_group_id' => $id ], $this->aggregate( $runs ) );
	}

	/**
	 * Aggregate across every Campaign Group whose computed status is
	 * "active" (§7.2 FR-5) — the Monitoring dashboard's default view.
	 * Deliberately a single pass over one query of groups and one query of
	 * runs (no query inside a loop) — see docs/PRD_CAMPAIGN_GROUP_MONITORING.md
	 * §10 for the N+1 risk this avoids.
	 *
	 * @return array<string, mixed>
	 */
	public function report_active(): array {
		$all_runs        = $this->visible_runs( $this->campaign_runs->all() );
		$visible_groups  = array_filter( $this->repository->all(), [ $this, 'current_user_can_access_group' ] );
		$active_run_rows = [];

		foreach ( $visible_groups as $group ) {
			$member_runs = $this->runs_for_group( $all_runs, (int) $group['id'] );
			if ( 'active' === $this->compute_status( $member_runs ) ) {
				array_push( $active_run_rows, ...$member_runs );
			}
		}

		return array_merge( [ 'campaign_group_id' => null ], $this->aggregate( $active_run_rows ) );
	}

	/**
	 * @param array<int, array<string, mixed>> $runs
	 * @return array<string, mixed>
	 */
	private function aggregate( array $runs ): array {
		$totals = [
			'total'          => 0,
			'email_sent'     => 0,
			'email_opened'   => 0,
			'clicked'        => 0,
			'submitted_data' => 0,
			'email_reported' => 0,
		];
		$breakdown = [];

		foreach ( $runs as $run ) {
			$metrics = $this->decode_json_value( $run['metrics_json'] ?? null ) ?: [];
			$stats   = is_array( $metrics['stats'] ?? null ) ? $metrics['stats'] : [];

			foreach ( array_keys( $totals ) as $key ) {
				$totals[ $key ] += (int) ( $stats[ $key ] ?? 0 );
			}

			$breakdown[] = [
				'campaign_run_id' => (int) $run['id'],
				'name'            => (string) $run['name'],
				'status'          => (string) $run['status'],
				'stats'           => $stats,
			];
		}

		$total = $totals['total'];

		return [
			'stats'         => array_merge( $totals, [
				'open_rate'   => $total > 0 ? round( ( $totals['email_opened'] / $total ) * 100, 1 ) : 0,
				'click_rate'  => $total > 0 ? round( ( $totals['clicked'] / $total ) * 100, 1 ) : 0,
				'submit_rate' => $total > 0 ? round( ( $totals['submitted_data'] / $total ) * 100, 1 ) : 0,
				'report_rate' => $total > 0 ? round( ( $totals['email_reported'] / $total ) * 100, 1 ) : 0,
			] ),
			'campaign_runs' => $breakdown,
			'generated_at'  => current_time( 'mysql' ),
		];
	}

	/**
	 * Whether the current user may see this group — admin sees everything,
	 * everyone else only their own entity's groups. Same shape as
	 * CampaignRunService::current_user_can_access_playbook().
	 *
	 * @param array<string, mixed> $group Group row.
	 */
	public function current_user_can_access_group( array $group ): bool {
		if ( $this->current_user_can_admin_assets() ) {
			return true;
		}

		$group_entity = strtolower( trim( (string) ( $group['entity'] ?? '' ) ) );
		$user_entity  = strtolower( $this->user_entity( get_current_user_id() ) );

		return '' !== $user_entity && $group_entity === $user_entity;
	}

	/**
	 * Active/Selesai computed from member Campaign Run statuses (§7.2 FR-5):
	 * Active if any member hasn't reached a terminal status yet (or the
	 * group has no members at all — a fresh group defaults to Active),
	 * Selesai only once every member has.
	 *
	 * @param array<int, array<string, mixed>> $memberRuns
	 */
	public function compute_status( array $memberRuns ): string {
		if ( empty( $memberRuns ) ) {
			return 'active';
		}

		foreach ( $memberRuns as $run ) {
			if ( ! in_array( (string) ( $run['status'] ?? '' ), self::TERMINAL_RUN_STATUSES, true ) ) {
				return 'active';
			}
		}

		return 'completed';
	}

	/**
	 * @param array<int, array<string, mixed>> $allRuns
	 * @return array<int, array<string, mixed>>
	 */
	private function runs_for_group( array $allRuns, int $groupId ): array {
		return array_values( array_filter(
			$allRuns,
			static fn ( array $run ): bool => (int) ( $run['campaign_group_id'] ?? 0 ) === $groupId
		) );
	}

	/**
	 * Runs the current user is allowed to see. One batched query for every
	 * distinct source Playbook Master's entity (not one query per run) —
	 * same N+1 avoidance as report_active(), see docs/PRD_CAMPAIGN_GROUP_MONITORING.md §10.
	 *
	 * @param array<int, array<string, mixed>> $allRuns
	 * @return array<int, array<string, mixed>>
	 */
	private function visible_runs( array $allRuns ): array {
		if ( $this->current_user_can_admin_assets() ) {
			return $allRuns;
		}

		if ( empty( $allRuns ) ) {
			return [];
		}

		global $wpdb;

		$playbook_ids = array_values( array_unique( array_map(
			static fn ( array $run ): int => (int) ( $run['playbook_master_id'] ?? 0 ),
			$allRuns
		) ) );

		$placeholders    = implode( ',', array_fill( 0, count( $playbook_ids ), '%d' ) );
		$playbook_rows   = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, entity FROM {$wpdb->prefix}pukat_playbook_masters WHERE id IN ({$placeholders})",
				$playbook_ids
			),
			ARRAY_A
		) ?: [];
		$entity_by_id = array_column( $playbook_rows, 'entity', 'id' );
		$user_entity  = strtolower( $this->user_entity( get_current_user_id() ) );

		return array_values( array_filter( $allRuns, static function ( array $run ) use ( $entity_by_id, $user_entity ): bool {
			$playbook_id = (int) ( $run['playbook_master_id'] ?? 0 );
			$run_entity  = strtolower( trim( (string) ( $entity_by_id[ $playbook_id ] ?? 'general' ) ) );

			return 'general' === $run_entity || $run_entity === $user_entity;
		} ) );
	}

	/**
	 * @param array<string, mixed> $group Group row.
	 * @return array<string, mixed>
	 */
	private function prepare_group( array $group, array $memberRuns ): array {
		return [
			'id'           => (int) $group['id'],
			'name'         => (string) $group['name'],
			'description'  => $group['description'] ?? null,
			'entity'       => (string) $group['entity'],
			'status'       => $this->compute_status( $memberRuns ),
			'member_count' => count( $memberRuns ),
			'created_at'   => $group['created_at'] ?? null,
			'updated_at'   => $group['updated_at'] ?? null,
		];
	}

	/**
	 * Same 3-key fallback chain as CampaignRunService::current_user_entity(),
	 * kept local rather than shared to avoid coupling two independent
	 * services over one private helper.
	 */
	private function user_entity( int $user_id ): string {
		$entity = (string) get_user_meta( $user_id, 'meta_entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'entity', true );
		}

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
	}

	private function current_user_can_admin_assets(): bool {
		return current_user_can( 'pukat_manage_settings' ) || current_user_can( 'administrator' );
	}

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

	private function validation_error( string $message ): WP_Error {
		return new WP_Error( 'validation_error', $message, [ 'status' => 422 ] );
	}

	private function not_found_error( string $message ): WP_Error {
		return new WP_Error( 'not_found', $message, [ 'status' => 404 ] );
	}

	private function db_error( string $message ): WP_Error {
		return new WP_Error( 'db_error', $message, [ 'status' => 500 ] );
	}
}
