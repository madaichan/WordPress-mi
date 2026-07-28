<?php
/**
 * Server-driven table repository for campaigns.
 *
 * @package Pukat\Repositories\Table
 */

declare(strict_types=1);

namespace Pukat\Repositories\Table;

/**
 * SQL access for the `campaigns` server-driven table.
 *
 * Unlike the four master-asset tables, `pukat_campaigns` has no entity/
 * owner column at all — CampaignController::get_campaigns() never scopes
 * visibility by entity today, so this repository doesn't either; adding
 * that would be a permission-model change beyond a list-view migration.
 *
 * The legacy `get_campaigns()` endpoint does `SELECT *` and never computes
 * `target_count` (the frontend has been showing '—' for it since `pukat_
 * campaigns` has no such column) — this repository computes it for real via
 * a correlated COUNT against `pukat_targets`, which does have the data.
 *
 * Callers (TableQueryService) MUST validate `sort` and every `filters` key
 * against TableRegistry before calling count()/rows() — those values are
 * interpolated as SQL identifiers below and cannot be parameterized with
 * $wpdb->prepare(), so this class trusts them to already be allowlisted.
 */
class CampaignTableRepository {

	/** Columns returned to the list endpoint. */
	private const LIST_COLUMNS = [ 'id', 'name', 'status', 'difficulty', 'scheduled_at', 'launched_at', 'completed_at', 'created_at' ];

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_campaigns';
	}

	private function targets_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_targets';
	}

	/**
	 * @param array<string, mixed> $args Validated query args from TableQueryService.
	 */
	public function count( array $args ): int {
		global $wpdb;

		[ $where_sql, $params ] = $this->where( $args );
		$sql = "SELECT COUNT(*) FROM {$this->table()} c {$where_sql}";

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

		$sql = "SELECT {$columns},
			(SELECT COUNT(*) FROM {$targets} t WHERE t.campaign_id = c.id) AS target_count
			FROM {$this->table()} c
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
				$clauses[] = "c.{$column} LIKE %s";
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
			$conditions[] = "c.{$column} = %s";
			$params[]     = (string) $value;
		}

		if ( empty( $conditions ) ) {
			return [ '', $params ];
		}

		return [ 'WHERE ' . implode( ' AND ', $conditions ), $params ];
	}
}
