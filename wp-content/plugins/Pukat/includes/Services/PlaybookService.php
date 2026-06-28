<?php
/**
 * Playbook business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\PlaybookRepository;
use WP_Error;

/**
 * Coordinates validation, persistence, and audit logging for playbooks.
 */
class PlaybookService {

	private PlaybookRepository $repository;

	public function __construct( ?PlaybookRepository $repository = null ) {
		$this->repository = $repository ?? new PlaybookRepository();
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	public function list(): array {
		return $this->repository->all();
	}

	/**
	 * @return array<string, mixed>|null
	 */
	public function get( int $id ): ?array {
		return $this->repository->find( $id );
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
		$data = $this->sanitize_data( $params );

		if ( empty( $data['name'] ) ) {
			return new WP_Error(
				'validation_error',
				__( 'Playbook name is required.', 'pukat' ),
				[ 'status' => 422 ]
			);
		}

		$data['created_by'] = $user_id;
		$id                 = $this->repository->create( $data );

		if ( false === $id ) {
			return new WP_Error(
				'db_error',
				__( 'Failed to create playbook.', 'pukat' ),
				[ 'status' => 500 ]
			);
		}

		AuditLogService::log(
			'playbook.created',
			[ 'playbook_id' => $id, 'name' => $data['name'] ],
			null,
			'playbook',
			$id
		);

		return $this->repository->find( $id ) ?: [];
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update( int $id, array $params ): array|WP_Error {
		if ( ! $this->repository->find( $id ) ) {
			return new WP_Error(
				'not_found',
				__( 'Playbook not found.', 'pukat' ),
				[ 'status' => 404 ]
			);
		}

		$this->repository->update( $id, $this->sanitize_data( $params ) );

		AuditLogService::log( 'playbook.updated', [ 'playbook_id' => $id ], null, 'playbook', $id );

		return $this->repository->find( $id ) ?: [];
	}

	public function delete( int $id ): void {
		$this->repository->delete( $id );

		AuditLogService::log( 'playbook.deleted', [ 'playbook_id' => $id ], null, 'playbook', $id );
	}

	/**
	 * @param array<string, mixed> $params Raw request parameters.
	 * @return array<string, mixed>
	 */
	private function sanitize_data( array $params ): array {
		return [
			'name'                => sanitize_text_field( (string) ( $params['name'] ?? '' ) ),
			'description'         => sanitize_textarea_field( (string) ( $params['description'] ?? '' ) ),
			'gophish_template_id' => (int) ( $params['gophish_template_id'] ?? 0 ) ?: null,
			'gophish_page_id'     => (int) ( $params['gophish_page_id'] ?? 0 ) ?: null,
			'gophish_smtp_id'     => (int) ( $params['gophish_smtp_id'] ?? 0 ) ?: null,
			'difficulty'          => min( max( (int) ( $params['difficulty'] ?? 0 ), 1 ), 5 ),
		];
	}
}
