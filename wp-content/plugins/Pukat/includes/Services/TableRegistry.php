<?php
/**
 * Server-driven table registry.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\Table\AuditLogTableRepository;
use Pukat\Repositories\Table\CampaignTableRepository;
use Pukat\Repositories\Table\DynamicDomainTableRepository;
use Pukat\Repositories\Table\EmailTemplateTableRepository;
use Pukat\Repositories\Table\LandingPageTableRepository;
use Pukat\Repositories\Table\SendingProfileTableRepository;

/**
 * Whitelist registry for server-driven tables.
 *
 * `table_key` values coming from the client are only ever trusted after being
 * checked against this list — the repository class, sortable columns, filter
 * keys, and search fields for a table all live here so no raw table/column
 * name from the frontend ever reaches SQL.
 */
class TableRegistry {

	private const TABLES = [
		'sending_profiles' => [
			'title'              => 'Sending profiles',
			'repository'         => SendingProfileTableRepository::class,
			'search_placeholder' => 'Search sending profiles...',
			'search_fields'      => [ 'name', 'from_email', 'from_name', 'reply_to' ],
			'sortable'           => [ 'name', 'from_email', 'environment', 'status', 'entity', 'created_at' ],
			'default_sort'       => 'name',
			'default_order'      => 'asc',
			'default_per_page'   => 25,
			'max_per_page'       => 100,
			'filters'            => [
				'status'      => [
					'label'   => 'Status',
					'type'    => 'select',
					'options' => [ 'draft', 'review', 'approved', 'active', 'inactive', 'deprecated', 'archived' ],
				],
				'environment' => [
					'label'   => 'Environment',
					'type'    => 'select',
					'options' => [ 'production', 'staging', 'development' ],
				],
				'entity'      => [
					'label' => 'Entity',
					'type'  => 'text',
				],
			],
			// Columns marked sortable=false are sourced live from GoPhish (host/port/encryption/from
			// address/last sync) rather than this WordPress reference table — GoPhish has no query
			// API to push search/sort/filter down into, so those columns are decoration only.
			'columns'            => [
				[ 'key' => 'name', 'label' => 'Profile name', 'renderer' => 'text_with_subtext', 'subtextKey' => 'host', 'sortable' => true ],
				[ 'key' => 'host_port', 'label' => 'Host / Port', 'renderer' => 'text', 'sortable' => false ],
				[ 'key' => 'from', 'label' => 'From address', 'renderer' => 'email', 'sortable' => false ],
				[ 'key' => 'encryption', 'label' => 'Encryption', 'renderer' => 'badge', 'sortable' => false ],
				[ 'key' => 'status', 'label' => 'Status', 'renderer' => 'status_badge', 'toneMap' => [
					'active'     => 'success',
					'approved'   => 'success',
					'review'     => 'info',
					'draft'      => 'gray',
					'inactive'   => 'gray',
					'deprecated' => 'warning',
					'archived'   => 'gray',
				], 'sortable' => true ],
				[ 'key' => 'entity', 'label' => 'Entity', 'renderer' => 'badge', 'sortable' => true ],
				[ 'key' => 'id', 'label' => 'Actions', 'renderer' => 'actions', 'align' => 'right', 'sortable' => false ],
			],
			'row_actions'        => [ 'assign', 'edit', 'duplicate', 'test' ],
			'bulk_actions'       => [],
		],

		'landing_pages' => [
			'title'              => 'Landing pages',
			'repository'         => LandingPageTableRepository::class,
			'search_placeholder' => 'Search landing pages...',
			'search_fields'      => [ 'name', 'description' ],
			'sortable'           => [ 'name', 'category', 'entity', 'created_at' ],
			'default_sort'       => 'name',
			'default_order'      => 'asc',
			'default_per_page'   => 25,
			'max_per_page'       => 100,
			'filters'            => [
				'category' => [
					'label'   => 'Type',
					'type'    => 'select',
					'options' => [ 'login', 'form', 'redirect' ],
				],
				'status'   => [
					'label'   => 'Status',
					'type'    => 'select',
					'options' => [ 'draft', 'review', 'approved', 'active', 'inactive', 'deprecated', 'archived' ],
				],
				'entity'   => [
					'label' => 'Entity',
					'type'  => 'text',
				],
			],
			// `redirect_url` comes from the latest version join (see LandingPageTableRepository),
			// not the master table, so it isn't sortable/filterable server-side.
			'columns'            => [
				[ 'key' => 'name', 'label' => 'Landing page', 'renderer' => 'text_with_subtext', 'subtextKey' => 'description', 'sortable' => true ],
				[ 'key' => 'category', 'label' => 'Type', 'renderer' => 'badge', 'sortable' => true ],
				[ 'key' => 'redirect_url', 'label' => 'Redirect URL', 'renderer' => 'text', 'sortable' => false ],
				[ 'key' => 'entity', 'label' => 'Entity', 'renderer' => 'badge', 'sortable' => true ],
				[ 'key' => 'id', 'label' => 'Actions', 'renderer' => 'actions', 'align' => 'right', 'sortable' => false ],
			],
			'row_actions'        => [ 'assign', 'edit', 'preview', 'delete' ],
			'bulk_actions'       => [],
		],

		'email_templates' => [
			'title'              => 'Email templates',
			'repository'         => EmailTemplateTableRepository::class,
			'search_placeholder' => 'Search email templates...',
			'search_fields'      => [ 'name', 'description', 'entity' ],
			'sortable'           => [ 'name', 'category', 'entity', 'created_at' ],
			'default_sort'       => 'name',
			'default_order'      => 'asc',
			'default_per_page'   => 25,
			'max_per_page'       => 100,
			'filters'            => [
				'category' => [
					'label'   => 'Category',
					'type'    => 'select',
					'options' => [ 'alert', 'info', 'urgent' ],
				],
				'status'   => [
					'label'   => 'Status',
					'type'    => 'select',
					'options' => [ 'draft', 'review', 'approved', 'active', 'inactive', 'deprecated', 'archived' ],
				],
				'entity'   => [
					'label' => 'Entity',
					'type'  => 'text',
				],
			],
			// `subject` comes from the latest version join, not the master table, so it isn't
			// sortable/filterable server-side. `status` shown to the user is a derived Published/
			// Draft badge (see TableQueryService::decorate_email_template_row), not the raw
			// multi-value lifecycle status, so it isn't a sortable column either — only a filter
			// against the raw value.
			'columns'            => [
				[ 'key' => 'name', 'label' => 'Email template', 'renderer' => 'text_with_subtext', 'subtextKey' => 'description', 'sortable' => true ],
				[ 'key' => 'category', 'label' => 'Category', 'renderer' => 'badge', 'sortable' => true ],
				[ 'key' => 'subject', 'label' => 'Subject', 'renderer' => 'text', 'sortable' => false ],
				[ 'key' => 'status', 'label' => 'Status', 'renderer' => 'status_badge', 'toneMap' => [
					'Published' => 'success',
					'Draft'     => 'warning',
				], 'sortable' => false ],
				[ 'key' => 'entity', 'label' => 'Entity', 'renderer' => 'badge', 'sortable' => true ],
				[ 'key' => 'id', 'label' => 'Actions', 'renderer' => 'actions', 'align' => 'right', 'sortable' => false ],
			],
			'row_actions'        => [ 'assign', 'edit', 'preview', 'delete' ],
			'bulk_actions'       => [],
		],

		'dynamic_domains' => [
			'title'              => 'Dynamic domains',
			'repository'         => DynamicDomainTableRepository::class,
			'search_placeholder' => 'Search domains...',
			'search_fields'      => [ 'domain' ],
			'sortable'           => [ 'domain', 'owner_entity', 'status', 'created_at' ],
			'default_sort'       => 'domain',
			'default_order'      => 'asc',
			'default_per_page'   => 25,
			'max_per_page'       => 100,
			'filters'            => [
				'dns_status'           => [
					'label'   => 'DNS status',
					'type'    => 'select',
					'options' => [ 'healthy', 'unhealthy', 'unknown' ],
				],
				'tls_status'           => [
					'label'   => 'TLS status',
					'type'    => 'select',
					'options' => [ 'healthy', 'unhealthy', 'unknown' ],
				],
				'authorization_status' => [
					'label'   => 'Authorization',
					'type'    => 'select',
					'options' => [ 'pending', 'authorized', 'rejected', 'expired' ],
				],
				'status'               => [
					'label'   => 'Status',
					'type'    => 'select',
					'options' => [ 'draft', 'active', 'inactive' ],
				],
				'owner_entity'         => [
					'label' => 'Entity',
					'type'  => 'text',
				],
			],
			// `type` is derived server-side from base_landing_url/tracking_url presence (see
			// TableQueryService::decorate_dynamic_domain_row) — real data, but not a stored column,
			// so it isn't sortable/filterable. Deliberately trimmed vs. the legacy admin page: the
			// old DNS SPF/DKIM/MX breakdown, SSL expiry countdown, "next refresh" timer, and
			// dependency-blocking delete check were all client-fabricated from a single status
			// field (or literally hardcoded), not real per-check data — dropped rather than given
			// false rigor here.
			'columns'            => [
				[ 'key' => 'domain', 'label' => 'Domain', 'renderer' => 'text_with_subtext', 'subtextKey' => 'environment', 'sortable' => true ],
				[ 'key' => 'type', 'label' => 'Type', 'renderer' => 'badge', 'toneMap' => [
					'sending' => 'info',
					'landing' => 'success',
					'both'    => 'violet',
				], 'sortable' => false ],
				[ 'key' => 'dns_status', 'label' => 'DNS', 'renderer' => 'badge', 'toneMap' => [
					'healthy'   => 'success',
					'unhealthy' => 'danger',
					'unknown'   => 'gray',
				], 'sortable' => false ],
				[ 'key' => 'tls_status', 'label' => 'TLS', 'renderer' => 'badge', 'toneMap' => [
					'healthy'   => 'success',
					'unhealthy' => 'danger',
					'unknown'   => 'gray',
				], 'sortable' => false ],
				[ 'key' => 'authorization_status', 'label' => 'Authorization', 'renderer' => 'badge', 'toneMap' => [
					'authorized' => 'success',
					'rejected'   => 'danger',
					'expired'    => 'warning',
					'pending'    => 'gray',
				], 'sortable' => false ],
				[ 'key' => 'status', 'label' => 'Status', 'renderer' => 'status_badge', 'toneMap' => [
					'active'   => 'success',
					'inactive' => 'gray',
					'draft'    => 'gray',
				], 'sortable' => true ],
				[ 'key' => 'owner_entity', 'label' => 'Entity', 'renderer' => 'badge', 'sortable' => true ],
				[ 'key' => 'id', 'label' => 'Actions', 'renderer' => 'actions', 'align' => 'right', 'sortable' => false ],
			],
			'row_actions'        => [ 'edit', 'duplicate', 'validate', 'authorize', 'delete' ],
			'bulk_actions'       => [],
		],

		'campaigns' => [
			'title'              => 'Campaigns',
			'repository'         => CampaignTableRepository::class,
			'search_placeholder' => 'Search campaigns...',
			'search_fields'      => [ 'name' ],
			'sortable'           => [ 'name', 'status', 'difficulty', 'launched_at', 'created_at' ],
			'default_sort'       => 'created_at',
			'default_order'      => 'desc',
			'default_per_page'   => 10,
			'max_per_page'       => 100,
			'filters'            => [
				'status' => [
					'label'   => 'Status',
					'type'    => 'select',
					'options' => [ 'draft', 'scheduled', 'active', 'paused', 'completed' ],
				],
			],
			// `pukat_campaigns` has no entity/owner column — CampaignController::get_campaigns()
			// never scoped visibility by entity, so this table doesn't either. `id_label` and
			// `display_date` are computed in TableQueryService::decorate_campaign_row() (a subtext
			// string and a launched_at-falls-back-to-scheduled_at value), so neither is sortable.
			// `target_count` is a real COUNT(*) against pukat_targets (the legacy list endpoint
			// never computed it — it always rendered as blank), also not sortable (aggregate).
			'columns'            => [
				[ 'key' => 'name', 'label' => 'Campaign', 'renderer' => 'text_with_subtext', 'subtextKey' => 'id_label', 'sortable' => true ],
				[ 'key' => 'status', 'label' => 'Status', 'renderer' => 'status_badge', 'toneMap' => [
					'active'    => 'info',
					'completed' => 'success',
					'paused'    => 'warning',
					'draft'     => 'gray',
					'scheduled' => 'gray',
				], 'sortable' => true ],
				[ 'key' => 'target_count', 'label' => 'Target', 'renderer' => 'number', 'sortable' => false ],
				[ 'key' => 'difficulty', 'label' => 'Difficulty (1-5)', 'renderer' => 'number', 'sortable' => true ],
				[ 'key' => 'display_date', 'label' => 'Date', 'renderer' => 'date', 'sortable' => false ],
				[ 'key' => 'id', 'label' => 'Actions', 'renderer' => 'actions', 'align' => 'right', 'sortable' => false ],
			],
			'row_actions'        => [ 'view_report', 'delete' ],
			'bulk_actions'       => [],
		],

		'audit_logs' => [
			'title'              => 'Audit log',
			'repository'         => AuditLogTableRepository::class,
			'search_placeholder' => 'Search by user or action...',
			'search_fields'      => [ 'user_email', 'action' ],
			'sortable'           => [ 'created_at', 'user_email', 'action' ],
			'default_sort'       => 'created_at',
			'default_order'      => 'desc',
			'default_per_page'   => 50,
			'max_per_page'       => 100,
			'filters'            => [
				'action' => [
					'label' => 'Action',
					'type'  => 'text',
				],
			],
			// pukat_audit_logs is an immutable trail — no entity column (admin-only, cross-user
			// view), no row actions at all. `object_label` is object_type + object_id combined
			// server-side (see TableQueryService::decorate_audit_log_row), so it isn't sortable.
			'columns'            => [
				[ 'key' => 'created_at', 'label' => 'Time', 'renderer' => 'datetime', 'sortable' => true ],
				[ 'key' => 'user_email', 'label' => 'User', 'renderer' => 'text', 'sortable' => true ],
				[ 'key' => 'action', 'label' => 'Action', 'renderer' => 'text', 'sortable' => true ],
				[ 'key' => 'object_label', 'label' => 'Object', 'renderer' => 'text', 'sortable' => false ],
				[ 'key' => 'ip_address', 'label' => 'IP', 'renderer' => 'text', 'sortable' => false ],
			],
			'row_actions'        => [],
			'bulk_actions'       => [],
		],
	];

	public static function has( string $table_key ): bool {
		return isset( self::TABLES[ $table_key ] );
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public static function get( string $table_key ): ?array {
		return self::TABLES[ $table_key ] ?? null;
	}

	/**
	 * @return array<int, string>
	 */
	public static function keys(): array {
		return array_keys( self::TABLES );
	}
}
