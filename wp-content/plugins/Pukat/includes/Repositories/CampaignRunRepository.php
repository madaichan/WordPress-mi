<?php
/**
 * Campaign Run database access.
 *
 * @package Pukat\Repositories
 */

declare(strict_types=1);

namespace Pukat\Repositories;

/**
 * Repository for Campaign Run snapshots and referenced Playbook Master data.
 */
class CampaignRunRepository {

	/**
	 * Return all Campaign Runs ordered by newest first.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function all(): array {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$rows  = $wpdb->get_results(
			"SELECT * FROM {$table} ORDER BY created_at DESC",
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Return Campaign Runs that can have GoPhish results refreshed by cron.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	public function result_sync_candidates( int $limit = 25 ): array {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$limit = max( 1, min( 100, $limit ) );
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table}
				 WHERE gophish_campaign_id IS NOT NULL
				   AND status IN ('synced', 'scheduled', 'running')
				 ORDER BY updated_at ASC
				 LIMIT %d",
				$limit
			),
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Find a Campaign Run by ID.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find( int $id ): ?array {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	/**
	 * Insert a Campaign Run and return its ID.
	 *
	 * @param array<string, mixed> $data Row data.
	 * @return int|false
	 */
	public function create( array $data ): int|false {
		global $wpdb;

		$result = $wpdb->insert( $this->table( 'campaign_runs' ), $data );

		return false === $result ? false : (int) $wpdb->insert_id;
	}

	/**
	 * Update a Campaign Run.
	 *
	 * @param array<string, mixed> $data Row data.
	 */
	public function update( int $id, array $data ): bool {
		global $wpdb;

		return false !== $wpdb->update( $this->table( 'campaign_runs' ), $data, [ 'id' => $id ] );
	}

	/**
	 * Delete a Campaign Run and any targets imported against it.
	 */
	public function delete( int $id ): bool {
		global $wpdb;

		$wpdb->delete( $this->table( 'targets' ), [ 'campaign_run_id' => $id ] );

		return false !== $wpdb->delete( $this->table( 'campaign_runs' ), [ 'id' => $id ] );
	}

	/**
	 * Find a Playbook Master by ID.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_playbook_master( int $id ): ?array {
		return $this->find_row( 'playbook_masters', $id );
	}

	/**
	 * Find a referenced component row by table suffix and ID.
	 *
	 * @return array<string, mixed>|null
	 */
	public function find_component( string $table_suffix, int $id ): ?array {
		return $this->find_row( $table_suffix, $id );
	}

	/**
	 * Find imported targets for a Campaign Run.
	 *
	 * @return array<int, array<string, string>>
	 */
	public function find_targets( int $campaign_run_id ): array {
		global $wpdb;

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT first_name, last_name, email, position, department
				 FROM {$this->table( 'targets' )}
				 WHERE campaign_run_id = %d
				 ORDER BY id ASC",
				$campaign_run_id
			),
			ARRAY_A
		);

		return $rows ?: [];
	}

	/**
	 * Launched Campaign Runs grouped by Playbook Master — one query for the whole
	 * set (no N+1 across playbooks), returning only the three columns the stats
	 * aggregation needs. Numeric aggregation over metrics_json is left to the
	 * service (business logic); the repository stays thin and just groups rows.
	 *
	 * @param array<int, int> $playbook_ids Empty = every playbook.
	 * @return array<int, array{used_count:int, first_launched_at:?string, rows: array<int, array{metrics_json:?string}>}>
	 */
	public function launched_runs_for_playbooks( array $playbook_ids = [] ): array {
		global $wpdb;

		$table = $this->table( 'campaign_runs' );
		$where = 'launched_at IS NOT NULL';
		$ids   = array_values( array_unique( array_filter( array_map( 'intval', $playbook_ids ) ) ) );

		if ( ! empty( $ids ) ) {
			$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
			$sql          = $wpdb->prepare(
				"SELECT playbook_master_id, launched_at, metrics_json FROM {$table}
				 WHERE {$where} AND playbook_master_id IN ({$placeholders})",
				$ids
			);
		} else {
			$sql = "SELECT playbook_master_id, launched_at, metrics_json FROM {$table} WHERE {$where}";
		}

		$rows = $wpdb->get_results( $sql, ARRAY_A ) ?: [];

		$grouped = [];
		foreach ( $rows as $row ) {
			$playbook_id = (int) ( $row['playbook_master_id'] ?? 0 );
			if ( $playbook_id <= 0 ) {
				continue;
			}

			if ( ! isset( $grouped[ $playbook_id ] ) ) {
				$grouped[ $playbook_id ] = [
					'used_count'        => 0,
					'first_launched_at' => null,
					'rows'              => [],
				];
			}

			++$grouped[ $playbook_id ]['used_count'];
			$grouped[ $playbook_id ]['rows'][] = [ 'metrics_json' => $row['metrics_json'] ?? null ];

			$launched = isset( $row['launched_at'] ) ? (string) $row['launched_at'] : '';
			if ( '' !== $launched ) {
				$current = $grouped[ $playbook_id ]['first_launched_at'];
				if ( null === $current || $launched < $current ) {
					$grouped[ $playbook_id ]['first_launched_at'] = $launched;
				}
			}
		}

		return $grouped;
	}

	/**
	 * Batched Playbook Master name lookup for a set of Campaign Runs — one
	 * query for the whole set instead of one per row (used by
	 * CampaignGroupService::aggregate() to enrich its per-run breakdown).
	 *
	 * @param array<int, int|string> $playbook_master_ids
	 * @return array<int, string> playbook_master_id => name
	 */
	public function playbook_names_by_id( array $playbook_master_ids ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $playbook_master_ids ) ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$rows         = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, name FROM {$this->table( 'playbook_masters' )} WHERE id IN ({$placeholders})",
				$ids
			),
			ARRAY_A
		) ?: [];

		return array_map( 'strval', array_column( $rows, 'name', 'id' ) );
	}

	/**
	 * Batched target counts for a set of Campaign Runs — one query for the
	 * whole set instead of one per row (used by CampaignGroupService::aggregate()
	 * to enrich its per-run breakdown).
	 *
	 * @param array<int, int|string> $campaign_run_ids
	 * @return array<int, int> campaign_run_id => count
	 */
	public function target_counts_by_campaign_run_id( array $campaign_run_ids ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $campaign_run_ids ) ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$rows         = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT campaign_run_id, COUNT(*) AS cnt FROM {$this->table( 'targets' )} WHERE campaign_run_id IN ({$placeholders}) GROUP BY campaign_run_id",
				$ids
			),
			ARRAY_A
		) ?: [];

		return array_map( 'intval', array_column( $rows, 'cnt', 'campaign_run_id' ) );
	}

	/**
	 * The follow-up stages each GoPhish campaign's run opted into, keyed by
	 * `gophish_campaign_id` — one query for the whole set. Lets a caller tell
	 * a simulation chained to education alone from one chained to education as
	 * a step towards the quiz, which the live GoPhish chain cannot show (the
	 * education master carries a single shared link onward).
	 *
	 * @param array<int, int|string> $gophish_campaign_ids
	 * @return array<int, array{education_enabled: bool, quiz_enabled: bool}>
	 */
	public function follow_up_by_gophish_campaign_id( array $gophish_campaign_ids ): array {
		global $wpdb;

		$ids = array_values( array_unique( array_filter( array_map( 'intval', $gophish_campaign_ids ) ) ) );
		if ( empty( $ids ) ) {
			return [];
		}

		$placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
		$rows         = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT gophish_campaign_id, follow_up_json FROM {$this->table( 'campaign_runs' )} WHERE gophish_campaign_id IN ({$placeholders})",
				$ids
			),
			ARRAY_A
		) ?: [];

		$map = [];
		foreach ( $rows as $row ) {
			$follow_up = json_decode( (string) ( $row['follow_up_json'] ?? '' ), true );
			$follow_up = is_array( $follow_up ) ? $follow_up : [];

			$map[ (int) $row['gophish_campaign_id'] ] = [
				'education_enabled' => ! empty( $follow_up['education_enabled'] ),
				'quiz_enabled'      => ! empty( $follow_up['quiz_enabled'] ),
			];
		}

		return $map;
	}

	/**
	 * Per-run quiz participation for one entity, newest run first.
	 *
	 * Only runs whose own chain leads to a quiz are counted — the two linkages
	 * that belong to the quiz, `simulation → quiz` (`via` = direct) and
	 * `simulation → education → quiz` (`via` = education). A run that chained
	 * to education ALONE is left out: the education master carries one shared
	 * `next_campaign_id` (PRD §13.9), so the live GoPhish chain cannot tell
	 * those apart, and what a run actually opted into is recorded only in its
	 * `follow_up_json` — the same splitter QuizPageService::compute_linkage()
	 * trusts for the quiz's linkage panel. Counting education-only runs would
	 * put people who were never offered a quiz into the denominator and make
	 * participation look worse than it is.
	 *
	 * `reached` is the run's `submitted_data` count: submitting the phishing
	 * form is what redirects a target into the chain, so it is the honest
	 * denominator for "offered the quiz" — the same one
	 * CampaignRunService::aggregate_result_stats() divides by for `quiz_rate`.
	 * `completed` is that run's `quiz_completed`.
	 *
	 * Both are read out of the stored `metrics_json` snapshot rather than
	 * recomputed, so this costs one query and no GoPhish call — the numbers are
	 * as fresh as the run's last results sync. Runs never synced have no
	 * snapshot and come back as zeros.
	 *
	 * @param string $entity Entity name; matched case-insensitively.
	 * @param int    $limit  Newest runs to inspect (metrics_json is LONGTEXT, so this stays bounded).
	 * @return array<int, array{id: int, name: string, launched_at: string, via: string, reached: int, completed: int}>
	 */
	public function quiz_participation_for_entity( string $entity, int $limit = 50 ): array {
		global $wpdb;

		$entity = trim( $entity );
		if ( '' === $entity ) {
			return [];
		}

		$table = $this->table( 'campaign_runs' );
		$limit = max( 1, min( 200, $limit ) );
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, name, launched_at, metrics_json, follow_up_json FROM {$table}
				 WHERE LOWER(entity) = LOWER(%s) AND launched_at IS NOT NULL
				 ORDER BY launched_at DESC, id DESC
				 LIMIT %d",
				$entity,
				$limit
			),
			ARRAY_A
		) ?: [];

		$out = [];
		foreach ( $rows as $row ) {
			$follow_up = json_decode( (string) ( $row['follow_up_json'] ?? '' ), true );
			if ( ! is_array( $follow_up ) || empty( $follow_up['quiz_enabled'] ) ) {
				continue;
			}

			$metrics = json_decode( (string) ( $row['metrics_json'] ?? '' ), true );
			$stats   = is_array( $metrics ) && is_array( $metrics['stats'] ?? null ) ? $metrics['stats'] : [];

			$out[] = [
				'id'          => (int) $row['id'],
				'name'        => (string) ( $row['name'] ?? '' ),
				'launched_at' => (string) ( $row['launched_at'] ?? '' ),
				'via'         => empty( $follow_up['education_enabled'] ) ? 'direct' : 'education',
				'reached'     => (int) ( $stats['submitted_data'] ?? 0 ),
				'completed'   => (int) ( $stats['quiz_completed'] ?? 0 ),
			];
		}

		return $out;
	}

	/**
	 * The entity's quiz-linked runs that are still worth asking GoPhish about,
	 * newest first — the working set for QuizRefreshService.
	 *
	 * Two filters, both deliberate. `status IN ('synced','scheduled','running')`
	 * is the same in-flight set result_sync_candidates() polls: a finished run
	 * cannot gain new answers, so refreshing it would spend a GoPhish request
	 * to learn nothing. And `quiz_enabled` keeps the set to runs whose chain
	 * actually leads to a quiz, for the reasons spelled out on
	 * quiz_participation_for_entity().
	 *
	 * `pass_score` comes along because grading needs the override the operator
	 * chose for that run, and this is already the row that holds it.
	 *
	 * @param string $entity Entity name; matched case-insensitively.
	 * @param int    $limit  Newest in-flight runs to return.
	 * @return array<int, array{id: int, name: string, gophish_campaign_id: int, pass_score: int|null}>
	 */
	public function quiz_runs_to_poll( string $entity, int $limit = 10 ): array {
		global $wpdb;

		$entity = trim( $entity );
		if ( '' === $entity ) {
			return [];
		}

		$table = $this->table( 'campaign_runs' );
		$limit = max( 1, min( 50, $limit ) );
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, name, gophish_campaign_id, follow_up_json FROM {$table}
				 WHERE LOWER(entity) = LOWER(%s)
				   AND gophish_campaign_id IS NOT NULL
				   AND status IN ('synced', 'scheduled', 'running')
				 ORDER BY launched_at DESC, id DESC
				 LIMIT %d",
				$entity,
				$limit
			),
			ARRAY_A
		) ?: [];

		$out = [];
		foreach ( $rows as $row ) {
			$follow_up = json_decode( (string) ( $row['follow_up_json'] ?? '' ), true );
			if ( ! is_array( $follow_up ) || empty( $follow_up['quiz_enabled'] ) ) {
				continue;
			}

			$pass_score = $follow_up['quiz_pass_score'] ?? null;

			$out[] = [
				'id'                  => (int) $row['id'],
				'name'                => (string) ( $row['name'] ?? '' ),
				'gophish_campaign_id' => (int) $row['gophish_campaign_id'],
				'pass_score'          => null === $pass_score || '' === $pass_score ? null : (int) $pass_score,
			];
		}

		return $out;
	}

	/**
	 * Find a generic row by table suffix and ID.
	 *
	 * @return array<string, mixed>|null
	 */
	private function find_row( string $table_suffix, int $id ): ?array {
		global $wpdb;

		$table = $this->table( $table_suffix );
		$row   = $wpdb->get_row(
			$wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ),
			ARRAY_A
		);

		return $row ?: null;
	}

	private function table( string $table_suffix ): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_' . $table_suffix;
	}
}
