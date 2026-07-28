<?php
/**
 * Server-driven table repository for landing page masters.
 *
 * @package Pukat\Repositories\Table
 */

declare(strict_types=1);

namespace Pukat\Repositories\Table;

/**
 * SQL access for the `landing_pages` server-driven table.
 *
 * Landing page content is versioned: `landing_page_masters` holds identity/
 * entity/status, `landing_page_versions` holds the actual HTML/capture/
 * redirect config per revision. The list only needs the latest version's
 * small capture/redirect settings (never the HTML body — that stays out of
 * the list endpoint entirely per the "no large payloads in list responses"
 * rule), so it's joined in with one correlated subquery instead of the N+1
 * "fetch every version per master" the existing MasterComponentService list
 * path uses.
 *
 * Callers (TableQueryService) MUST validate `sort` and every `filters` key
 * against TableRegistry before calling count()/rows() — those values are
 * interpolated as SQL identifiers below and cannot be parameterized with
 * $wpdb->prepare(), so this class trusts them to already be allowlisted.
 */
class LandingPageTableRepository {

	private function master_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_landing_page_masters';
	}

	private function version_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_landing_page_versions';
	}

	/**
	 * @param array<string, mixed> $args Validated query args from TableQueryService.
	 */
	public function count( array $args ): int {
		global $wpdb;

		[ $where_sql, $params ] = $this->where( $args );
		$sql = "SELECT COUNT(*) FROM {$this->master_table()} m {$where_sql}";

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

		$sort   = $args['sort'];
		$order  = 'DESC' === strtoupper( (string) $args['order'] ) ? 'DESC' : 'ASC';
		$limit  = max( 1, (int) $args['per_page'] );
		$offset = max( 0, ( (int) $args['page'] - 1 ) * $limit );

		$master  = $this->master_table();
		$version = $this->version_table();

		$sql = "SELECT m.id, m.name, m.description, m.category, m.entity, m.status, m.created_at,
			v.capture_settings_json, v.redirect_settings_json
			FROM {$master} m
			LEFT JOIN {$version} v ON v.id = (
				SELECT v2.id FROM {$version} v2
				WHERE v2.landing_page_master_id = m.id
				ORDER BY v2.version DESC
				LIMIT 1
			)
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
	 * All conditions are scoped to the master table (`m.` prefix) — filtering
	 * or searching the version table would multiply master rows.
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

		if ( empty( $conditions ) ) {
			return [ '', $params ];
		}

		return [ 'WHERE ' . implode( ' AND ', $conditions ), $params ];
	}
}
