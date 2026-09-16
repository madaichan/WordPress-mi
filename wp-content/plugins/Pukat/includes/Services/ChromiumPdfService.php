<?php
/**
 * Sends an internally generated report to the private Chromium renderer.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use WP_Error;

class ChromiumPdfService {

	/** @param array{html: string, header: string, footer: string} $document */
	public function render( array $document ): string|WP_Error {
		$url = defined( 'PUKAT_PDF_RENDERER_URL' )
			? (string) PUKAT_PDF_RENDERER_URL
			: (string) ( getenv( 'PUKAT_PDF_RENDERER_URL' ) ?: 'http://pdf-renderer:3001/render' );
		$token = defined( 'PUKAT_PDF_RENDERER_TOKEN' )
			? (string) PUKAT_PDF_RENDERER_TOKEN
			: (string) ( getenv( 'PUKAT_PDF_RENDERER_TOKEN' ) ?: '' );
		$body = wp_json_encode( $document );
		if ( false === $body || strlen( $body ) > 8 * 1024 * 1024 ) {
			return new WP_Error( 'pdf_report_too_large', __( 'The report is too large to export as PDF.', 'pukat' ), [ 'status' => 413 ] );
		}
		$headers = [ 'Content-Type' => 'application/json', 'Accept' => 'application/pdf' ];
		if ( '' !== $token ) {
			$headers['Authorization'] = 'Bearer ' . $token;
		}
		$response = wp_remote_post( $url, [
			'headers'             => $headers,
			'body'                => $body,
			'timeout'             => 40,
			'redirection'         => 0,
			'limit_response_size' => 16 * 1024 * 1024 + 1,
		] );
		if ( is_wp_error( $response ) ) {
			return $this->unavailable();
		}
		$status = wp_remote_retrieve_response_code( $response );
		if ( 413 === $status ) {
			return new WP_Error( 'pdf_report_too_large', __( 'The report is too large to export as PDF.', 'pukat' ), [ 'status' => 413 ] );
		}
		$pdf = wp_remote_retrieve_body( $response );
		if ( 200 !== $status || ! str_starts_with( $pdf, '%PDF-' )
			|| strlen( $pdf ) > 16 * 1024 * 1024
			|| ! str_contains( substr( $pdf, -1024 ), '%%EOF' ) ) {
			return $this->unavailable();
		}
		return $pdf;
	}

	private function unavailable(): WP_Error {
		return new WP_Error(
			'pdf_renderer_unavailable',
			__( 'PDF export is temporarily unavailable. Check the PDF renderer service and try again.', 'pukat' ),
			[ 'status' => 503 ]
		);
	}
}
