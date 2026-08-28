<?php
/**
 * Server-driven table REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\PermissionRegistry;
use Pukat\Services\TableQueryService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class TableController
 *
 * Generic schema-driven table endpoints. `table_key` is always checked
 * against TableRegistry (via TableQueryService) before anything is queried —
 * never a raw table/column name from the client.
 *
 * Endpoints:
 *   GET /pukat/v1/tables/{table_key}/schema
 *   GET /pukat/v1/tables/{table_key}/rows
 */
class TableController extends RestController {

	/**
	 * table_key -> Permission Registry key. Every table_key TableRegistry
	 * knows about must map here; see PermissionRegistry::all() for the
	 * capability each resolves to. table_key is the *page* it's exposed
	 * under, which may differ from its own name (e.g. the `sending_profiles`
	 * table_key backs the Master Sending Profiles admin page, not the
	 * non-master own-asset page — see Admin/MasterSendingProfiles.jsx).
	 */
	private const TABLE_KEY_PERMISSIONS = [
		'playbooks'        => 'master_playbooks.view',
		'sending_profiles' => 'master_sending_profiles.view',
		'landing_pages'    => 'master_landing_pages.view',
		'email_templates'  => 'master_email_templates.view',
		'dynamic_domains'  => 'domains.view',
		'campaigns'        => 'campaigns.view',
		'audit_logs'       => 'audit_logs.view',
	];

	private TableQueryService $tables;

	public function __construct( ?TableQueryService $tables = null ) {
		$this->tables = $tables ?? new TableQueryService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/tables/(?P<table_key>[a-z_]+)/schema', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_schema' ],
			'permission_callback' => [ $this, 'permission_view_table' ],
		] );

		register_rest_route( $this->namespace, '/tables/(?P<table_key>[a-z_]+)/rows', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_rows' ],
			'permission_callback' => [ $this, 'permission_view_table' ],
		] );
	}

	/**
	 * Phase 3 of docs/IMPLEMENTATION_PLAN_RBAC.md: table_key-aware
	 * permission check replacing the blanket permission_read(). An
	 * unrecognized table_key is deliberately allowed through here — that's
	 * not this callback's job to police, TableQueryService's own whitelist
	 * already returns a proper `invalid_table_key` (404) for it, and
	 * failing this check first would incorrectly turn that into a 403.
	 */
	public function permission_view_table( WP_REST_Request $request ): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}

		$table_key      = (string) $request->get_param( 'table_key' );
		$permission_key = self::TABLE_KEY_PERMISSIONS[ $table_key ] ?? null;

		if ( ! $permission_key ) {
			return true;
		}

		if ( ! current_user_can( PermissionRegistry::capability_for( $permission_key ) ) ) {
			return new WP_Error( 'rest_forbidden', __( 'You do not have permission to view this table.', 'pukat' ), [ 'status' => 403 ] );
		}

		return true;
	}

	public function get_schema( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->tables->get_schema( (string) $request->get_param( 'table_key' ) );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result );
	}

	public function get_rows( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->tables->get_rows( (string) $request->get_param( 'table_key' ), $request );
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result );
	}
}
