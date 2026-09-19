<?php
/** Read-only regression checks for GoPhish campaign-level result timelines. */
declare(strict_types=1);
if ( PHP_SAPI !== 'cli' ) { exit(1); }
require dirname(__DIR__, 4) . '/wp-load.php';
$service = new Pukat\Services\CampaignRunService();
$invoke = static function (string $method, ...$args) use ($service) {
    return (new ReflectionMethod($service, $method))->invoke($service, ...$args);
};
$assert = static function (bool $ok, string $label) {
    if (!$ok) { throw new RuntimeException($label); }
    echo "PASS — $label\n";
};
$event = static fn(string $message, string $email = ' A@example.test ') => [
    'email' => $email, 'message' => $message, 'time' => '2026-09-18T03:00:00Z',
    'details' => 'must never propagate',
];
$results = [
    'results' => [
        ['email'=>'a@example.test', 'status'=>'Submitted Data', 'reported'=>true],
        ['email'=>'b@example.test', 'status'=>'Email Sent'],
        ['email'=>'queued@example.test', 'status'=>'Sending'],
        ['email'=>'error@example.test', 'status'=>'Error'],
    ],
    'timeline' => [
        $event('Campaign Created', ''), $event('Email Sent'), $event('Email Opened'),
        $event('Clicked Link'), $event('Clicked Link'), $event('Submitted Data'),
        $event('Email Reported'), $event('Email Sent', 'b@example.test'),
        $event('Clicked Link', 'unmatched@example.test'), null,
    ],
];
$stats = $invoke('aggregate_result_stats', $results);
$assert([$stats['total'],$stats['email_sent'],$stats['email_opened'],$stats['clicked'],$stats['submitted_data'],$stats['email_reported']] === [4,2,1,1,1,1], 'Unique cumulative funnel; queued/error recipients not sent');
$assert($stats['timeline_counts']['Clicked Link'] === 2, 'Repeated clicks remain events, not extra recipients');
$targets = $invoke('result_targets', $results);
$assert(count($targets[0]['timeline']) === 6 && !isset($targets[0]['timeline'][0]['details']), 'Case-normalized email mapping without submitted payloads');
$assert(array_sum($invoke('hourly_activity', $results)) === 2, 'Hourly activity receives real click events');
$assert(count($invoke('recent_events', $results, [])) > 0, 'Live feed receives campaign-level events');
$details = $invoke('target_details', $results, []);
$assert($details[0]['submitted_at'] === '2026-09-18T03:00:00+00:00', 'Target response timestamps populated');
$dept = $invoke('department_breakdown', $results, []);
$assert($dept[0]['clicked'] === 1 && $dept[0]['submitted'] === 1, 'Department metrics use same recipient events');
$status_only = ['results'=>[['email'=>'a@example.test','status'=>'Submitted Data','reported'=>true]]];
$s = $invoke('aggregate_result_stats', $status_only);
$assert($s['clicked'] === 1 && $s['email_opened'] === 1 && $s['email_reported'] === 1, 'Status and reported flag work without timeline');
$legacy = ['results'=>[['email'=>'a@example.test','status'=>'Email Sent','timeline'=>[$event('Clicked Link')]]]];
$assert($invoke('aggregate_result_stats', $legacy)['clicked'] === 1, 'Nested timeline compatibility');
$results['results'][0]['timeline'] = [$event('Clicked Link')];
$assert($invoke('aggregate_result_stats', $results)['timeline_counts']['Clicked Link'] === 2, 'Campaign timeline is not double counted with nested events');
$assert($invoke('aggregate_result_stats', ['results'=>null,'timeline'=>[null]])['total'] === 0, 'Empty/malformed results handled');
