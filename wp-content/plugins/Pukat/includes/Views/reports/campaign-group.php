<?php
/** Design from docs/prototypes/exportpdf-multi-campaign-draft.html; $data is prepared by CampaignReportPdfService::campaign_group_report_data(). */
defined( 'ABSPATH' ) || exit;
$section_head = static function ( string $number, string $title ): void {
    ?><div class="section-head"><span class="section-no"><?php echo esc_html( $number ); ?></span><h2 class="section-title"><?php echo esc_html( $title ); ?></h2><span class="section-rule"></span></div><?php
};
$stage_cell = static function ( array $stage ): void {
    ?><td class="center"><?php echo (int) $stage['count']; ?><span class="cell-detail"><?php echo esc_html( $stage['rate'] ); ?></span></td><?php
};
$stage_keys = [ 'email_opened', 'clicked', 'submitted_data', 'email_reported' ];
?>
<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Multi-Campaign Monitoring Report — <?php echo esc_html( $data['selection_label'] ); ?></title>
<style><?php echo $report_css; ?></style>
</head>
<body>
<main>
<article class="page" aria-label="Reporting scope and executive summary">
<div class="content">
    <div class="title-block"><div class="kicker">Consolidated Campaign Evaluation</div><h1>Multi-Campaign<br>Monitoring Report</h1><div class="subtitle"><?php echo esc_html( $data['selection_label'] ); ?> · <?php echo esc_html( $data['prepared_at'] ); ?> · Monitoring</div></div>
    <section class="section">
        <?php $section_head( '01', 'Reporting Scope & Coverage' ); ?>
        <div class="facts"><?php foreach ( $data['facts'] as [ $label, $value ] ) : ?><div class="fact"><div class="fact-label"><?php echo esc_html( $label ); ?></div><div class="fact-value"><?php echo esc_html( (string) $value ); ?></div></div><?php endforeach; ?></div>
    </section>
    <section class="section">
        <?php $section_head( '02', 'Executive Summary' ); ?>
        <div class="summary-layout"><div class="summary-copy"><?php foreach ( $data['summary'] as $paragraph ) : ?><p><?php echo $paragraph; ?></p><?php endforeach; ?></div><aside class="assessment <?php echo esc_attr( $data['assessment']['class'] ); ?>"><div class="assessment-label">Overall Assessment</div><div class="assessment-value"><?php echo esc_html( $data['assessment']['label'] ); ?></div><div class="assessment-provisional"><?php echo esc_html( $data['assessment']['provisional'] ); ?></div><div class="assessment-note"><?php echo esc_html( $data['assessment']['note'] ); ?></div></aside></div>
    </section>
    <section class="section">
        <?php $section_head( '03', 'Consolidated Performance Metrics' ); ?>
        <div class="metrics portfolio-metrics"><?php foreach ( $data['metrics'] as $metric ) : ?><div class="metric <?php echo esc_attr( $metric['class'] ); ?>"><div class="metric-label"><?php echo esc_html( $metric['label'] ); ?></div><div class="metric-value"><?php echo (int) $metric['value']; ?></div><div class="metric-note"><?php echo esc_html( $metric['note'] ); ?></div></div><?php endforeach; ?></div>
        <p class="compact-note">Recipient records are counted within each campaign and then aggregated. The same person may contribute to more than one campaign. Stage counts may overlap and must not be added together.</p>
    </section>
    <section class="section">
        <?php $section_head( '04', 'Exposure & Reporting Signals' ); ?>
        <div class="comparison-signals"><?php foreach ( $data['signals'] as $signal ) : ?><div><div class="signal-label"><strong><?php echo esc_html( $signal['label'] ); ?></strong><strong><?php echo esc_html( $signal['pct'] ); ?></strong></div><div class="signal-track <?php echo esc_attr( $signal['class'] ); ?>"><span style="width:<?php echo esc_attr( $signal['pct'] ); ?>"></span></div><div class="signal-caption"><?php echo esc_html( $signal['note'] ); ?></div></div><?php endforeach; ?></div>
    </section>
</div>
</article>
<article class="page" aria-label="Campaign comparison and snapshot register">
<div class="content">
    <section class="section">
        <?php $section_head( '05', 'Campaign Performance Comparison' ); ?>
        <div class="table-wrap"><table class="campaign-table"><colgroup><col style="width:30%"><col style="width:11%"><col style="width:11%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:12%"></colgroup><thead><tr><th>Campaign / Group</th><th class="center">Status</th><th class="center">Records</th><th class="center">Opened</th><th class="center">Clicked</th><th class="center">Submitted</th><th class="center">Reported</th></tr></thead><tbody>
            <?php foreach ( $data['runs'] as $run ) : ?><tr><td><span class="campaign-name"><?php echo esc_html( $run['name'] ); ?></span><span class="cell-detail">#<?php echo (int) $run['campaign_run_id']; ?> · <?php echo esc_html( $run['group_name'] ); ?></span></td><td class="center"><span class="status <?php echo esc_attr( $run['status'] ); ?>"><?php echo esc_html( $run['status'] ); ?></span></td><td class="center"><?php echo $run['has_stats'] ? (int) $run['total'] : '—'; ?></td><?php foreach ( $stage_keys as $stage_key ) : ?><?php if ( $run['has_stats'] ) : $stage_cell( $run['stages'][ $stage_key ] ); else : ?><td class="center">—</td><?php endif; ?><?php endforeach; ?></tr><?php endforeach; ?>
            <?php if ( ! $data['runs'] ) : ?><tr><td colspan="7" class="empty-state">No campaigns in this selection.</td></tr><?php endif; ?>
            <?php if ( $data['runs'] ) : ?><tr class="total"><td>RECORDED TOTAL</td><td class="center"><?php echo (int) $data['recorded_count']; ?>/<?php echo (int) $data['run_count']; ?></td><td class="center"><?php echo (int) $data['total']; ?></td><?php foreach ( $stage_keys as $stage_key ) : $stage_cell( $data['recorded_totals']['stages'][ $stage_key ] ); endforeach; ?></tr><?php endif; ?>
        </tbody></table></div>
        <p class="compact-note">Each campaign rate uses its own recorded recipient total. The consolidated rate is recalculated from summed counts; it is not an average of campaign percentages. A dash denotes unavailable results.</p>
    </section>
    <section class="section">
        <?php $section_head( '06', 'Campaign Snapshot Register' ); ?>
        <div class="table-wrap"><table class="snapshot-table"><colgroup><col style="width:33%"><col style="width:12%"><col style="width:27%"><col style="width:28%"></colgroup><thead><tr><th>Campaign / Playbook</th><th class="center">Planned<br>Records</th><th>Launch / Schedule</th><th>Last Result Sync</th></tr></thead><tbody>
            <?php foreach ( $data['snapshot_rows'] as $row ) : ?><tr><td><span class="campaign-name"><?php echo esc_html( $row['name'] ); ?></span><span class="cell-detail"><?php echo esc_html( $row['playbook_name'] ); ?></span></td><td class="center"><?php echo (int) $row['target_count']; ?></td><td><?php echo esc_html( $row['launch_label'] ); ?><span class="cell-detail"><?php echo esc_html( $row['launch_type'] ); ?></span></td><td><?php echo esc_html( $row['synced_label'] ); ?></td></tr><?php endforeach; ?>
            <?php if ( ! $data['snapshot_rows'] ) : ?><tr><td colspan="4" class="empty-state">No campaigns in this selection.</td></tr><?php endif; ?>
        </tbody></table></div>
        <div class="coverage-note"><?php echo $data['coverage_note']; ?></div>
        <p class="compact-note"><?php echo esc_html( $data['scope_rule'] ); ?></p>
    </section>
</div>
</article>
<article class="page" aria-label="Departmental distribution and recorded activity">
<div class="content">
    <section class="section">
        <?php $section_head( '07', 'Departmental Response Distribution' ); ?>
        <div class="table-wrap"><table class="department-table"><colgroup><col style="width:36%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:12%"></colgroup><thead><tr><th>Department</th><th class="center">Records</th><th class="center">Clicked</th><th class="center">Submitted</th><th class="center">Click Rate</th><th class="center">Risk</th></tr></thead><tbody>
            <?php foreach ( $data['department_rows'] as $department ) : ?><tr><td><?php echo esc_html( $department['name'] ); ?></td><td class="center"><?php echo (int) $department['total']; ?></td><td class="center"><?php echo (int) $department['clicked']; ?></td><td class="center"><?php echo (int) $department['submitted']; ?></td><td class="center"><?php echo esc_html( $department['rate'] ); ?></td><td class="center"><span class="risk-text risk-<?php echo esc_attr( $department['risk_class'] ); ?>"><?php echo esc_html( $department['risk_label'] ); ?></span></td></tr><?php endforeach; ?>
            <?php if ( $data['department_rows'] ) : ?><tr class="total"><td>TOTAL</td><td class="center"><?php echo (int) $data['department_totals']['total']; ?></td><td class="center"><?php echo (int) $data['department_totals']['clicked']; ?></td><td class="center"><?php echo (int) $data['department_totals']['submitted']; ?></td><td class="center"><?php echo esc_html( $data['department_totals']['rate'] ); ?></td><td class="center">—</td></tr><?php else : ?><tr><td colspan="6" class="empty-state">No department data is available for this selection yet.</td></tr><?php endif; ?>
        </tbody></table></div>
        <p class="compact-note">Departmental risk follows the existing click-rate thresholds: &lt;15% LOW, 15–&lt;40% MEDIUM, ≥40% HIGH. Clicks and submissions remain separate metrics.</p>
        <div class="two-notes">
            <div><h3>Priority for targeted follow-up</h3><p><?php echo $data['department_focus'] ? $data['department_focus'] : 'No department response activity has been recorded for this selection yet.'; ?></p></div>
            <div><h3>Coverage and counting basis</h3><p>Department totals combine recipient records across campaigns. They identify the distribution of recorded responses; they do not establish the number of distinct employees affected.</p></div>
        </div>
    </section>
    <section class="section">
        <?php $section_head( '08', 'Recorded Click Activity by Hour' ); ?>
        <?php if ( $data['hourly_total_events'] > 0 ) : ?>
        <div class="hourly-chart" role="img" aria-label="<?php echo esc_attr( sprintf( '%d recorded click events grouped by UTC hour. Highest bucket: %02d:00 UTC, %d events.', $data['hourly_total_events'], $data['hourly_peak_hour'], $data['hourly_peak'] ) ); ?>"><?php foreach ( $data['hourly'] as $hour => $value ) : ?><div class="hourly-bar <?php echo $value === $data['hourly_peak'] && $value > 0 ? 'peak' : ''; ?>" style="height:<?php echo esc_attr( (string) ( $value / $data['hourly_peak'] * 100 ) ); ?>%" title="<?php echo esc_attr( sprintf( '%02d:00 UTC · %d click events', $hour, $value ) ); ?>"></div><?php endforeach; ?></div>
        <?php else : ?><div class="empty-state">No click activity has been recorded for this selection yet.</div><?php endif; ?>
        <div class="hourly-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00 UTC</span></div>
        <p class="compact-note">Hour buckets use UTC and combine events across all recorded dates. Repeated clicks contribute additional events; these totals may exceed the number of recipient records with a click.</p>
        <?php if ( $data['hourly_total_events'] > 0 ) : ?>
        <div class="two-notes">
            <div><h3>Recorded event volume</h3><p><?php echo (int) $data['hourly_total_events']; ?> click events are represented in the hourly extract, compared with <?php echo (int) $data['recorded_totals']['stages']['clicked']['count']; ?> campaign recipient records with a click. Repeated activity explains why these measures need not coincide.</p></div>
            <div><h3>Highest activity bucket</h3><p><?php echo sprintf( '%02d:00–%02d:59', $data['hourly_peak_hour'], $data['hourly_peak_hour'] ); ?> UTC contains <?php echo (int) $data['hourly_peak']; ?> recorded click events. This is an aggregate across dates, not evidence of a single peak on the reporting date.</p></div>
        </div>
        <?php endif; ?>
    </section>
</div>
</article>
<article class="page" aria-label="Consolidated risk assessment and findings">
<div class="content">
    <section class="section">
        <?php $section_head( '09', 'Consolidated Risk Assessment' ); ?>
        <div class="table-wrap"><table class="risk-table"><colgroup><col style="width:24%"><col style="width:16%"><col style="width:60%"></colgroup><thead><tr><th>Assessment Area</th><th class="center">Rating</th><th>Rationale</th></tr></thead><tbody>
            <?php foreach ( $data['risk_matrix'] as $row ) : ?><tr><td><strong><?php echo esc_html( $row['area'] ); ?></strong></td><td class="center"><span class="risk-text risk-<?php echo esc_attr( $row['level'] ); ?>"><?php echo esc_html( $row['label'] ); ?></span></td><td><?php echo esc_html( $row['body'] ); ?></td></tr><?php endforeach; ?>
        </tbody></table></div>
        <p class="compact-note">This report applies Pukat's existing exposure and reporting criteria to the recorded selection. Overall Assessment adopts the higher of those two ratings. Snapshot completeness qualifies the conclusion; it does not lower the observed exposure rating.</p>
    </section>
    <section class="section">
        <?php $section_head( '10', 'Principal Findings' ); ?>
        <?php foreach ( $data['findings'] as $index => $finding ) : ?><div class="finding"><div class="finding-index"><?php echo sprintf( '%02d', $index + 1 ); ?></div><div><div class="finding-title"><?php echo esc_html( $finding['title'] ); ?></div><div class="finding-desc"><?php echo $finding['body']; ?></div></div><div class="finding-risk risk-<?php echo esc_attr( $finding['level'] ); ?>"><?php echo esc_html( $finding['label'] ); ?></div></div><?php endforeach; ?>
    </section>
    <div class="method-banner">Campaigns should be interpreted in the context of their scenarios, audiences and timing. Differences in response rates identify areas for investigation; they do not, by themselves, establish changes in behaviour or campaign effectiveness.</div>
</div>
</article>
<article class="page" aria-label="Recommendations and approval">
<div class="content">
    <section class="section">
        <?php $section_head( '11', 'Recommendations & Remediation Plan' ); ?>
        <p class="compact-note">The following actions and ownership arrangements are proposed for management review.</p>
        <?php foreach ( $data['actions'] as $index => $action ) : ?><div class="action-card"><div class="action-top"><span class="action-number"><?php echo sprintf( '%02d', $index + 1 ); ?></span><div><h3><?php echo esc_html( $action['title'] ); ?></h3><p class="action-body"><?php echo esc_html( $action['body'] ); ?></p></div><span class="priority">Priority <?php echo (int) $action['priority']; ?></span></div><div class="action-meta"><div><span>Proposed Owner</span><?php echo esc_html( $action['owner'] ); ?></div><div><span>Recommended Completion</span><?php echo esc_html( $action['due'] ); ?></div></div></div><?php endforeach; ?>
    </section>
    <section class="section">
        <?php $section_head( '12', 'Review & Approval' ); ?>
        <div class="approval"><div class="sign">Prepared by<div class="sign-space"></div><div class="sign-line">IT Auditor / Security Awareness Team</div></div><div class="sign">Reviewed and approved by<div class="sign-space"></div><div class="sign-line">CISO / Head of IT Security</div></div></div>
        <p class="compact-note">Approval date: ____________________ &nbsp; Review reference: <?php echo esc_html( $data['report_reference'] ); ?></p>
    </section>
</div>
</article>
<article class="page" aria-label="Recent activity and reporting conventions">
<div class="content">
    <section class="section">
        <?php $section_head( '13', 'Recent Activity Register' ); ?>
        <p class="compact-note">A selection of the most recent clicks, submissions and reports, ordered from newest to oldest. This register is a recent-activity extract of up to <?php echo (int) $data['recent_events_limit']; ?> events, not an exhaustive event history.</p>
        <div class="table-wrap"><table class="event-table"><colgroup><col style="width:6%"><col style="width:24%"><col style="width:29%"><col style="width:20%"><col style="width:21%"></colgroup><thead><tr><th>No.</th><th>Participant</th><th>Department</th><th>Activity</th><th>Timestamp<br><?php echo esc_html( $data['timezone'] ); ?></th></tr></thead><tbody>
            <?php foreach ( $data['events'] as $index => $event ) : ?><tr><td><?php echo sprintf( '%02d', $index + 1 ); ?></td><td><?php echo esc_html( $event['name'] ); ?></td><td><?php echo esc_html( $event['department'] ); ?></td><td class="<?php echo esc_attr( $event['message_class'] ); ?>"><?php echo esc_html( $event['message'] ); ?></td><td><?php echo esc_html( $event['time_label'] ); ?></td></tr><?php endforeach; ?>
            <?php if ( ! $data['events'] ) : ?><tr><td colspan="5" class="empty-state">No recorded activity is available for this selection yet.</td></tr><?php endif; ?>
        </tbody></table></div>
    </section>
    <section class="section">
        <?php $section_head( '14', 'Reporting Conventions & Interpretation' ); ?>
        <div class="definitions">
            <div class="definition"><h3>Counting basis</h3><p>Recipient records are summed across campaigns. They do not constitute a deduplicated count of people. Unique participants cannot be established from the consolidated metrics alone.</p></div>
            <div class="definition"><h3>Rates and denominators</h3><p>Rates use recorded recipients as the denominator, including records without a sent email. Consolidated percentages are recalculated from summed counts, not averaged from individual campaign rates.</p></div>
            <div class="definition"><h3>Stage overlap</h3><p>A recipient may open, click, submit data and report within the same campaign. These stage counts are not mutually exclusive. No combined exposure total is inferred from their sum.</p></div>
            <div class="definition"><h3>Snapshot completeness</h3><p>Metrics reflect cached campaign results at each campaign's latest synchronisation. Unsynchronised campaigns remain in the scope register, with results marked unavailable.</p></div>
            <div class="definition"><h3>Activity timestamps</h3><p>Event timestamps are displayed in <?php echo esc_html( $data['timezone'] ); ?>. The hourly chart retains UTC buckets. The recent-activity extract is limited to the latest records returned by Monitoring, currently up to <?php echo (int) $data['recent_events_limit']; ?>.</p></div>
            <div class="definition"><h3>Comparison limits</h3><p>Scenario difficulty, cohort composition and campaign duration may differ. Comparisons describe the recorded selection and should inform targeted review before conclusions about broader trends are drawn.</p></div>
        </div>
    </section>
</div>
</article>
</main>
</body>
</html>
