<?php
/**
 * Shared image upload pipeline.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use WP_Error;

/**
 * Validates and stores an uploaded image in the WP Media Library. Used by
 * Flag examples and entity logos so both share one set of checks:
 * content-based type check (PNG/JPEG/WebP only — no SVG, it can carry
 * script), size cap, resolution cap and a single downscale before WordPress
 * generates thumbnails.
 */
class ImageUploadService {

	/** Application cap; the effective limit is also bounded by the server's upload limits. */
	private const MAX_BYTES = 5 * 1024 * 1024;

	/**
	 * Resizing a large image with Imagick costs roughly 9 s per pass for
	 * ~32 MP here, and WordPress would otherwise re-process the full-size
	 * original once per thumbnail size — past PHP's 30 s max_execution_time,
	 * killing the request with no response (observed with a 6267×5105
	 * upload). So: reject above MAX_PIXELS up front (header read only, no
	 * decode), and downscale everything else once before thumbnails.
	 */
	private const MAX_PIXELS = 40000000;

	/** Checked against the file contents (wp_check_filetype_and_ext), not the client's claim. */
	private const ALLOWED_MIMES = [
		'png'      => 'image/png',
		'jpg|jpeg' => 'image/jpeg',
		'webp'     => 'image/webp',
	];

	public static function max_upload_bytes(): int {
		return (int) min( self::MAX_BYTES, wp_max_upload_size() );
	}

	/**
	 * @return array{max_upload_bytes: int, max_megapixels: int, max_dimension: int}
	 */
	public static function limits( int $max_dimension ): array {
		return [
			'max_upload_bytes' => self::max_upload_bytes(),
			'max_megapixels'   => (int) ( self::MAX_PIXELS / 1000000 ),
			'max_dimension'    => $max_dimension,
		];
	}

	/**
	 * Validate, store, downscale to $max_dimension (longest side) and create
	 * the attachment with its thumbnails. Leaves nothing behind on failure.
	 *
	 * @param array<string, mixed>|null $file One entry of $_FILES.
	 * @return int|WP_Error Attachment ID.
	 */
	public function store( ?array $file, int $max_dimension ): int|WP_Error {
		$file_error = $this->validate( $file );
		if ( $file_error ) {
			return $file_error;
		}

		// Not loaded outside wp-admin, including REST requests.
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$uploaded = wp_handle_upload( $file, [ 'test_form' => false, 'mimes' => self::ALLOWED_MIMES ] );
		if ( isset( $uploaded['error'] ) ) {
			return $this->validation_error( (string) $uploaded['error'] );
		}

		$resize_error = $this->downscale_if_needed( (string) $uploaded['file'], $max_dimension );
		if ( $resize_error ) {
			wp_delete_file( $uploaded['file'] );
			return $resize_error;
		}

		$attachment_id = wp_insert_attachment(
			[
				'post_mime_type' => $uploaded['type'],
				'post_title'     => sanitize_file_name( pathinfo( (string) $file['name'], PATHINFO_FILENAME ) ),
				'post_content'   => '',
				'post_status'    => 'inherit',
			],
			$uploaded['file'],
			0,
			true
		);
		if ( is_wp_error( $attachment_id ) ) {
			wp_delete_file( $uploaded['file'] );
			return new WP_Error( 'upload_failed', __( 'Failed to store the uploaded image.', 'pukat' ), [ 'status' => 500 ] );
		}
		wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $uploaded['file'] ) );

		return (int) $attachment_id;
	}

	/**
	 * @param array<string, mixed>|null $file
	 */
	private function validate( ?array $file ): ?WP_Error {
		// Error code first: when PHP rejects an oversized file, tmp_name is
		// empty too, and it must still be reported as "too large".
		$error = (int) ( $file['error'] ?? UPLOAD_ERR_NO_FILE );
		if ( UPLOAD_ERR_INI_SIZE === $error || UPLOAD_ERR_FORM_SIZE === $error ) {
			return $this->too_large_error();
		}
		if ( ! $file || UPLOAD_ERR_NO_FILE === $error || empty( $file['tmp_name'] ) ) {
			return $this->validation_error( __( 'Choose an image to upload.', 'pukat' ) );
		}
		if ( UPLOAD_ERR_OK !== $error ) {
			return $this->validation_error( __( 'The upload did not complete. Please try again.', 'pukat' ) );
		}

		if ( (int) $file['size'] > self::max_upload_bytes() ) {
			return $this->too_large_error();
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		$check = wp_check_filetype_and_ext( (string) $file['tmp_name'], (string) $file['name'], self::ALLOWED_MIMES );
		if ( empty( $check['type'] ) || ! in_array( $check['type'], self::ALLOWED_MIMES, true ) ) {
			return $this->validation_error( __( 'Only PNG, JPEG or WebP images are allowed.', 'pukat' ) );
		}

		// Header-only read — no pixel decoding, so this is cheap even for huge images.
		$size = @getimagesize( (string) $file['tmp_name'] ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( ! $size || empty( $size[0] ) || empty( $size[1] ) ) {
			return $this->validation_error( __( 'The image could not be read. Please upload a valid PNG, JPEG or WebP file.', 'pukat' ) );
		}
		if ( (int) $size[0] * (int) $size[1] > self::MAX_PIXELS ) {
			return $this->validation_error(
				sprintf(
					/* translators: 1: width, 2: height, 3: megapixels, 4: max megapixels */
					__( 'This image is %1$d×%2$d px (%3$s megapixels), which is too large to process. Please resize it to at most %4$d megapixels (for example 6000×6000 px) and upload again.', 'pukat' ),
					(int) $size[0],
					(int) $size[1],
					number_format_i18n( ( (int) $size[0] * (int) $size[1] ) / 1000000, 1 ),
					(int) ( self::MAX_PIXELS / 1000000 )
				)
			);
		}

		return null;
	}

	/**
	 * Resize the stored original in place down to $max_dimension on its
	 * longest side, so thumbnail generation works from a small image.
	 */
	private function downscale_if_needed( string $path, int $max_dimension ): ?WP_Error {
		$size = @getimagesize( $path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		if ( ! $size || max( (int) $size[0], (int) $size[1] ) <= $max_dimension ) {
			return null;
		}

		wp_raise_memory_limit( 'image' );
		if ( function_exists( 'set_time_limit' ) ) {
			set_time_limit( 120 ); // One large resize can take ~10 s; keep headroom above PHP's 30 s default.
		}

		$editor = wp_get_image_editor( $path );
		if ( is_wp_error( $editor ) ) {
			return $this->validation_error( __( 'The image could not be processed. Please try a smaller image.', 'pukat' ) );
		}

		$resized = $editor->resize( $max_dimension, $max_dimension, false );
		$saved   = is_wp_error( $resized ) ? $resized : $editor->save( $path );
		if ( is_wp_error( $saved ) ) {
			return $this->validation_error( __( 'The image could not be resized. Please try a smaller image.', 'pukat' ) );
		}

		return null;
	}

	private function too_large_error(): WP_Error {
		return $this->validation_error(
			sprintf(
				/* translators: %s: maximum upload size, e.g. "2 MB" */
				__( 'The image is too large. Maximum size is %s.', 'pukat' ),
				size_format( self::max_upload_bytes() )
			)
		);
	}

	private function validation_error( string $message ): WP_Error {
		return new WP_Error( 'validation_error', $message, [ 'status' => 422 ] );
	}
}
