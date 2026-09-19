<?php
/** Read-only(ish) regression checks for the configurable GoPhish sync interval (cron + Settings). */
declare(strict_types=1);
if ( PHP_SAPI !== 'cli' ) { exit(1); }
require dirname(__DIR__, 4) . '/wp-load.php';

use Pukat\Api\SettingsController;
use Pukat\Core\Plugin;

$assert = static function (bool $ok, string $label) {
    if (!$ok) { throw new RuntimeException("FAIL — $label"); }
    echo "PASS — $label\n";
};

$original_option = get_option('pukat_sync_interval_minutes');

// --- Plugin::sync_interval_minutes() whitelist clamp -----------------------
update_option('pukat_sync_interval_minutes', 15);
$assert(Plugin::sync_interval_minutes() === 15, 'Valid whitelisted value (15) is honored');

update_option('pukat_sync_interval_minutes', 7); // not in the whitelist
$assert(Plugin::sync_interval_minutes() === Plugin::DEFAULT_SYNC_INTERVAL_MINUTES, 'Out-of-whitelist stored value falls back to default (1)');

delete_option('pukat_sync_interval_minutes');
$assert(Plugin::sync_interval_minutes() === Plugin::DEFAULT_SYNC_INTERVAL_MINUTES, 'Missing option falls back to default (1)');

// --- register_cron_schedules() reflects the option --------------------------
update_option('pukat_sync_interval_minutes', 30);
$schedules = Plugin::instance()->register_cron_schedules([]);
$assert($schedules['pukat_sync_interval']['interval'] === 30 * MINUTE_IN_SECONDS, 'register_cron_schedules() computes interval from the option (30min)');

// --- update_option hook reschedules the live WP-Cron event automatically ----
wp_clear_scheduled_hook('pukat_process_campaign_results');
update_option('pukat_sync_interval_minutes', 5);
Plugin::instance()->ensure_campaign_results_cron_scheduled(); // baseline: nothing scheduled yet
$event = wp_get_scheduled_event('pukat_process_campaign_results');
$assert($event !== false && $event->schedule === 'pukat_sync_interval' && (int) $event->interval === 5 * MINUTE_IN_SECONDS, 'Missing cron event gets scheduled at the configured interval (5min)');

update_option('pukat_sync_interval_minutes', 60); // update_option_{option} hook should reschedule without any extra call
$event = wp_get_scheduled_event('pukat_process_campaign_results');
$assert($event !== false && (int) $event->interval === 60 * MINUTE_IN_SECONDS, 'Changing the option alone (via its update_option hook) reschedules the live cron event (60min)');

// --- REST controller: permission gate ---------------------------------------
$controller = new SettingsController();

wp_set_current_user(0);
$denied = $controller->permission_edit_settings();
$assert(is_wp_error($denied) && $denied->get_error_data()['status'] === 401, 'Logged-out request to edit settings is rejected (401)');

wp_set_current_user(4); // pukat_operator — no settings.edit capability
$denied = $controller->permission_edit_settings();
$assert(is_wp_error($denied) && $denied->get_error_data()['status'] === 403, 'Non-admin request to edit settings is rejected (403)');

wp_set_current_user(1); // administrator
$allowed = $controller->permission_edit_settings();
$assert(true === $allowed, 'Administrator is allowed to edit settings');

// --- REST controller: update_settings() sanitizes + persists ----------------
$request = new WP_REST_Request('PUT', '/pukat/v1/settings');
$request->set_header('content-type', 'application/json');
$request->set_body(wp_json_encode(['pukat_sync_interval_minutes' => 15]));
$response = $controller->update_settings($request);
$data = $response->get_data()['data'] ?? $response->get_data();
$assert((int) $data['pukat_sync_interval_minutes'] === 15, 'update_settings() persists a valid interval (15) and returns it');
$assert(get_option('pukat_sync_interval_minutes') === 15, 'Valid interval is actually written to wp_options');
$assert($data['sync_interval_choices'] === Plugin::SYNC_INTERVAL_CHOICES_MINUTES, 'Response exposes the whitelist for the frontend picker');
$assert(!isset($data['pukat_gophish_api_key']), 'Response never echoes the raw API key field');

$request2 = new WP_REST_Request('PUT', '/pukat/v1/settings');
$request2->set_header('content-type', 'application/json');
$request2->set_body(wp_json_encode(['pukat_sync_interval_minutes' => 3])); // tampered/invalid value
$response2 = $controller->update_settings($request2);
$data2 = $response2->get_data()['data'] ?? $response2->get_data();
$assert((int) $data2['pukat_sync_interval_minutes'] === Plugin::DEFAULT_SYNC_INTERVAL_MINUTES, 'update_settings() rejects an out-of-whitelist interval (3) down to the default (1)');
$assert(get_option('pukat_sync_interval_minutes') === Plugin::DEFAULT_SYNC_INTERVAL_MINUTES, 'Rejected interval is not the value actually stored');

// --- cleanup: restore whatever was there before this run --------------------
if (false === $original_option) {
    delete_option('pukat_sync_interval_minutes');
} else {
    update_option('pukat_sync_interval_minutes', $original_option);
}
Plugin::instance()->ensure_campaign_results_cron_scheduled();
wp_set_current_user(0);
echo "Cleanup: pukat_sync_interval_minutes restored, cron rescheduled to match.\n";
