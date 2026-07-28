<?php
/**
 * Server-driven table repository for sending profile references.
 *
 * @package Pukat\Repositories\Table
 */

declare(strict_types=1);

namespace Pukat\Repositories\Table;

/**
 * SQL access for the `sending_profiles` server-driven table.
 *
 * Every list-facing concern (search, filter, sort, pagination) is pushed down
 * into the query here so the frontend never has to load the full result set
 * to search/sort/paginate it in the browser.
 *
 * Callers (TableQueryService) MUST validate `sort` and every `filters` key
 * against TableRegistry before calling count()/rows() — those values are
 * interpolated as SQL identifiers below and cannot be parameterized with
 * $wpdb->prepare(), so this class trusts them to already be allowlisted.
 */
class SendingProfileTableRepository {

	/** Columns returned to the list endpoint. Keep narrow — no secrets, no large JSON blobs. */
	private const LIST_COLUMNS = [ 'id', 'name', 'from_name', 'from_email', 'reply_to', 'gophish_sending_profile_id', 'environment', 'entity', 'status', 'created_at' ];

	private function table(): string {
		global $wpdb;

		return $wpdb->prefix . 'pukat_sending_profile_refs';
	}

	/**
	 * @param array<string, mixed> $args Validated query args from TableQueryService.
	 */
	public function count( array $args ): int {
		global $wpdb;

		[ $where_sql, $params ] = $this->where( $args );
		$sql = "SELECT COUNT(*) FROM {$this->table()} {$where_sql}";

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

		$columns = implode( ', ', self::LIST_COLUMNS );
		$sort    = $args['sort'];
		$order   = 'DESC' === strtoupper( (string) $args['order'] ) ? 'DESC' : 'ASC';
		$limit   = max( 1, (int) $args['per_page'] );
		$offset  = max( 0, ( (int) $args['page'] - 1 ) * $limit );

		$sql      = "SELECT {$columns} FROM {$this->table()} {$where_sql} ORDER BY {$sort} {$order} LIMIT %d OFFSET %d";
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
				$clauses[] = "{$column} LIKE %s";
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
			$conditions[] = "{$column} = %s";
			$params[]     = (string) $value;
		}

		$viewer_entity = $args['viewer_entity'] ?? null;
		if ( null !== $viewer_entity ) {
			$conditions[] = '(entity = %s OR entity = %s)';
			$params[]     = 'General';
			$params[]     = $viewer_entity;
		}

		if ( empty( $conditions ) ) {
			return [ '', $params ];
		}

		return [ 'WHERE ' . implode( ' AND ', $conditions ), $params ];
	}
}
