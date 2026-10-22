<?php
/**
 * Quiz template catalogue business logic (admin-only).
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\QuizPageRepository;
use Pukat\Repositories\QuizTemplateRepository;
use WP_Error;

/**
 * The admin-authored quiz template catalogue (docs/PRD_QUIZ_MODULE.md §13).
 *
 * A template is a styled HTML shell with two kinds of marker:
 *
 *   {{pukat:questions}}   the single repeating slot where the operator's
 *                         selected questions are rendered, in order.
 *   {{pukat:<key>}}       a placeholder the operator fills in the builder;
 *                         every such key must be declared in `placeholders`,
 *                         or its value could never be supplied and the marker
 *                         would leak to the live page.
 *
 * This service owns those invariants: it rejects a template whose shell has no
 * question slot, or whose markers reference an undeclared placeholder. The
 * builder (QuizPageService, a later phase) trusts a stored template to be
 * well-formed in exactly this sense.
 */
class QuizTemplateService {

	/** Upper bound for one template's HTML, matching the quiz page limit. */
	private const MAX_HTML_BYTES = 4 * 1024 * 1024;

	/** The one repeating question slot every template must contain. */
	public const QUESTION_SLOT = '{{pukat:questions}}';

	/** Placeholder keys and field types the builder knows how to render. */
	private const KEY_PATTERN   = '/^[a-z0-9_]{1,40}$/';
	private const FIELD_TYPES   = [ 'text', 'textarea' ];

	private QuizTemplateRepository $repository;
	private QuizPageRepository $pages;

	public function __construct(
		?QuizTemplateRepository $repository = null,
		?QuizPageRepository $pages = null
	) {
		$this->repository = $repository ?? new QuizTemplateRepository();
		$this->pages      = $pages ?? new QuizPageRepository();
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array{templates: array<int, array<string, mixed>>}
	 */
	public function list( array $params = [] ): array {
		$only_active = ! empty( $params['only_active'] );
		$rows        = $this->repository->list_all( $only_active );

		return [ 'templates' => array_map( [ $this, 'present' ], $rows ) ];
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	public function get( array $params ): array|WP_Error {
		$id  = (int) ( $params['id'] ?? 0 );
		$row = $id > 0 ? $this->repository->find( $id ) : null;
		if ( ! $row ) {
			return new WP_Error( 'quiz_template_not_found', __( 'Quiz template not found.', 'pukat' ), [ 'status' => 404 ] );
		}

		return $this->present( $row, true );
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id = 0 ): array|WP_Error {
		$fields = $this->sanitize( $params );
		if ( is_wp_error( $fields ) ) {
			return $fields;
		}

		$fields['created_by'] = $user_id;
		$id                   = $this->repository->create( $fields );
		if ( false === $id ) {
			return new WP_Error( 'quiz_template_create_failed', __( 'Could not save the quiz template.', 'pukat' ), [ 'status' => 500 ] );
		}

		AuditLogService::log( 'quiz_template.created', [ 'name' => $fields['name'] ], $user_id, 'quiz_template', $id );

		return $this->get( [ 'id' => $id ] );
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	public function update( array $params, int $user_id = 0 ): array|WP_Error {
		$id  = (int) ( $params['id'] ?? 0 );
		$row = $id > 0 ? $this->repository->find( $id ) : null;
		if ( ! $row ) {
			return new WP_Error( 'quiz_template_not_found', __( 'Quiz template not found.', 'pukat' ), [ 'status' => 404 ] );
		}

		$fields = $this->sanitize( $params );
		if ( is_wp_error( $fields ) ) {
			return $fields;
		}

		$fields['updated_by'] = $user_id;
		if ( ! $this->repository->update( $id, $fields ) ) {
			return new WP_Error( 'quiz_template_update_failed', __( 'Could not update the quiz template.', 'pukat' ), [ 'status' => 500 ] );
		}

		AuditLogService::log( 'quiz_template.updated', [ 'name' => $fields['name'] ], $user_id, 'quiz_template', $id );

		return $this->get( [ 'id' => $id ] );
	}

	/**
	 * @param array<string, mixed> $params
	 * @return array{ok: bool}|WP_Error
	 */
	public function delete( array $params, int $user_id = 0 ): array|WP_Error {
		$id  = (int) ( $params['id'] ?? 0 );
		$row = $id > 0 ? $this->repository->find( $id ) : null;
		if ( ! $row ) {
			return new WP_Error( 'quiz_template_not_found', __( 'Quiz template not found.', 'pukat' ), [ 'status' => 404 ] );
		}

		// A template in use by a quiz page must not vanish from under it — the
		// page keeps template_id and would be orphaned. Block instead.
		$in_use = $this->pages->count_using_template( $id );
		if ( $in_use > 0 ) {
			return new WP_Error(
				'quiz_template_in_use',
				sprintf(
					/* translators: %d: number of quizzes. */
					_n( 'This template is used by %d quiz and cannot be deleted. Deactivate it instead.', 'This template is used by %d quizzes and cannot be deleted. Deactivate it instead.', $in_use, 'pukat' ),
					$in_use
				),
				[ 'status' => 409 ]
			);
		}

		if ( ! $this->repository->delete( $id ) ) {
			return new WP_Error( 'quiz_template_delete_failed', __( 'Could not delete the quiz template.', 'pukat' ), [ 'status' => 500 ] );
		}

		AuditLogService::log( 'quiz_template.deleted', [ 'name' => (string) ( $row['name'] ?? '' ) ], $user_id, 'quiz_template', $id );

		return [ 'ok' => true ];
	}

	/**
	 * Validate and normalise the writable fields.
	 *
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	private function sanitize( array $params ): array|WP_Error {
		$name = trim( (string) ( $params['name'] ?? '' ) );
		if ( '' === $name ) {
			return new WP_Error( 'quiz_template_invalid', __( 'A template name is required.', 'pukat' ), [ 'status' => 422 ] );
		}
		if ( mb_strlen( $name ) > 255 ) {
			return new WP_Error( 'quiz_template_invalid', __( 'The template name is too long.', 'pukat' ), [ 'status' => 422 ] );
		}

		$html = (string) ( $params['html_body'] ?? '' );
		if ( '' === trim( $html ) ) {
			return new WP_Error( 'quiz_template_invalid', __( 'The template HTML is required.', 'pukat' ), [ 'status' => 422 ] );
		}
		if ( strlen( $html ) > self::MAX_HTML_BYTES ) {
			return new WP_Error( 'quiz_template_invalid', __( 'The template HTML is too large.', 'pukat' ), [ 'status' => 422 ] );
		}

		$placeholders = $this->sanitize_placeholders( $params['placeholders'] ?? [] );
		if ( is_wp_error( $placeholders ) ) {
			return $placeholders;
		}

		$marker_error = $this->validate_markers( $html, $placeholders );
		if ( is_wp_error( $marker_error ) ) {
			return $marker_error;
		}

		return [
			'name'         => $name,
			'description'  => mb_substr( trim( (string) ( $params['description'] ?? '' ) ), 0, 500 ),
			'html_body'    => $html,
			'placeholders' => (string) wp_json_encode( $placeholders ),
			'is_active'    => array_key_exists( 'is_active', $params ) ? (int) (bool) $params['is_active'] : 1,
		];
	}

	/**
	 * @param mixed $raw
	 * @return array<int, array<string, mixed>>|WP_Error
	 */
	private function sanitize_placeholders( $raw ): array|WP_Error {
		if ( '' === $raw || null === $raw ) {
			return [];
		}
		if ( is_string( $raw ) ) {
			$decoded = json_decode( $raw, true );
			$raw     = is_array( $decoded ) ? $decoded : null;
		}
		if ( ! is_array( $raw ) ) {
			return new WP_Error( 'quiz_template_invalid', __( 'Placeholders must be a list of fields.', 'pukat' ), [ 'status' => 422 ] );
		}

		$clean = [];
		$seen  = [];
		foreach ( $raw as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$key = strtolower( trim( (string) ( $item['key'] ?? '' ) ) );
			if ( ! preg_match( self::KEY_PATTERN, $key ) ) {
				return new WP_Error(
					'quiz_template_invalid',
					sprintf(
						/* translators: %s: the offending placeholder key. */
						__( 'Placeholder key "%s" is invalid — use lowercase letters, numbers and underscores (max 40).', 'pukat' ),
						$key
					),
					[ 'status' => 422 ]
				);
			}
			if ( isset( $seen[ $key ] ) ) {
				return new WP_Error(
					'quiz_template_invalid',
					sprintf(
						/* translators: %s: the duplicated placeholder key. */
						__( 'Placeholder key "%s" is declared more than once.', 'pukat' ),
						$key
					),
					[ 'status' => 422 ]
				);
			}
			$seen[ $key ] = true;

			$type = (string) ( $item['type'] ?? 'text' );
			if ( ! in_array( $type, self::FIELD_TYPES, true ) ) {
				$type = 'text';
			}

			$clean[] = [
				'key'      => $key,
				'label'    => mb_substr( trim( (string) ( $item['label'] ?? $key ) ), 0, 120 ),
				'type'     => $type,
				'required' => (bool) ( $item['required'] ?? false ),
			];
		}

		return $clean;
	}

	/**
	 * The template-side half of the linter: the shell must have exactly one
	 * question slot, and every {{pukat:<key>}} marker must be a declared
	 * placeholder (or the question slot). Otherwise a marker would survive
	 * generation and show up verbatim on the live page.
	 *
	 * @param array<int, array<string, mixed>> $placeholders
	 * @return WP_Error|null
	 */
	private function validate_markers( string $html, array $placeholders ): ?WP_Error {
		$slots = substr_count( $html, self::QUESTION_SLOT );
		if ( 1 !== $slots ) {
			return new WP_Error(
				'quiz_template_invalid',
				sprintf(
					/* translators: %1$s: the marker, %2$d: how many times it appears. */
					__( 'The template must contain the question slot %1$s exactly once (found %2$d).', 'pukat' ),
					self::QUESTION_SLOT,
					$slots
				),
				[ 'status' => 422 ]
			);
		}

		$declared = array_column( $placeholders, 'key' );
		if ( preg_match_all( '/\{\{pukat:([a-z0-9_]+)\}\}/', $html, $matches ) ) {
			foreach ( array_unique( $matches[1] ) as $key ) {
				if ( 'questions' === $key ) {
					continue;
				}
				if ( ! in_array( $key, $declared, true ) ) {
					return new WP_Error(
						'quiz_template_invalid',
						sprintf(
							/* translators: %s: the undeclared marker key. */
							__( 'The template uses {{pukat:%s}} but no such placeholder is declared.', 'pukat' ),
							$key
						),
						[ 'status' => 422 ]
					);
				}
			}
		}

		return null;
	}

	/**
	 * Shape a row for the API: decode placeholders, drop html_body unless the
	 * caller asked for the full record.
	 *
	 * @param array<string, mixed> $row
	 * @return array<string, mixed>
	 */
	private function present( array $row, bool $with_html = false ): array {
		$placeholders = json_decode( (string) ( $row['placeholders'] ?? '' ), true );

		$out = [
			'id'           => (int) ( $row['id'] ?? 0 ),
			'name'         => (string) ( $row['name'] ?? '' ),
			'description'  => (string) ( $row['description'] ?? '' ),
			'placeholders' => is_array( $placeholders ) ? $placeholders : [],
			'is_active'    => (bool) ( $row['is_active'] ?? true ),
			'created_at'   => $row['created_at'] ?? null,
			'updated_at'   => $row['updated_at'] ?? null,
		];
		if ( $with_html ) {
			$out['html_body'] = (string) ( $row['html_body'] ?? '' );
		}

		return $out;
	}
}
