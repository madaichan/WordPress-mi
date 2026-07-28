<?php
/**
 * Server-driven table REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\TableQueryService;
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

	private TableQueryService $tables;

	public function __construct( ?TableQueryService $tables = null ) {
		$this->tables = $tables ?? new TableQueryService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/tables/(?P<table_key>[a-z_]+)/schema', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_schema' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );

		register_rest_route( $this->namespace, '/tables/(?P<table_key>[a-z_]+)/rows', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_rows' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );
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
