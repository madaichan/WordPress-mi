<?php
/**
 * Renders campaign / campaign group monitoring reports as PDF.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use WP_Error;

/**
 * Turns the same report shape CampaignRunService::report() and
 * CampaignGroupService::report()/report_active() already return
 * ({ stats, campaign_runs, generated_at }) into a PDF (docs/PRD_CAMPAIGN_GROUP_MONITORING.md
 * §7.5 FR-11). Pure rendering — callers own fetching/authorizing the data.
 */
class CampaignReportPdfService {

	// -------------------------------------------------------------------
	// Single Campaign Run report — Chromium with editable HTML/CSS templates.
	// -------------------------------------------------------------------

	/** @param array<string, mixed> $context CampaignRunService::report() breakdown. */
	public function render_campaign_run( array $context ): string|WP_Error {
		return ( new ChromiumPdfService() )->render( $this->campaign_run_document( $context ) );
	}

	/**
	 * @param array<string, mixed> $context
	 * @return array{html: string, header: string, footer: string}
	 */
	public function campaign_run_document( array $context ): array {
		$data = $this->campaign_run_report_data( $context );
		$template_dir = dirname( __DIR__ ) . '/Views/reports/';
		$report_css = (string) file_get_contents( $template_dir . 'campaign-run.css' );
		$document = [];
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

	/**
	 * Build the report's whitelisted view data without fetching or mutating anything.
	 * Counts for clicks/submissions are unions of targets, never sums of events.
	 *
	 * @param array<string, mixed> $context
	 * @return array<string, mixed>
	 */
	public function campaign_run_report_data( array $context ): array {
		$run = is_array( $context['run'] ?? null ) ? $context['run'] : [];
		$stats = is_array( $context['stats'] ?? null ) ? $context['stats'] : [];
		$total = max( 0, (int) ( $stats['total'] ?? 0 ) );
		$synced = ! empty( $context['synced'] );
		$has_data = $synced && $total > 0;
		$snapshot = is_array( $run['snapshot'] ?? null ) ? $run['snapshot'] : [];
		$playbook = is_array( $snapshot['playbook'] ?? null )
			? $snapshot['playbook'] : ( is_array( $run['source_playbook'] ?? null ) ? $run['source_playbook'] : [] );
		$targets = $has_data ? $this->report_targets( (array) ( $context['target_details'] ?? [] ), $snapshot ) : [];
		$complete = $has_data && count( $targets ) === $total;
		$departments = [];
		$target_departments = [];
		$department_metadata_complete = true;
		$positions = [];
		$responses = [];
		$counts = [ 'opened' => 0, 'exposed' => 0, 'reported' => 0, 'reported_exposure' => 0 ];
		foreach ( $targets as $target ) {
			$flags = $this->report_response_flags( $target );
			foreach ( [ 'opened', 'exposed', 'reported' ] as $key ) {
				$counts[ $key ] += (int) $flags[ $key ];
			}
			$counts['reported_exposure'] += (int) ( $flags['reported'] && $flags['exposed'] );
			$name = trim( (string) ( $target['department'] ?? '' ) ) ?: 'Unassigned';
			if ( 0 === strcasecmp( $name, 'Unassigned' ) ) {
				$department_metadata_complete = false;
			} else {
				$target_departments[ mb_strtolower( $name, 'UTF-8' ) ] = true;
			}
			$departments[ $name ] ??= [ 'name' => $name, 'total' => 0, 'opened' => 0, 'exposed' => 0, 'reported' => 0, 'active' => 0 ];
			$departments[ $name ]['total']++;
			foreach ( [ 'opened', 'exposed', 'reported' ] as $key ) {
				$departments[ $name ][ $key ] += (int) $flags[ $key ];
			}
			$active = $flags['exposed'] || $flags['reported'];
			$departments[ $name ]['active'] += (int) $active;
			$position = trim( (string) ( $target['position'] ?? '' ) );
			if ( $active && '' !== $position ) {
				$positions[ $position ] ??= [ 'name' => $position, 'active' => 0, 'exposed' => 0, 'reported' => 0 ];
				$positions[ $position ]['active']++;
				$positions[ $position ]['exposed'] += (int) $flags['exposed'];
				$positions[ $position ]['reported'] += (int) $flags['reported'];
			}
			if ( $flags['opened'] || $active ) {
				$stage = $flags['reported'] ? 'reported' : ( $flags['submitted'] ? 'submitted' : ( $flags['exposed'] ? 'clicked' : 'opened' ) );
				$date = $this->report_datetime( $target[ $stage . '_at' ] ?? null );
				$responses[] = [
					'name' => (string) ( $target['name'] ?? '-' ), 'email' => (string) ( $target['email'] ?? '-' ),
					'department' => $name, 'response' => [ 'reported' => 'Reported', 'submitted' => 'Submitted', 'clicked' => 'Clicked', 'opened' => 'Opened' ][ $stage ],
					'class' => 'reported' === $stage ? 'report' : ( 'opened' === $stage ? 'open' : 'click' ),
					'date' => $date ? $this->format_report_datetime( $target[ $stage . '_at' ], false ) : '—',
					'time' => $date ? $date->format( 'H:i' ) : '—',
				];
			}
		}
		usort( $responses, static fn( array $a, array $b ): int => strcasecmp( $a['name'], $b['name'] ) ?: strcasecmp( $a['email'], $b['email'] ) );
		$department_count = $complete && $department_metadata_complete ? count( $target_departments ) : null;
		$department_coverage = null !== $department_count ? $this->report_count( $department_count, 'department', 'departments' ) : 'departmental records incomplete';
		$departments = $complete ? array_values( $departments ) : [];
		foreach ( $departments as &$department ) {
			$department['rate'] = $department['total'] > 0 ? $department['exposed'] / $department['total'] * 100 : 0;
			$department['risk'] = $department['rate'] >= 40 ? 'high' : ( $department['rate'] >= 15 ? 'medium' : 'low' );
		}
		unset( $department );
		usort( $departments, static fn( array $a, array $b ): int => strcasecmp( $a['name'], $b['name'] ) );
		$exposed = $complete ? $counts['exposed'] : null;
		$opened = max( 0, (int) ( $stats['email_opened'] ?? 0 ) );
		$reported = max( 0, (int) ( $stats['email_reported'] ?? 0 ) );
		$analysis_stats = $stats;
		$analysis_stats['report_rate'] = $total > 0 ? $reported / $total * 100 : 0;
		if ( $complete ) { $analysis_stats['clicked'] = $exposed; }
		$levels = [
			'vulnerability' => $this->campaign_run_vulnerability_level( $analysis_stats ),
			'compliance' => $this->campaign_run_compliance_level( $analysis_stats ),
			'coverage' => $this->campaign_run_coverage_level( $total ),
		];
		$severity = [ 'low' => 0, 'medium' => 1, 'high' => 2 ];
		$overall = $severity[ $levels['vulnerability']['level'] ] >= $severity[ $levels['compliance']['level'] ]
			? $levels['vulnerability']['level'] : $levels['compliance']['level'];
		$detail_note = ! $has_data ? 'Data unavailable. Synchronise campaign results before undertaking an assessment.'
			: sprintf( 'Recipient records are incomplete (%d of %d); distributions and rankings cannot yet be established.', count( $targets ), $total );
		$summary = $has_data ? [
			sprintf(
				'The <strong>%s</strong> phishing simulation campaign was conducted among <strong>%s</strong>%s using the %s scenario to evaluate employees responses to phishing emails.',
				esc_html( (string) ( $run['name'] ?? '-' ) ),
				$this->report_count( $total, 'recipient', 'recipients' ),
				null !== $department_count ? sprintf( ' across <strong>%s</strong>', $department_coverage ) : '',
				esc_html( (string) ( $playbook['scenario'] ?? 'general phishing' ) ?: 'general phishing' )
			) . ( null === $department_count ? ' Departmental coverage cannot yet be established from the available recipient records.' : '' ),
			$complete ? sprintf( '<strong>%s (%s)</strong> clicked a link or submitted data; <strong>%s (%s)</strong> reported the simulation email. These groups may overlap.', $this->report_count( $exposed, 'recipient', 'recipients' ), esc_html( $this->report_rate( $exposed, $total ) ), $this->report_count( $reported, 'recipient', 'recipients' ), esc_html( $this->report_rate( $reported, $total ) ) ) : esc_html( $detail_note ),
			sprintf( 'The results indicate that a baseline level of security awareness is evident across part of the population; however, reporting discipline and resistance to phishing remain inconsistent across several business units and warrant targeted reinforcement.', esc_html( ucfirst( $overall ) ) ),
		] : [
			esc_html( $synced ? 'Results have been synchronised, but no recipients are recorded for assessment.' : 'Campaign results have not been synchronised; metrics and assessments remain unavailable.' ),
			'Verify the recipient list and synchronise results before relying on this report for evaluation.',
		];
		$metrics = [];
		foreach ( [
			[ 'Emails Sent', $has_data ? max( 0, (int) ( $stats['email_sent'] ?? 0 ) ) : null, false, '' ],
			[ 'Emails Opened', $has_data ? $opened : null, true, '' ],
			[ 'Click / Data Interaction', $exposed, true, 'risk' ],
			[ 'Reported', $has_data ? $reported : null, true, 'good' ],
		] as [ $label, $count, $is_rate, $class ] ) {
			$metrics[] = [ 'label' => $label, 'value' => null === $count ? '—' : ( $is_rate ? $this->report_rate( $count, $total ) : (string) $count ),
				'class' => $class, 'note' => null === $count ? 'Data unavailable' : sprintf( '%d of %s', $count, $this->report_count( $total, 'recipient', 'recipients' ) ) ];
		}
		$segments = [];
		$gradient = [];
		$offset = 0.0;
		if ( $complete ) {
			foreach ( [
				[ 'Neither clicked nor reported', $total - $counts['exposed'] - $counts['reported'] + $counts['reported_exposure'], '#aeb7c4' ],
				[ 'Clicked / submitted data', $counts['exposed'] - $counts['reported_exposure'], '#a83434' ],
				[ 'Reported to security', $counts['reported'], '#2f6b4f' ],
			] as [ $label, $count, $color ] ) {
				$pct = $count / $total * 100;
				$gradient[] = sprintf( '%s %.4F%% %.4F%%', $color, $offset, $offset + $pct );
				$offset += $pct;
				$segments[] = [ 'label' => $label, 'count' => $count, 'color' => $color, 'rate' => $this->report_rate( $count, $total ) ];
			}
		}
		$findings = $has_data ? $this->campaign_run_findings( $analysis_stats, $targets ) : [];
		if ( $complete && $exposed > 0 ) {
			array_unshift( $findings, [ 'title' => 'Interaction Indicates Exposure', 'body' => sprintf( '%s (%s) clicked a link or submitted data during the simulation.', $this->report_count( $exposed, 'recipient', 'recipients' ), esc_html( $this->report_rate( $exposed, $total ) ) ), 'level' => $levels['vulnerability']['level'] ] );
		}
		if ( $has_data && $analysis_stats['report_rate'] >= 10 && $analysis_stats['report_rate'] < 50 ) {
			$findings[] = [ 'title' => 'Active Reporting Is Not Yet Widespread', 'body' => sprintf( '%d of %s (%s) reported the simulation email to the security function.', $reported, $this->report_count( $total, 'recipient', 'recipients' ), esc_html( $this->report_rate( $reported, $total ) ) ), 'level' => 'medium' ];
		}
		foreach ( $findings as &$finding ) {
			$finding['level'] ??= 'Data Submission During Simulation' === $finding['title'] || str_contains( $finding['title'], 'Zero/Low' ) ? 'high' : 'medium';
			$finding['label'] = ucfirst( $finding['level'] );
		}
		unset( $finding );
		if ( ! $findings ) { $findings[] = [ 'title' => $has_data ? 'No Additional Findings' : 'Results Unavailable', 'body' => $has_data ? 'Available metrics indicate no link clicks, data submissions or reporting deficiencies.' : esc_html( $detail_note ), 'level' => 'low', 'label' => $has_data ? 'Low' : '—' ]; }
		$recommendations = $this->campaign_run_recommendations( $levels, $findings, $has_data );
		foreach ( $recommendations as &$recommendation ) {
			$recommendation['priority'] ??= 2;
		}
		unset( $recommendation );
		$risk_matrix = $has_data ? [
			[ 'title' => 'User Exposure', 'level' => $levels['vulnerability']['level'], 'label' => $levels['vulnerability']['label'], 'body' => $levels['vulnerability']['desc'] ],
			[ 'title' => 'Reporting Behaviour', 'level' => $levels['compliance']['level'], 'label' => $levels['compliance']['label'], 'body' => sprintf( '%d of %s (%s) reported the email.', $reported, $this->report_count( $total, 'recipient', 'recipients' ), $this->report_rate( $reported, $total ) ) ],
			[ 'title' => 'Campaign Coverage', 'level' => $levels['coverage']['level'], 'label' => $levels['coverage']['label'], 'body' => sprintf( 'Metrics cover %s; %s. Organisational representativeness depends on sample selection.', $this->report_count( $total, 'recipient', 'recipients' ), null !== $department_count ? 'departmental analysis covers ' . $department_coverage : 'departmental records are incomplete' ) ],
		] : [];
		$observations = [];
		$by_exposure = $departments;
		usort( $by_exposure, static fn( array $a, array $b ): int => $b['rate'] <=> $a['rate'] ?: strcasecmp( $a['name'], $b['name'] ) );
		foreach ( array_slice( $by_exposure, 0, 3 ) as $department ) {
			$observations[] = [ 'title' => $department['name'], 'body' => sprintf( '%d of %s clicked or submitted data (%s); %d reported the simulation email.', $department['exposed'], $this->report_count( $department['total'], 'recipient', 'recipients' ), $this->report_rate( $department['exposed'], $department['total'] ), $department['reported'] ), 'class' => $department['exposed'] > 0 ? 'red' : 'green' ];
		}
		if ( ! $observations ) { $observations[] = [ 'title' => 'Departmental Analysis Unavailable', 'body' => $detail_note, 'class' => '' ]; }
		$launch = $run['launched_at'] ?? $run['schedule_at'] ?? null;
		return [
			'campaign_id' => (int) ( $run['id'] ?? 0 ), 'campaign_name' => (string) ( $run['name'] ?? '-' ),
			'report_date' => $this->format_report_datetime( $context['generated_at'] ?? current_time( 'mysql', true ), false ),
			'timezone' => wp_timezone_string(), 'total' => $total, 'has_data' => $has_data,
			'target_department_count' => $department_count,
			'details_complete' => $complete, 'detail_note' => $detail_note, 'exposed' => $exposed,
			'facts' => [
				'Campaign ID' => sprintf( '%s (#%d)', (string) ( $run['name'] ?? '-' ), (int) ( $run['id'] ?? 0 ) ),
				'Attack Vector' => (string) ( $playbook['scenario'] ?? '-' ) ?: '-',
				'Scenario Difficulty' => $playbook ? sprintf( '%d / 5', (int) ( $playbook['difficulty'] ?? 1 ) ) : '-',
				'Platform' => 'Pukat · GoPhish',
				'Launch Date & Time' => $this->format_report_datetime( $launch ) . ( $launch ? ' · ' . wp_timezone_string() : '' ),
				'Campaign Coverage' => $has_data ? sprintf( '%s · %s', $this->report_count( $total, 'recipient', 'recipients' ), $department_coverage ) : 'Data unavailable',
			],
			'summary' => $summary, 'metrics' => $metrics,
			'assessment' => [ 'class' => $has_data ? 'risk-' . $overall : 'unavailable', 'label' => $has_data ? ucfirst( $overall ) : '—',
				'note' => $has_data ? 'Exposure and reporting are assessed against Pukat simulation criteria.' : 'Assessment data is unavailable.' ],
			'notes' => [
				[ 'title' => $has_data ? 'Recipients with no recorded opens: ' . max( 0, $total - $opened ) : 'Email opening data unavailable', 'body' => 'An absent open record does not establish that an email was ignored.' ],
				[ 'title' => null !== $exposed ? 'Recipients with observed exposure: ' . $exposed : 'Exposure cannot yet be determined', 'body' => 'Link clicks and data submissions count distinct recipients.' ],
				[ 'title' => $has_data ? 'Recipients reporting the email: ' . $reported : 'Reporting data unavailable', 'body' => 'Recipients may report an email after interacting with it.' ],
			],
			'segments' => $segments, 'donut_gradient' => 'conic-gradient(' . implode( ', ', $gradient ) . ')',
			'response_summary' => $complete ? sprintf( 'Of %s, %d neither clicked nor reported, %d clicked or submitted data without reporting, and %d reported the simulation email. Rankings count distinct recipients who clicked, submitted data or reported.', $this->report_count( $total, 'recipient', 'recipients' ), $segments[0]['count'], $segments[1]['count'], $segments[2]['count'] ) : $detail_note,
			'department_ranking' => $this->report_ranking( $departments ), 'position_ranking' => $this->report_ranking( $complete ? array_values( $positions ) : [] ),
			'departments' => $departments, 'detail_totals' => $counts, 'observations' => $observations,
			'findings' => $findings, 'recommendations' => $recommendations, 'risk_matrix' => $risk_matrix,
			'response_count' => count( $responses ), 'response_chunks' => array_chunk( $responses, 25 ) ?: [ [] ],
		];
	}

	/** @return array<int, array<string, mixed>> */
	private function report_targets( array $targets, array $snapshot ): array {
		$positions = [];
		foreach ( (array) ( $snapshot['target']['targets'] ?? [] ) as $target ) {
			if ( is_array( $target ) ) { $positions[ strtolower( trim( (string) ( $target['email'] ?? '' ) ) ) ] = (string) ( $target['position'] ?? '' ); }
		}
		$unique = [];
		foreach ( $targets as $target ) {
			if ( ! is_array( $target ) ) { continue; }
			$email = strtolower( trim( (string) ( $target['email'] ?? '' ) ) );
			if ( '' === $email || isset( $unique[ $email ] ) ) { continue; }
			$target['position'] = trim( (string) ( $target['position'] ?? '' ) ) ?: ( $positions[ $email ] ?? '' );
			$unique[ $email ] = $target;
		}
		return array_values( $unique );
	}

	/** @return array{opened: bool, exposed: bool, submitted: bool, reported: bool} */
	private function report_response_flags( array $target ): array {
		$status = (string) ( $target['status'] ?? '' );
		$submitted = ! empty( $target['submitted_at'] ) || 'Submitted Data' === $status;
		return [
			'opened' => ! empty( $target['opened_at'] ) || 'Email Opened' === $status,
			'exposed' => $submitted || ! empty( $target['clicked_at'] ) || 'Clicked Link' === $status,
			'submitted' => $submitted,
			'reported' => ! empty( $target['reported_at'] ) || 'Email Reported' === $status,
		];
	}

	private function report_rate( int $count, int $total ): string {
		return number_format( $total > 0 ? $count / $total * 100 : 0, 1, '.', ',' ) . '%';
	}

	private function report_count( int $count, string $singular, string $plural ): string {
		return $count . ' ' . ( 1 === $count ? $singular : $plural );
	}

	/** @return array<int, array{name: string, count: ?int, detail: string}> */
	private function report_ranking( array $rows ): array {
		$rows = array_values( array_filter( $rows, static fn( array $row ): bool => $row['active'] > 0 ) );
		usort( $rows, static fn( array $a, array $b ): int => $b['active'] <=> $a['active'] ?: strcasecmp( $a['name'], $b['name'] ) );
		$ranking = [];
		foreach ( array_slice( $rows, 0, 3 ) as $row ) {
			$ranking[] = [ 'name' => $row['name'], 'count' => $row['active'], 'detail' => sprintf( 'Clicks/data: %d · Reports: %d', $row['exposed'], $row['reported'] ) ];
		}
		if ( ! $ranking ) { $ranking[] = [ 'name' => 'Unavailable', 'count' => null, 'detail' => 'No response activity data is available' ]; }
		return $ranking;
	}

	private function report_datetime( ?string $datetime ): ?\DateTimeImmutable {
		if ( empty( $datetime ) ) { return null; }
		// Stored timestamps (synced_at, generated_at, etc.) are now written in
		// true UTC via current_time( 'mysql', true ) — parse as UTC, then
		// convert to the site's configured timezone for display.
		try { return ( new \DateTimeImmutable( $datetime, new \DateTimeZone( 'UTC' ) ) )->setTimezone( wp_timezone() ); }
		catch ( \Exception ) { return null; }
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
				'note'  => 'data submissions were recorded on the simulation page, indicating potential exposure of credentials or information',
				'desc'  => 'Recipients submitted data on the simulated phishing page, indicating heightened potential for credential or information compromise.',
			];
		}

		if ( $clicked > 0 ) {
			return [
				'level' => 'medium',
				'label' => 'MEDIUM',
				'note'  => 'recipients clicked simulation links, although no subsequent data submissions were recorded',
				'desc'  => 'Recipients clicked simulation links; no subsequent data submissions were recorded on the simulation page.',
			];
		}

		return [
			'level' => 'low',
			'label' => 'LOW',
			'note'  => 'no link clicks or data submissions were recorded',
			'desc'  => 'No link clicks or data submissions were recorded during the simulation.',
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
				'note'  => 'at least half of recipients reported the email, indicating an established reporting practice',
				'desc'  => 'At least half of recipients reported the suspicious email to the security team, indicating an established reporting practice.',
			];
		}

		if ( $report_rate >= 10 ) {
			return [
				'level' => 'medium',
				'label' => 'MEDIUM',
				'note'  => 'reporting remains limited to a minority of recipients',
				'desc'  => 'A minority of recipients reported the suspicious email to the security operations centre (SOC).',
			];
		}

		return [
			'level' => 'high',
			'label' => 'HIGH',
			'note'  => 'minimal reporting indicates a gap in active threat escalation',
			'desc'  => 'Minimal reporting indicates a gap in active escalation of suspected threats to the security operations centre (SOC).',
		];
	}

	/**
	 * Coverage uses the existing sample-size thresholds. Organisational
	 * representativeness additionally depends on how the sample was selected.
	 *
	 * @return array{level: string, label: string, note: string}
	 */
	private function campaign_run_coverage_level( int $total ): array {
		if ( $total >= 30 ) {
			return [
				'level' => 'low',
				'label' => 'LOW',
				'note'  => 'the sample meets the campaign coverage threshold',
				'desc'  => 'The sample meets the campaign coverage threshold; organisational representativeness still depends on sample selection.',
			];
		}

		if ( $total >= 10 ) {
			return [
				'level' => 'medium',
				'label' => 'MEDIUM',
				'note'  => 'the sample offers preliminary indications but should be expanded',
				'desc'  => 'The sample offers preliminary indications; broader coverage would strengthen the assessment.',
			];
		}

		return [
			'level' => 'high',
			'label' => 'HIGH GAP',
			'note'  => 'the limited sample restricts conclusions about the wider organisation',
			'desc'  => sprintf( 'The limited sample (%s) restricts conclusions about the wider organisational risk posture.', $this->report_count( $total, 'recipient', 'recipients' ) ),
		];
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
				'title' => 'Use of Personal Email Domains',
				'body'  => sprintf(
					'Personal email usage is recorded for %s (%s). Confirm that their inclusion aligns with the intended test scenario, such as remote work or personal device use.',
					$this->report_count( count( $personal_emails ), 'recipient', 'recipients' ),
					esc_html( implode( ', ', array_slice( $personal_emails, 0, 5 ) ) . ( count( $personal_emails ) > 5 ? ', and others' : '' ) )
				),
			];
		}

		$submitted = (int) ( $stats['submitted_data'] ?? 0 );
		if ( $submitted > 0 ) {
			$findings[] = [
				'title' => 'Data Submission During Simulation',
				'body'  => sprintf(
					'%s (%s) submitted data on the simulation page, warranting individual follow-up and targeted awareness coaching.',
					$this->report_count( $submitted, 'recipient', 'recipients' ),
					esc_html( $this->report_rate( $submitted, (int) ( $stats['total'] ?? 0 ) ) )
				),
			];
		}

		$report_rate = (float) ( $stats['report_rate'] ?? 0 );
		if ( $report_rate < 10 ) {
			$clicked = (int) ( $stats['clicked'] ?? 0 );
			$findings[] = [
				'title' => 'Absent or Limited Reporting (Zero/Low Reporting)',
				'body'  => $clicked > 0
					? 'Recipients interacted with the simulation email, yet few or none escalated it to the security operations centre (SOC).'
					: 'No link clicks were recorded, while reporting to the security function remained limited.',
			];
		}

		return $findings;
	}

	/**
	 * @param array<string, array{level: string}> $levels
	 * @param array<int, array{title: string}>    $findings
	 * @return array<int, array{title: string, body: string, priority?: int}>
	 */
	private function campaign_run_recommendations( array $levels, array $findings, bool $has_data ): array {
		if ( ! $has_data ) {
			return [
				[
					'title' => 'Synchronise Campaign Results',
					'body'  => 'Synchronise campaign results from GoPhish before using this report to support an audit or management decision.',
					'priority' => 1,
				],
			];
		}

		$recommendations = [];

		if ( 'low' !== $levels['coverage']['level'] ) {
			$recommendations[] = [
				'title' => 'Expand Simulation Coverage',
				'body'  => 'Repeat the exercise with a broader sample across departments to strengthen the evidence available for assessment.',
			];
		}

		$has_personal_domain_finding = (bool) array_filter(
			$findings,
			static fn( array $finding ): bool => 'Use of Personal Email Domains' === $finding['title']
		);
		if ( $has_personal_domain_finding ) {
			$recommendations[] = [
				'title' => 'Validate the Recipient Register',
				'body'  => 'Reconcile the simulation recipient list with authorised corporate email domains and the agreed test scope.',
			];
		}

		if ( 'low' !== $levels['compliance']['level'] ) {
			$recommendations[] = [
				'title' => 'Embed Phishing Reporting as a Routine Security Behaviour',
				'body'  => 'Reinforce the designated Report Phishing channel through practical guidance, and review the timeliness and consistency of reporting in subsequent campaigns.',
				'priority' => 1,
			];
		}

		if ( 'low' !== $levels['vulnerability']['level'] ) {
			$recommendations[] = [
				'title' => 'Targeted Awareness & Individual Coaching',
				'body'  => 'Provide individual coaching for recipients who clicked simulation links or submitted data, addressing the specific behaviours observed.',
				'priority' => 1,
			];
		}

		$recommendations[] = [
			'title' => 'Establish Recurring Simulation and Trend Monitoring',
			'body'  => 'Compare click rates, reporting rates and departmental response patterns across successive exercises, accounting for scenario difficulty, audience composition and observation windows.',
			'priority' => 2,
		];

		return $recommendations;
	}

	/** Format database/ISO dates in English using the site's timezone. */
	private function format_report_datetime( ?string $datetime, bool $with_time = true ): string {
		$date = $this->report_datetime( $datetime );
		if ( ! $date ) { return '-'; }
		$formatted = $date->format( 'j M Y' );
		return $with_time ? $formatted . ', ' . $date->format( 'H:i' ) : $formatted;
	}

	// -------------------------------------------------------------------
	// Campaign Group / multi-campaign report — Chromium with editable
	// HTML/CSS templates, adapted from docs/prototypes/exportpdf-multi-campaign-draft.html
	// (see docs/prototypes/exportpdf-multi-campaign-draft.md for the field mapping).
	// -------------------------------------------------------------------

	/**
	 * @param array<string, mixed> $context See campaign_group_report_data().
	 */
	public function render_campaign_group( array $context ): string|WP_Error {
		return ( new ChromiumPdfService() )->render( $this->campaign_group_document( $context ) );
	}

	/**
	 * @param array<string, mixed> $context
	 * @return array{html: string, header: string, footer: string}
	 */
	public function campaign_group_document( array $context ): array {
		$data = $this->campaign_group_report_data( $context );
		$template_dir = dirname( __DIR__ ) . '/Views/reports/';
		$report_css = (string) file_get_contents( $template_dir . 'campaign-run.css' )
			. (string) file_get_contents( $template_dir . 'campaign-group.css' );
		$document = [];
		foreach ( [ 'html' => 'campaign-group.php', 'header' => 'campaign-group-header.php', 'footer' => 'campaign-group-footer.php' ] as $key => $file ) {
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

	/**
	 * Build the multi-campaign report's whitelisted view data. Pure
	 * transformation of the already-aggregated report shape
	 * CampaignGroupService::report()/report_active() returns — no fetching,
	 * no live GoPhish calls, no unions across campaigns (a recipient record
	 * is counted once per campaign it belongs to, never deduplicated).
	 *
	 * @param array{
	 *   report: array<string, mixed>,
	 *   campaign_group_id: ?int,
	 *   group_name: ?string,
	 *   groups_by_id: array<int, string>,
	 * } $context
	 * @return array<string, mixed>
	 */
	public function campaign_group_report_data( array $context ): array {
		$report      = is_array( $context['report'] ?? null ) ? $context['report'] : [];
		$group_id    = $context['campaign_group_id'] ?? null;
		$groups_by_id = is_array( $context['groups_by_id'] ?? null ) ? $context['groups_by_id'] : [];
		$stats       = is_array( $report['stats'] ?? null ) ? $report['stats'] : [];
		$runs        = is_array( $report['campaign_runs'] ?? null ) ? $report['campaign_runs'] : [];
		$total       = max( 0, (int) ( $stats['total'] ?? 0 ) );
		$has_data    = $total > 0;

		$recorded = array_values( array_filter( $runs, static fn( array $run ): bool => ! empty( $run['synced_at'] ) ) );
		$pending  = array_values( array_filter( $runs, static fn( array $run ): bool => empty( $run['synced_at'] ) ) );
		$planned  = array_sum( array_column( $runs, 'target_count' ) );
		$group_ids   = array_unique( array_map( static fn( array $run ): int => (int) ( $run['campaign_group_id'] ?? 0 ), $runs ) );
		$group_count = max( 1, count( array_filter( $group_ids ) ) );

		$selection_label = null !== $group_id
			? ( (string) ( $context['group_name'] ?? "Group #{$group_id}" ) )
			: 'All active campaign groups';

		$generated_at = (string) ( $report['generated_at'] ?? current_time( 'mysql', true ) );
		$report_reference = sprintf( 'MON-%s-%s', $this->report_datetime( $generated_at )?->format( 'Y' ) ?? gmdate( 'Y' ), null !== $group_id ? "G{$group_id}" : 'ACTIVE' );

		$run_rows = array_map( function ( array $run ) use ( $group_id, $groups_by_id, $selection_label ): array {
			$run_stats = is_array( $run['stats'] ?? null ) ? $run['stats'] : [];
			$run_total = max( 0, (int) ( $run_stats['total'] ?? 0 ) );
			$has_stats = ! empty( $run['synced_at'] ) && [] !== $run_stats;
			$stages = [];
			foreach ( [ 'email_opened', 'clicked', 'submitted_data', 'email_reported' ] as $key ) {
				$count = (int) ( $run_stats[ $key ] ?? 0 );
				$stages[ $key ] = [ 'count' => $count, 'rate' => $this->report_rate( $count, $run_total ) ];
			}
			$run_group_id = (int) ( $run['campaign_group_id'] ?? 0 );
			return [
				'campaign_run_id' => (int) ( $run['campaign_run_id'] ?? 0 ),
				'name'            => (string) ( $run['name'] ?? '' ),
				'group_name'      => null !== $group_id ? $selection_label : ( $groups_by_id[ $run_group_id ] ?? "Group #{$run_group_id}" ),
				'status'          => (string) ( $run['status'] ?? '' ),
				'total'           => $run_total,
				'has_stats'       => $has_stats,
				'stages'          => $stages,
			];
		}, $runs );

		$recorded_stages = [];
		foreach ( [ 'email_sent', 'email_opened', 'clicked', 'submitted_data', 'email_reported' ] as $key ) {
			$count = (int) ( $stats[ $key ] ?? 0 );
			$recorded_stages[ $key ] = [ 'count' => $count, 'rate' => $this->report_rate( $count, $total ) ];
		}

		$snapshot_rows = array_map( function ( array $run ): array {
			$launch = $run['launched_at'] ?? $run['schedule_at'] ?? null;
			return [
				'name'          => (string) ( $run['name'] ?? '' ),
				'playbook_name' => (string) ( $run['playbook_name'] ?? '—' ),
				'target_count'  => (int) ( $run['target_count'] ?? 0 ),
				'launch_label'  => $this->format_report_datetime( $launch ),
				'launch_type'   => ! empty( $run['launched_at'] ) ? 'Launched' : 'Scheduled',
				'synced_label'  => ! empty( $run['synced_at'] ) ? $this->format_report_datetime( $run['synced_at'] ) : 'Not yet synchronised',
			];
		}, $runs );

		$coverage_note = sprintf(
			'<strong>%d of %d %s synchronised results.</strong> ',
			count( $recorded ), count( $runs ), 1 === count( $runs ) ? 'campaign has' : 'campaigns have'
		) . ( $pending
			? sprintf(
				'%s, %s, accounts for %s planned recipient records. Its unavailable results are excluded from the recorded denominator, rather than presented as zero-response outcomes.',
				1 === count( $pending ) ? 'The scheduled campaign' : 'Scheduled campaigns, starting with',
				esc_html( (string) ( $pending[0]['name'] ?? '' ) ),
				$this->report_count( (int) ( $pending[0]['target_count'] ?? 0 ), 'record', 'records' )
			)
			: 'All campaigns in this selection contribute to the recorded denominator.' )
			. sprintf( ' Planned scope totals %s.', $this->report_count( (int) $planned, 'recipient record', 'recipient records' ) );

		$scope_rule = null === $group_id
			? 'This selection includes all member campaigns of active campaign groups, including completed campaigns within those groups. Ungrouped campaigns and groups whose members have all reached a terminal status are outside this scope.'
			: 'This selection includes all campaigns belonging to the named group, regardless of individual campaign status.';

		// Department breakdown — opens/reports are not returned by the
		// aggregate report (see the mapping notes), so only total/clicked/
		// submitted/click-rate are shown, same fields CampaignGroupService::aggregate() computes.
		$department_rows = array_map( function ( array $row ): array {
			$risk_class = 'Med' === ( $row['risk_level'] ?? '' ) ? 'medium' : strtolower( (string) ( $row['risk_level'] ?? 'low' ) );
			return [
				'name'       => (string) ( $row['department'] ?? 'Unassigned' ),
				'total'      => (int) ( $row['total'] ?? 0 ),
				'clicked'    => (int) ( $row['clicked'] ?? 0 ),
				'submitted'  => (int) ( $row['submitted'] ?? 0 ),
				'rate'       => $this->report_rate( (int) ( $row['clicked'] ?? 0 ), (int) ( $row['total'] ?? 0 ) ),
				'risk_class' => $risk_class,
				'risk_label' => strtoupper( $risk_class ),
			];
		}, is_array( $report['department_breakdown'] ?? null ) ? $report['department_breakdown'] : [] );

		$department_focus = null;
		if ( $department_rows ) {
			$by_focus = $department_rows;
			usort( $by_focus, static fn( array $a, array $b ): int => $b['submitted'] <=> $a['submitted'] ?: $b['clicked'] <=> $a['clicked'] );
			$top = $by_focus[0];
			$department_focus = sprintf(
				'%s accounts for %s and %s. Its click rate is %s. Follow-up should address the observed scenario and audience.',
				esc_html( $top['name'] ), $this->report_count( $top['submitted'], 'data submission', 'data submissions' ),
				$this->report_count( $top['clicked'], 'click', 'clicks' ), esc_html( $top['rate'] )
			);
		}

		$hourly = array_values( array_pad( is_array( $report['hourly_activity'] ?? null ) ? array_map( 'intval', $report['hourly_activity'] ) : [], 24, 0 ) );
		$hourly_peak = max( array_merge( $hourly, [ 1 ] ) );
		$hourly_peak_hour = array_search( $hourly_peak, $hourly, true );
		$hourly_peak_hour = false === $hourly_peak_hour ? 0 : $hourly_peak_hour;
		$hourly_total_events = array_sum( $hourly );

		$events = array_map( function ( array $event ): array {
			return [
				'name'          => (string) ( $event['name'] ?? '-' ),
				'department'    => (string) ( $event['department'] ?? 'Unassigned' ),
				'message'       => (string) ( $event['message'] ?? '' ),
				'message_class' => 'Email Reported' === ( $event['message'] ?? '' ) ? 'event-reported' : 'event-risk',
				'time_label'    => $this->format_report_datetime( $event['time'] ?? null ),
			];
		}, is_array( $report['recent_events'] ?? null ) ? $report['recent_events'] : [] );

		// Overall risk reuses the same exposure/reporting thresholds as the
		// single Campaign Run report (campaign_run_vulnerability_level() /
		// campaign_run_compliance_level()) — $stats already carries submitted_data,
		// clicked and report_rate from CampaignGroupService::aggregate().
		$vulnerability = $this->campaign_run_vulnerability_level( $stats );
		$compliance    = $this->campaign_run_compliance_level( $stats );
		$severity      = [ 'low' => 0, 'medium' => 1, 'high' => 2 ];
		$overall       = $severity[ $vulnerability['level'] ] >= $severity[ $compliance['level'] ] ? $vulnerability['level'] : $compliance['level'];

		$risk_matrix = [
			[ 'area' => 'User Exposure', 'level' => $vulnerability['level'], 'label' => $vulnerability['label'], 'body' => sprintf( '%s data submissions and %s link clicks are recorded across the synchronised selection.', $this->report_count( (int) ( $stats['submitted_data'] ?? 0 ), 'submission', 'submissions' ), $this->report_count( (int) ( $stats['clicked'] ?? 0 ), 'click', 'clicks' ) ) ],
			[ 'area' => 'Reporting Behaviour', 'level' => $compliance['level'], 'label' => $compliance['label'], 'body' => sprintf( '%s represent %s of recorded recipients. Active reporting remains a minority response where below half.', $this->report_count( (int) ( $stats['email_reported'] ?? 0 ), 'report', 'reports' ), $this->report_rate( (int) ( $stats['email_reported'] ?? 0 ), $total ) ) ],
			[ 'area' => 'Snapshot Completeness', 'level' => $pending ? 'medium' : 'low', 'label' => $pending ? 'PENDING' : 'COMPLETE', 'body' => sprintf( '%d of %d campaigns have synchronised results. %s', count( $recorded ), count( $runs ), $pending ? 'Scheduled campaigns remain outside the recorded metric denominator.' : 'No unsynchronised campaigns remain in the selected scope.' ) ],
		];

		$findings = [];
		$submitted = (int) ( $stats['submitted_data'] ?? 0 );
		$submission_runs = array_values( array_filter( $recorded, static fn( array $run ): bool => ( $run['stats']['submitted_data'] ?? 0 ) > 0 ) );
		$findings[] = $submitted > 0
			? [ 'title' => 'Data Submission Warrants Individual Follow-up', 'body' => sprintf( '%s are recorded across %s. Review the affected recipient records and the scenarios that prompted disclosure.', $this->report_count( $submitted, 'submission', 'submissions' ), $this->report_count( count( $submission_runs ), 'synchronised campaign', 'synchronised campaigns' ) ), 'level' => 'high' ]
			: [ 'title' => 'No Data Submissions Recorded', 'body' => 'No data submissions are recorded across the synchronised selection.', 'level' => 'low' ];

		if ( count( $recorded ) >= 2 ) {
			$by_click = $recorded;
			usort( $by_click, static fn( array $a, array $b ): float => ( ( $b['stats']['clicked'] ?? 0 ) / max( 1, $b['stats']['total'] ?? 1 ) ) <=> ( ( $a['stats']['clicked'] ?? 0 ) / max( 1, $a['stats']['total'] ?? 1 ) ) );
			$by_report = $recorded;
			usort( $by_report, static fn( array $a, array $b ): float => ( ( $b['stats']['email_reported'] ?? 0 ) / max( 1, $b['stats']['total'] ?? 1 ) ) <=> ( ( $a['stats']['email_reported'] ?? 0 ) / max( 1, $a['stats']['total'] ?? 1 ) ) );
			$click_focus  = $by_click[0];
			$report_focus = $by_report[0];
			$findings[] = [
				'title' => 'Response Patterns Differ Across Campaigns',
				'body'  => sprintf(
					'%s records the highest click rate (%s). %s records the highest reporting rate (%s). Differences warrant contextual review before trend conclusions are drawn.',
					esc_html( (string) $click_focus['name'] ), $this->report_rate( (int) ( $click_focus['stats']['clicked'] ?? 0 ), (int) ( $click_focus['stats']['total'] ?? 0 ) ),
					esc_html( (string) $report_focus['name'] ), $this->report_rate( (int) ( $report_focus['stats']['email_reported'] ?? 0 ), (int) ( $report_focus['stats']['total'] ?? 0 ) )
				),
				'level' => 'medium',
			];
		} else {
			$findings[] = [ 'title' => 'Insufficient Synchronised Campaigns for Comparison', 'body' => 'Fewer than two synchronised campaigns are available in this selection; cross-campaign comparisons cannot yet be drawn.', 'level' => 'low' ];
		}

		$findings[] = $pending
			? [ 'title' => 'An Incomplete Snapshot Qualifies the Conclusion', 'body' => sprintf( '%s has no recorded results. Retain %s in the scope register and revisit the assessment after synchronisation.', 1 === count( $pending ) ? 'One scheduled campaign' : count( $pending ) . ' scheduled campaigns', 1 === count( $pending ) ? 'it' : 'them' ), 'level' => 'medium' ]
			: [ 'title' => 'The Recorded Selection Is Fully Synchronised', 'body' => 'All selected campaigns have recorded results. Preserve the snapshot reference when circulating the report for review.', 'level' => 'low' ];

		foreach ( $findings as &$finding ) {
			$finding['label'] = ucfirst( $finding['level'] );
		}
		unset( $finding );

		$actions = [
			[ 'title' => 'Targeted Follow-up & Coaching', 'body' => 'Review campaign recipient records with data submissions or link clicks, then provide individual guidance on the specific cues missed during the simulation.', 'owner' => 'Security Awareness Team / Department Leads', 'due' => 'Within 10 working days of campaign closure', 'priority' => 1 ],
			[ 'title' => 'Reinforce Active Phishing Reporting', 'body' => 'Provide practical guidance on the Report Phishing feature and the escalation process, using examples from the selected scenarios to reinforce timely reporting.', 'owner' => 'Security Operations / Awareness Team', 'due' => 'Before the next simulation wave', 'priority' => 1 ],
			$pending
				? [ 'title' => 'Complete the Campaign Result Snapshot', 'body' => 'Synchronise scheduled campaigns once results become available and refresh the consolidated assessment before final management sign-off.', 'owner' => 'Campaign Owner / Report Preparer', 'due' => 'Before final report approval', 'priority' => 1 ]
				: [ 'title' => 'Preserve the Reviewed Result Snapshot', 'body' => 'Preserve the synchronised report reference and confirm that management reviews the same recorded selection.', 'owner' => 'Campaign Owner / Report Preparer', 'due' => 'At final report approval', 'priority' => 2 ],
			[ 'title' => 'Establish Comparable Follow-up Exercises', 'body' => 'Plan subsequent exercises with documented scenario difficulty, audience composition and observation windows so that future comparisons support a more defensible assessment.', 'owner' => 'Security Awareness Analyst', 'due' => 'At planning for the next simulation cycle', 'priority' => 2 ],
		];

		$prepared_at = $this->report_datetime( $generated_at );

		return [
			'campaign_group_id' => $group_id,
			'report_reference'  => $report_reference,
			'selection_label'   => $selection_label,
			'prepared_at'       => $prepared_at ? $prepared_at->format( 'j M Y, H:i' ) . ' · ' . wp_timezone_string() : '-',
			'prepared_at_short' => $prepared_at ? $prepared_at->format( 'j M Y' ) : '-',
			'timezone'          => wp_timezone_string(),
			'total'             => $total,
			'has_data'          => $has_data,
			'runs'              => $run_rows,
			'recorded_count'    => count( $recorded ),
			'run_count'         => count( $runs ),
			'recorded_totals'   => [ 'total' => $total, 'stages' => $recorded_stages ],
			'planned'           => (int) $planned,
			'group_count'       => $group_count,
			'facts'             => [
				[ 'Report Reference', $report_reference ],
				[ 'Selection', $selection_label ],
				[ 'Source', 'Pukat · Monitoring' ],
				[ 'Prepared At', $prepared_at ? $prepared_at->format( 'j M Y, H:i' ) . ' · ' . wp_timezone_string() : '-' ],
				[ 'Campaigns / Groups', sprintf( '%d campaign%s · %d group%s', count( $runs ), 1 === count( $runs ) ? '' : 's', $group_count, 1 === $group_count ? '' : 's' ) ],
				[ 'Result Coverage', sprintf( '%d of %d campaign%s synchronised', count( $recorded ), count( $runs ), 1 === count( $runs ) ? '' : 's' ) ],
			],
			'summary'           => [
				sprintf(
					'The selected portfolio comprises %s across %s. Synchronised results account for %s; these are campaign-level records rather than a deduplicated count of people.',
					$this->report_count( count( $runs ), 'campaign', 'campaigns' ), $this->report_count( $group_count, 'campaign group', 'campaign groups' ),
					$this->report_count( $total, 'recipient record', 'recipient records' )
				),
				sprintf(
					'Recorded responses include %s (%s), %s (%s) and %s (%s). The exposure and reporting measures may overlap.',
					$this->report_count( (int) ( $stats['clicked'] ?? 0 ), 'click', 'clicks' ), $this->report_rate( (int) ( $stats['clicked'] ?? 0 ), $total ),
					$this->report_count( (int) ( $stats['submitted_data'] ?? 0 ), 'data submission', 'data submissions' ), $this->report_rate( (int) ( $stats['submitted_data'] ?? 0 ), $total ),
					$this->report_count( (int) ( $stats['email_reported'] ?? 0 ), 'report', 'reports' ), $this->report_rate( (int) ( $stats['email_reported'] ?? 0 ), $total )
				),
				sprintf(
					'Overall risk is assessed as %s. %s Individual follow-up and reinforcement of active reporting should guide remediation.',
					esc_html( ucfirst( $overall ) ),
					$pending ? sprintf( 'The conclusion remains provisional pending results for %s.', $this->report_count( count( $pending ), 'scheduled campaign', 'scheduled campaigns' ) ) : 'The assessment reflects the complete recorded selection.'
				),
			],
			'assessment'        => [
				'class'       => $has_data ? 'risk-' . $overall : 'unavailable',
				'label'       => $has_data ? ucfirst( $overall ) : '—',
				'provisional' => $pending ? sprintf( 'Provisional · %d/%d campaigns synchronised', count( $recorded ), count( $runs ) ) : 'Recorded selection fully synchronised',
				'note'        => 'Exposure and reporting inform the rating. Campaign coverage is assessed independently.',
			],
			'metrics'           => array_map(
				static fn( array $row ): array => [ 'label' => $row[0], 'value' => $row[3] ? $recorded_stages[ $row[1] ]['count'] : $total, 'rate' => $row[3] ? $recorded_stages[ $row[1] ]['rate'] : null, 'class' => $row[2], 'note' => $row[3] ? $recorded_stages[ $row[1] ]['rate'] . ' of recorded recipients' : sprintf( 'Across %d synchronised campaign%s', count( $recorded ), 1 === count( $recorded ) ? '' : 's' ) ],
				[
					[ 'Recipient Records', 'total', '', false ],
					[ 'Emails Sent', 'email_sent', '', true ],
					[ 'Emails Opened', 'email_opened', '', true ],
					[ 'Link Clicks', 'clicked', 'risk', true ],
					[ 'Data Submitted', 'submitted_data', 'risk', true ],
					[ 'Email Reported', 'email_reported', 'good', true ],
				]
			),
			'signals'           => [
				[ 'label' => 'Link click rate', 'pct' => $this->report_rate( (int) ( $stats['clicked'] ?? 0 ), $total ), 'class' => '', 'note' => 'Observed interaction requiring contextual review.' ],
				[ 'label' => 'Reporting rate', 'pct' => $this->report_rate( (int) ( $stats['email_reported'] ?? 0 ), $total ), 'class' => 'good', 'note' => 'Active escalation to the security function.' ],
			],
			'snapshot_rows'     => $snapshot_rows,
			'coverage_note'     => $coverage_note,
			'scope_rule'        => $scope_rule,
			'department_rows'   => $department_rows,
			'department_totals' => [ 'total' => $total, 'clicked' => (int) ( $stats['clicked'] ?? 0 ), 'submitted' => (int) ( $stats['submitted_data'] ?? 0 ), 'rate' => $this->report_rate( (int) ( $stats['clicked'] ?? 0 ), $total ) ],
			'department_focus'  => $department_focus,
			'hourly'            => $hourly,
			'hourly_peak'       => $hourly_peak,
			'hourly_peak_hour'  => $hourly_peak_hour,
			'hourly_total_events' => $hourly_total_events,
			'risk_matrix'       => $risk_matrix,
			'overall'           => $overall,
			'findings'          => $findings,
			'actions'           => $actions,
			'events'            => $events,
			'recent_events_limit' => 30, // Mirrors CampaignGroupService::RECENT_EVENTS_LIMIT.
		];
	}
}
