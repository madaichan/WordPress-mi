<?php
/**
 * Server-driven table repository for campaign_runs.
 *
 * @package Pukat\Repositories\Table
 */

declare(strict_types=1);

namespace Pukat\Repositories\Table;

/**
 * SQL access for the `campaign_runs` server-driven table — the Campaign Run
 * model the Playbook-first wizard actually launches into GoPhish (unlike the
 * legacy `campaigns` table, which the wizard no longer writes to).
 *
 * Entity visibility is scoped via `viewer_entity` (same mechanism
 * TableQueryService::viewer_entity_scope() already provides to every table —
 * see PlaybookTableRepository for the pattern this mirrors), joined through
 * the run's source Playbook Master since Campaign Run itself has no entity
 * column of its own. `campaign_group_id` accepts `0` (or empty string) to
 * mean the "Ungrouped" bucket (`campaign_group_id IS NULL`), since that
 * can't be expressed as a plain `= value` match.
 *
 * Callers (TableQueryService) MUST validate `sort` and every `filters` key
 * against TableRegistry before calling count()/rows() — same contract as
 * every other Table repository in this codebase.
 */
class CampaignRunTableRepository {

	/** Columns returned to the list endpoint. */
	private const LIST_COLUMNS = [ 'id', 'name', 'status', 'campaign_group_id', 'launched_at', 'completed_at', 'created_at' ];

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_campaign_runs';
	}

	private function targets_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_targets';
	}

	private function groups_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_campaign_groups';
	}

	private function playbook_masters_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_playbook_masters';
	}

	/**
	 * @param array<string, mixed> $args Validated query args from TableQueryService.
	 */
	public function count( array $args ): int {
		global $wpdb;

		[ $where_sql, $params ] = $this->where( $args );
		$sql = "SELECT COUNT(*) FROM {$this->table()} c
			LEFT JOIN {$this->playbook_masters_table()} pm ON pm.id = c.playbook_master_id
			{$where_sql}";

		if ( empty( $params ) ) {
			return (int) $wpdb->get_var( $sql );
		}

		return (int) $wpdb->get_var( $wpdb->prepare( $sql, $params ) );
	}

	/**
	 * @param array<string, mixed> $args Validated query args from TableQueryService.
	 * @return array<int, array<string, mixed>>
	 */
	public function rows( array $args ): array {
		global $wpdb;

		[ $where_sql, $params ] = $this->where( $args );

		$columns = implode( ', ', array_map( static fn( string $column ): string => "c.{$column}", self::LIST_COLUMNS ) );
		$sort    = $args['sort'];
		$order   = 'DESC' === strtoupper( (string) $args['order'] ) ? 'DESC' : 'ASC';
		$limit   = max( 1, (int) $args['per_page'] );
		$offset  = max( 0, ( (int) $args['page'] - 1 ) * $limit );
		$targets = $this->targets_table();
		$groups  = $this->groups_table();

		$sql = "SELECT {$columns},
			(SELECT COUNT(*) FROM {$targets} t WHERE t.campaign_run_id = c.id) AS target_count,
			g.name AS campaign_group_name
			FROM {$this->table()} c
			LEFT JOIN {$this->playbook_masters_table()} pm ON pm.id = c.playbook_master_id
			LEFT JOIN {$groups} g ON g.id = c.campaign_group_id
			{$where_sql}
			ORDER BY c.{$sort} {$order}
			LIMIT %d OFFSET %d";

		$params[] = $limit;
		$params[] = $offset;

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );

		return $rows ?: [];
	}

	/**
	 * Build a shared WHERE clause + prepare() params for count() and rows().
	 * `count()` doesn't join `pukat_campaign_groups`, so conditions here must
	 * only ever reference `c.` / `pm.`, never `g.`.
	 *
	 * @param array<string, mixed> $args
	 * @return array{0: string, 1: array<int, mixed>}
	 */
	private function where( array $args ): array {
		global $wpdb;

		$conditions = [];
		$params     = [];
		$filters    = (array) ( $args['filters'] ?? [] );

		$search = trim( (string) ( $args['search'] ?? '' ) );
		if ( '' !== $search ) {
			$like    = '%' . $wpdb->esc_like( $search ) . '%';
			$clauses = [];
			foreach ( (array) ( $args['search_fields'] ?? [] ) as $column ) {
				$clauses[] = "c.{$column} LIKE %s";
				$params[]  = $like;
			}
			if ( $clauses ) {
				$conditions[] = '(' . implode( ' OR ', $clauses ) . ')';
			}
		}

		if ( isset( $filters['status'] ) && '' !== $filters['status'] ) {
			$conditions[] = 'c.status = %s';
			$params[]     = (string) $filters['status'];
		}

		if ( isset( $filters['campaign_group_id'] ) && '' !== $filters['campaign_group_id'] ) {
			$group_id = (int) $filters['campaign_group_id'];
			if ( $group_id > 0 ) {
				$conditions[] = 'c.campaign_group_id = %d';
				$params[]     = $group_id;
			} else {
				$conditions[] = 'c.campaign_group_id IS NULL';
			}
		}

		$viewer_entity = $args['viewer_entity'] ?? null;
		if ( null !== $viewer_entity ) {
			$conditions[] = '(pm.entity = %s OR pm.entity = %s)';
			$params[]     = 'General';
			$params[]     = $viewer_entity;
		}

		if ( empty( $conditions ) ) {
			return [ '', $params ];
		}

		return [ 'WHERE ' . implode( ' AND ', $conditions ), $params ];
	}
}
