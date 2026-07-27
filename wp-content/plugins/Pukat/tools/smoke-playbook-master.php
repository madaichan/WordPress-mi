<?php
/**
 * Runtime smoke test for the Playbook Master backend flow.
 *
 * Usage from the WordPress container:
 * php wp-content/plugins/Pukat/tools/smoke-playbook-master.php
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

if ( ! class_exists( '\Pukat\Core\Activator' ) ) {
	fwrite( STDERR, "Pukat is not loaded. Make sure the plugin is active.\n" );
	exit( 1 );
}

global $wpdb;

wp_set_current_user( 1 );
do_action( 'rest_api_init' );
\Pukat\Core\Activator::maybe_upgrade();

$old_url = get_option( 'pukat_gophish_url', null );
$old_key = get_option( 'pukat_gophish_api_key', null );

$ids = [
	'email_master'       => null,
	'email_version'      => null,
	'landing_master'     => null,
	'landing_version'    => null,
	'sending'            => null,
	'domain'             => null,
	'playbook_master'    => null,
	'campaign_run'       => null,
	'legacy_playbook'    => null,
	'migrated_playbook'  => null,
];

/**
 * Execute a REST request inside WordPress.
 *
 * @return array{0: int, 1: mixed, 2: array<string, mixed>}
 */
function pukat_smoke_rest( string $method, string $route, ?array $body = null ): array {
	$request = new WP_REST_Request( $method, $route );
	if ( null !== $body ) {
		$request->set_body_params( $body );
	}

	$response = rest_do_request( $request );

	return [ $response->get_status(), $response->get_data(), $response->get_headers() ];
}

function pukat_smoke_expect( bool $condition, string $message ): void {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

try {
	$db_version = (string) get_option( 'pukat_db_version' );
	pukat_smoke_expect( version_compare( $db_version, '1.3.0', '>=' ), "Expected pukat_db_version >= 1.3.0, got {$db_version}" );

	$legacy_column = $wpdb->get_var(
		$wpdb->prepare( "SHOW COLUMNS FROM {$wpdb->prefix}pukat_playbook_masters LIKE %s", 'legacy_playbook_id' )
	);
	pukat_smoke_expect( (bool) $legacy_column, 'Missing legacy_playbook_id column.' );

	[ $status, $email ] = pukat_smoke_rest(
		'POST',
		'/pukat/v1/master/email-templates',
		[
			'name'        => 'Smoke Email ' . time(),
			'description' => 'Temporary smoke fixture',
			'category'    => 'Smoke',
			'entity'      => 'General',
			'status'      => 'active',
			'subject'     => 'Smoke Subject',
			'html_body'   => '<p>Hello {{.FirstName}}</p>',
			'text_body'   => 'Hello {{.FirstName}}',
			'language'    => 'id',
		]
	);
	pukat_smoke_expect( 201 === $status && ! empty( $email['success'] ) && ! empty( $email['data']['latest_version']['id'] ), 'Failed to create email template fixture.' );
	$ids['email_master']  = (int) $email['data']['id'];
	$ids['email_version'] = (int) $email['data']['latest_version']['id'];

	[ $status, $approved_email ] = pukat_smoke_rest( 'POST', '/pukat/v1/master/email-template-versions/' . $ids['email_version'] . '/approve' );
	pukat_smoke_expect( 200 === $status && ! empty( $approved_email['success'] ), 'Failed to approve email template version.' );

	[ $status, $landing ] = pukat_smoke_rest(
		'POST',
		'/pukat/v1/master/landing-pages',
		[
			'name'              => 'Smoke Landing ' . time(),
			'description'       => 'Temporary smoke fixture',
			'category'          => 'Smoke',
			'entity'            => 'General',
			'status'            => 'active',
			'html_body'         => '<html><body><form method="post"><input name="email"></form></body></html>',
			'capture_settings'  => [ 'capture_credentials' => true ],
			'redirect_settings' => [ 'redirect_url' => 'https://example.com/thanks' ],
			'language'          => 'id',
		]
	);
	pukat_smoke_expect( 201 === $status && ! empty( $landing['success'] ) && ! empty( $landing['data']['latest_version']['id'] ), 'Failed to create landing page fixture.' );
	$ids['landing_master']  = (int) $landing['data']['id'];
	$ids['landing_version'] = (int) $landing['data']['latest_version']['id'];

	[ $status, $approved_landing ] = pukat_smoke_rest( 'POST', '/pukat/v1/master/landing-page-versions/' . $ids['landing_version'] . '/approve' );
	pukat_smoke_expect( 200 === $status && ! empty( $approved_landing['success'] ), 'Failed to approve landing page version.' );

	[ $status, $sending ] = pukat_smoke_rest(
		'POST',
		'/pukat/v1/master/sending-profiles',
		[
			'name'                       => 'Smoke Sender ' . time(),
			'from_name'                  => 'Pukat Smoke',
			'from_email'                 => 'smoke@example.com',
			'reply_to'                   => 'reply@example.com',
			'gophish_sending_profile_id' => 999999,
			'environment'                => 'test',
			'entity'                     => 'General',
			'status'                     => 'active',
		]
	);
	pukat_smoke_expect( 201 === $status && ! empty( $sending['success'] ), 'Failed to create sending profile fixture.' );
	$ids['sending'] = (int) $sending['data']['id'];

	[ $status, $domain ] = pukat_smoke_rest(
		'POST',
		'/pukat/v1/master/dynamic-domains',
		[
			'domain'               => 'example.com',
			'base_landing_url'     => 'https://example.com/phish',
			'tracking_url'         => 'https://example.com/track',
			'environment'          => 'test',
			'owner_entity'         => 'General',
			'authorization_status' => 'authorized',
			'dns_status'           => 'valid',
			'tls_status'           => 'valid',
			'status'               => 'active',
		]
	);
	pukat_smoke_expect( 201 === $status && ! empty( $domain['success'] ), 'Failed to create dynamic domain fixture.' );
	$ids['domain'] = (int) $domain['data']['id'];

	[ $status, $playbook ] = pukat_smoke_rest(
		'POST',
		'/pukat/v1/playbook-masters',
		[
			'name'                              => 'Smoke Playbook ' . time(),
			'description'                       => 'Temporary smoke fixture',
			'objective'                         => 'Smoke backend flow',
			'scenario'                          => 'credential_awareness',
			'difficulty'                        => 1,
			'risk_level'                        => 'low',
			'default_email_template_version_id' => $ids['email_version'],
			'default_landing_page_version_id'   => $ids['landing_version'],
			'default_sending_profile_ref_id'    => $ids['sending'],
			'default_dynamic_domain_id'         => $ids['domain'],
			'entity'                            => 'General',
			'status'                            => 'active',
		]
	);
	pukat_smoke_expect( 201 === $status && ! empty( $playbook['success'] ) && ! empty( $playbook['data']['readiness']['ready'] ), 'Failed to create active Playbook Master.' );
	$ids['playbook_master'] = (int) $playbook['data']['id'];

	[ $status, $run ] = pukat_smoke_rest(
		'POST',
		'/pukat/v1/campaign-runs',
		[
			'playbook_master_id' => $ids['playbook_master'],
			'name'               => 'Smoke Run ' . time(),
			'target_group_name'  => 'Smoke Target Group',
			'timezone'           => 'UTC',
		]
	);
	pukat_smoke_expect( 201 === $status && ! empty( $run['success'] ), 'Failed to create Campaign Run.' );
	$ids['campaign_run'] = (int) $run['data']['id'];

	[ $status, $locked ] = pukat_smoke_rest( 'POST', '/pukat/v1/campaign-runs/' . $ids['campaign_run'] . '/lock-snapshot' );
	pukat_smoke_expect( 200 === $status && ! empty( $locked['success'] ) && ! empty( $locked['data']['snapshot_locked'] ), 'Failed to lock Campaign Run snapshot.' );

	update_option( 'pukat_gophish_url', '' );
	update_option( 'pukat_gophish_api_key', '' );
	[ $sync_status, $sync ] = pukat_smoke_rest( 'POST', '/pukat/v1/campaign-runs/' . $ids['campaign_run'] . '/sync' );
	pukat_smoke_expect( 502 === $sync_status && empty( $sync['success'] ), 'Expected controlled sync failure without GoPhish config.' );

	[ $status, $legacy ] = pukat_smoke_rest(
		'POST',
		'/pukat/v1/playbooks',
		[
			'name'                => 'Smoke Legacy Playbook ' . time(),
			'description'         => 'Temporary legacy fixture',
			'gophish_template_id' => 111,
			'gophish_page_id'     => 222,
			'gophish_smtp_id'     => 333,
			'difficulty'          => 2,
			'entity'              => 'General',
		]
	);
	pukat_smoke_expect( 200 === $status && ! empty( $legacy['success'] ) && ! empty( $legacy['legacy'] ), 'Legacy playbook endpoint did not return legacy metadata.' );
	$ids['legacy_playbook'] = (int) $legacy['data']['id'];

	[ $status, $migrated ] = pukat_smoke_rest( 'POST', '/pukat/v1/playbooks/' . $ids['legacy_playbook'] . '/migrate-to-master' );
	pukat_smoke_expect( 201 === $status && ! empty( $migrated['success'] ) && ! empty( $migrated['data']['migrated'] ), 'Failed to migrate legacy playbook.' );
	$ids['migrated_playbook'] = (int) $migrated['data']['playbook_master']['id'];

	echo "pukat_smoke=ok\n";
	echo 'db_version=' . get_option( 'pukat_db_version' ) . "\n";
	echo 'campaign_run_status=sync_failed' . "\n";
	echo 'legacy_migration=ok' . "\n";
} catch ( Throwable $error ) {
	fwrite( STDERR, 'pukat_smoke=failed: ' . $error->getMessage() . "\n" );
	exit( 1 );
} finally {
	if ( $ids['campaign_run'] ) {
		$wpdb->delete( $wpdb->prefix . 'pukat_campaign_runs', [ 'id' => $ids['campaign_run'] ] );
		$wpdb->delete( $wpdb->prefix . 'pukat_risk_scores', [ 'campaign_run_id' => $ids['campaign_run'] ] );
	}
	if ( $ids['migrated_playbook'] ) {
		$wpdb->delete( $wpdb->prefix . 'pukat_playbook_masters', [ 'id' => $ids['migrated_playbook'] ] );
	}
	if ( $ids['playbook_master'] ) {
		$wpdb->delete( $wpdb->prefix . 'pukat_playbook_masters', [ 'id' => $ids['playbook_master'] ] );
	}
	if ( $ids['legacy_playbook'] ) {
		$wpdb->delete( $wpdb->prefix . 'pukat_playbooks', [ 'id' => $ids['legacy_playbook'] ] );
	}
	if ( $ids['domain'] ) {
		$wpdb->delete( $wpdb->prefix . 'pukat_dynamic_domains', [ 'id' => $ids['domain'] ] );
	}
	if ( $ids['sending'] ) {
		$wpdb->delete( $wpdb->prefix . 'pukat_sending_profile_refs', [ 'id' => $ids['sending'] ] );
	}
	if ( $ids['landing_master'] ) {
		$wpdb->delete( $wpdb->prefix . 'pukat_landing_page_versions', [ 'landing_page_master_id' => $ids['landing_master'] ] );
		$wpdb->delete( $wpdb->prefix . 'pukat_landing_page_masters', [ 'id' => $ids['landing_master'] ] );
	}
	if ( $ids['email_master'] ) {
		$wpdb->delete( $wpdb->prefix . 'pukat_email_template_versions', [ 'template_master_id' => $ids['email_master'] ] );
		$wpdb->delete( $wpdb->prefix . 'pukat_email_template_masters', [ 'id' => $ids['email_master'] ] );
	}

	if ( null === $old_url ) {
		delete_option( 'pukat_gophish_url' );
	} else {
		update_option( 'pukat_gophish_url', $old_url );
	}

	if ( null === $old_key ) {
		delete_option( 'pukat_gophish_api_key' );
	} else {
		update_option( 'pukat_gophish_api_key', $old_key );
	}
}
