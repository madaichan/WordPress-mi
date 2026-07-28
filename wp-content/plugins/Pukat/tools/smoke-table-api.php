<?php
/**
 * Runtime smoke test for the server-driven table API.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-table-api.php
 *
 * @package Pukat
 */

declare(strict_types=1);

$wp_load = dirname( __DIR__, 4 ) . '/wp-load.php';
if ( ! file_exists( $wp_load ) ) {
	fwrite( STDERR, "wp-load.php was not found. Run this from a WordPress install.\n" );
	exit( 1 );
}

require $wp_load;

if ( ! class_exists( '\Pukat\Services\TableRegistry' ) ) {
	fwrite( STDERR, "Pukat table API is not loaded. Make sure the plugin is active.\n" );
	exit( 1 );
}

wp_set_current_user( 1 );
do_action( 'rest_api_init' );

/**
 * Execute a REST request inside WordPress.
 *
 * @return array{0: int, 1: mixed}
 */
function pukat_table_smoke_rest( string $method, string $route, array $params = [] ): array {
	$request = new WP_REST_Request( $method, $route );
	foreach ( $params as $key => $value ) {
		$request->set_param( $key, $value );
	}

	$response = rest_do_request( $request );

	return [ $response->get_status(), $response->get_data() ];
}

function pukat_table_smoke_expect( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

$failures = [];
$passed   = 0;

/**
 * @param callable(): void $test
 */
function pukat_table_smoke_run( string $label, callable $test, array &$failures, int &$passed ): void {
	try {
		$test();
		$passed++;
		echo "  [PASS] {$label}\n";
	} catch ( Throwable $e ) {
		$failures[] = "{$label}: {$e->getMessage()}";
		echo "  [FAIL] {$label}: {$e->getMessage()}\n";
	}
}

$table_keys = \Pukat\Services\TableRegistry::keys();
echo 'Registered table keys: ' . implode( ', ', $table_keys ) . "\n\n";

foreach ( $table_keys as $table_key ) {
	echo "=== {$table_key} ===\n";

	pukat_table_smoke_run( "{$table_key}: schema endpoint succeeds", function () use ( $table_key ) {
		[ $status, $body ] = pukat_table_smoke_rest( 'GET', "/pukat/v1/tables/{$table_key}/schema" );
		pukat_table_smoke_expect( 200 === $status, "expected 200, got {$status}" );
		pukat_table_smoke_expect( ! empty( $body['success'] ), 'success flag missing' );
		$schema = $body['data'];
		foreach ( [ 'table_key', 'schema_version', 'title', 'search', 'columns', 'filters', 'row_actions', 'bulk_actions', 'defaults', 'limits' ] as $key ) {
			pukat_table_smoke_expect( array_key_exists( $key, $schema ), "schema missing '{$key}'" );
		}
		pukat_table_smoke_expect( $table_key === $schema['table_key'], 'table_key mismatch in schema response' );
		pukat_table_smoke_expect( is_array( $schema['columns'] ) && count( $schema['columns'] ) > 0, 'schema has no columns' );
	}, $failures, $passed );

	pukat_table_smoke_run( "{$table_key}: rows endpoint succeeds and meta is well-formed", function () use ( $table_key ) {
		[ $status, $body ] = pukat_table_smoke_rest( 'GET', "/pukat/v1/tables/{$table_key}/rows", [ 'page' => 1, 'per_page' => 5 ] );
		pukat_table_smoke_expect( 200 === $status, "expected 200, got {$status}" );
		$data = $body['data'];
		foreach ( [ 'table_key', 'schema_version', 'rows', 'meta' ] as $key ) {
			pukat_table_smoke_expect( array_key_exists( $key, $data ), "rows response missing '{$key}'" );
		}
		foreach ( [ 'page', 'per_page', 'total', 'has_next' ] as $key ) {
			pukat_table_smoke_expect( array_key_exists( $key, $data['meta'] ), "meta missing '{$key}'" );
		}
		pukat_table_smoke_expect( is_array( $data['rows'] ), 'rows is not an array' );
		pukat_table_smoke_expect( count( $data['rows'] ) <= 5, 'per_page=5 returned more than 5 rows' );

		foreach ( $data['rows'] as $row ) {
			pukat_table_smoke_expect( array_key_exists( 'row_actions', $row ), 'row missing row_actions key' );
			pukat_table_smoke_expect( is_array( $row['row_actions'] ), 'row_actions is not an array' );
			foreach ( $row['row_actions'] as $action ) {
				foreach ( [ 'key', 'disabled', 'reason' ] as $action_key ) {
					pukat_table_smoke_expect( array_key_exists( $action_key, $action ), "row action missing '{$action_key}'" );
				}
			}
		}
	}, $failures, $passed );

	pukat_table_smoke_run( "{$table_key}: no sensitive/large fields leak into rows", function () use ( $table_key ) {
		[ , $body ] = pukat_table_smoke_rest( 'GET', "/pukat/v1/tables/{$table_key}/rows", [ 'page' => 1, 'per_page' => 5 ] );
		$forbidden = [ 'password', 'details', 'html_body', 'text_body', 'capture_settings_json', 'redirect_settings_json', 'version_status', 'allowed_domains_json', 'rate_limit_json', 'allowed_playbooks_json', 'allowed_sending_profiles_json' ];

		foreach ( $body['data']['rows'] as $row ) {
			foreach ( $forbidden as $field ) {
				pukat_table_smoke_expect( ! array_key_exists( $field, $row ), "row leaked forbidden field '{$field}'" );
			}
		}
	}, $failures, $passed );

	pukat_table_smoke_run( "{$table_key}: invalid sort is rejected", function () use ( $table_key ) {
		[ $status, $body ] = pukat_table_smoke_rest( 'GET', "/pukat/v1/tables/{$table_key}/rows", [ 'sort' => 'definitely_not_a_real_column; DROP TABLE wp_options;' ] );
		pukat_table_smoke_expect( 422 === $status, "expected 422, got {$status}" );
		pukat_table_smoke_expect( 'invalid_sort' === ( $body['code'] ?? null ), "expected code invalid_sort, got " . ( $body['code'] ?? 'null' ) );
	}, $failures, $passed );

	pukat_table_smoke_run( "{$table_key}: invalid pagination is rejected", function () use ( $table_key ) {
		[ $status, $body ] = pukat_table_smoke_rest( 'GET', "/pukat/v1/tables/{$table_key}/rows", [ 'page' => 0 ] );
		pukat_table_smoke_expect( 422 === $status, "expected 422, got {$status}" );
		pukat_table_smoke_expect( 'invalid_pagination' === ( $body['code'] ?? null ), "expected code invalid_pagination, got " . ( $body['code'] ?? 'null' ) );

		[ $status2, $body2 ] = pukat_table_smoke_rest( 'GET', "/pukat/v1/tables/{$table_key}/rows", [ 'per_page' => 'not-a-number' ] );
		pukat_table_smoke_expect( 422 === $status2, "expected 422 for non-numeric per_page, got {$status2}" );
		pukat_table_smoke_expect( 'invalid_pagination' === ( $body2['code'] ?? null ), "expected code invalid_pagination, got " . ( $body2['code'] ?? 'null' ) );
	}, $failures, $passed );

	pukat_table_smoke_run( "{$table_key}: per_page is capped at the registry max", function () use ( $table_key ) {
		[ $status, $body ] = pukat_table_smoke_rest( 'GET', "/pukat/v1/tables/{$table_key}/rows", [ 'per_page' => 99999 ] );
		pukat_table_smoke_expect( 200 === $status, "expected 200, got {$status}" );
		$config = \Pukat\Services\TableRegistry::get( $table_key );
		pukat_table_smoke_expect( $body['data']['meta']['per_page'] <= $config['max_per_page'], 'per_page was not capped' );
	}, $failures, $passed );

	pukat_table_smoke_run( "{$table_key}: invalid filter key is rejected", function () use ( $table_key ) {
		[ $status, $body ] = pukat_table_smoke_rest( 'GET', "/pukat/v1/tables/{$table_key}/rows", [ 'filters' => [ 'not_a_real_filter_key' => 'x' ] ] );
		pukat_table_smoke_expect( 422 === $status, "expected 422, got {$status}" );
		pukat_table_smoke_expect( 'invalid_filter' === ( $body['code'] ?? null ), "expected code invalid_filter, got " . ( $body['code'] ?? 'null' ) );
	}, $failures, $passed );

	echo "\n";
}

echo "=== table_key allowlist ===\n";
pukat_table_smoke_run( 'unknown table_key returns invalid_table_key on schema', function () {
	[ $status, $body ] = pukat_table_smoke_rest( 'GET', '/pukat/v1/tables/not_a_real_table/schema' );
	pukat_table_smoke_expect( 404 === $status, "expected 404, got {$status}" );
	pukat_table_smoke_expect( 'invalid_table_key' === ( $body['code'] ?? null ), "expected code invalid_table_key, got " . ( $body['code'] ?? 'null' ) );
}, $failures, $passed );

pukat_table_smoke_run( 'unknown table_key returns invalid_table_key on rows', function () {
	[ $status, $body ] = pukat_table_smoke_rest( 'GET', '/pukat/v1/tables/not_a_real_table/rows' );
	pukat_table_smoke_expect( 404 === $status, "expected 404, got {$status}" );
	pukat_table_smoke_expect( 'invalid_table_key' === ( $body['code'] ?? null ), "expected code invalid_table_key, got " . ( $body['code'] ?? 'null' ) );
}, $failures, $passed );

echo "\n" . str_repeat( '=', 60 ) . "\n";
echo "Passed: {$passed}, Failed: " . count( $failures ) . "\n";

if ( $failures ) {
	echo "\nFailures:\n";
	foreach ( $failures as $failure ) {
		echo " - {$failure}\n";
	}
	exit( 1 );
}

exit( 0 );
