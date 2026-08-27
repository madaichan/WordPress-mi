<?php
/**
 * Server-driven table query validation and orchestration.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use WP_Error;
use WP_REST_Request;

/**
 * Validates table_key/search/sort/filter/pagination input against
 * TableRegistry, then delegates the actual query to the registered
 * repository.
 *
 * This is the only place request params are allowed to reach a table
 * repository — never let raw request params flow into SQL identifiers
 * (sort column, filter keys) without passing through the allowlist checks
 * here first.
 */
class TableQueryService {

	private const MAX_SEARCH_LENGTH = 100;

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_schema( string $table_key ): array|WP_Error {
		$config = TableRegistry::get( $table_key );
		if ( null === $config ) {
			return $this->invalid_table_key_error( $table_key );
		}

		return [
			'table_key'      => $table_key,
			'schema_version' => 1,
			'title'          => $config['title'],
			'search'         => [ 'placeholder' => $config['search_placeholder'] ?? __( 'Search...', 'pukat' ) ],
			'columns'        => $config['columns'],
			'filters'        => $this->schema_filters( $config['filters'] ?? [] ),
			'row_actions'    => $config['row_actions'] ?? [],
			'bulk_actions'   => $config['bulk_actions'] ?? [],
			'defaults'       => [
				'sort'     => $config['default_sort'],
				'order'    => $config['default_order'],
				'per_page' => $config['default_per_page'],
			],
			'limits'         => [ 'max_per_page' => $config['max_per_page'] ],
		];
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_rows( string $table_key, WP_REST_Request $request ): array|WP_Error {
		$config = TableRegistry::get( $table_key );
		if ( null === $config ) {
			return $this->invalid_table_key_error( $table_key );
		}

		$pagination = $this->validate_pagination( $request, $config );
		if ( $pagination instanceof WP_Error ) {
			return $pagination;
		}

		$sort = $this->validate_sort( $request, $config );
		if ( $sort instanceof WP_Error ) {
			return $sort;
		}

		$filters = $this->validate_filters( $request, $config );
		if ( $filters instanceof WP_Error ) {
			return $filters;
		}

		$search = mb_substr( sanitize_text_field( (string) $request->get_param( 'search' ) ), 0, self::MAX_SEARCH_LENGTH );

		$args = [
			'search'        => $search,
			'search_fields' => $config['search_fields'] ?? [],
			'sort'          => $sort['sort'],
			'order'         => $sort['order'],
			'filters'       => $filters,
			'page'          => $pagination['page'],
			'per_page'      => $pagination['per_page'],
			'viewer_entity' => $this->viewer_entity_scope(),
		];

		$repository_class = $config['repository'];
		$repository        = new $repository_class();

		$total = $repository->count( $args );
		$rows  = $repository->rows( $args );
		$gophish = 'sending_profiles' === $table_key ? $this->gophish_sending_profiles_by_id() : [];

		// One MasterComponentService instance for the whole page of rows, not one per row: its
		// active_campaign_run_rows() is memoized per instance, so reusing it turns what used to be
		// one campaign_runs_by_status() query per row into a single query for the entire response.
		$master_component_service = new MasterComponentService();
		$rows = array_map(
			fn( array $row ): array => $this->decorate_row( $table_key, $row, $gophish, $master_component_service ),
			$rows
		);

		return [
			'table_key'      => $table_key,
			'schema_version' => 1,
			'rows'           => $rows,
			'meta'           => [
				'page'     => $args['page'],
				'per_page' => $args['per_page'],
				'total'    => $total,
				'has_next' => ( $args['page'] * $args['per_page'] ) < $total,
			],
		];
	}

	// -------------------------------------------------------------------------
	// Row decoration — one method per table_key, dispatched below. Each table's
	// usage/permission semantics differ enough (see resolve_*_row_actions) that
	// a single generic decorator would need as many special cases as separate
	// methods do; this keeps each table's rules easy to read in isolation.
	// -------------------------------------------------------------------------

	/**
	 * @param array<string, mixed>             $row                       Raw, narrowly-projected DB row.
	 * @param array<int, array<string, mixed>> $gophish                   Live GoPhish sending profiles keyed by GoPhish id (sending_profiles only).
	 * @param MasterComponentService           $master_component_service  Shared across the whole page of rows — see get_rows().
	 * @return array<string, mixed>
	 */
	private function decorate_row( string $table_key, array $row, array $gophish, MasterComponentService $master_component_service ): array {
		if ( isset( $row['created_at'] ) && '' !== $row['created_at'] ) {
			$timestamp = strtotime( (string) $row['created_at'] );
			if ( false !== $timestamp ) {
				$row['created_at'] = gmdate( 'c', $timestamp );
			}
		}

		if ( 'landing_pages' === $table_key ) {
			return $this->decorate_landing_page_row( $row, $master_component_service );
		}

		if ( 'email_templates' === $table_key ) {
			return $this->decorate_email_template_row( $row, $master_component_service );
		}

		if ( 'dynamic_domains' === $table_key ) {
			return $this->decorate_dynamic_domain_row( $row );
		}

		if ( 'campaigns' === $table_key ) {
			return $this->decorate_campaign_row( $row );
		}

		if ( 'audit_logs' === $table_key ) {
			return $this->decorate_audit_log_row( $row );
		}

		if ( 'sending_profiles' === $table_key ) {
			return $this->decorate_sending_profile_row( $row, $gophish, $master_component_service );
		}

		$row['row_actions'] = [];
		return $row;
	}

	/**
	 * @param array<string, mixed>             $row                      Raw, narrowly-projected DB row.
	 * @param array<int, array<string, mixed>> $gophish                  Live GoPhish sending profiles keyed by GoPhish id.
	 * @param MasterComponentService           $master_component_service Shared across the whole page — see get_rows().
	 * @return array<string, mixed>
	 */
	private function decorate_sending_profile_row( array $row, array $gophish, MasterComponentService $master_component_service ): array {
		$row = $this->merge_gophish_smtp_fields( $row, $gophish );

		$full = $master_component_service->get_sending_profile( (int) $row['id'] );

		$row['edit_locked']      = (bool) ( $full['edit_locked'] ?? false );
		$row['edit_lock_reason'] = (string) ( $full['edit_lock_reason'] ?? '' );
		$row['row_actions']      = $this->resolve_sending_profile_row_actions( $row );

		return $row;
	}

	/**
	 * @param array<string, mixed>   $row                      Raw, narrowly-projected DB row (master + latest version join).
	 * @param MasterComponentService $master_component_service Shared across the whole page — see get_rows().
	 * @return array<string, mixed>
	 */
	private function decorate_landing_page_row( array $row, MasterComponentService $master_component_service ): array {
		$capture_settings  = json_decode( (string) ( $row['capture_settings_json'] ?? '' ), true ) ?: [];
		$redirect_settings = json_decode( (string) ( $row['redirect_settings_json'] ?? '' ), true ) ?: [];

		unset( $row['capture_settings_json'], $row['redirect_settings_json'] );

		$row['capture_credentials'] = (bool) ( $capture_settings['capture_credentials'] ?? false );
		$row['capture_passwords']   = (bool) ( $capture_settings['capture_passwords'] ?? false );
		$row['redirect_url']        = (string) ( $redirect_settings['redirect_url'] ?? '' );

		$full = $master_component_service->get_landing_page( (int) $row['id'] );

		$row['edit_locked']      = (bool) ( $full['edit_locked'] ?? false );
		$row['edit_lock_reason'] = (string) ( $full['edit_lock_reason'] ?? '' );
		$row['row_actions']      = $this->resolve_master_asset_row_actions(
			$row,
			[ 'assign', 'edit', 'delete' ],
			[ 'preview' ]
		);

		return $row;
	}

	/**
	 * @param array<string, mixed>   $row                      Raw, narrowly-projected DB row (master + latest version join).
	 * @param MasterComponentService $master_component_service Shared across the whole page — see get_rows().
	 * @return array<string, mixed>
	 */
	private function decorate_email_template_row( array $row, MasterComponentService $master_component_service ): array {
		// Mirrors pukat-app/src/utils/masterAssetHelpers.js#displayStatus: the frontend has never
		// surfaced the raw multi-value lifecycle status here, only a derived Published/Draft badge.
		$raw_status = (string) ( $row['version_status'] ?? '' ) ?: (string) ( $row['status'] ?? '' );
		unset( $row['version_status'] );
		$row['status'] = in_array( strtolower( $raw_status ), [ 'approved', 'active' ], true ) ? 'Published' : 'Draft';

		$full = $master_component_service->get_email_template( (int) $row['id'] );

		$row['edit_locked']      = (bool) ( $full['edit_locked'] ?? false );
		$row['edit_lock_reason'] = (string) ( $full['edit_lock_reason'] ?? '' );
		$row['row_actions']      = $this->resolve_master_asset_row_actions(
			$row,
			[ 'assign', 'edit', 'delete' ],
			[ 'preview' ]
		);

		return $row;
	}

	/**
	 * @param array<string, mixed> $row Raw, narrowly-projected DB row.
	 * @return array<string, mixed>
	 */
	private function decorate_dynamic_domain_row( array $row ): array {
		// Real data (derived from stored URLs), unlike the legacy admin page's fabricated
		// DNS/SSL/refresh-countdown display — see the TableRegistry comment on this table.
		$row['type'] = $this->dynamic_domain_type( $row );

		// prepare_dynamic_domain() has no usage/lock concept for domains at all — only the
		// entity-permission check applies (update/delete/health-check all call
		// enforce_existing_row_editable() against owner_entity server-side already).
		// resolve_master_asset_row_actions() reads $row['entity']; this table's column is
		// owner_entity, so a small adapter copy avoids forcing every table to share one column name.
		$permission_row           = $row;
		$permission_row['entity'] = $row['owner_entity'] ?? '';

		$row['row_actions'] = $this->resolve_master_asset_row_actions(
			$permission_row,
			[ 'edit', 'validate', 'authorize', 'delete' ],
			[ 'duplicate' ]
		);

		return $row;
	}

	private function dynamic_domain_type( array $row ): string {
		$has_landing = '' !== trim( (string) ( $row['base_landing_url'] ?? '' ) );
		$has_tracking = '' !== trim( (string) ( $row['tracking_url'] ?? '' ) );

		if ( $has_landing && $has_tracking ) {
			return 'both';
		}

		return $has_landing ? 'landing' : 'sending';
	}

	/**
	 * @param array<string, mixed> $row Raw, narrowly-projected DB row (includes computed target_count).
	 * @return array<string, mixed>
	 */
	private function decorate_campaign_row( array $row ): array {
		$row['id_label'] = sprintf( 'ID #%d', (int) ( $row['id'] ?? 0 ) );

		$launched_at = (string) ( $row['launched_at'] ?? '' );
		$display_date = '' !== $launched_at ? $launched_at : (string) ( $row['scheduled_at'] ?? '' );
		$timestamp = '' !== $display_date ? strtotime( $display_date ) : false;
		$row['display_date'] = false !== $timestamp ? gmdate( 'c', $timestamp ) : '';

		// pukat_campaigns has no entity/lock concept at all, and delete_campaign() has no
		// permission check beyond the route's permission_manage gate — both actions are
		// always enabled, matching current behavior exactly.
		$row['row_actions'] = [
			[ 'key' => 'view_report', 'disabled' => false, 'reason' => '' ],
			[ 'key' => 'delete', 'disabled' => false, 'reason' => '' ],
		];

		return $row;
	}

	/**
	 * @param array<string, mixed> $row Raw, narrowly-projected DB row.
	 * @return array<string, mixed>
	 */
	private function decorate_audit_log_row( array $row ): array {
		$object_type = trim( (string) ( $row['object_type'] ?? '' ) );
		$object_id   = (int) ( $row['object_id'] ?? 0 );

		$row['object_label'] = '' !== $object_type
			? $object_type . ( $object_id > 0 ? " #{$object_id}" : '' )
			: '';

		unset( $row['object_type'], $row['object_id'] );

		// Immutable audit trail — no row actions at all.
		$row['row_actions'] = [];

		return $row;
	}

	/**
	 * Fetch every live GoPhish sending profile once per request, keyed by its
	 * GoPhish id, so decorate_row() can merge host/port/encryption/from without
	 * an HTTP round-trip per row.
	 *
	 * @return array<int, array<string, mixed>>
	 */
	private function gophish_sending_profiles_by_id(): array {
		$profiles = ( new GoPhishService() )->get_sending_profiles();
		if ( is_wp_error( $profiles ) ) {
			return [];
		}

		$by_id = [];
		foreach ( $profiles as $profile ) {
			if ( isset( $profile['id'] ) ) {
				$by_id[ (int) $profile['id'] ] = $profile;
			}
		}

		return $by_id;
	}

	/**
	 * Merge presentation-only fields sourced live from GoPhish (host, port,
	 * encryption, from address) into a ref-table row. These are never
	 * sortable/filterable server-side — GoPhish has no query API for that.
	 *
	 * @param array<string, mixed>             $row     Ref-table row.
	 * @param array<int, array<string, mixed>> $gophish Live GoPhish profiles keyed by id.
	 * @return array<string, mixed>
	 */
	private function merge_gophish_smtp_fields( array $row, array $gophish ): array {
		$gophish_id = (int) ( $row['gophish_sending_profile_id'] ?? 0 );
		$profile    = $gophish_id > 0 ? ( $gophish[ $gophish_id ] ?? null ) : null;

		if ( null === $profile ) {
			$row['host']       = '';
			$row['host_port']  = __( 'Not linked to GoPhish', 'pukat' );
			$row['from']       = $row['from_email'] ?? '';
			$row['encryption'] = '';
			return $row;
		}

		[ $host, $port ] = $this->split_smtp_host( (string) ( $profile['host'] ?? '' ) );

		$row['host']       = $host;
		$row['host_port']  = '' !== $host ? "{$host}:{$port}" : '';
		$row['from']       = (string) ( $profile['from_address'] ?? $row['from_email'] ?? '' );
		$row['encryption'] = $this->smtp_encryption_for_port( $port );

		return $row;
	}

	/**
	 * Mirrors pukat-app/src/utils/smtpProfileHelpers.js#splitSmtpHost.
	 *
	 * @return array{0: string, 1: int}
	 */
	private function split_smtp_host( string $host_with_port ): array {
		if ( preg_match( '/^(.+):(\d+)$/', $host_with_port, $matches ) ) {
			return [ $matches[1], (int) $matches[2] ];
		}

		return [ $host_with_port, 587 ];
	}

	/**
	 * Mirrors pukat-app/src/utils/smtpProfileHelpers.js#getSmtpEncryptionForPort.
	 */
	private function smtp_encryption_for_port( int $port ): string {
		if ( 465 === $port ) {
			return 'SSL';
		}
		if ( 25 === $port ) {
			return 'None';
		}
		return 'TLS';
	}

	/**
	 * @param array<string, mixed> $row Decorated row (includes edit_locked/entity/gophish_sending_profile_id).
	 * @return array<int, array<string, mixed>>
	 */
	private function resolve_sending_profile_row_actions( array $row ): array {
		// Every mutation (assign/edit/duplicate/test) is proxied through GoPhish by its own
		// numeric id, so a reference row with no GoPhish link has nothing any of them can act on.
		$linked = (int) ( $row['gophish_sending_profile_id'] ?? 0 ) > 0;
		if ( ! $linked ) {
			$reason = __( 'This reference is not linked to a GoPhish sending profile yet.', 'pukat' );
			return [
				[ 'key' => 'assign', 'disabled' => true, 'reason' => $reason ],
				[ 'key' => 'edit', 'disabled' => true, 'reason' => $reason ],
				[ 'key' => 'duplicate', 'disabled' => true, 'reason' => $reason ],
				[ 'key' => 'test', 'disabled' => true, 'reason' => $reason ],
			];
		}

		$locked          = (bool) ( $row['edit_locked'] ?? false );
		$can_edit_entity = $this->current_user_can_edit_row_entity( (string) ( $row['entity'] ?? '' ) );
		$disabled        = $locked || ! $can_edit_entity;

		$reason = '';
		if ( $locked ) {
			$reason = (string) ( $row['edit_lock_reason'] ?? '' );
		} elseif ( ! $can_edit_entity ) {
			$reason = __( 'General components and components from other entities can only be edited by admins.', 'pukat' );
		}

		return [
			[ 'key' => 'assign', 'disabled' => $disabled, 'reason' => $reason ],
			[ 'key' => 'edit', 'disabled' => $disabled, 'reason' => $reason ],
			// Duplicating creates a new profile rather than mutating this one, so it is never locked.
			[ 'key' => 'duplicate', 'disabled' => false, 'reason' => '' ],
			[ 'key' => 'test', 'disabled' => $disabled, 'reason' => $reason ],
		];
	}

	/**
	 * Shared shape for "master asset" tables: a set of actions gated by
	 * edit_locked/entity permission (assign/edit/delete-style), plus a set
	 * that's always enabled (preview-style, since it never mutates anything).
	 *
	 * @param array<string, mixed> $row               Decorated row (includes edit_locked/entity).
	 * @param array<int, string>   $gated_action_keys  Actions disabled when locked or not entity-editable.
	 * @param array<int, string>   $always_action_keys Actions never disabled.
	 * @return array<int, array<string, mixed>>
	 */
	private function resolve_master_asset_row_actions( array $row, array $gated_action_keys, array $always_action_keys = [] ): array {
		$locked          = (bool) ( $row['edit_locked'] ?? false );
		$can_edit_entity = $this->current_user_can_edit_row_entity( (string) ( $row['entity'] ?? '' ) );
		$disabled        = $locked || ! $can_edit_entity;

		$reason = '';
		if ( $locked ) {
			$reason = (string) ( $row['edit_lock_reason'] ?? '' );
		} elseif ( ! $can_edit_entity ) {
			$reason = __( 'General components and components from other entities can only be edited by admins.', 'pukat' );
		}

		$actions = [];
		foreach ( $gated_action_keys as $key ) {
			$actions[] = [ 'key' => $key, 'disabled' => $disabled, 'reason' => $reason ];
		}
		foreach ( $always_action_keys as $key ) {
			$actions[] = [ 'key' => $key, 'disabled' => false, 'reason' => '' ];
		}

		return $actions;
	}

	// -------------------------------------------------------------------------
	// Current-user entity/role helpers (mirrors the pattern already duplicated
	// in GoPhishProxy and MasterComponentService).
	// -------------------------------------------------------------------------

	private function current_user_can_edit_row_entity( string $row_entity ): bool {
		if ( $this->current_user_can_admin_assets() ) {
			return true;
		}

		$user_entity = strtolower( $this->current_user_entity() );
		$row_entity  = strtolower( trim( $row_entity ) );

		return '' !== $user_entity && '' !== $row_entity && 'general' !== $row_entity && $row_entity === $user_entity;
	}

	private function current_user_can_admin_assets(): bool {
		return current_user_can( 'pukat_manage_settings' ) || current_user_can( 'administrator' );
	}

	private function current_user_entity(): string {
		$user_id = get_current_user_id();
		$entity  = (string) get_user_meta( $user_id, 'meta_entity', true );

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'entity', true );
		}

		if ( '' === trim( $entity ) ) {
			$entity = (string) get_user_meta( $user_id, 'pukat_entity', true );
		}

		return sanitize_text_field( $entity );
	}

	/**
	 * Null means unrestricted (admin). A non-empty string scopes rows to
	 * General plus that entity. A sentinel guards users with no entity set
	 * from ever matching an empty entity column.
	 */
	private function viewer_entity_scope(): ?string {
		if ( $this->current_user_can_admin_assets() ) {
			return null;
		}

		$entity = $this->current_user_entity();

		return '' !== $entity ? $entity : '__none__';
	}

	// -------------------------------------------------------------------------
	// Validation
	// -------------------------------------------------------------------------

	/**
	 * @param array<string, mixed> $config
	 * @return array{page: int, per_page: int}|WP_Error
	 */
	private function validate_pagination( WP_REST_Request $request, array $config ): array|WP_Error {
		$page_param = $request->get_param( 'page' );
		$page       = null === $page_param ? 1 : filter_var( $page_param, FILTER_VALIDATE_INT );
		if ( false === $page || $page < 1 ) {
			return $this->validation_error( 'invalid_pagination', __( 'The "page" parameter must be a positive integer.', 'pukat' ) );
		}

		$per_page_param = $request->get_param( 'per_page' );
		$per_page       = null === $per_page_param ? (int) $config['default_per_page'] : filter_var( $per_page_param, FILTER_VALIDATE_INT );
		if ( false === $per_page || $per_page < 1 ) {
			return $this->validation_error( 'invalid_pagination', __( 'The "per_page" parameter must be a positive integer.', 'pukat' ) );
		}

		$per_page = min( $per_page, (int) $config['max_per_page'] );

		return [ 'page' => $page, 'per_page' => $per_page ];
	}

	/**
	 * @param array<string, mixed> $config
	 * @return array{sort: string, order: string}|WP_Error
	 */
	private function validate_sort( WP_REST_Request $request, array $config ): array|WP_Error {
		$sortable = (array) ( $config['sortable'] ?? [] );

		$sort_param = $request->get_param( 'sort' );
		$sort       = null === $sort_param ? (string) $config['default_sort'] : sanitize_key( (string) $sort_param );
		if ( ! in_array( $sort, $sortable, true ) ) {
			return $this->validation_error( 'invalid_sort', __( 'Unknown or unsortable "sort" column.', 'pukat' ) );
		}

		$order_param = $request->get_param( 'order' );
		$order       = null === $order_param ? (string) $config['default_order'] : strtolower( sanitize_key( (string) $order_param ) );
		if ( ! in_array( $order, [ 'asc', 'desc' ], true ) ) {
			return $this->validation_error( 'invalid_sort', __( 'The "order" parameter must be "asc" or "desc".', 'pukat' ) );
		}

		return [ 'sort' => $sort, 'order' => $order ];
	}

	/**
	 * @param array<string, mixed> $config
	 * @return array<string, string>|WP_Error
	 */
	private function validate_filters( WP_REST_Request $request, array $config ): array|WP_Error {
		$allowed = (array) ( $config['filters'] ?? [] );
		$raw     = $request->get_param( 'filters' );
		$raw     = is_array( $raw ) ? $raw : [];

		$filters = [];
		foreach ( $raw as $key => $value ) {
			$key = sanitize_key( (string) $key );
			if ( ! isset( $allowed[ $key ] ) ) {
				return $this->validation_error(
					'invalid_filter',
					sprintf(
						/* translators: %s: filter key. */
						__( 'Unknown filter key "%s".', 'pukat' ),
						$key
					)
				);
			}
			$filters[ $key ] = sanitize_text_field( (string) $value );
		}

		return $filters;
	}

	/**
	 * @param array<string, mixed> $filters_config
	 * @return array<int, array<string, mixed>>
	 */
	private function schema_filters( array $filters_config ): array {
		$filters = [];
		foreach ( $filters_config as $key => $filter ) {
			$options = [];
			foreach ( (array) ( $filter['options'] ?? [] ) as $option ) {
				$options[] = [ 'value' => $option, 'label' => ucfirst( (string) $option ) ];
			}

			$filters[] = [
				'key'     => $key,
				'label'   => $filter['label'] ?? $key,
				'type'    => $filter['type'] ?? 'text',
				'options' => $options,
			];
		}

		return $filters;
	}

	private function invalid_table_key_error( string $table_key ): WP_Error {
		return new WP_Error(
			'invalid_table_key',
			sprintf(
				/* translators: %s: requested table key. */
				__( 'Unknown table key "%s".', 'pukat' ),
				$table_key
			),
			[ 'status' => 404 ]
		);
	}

	private function validation_error( string $code, string $message ): WP_Error {
		return new WP_Error( $code, $message, [ 'status' => 422 ] );
	}
}
