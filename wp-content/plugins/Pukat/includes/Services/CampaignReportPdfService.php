<?php
/**
 * Renders campaign / campaign group monitoring reports as PDF.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Dompdf\Dompdf;
use Dompdf\Options;

/**
 * Turns the same report shape CampaignRunService::report() and
 * CampaignGroupService::report()/report_active() already return
 * ({ stats, campaign_runs, generated_at }) into a PDF (docs/PRD_CAMPAIGN_GROUP_MONITORING.md
 * §7.5 FR-11). Pure rendering — callers own fetching/authorizing the data.
 */
class CampaignReportPdfService {

	/**
	 * @param array<string, mixed> $report Shape: { stats, campaign_runs, generated_at }.
	 */
	public function render( string $title, array $report ): string {
		$options = new Options();
		$options->set( 'isRemoteEnabled', false );
		$options->set( 'isHtml5ParserEnabled', true );

		$dompdf = new Dompdf( $options );
		$dompdf->loadHtml( $this->build_html( $title, $report ) );
		$dompdf->setPaper( 'A4', 'portrait' );
		$dompdf->render();

		return (string) $dompdf->output();
	}

	/**
	 * @param array<string, mixed> $report
	 */
	private function build_html( string $title, array $report ): string {
		$stats         = is_array( $report['stats'] ?? null ) ? $report['stats'] : [];
		$campaign_runs = is_array( $report['campaign_runs'] ?? null ) ? $report['campaign_runs'] : [];
		$generated_at  = (string) ( $report['generated_at'] ?? current_time( 'mysql' ) );

		$stat_rows = '';
		foreach ( [
			'Total targets'  => $stats['total'] ?? 0,
			'Emails sent'    => $stats['email_sent'] ?? 0,
			'Emails opened'  => sprintf( '%d (%s%%)', $stats['email_opened'] ?? 0, $stats['open_rate'] ?? 0 ),
			'Link clicks'    => sprintf( '%d (%s%%)', $stats['clicked'] ?? 0, $stats['click_rate'] ?? 0 ),
			'Data submitted' => sprintf( '%d (%s%%)', $stats['submitted_data'] ?? 0, $stats['submit_rate'] ?? 0 ),
		] as $label => $value ) {
			$stat_rows .= sprintf(
				'<tr><td class="label">%s</td><td class="value">%s</td></tr>',
				esc_html( $label ),
				esc_html( (string) $value )
			);
		}

		$run_rows = '';
		foreach ( $campaign_runs as $run ) {
			$run_stats = is_array( $run['stats'] ?? null ) ? $run['stats'] : [];
			$run_rows .= sprintf(
				'<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
				esc_html( (string) ( $run['name'] ?? '' ) ),
				esc_html( (string) ( $run['status'] ?? '' ) ),
				esc_html( (string) ( $run_stats['email_sent'] ?? 0 ) ),
				esc_html( (string) ( $run_stats['clicked'] ?? 0 ) ),
				esc_html( (string) ( $run_stats['submitted_data'] ?? 0 ) )
			);
		}

		if ( '' === $run_rows ) {
			$run_rows = '<tr><td colspan="5" class="empty">No campaigns in this selection.</td></tr>';
		}

		$org_name = (string) get_option( 'pukat_org_name', get_bloginfo( 'name' ) );

		return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
	body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f2937; }
	h1 { font-size: 18px; margin-bottom: 2px; }
	.subtitle { color: #6b7280; margin-bottom: 18px; }
	table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
	th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
	th { background: #f9fafb; text-transform: uppercase; font-size: 9px; color: #6b7280; }
	.label { font-weight: bold; width: 40%; }
	.value { text-align: right; }
	.empty { text-align: center; color: #9ca3af; font-style: italic; }
	.footer { margin-top: 20px; color: #9ca3af; font-size: 9px; }
</style>
</head>
<body>
	<h1>{$org_name} — {$title}</h1>
	<div class="subtitle">Generated {$generated_at}</div>

	<table>
		{$stat_rows}
	</table>

	<h3>Campaigns in this report</h3>
	<table>
		<thead>
			<tr><th>Campaign</th><th>Status</th><th>Sent</th><th>Clicked</th><th>Submitted</th></tr>
		</thead>
		<tbody>
			{$run_rows}
		</tbody>
	</table>

	<div class="footer">Pukat Monitoring — auto-generated report.</div>
</body>
</html>
HTML;
	}
}
