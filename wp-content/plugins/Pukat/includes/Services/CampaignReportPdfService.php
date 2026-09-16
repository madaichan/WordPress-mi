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
use WP_Error;

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

	// -------------------------------------------------------------------
	// Single Campaign Run report — Chromium with editable HTML/CSS templates.
	// -------------------------------------------------------------------

	/**
	 * @param array<string, mixed> $context {
	 *     @type array<string, mixed>       $run                  Prepared Campaign Run (CampaignRunService::prepare_run()), incl. source_playbook.
	 *     @type array<string, mixed>       $stats                Aggregate stats (CampaignRunService::aggregate_result_stats() shape).
	 *     @type array<int, array>          $department_breakdown CampaignRunService::department_breakdown() rows.
	 *     @type array<int, array>          $target_details       CampaignRunService::target_details() rows.
	 *     @type bool                       $synced               Whether GoPhish results have been synced at least once.
	 *     @type string                     $generated_at         MySQL datetime.
	 * }
	 */
	public function render_campaign_run( array $context ): string|WP_Error {
		return ( new ChromiumPdfService() )->render( $this->campaign_run_document( $context ) );
	}

	/**
	 * @param array<string, mixed> $context See render_campaign_run().
	 * @return array{html: string, header: string, footer: string} Escaped, self-contained print document.
	 */
	public function campaign_run_document( array $context ): array {
		$run                  = is_array( $context['run'] ?? null ) ? $context['run'] : [];
		$stats                = is_array( $context['stats'] ?? null ) ? $context['stats'] : [];
		$department_breakdown = is_array( $context['department_breakdown'] ?? null ) ? $context['department_breakdown'] : [];
		$target_details       = is_array( $context['target_details'] ?? null ) ? $context['target_details'] : [];
		$synced               = ! empty( $context['synced'] );
		$generated_at         = (string) ( $context['generated_at'] ?? current_time( 'mysql' ) );
		$playbook             = is_array( $run['source_playbook'] ?? null ) ? $run['source_playbook'] : [];
		$total                = (int) ( $stats['total'] ?? 0 );
		$has_data             = $synced && $total > 0;

		$org_name = esc_html( (string) get_option( 'pukat_org_name', get_bloginfo( 'name' ) ) );
		$run_name = esc_html( (string) ( $run['name'] ?? '-' ) );

		// -- Section 1: meta grid ---------------------------------------
		$meta_rows = [
			'ID Kampanye'       => sprintf( '%s (#%d)', $run_name, (int) ( $run['id'] ?? 0 ) ),
			'Tingkat Kesulitan' => $playbook ? sprintf( '%d / 5', (int) ( $playbook['difficulty'] ?? 1 ) ) : '-',
			'Aplikasi/Platform' => 'Pukat Phishing Simulation Platform (GoPhish integration)',
			'Waktu Peluncuran'  => $this->format_datetime_id( $run['launched_at'] ?? $run['schedule_at'] ?? null ),
			'Vektor Serangan'   => esc_html( (string) ( $playbook['scenario'] ?? '-' ) ?: '-' ),
			'Target Departemen' => $this->campaign_run_department_label( $department_breakdown, $total ),
		];
		$meta_cells = [];
		foreach ( $meta_rows as $label => $value ) {
			$meta_cells[] = sprintf(
				'<td><span class="meta-label">%s:</span>%s</td>',
				esc_html( $label ),
				$value
			);
		}
		$meta_html = '';
		foreach ( array_chunk( $meta_cells, 2 ) as $pair ) {
			$meta_html .= '<tr>' . implode( '', $pair ) . '</tr>';
		}

		// -- Section 2: executive summary --------------------------------
		$levels = [
			'vulnerability' => $this->campaign_run_vulnerability_level( $stats ),
			'compliance'    => $this->campaign_run_compliance_level( $stats ),
			'coverage'      => $this->campaign_run_coverage_level( $total ),
		];
		[ $summary_p1, $summary_p2 ] = $has_data
			? $this->campaign_run_executive_summary( $run, $playbook, $levels )
			: [
				sprintf(
					$synced
						? 'Hasil kampanye simulasi phishing %s telah disinkronkan, tetapi belum ada target yang tercatat sehingga metrik keterlibatan target belum dapat dinilai.'
						: 'Hingga laporan ini dibuat, hasil kampanye simulasi phishing %s belum disinkronkan dari GoPhish sehingga metrik keterlibatan target belum tersedia.',
					'<b>"' . esc_html( (string) ( $run['name'] ?? '-' ) ) . '"</b>'
				),
				$synced
					? 'Periksa daftar target dan hasil sinkronisasi sebelum laporan ini digunakan sebagai dasar audit.'
					: 'Lakukan sinkronisasi hasil kampanye (tombol Refresh pada halaman Monitoring) sebelum laporan ini digunakan sebagai dasar audit.',
			];

		// -- Section 3: funnel + donut ------------------------------------
		$funnel_html = $has_data ? $this->campaign_run_funnel_html( $stats, $total ) : '';
		$donut_html  = $has_data ? $this->campaign_run_donut_html( $target_details, $total ) : '';

		// -- Section 4/5/6: findings, risk matrix, recommendations --------
		$findings        = $has_data ? $this->campaign_run_findings( $stats, $target_details ) : [];
		$target_rows_html = $this->campaign_run_target_rows_html( $target_details );
		$risk_rows_html   = $has_data ? $this->campaign_run_risk_matrix_html( $levels ) : '';
		$recommendations  = $this->campaign_run_recommendations( $levels, $findings, $has_data );

		$findings_html = '';
		foreach ( $findings as $finding ) {
			$findings_html .= sprintf( '<li><b>%s:</b> %s</li>', esc_html( $finding['title'] ), $finding['body'] );
		}
		if ( '' === $findings_html ) {
			$findings_html = '<li>' . ( $has_data
				? 'Tidak ditemukan temuan signifikan pada pengujian kampanye ini.'
				: 'Belum ada data hasil kampanye untuk dianalisis.' ) . '</li>';
		}

		$recommendations_html = '';
		foreach ( $recommendations as $rec ) {
			$recommendations_html .= sprintf( '<li><b>%s:</b> %s</li>', esc_html( $rec['title'] ), $rec['body'] );
		}

		$report_date = $this->format_datetime_id( $generated_at, false );

		$charts_html      = $this->campaign_run_charts_or_empty( $has_data, $funnel_html, $donut_html );
		$risk_matrix_html = $this->campaign_run_risk_matrix_or_empty( $has_data, $risk_rows_html );
		$kpi_html         = $this->campaign_run_kpi_html( $stats, $total, $has_data );
		$template_dir     = dirname( __DIR__ ) . '/Views/reports/';
		$report_css       = (string) file_get_contents( $template_dir . 'campaign-run.css' );
		$document         = [];
		foreach ( [ 'html' => 'campaign-run.php', 'header' => 'header.php', 'footer' => 'footer.php' ] as $key => $file ) {
			ob_start();
			try {
				include $template_dir . $file;
				$document[ $key ] = (string) ob_get_contents();
			} finally {
				ob_end_clean();
			}
		}
		return $document;
	}

	/** @param array<string, mixed> $stats */
	private function campaign_run_kpi_html( array $stats, int $total, bool $has_data ): string {
		$html = '<div class="kpi-grid" aria-label="Metrik utama">';
		foreach ( [
			[ 'EMAIL TERKIRIM', 'email_sent', false, false ],
			[ 'EMAIL DIBUKA', 'email_opened', true, false ],
			[ 'TAUTAN DIKLIK', 'clicked', true, false ],
			[ 'DATA DIKIRIM', 'submitted_data', true, true ],
		] as [ $label, $key, $is_rate, $alert ] ) {
			$count = (int) ( $stats[ $key ] ?? 0 );
			$rate  = $total > 0 ? round( $count / $total * 100, 1 ) : 0;
			$value = $has_data ? ( $is_rate ? $rate . '%' : (string) $count ) : '—';
			$note  = $has_data ? sprintf( '%d dari %d target', $count, $total ) : 'Data belum tersedia';
			$html .= sprintf(
				'<div class="kpi%s"><span class="kpi-label">%s</span><strong>%s</strong><small>%s</small></div>',
				$alert && $has_data && $count > 0 ? ' alert' : '',
				esc_html( $label ), esc_html( $value ), esc_html( $note )
			);
		}
		return $html . '</div>';
	}

	private function campaign_run_charts_or_empty( bool $has_data, string $funnel_html, string $donut_html ): string {
		if ( ! $has_data ) {
			return '<div class="empty-box">Belum ada data hasil kampanye — grafik akan muncul setelah hasil GoPhish disinkronkan.</div>';
		}

		return <<<HTML
	<div class="chart-container">
			<div class="chart-box">
				<div class="chart-title">Corong Simulasi (Funnel)</div>
				{$funnel_html}
			</div>

			<div class="chart-box">
				<div class="chart-title">Distribusi Respons Pengguna</div>
				{$donut_html}
			</div>
	</div>
HTML;
	}

	private function campaign_run_risk_matrix_or_empty( bool $has_data, string $risk_rows_html ): string {
		if ( ! $has_data ) {
			return '<div class="empty-box">Belum ada data hasil kampanye — matriks risiko akan muncul setelah hasil GoPhish disinkronkan.</div>';
		}

		return <<<HTML
	<table>
		<colgroup><col style="width:30%"><col style="width:16%"><col style="width:54%"></colgroup>
		<thead>
			<tr><th>Area Evaluasi</th><th>Tingkat Risiko</th><th>Keterangan Audit</th></tr>
		</thead>
		<tbody>
			{$risk_rows_html}
		</tbody>
	</table>
HTML;
	}

	/**
	 * @param array<string, mixed> $stats
	 */
	private function campaign_run_funnel_html( array $stats, int $total ): string {
		$steps = [
			[ 'label' => 'Sent (Terkirim)', 'count' => (int) ( $stats['email_sent'] ?? 0 ), 'pct' => $total > 0 ? round( ( (int) ( $stats['email_sent'] ?? 0 ) / $total ) * 100, 1 ) : 0, 'color' => '#2b5876' ],
			[ 'label' => 'Opened (Dibuka)', 'count' => (int) ( $stats['email_opened'] ?? 0 ), 'pct' => (float) ( $stats['open_rate'] ?? 0 ), 'color' => '#4e4376' ],
			[ 'label' => 'Link Clicks', 'count' => (int) ( $stats['clicked'] ?? 0 ), 'pct' => (float) ( $stats['click_rate'] ?? 0 ), 'color' => '#2e7d32' ],
			[ 'label' => 'Data Submitted', 'count' => (int) ( $stats['submitted_data'] ?? 0 ), 'pct' => (float) ( $stats['submit_rate'] ?? 0 ), 'color' => '#c62828' ],
		];

		$widths = [ 90, 70, 50, 30 ];
		$html   = '';
		foreach ( $steps as $index => $step ) {
			$opacity = $step['count'] > 0 ? 1 : 0.4;
			$html   .= sprintf(
				'<div class="funnel-step" style="background-color:%s;width:%d%%;opacity:%s;">%s: %d (%s%%)</div>',
				esc_attr( $step['color'] ),
				$widths[ $index ],
				esc_attr( (string) $opacity ),
				esc_html( $step['label'] ),
				$step['count'],
				esc_html( (string) $step['pct'] )
			);
		}

		return $html;
	}

	/**
	 * @param array<int, array<string, mixed>> $target_details
	 */
	private function campaign_run_donut_html( array $target_details, int $total ): string {
		if ( count( $target_details ) !== $total ) {
			return '<div class="empty-box">Distribusi respons belum tersedia karena detail target belum lengkap.</div>';
		}
		$segments = $this->campaign_run_donut_segments( $target_details, $total );

		$dominant = $segments[0];
		foreach ( $segments as $segment ) {
			if ( $segment['pct'] > $dominant['pct'] ) {
				$dominant = $segment;
			}
		}

		$legend = '';
		foreach ( $segments as $segment ) {
			$legend .= sprintf(
				'<span class="legend-item"><span class="dot" style="background:%s"></span> %s (%d)</span>',
				esc_attr( $segment['color'] ),
				esc_html( $segment['label'] ),
				$segment['count']
			);
		}

		return sprintf(
			'<img class="donut-chart" src="%s" alt="Distribusi respons pengguna" /><div class="chart-legend">%s</div>',
			$this->campaign_run_donut_svg_data_uri( $segments, $dominant['pct'] ),
			$legend
		);
	}

	/**
	 * The donut is a self-contained SVG data URI; the browser never needs
	 * to fetch chart assets from another server.
	 *
	 * @param array<int, array{label: string, count: int, pct: float, color: string}> $segments
	 */
	private function campaign_run_donut_svg_data_uri( array $segments, float $dominant_pct ): string {
		$size          = 120;
		$stroke        = 20;
		$radius        = ( $size - $stroke ) / 2;
		$center        = $size / 2;
		$circumference = 2 * M_PI * $radius;

		$circles = '';
		$offset  = 0.0;
		foreach ( $segments as $segment ) {
			if ( $segment['pct'] <= 0 ) {
				continue;
			}

			$length = $circumference * ( $segment['pct'] / 100 );
			$circles .= sprintf(
				'<circle cx="%1$d" cy="%1$d" r="%2$.3F" fill="none" stroke="%3$s" stroke-width="%4$d" stroke-dasharray="%5$.3F %6$.3F" stroke-dashoffset="%7$.3F" transform="rotate(-90 %1$d %1$d)" />',
				$center,
				$radius,
				esc_attr( $segment['color'] ),
				$stroke,
				$length,
				max( 0, $circumference - $length ),
				-$offset
			);
			$offset += $length;
		}

		if ( '' === $circles ) {
			$circles = sprintf(
				'<circle cx="%1$d" cy="%1$d" r="%2$.3F" fill="none" stroke="#e0e0e0" stroke-width="%3$d" />',
				$center,
				$radius,
				$stroke
			);
		}

		$label = esc_html( (string) round( $dominant_pct ) ) . '%';
		$svg   = sprintf(
			'<svg xmlns="http://www.w3.org/2000/svg" width="%1$d" height="%1$d" viewBox="0 0 %1$d %1$d">%2$s<text x="%3$d" y="%4$d" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" fill="#333333">%5$s</text></svg>',
			$size,
			$circles,
			$center,
			$center + 7,
			$label
		);

		return 'data:image/svg+xml;base64,' . base64_encode( $svg );
	}

	/**
	 * Mutually exclusive outcomes derived from target timelines/statuses.
	 * Reporting takes priority over clicking/submitting data. Aggregate
	 * counts cannot tell us which reported targets also clicked.
	 *
	 * @param array<int, array<string, mixed>> $target_details
	 * @return array<int, array{label: string, count: int, pct: float, color: string}>
	 */
	private function campaign_run_donut_segments( array $target_details, int $total ): array {
		$reported = 0;
		$clicked  = 0;
		foreach ( $target_details as $target ) {
			$status = (string) ( $target['status'] ?? '' );
			if ( ! empty( $target['reported_at'] ) || 'Email Reported' === $status ) {
				$reported++;
			} elseif ( ! empty( $target['clicked_at'] ) || ! empty( $target['submitted_at'] )
				|| in_array( $status, [ 'Clicked Link', 'Submitted Data' ], true ) ) {
				$clicked++;
			}
		}
		$remaining = max( 0, $total - $reported - $clicked );
		$pct = static fn( int $count ): float => $total > 0 ? round( ( $count / $total ) * 100, 2 ) : 0.0;
		return [
			[ 'label' => 'Tanpa klik/laporan', 'count' => $remaining, 'pct' => $pct( $remaining ), 'color' => '#2b5876' ],
			[ 'label' => 'Klik/data', 'count' => $clicked, 'pct' => $pct( $clicked ), 'color' => '#c62828' ],
			[ 'label' => 'Dilaporkan', 'count' => $reported, 'pct' => $pct( $reported ), 'color' => '#2e7d32' ],
		];
	}

	/**
	 * @param array<int, array<string, mixed>> $target_details
	 */
	private function campaign_run_target_rows_html( array $target_details ): string {
		if ( empty( $target_details ) ) {
			return '<tr><td colspan="5" style="text-align:center;color:#9ca3af;font-style:italic;">Belum ada data target — sinkronkan hasil kampanye terlebih dahulu.</td></tr>';
		}

		$html = '';
		foreach ( $target_details as $target ) {
			$html .= sprintf(
				'<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
				esc_html( (string) ( $target['name'] ?? '-' ) ),
				esc_html( (string) ( $target['email'] ?? '-' ) ),
				esc_html( (string) ( $target['department'] ?? '-' ) ),
				esc_html( (string) ( $target['status'] ?? '-' ) ),
				! empty( $target['reported_at'] ) || 'Email Reported' === ( $target['status'] ?? '' ) ? 'Dilaporkan' : 'Tidak Dilaporkan'
			);
		}

		return $html;
	}

	/**
	 * @param array<int, array<string, mixed>> $department_breakdown
	 */
	private function campaign_run_department_label( array $department_breakdown, int $total ): string {
		if ( empty( $department_breakdown ) ) {
			return $total > 0 ? sprintf( '%d Target', $total ) : '-';
		}

		$names = array_map(
			static fn( array $row ): string => esc_html( (string) ( $row['department'] ?? 'Unassigned' ) ),
			$department_breakdown
		);

		return sprintf( '%s (%d Target)', implode( ', ', $names ), $total );
	}

	/**
	 * Vulnerability = whether target interaction reached actual data/credential
	 * compromise. Submitted data outranks a bare click, which outranks no
	 * interaction at all.
	 *
	 * @param array<string, mixed> $stats
	 * @return array{level: string, label: string, note: string}
	 */
	private function campaign_run_vulnerability_level( array $stats ): array {
		$submitted = (int) ( $stats['submitted_data'] ?? 0 );
		$clicked   = (int) ( $stats['clicked'] ?? 0 );

		if ( $submitted > 0 ) {
			return [
				'level' => 'high',
				'label' => 'HIGH',
				'note'  => 'ditemukan pengiriman data pada halaman simulasi — indikasi risiko kompromi kredensial/informasi',
				'desc'  => 'Ditemukan target yang mengirimkan data pada halaman simulasi phishing — indikasi risiko kompromi kredensial/informasi tertinggi.',
			];
		}

		if ( $clicked > 0 ) {
			return [
				'level' => 'medium',
				'label' => 'MEDIUM',
				'note'  => 'sebagian target mengklik tautan simulasi meskipun tidak ditemukan pengiriman data lanjutan',
				'desc'  => 'Target mengklik tautan simulasi namun tidak ditemukan pengiriman data lanjutan pada halaman simulasi.',
			];
		}

		return [
			'level' => 'low',
			'label' => 'LOW',
			'note'  => 'tidak ditemukan interaksi berbahaya (klik tautan atau pengiriman data) dari target',
			'desc'  => 'Tidak ada kebocoran data atau interaksi berbahaya lain yang tercatat dari target.',
		];
	}

	/**
	 * Compliance = how actively targets reported the suspicious email, out
	 * of everyone the campaign reached. Thresholds mirror
	 * CampaignRunService::department_risk_level()'s style of round-number
	 * cutoffs rather than a statistically derived model.
	 *
	 * @param array<string, mixed> $stats
	 * @return array{level: string, label: string, note: string}
	 */
	private function campaign_run_compliance_level( array $stats ): array {
		$report_rate = (float) ( $stats['report_rate'] ?? 0 );

		if ( $report_rate >= 50 ) {
			return [
				'level' => 'low',
				'label' => 'LOW',
				'note'  => 'lebih dari separuh target melaporkan email mencurigakan — budaya pelaporan tergolong baik',
				'desc'  => 'Sebagian besar target melaporkan email mencurigakan ke tim keamanan — budaya pelaporan tergolong baik.',
			];
		}

		if ( $report_rate >= 10 ) {
			return [
				'level' => 'medium',
				'label' => 'MEDIUM',
				'note'  => 'hanya sebagian kecil target melaporkan email mencurigakan',
				'desc'  => 'Hanya sebagian kecil target yang melaporkan email mencurigakan ke tim keamanan (SOC).',
			];
		}

		return [
			'level' => 'high',
			'label' => 'HIGH',
			'note'  => 'ditemukan celah pada kesadaran pelaporan aktif — hampir tidak ada target yang melaporkan ancaman',
			'desc'  => 'Celah pada kesadaran pelaporan aktif — hampir tidak ada target yang melaporkan indikasi ancaman ke tim keamanan (SOC).',
		];
	}

	/**
	 * Coverage = whether the sample size is large enough for the result to
	 * represent the organization's overall risk posture, not just this
	 * specific batch of targets.
	 *
	 * @return array{level: string, label: string, note: string}
	 */
	private function campaign_run_coverage_level( int $total ): array {
		if ( $total >= 30 ) {
			return [
				'level' => 'low',
				'label' => 'LOW',
				'note'  => 'ukuran sampel memadai untuk merepresentasikan postur risiko organisasi',
				'desc'  => 'Ukuran sampel target memadai untuk merepresentasikan postur risiko organisasi secara umum.',
			];
		}

		if ( $total >= 10 ) {
			return [
				'level' => 'medium',
				'label' => 'MEDIUM',
				'note'  => 'ukuran sampel cukup untuk indikasi awal namun sebaiknya diperluas',
				'desc'  => 'Ukuran sampel cukup untuk indikasi awal, namun sebaiknya diperluas agar hasil lebih representatif.',
			];
		}

		return [
			'level' => 'high',
			'label' => 'HIGH GAP',
			'note'  => 'ukuran sampel tidak representatif untuk mengukur postur risiko organisasi secara menyeluruh',
			'desc'  => sprintf( 'Ukuran sampel (%d target) tidak representatif untuk mengukur postur risiko organisasi secara menyeluruh.', $total ),
		];
	}

	private function risk_badge_class( string $level ): string {
		return match ( $level ) {
			'high' => 'bg-high',
			'medium' => 'bg-medium',
			default => 'bg-low',
		};
	}

	/**
	 * @param array<string, array{level: string, label: string, desc: string}> $levels
	 */
	private function campaign_run_risk_matrix_html( array $levels ): string {
		$rows = [
			[ 'Vulnerability (Kerentanan)', $levels['vulnerability'] ],
			[ 'Compliance (Pelaporan)', $levels['compliance'] ],
			[ 'Coverage (Cakupan Uji)', $levels['coverage'] ],
		];

		$html = '';
		foreach ( $rows as [ $area, $level ] ) {
			$html .= sprintf(
				'<tr><td><b>%s</b></td><td><span class="badge %s">%s</span></td><td>%s</td></tr>',
				esc_html( $area ),
				$this->risk_badge_class( $level['level'] ),
				esc_html( $level['label'] ),
				esc_html( $level['desc'] )
			);
		}

		return $html;
	}

	/**
	 * @param array<string, mixed>                                          $run
	 * @param array<string, mixed>                                          $playbook
	 * @param array<string, array{level: string, label: string, note: string}> $levels
	 * @return array{0: string, 1: string}
	 */
	private function campaign_run_executive_summary( array $run, array $playbook, array $levels ): array {
		$name     = (string) ( $run['name'] ?? '-' );
		$scenario = (string) ( $playbook['scenario'] ?? 'phishing umum' );

		$p1 = sprintf(
			'Telah dilakukan evaluasi terhadap kampanye simulasi phishing <b>"%s"</b>. Pengujian ini bertujuan untuk menguji kesadaran keamanan karyawan terhadap serangan berbasis rekayasa sosial (<i>social engineering</i>) menggunakan skenario %s.',
			esc_html( $name ),
			esc_html( $scenario )
		);

		$vulnerability = $levels['vulnerability'];
		$gap_notes     = [];
		foreach ( [ 'compliance', 'coverage' ] as $key ) {
			if ( 'low' !== $levels[ $key ]['level'] ) {
				$gap_notes[] = $levels[ $key ]['note'];
			}
		}

		$p2 = sprintf(
			'Secara umum, tingkat risiko teknis tergolong <b>%s (%s)</b> karena %s.',
			esc_html( ucfirst( strtolower( $vulnerability['label'] ) ) ),
			esc_html( $vulnerability['label'] ),
			esc_html( $vulnerability['note'] )
		);

		$p2 .= empty( $gap_notes )
			? ' Tidak ditemukan celah signifikan lain pada aspek pelaporan maupun cakupan pengujian.'
			: ( ' Namun, ' . esc_html( implode( '; serta ', $gap_notes ) ) . '.' );

		return [ $p1, $p2 ];
	}

	/**
	 * @param array<string, mixed>             $stats
	 * @param array<int, array<string, mixed>> $target_details
	 * @return array<int, array{title: string, body: string}>
	 */
	private function campaign_run_findings( array $stats, array $target_details ): array {
		$findings = [];

		$personal_domains = [ 'gmail.com', 'yahoo.com', 'yahoo.co.id', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'aol.com' ];
		$personal_emails   = [];
		foreach ( $target_details as $target ) {
			$email  = strtolower( (string) ( $target['email'] ?? '' ) );
			$domain = substr( (string) strrchr( $email, '@' ), 1 );
			if ( $domain && in_array( $domain, $personal_domains, true ) ) {
				$personal_emails[] = $email;
			}
		}
		if ( ! empty( $personal_emails ) ) {
			$findings[] = [
				'title' => 'Penggunaan Domain Email Non-Korporat',
				'body'  => sprintf(
					'%d target menggunakan akun email personal (%s). Perlu konfirmasi apakah pengujian sesuai skenario yang dimaksud (mis. remote worker / BYOD).',
					count( $personal_emails ),
					esc_html( implode( ', ', array_slice( $personal_emails, 0, 5 ) ) . ( count( $personal_emails ) > 5 ? ', dst.' : '' ) )
				),
			];
		}

		$submitted = (int) ( $stats['submitted_data'] ?? 0 );
		if ( $submitted > 0 ) {
			$findings[] = [
				'title' => 'Insiden Pengiriman Data',
				'body'  => sprintf(
					'%d target (%s%%) mengirimkan data pada halaman simulasi — perlu tindak lanjut kesadaran/coaching individual.',
					$submitted,
					esc_html( (string) ( $stats['submit_rate'] ?? 0 ) )
				),
			];
		}

		$report_rate = (float) ( $stats['report_rate'] ?? 0 );
		if ( $report_rate < 10 ) {
			$clicked = (int) ( $stats['clicked'] ?? 0 );
			$findings[] = [
				'title' => 'Ketiadaan Respons Pelaporan (Zero/Low Reporting)',
				'body'  => $clicked > 0
					? 'Sebagian target berinteraksi dengan email simulasi namun tidak ada/hampir tidak ada yang melaporkannya ke tim keamanan (SOC).'
					: 'Target tidak membuka/mengklik tautan, tetapi juga tidak menginstruksikan pelaporan ancaman ke tim keamanan (SOC).',
			];
		}

		return $findings;
	}

	/**
	 * @param array<string, array{level: string}> $levels
	 * @param array<int, array{title: string}>    $findings
	 * @return array<int, array{title: string, body: string}>
	 */
	private function campaign_run_recommendations( array $levels, array $findings, bool $has_data ): array {
		if ( ! $has_data ) {
			return [
				[
					'title' => 'Sinkronkan Hasil Kampanye',
					'body'  => 'Sinkronkan hasil kampanye dari GoPhish sebelum laporan ini digunakan sebagai dasar audit atau pengambilan keputusan.',
				],
			];
		}

		$recommendations = [];

		if ( 'low' !== $levels['coverage']['level'] ) {
			$recommendations[] = [
				'title' => 'Perluasan Skala Simulasi',
				'body'  => 'Mengulang uji coba dengan melibatkan sampel target yang lebih luas antar departemen.',
			];
		}

		$has_personal_domain_finding = (bool) array_filter(
			$findings,
			static fn( array $finding ): bool => 'Penggunaan Domain Email Non-Korporat' === $finding['title']
		);
		if ( $has_personal_domain_finding ) {
			$recommendations[] = [
				'title' => 'Validasi Basis Data Target',
				'body'  => 'Menyelaraskan daftar sasaran simulasi menggunakan domain resmi perusahaan.',
			];
		}

		if ( 'low' !== $levels['compliance']['level'] ) {
			$recommendations[] = [
				'title' => 'Sosialisasi Fitur Report Phishing',
				'body'  => 'Mendorong budaya kerja aktif untuk melaporkan email mencurigakan ke tim keamanan.',
			];
		}

		if ( 'low' !== $levels['vulnerability']['level'] ) {
			$recommendations[] = [
				'title' => 'Tindak Lanjut Individual & Coaching',
				'body'  => 'Memberikan edukasi/coaching tertarget kepada target yang mengklik tautan atau mengirimkan data pada simulasi.',
			];
		}

		if ( empty( $recommendations ) ) {
			$recommendations[] = [
				'title' => 'Pertahankan Program Kesadaran Keamanan',
				'body'  => 'Hasil pengujian tergolong baik — pertahankan kualitas program kesadaran keamanan saat ini dan lakukan pengujian berkala.',
			];
		}

		return $recommendations;
	}

	/**
	 * Formats a MySQL datetime as Indonesian-style "d Mon Y[, H:i]" without
	 * depending on the site's WordPress locale (the renderer should
	 * not silently fall back to English month names on an en_US site).
	 */
	private function format_datetime_id( ?string $mysql_datetime, bool $with_time = true ): string {
		if ( empty( $mysql_datetime ) ) {
			return '-';
		}

		$timestamp = strtotime( $mysql_datetime );
		if ( false === $timestamp ) {
			return '-';
		}

		static $months = [ 1 => 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des' ];

		$formatted = sprintf(
			'%d %s %d',
			(int) gmdate( 'j', $timestamp ),
			$months[ (int) gmdate( 'n', $timestamp ) ],
			(int) gmdate( 'Y', $timestamp )
		);

		return $with_time ? $formatted . ', ' . gmdate( 'H:i', $timestamp ) : $formatted;
	}
}
