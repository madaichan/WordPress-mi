<?php
/**
 * Flag category business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\FlagRepository;
use WP_Error;

/**
 * Shared Flag categories (Phishing, Scam, External, Spoofing, ...). One
 * taxonomy for every entity, admin-managed (RBAC gates create/edit/delete to
 * admin); the per-entity content lives in FlagExampleService. Categories
 * carry no education text — that lives in each example image.
 * See docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md §5.1/FR-1.
 */
class FlagService {

	/** Badge tones the frontend knows how to render. */
	private const COLORS = [ 'danger', 'warning', 'info', 'violet', 'success', 'gray' ];

	private FlagRepository $repository;

	public function __construct( ?FlagRepository $repository = null ) {
		$this->repository = $repository ?? new FlagRepository();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list(): array {
		return array_map( [ $this, 'prepare' ], $this->repository->all() );
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
		$label = sanitize_text_field( (string) ( $params['label'] ?? '' ) );
		if ( '' === trim( $label ) ) {
			return new WP_Error( 'validation_error', __( 'Flag label is required.', 'pukat' ), [ 'status' => 422 ] );
		}

		$flag_key = sanitize_title( (string) ( $params['flag_key'] ?? $label ) );
		if ( '' === $flag_key ) {
			return new WP_Error( 'validation_error', __( 'Flag key could not be derived from the label.', 'pukat' ), [ 'status' => 422 ] );
		}

		if ( $this->repository->find_by_key( $flag_key ) ) {
			return new WP_Error( 'flag_already_exists', __( 'A Flag category with this key already exists.', 'pukat' ), [ 'status' => 409 ] );
		}

		$id = $this->repository->create( [
			'flag_key'   => $flag_key,
			'label'      => $label,
			'color'      => $this->sanitize_color( $params['color'] ?? 'gray' ),
			'is_active'  => array_key_exists( 'is_active', $params ) ? (int) (bool) $params['is_active'] : 1,
			'created_by' => $user_id,
		] );

		if ( false === $id ) {
			return new WP_Error( 'db_error', __( 'Failed to create Flag category.', 'pukat' ), [ 'status' => 500 ] );
		}

		AuditLogService::log( 'flag.created', [ 'flag_id' => $id, 'flag_key' => $flag_key ], $user_id, 'flag', $id );

		return $this->prepare( (array) $this->repository->find( $id ) );
	}

	/**
	 * flag_key is immutable (it's the stable identifier); label, color and
	 * is_active can change.
	 *
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	public function update( int $id, array $params, int $user_id ): array|WP_Error {
		if ( ! $this->repository->find( $id ) ) {
			return new WP_Error( 'not_found', __( 'Flag category not found.', 'pukat' ), [ 'status' => 404 ] );
		}

		$data = [];
		if ( array_key_exists( 'label', $params ) ) {
			$label = sanitize_text_field( (string) $params['label'] );
			if ( '' === trim( $label ) ) {
				return new WP_Error( 'validation_error', __( 'Flag label is required.', 'pukat' ), [ 'status' => 422 ] );
			}
			$data['label'] = $label;
		}
		if ( array_key_exists( 'color', $params ) ) {
			$data['color'] = $this->sanitize_color( $params['color'] );
		}
		if ( array_key_exists( 'is_active', $params ) ) {
			$data['is_active'] = (int) (bool) $params['is_active'];
		}

		if ( $data && ! $this->repository->update( $id, $data ) ) {
			return new WP_Error( 'db_error', __( 'Failed to update Flag category.', 'pukat' ), [ 'status' => 500 ] );
		}

		AuditLogService::log( 'flag.updated', [ 'flag_id' => $id ], $user_id, 'flag', $id );

		return $this->prepare( (array) $this->repository->find( $id ) );
	}

	/**
	 * Refused while the category still has examples — deleting it would
	 * orphan every entity's uploads in it. Deactivate instead, or remove the
	 * examples first.
	 *
	 * @return true|WP_Error
	 */
	public function delete( int $id, int $user_id ): bool|WP_Error {
		$flag = $this->repository->find( $id );
		if ( ! $flag ) {
			return new WP_Error( 'not_found', __( 'Flag category not found.', 'pukat' ), [ 'status' => 404 ] );
		}

		if ( $this->repository->count_examples( $id ) > 0 ) {
			return new WP_Error(
				'flag_in_use',
				__( 'This Flag category still has examples. Deactivate it instead, or remove its examples first.', 'pukat' ),
				[ 'status' => 409 ]
			);
		}

		$this->repository->delete( $id );
		AuditLogService::log( 'flag.deleted', [ 'flag_id' => $id, 'flag_key' => $flag['flag_key'] ], $user_id, 'flag', $id );

		return true;
	}

	/**
	 * @param array<string, mixed> $row
	 * @return array<string, mixed>
	 */
	private function prepare( array $row ): array {
		return [
			'id'        => (int) $row['id'],
			'flag_key'  => (string) $row['flag_key'],
			'label'     => (string) $row['label'],
			'color'     => (string) ( $row['color'] ?? 'gray' ),
			'is_active' => (bool) (int) $row['is_active'],
		];
	}

	private function sanitize_color( mixed $color ): string {
		$color = (string) $color;

		return in_array( $color, self::COLORS, true ) ? $color : 'gray';
	}
}
