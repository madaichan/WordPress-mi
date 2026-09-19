<?php
/**
 * Monitoring "Download data" export — CSV/XLSX writer.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use DateTimeImmutable;
use DateTimeZone;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Throwable;
use WP_Error;

/**
 * Turns the same report data already used by the Monitoring page's on-screen
 * tables — CampaignRunService::report()'s target_details, and
 * CampaignGroupService::report()/report_active()'s campaign_runs — into
 * downloadable CSV/XLSX files. No new database query: this is purely a view
 * over data the report endpoints already compute. See
 * docs/PRD_MONITORING_DATA_EXPORT.md.
 */
class CampaignDataExportService {

	public const FORMAT_CSV  = 'csv';
	public const FORMAT_XLSX = 'xlsx';

	private const ALLOWED_FORMATS = [ self::FORMAT_CSV, self::FORMAT_XLSX ];

	/**
	 * Validate the `format` query param — whitelist shared by both
	 * CampaignRunController and CampaignGroupController so it's only
	 * implemented once (PRD §8).
	 *
	 * @return string|WP_Error
	 */
	public function resolve_format( string $raw ) {
		$format = strtolower( trim( $raw ) );
		if ( '' === $format ) {
			return self::FORMAT_CSV;
		}

		if ( ! in_array( $format, self::ALLOWED_FORMATS, true ) ) {
			return new WP_Error(
				'invalid_format',
				__( 'format must be one of: csv, xlsx.', 'pukat' ),
				[ 'status' => 400 ]
			);
		}

		return $format;
	}

	public function content_type_for( string $format ): string {
		return self::FORMAT_XLSX === $format
			? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			: 'text/csv; charset=utf-8';
	}

	/**
	 * "Target details" rows — one row per recipient, mirrors
	 * TARGET_DETAILS_SCHEMA in Performing.jsx exactly (FR-3). Source:
	 * CampaignRunService::report()['metrics']['target_details'].
	 *
	 * @param array<int, array<string, mixed>> $target_details
	 * @return array{headers: array<int, string>, rows: array<int, array<int, string>>}
	 */
	public function target_details_table( array $target_details ): array {
		$headers = [ 'Name', 'Email', 'Department', 'Status', 'Opened At', 'Clicked At', 'Submitted At', 'Reported At' ];

		$rows = array_map( function ( array $target ): array {
			return [
				$this->sanitize_cell( $target['name'] ?? '' ),
				$this->sanitize_cell( $target['email'] ?? '' ),
				$this->sanitize_cell( $target['department'] ?? '' ),
				$this->sanitize_cell( $target['status'] ?? '' ),
				$this->format_datetime( $target['opened_at'] ?? null ),
				$this->format_datetime( $target['clicked_at'] ?? null ),
				$this->format_datetime( $target['submitted_at'] ?? null ),
				$this->format_datetime( $target['reported_at'] ?? null ),
			];
		}, array_values( $target_details ) );

		return [ 'headers' => $headers, 'rows' => $rows ];
	}

	/**
	 * "Campaign funnel" summary rows plus a trailing Total row (FR-6/FR-7),
	 * mirrors CampaignSummaryRow in Performing.jsx. Source:
	 * CampaignGroupService::report()/report_active(). Group name resolution
	 * follows the exact same pattern as
	 * CampaignReportPdfService::campaign_group_report_data() — a
	 * campaign_group_id => name map built by the controller
	 * (CampaignGroupController::groups_by_id()), since campaign_runs rows
	 * don't otherwise carry a group name.
	 *
	 * @param array<string, mixed> $report      report()/report_active() result.
	 * @param array<int, string>   $groups_by_id campaign_group_id => name map.
	 * @param int|null             $group_id     The group being viewed, or null for "all active groups".
	 * @param string|null          $group_name   Display name for $group_id, when known.
	 * @return array{headers: array<int, string>, rows: array<int, array<int, string>>}
	 */
	public function campaign_summary_table( array $report, array $groups_by_id, ?int $group_id, ?string $group_name ): array {
		$headers = [
			'Campaign Name', 'Status', 'Playbook', 'Group', 'Launched/Scheduled At',
			'Targets', 'Sent', 'Opened', 'Clicked', 'Click Rate (%)', 'Submitted', 'Submit Rate (%)', 'Last Synced At',
		];

		$runs = is_array( $report['campaign_runs'] ?? null ) ? $report['campaign_runs'] : [];

		$rows = array_map( function ( array $run ) use ( $groups_by_id, $group_id, $group_name ): array {
			$stats        = is_array( $run['stats'] ?? null ) ? $run['stats'] : [];
			$run_group_id = (int) ( $run['campaign_group_id'] ?? 0 );
			$group_label  = $this->resolve_group_label( $groups_by_id, $group_id, $group_name, $run_group_id );

			return [
				$this->sanitize_cell( $run['name'] ?? '' ),
				$this->sanitize_cell( $run['status'] ?? '' ),
				$this->sanitize_cell( $run['playbook_name'] ?? '—' ),
				$this->sanitize_cell( $group_label ),
				$this->format_datetime( $run['launched_at'] ?? $run['schedule_at'] ?? null ),
				(string) ( $run['target_count'] ?? 0 ),
				(string) ( $stats['email_sent'] ?? 0 ),
				(string) ( $stats['email_opened'] ?? 0 ),
				(string) ( $stats['clicked'] ?? 0 ),
				(string) ( $stats['click_rate'] ?? 0 ),
				(string) ( $stats['submitted_data'] ?? 0 ),
				(string) ( $stats['submit_rate'] ?? 0 ),
				$this->format_datetime( $run['synced_at'] ?? null ),
			];
		}, $runs );

		$totals   = is_array( $report['stats'] ?? null ) ? $report['stats'] : [];
		$rows[]   = [
			'Total', '', '', '', '',
			(string) array_sum( array_column( $runs, 'target_count' ) ),
			(string) ( $totals['email_sent'] ?? 0 ),
			(string) ( $totals['email_opened'] ?? 0 ),
			(string) ( $totals['clicked'] ?? 0 ),
			(string) ( $totals['click_rate'] ?? 0 ),
			(string) ( $totals['submitted_data'] ?? 0 ),
			(string) ( $totals['submit_rate'] ?? 0 ),
			'',
		];

		return [ 'headers' => $headers, 'rows' => array_values( $rows ) ];
	}

	/**
	 * "Users who responded" per campaign, tagged with each campaign's group
	 * label — docs/PRD_MONITORING_DATA_EXPORT.md §7.8. "Responded" means at
	 * least one recorded event (opened/clicked/submitted/reported);
	 * CampaignGroupService::aggregate() already applies that filter when
	 * building responder_details, so this only formats/labels rows, same as
	 * campaign_summary_table() above for group-name resolution.
	 *
	 * @param array<string, mixed> $report      report()/report_active() result.
	 * @param array<int, string>   $groups_by_id campaign_group_id => name map.
	 * @param int|null             $group_id     The group being viewed, or null for "all active groups".
	 * @param string|null          $group_name   Display name for $group_id, when known.
	 * @return array{headers: array<int, string>, rows: array<int, array<int, string>>}
	 */
	public function responder_details_table( array $report, array $groups_by_id, ?int $group_id, ?string $group_name ): array {
		$headers = [ 'Group', 'Campaign', 'Name', 'Email', 'Department', 'Status', 'Opened At', 'Clicked At', 'Submitted At', 'Reported At' ];

		$responders = is_array( $report['responder_details'] ?? null ) ? $report['responder_details'] : [];

		$rows = array_map( function ( array $responder ) use ( $groups_by_id, $group_id, $group_name ): array {
			$run_group_id = (int) ( $responder['campaign_group_id'] ?? 0 );
			$group_label  = $this->resolve_group_label( $groups_by_id, $group_id, $group_name, $run_group_id );

			return [
				$this->sanitize_cell( $group_label ),
				$this->sanitize_cell( $responder['campaign_name'] ?? '' ),
				$this->sanitize_cell( $responder['name'] ?? '' ),
				$this->sanitize_cell( $responder['email'] ?? '' ),
				$this->sanitize_cell( $responder['department'] ?? '' ),
				$this->sanitize_cell( $responder['status'] ?? '' ),
				$this->format_datetime( $responder['opened_at'] ?? null ),
				$this->format_datetime( $responder['clicked_at'] ?? null ),
				$this->format_datetime( $responder['submitted_at'] ?? null ),
				$this->format_datetime( $responder['reported_at'] ?? null ),
			];
		}, $responders );

		// Stable order: campaign, then name — easy to scan per campaign.
		usort( $rows, static fn( array $a, array $b ): int => [ $a[1], $a[2] ] <=> [ $b[1], $b[2] ] );

		return [ 'headers' => $headers, 'rows' => array_values( $rows ) ];
	}

	/**
	 * @param array{headers: array<int, string>, rows: array<int, array<int, string>>} $table
	 */
	public function to_csv( array $table ): string {
		$stream = fopen( 'php://temp', 'w+' );

		// Excel on Windows needs a UTF-8 BOM to render non-ASCII names/departments
		// correctly (FR-2) — common for Indonesian data without this.
		fwrite( $stream, "\xEF\xBB\xBF" );
		fputcsv( $stream, $table['headers'] );
		foreach ( $table['rows'] as $row ) {
			fputcsv( $stream, $row );
		}

		rewind( $stream );
		$csv = stream_get_contents( $stream );
		fclose( $stream );

		return false !== $csv ? $csv : '';
	}

	/**
	 * @param array{headers: array<int, string>, rows: array<int, array<int, string>>} $table
	 * @return string|WP_Error
	 */
	public function to_xlsx( array $table ) {
		// Not wp_tempnam() — that helper lives in wp-admin/includes/file.php,
		// which isn't loaded on a normal REST request; plain tempnam() needs
		// no extra WP file and writes to the same system temp dir.
		$temp_file = tempnam( sys_get_temp_dir(), 'pukat-export-' );
		if ( ! $temp_file ) {
			return new WP_Error( 'export_failed', __( 'Failed to create a temporary file for the Excel export.', 'pukat' ), [ 'status' => 500 ] );
		}

		try {
			$writer = new XlsxWriter();
			$writer->openToFile( $temp_file );
			$writer->addRow( Row::fromValues( $table['headers'] ) );
			foreach ( $table['rows'] as $row ) {
				$writer->addRow( Row::fromValues( $row ) );
			}
			$writer->close();

			$binary = file_get_contents( $temp_file );
		} catch ( Throwable $e ) {
			@unlink( $temp_file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- best-effort cleanup of our own temp file.
			return new WP_Error( 'export_failed', __( 'Failed to generate the Excel file.', 'pukat' ), [ 'status' => 500 ] );
		}

		@unlink( $temp_file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- best-effort cleanup of our own temp file.

		return false !== $binary ? $binary : new WP_Error( 'export_failed', __( 'Failed to read the generated Excel file.', 'pukat' ), [ 'status' => 500 ] );
	}

	/**
	 * Same as to_csv() but for several named tables in one file (e.g.
	 * Campaign summary + Responders) — CSV has no concept of sheets, so each
	 * section is a title row + its own header/rows, separated by a blank
	 * line.
	 *
	 * @param array<int, array{title: string, table: array{headers: array<int, string>, rows: array<int, array<int, string>>}}> $sections
	 */
	public function to_csv_sections( array $sections ): string {
		$stream = fopen( 'php://temp', 'w+' );

		fwrite( $stream, "\xEF\xBB\xBF" );
		foreach ( $sections as $index => $section ) {
			if ( $index > 0 ) {
				fwrite( $stream, "\n" );
			}
			fputcsv( $stream, [ $section['title'] ] );
			fputcsv( $stream, $section['table']['headers'] );
			foreach ( $section['table']['rows'] as $row ) {
				fputcsv( $stream, $row );
			}
		}

		rewind( $stream );
		$csv = stream_get_contents( $stream );
		fclose( $stream );

		return false !== $csv ? $csv : '';
	}

	/**
	 * Same as to_xlsx() but for several named tables in one workbook — each
	 * section becomes its own sheet.
	 *
	 * @param array<int, array{title: string, table: array{headers: array<int, string>, rows: array<int, array<int, string>>}}> $sections
	 * @return string|WP_Error
	 */
	public function to_xlsx_sections( array $sections ) {
		$temp_file = tempnam( sys_get_temp_dir(), 'pukat-export-' );
		if ( ! $temp_file ) {
			return new WP_Error( 'export_failed', __( 'Failed to create a temporary file for the Excel export.', 'pukat' ), [ 'status' => 500 ] );
		}

		try {
			$writer = new XlsxWriter();
			$writer->openToFile( $temp_file );

			foreach ( $sections as $index => $section ) {
				if ( $index > 0 ) {
					$writer->addNewSheetAndMakeItCurrent();
				}
				$writer->getCurrentSheet()->setName( $this->sheet_name( $section['title'] ) );
				$writer->addRow( Row::fromValues( $section['table']['headers'] ) );
				foreach ( $section['table']['rows'] as $row ) {
					$writer->addRow( Row::fromValues( $row ) );
				}
			}

			$writer->close();
			$binary = file_get_contents( $temp_file );
		} catch ( Throwable $e ) {
			@unlink( $temp_file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- best-effort cleanup of our own temp file.
			return new WP_Error( 'export_failed', __( 'Failed to generate the Excel file.', 'pukat' ), [ 'status' => 500 ] );
		}

		@unlink( $temp_file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- best-effort cleanup of our own temp file.

		return false !== $binary ? $binary : new WP_Error( 'export_failed', __( 'Failed to read the generated Excel file.', 'pukat' ), [ 'status' => 500 ] );
	}

	/** Excel sheet names: max 31 chars, no : \ / ? * [ ]. */
	private function sheet_name( string $title ): string {
		return substr( str_replace( [ ':', '\\', '/', '?', '*', '[', ']' ], '-', $title ), 0, 31 );
	}

	/**
	 * Shared group-name resolution for campaign_summary_table()/
	 * responder_details_table() — same pattern as
	 * CampaignReportPdfService::campaign_group_report_data(): a single-group
	 * scope always shows that group's own name, while the "all active
	 * groups" scope resolves each row's own group via the authorised
	 * campaign_group_id => name map (CampaignGroupController::groups_by_id()).
	 */
	private function resolve_group_label( array $groups_by_id, ?int $group_id, ?string $group_name, int $run_group_id ): string {
		if ( null !== $group_id ) {
			return $group_name ?? "Group #{$group_id}";
		}

		if ( isset( $groups_by_id[ $run_group_id ] ) ) {
			return $groups_by_id[ $run_group_id ];
		}

		return $run_group_id > 0 ? "Group #{$run_group_id}" : 'Ungrouped';
	}

	/**
	 * UTC (stored) -> site timezone (display), same conversion as
	 * CampaignReportPdfService::report_datetime()/format_report_datetime().
	 * Duplicated here rather than extracted to a shared helper — it's a
	 * two-line conversion and pulling it out would touch the PDF service
	 * file for marginal benefit (see docs/IMPLEMENTATION_PLAN_MONITORING_DATA_EXPORT.md §5).
	 */
	private function format_datetime( ?string $datetime ): string {
		if ( empty( $datetime ) ) {
			return '';
		}

		try {
			$date = ( new DateTimeImmutable( $datetime, new DateTimeZone( 'UTC' ) ) )->setTimezone( wp_timezone() );
		} catch ( \Exception $e ) {
			return '';
		}

		return $date->format( 'j M Y, H:i' );
	}

	/**
	 * Neutralise CSV/Excel formula injection (FR-9). Values sourced from
	 * user input (imported target names/departments, campaign/playbook
	 * names) must never be interpreted as a formula when the file is opened
	 * in Excel/Google Sheets. Applied once here so both writers (to_csv()/
	 * to_xlsx()) inherit the same guarantee instead of sanitising twice.
	 */
	private function sanitize_cell( mixed $value ): string {
		$value = (string) $value;

		if ( '' !== $value && in_array( $value[0], [ '=', '+', '-', '@' ], true ) ) {
			return "'" . $value;
		}

		return $value;
	}
}
