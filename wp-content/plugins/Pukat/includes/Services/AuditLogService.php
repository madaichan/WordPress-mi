<?php
/**
 * Audit log service.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * Class AuditLogService
 *
 * Appends immutable records to pukat_audit_logs for every significant action.
 */
class AuditLogService {

	/**
	 * Log an action.
	 *
	 * @param string   $action      Dot-notation action name, e.g. 'campaign.created'.
	 * @param array    $details     Optional JSON-serialisable payload.
	 * @param int|null $user_id     WP user ID. Defaults to current user.
	 * @param string   $object_type Optional object type, e.g. 'campaign'.
	 * @param int|null $object_id   Optional object ID.
	 */
	public static function log(
		string $action,
		array $details = [],
		?int $user_id = null,
		string $object_type = '',
		?int $object_id = null
	): void {
		global $wpdb;

		$user_id    = $user_id ?? get_current_user_id();
		$user       = get_userdata( $user_id );
		$user_email = $user ? $user->user_email : '';

		$wpdb->insert(
			$wpdb->prefix . 'pukat_audit_logs',
			[
				'user_id'     => $user_id,
				'user_email'  => $user_email,
				'action'      => sanitize_text_field( $action ),
				'object_type' => sanitize_text_field( $object_type ),
				'object_id'   => $object_id,
				'details'     => ! empty( $details ) ? wp_json_encode( $details ) : null,
				'ip_address'  => self::get_ip(),
				'user_agent'  => isset( $_SERVER['HTTP_USER_AGENT'] )
					? sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) )
					: '',
			]
		);
	}

	/**
	 * Get audit logs with optional filtering.
	 *
	 * @param array $args {
	 *   @type int    $limit   Max rows. Default 50.
	 *   @type int    $offset  Pagination offset.
	 *   @type int    $user_id Filter by user.
	 *   @type string $action  Filter by action prefix.
	 * }
	 * @return array
	 */
	public static function get_logs( array $args = [] ): array {
		global $wpdb;

		$limit  = min( (int) ( $args['limit'] ?? 50 ), 500 );
		$offset = (int) ( $args['offset'] ?? 0 );
		$table  = $wpdb->prefix . 'pukat_audit_logs';

		$where  = [];
		$params = [];

		if ( ! empty( $args['user_id'] ) ) {
			$where[]  = 'user_id = %d';
			$params[] = (int) $args['user_id'];
		}

		if ( ! empty( $args['action'] ) ) {
			$where[]  = 'action LIKE %s';
			$params[] = $wpdb->esc_like( $args['action'] ) . '%';
		}

		$where_sql = $where ? 'WHERE ' . implode( ' AND ', $where ) : '';
		$params[]  = $limit;
		$params[]  = $offset;

		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table} {$where_sql} ORDER BY created_at DESC LIMIT %d OFFSET %d",
				...$params
			),
			ARRAY_A
		) ?: [];
	}

	/**
	 * Get the client IP address.
	 *
	 * @return string
	 */
	private static function get_ip(): string {
		$keys = [ 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ];
		foreach ( $keys as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				$ip = sanitize_text_field( wp_unslash( explode( ',', $_SERVER[ $key ] )[0] ) );
				if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
					return $ip;
				}
			}
		}
		return '';
	}
}
