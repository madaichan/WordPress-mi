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

	/** Stored examples are downscaled to this on their longest side (see ImageUploadService). */
	private const MAX_DIMENSION = 2560;

	private FlagExampleRepository $repository;
	private FlagRepository $flags;
	private EntityProfileService $access;
	private ImageUploadService $images;

	public function __construct( ?FlagExampleRepository $repository = null, ?FlagRepository $flags = null, ?EntityProfileService $access = null, ?ImageUploadService $images = null ) {
		$this->repository = $repository ?? new FlagExampleRepository();
		$this->flags      = $flags ?? new FlagRepository();
		$this->access     = $access ?? new EntityProfileService();
		$this->images     = $images ?? new ImageUploadService();
	}

	public static function max_upload_bytes(): int {
		return ImageUploadService::max_upload_bytes();
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

		$attachment_id = $this->images->store( $file, self::MAX_DIMENSION );
		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}

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
	 * A downscaled copy of one example, base64-encoded as a data URI, for
	 * embedding into a Flag education page so the GoPhish landing page is
	 * self-contained (docs/PRD_FLAG_EDUCATION_PAGES.md FR-6b). View-scoped like
	 * the gallery; never encodes the full-resolution original.
	 *
	 * @return array{data_uri: string}|WP_Error
	 */
	public function data_uri( int $id ): array|WP_Error {
		$row = $this->repository->find( $id );
		if ( ! $row || ! $this->access->current_user_can_view_entity( (string) $row['entity_name'] ) ) {
			return new WP_Error( 'not_found', __( 'Flag example not found.', 'pukat' ), [ 'status' => 404 ] );
		}

		$attachment_id = (int) $row['attachment_id'];
		$path          = $this->rendition_path( $attachment_id );
		if ( '' === $path || ! file_exists( $path ) ) {
			return new WP_Error( 'not_found', __( 'The image file is missing.', 'pukat' ), [ 'status' => 404 ] );
		}

		$mime = (string) get_post_mime_type( $attachment_id );
		if ( '' === $mime ) {
			$mime = (string) ( wp_check_filetype( $path )['type'] ?? 'image/png' );
		}

		$data = file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( false === $data ) {
			return new WP_Error( 'read_error', __( 'Failed to read the image file.', 'pukat' ), [ 'status' => 500 ] );
		}

		return [ 'data_uri' => 'data:' . $mime . ';base64,' . base64_encode( $data ) ];
	}

	/**
	 * Path to the downscaled 'large' rendition for embedding; falls back to the
	 * stored file when an image was too small to have one.
	 */
	private function rendition_path( int $attachment_id ): string {
		$sized = image_get_intermediate_size( $attachment_id, 'large' );
		if ( is_array( $sized ) && ! empty( $sized['path'] ) ) {
			$uploads = wp_get_upload_dir();
			return trailingslashit( (string) $uploads['basedir'] ) . (string) $sized['path'];
		}

		return (string) get_attached_file( $attachment_id );
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
	 * @return array{max_upload_bytes: int, max_megapixels: int, max_dimension: int}
	 */
	public static function upload_limits(): array {
		return ImageUploadService::limits( self::MAX_DIMENSION );
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

	private function validation_error( string $message ): WP_Error {
		return new WP_Error( 'validation_error', $message, [ 'status' => 422 ] );
	}
}
