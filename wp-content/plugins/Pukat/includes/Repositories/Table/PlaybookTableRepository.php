<?php
/**
 * Server-driven table repository for playbook masters.
 *
 * @package Pukat\Repositories\Table
 */

declare(strict_types=1);

namespace Pukat\Repositories\Table;

/**
 * SQL access for the `playbooks` server-driven table.
 *
 * `active_campaign_run_count` mirrors PlaybookMasterRepository::
 * count_campaign_runs_for_playbook() (a Campaign Run whose snapshot was ever
 * locked, regardless of current status), computed here as a correlated
 * COUNT subquery — like CampaignTableRepository's target_count — instead of
 * one extra query per row, since TableQueryService::get_rows() decorates
 * every row in the page.
 *
 * Callers (TableQueryService) MUST validate `sort` and every `filters` key
 * against TableRegistry before calling count()/rows() — those values are
 * interpolated as SQL identifiers below and cannot be parameterized with
 * $wpdb->prepare(), so this class trusts them to already be allowlisted.
 */
class PlaybookTableRepository {

	/** Columns returned to the list endpoint. */
	private const LIST_COLUMNS = [ 'id', 'name', 'description', 'scenario', 'difficulty', 'entity', 'status', 'created_by', 'updated_by', 'created_at' ];

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_playbook_masters';
	}

	private function campaign_runs_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_campaign_runs';
	}

	/**
	 * @param array<string, mixed> $args Validated query args from TableQueryService.
	 */
	public function count( array $args ): int {
		global $wpdb;

		[ $where_sql, $params ] = $this->where( $args );
		$sql = "SELECT COUNT(*) FROM {$this->table()} m {$where_sql}";

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

		$columns = implode( ', ', array_map( static fn( string $column ): string => "m.{$column}", self::LIST_COLUMNS ) );
		$sort    = $args['sort'];
		$order   = 'DESC' === strtoupper( (string) $args['order'] ) ? 'DESC' : 'ASC';
		$limit   = max( 1, (int) $args['per_page'] );
		$offset  = max( 0, ( (int) $args['page'] - 1 ) * $limit );
		$runs    = $this->campaign_runs_table();

		$sql = "SELECT {$columns},
			(SELECT COUNT(*) FROM {$runs} r WHERE r.playbook_master_id = m.id AND r.snapshot_json IS NOT NULL AND r.snapshot_json != '') AS active_campaign_run_count
			FROM {$this->table()} m
			{$where_sql}
			ORDER BY m.{$sort} {$order}
			LIMIT %d OFFSET %d";

		$params[] = $limit;
		$params[] = $offset;

		$rows = $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A );

		return $rows ?: [];
	}

	/**
	 * Build a shared WHERE clause + prepare() params for count() and rows().
	 *
	 * @param array<string, mixed> $args
	 * @return array{0: string, 1: array<int, mixed>}
	 */
	private function where( array $args ): array {
		global $wpdb;

		$conditions = [];
		$params     = [];

		$search = trim( (string) ( $args['search'] ?? '' ) );
		if ( '' !== $search ) {
			$like    = '%' . $wpdb->esc_like( $search ) . '%';
			$clauses = [];
			foreach ( (array) ( $args['search_fields'] ?? [] ) as $column ) {
				$clauses[] = "m.{$column} LIKE %s";
				$params[]  = $like;
			}
			if ( $clauses ) {
				$conditions[] = '(' . implode( ' OR ', $clauses ) . ')';
			}
		}

		foreach ( (array) ( $args['filters'] ?? [] ) as $column => $value ) {
			if ( '' === $value || null === $value ) {
				continue;
			}
			$conditions[] = "m.{$column} = %s";
			$params[]     = (string) $value;
		}

		$viewer_entity = $args['viewer_entity'] ?? null;
		if ( null !== $viewer_entity ) {
			$conditions[] = '(m.entity = %s OR m.entity = %s)';
			$params[]     = 'General';
			$params[]     = $viewer_entity;
		}

		// Archived Playbook Masters are unconditionally hidden — mirrors
		// PlaybookMasterService::list()'s legacy `/playbook-masters` endpoint
		// (MasterAssetPage.jsx used to filter `row.status !== 'archived'` client-side).
		// There is deliberately no way to opt back into seeing them from this table.
		$conditions[] = "m.status != 'archived'";

		return [ 'WHERE ' . implode( ' AND ', $conditions ), $params ];
	}
}
