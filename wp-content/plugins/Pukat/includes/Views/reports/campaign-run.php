<?php
/** Design from new-export-campaign.html; $data is prepared by CampaignReportPdfService. */
defined( 'ABSPATH' ) || exit;
$section_head = static function ( string $number, string $title ): void {
    ?><div class="section-head"><span class="section-no"><?php echo esc_html( $number ); ?></span><h2 class="section-title"><?php echo esc_html( $title ); ?></h2><span class="section-rule"></span></div><?php
};
$ranking = static function ( array $rows ): void {
    foreach ( $rows as $index => $row ) {
        ?><div class="ranking-row"><span class="ranking-number"><?php echo sprintf( '%02d', $index + 1 ); ?></span><span class="ranking-name"><?php echo esc_html( $row['name'] ); ?><span class="ranking-detail"><?php echo esc_html( $row['detail'] ); ?></span></span><span class="ranking-value"><?php echo esc_html( null === $row['count'] ? '—' : (string) $row['count'] ); ?></span></div><?php
    }
};
?>
<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Campaign Evaluation — <?php echo esc_html( $data['campaign_name'] ); ?></title>
<style><?php echo $report_css; ?></style>
</head>
<body>
<main>
<article class="page" aria-label="Campaign overview">
<div class="content">
    <div class="title-block"><div class="kicker">Campaign Evaluation</div><h1>Phishing Simulation<br>Campaign Evaluation</h1><div class="subtitle"><?php echo esc_html( $data['campaign_name'] ); ?> · Campaign #<?php echo $data['campaign_id']; ?> · <?php echo esc_html( $data['report_date'] ); ?></div></div>
    <section class="section">
        <?php $section_head( '01', 'Campaign Overview & Scenario' ); ?>
        <div class="facts"><?php foreach ( $data['facts'] as $label => $value ) : ?><div class="fact"><div class="fact-label"><?php echo esc_html( $label ); ?></div><div class="fact-value"><?php echo esc_html( $value ); ?></div></div><?php endforeach; ?></div>
    </section>
    <section class="section">
        <?php $section_head( '02', 'Executive Summary' ); ?>
        <div class="summary-layout"><div class="summary-copy"><?php foreach ( $data['summary'] as $paragraph ) : ?><p><?php echo $paragraph; ?></p><?php endforeach; ?></div><aside class="assessment <?php echo esc_attr( $data['assessment']['class'] ); ?>"><div class="assessment-label">Overall Assessment</div><div class="assessment-value"><?php echo esc_html( $data['assessment']['label'] ); ?></div><div class="assessment-note"><?php echo esc_html( $data['assessment']['note'] ); ?></div></aside></div>
    </section>
    <section class="section">
        <?php $section_head( '03', 'Campaign Performance Metrics' ); ?>
        <div class="metrics"><?php foreach ( $data['metrics'] as $metric ) : ?><div class="metric <?php echo esc_attr( $metric['class'] ); ?>"><div class="metric-label"><?php echo esc_html( $metric['label'] ); ?></div><div class="metric-value"><?php echo esc_html( $metric['value'] ); ?></div><div class="metric-note"><?php echo esc_html( $metric['note'] ); ?></div></div><?php endforeach; ?></div>
        <div class="notes"><?php foreach ( $data['notes'] as $note ) : ?><div class="note"><strong><?php echo esc_html( $note['title'] ); ?></strong><?php echo esc_html( $note['body'] ); ?></div><?php endforeach; ?></div>
    </section>
    <section class="section page-one-analysis" style="margin-top:14px;">
        <?php $section_head( '04', 'User Response Analysis' ); ?>
        <div class="response-analysis-layout">
            <div><div class="analysis-title">Response Distribution</div>
                <?php if ( $data['details_complete'] ) : ?>
                <div class="response-chart-area">
                    <div class="response-donut" style="--donut-fill:<?php echo esc_attr( $data['donut_gradient'] ); ?>" aria-label="User response distribution"><div class="response-donut-center"><div><strong><?php echo $data['total']; ?></strong><span>Recipients</span></div></div></div>
                    <div class="response-legend"><?php foreach ( $data['segments'] as $segment ) : ?><div class="response-legend-row"><span class="response-legend-dot" style="background:<?php echo esc_attr( $segment['color'] ); ?>"></span><span class="response-legend-name"><?php echo esc_html( $segment['label'] ); ?></span><span class="response-legend-value"><strong style="color:<?php echo esc_attr( $segment['color'] ); ?>"><?php echo $segment['count']; ?></strong><span><?php echo esc_html( $segment['rate'] ); ?></span></span></div><?php endforeach; ?></div>
                </div>
                <?php else : ?><div class="empty-state"><?php echo esc_html( $data['detail_note'] ); ?></div><?php endif; ?>
            </div>
            <div class="response-rankings">
                <div class="ranking-group"><div class="ranking-group-title">Top 3 Departments by Recorded Response Activity</div><?php $ranking( $data['department_ranking'] ); ?></div>
                <div class="ranking-group"><div class="ranking-group-title">Top 3 Positions by Recorded Response Activity</div><?php $ranking( $data['position_ranking'] ); ?><div class="data-note">Job titles reflect the campaign's recorded target metadata.</div></div>
            </div>
        </div>
        <div class="response-summary"><div class="response-summary-label">Summary</div><p class="response-summary-text"><?php echo esc_html( $data['response_summary'] ); ?></p></div>
        <div class="data-note">Exposure and reporting may overlap. The chart uses mutually exclusive categories, with reporting taking precedence. Recipients who neither clicked nor reported may have opened the email.</div>
    </section>
</div>
</article>
<article class="page" aria-label="Departmental analysis and findings">
<div class="content">
    <section class="section">
        <?php $section_head( '05', 'Response Distribution by Department' ); ?>
        <div class="table-wrap"><table class="department-table"><colgroup><col style="width:30%"><col style="width:11%"><col style="width:11%"><col style="width:22%"><col style="width:14%"><col style="width:12%"></colgroup><thead><tr><th>Department</th><th class="center">Targets</th><th class="center">Opened</th><th class="center">Click / Data Interaction</th><th class="center">Reported</th><th class="center">Risk</th></tr></thead><tbody>
            <?php foreach ( $data['departments'] as $department ) : ?><tr><td><?php echo esc_html( $department['name'] ); ?></td><td class="center"><?php echo $department['total']; ?></td><td class="center"><?php echo $department['opened']; ?></td><td class="center"><?php echo $department['exposed']; ?></td><td class="center"><?php echo $department['reported']; ?></td><td class="center"><span class="risk-text risk-<?php echo esc_attr( $department['risk'] ); ?>"><?php echo esc_html( strtoupper( $department['risk'] ) ); ?></span></td></tr><?php endforeach; ?>
            <?php if ( $data['details_complete'] ) : ?><tr class="total"><td>TOTAL</td><td class="center"><?php echo $data['total']; ?></td><td class="center"><?php echo $data['detail_totals']['opened']; ?></td><td class="center"><?php echo $data['exposed']; ?></td><td class="center"><?php echo $data['detail_totals']['reported']; ?></td><td class="center">—</td></tr><?php else : ?><tr><td colspan="6" class="empty-state"><?php echo esc_html( $data['detail_note'] ); ?></td></tr><?php endif; ?>
        </tbody></table></div>
        <p class="data-note">Departmental risk reflects the click/data submission rate: &lt;15% LOW, 15–&lt;40% MEDIUM, ≥40% HIGH. Opens and reports are derived from recipient timelines or statuses.</p>
    </section>
    <section class="section">
        <?php $section_head( '06', 'Key Observations' ); ?>
        <div class="observations"><?php foreach ( $data['observations'] as $observation ) : ?><div class="observation <?php echo esc_attr( $observation['class'] ); ?>"><div class="observation-title"><?php echo esc_html( $observation['title'] ); ?></div><p><?php echo esc_html( $observation['body'] ); ?></p></div><?php endforeach; ?></div>
    </section>
    <section class="section">
        <?php $section_head( '07', 'Key Findings' ); ?>
        <?php foreach ( $data['findings'] as $index => $finding ) : ?><div class="finding"><div class="finding-index"><?php echo sprintf( '%02d', $index + 1 ); ?></div><div><div class="finding-title"><?php echo esc_html( $finding['title'] ); ?></div><div class="finding-desc"><?php echo $finding['body']; ?></div></div><div class="finding-risk risk-<?php echo esc_attr( $finding['level'] ); ?>"><?php echo esc_html( $finding['label'] ); ?></div></div><?php endforeach; ?>
    </section>
</div>
</article>
<article class="page" aria-label="Risk assessment and remediation">
<div class="content">
    <section class="section">
        <?php $section_head( '08', 'Risk Assessment Matrix' ); ?>
        <div class="table-wrap"><table class="risk-table"><colgroup><col style="width:27%"><col style="width:14%"><col style="width:59%"></colgroup><thead><tr><th>Assessment Area</th><th class="center">Risk</th><th>Assessment Rationale</th></tr></thead><tbody>
            <?php foreach ( $data['risk_matrix'] as $row ) : ?><tr><td><strong><?php echo esc_html( $row['title'] ); ?></strong></td><td class="center"><span class="risk-text risk-<?php echo esc_attr( $row['level'] ); ?>"><?php echo esc_html( $row['label'] ); ?></span></td><td><?php echo esc_html( $row['body'] ); ?></td></tr><?php endforeach; ?>
            <?php if ( ! $data['risk_matrix'] ) : ?><tr><td colspan="3" class="empty-state">Campaign results are not yet available for risk assessment.</td></tr><?php endif; ?>
        </tbody></table></div>
        <p class="data-note">Ratings follow Pukat simulation criteria. Recipient count alone does not establish organisational representativeness. Overall Assessment adopts the higher exposure or reporting risk rating; coverage is assessed separately.</p>
    </section>
    <section class="section">
        <?php $section_head( '09', 'Recommendations & Follow-up Actions' ); ?>
        <?php foreach ( $data['recommendations'] as $index => $recommendation ) : ?><div class="recommendation"><div class="recommendation-no"><?php echo sprintf( '%02d', $index + 1 ); ?></div><div><div class="recommendation-title"><?php echo esc_html( $recommendation['title'] ); ?></div><div class="recommendation-desc"><?php echo esc_html( $recommendation['body'] ); ?></div></div><div class="priority">Priority <?php echo $recommendation['priority']; ?></div></div><?php endforeach; ?>
    </section>
    <section class="section">
        <?php $section_head( '10', 'Approval' ); ?>
        <div class="approval"><div class="sign">Prepared by<div class="sign-space"></div><div class="sign-line">IT Auditor / Security Awareness Team</div></div><div class="sign">Approved by<div class="sign-space"></div><div class="sign-line">CISO / Head of IT Security</div></div></div>
    </section>
</div>
</article>
<?php foreach ( $data['response_chunks'] as $chunk_index => $chunk ) : ?>
<article class="page" aria-label="Participant response appendix">
<div class="content">
    <section class="section" style="margin-top:20px;">
        <?php $section_head( (string) ( 11 + $chunk_index ), 'Users with Recorded Campaign Responses' ); ?>
        <div class="appendix-intro">This register records recipients who opened, clicked, submitted data or reported the email. Each recipient appears once, with the displayed response prioritised as Reported, Submitted, Clicked, then Opened. Timestamps correspond to that response in the site timezone, <?php echo esc_html( $data['timezone'] ); ?>. <?php if ( ! $data['details_complete'] ) { echo esc_html( $data['detail_note'] ); } ?></div>
        <div class="table-wrap"><table class="response-user-table"><colgroup><col style="width:6%"><col style="width:18%"><col style="width:24%"><col style="width:24%"><col style="width:13%"><col style="width:15%"></colgroup><thead><tr><th class="center">No.</th><th>Participant</th><th>Email</th><th>Department</th><th>Response</th><th class="center">Timestamp</th></tr></thead><tbody>
            <?php foreach ( $chunk as $index => $response ) : ?><tr><td class="center"><?php echo $chunk_index * 25 + $index + 1; ?></td><td><?php echo esc_html( $response['name'] ); ?></td><td class="email"><?php echo esc_html( $response['email'] ); ?></td><td><?php echo esc_html( $response['department'] ); ?></td><td><span class="response-type response-<?php echo esc_attr( $response['class'] ); ?>"><?php echo esc_html( $response['response'] ); ?></span></td><td class="center"><time><?php echo esc_html( $response['date'] ); ?></time><time><?php echo esc_html( $response['time'] ); ?></time></td></tr><?php endforeach; ?>
            <?php if ( ! $chunk ) : ?><tr><td colspan="6" class="empty-state"><?php echo $data['has_data'] ? 'No participant responses have been recorded.' : 'Participant response data is not yet available.'; ?></td></tr><?php endif; ?>
        </tbody></table></div>
        <div class="appendix-summary"><div><strong><?php echo count( $chunk ); ?></strong>Participants in this appendix section</div><div><strong><?php echo $data['response_count']; ?></strong>Total participants in the response register</div><div><strong><?php echo $chunk ? ( $chunk_index * 25 + 1 ) . '–' . ( $chunk_index * 25 + count( $chunk ) ) : '—'; ?></strong>Record range in this section</div></div>
    </section>
</div>
</article>
<?php endforeach; ?>
</main>
</body>
</html>
