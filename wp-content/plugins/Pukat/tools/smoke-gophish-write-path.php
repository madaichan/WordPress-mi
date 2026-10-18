<?php
/**
 * Contract test for the GoPhish write path.
 *
 * Guards the invariant that broke campaign run #51 on 2026-10-14: saving a
 * sending profile without touching its password must not wipe the password
 * stored in GoPhish. See docs/RELIABILITY_PLAN.md.
 *
 * This talks to a real GoPhish server, because the bug lived in what GoPhish
 * does with a full-replace PUT — a mocked client would have stayed green. Every
 * write here goes to a throwaway sending profile this script creates and
 * deletes; it never touches a profile it did not create.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-gophish-write-path.php
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

if ( ! class_exists( '\Pukat\Services\GoPhishService' ) ) {
	fwrite( STDERR, "Pukat is not loaded. Make sure the plugin is active.\n" );
	exit( 1 );
}

wp_set_current_user( 1 );
do_action( 'rest_api_init' );

const PUKAT_SMOKE_PREFIX = '[PUKAT-SMOKE] write-path';

function pukat_smoke_expect( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

/**
 * @return array{0: int, 1: mixed}
 */
function pukat_smoke_rest( string $method, string $route, array $params = [] ): array {
	$request = new WP_REST_Request( $method, $route );
	foreach ( $params as $key => $value ) {
		$request->set_param( $key, $value );
	}

	$response = rest_do_request( $request );

	return [ $response->get_status(), $response->get_data() ];
}

/**
 * @param callable(): void $test
 */
function pukat_smoke_run( string $label, callable $test, array &$failures, int &$passed ): void {
	try {
		$test();
		$passed++;
		echo "  [PASS] {$label}\n";
	} catch ( Throwable $e ) {
		$failures[] = "{$label}: {$e->getMessage()}";
		echo "  [FAIL] {$label}: {$e->getMessage()}\n";
	}
}

$service = new \Pukat\Services\GoPhishService();

$connection = $service->test_connection();
if ( empty( $connection['success'] ) ) {
	fwrite( STDERR, 'GoPhish is not reachable: ' . ( $connection['message'] ?? 'unknown error' ) . "\n" );
	exit( 1 );
}

$suffix          = gmdate( 'Ymd-His' ) . '-' . wp_generate_password( 6, false );
$profile_name    = PUKAT_SMOKE_PREFIX . ' ' . $suffix;
$seed_password   = 'smoke-pw-' . wp_generate_password( 12, false );
$seed_username   = 'smoke-user-' . $suffix;
$seed_entity     = 'General';

$created = $service->create_sending_profile( [
	'name'               => $profile_name,
	'interface_type'     => 'SMTP',
	'host'               => '127.0.0.1:1',
	'from_address'       => 'smoke@example.invalid',
	'username'           => $seed_username,
	'password'           => $seed_password,
	'ignore_cert_errors' => true,
	'headers'            => [],
	'entity'             => $seed_entity,
] );

if ( is_wp_error( $created ) ) {
	fwrite( STDERR, 'Could not create the throwaway sending profile: ' . $created->get_error_message() . "\n" );
	exit( 1 );
}

$profile_id = (int) ( $created['id'] ?? 0 );
if ( $profile_id <= 0 ) {
	fwrite( STDERR, "GoPhish did not return an id for the throwaway sending profile.\n" );
	exit( 1 );
}

echo "Throwaway sending profile: #{$profile_id} {$profile_name}\n\n";

$template_name = PUKAT_SMOKE_PREFIX . ' template ' . $suffix;
$template_html = '<html><body>seeded html ' . $suffix . '</body></html>';

$template = $service->create_email_template( [
	'name'        => $template_name,
	'subject'     => 'Seeded subject ' . $suffix,
	'html'        => $template_html,
	'text'        => 'seeded text',
	'attachments' => [],
] );

if ( is_wp_error( $template ) ) {
	$service->delete_sending_profile( $profile_id );
	fwrite( STDERR, 'Could not create the throwaway email template: ' . $template->get_error_message() . "\n" );
	exit( 1 );
}

$template_id = (int) ( $template['id'] ?? 0 );

// Compare against what GoPhish stored, not what we sent: GoPhish normalises
// html on save, so the string we posted is not always the string it keeps.
$template_html = (string) ( $template['html'] ?? $template_html );

$page_name = PUKAT_SMOKE_PREFIX . ' page ' . $suffix;
$page_html = '<html><body>seeded page ' . $suffix . '</body></html>';

$page = $service->create_landing_page( [
	'name'                => $page_name,
	'html'                => $page_html,
	'capture_credentials' => true,
	'capture_passwords'   => false,
] );

if ( is_wp_error( $page ) ) {
	$service->delete_sending_profile( $profile_id );
	$service->delete_email_template( $template_id );
	fwrite( STDERR, 'Could not create the throwaway landing page: ' . $page->get_error_message() . "\n" );
	exit( 1 );
}

$page_id   = (int) ( $page['id'] ?? 0 );
$page_html = (string) ( $page['html'] ?? $page_html );

echo "Throwaway email template: #{$template_id} {$template_name}\n";
echo "Throwaway landing page:   #{$page_id} {$page_name}\n\n";

/**
 * Read the stored profile straight from GoPhish, bypassing the REST layer that
 * strips the password.
 */
$stored = static function () use ( $service, $profile_id ): array {
	$profile = $service->get_sending_profile( $profile_id );
	pukat_smoke_expect( ! is_wp_error( $profile ), 'could not read the profile back from GoPhish' );
	return (array) $profile;
};

/** Mirror what the browser submits when the password field was never touched. */
$form_params = static function ( array $overrides = [] ) use ( $profile_id, $profile_name, $seed_username, $seed_entity ): array {
	return array_merge( [
		'id'                 => $profile_id,
		'name'               => $profile_name,
		'host'               => '127.0.0.1',
		'port'               => 1,
		'from_address'       => 'smoke@example.invalid',
		'username'           => $seed_username,
		'password'           => '',
		'ignore_cert_errors' => true,
		'headers'            => [],
		'entity'             => $seed_entity,
	], $overrides );
};

$failures = [];
$passed   = 0;

try {
	echo "=== sending profile write path ===\n";

	pukat_smoke_run( 'save without a password keeps the stored password', function () use ( $form_params, $stored, $seed_password, $profile_id ) {
		[ $status ] = pukat_smoke_rest( 'PUT', "/pukat/v1/gophish/smtp/{$profile_id}", $form_params() );
		pukat_smoke_expect( 200 === $status, "expected 200, got {$status}" );

		$after = $stored();
		pukat_smoke_expect(
			( $after['password'] ?? '' ) === $seed_password,
			'the stored password was changed by a save that sent no password'
		);
	}, $failures, $passed );

	pukat_smoke_run( 'save with a new password really rotates it', function () use ( $form_params, $stored, $seed_password, $profile_id ) {
		$rotated = 'smoke-rotated-' . wp_generate_password( 10, false );

		[ $status ] = pukat_smoke_rest( 'PUT', "/pukat/v1/gophish/smtp/{$profile_id}", $form_params( [ 'password' => $rotated ] ) );
		pukat_smoke_expect( 200 === $status, "expected 200, got {$status}" );

		$after = $stored();
		pukat_smoke_expect(
			( $after['password'] ?? '' ) === $rotated,
			'a password that was typed in did not reach GoPhish'
		);

		// Put the seed password back so the later assertions read one value.
		[ $status ] = pukat_smoke_rest( 'PUT', "/pukat/v1/gophish/smtp/{$profile_id}", $form_params( [ 'password' => $seed_password ] ) );
		pukat_smoke_expect( 200 === $status, "expected 200 while restoring, got {$status}" );
	}, $failures, $passed );

	pukat_smoke_run( 'reassigning the entity keeps the stored password', function () use ( $stored, $seed_password, $seed_entity, $profile_id ) {
		[ $status ] = pukat_smoke_rest( 'PUT', "/pukat/v1/gophish/smtp/{$profile_id}/entity", [ 'id' => $profile_id, 'entity' => $seed_entity ] );
		pukat_smoke_expect( 200 === $status, "expected 200, got {$status}" );

		$after = $stored();
		pukat_smoke_expect(
			( $after['password'] ?? '' ) === $seed_password,
			'the stored password was lost during an entity reassignment'
		);
	}, $failures, $passed );

	pukat_smoke_run( 'a field the payload omits survives the save', function () use ( $form_params, $stored, $seed_entity, $profile_id ) {
		$params = $form_params();
		unset( $params['entity'] );

		[ $status ] = pukat_smoke_rest( 'PUT', "/pukat/v1/gophish/smtp/{$profile_id}", $params );
		pukat_smoke_expect( 200 === $status, "expected 200, got {$status}" );

		$after = $stored();
		pukat_smoke_expect(
			( $after['entity'] ?? '' ) === $seed_entity,
			'a field left out of the payload was wiped instead of preserved'
		);
	}, $failures, $passed );

	pukat_smoke_run( 'no REST response ever carries the password', function () use ( $form_params, $profile_id ) {
		[ $status, $body ] = pukat_smoke_rest( 'PUT', "/pukat/v1/gophish/smtp/{$profile_id}", $form_params() );
		pukat_smoke_expect( 200 === $status, "expected 200, got {$status}" );
		pukat_smoke_expect(
			! array_key_exists( 'password', (array) ( $body['data'] ?? [] ) ),
			'the update response exposed a password'
		);

		[ $status, $body ] = pukat_smoke_rest( 'GET', '/pukat/v1/gophish/smtp' );
		pukat_smoke_expect( 200 === $status, "expected 200, got {$status}" );

		foreach ( (array) ( $body['data'] ?? [] ) as $listed ) {
			pukat_smoke_expect(
				! array_key_exists( 'password', (array) $listed ),
				'the list response exposed a password for profile #' . ( $listed['id'] ?? '?' )
			);
		}
	}, $failures, $passed );

	echo "\n=== the same invariant on the other GoPhish objects ===\n";

	pukat_smoke_run( 'a partial email template update keeps the html', function () use ( $service, $template_id, $template_html ) {
		$result = $service->update_email_template( $template_id, [ 'name' => PUKAT_SMOKE_PREFIX . ' template renamed' ] );
		pukat_smoke_expect( ! is_wp_error( $result ), 'update failed: ' . ( is_wp_error( $result ) ? $result->get_error_message() : '' ) );

		$after = $service->get_email_template( $template_id );
		pukat_smoke_expect( ! is_wp_error( $after ), 'could not read the template back' );
		pukat_smoke_expect(
			( $after['html'] ?? '' ) === $template_html,
			'the html was wiped by an update that did not mention it'
		);
	}, $failures, $passed );

	pukat_smoke_run( 'a partial landing page update keeps the html', function () use ( $service, $page_id, $page_html ) {
		$result = $service->update_landing_page( $page_id, [ 'name' => PUKAT_SMOKE_PREFIX . ' page renamed' ] );
		pukat_smoke_expect( ! is_wp_error( $result ), 'update failed: ' . ( is_wp_error( $result ) ? $result->get_error_message() : '' ) );

		$after = $service->get_landing_page( $page_id );
		pukat_smoke_expect( ! is_wp_error( $after ), 'could not read the page back' );
		pukat_smoke_expect(
			( $after['html'] ?? '' ) === $page_html,
			'the html changed after an update that did not mention it'
		);
	}, $failures, $passed );
} finally {
	echo "\n=== cleanup ===\n";

	// Only ever delete objects this script created, identified by their name.
	$cleanup = [
		[ 'sending profile', $profile_id, [ $service, 'get_sending_profile' ], [ $service, 'delete_sending_profile' ] ],
		[ 'email template', $template_id, [ $service, 'get_email_template' ], [ $service, 'delete_email_template' ] ],
		[ 'landing page', $page_id, [ $service, 'get_landing_page' ], [ $service, 'delete_landing_page' ] ],
	];

	foreach ( $cleanup as [ $label, $id, $reader, $remover ] ) {
		$final = $reader( $id );
		$name  = is_wp_error( $final ) ? '' : (string) ( $final['name'] ?? '' );

		if ( ! str_starts_with( $name, PUKAT_SMOKE_PREFIX ) ) {
			echo "  SKIPPED {$label} #{$id} — it no longer looks like the throwaway one. Check it by hand.\n";
			continue;
		}

		$deleted = $remover( $id );
		echo is_wp_error( $deleted )
			? "  FAILED to delete {$label} #{$id}, remove it by hand: " . $deleted->get_error_message() . "\n"
			: "  deleted {$label} #{$id}\n";
	}
}

echo "\n" . str_repeat( '=', 60 ) . "\n";
echo 'Passed: ' . $passed . ', Failed: ' . count( $failures ) . "\n";

if ( $failures ) {
	echo "\nFailures:\n";
	foreach ( $failures as $failure ) {
		echo " - {$failure}\n";
	}
	exit( 1 );
}

exit( 0 );
