<?php
/**
 * Quiz question bank business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\QuizQuestionRepository;
use WP_Error;

/**
 * The per-entity question bank behind the Quiz Module
 * (docs/PRD_QUIZ_MODULE.md §5.1).
 *
 * The bank is the machine-readable half of a deliberately free-form feature:
 * the quiz page itself is raw HTML the operator may paste from anywhere, and
 * `input_name` is the only thing tying a question — and therefore its answer
 * key — to an input in that HTML. Entity scoping is delegated to
 * EntityProfileService, identical to FlagPageService.
 */
class QuizQuestionService {

	/** Inputs are graded only under this prefix, so names must carry it. */
	private const INPUT_NAME_PATTERN = '/^answer_[a-z0-9_]{1,50}$/';

	/** The UNIQUE index is on VARCHAR(191); reject longer names up front. */
	private const MAX_ENTITY_LEN = 191;

	private const MAX_OPTIONS = 10;

	/** Per-image cap for an image question (decoded bytes) — PRD §13.10. */
	private const MAX_IMAGE_BYTES = 1024 * 1024;

	private QuizQuestionRepository $repository;
	private EntityProfileService $access;

	public function __construct( ?QuizQuestionRepository $repository = null, ?EntityProfileService $access = null ) {
		$this->repository = $repository ?? new QuizQuestionRepository();
		$this->access     = $access ?? new EntityProfileService();
	}

	/**
	 * The entity's questions. Non-admins naming another entity get their own
	 * (no 403), matching FlagPageService::get().
	 *
	 * @param array<string, mixed> $params entity? (admin only), active_only?
	 * @return array<string, mixed>|WP_Error
	 */
	public function list( array $params ): array|WP_Error {
		$entity = $this->target_entity( $params );
		if ( '' === $entity ) {
			return $this->no_entity_error();
		}

		if ( ! $this->access->current_user_can_view_entity( $entity ) ) {
			$entity = trim( $this->access->current_user_entity() );
			if ( '' === $entity ) {
				return $this->no_entity_error();
			}
		}

		$only_active = ! empty( $params['active_only'] );
		$rows        = $this->repository->list_for_entity( $entity, $only_active );

		return [
			'entity_name' => $entity,
			'questions'   => array_map( [ $this, 'prepare' ], $rows ),
		];
	}

	/**
	 * @param array<string, mixed> $params question, input_name, options, explanation?, difficulty?, tags?, is_active?, entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
		$entity = $this->writable_entity( $params );
		if ( is_wp_error( $entity ) ) {
			return $entity;
		}

		$data = $this->sanitize( $params, $entity, null );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		$data['created_by'] = $user_id;

		$id = $this->repository->create( $data );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to save the question.', 'pukat' ) );
		}

		AuditLogService::log( 'quiz_question.created', [ 'quiz_question_id' => $id, 'entity_name' => $entity, 'input_name' => $data['input_name'] ], $user_id, 'quiz_question', $id );

		return $this->prepare( (array) $this->repository->find( $id ) );
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	public function update( int $id, array $params, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Question not found.', 'pukat' ) );
		}

		// The question's own entity decides who may write, not the request.
		$entity     = (string) $existing['entity_name'];
		$edit_error = $this->access->enforce_entity_editable( $entity );
		if ( $edit_error ) {
			return $edit_error;
		}

		$data = $this->sanitize( $params, $entity, $existing );
		if ( is_wp_error( $data ) ) {
			return $data;
		}

		unset( $data['entity_name'] );
		$this->repository->update( $id, $data );

		AuditLogService::log( 'quiz_question.updated', [ 'quiz_question_id' => $id, 'entity_name' => $entity, 'input_name' => $data['input_name'] ], $user_id, 'quiz_question', $id );

		return $this->prepare( (array) $this->repository->find( $id ) );
	}

	/**
	 * @return array<string, mixed>|WP_Error
	 */
	public function delete( int $id, int $user_id ): array|WP_Error {
		$existing = $this->repository->find( $id );
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Question not found.', 'pukat' ) );
		}

		$edit_error = $this->access->enforce_entity_editable( (string) $existing['entity_name'] );
		if ( $edit_error ) {
			return $edit_error;
		}

		$this->repository->delete( $id );

		AuditLogService::log(
			'quiz_question.deleted',
			[ 'quiz_question_id' => $id, 'entity_name' => (string) $existing['entity_name'], 'input_name' => (string) $existing['input_name'] ],
			$user_id,
			'quiz_question',
			$id
		);

		return [ 'deleted' => true, 'id' => $id ];
	}

	/**
	 * The entity's answer key: input name => correct values + question id,
	 * built from ACTIVE questions only. This is both what the linter checks
	 * the page against and what gets snapshotted at publish
	 * (docs/PRD_QUIZ_MODULE.md §5.3). Read-only and ungated — callers
	 * (QuizPageService, QuizScoringService) have already resolved access.
	 *
	 * @return array<string, array{question_id: int, correct: array<int, string>}>
	 */
	public function answer_key_for_entity( string $entity ): array {
		$key = [];

		foreach ( $this->repository->list_for_entity( $entity, true ) as $row ) {
			$input_name = (string) $row['input_name'];
			if ( '' === $input_name ) {
				continue;
			}

			$correct = [];
			foreach ( $this->decode_options( (string) $row['options'] ) as $option ) {
				if ( ! empty( $option['correct'] ) ) {
					$correct[] = (string) $option['value'];
				}
			}

			$key[ $input_name ] = [
				'question_id' => (int) $row['id'],
				'correct'     => $correct,
			];
		}

		return $key;
	}

	/**
	 * The entity's questions for a quiz's chosen ids, in that order. Only the
	 * entity's own questions come back (Quiz Builder v2). Read-only, ungated.
	 *
	 * @param array<int, int> $ids
	 * @return array<int, array<string, mixed>>
	 */
	public function selected_questions( array $ids, string $entity ): array {
		return $this->repository->find_selected_for_entity( $ids, $entity );
	}

	/**
	 * Answer key built from an explicit set of question rows (a quiz's selected
	 * questions, Quiz Builder v2) rather than the whole active bank. Same shape
	 * as answer_key_for_entity(): input name => {question_id, correct[]}.
	 *
	 * @param array<int, array<string, mixed>> $rows
	 * @return array<string, array{question_id: int, correct: array<int, string>}>
	 */
	public function answer_key_from_rows( array $rows ): array {
		$key = [];
		foreach ( $rows as $row ) {
			$input_name = (string) ( $row['input_name'] ?? '' );
			if ( '' === $input_name ) {
				continue;
			}
			$correct = [];
			foreach ( $this->decode_options( (string) ( $row['options'] ?? '' ) ) as $option ) {
				if ( ! empty( $option['correct'] ) ) {
					$correct[] = (string) $option['value'];
				}
			}
			$key[ $input_name ] = [
				'question_id' => (int) ( $row['id'] ?? 0 ),
				'correct'     => $correct,
			];
		}

		return $key;
	}

	/**
	 * Validate and normalize an incoming question.
	 *
	 * @param array<string, mixed>      $params
	 * @param array<string, mixed>|null $existing Row being updated, if any.
	 * @return array<string, mixed>|WP_Error
	 */
	private function sanitize( array $params, string $entity, ?array $existing ): array|WP_Error {
		$question = sanitize_textarea_field( (string) ( $params['question'] ?? ( $existing['question'] ?? '' ) ) );
		if ( '' === trim( $question ) ) {
			return $this->validation_error( __( 'The question text is required.', 'pukat' ) );
		}

		$input_name = strtolower( trim( (string) ( $params['input_name'] ?? ( $existing['input_name'] ?? '' ) ) ) );
		if ( ! preg_match( self::INPUT_NAME_PATTERN, $input_name ) ) {
			return $this->validation_error( __( 'The input name must look like "answer_q1" — lowercase letters, numbers and underscores after the answer_ prefix.', 'pukat' ) );
		}

		// Reject the collision before the UNIQUE index does, so the operator
		// gets told which question already owns the name.
		$clash = $this->repository->find_by_input_name( $entity, $input_name );
		if ( $clash && ( ! $existing || (int) $clash['id'] !== (int) $existing['id'] ) ) {
			return $this->validation_error(
				sprintf(
					/* translators: %s: input name, e.g. answer_q1. */
					__( 'Another question in this entity already uses the input name "%s".', 'pukat' ),
					$input_name
				)
			);
		}

		$options = $this->sanitize_options( $params['options'] ?? ( $existing ? $this->decode_options( (string) $existing['options'] ) : [] ) );
		if ( is_wp_error( $options ) ) {
			return $options;
		}

		$difficulty = array_key_exists( 'difficulty', $params )
			? min( max( (int) $params['difficulty'], 1 ), 5 )
			: (int) ( $existing['difficulty'] ?? 1 );

		$tags = mb_substr( sanitize_text_field( (string) ( $params['tags'] ?? ( $existing['tags'] ?? '' ) ) ), 0, 500 );

		$is_active = array_key_exists( 'is_active', $params )
			? (int) ( ! empty( $params['is_active'] ) )
			: (int) ( $existing['is_active'] ?? 1 );

		// Image questions (PRD §13.10): type + an inline data-URI image. A text
		// question clears any image; an image question must carry one.
		$type = (string) ( $params['question_type'] ?? ( $existing['question_type'] ?? 'text' ) );
		if ( 'image' !== $type ) {
			$type = 'text';
		}
		$image_data = null;
		if ( 'image' === $type ) {
			$image = (string) ( $params['image_data'] ?? ( $existing['image_data'] ?? '' ) );
			$valid = $this->validate_image( $image );
			if ( is_wp_error( $valid ) ) {
				return $valid;
			}
			$image_data = $image;
		}

		return [
			'entity_name'   => $entity,
			'question'      => $question,
			'question_type' => $type,
			'image_data'    => $image_data,
			'input_name'    => $input_name,
			'options'       => (string) wp_json_encode( $options ),
			'explanation'   => sanitize_textarea_field( (string) ( $params['explanation'] ?? ( $existing['explanation'] ?? '' ) ) ),
			'difficulty'    => $difficulty,
			'tags'          => $tags,
			'is_active'     => $is_active,
		];
	}

	/**
	 * A base64 image data URI, within the supported types and size cap.
	 *
	 * @return true|WP_Error
	 */
	private function validate_image( string $image ) {
		if ( '' === $image ) {
			return $this->validation_error( __( 'An image is required for an image question.', 'pukat' ) );
		}
		if ( ! preg_match( '#^data:image/(png|jpe?g|gif|webp);base64,#i', $image ) ) {
			return $this->validation_error( __( 'Unsupported image. Use a PNG, JPG, GIF or WebP file.', 'pukat' ) );
		}
		$comma   = strpos( $image, ',' );
		$decoded = false === $comma ? false : base64_decode( substr( $image, $comma + 1 ), true );
		if ( false === $decoded ) {
			return $this->validation_error( __( 'The image could not be read. Please re-upload it.', 'pukat' ) );
		}
		if ( strlen( $decoded ) > self::MAX_IMAGE_BYTES ) {
			return $this->validation_error( __( 'The image is too large (max 1 MB). Please compress it and try again.', 'pukat' ) );
		}
		return true;
	}

	/**
	 * A single question including its image_data (the edit form / single-
	 * question endpoint). Read-only; entity scoping is enforced by the caller
	 * matching the question's entity, mirroring the other read paths.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function get_one( array $params ): array|WP_Error {
		$id  = (int) ( $params['id'] ?? 0 );
		$row = $id > 0 ? $this->repository->find( $id ) : null;
		if ( ! $row ) {
			return new WP_Error( 'not_found', __( 'Question not found.', 'pukat' ), [ 'status' => 404 ] );
		}
		if ( ! $this->access->current_user_can_view_entity( (string) $row['entity_name'] ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Insufficient permissions.', 'pukat' ), [ 'status' => 403 ] );
		}

		return $row;
	}

	/**
	 * @param mixed $raw
	 * @return array<int, array{label: string, value: string, correct: bool}>|WP_Error
	 */
	private function sanitize_options( mixed $raw ): array|WP_Error {
		if ( ! is_array( $raw ) ) {
			return $this->validation_error( __( 'The answer options are required.', 'pukat' ) );
		}

		$options = [];
		$values  = [];

		foreach ( $raw as $option ) {
			if ( ! is_array( $option ) ) {
				continue;
			}

			$label = sanitize_text_field( (string) ( $option['label'] ?? '' ) );
			$value = sanitize_text_field( (string) ( $option['value'] ?? '' ) );
			if ( '' === trim( $value ) ) {
				return $this->validation_error( __( 'Every answer option needs a value.', 'pukat' ) );
			}
			if ( in_array( $value, $values, true ) ) {
				return $this->validation_error(
					sprintf(
						/* translators: %s: duplicated option value. */
						__( 'The option value "%s" is used twice in one question.', 'pukat' ),
						$value
					)
				);
			}

			$values[]  = $value;
			$options[] = [
				'label'   => '' === $label ? $value : $label,
				'value'   => $value,
				'correct' => ! empty( $option['correct'] ),
			];
		}

		if ( count( $options ) < 2 ) {
			return $this->validation_error( __( 'A question needs at least two answer options.', 'pukat' ) );
		}
		if ( count( $options ) > self::MAX_OPTIONS ) {
			return $this->validation_error( __( 'A question can have at most ten answer options.', 'pukat' ) );
		}

		$correct = array_filter( $options, static fn ( array $o ): bool => $o['correct'] );
		if ( empty( $correct ) ) {
			return $this->validation_error( __( 'Mark at least one answer option as correct.', 'pukat' ) );
		}

		return $options;
	}

	/**
	 * @return array<int, array<string, mixed>>
	 */
	private function decode_options( string $raw ): array {
		$decoded = json_decode( $raw, true );

		return is_array( $decoded ) ? $decoded : [];
	}

	/**
	 * Entity resolved from the server and editable by the current user.
	 *
	 * @param array<string, mixed> $params
	 * @return string|WP_Error
	 */
	private function writable_entity( array $params ): string|WP_Error {
		$entity = $this->target_entity( $params );
		if ( '' === $entity ) {
			return $this->no_entity_error();
		}
		if ( mb_strlen( $entity ) > self::MAX_ENTITY_LEN ) {
			return $this->validation_error( __( 'The entity name is too long.', 'pukat' ) );
		}

		$edit_error = $this->access->enforce_entity_editable( $entity );
		if ( $edit_error ) {
			return $edit_error;
		}

		return $entity;
	}

	/**
	 * Server-side entity: always the user's own for non-admins; an admin may
	 * target an entity via `entity`. Identical to FlagPageService.
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
	 * @param array<string, mixed> $row
	 * @return array<string, mixed>
	 */
	private function prepare( array $row ): array {
		$options = $this->decode_options( (string) ( $row['options'] ?? '' ) );

		// has_image comes from list_for_entity's derived column; for a single
		// row loaded with image_data, fall back to whether that is set. The raw
		// bytes are never put in this shaped payload (PRD §13.10).
		$has_image = array_key_exists( 'has_image', $row )
			? ! empty( $row['has_image'] )
			: ! empty( $row['image_data'] );

		return [
			'id'            => (int) $row['id'],
			'entity_name'   => (string) $row['entity_name'],
			'question'      => (string) $row['question'],
			'question_type' => (string) ( $row['question_type'] ?? 'text' ),
			'has_image'     => $has_image,
			'input_name'    => (string) $row['input_name'],
			'options'       => $options,
			'correct_count' => count( array_filter( $options, static fn ( $o ): bool => ! empty( $o['correct'] ) ) ),
			'explanation'   => (string) ( $row['explanation'] ?? '' ),
			'difficulty'    => (int) ( $row['difficulty'] ?? 1 ),
			'tags'          => (string) ( $row['tags'] ?? '' ),
			'is_active'     => ! empty( $row['is_active'] ),
			'created_at'    => $row['created_at'] ?? null,
		];
	}

	private function no_entity_error(): WP_Error {
		return new WP_Error( 'entity_forbidden', __( 'Your account must be assigned to an entity first.', 'pukat' ), [ 'status' => 403 ] );
	}

	private function validation_error( string $message ): WP_Error {
		return new WP_Error( 'validation_error', $message, [ 'status' => 422 ] );
	}

	private function not_found_error( string $message ): WP_Error {
		return new WP_Error( 'not_found', $message, [ 'status' => 404 ] );
	}

	private function db_error( string $message ): WP_Error {
		return new WP_Error( 'db_error', $message, [ 'status' => 500 ] );
	}
}
