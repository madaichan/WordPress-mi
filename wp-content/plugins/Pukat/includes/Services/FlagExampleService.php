<?php
/**
 * Flag example (per-entity gallery) business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\FlagExampleRepository;
use Pukat\Repositories\FlagRepository;
use WP_Error;

/**
 * Per-entity gallery of annotated example screenshots per Flag category
 * (docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md §6/§9). Entity scoping is
 * delegated to EntityProfileService so the rules stay identical to Entity
 * Profile & Guardrails: non-admins only see and write their own entity's
 * gallery, General is admin-only to write, and the entity of a new upload
 * always comes from the server, never the request.
 */
class FlagExampleService {

	/** Application cap; the effective limit is also bounded by the server's upload limits. */
	private const MAX_BYTES = 5 * 1024 * 1024;

	/** Allowed types, checked against the file contents (wp_check_filetype_and_ext), not the client's claim. */
	private const ALLOWED_MIMES = [
		'png'      => 'image/png',
		'jpg|jpeg' => 'image/jpeg',
		'webp'     => 'image/webp',
	];

	private FlagExampleRepository $repository;
	private FlagRepository $flags;
	private EntityProfileService $access;

	public function __construct( ?FlagExampleRepository $repository = null, ?FlagRepository $flags = null, ?EntityProfileService $access = null ) {
		$this->repository = $repository ?? new FlagExampleRepository();
		$this->flags      = $flags ?? new FlagRepository();
		$this->access     = $access ?? new EntityProfileService();
	}

	public static function max_upload_bytes(): int {
		return (int) min( self::MAX_BYTES, wp_max_upload_size() );
	}

	/**
	 * Non-admins always get their own entity's gallery — an `entity` param
	 * pointing elsewhere is ignored, not rejected (same read-scoping style as
	 * CampaignGroupService::list()). Admins may filter by any entity.
	 *
	 * @param array<string, mixed> $params entity?, flag_id?
	 * @return array<int, array<string, mixed>>
	 */
	public function list( array $params ): array {
		$flag_id = ! empty( $params['flag_id'] ) ? (int) $params['flag_id'] : null;

		if ( $this->access->current_user_can_admin_assets() ) {
			$entity = trim( sanitize_text_field( (string) ( $params['entity'] ?? '' ) ) );
			return array_map( [ $this, 'prepare' ], $this->repository->list( '' === $entity ? null : $entity, $flag_id ) );
		}

		$own = trim( $this->access->current_user_entity() );
		if ( '' === $own ) {
			return [];
		}

		return array_map( [ $this, 'prepare' ], $this->repository->list( $own, $flag_id ) );
	}

	/**
	 * @param array<string, mixed>|null $file   One entry of $_FILES.
	 * @param array<string, mixed>      $params flag_id, caption?, entity? (admin only).
	 * @return array<string, mixed>|WP_Error
	 */
	public function upload( ?array $file, array $params, int $user_id ): array|WP_Error {
		$entity = $this->target_entity( $params );
		if ( '' === $entity ) {
			return new WP_Error( 'entity_forbidden', __( 'Your account must be assigned to an entity before uploading examples.', 'pukat' ), [ 'status' => 403 ] );
		}

		$edit_error = $this->access->enforce_entity_editable( $entity );
		if ( $edit_error ) {
			return $edit_error;
		}

		$flag = $this->flags->find( (int) ( $params['flag_id'] ?? 0 ) );
		if ( ! $flag || ! (int) $flag['is_active'] ) {
			return $this->validation_error( __( 'Choose an active Flag category.', 'pukat' ) );
		}

		$file_error = $this->validate_file( $file );
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

		$caption = trim( sanitize_text_field( (string) ( $params['caption'] ?? '' ) ) );
		$id      = $this->repository->create( [
			'flag_id'       => (int) $flag['id'],
			'entity_name'   => $entity,
			'attachment_id' => (int) $attachment_id,
			'caption'       => '' === $caption ? null : mb_substr( $caption, 0, 255 ),
			'uploaded_by'   => $user_id,
		] );
		if ( false === $id ) {
			wp_delete_attachment( (int) $attachment_id, true );
			return new WP_Error( 'db_error', __( 'Failed to save the example.', 'pukat' ), [ 'status' => 500 ] );
		}

		AuditLogService::log(
			'flag_example.uploaded',
			[ 'flag_example_id' => $id, 'flag_key' => $flag['flag_key'], 'entity_name' => $entity ],
			$user_id,
			'flag_example',
			$id
		);

		$rows = $this->repository->list( $entity, (int) $flag['id'] );
		foreach ( $rows as $row ) {
			if ( (int) $row['id'] === $id ) {
				return $this->prepare( $row );
			}
		}

		return [ 'id' => $id ];
	}

	/**
	 * Removes the row and the physical file (no orphan in the Media Library).
	 *
	 * @return true|WP_Error
	 */
	public function delete( int $id, int $user_id ): bool|WP_Error {
		$row = $this->repository->find( $id );
		if ( ! $row || ! $this->access->current_user_can_view_entity( (string) $row['entity_name'] ) ) {
			return new WP_Error( 'not_found', __( 'Flag example not found.', 'pukat' ), [ 'status' => 404 ] );
		}

		$edit_error = $this->access->enforce_entity_editable( (string) $row['entity_name'] );
		if ( $edit_error ) {
			return $edit_error;
		}

		wp_delete_attachment( (int) $row['attachment_id'], true );
		$this->repository->delete( $id );

		AuditLogService::log(
			'flag_example.deleted',
			[ 'flag_example_id' => $id, 'entity_name' => $row['entity_name'] ],
			$user_id,
			'flag_example',
			$id
		);

		return true;
	}

	/**
	 * Server-side entity for a new upload: always the uploader's own entity
	 * for non-admins; an admin may upload on behalf of an entity via `entity`.
	 *
	 * @param array<string, mixed> $params
	 */
	private function target_entity( array $params ): string {
		if ( $this->access->current_user_can_admin_assets() ) {
			$requested = trim( sanitize_text_field( (string) ( $params['entity'] ?? '' ) ) );
			if ( '' !== $requested ) {
				return $requested;
			}
		}

		return trim( $this->access->current_user_entity() );
	}

	/**
	 * @param array<string, mixed>|null $file
	 */
	private function validate_file( ?array $file ): ?WP_Error {
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

		return null;
	}

	/**
	 * @param array<string, mixed> $row
	 * @return array<string, mixed>
	 */
	private function prepare( array $row ): array {
		$attachment_id = (int) $row['attachment_id'];
		$thumb         = wp_get_attachment_image_src( $attachment_id, 'medium' );

		return [
			'id'            => (int) $row['id'],
			'flag_id'       => (int) $row['flag_id'],
			'flag_key'      => (string) ( $row['flag_key'] ?? '' ),
			'flag_label'    => (string) ( $row['flag_label'] ?? '' ),
			'entity_name'   => (string) $row['entity_name'],
			'caption'       => $row['caption'] ?? null,
			'image_url'     => (string) wp_get_attachment_url( $attachment_id ),
			'thumbnail_url' => $thumb ? (string) $thumb[0] : (string) wp_get_attachment_url( $attachment_id ),
			'uploaded_by'   => (int) $row['uploaded_by'],
			'created_at'    => $row['created_at'] ?? null,
		];
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
