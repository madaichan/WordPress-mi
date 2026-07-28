<?php
/**
 * Server-driven table repository for email template masters.
 *
 * @package Pukat\Repositories\Table
 */

declare(strict_types=1);

namespace Pukat\Repositories\Table;

/**
 * SQL access for the `email_templates` server-driven table.
 *
 * Same versioned-content shape as landing pages: `email_template_masters`
 * holds identity/entity/status, `email_template_versions` holds subject/
 * html_body/etc per revision. The list only needs the latest version's
 * `subject` and `status` (never `html_body`/`text_body` — large payload rule),
 * joined with the same "latest version" correlated subquery used for landing
 * pages instead of MasterComponentService's per-master N+1 `versions()` fetch.
 *
 * Callers (TableQueryService) MUST validate `sort` and every `filters` key
 * against TableRegistry before calling count()/rows() — those values are
 * interpolated as SQL identifiers below and cannot be parameterized with
 * $wpdb->prepare(), so this class trusts them to already be allowlisted.
 */
class EmailTemplateTableRepository {

	private function master_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_email_template_masters';
	}

	private function version_table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_email_template_versions';
	}

	/**
	 * @param array<string, mixed> $args Validated query args from TableQueryService.
	 */
	public function count( array $args ): int {
		global $wpdb;

		[ $where_sql, $params ] = $this->where( $args );
		$master  = $this->master_table();
		$version = $this->version_table();

		// The search clause can reference the joined version's subject, so the join is included
		// here too — it's 1:1 via the correlated "latest version" subquery, so it never multiplies
		// master rows and is safe to always include.
		$sql = "SELECT COUNT(*) FROM {$master} m
			LEFT JOIN {$version} v ON v.id = (
				SELECT v2.id FROM {$version} v2
				WHERE v2.template_master_id = m.id
				ORDER BY v2.version DESC
				LIMIT 1
			)
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

		$sort   = $args['sort'];
		$order  = 'DESC' === strtoupper( (string) $args['order'] ) ? 'DESC' : 'ASC';
		$limit  = max( 1, (int) $args['per_page'] );
		$offset = max( 0, ( (int) $args['page'] - 1 ) * $limit );

		$master  = $this->master_table();
		$version = $this->version_table();

		$sql = "SELECT m.id, m.name, m.description, m.category, m.entity, m.status, m.created_at,
			v.subject, v.status AS version_status
			FROM {$master} m
			LEFT JOIN {$version} v ON v.id = (
				SELECT v2.id FROM {$version} v2
				WHERE v2.template_master_id = m.id
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
	 * Conditions are scoped to the master table (`m.` prefix) except the
	 * search clause, which also matches the joined version's `subject` —
	 * filtering/sorting stays master-only so it can't multiply rows.
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
			$clauses[] = 'v.subject LIKE %s';
			$params[]  = $like;
			$conditions[] = '(' . implode( ' OR ', $clauses ) . ')';
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
