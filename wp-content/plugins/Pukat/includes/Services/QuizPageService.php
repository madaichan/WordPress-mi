<?php
/**
 * Quiz page (one per entity) business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\CampaignRunRepository;
use Pukat\Repositories\FlagPageRepository;
use Pukat\Repositories\QuizPageRepository;
use Pukat\Repositories\QuizResultRepository;
use Pukat\Repositories\QuizTemplateRepository;
use WP_Error;

/**
 * The single quiz page an entity shows after the education page
 * (docs/PRD_QUIZ_MODULE.md). Authored like a landing page: raw HTML, saved as
 * a draft and published explicitly.
 *
 * Two things set it apart from FlagPageService, and both exist because the
 * HTML is free-form while grading is not:
 *
 * 1. Publishing runs QuizPageLinter first and refuses (422) when the page's
 *    inputs and the entity's answer key do not line up — a page whose answers
 *    cannot be graded must never go live (FR-6).
 * 2. Publishing snapshots the answer key and the effective pass score onto the
 *    row. Answers are graded against that snapshot, so editing the question
 *    bank afterwards never rewrites scores somebody already earned (§5.3).
 */
class QuizPageService {

	/** Upper bound for one page's HTML source, matching FlagPageService. */
	private const MAX_HTML_BYTES = 4 * 1024 * 1024;

	/** The UNIQUE index is on VARCHAR(191); reject longer names up front. */
	private const MAX_ENTITY_LEN = 191;

	/** Fallback when neither the run nor the entity sets a pass score. */
	private const DEFAULT_PASS_SCORE = 70;

	private const STATUS_DRAFT     = 'draft';
	private const STATUS_PUBLISHED = 'published';

	private QuizPageRepository $repository;
	private EntityProfileService $access;
	private QuizQuestionService $questions;
	private QuizPageLinter $linter;
	private QuizPageSyncService $sync;
	private QuizChainService $chain;
	private QuizTemplateRepository $templates;
	private QuizPageGenerator $generator;
	private QuizResultRepository $results;
	private GoPhishService $gophish;
	private CampaignRunRepository $runs;

	/**
	 * The education page is reached through its repository, not FlagPageService:
	 * once QuizChainService links the two pages (Q4), going through the service
	 * would build a construction cycle.
	 */
	private FlagPageRepository $flag_pages;

	public function __construct(
		?QuizPageRepository $repository = null,
		?EntityProfileService $access = null,
		?QuizQuestionService $questions = null,
		?QuizPageLinter $linter = null,
		?QuizPageSyncService $sync = null,
		?FlagPageRepository $flag_pages = null,
		?QuizChainService $chain = null,
		?QuizTemplateRepository $templates = null,
		?QuizPageGenerator $generator = null,
		?QuizResultRepository $results = null,
		?GoPhishService $gophish = null,
		?CampaignRunRepository $runs = null
	) {
		$this->repository = $repository ?? new QuizPageRepository();
		$this->access     = $access ?? new EntityProfileService();
		$this->questions  = $questions ?? new QuizQuestionService();
		$this->linter     = $linter ?? new QuizPageLinter();
		$this->sync       = $sync ?? new QuizPageSyncService();
		$this->flag_pages = $flag_pages ?? new FlagPageRepository();
		$this->chain      = $chain ?? new QuizChainService();
		$this->templates  = $templates ?? new QuizTemplateRepository();
		$this->generator  = $generator ?? new QuizPageGenerator();
		$this->results    = $results ?? new QuizResultRepository();
		$this->gophish    = $gophish ?? new GoPhishService();
		$this->runs       = $runs ?? new CampaignRunRepository();
	}

	/**
	 * The entity's quiz page. An entity without one yet returns an empty,
	 * unsaved page (id null) rather than 404, so the editor can open onto it.
	 *
	 * @param array<string, mixed> $params entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function get( array $params ): array|WP_Error {
		$entity = $this->target_entity( $params );
		if ( '' === $entity ) {
			return $this->no_entity_error();
		}

		if ( ! $this->access->current_user_can_view_entity( $entity ) ) {
			// Non-admins can't name another entity; fall back to their own.
			$entity = trim( $this->access->current_user_entity() );
			if ( '' === $entity ) {
				return $this->no_entity_error();
			}
		}

		$id  = (int) ( $params['id'] ?? 0 );
		$row = $id > 0 ? $this->entity_quiz( $id, $entity ) : $this->repository->find_default_for_entity( $entity );
		return $this->with_lock_state( $this->prepare( $row, $entity ), $row, $entity );
	}

	/**
	 * The entity's quizzes for the builder list (metadata only). Read scope is
	 * the same as get(): non-admins always see their own entity's quizzes.
	 *
	 * @param array<string, mixed> $params entity? (admin only)
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

		$raw = $this->repository->list_for_entity( $entity );
		// Chain linkage per quiz (which simulations point straight at it, plus
		// whether the education route leads here) — one GoPhish call for all of
		// the entity's quizzes.
		[ $gophish_ok, $linkage ] = $this->compute_linkage( $raw );

		$rows = array_map( function ( array $row ) use ( $linkage ): array {
			$link = $linkage[ (int) $row['id'] ] ?? [ 'count' => 0, 'linked' => [], 'education' => [ 'chained' => false, 'master_id' => 0, 'campaign_count' => 0, 'campaigns' => [], 'education_only_count' => 0 ] ];

			return [
				'id'                  => (int) $row['id'],
				'title'               => (string) $row['title'],
				'template_id'         => empty( $row['template_id'] ) ? null : (int) $row['template_id'],
				'is_default_followup' => (bool) $row['is_default_followup'],
				'status'              => (string) $row['status'],
				'gophish_master_id'   => empty( $row['gophish_master_id'] ) ? null : (int) $row['gophish_master_id'],
				'linkage_count'       => $link['count'],
				'linked_campaigns'    => $link['linked'],
				'education_chain'     => $link['education'],
				'synced_at'           => $row['synced_at'] ?? null,
				'updated_at'          => $row['updated_at'] ?? null,
				'published_at'        => $row['published_at'] ?? null,
			];
		}, $raw );

		return [ 'entity_name' => $entity, 'quizzes' => $rows, 'gophish_ok' => $gophish_ok ];
	}

	/**
	 * Admin overview of every quiz across all entities (Quiz Builder v2): the
	 * quiz, the template it uses, and how it is used — both the live GoPhish
	 * chain linkage (which campaigns route into its master) and the local
	 * recorded results (participants / attempts / runs). Admin-only; the
	 * controller gates access.
	 *
	 * @return array{quizzes: array<int, array<string, mixed>>, gophish_ok: bool}
	 */
	public function overview(): array {
		$quizzes      = $this->repository->list_all();
		$template_map = [];
		foreach ( $this->templates->list_all() as $t ) {
			$template_map[ (int) $t['id'] ] = (string) $t['name'];
		}

		$ids   = array_map( static fn ( array $q ): int => (int) $q['id'], $quizzes );
		$usage = $this->results->usage_by_quiz_page( $ids );

		[ $gophish_ok, $linkage ] = $this->compute_linkage( $quizzes );

		$rows = [];
		foreach ( $quizzes as $quiz ) {
			$master_id = (int) ( $quiz['gophish_master_id'] ?? 0 );
			$local     = $usage[ (int) $quiz['id'] ] ?? [ 'attempts' => 0, 'participants' => 0, 'runs' => 0 ];
			$link      = $linkage[ (int) $quiz['id'] ] ?? [ 'count' => 0, 'linked' => [], 'education' => [ 'chained' => false, 'master_id' => 0, 'campaign_count' => 0, 'campaigns' => [], 'education_only_count' => 0 ] ];

			$rows[] = [
				'id'                  => (int) $quiz['id'],
				'title'               => (string) $quiz['title'],
				'entity_name'         => (string) $quiz['entity_name'],
				'template_id'         => empty( $quiz['template_id'] ) ? null : (int) $quiz['template_id'],
				'template_name'       => empty( $quiz['template_id'] ) ? null : ( $template_map[ (int) $quiz['template_id'] ] ?? null ),
				'status'              => (string) $quiz['status'],
				'is_default_followup' => (bool) $quiz['is_default_followup'],
				'gophish_master_id'   => $master_id ?: null,
				'linkage_count'       => $link['count'],
				'linked_campaigns'    => $link['linked'],
				'education_chain'     => $link['education'],
				'participants'        => $local['participants'],
				'attempts'            => $local['attempts'],
				'runs'                => $local['runs'],
			];
		}

		return [ 'quizzes' => $rows, 'gophish_ok' => $gophish_ok ];
	}

	/**
	 * Generate the quiz page HTML from the builder's current, unsaved inputs so
	 * the editor can show a live preview (Quiz Builder v2). Reads only — never
	 * writes. Also returns the linter report so the preview can flag problems
	 * as they are built.
	 *
	 * @param array<string, mixed> $params template_id, field_values?, selected_question_ids?, entity? (admin only)
	 * @return array{html: string, linter: array<string, mixed>|null, entity_name: string}|WP_Error
	 */
	public function preview( array $params ): array|WP_Error {
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

		$template_id = (int) ( $params['template_id'] ?? 0 );
		if ( $template_id <= 0 ) {
			return [ 'html' => '', 'linter' => null, 'entity_name' => $entity ];
		}
		$template = $this->templates->find( $template_id );
		if ( ! $template ) {
			return $this->validation_error( __( 'The chosen quiz template no longer exists.', 'pukat' ) );
		}

		$field_values = $this->sanitize_field_values( $params['field_values'] ?? [] );
		$selected     = $params['selected_question_ids'] ?? [];
		$selected     = array_values( array_unique( array_filter( array_map( 'intval', (array) ( is_array( $selected ) ? $selected : [] ) ), static fn ( int $i ): bool => $i > 0 ) ) );

		$questions = $this->questions->selected_questions( $selected, $entity );
		$html      = $this->generator->generate( (string) $template['html_body'], $field_values, $questions );
		$linter    = $this->linter->inspect( $html, $this->questions->answer_key_from_rows( $questions ) );

		return [ 'html' => $html, 'linter' => $linter, 'entity_name' => $entity ];
	}

	/**
	 * GoPhish chain linkage per quiz. Only campaigns whose own
	 * `next_campaign_id` is the quiz master count as linked: those are the
	 * simulations an operator deliberately pointed at this quiz.
	 *
	 * A simulation can reach a quiz three ways, and only two of them belong to
	 * the quiz: simulation → education (not this quiz's business), simulation →
	 * education → quiz, and simulation → quiz. The live GoPhish chain cannot
	 * separate the first two, because the education master carries one shared
	 * `next_campaign_id` (PRD §13.9) — the moment it points here, every
	 * campaign that ever chained to education, finished runs included, looks
	 * routed into a quiz just published. What each run actually opted into is
	 * recorded locally in its `follow_up_json`, so that is what splits them:
	 * `education` lists only the campaigns whose run asked for quiz follow-up,
	 * and counts the education-only ones apart.
	 *
	 * One get_campaigns call covers the whole set (never per quiz). On a
	 * GoPhish failure gophish_ok is false and the map is empty.
	 *
	 * @param array<int, array<string, mixed>> $quiz_rows rows with id, entity_name, gophish_master_id
	 * @return array{0: bool, 1: array<int, array{count: int, linked: array<int, array<string, mixed>>, education: array{chained: bool, master_id: int, campaign_count: int, campaigns: array<int, array<string, mixed>>, education_only_count: int}}>}
	 */
	private function compute_linkage( array $quiz_rows ): array {
		$campaigns = $this->gophish->get_campaigns();
		if ( is_wp_error( $campaigns ) ) {
			return [ false, [] ];
		}

		$by_id = [];
		foreach ( $campaigns as $c ) {
			$by_id[ (int) ( $c['id'] ?? 0 ) ] = $c;
		}

		// What each campaign's run opted into — the only record of whether a
		// simulation chained to education was meant to continue to the quiz.
		$follow_up = $this->runs->follow_up_by_gophish_campaign_id( array_keys( $by_id ) );

		$edu_cache = [];
		$map       = [];
		foreach ( $quiz_rows as $quiz ) {
			$qid       = (int) $quiz['id'];
			$master_id = (int) ( $quiz['gophish_master_id'] ?? 0 );
			$linked    = [];
			$education = [ 'chained' => false, 'master_id' => 0, 'campaign_count' => 0, 'campaigns' => [], 'education_only_count' => 0 ];
			if ( $master_id > 0 ) {
				$entity = (string) $quiz['entity_name'];
				if ( ! array_key_exists( $entity, $edu_cache ) ) {
					$edu_cache[ $entity ] = $this->education_master_id( $entity );
				}
				$edu_id          = $edu_cache[ $entity ];
				$edu_chains_here = $edu_id > 0 && (int) ( $by_id[ $edu_id ]['next_campaign_id'] ?? 0 ) === $master_id;

				$education['chained']   = $edu_chains_here;
				$education['master_id'] = $edu_chains_here ? $edu_id : 0;

				foreach ( $campaigns as $c ) {
					$cid = (int) ( $c['id'] ?? 0 );
					if ( $cid === $master_id || $cid === $edu_id ) {
						continue; // The masters themselves are the pathway, not users.
					}
					$next = (int) ( $c['next_campaign_id'] ?? 0 );
					if ( $next === $master_id ) {
						$linked[] = [
							'id'     => $cid,
							'name'   => (string) ( $c['name'] ?? '' ),
							'status' => (string) ( $c['status'] ?? '' ),
							'via'    => 'quiz',
						];
					} elseif ( $edu_chains_here && $next === $edu_id ) {
						// Education-only runs stop at the education page as far
						// as the operator asked; a run with no stored follow-up
						// (campaign made outside Pukat) is read the same way.
						if ( empty( $follow_up[ $cid ]['quiz_enabled'] ) ) {
							++$education['education_only_count'];
							continue;
						}
						$education['campaigns'][] = [
							'id'     => $cid,
							'name'   => (string) ( $c['name'] ?? '' ),
							'status' => (string) ( $c['status'] ?? '' ),
							'via'    => 'education',
						];
					}
				}
			}
			$education['campaign_count'] = count( $education['campaigns'] );

			$map[ $qid ] = [ 'count' => count( $linked ), 'linked' => $linked, 'education' => $education ];
		}

		return [ true, $map ];
	}

	/**
	 * A quiz by id that must belong to the given entity — the per-quiz access
	 * guard for the many-per-entity write paths. Returns null when the id is
	 * unknown or owned by another entity.
	 *
	 * @return array<string, mixed>|null
	 */
	private function entity_quiz( int $id, string $entity ): ?array {
		$row = $this->repository->find( $id );
		if ( ! $row || 0 !== strcasecmp( (string) $row['entity_name'], $entity ) ) {
			return null;
		}

		return $row;
	}

	/**
	 * Save the working draft. Never touches the published copy or its snapshot.
	 *
	 * @param array<string, mixed> $params html_body, title?, launch_url?, thankyou_url?, pass_score?, entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function save( array $params, int $user_id ): array|WP_Error {
		$context = $this->writable_context( $params );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		[ $entity, $existing ] = $context;

		$lock = $this->assert_editable( $existing, $entity );
		if ( $lock ) {
			return $lock;
		}

		$title = mb_substr( trim( sanitize_text_field( (string) ( $params['title'] ?? ( $existing['title'] ?? '' ) ) ) ), 0, 255 );

		// A quiz is template-backed (Quiz Builder v2) when a template is in
		// play — from this save or already stored. Then html_body is generated
		// here from template + placeholder values + selected questions, and the
		// client never sends it. A quiz with no template is a legacy v1 page
		// whose html_body is authored by hand.
		$template_id = $this->resolve_template_id( $params, $existing );
		if ( $template_id > 0 ) {
			$built = $this->build_from_template( $template_id, $params, $existing, $entity );
			if ( is_wp_error( $built ) ) {
				return $built;
			}
			$data = array_merge( $built, [ 'title' => $title, 'updated_by' => $user_id ] );
		} else {
			if ( ! array_key_exists( 'html_body', $params ) || ! is_string( $params['html_body'] ) ) {
				return $this->validation_error( __( 'The page HTML is required.', 'pukat' ) );
			}
			$html = (string) $params['html_body'];
			if ( strlen( $html ) > self::MAX_HTML_BYTES ) {
				return $this->validation_error( __( 'The page HTML is too large.', 'pukat' ) );
			}
			$data = [
				'title'      => $title,
				'html_body'  => $html,
				'updated_by' => $user_id,
			];
		}

		// URLs and pass score are only touched when the client sends them, so a
		// save that omits them keeps the stored choice.
		$optional = $this->optional_settings( $params );
		if ( is_wp_error( $optional ) ) {
			return $optional;
		}
		$data = array_merge( $data, $optional );

		if ( $existing ) {
			$this->repository->update( (int) $existing['id'], $data );
			$id = (int) $existing['id'];
		} else {
			// A brand-new quiz becomes the entity's default-followup only when
			// it is the first one (PRD §13.9) — otherwise the existing default
			// keeps the chain.
			$is_default = 0 === $this->repository->count_for_entity( $entity ) ? 1 : 0;
			$id         = $this->repository->create( array_merge( $data, [
				'entity_name'         => $entity,
				'status'              => self::STATUS_DRAFT,
				'is_default_followup' => $is_default,
				'created_by'          => $user_id,
			] ) );
			if ( false === $id ) {
				return $this->db_error( __( 'Failed to save the quiz page.', 'pukat' ) );
			}
		}

		AuditLogService::log( 'quiz_page.saved', [ 'quiz_page_id' => $id, 'entity_name' => $entity ], $user_id, 'quiz_page', $id );

		return $this->prepare( $this->repository->find( $id ), $entity );
	}

	/**
	 * Create a new, empty quiz for the entity (the builder's "add quiz"). The
	 * first quiz an entity owns becomes its default-followup. Content is filled
	 * in later by save() / the builder; html_body starts empty.
	 *
	 * @param array<string, mixed> $params title?, template_id?, entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function create( array $params, int $user_id ): array|WP_Error {
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

		$title       = mb_substr( trim( sanitize_text_field( (string) ( $params['title'] ?? '' ) ) ), 0, 255 );
		$template_id = isset( $params['template_id'] ) && '' !== $params['template_id'] ? (int) $params['template_id'] : null;
		$is_default  = 0 === $this->repository->count_for_entity( $entity ) ? 1 : 0;

		$id = $this->repository->create( [
			'entity_name'         => $entity,
			'title'               => '' === $title ? __( 'Untitled quiz', 'pukat' ) : $title,
			'template_id'         => $template_id,
			'html_body'           => '',
			'status'              => self::STATUS_DRAFT,
			'is_default_followup' => $is_default,
			'created_by'          => $user_id,
		] );
		if ( false === $id ) {
			return $this->db_error( __( 'Failed to create the quiz.', 'pukat' ) );
		}

		AuditLogService::log( 'quiz_page.created', [ 'quiz_page_id' => $id, 'entity_name' => $entity ], $user_id, 'quiz_page', $id );

		return $this->prepare( $this->repository->find( $id ), $entity );
	}

	/**
	 * Mark one quiz as the entity's default-followup — the quiz the
	 * education -> quiz chain uses (PRD §13.9). Clears the flag on the others.
	 *
	 * @param array<string, mixed> $params id, entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function set_default( array $params, int $user_id ): array|WP_Error {
		$context = $this->writable_context( $params );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		[ $entity, $existing ] = $context;
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Quiz not found.', 'pukat' ) );
		}

		$this->repository->update( (int) $existing['id'], [ 'is_default_followup' => 1, 'updated_by' => $user_id ] );
		$this->repository->clear_default_for_entity( $entity, (int) $existing['id'] );

		AuditLogService::log( 'quiz_page.default_set', [ 'quiz_page_id' => (int) $existing['id'], 'entity_name' => $entity ], $user_id, 'quiz_page', (int) $existing['id'] );

		// The chain target changed, so re-point the education master at this
		// quiz's master (a no-op unless both sides are published).
		$chain_status = $this->chain->link_education_to_quiz( $entity, $user_id );

		$row          = $this->repository->find( (int) $existing['id'] );
		$out          = $this->with_lock_state( $this->prepare( $row, $entity ), $row, $entity );
		$out['chain'] = $chain_status;
		return $out;
	}

	/**
	 * Delete a quiz. Blocked while it is locked by an active simulation; if it
	 * was the published chain target, education is unlinked first, and if it
	 * was the default the lowest-id remaining quiz is promoted.
	 *
	 * @param array<string, mixed> $params id, entity? (admin only)
	 * @return array{ok: bool}|WP_Error
	 */
	public function delete( array $params, int $user_id ): array|WP_Error {
		$context = $this->writable_context( $params );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		[ $entity, $existing ] = $context;
		if ( ! $existing ) {
			return $this->not_found_error( __( 'Quiz not found.', 'pukat' ) );
		}

		$lock = $this->assert_editable( $existing, $entity );
		if ( $lock ) {
			return $lock;
		}

		$was_default   = (bool) $existing['is_default_followup'];
		$was_published = self::STATUS_PUBLISHED === (string) $existing['status'];
		if ( $was_default && $was_published ) {
			$this->chain->unlink_education_from_quiz( $entity, $user_id );
		}

		$this->repository->delete( (int) $existing['id'] );
		AuditLogService::log( 'quiz_page.deleted', [ 'quiz_page_id' => (int) $existing['id'], 'entity_name' => $entity ], $user_id, 'quiz_page', (int) $existing['id'] );

		// Keep a default alive: promote the lowest-id remaining quiz, then
		// re-point the chain at it.
		if ( $was_default ) {
			$next = $this->repository->find_default_for_entity( $entity );
			if ( $next ) {
				$this->repository->update( (int) $next['id'], [ 'is_default_followup' => 1 ] );
				$this->chain->link_education_to_quiz( $entity, $user_id );
			}
		}

		return [ 'ok' => true ];
	}

	/**
	 * Run the linter over a draft without saving or publishing anything, so the
	 * operator can see what stands between the page and a publish (FR-6).
	 *
	 * @param array<string, mixed> $params html_body? (defaults to the saved draft), entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function validate( array $params ): array|WP_Error {
		$page = $this->get( $params );
		if ( is_wp_error( $page ) ) {
			return $page;
		}

		$entity = (string) $page['entity_name'];
		$html   = array_key_exists( 'html_body', $params ) && is_string( $params['html_body'] )
			? (string) $params['html_body']
			: (string) $page['html_body'];

		// A template-backed quiz is linted against its own selected questions;
		// a legacy page against the whole active bank.
		if ( ! empty( $page['template_id'] ) ) {
			$rows       = $this->questions->selected_questions( (array) ( $page['selected_question_ids'] ?? [] ), $entity );
			$answer_key = $this->questions->answer_key_from_rows( $rows );
		} else {
			$answer_key = $this->questions->answer_key_for_entity( $entity );
		}

		return [
			'entity_name' => $entity,
			'linter'      => $this->linter->inspect( $html, $answer_key ),
		];
	}

	/**
	 * Publish the saved draft: lint, then copy it into the published copy
	 * together with the answer key and pass score it must be graded against.
	 *
	 * @param array<string, mixed> $params entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function publish( array $params, int $user_id ): array|WP_Error {
		$context = $this->writable_context( $params );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		[ $entity, $existing ] = $context;

		$lock = $this->assert_editable( $existing, $entity );
		if ( $lock ) {
			return $lock;
		}

		if ( ! $existing ) {
			return $this->validation_error( __( 'Save a draft before publishing.', 'pukat' ) );
		}
		$html = (string) $existing['html_body'];
		if ( '' === trim( $html ) ) {
			return $this->validation_error( __( 'The draft is empty.', 'pukat' ) );
		}

		$answer_key = $this->answer_key_for_row( $existing, $entity );
		if ( empty( $answer_key ) ) {
			return $this->validation_error(
				! empty( $existing['template_id'] )
					? __( 'Select at least one question for this quiz before publishing.', 'pukat' )
					: __( 'Add at least one active question to the bank before publishing.', 'pukat' )
			);
		}

		$linter = $this->linter->inspect( $html, $answer_key );
		if ( ! $linter['ok'] ) {
			return new WP_Error(
				'quiz_page_invalid',
				__( 'This page cannot be published yet: its answers could not all be graded.', 'pukat' ),
				[ 'status' => 422, 'linter' => $linter ]
			);
		}

		$pass_score = $this->effective_pass_score( null, $existing );

		$this->repository->update( (int) $existing['id'], [
			'published_html'       => $html,
			'published_answer_key' => (string) wp_json_encode( $answer_key ),
			'published_pass_score' => $pass_score,
			'status'               => self::STATUS_PUBLISHED,
			'published_by'         => $user_id,
			'published_at'         => current_time( 'mysql' ),
			'updated_by'           => $user_id,
		] );

		AuditLogService::log(
			'quiz_page.published',
			[
				'quiz_page_id'   => (int) $existing['id'],
				'entity_name'    => $entity,
				'question_count' => count( $answer_key ),
				'pass_score'     => $pass_score,
			],
			$user_id,
			'quiz_page',
			(int) $existing['id']
		);

		// Push the just-published copy to GoPhish as a Landing Page, then
		// create/refresh the quiz master from it. Neither failure undoes the
		// local publish — both are reported back so the UI can offer a retry.
		$quiz_id     = (int) $existing['id'];
		$sync_status = $this->push_to_gophish( (array) $this->repository->find( $quiz_id ), $entity, $user_id );

		$master_status = [ 'ok' => false, 'message' => '' ];
		$chain_status  = [ 'ok' => true, 'linked' => false, 'message' => '' ];
		if ( $sync_status['ok'] ) {
			$master_status = $this->refresh_master( (array) $this->repository->find( $quiz_id ), $entity, $user_id );
			// Only the default-followup quiz sits in the education -> quiz
			// chain (PRD §13.9); publishing another quiz never re-points it.
			if ( $master_status['ok'] && ! empty( $existing['is_default_followup'] ) ) {
				// The master just got a new id, so the education master's
				// next_campaign_id has to be re-pointed at it (Q4).
				$chain_status = $this->chain->link_education_to_quiz( $entity, $user_id );
			}
		}

		$row           = $this->repository->find( $quiz_id );
		$out           = $this->with_lock_state( $this->prepare( $row, $entity ), $row, $entity );
		$out['linter'] = $linter;
		$out['sync']   = $sync_status;
		$out['master'] = $master_status;
		$out['chain']  = $chain_status;
		return $out;
	}

	/**
	 * Re-push the already-published page to GoPhish (retry after a failed sync)
	 * without changing draft/published state or the snapshot.
	 *
	 * @param array<string, mixed> $params entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function sync( array $params, int $user_id ): array|WP_Error {
		$context = $this->writable_context( $params );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		[ $entity, $existing ] = $context;

		if ( ! $existing || self::STATUS_PUBLISHED !== (string) $existing['status'] ) {
			return $this->validation_error( __( 'Publish the page before syncing to GoPhish.', 'pukat' ) );
		}

		$quiz_id     = (int) $existing['id'];
		$sync_status = $this->push_to_gophish( $existing, $entity, $user_id );

		$master_status = [ 'ok' => false, 'message' => '' ];
		$chain_status  = [ 'ok' => true, 'linked' => false, 'message' => '' ];
		if ( $sync_status['ok'] ) {
			$master_status = $this->refresh_master( (array) $this->repository->find( $quiz_id ), $entity, $user_id );
			if ( $master_status['ok'] && ! empty( $existing['is_default_followup'] ) ) {
				$chain_status = $this->chain->link_education_to_quiz( $entity, $user_id );
			}
		}

		$row           = $this->repository->find( $quiz_id );
		$out           = $this->with_lock_state( $this->prepare( $row, $entity ), $row, $entity );
		$out['sync']   = $sync_status;
		$out['master'] = $master_status;
		$out['chain']  = $chain_status;
		return $out;
	}

	/**
	 * Push a row's published HTML to GoPhish and record the page id + time.
	 * Returns a status array (never throws) so callers can surface it.
	 *
	 * @param array<string, mixed> $row
	 * @return array{ok: bool, message: string, page_id?: int, page_name?: string}
	 */
	private function push_to_gophish( array $row, string $entity, int $user_id = 0 ): array {
		$html   = (string) ( $row['published_html'] ?? $row['html_body'] ?? '' );
		$result = $this->sync->push(
			$html,
			$entity,
			empty( $row['gophish_page_id'] ) ? null : (int) $row['gophish_page_id'],
			(string) ( $row['thankyou_url'] ?? '' ),
			(int) ( $row['id'] ?? 0 )
		);

		if ( is_wp_error( $result ) ) {
			return [ 'ok' => false, 'message' => $result->get_error_message() ];
		}

		$this->repository->update( (int) $row['id'], [
			'gophish_page_id' => (int) $result['id'],
			'synced_at'       => current_time( 'mysql' ),
		] );

		AuditLogService::log(
			'quiz_page.synced',
			[ 'quiz_page_id' => (int) $row['id'], 'entity_name' => $entity, 'gophish_page_id' => (int) $result['id'] ],
			$user_id,
			'quiz_page',
			(int) $row['id']
		);

		return [ 'ok' => true, 'message' => __( 'Synced to GoPhish.', 'pukat' ), 'page_id' => (int) $result['id'], 'page_name' => (string) $result['name'] ];
	}

	/**
	 * Create/refresh the GoPhish quiz master for a just-published page.
	 * Recreated so it snapshots the latest page. Returns a status array.
	 *
	 * @param array<string, mixed> $row
	 * @return array{ok: bool, message: string, campaign_id?: int, name?: string}
	 */
	private function refresh_master( array $row, string $entity, int $user_id ): array {
		if ( '' === trim( (string) ( $row['launch_url'] ?? '' ) ) ) {
			return [ 'ok' => false, 'message' => __( 'No Launch URL chosen — quiz master not created.', 'pukat' ) ];
		}
		if ( empty( $row['gophish_page_id'] ) ) {
			return [ 'ok' => false, 'message' => __( 'Landing page not synced — quiz master skipped.', 'pukat' ) ];
		}

		$result = $this->sync->recreate_master(
			$entity,
			(string) $row['launch_url'],
			empty( $row['gophish_master_id'] ) ? null : (int) $row['gophish_master_id'],
			(int) ( $row['id'] ?? 0 )
		);
		if ( is_wp_error( $result ) ) {
			return [ 'ok' => false, 'message' => $result->get_error_message() ];
		}

		$this->repository->update( (int) $row['id'], [ 'gophish_master_id' => (int) $result['id'] ] );

		AuditLogService::log(
			'quiz_page.master_recreated',
			[ 'quiz_page_id' => (int) $row['id'], 'entity_name' => $entity, 'gophish_master_id' => (int) $result['id'] ],
			$user_id,
			'quiz_page',
			(int) $row['id']
		);

		return [ 'ok' => true, 'message' => __( 'Quiz campaign ready in GoPhish.', 'pukat' ), 'campaign_id' => (int) $result['id'], 'name' => (string) $result['name'] ];
	}

	/**
	 * Lock editing while a campaign that routes into this quiz is still active
	 * (PRD FR-11). Resilient — a GoPhish read failure leaves the page editable;
	 * the next mutation re-checks.
	 *
	 * @param array<string, mixed>|null $existing
	 */
	private function assert_editable( ?array $existing, string $entity ): ?WP_Error {
		if ( ! $existing || empty( $existing['gophish_master_id'] ) ) {
			return null;
		}

		$active = $this->sync->active_simulations_for_quiz(
			(int) $existing['gophish_master_id'],
			$this->education_master_id( $entity )
		);
		if ( empty( $active ) ) {
			return null;
		}

		$names = implode( ', ', array_map( static fn ( array $a ): string => $a['name'] . ' (' . $a['status'] . ')', $active ) );

		return new WP_Error(
			'quiz_locked',
			sprintf(
				/* translators: %s: comma-separated campaign names. */
				__( 'This quiz page is locked because a related simulation is still active: %s. Complete or stop it before editing.', 'pukat' ),
				$names
			),
			[ 'status' => 409, 'active_simulations' => $active ]
		);
	}

	/**
	 * Append `editable` + `active_simulations` to a prepared page (advisory for
	 * the UI; mutations enforce via assert_editable()).
	 *
	 * @param array<string, mixed>      $out
	 * @param array<string, mixed>|null $row
	 * @return array<string, mixed>
	 */
	private function with_lock_state( array $out, ?array $row, string $entity ): array {
		$master_id = ( $row && ! empty( $row['gophish_master_id'] ) ) ? (int) $row['gophish_master_id'] : 0;
		$active    = $master_id > 0 ? $this->sync->active_simulations_for_quiz( $master_id, $this->education_master_id( $entity ) ) : [];

		$out['editable']           = empty( $active );
		$out['active_simulations'] = $active;
		return $out;
	}

	/** The entity's GoPhish education master id, or 0 — a second route into the quiz. */
	private function education_master_id( string $entity ): int {
		$row = $this->flag_pages->find_for_entity( $entity );

		return ( $row && ! empty( $row['gophish_master_id'] ) ) ? (int) $row['gophish_master_id'] : 0;
	}

	/**
	 * Clear the published copy and its snapshot, returning the page to draft.
	 *
	 * @param array<string, mixed> $params entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function unpublish( array $params, int $user_id ): array|WP_Error {
		$context = $this->writable_context( $params );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		[ $entity, $existing ] = $context;

		if ( ! $existing ) {
			return $this->not_found_error( __( 'Quiz page not found.', 'pukat' ) );
		}

		$lock = $this->assert_editable( $existing, $entity );
		if ( $lock ) {
			return $lock;
		}

		$this->repository->update( (int) $existing['id'], [
			'published_html'       => null,
			'published_answer_key' => null,
			'published_pass_score' => null,
			'status'               => self::STATUS_DRAFT,
			'published_by'         => null,
			'published_at'         => null,
			'updated_by'           => $user_id,
		] );

		AuditLogService::log( 'quiz_page.unpublished', [ 'quiz_page_id' => (int) $existing['id'], 'entity_name' => $entity ], $user_id, 'quiz_page', (int) $existing['id'] );

		// Unlink before the master can be deleted, or education would keep
		// redirecting targets into a quiz that is no longer published. Only the
		// default-followup quiz is in the chain (PRD §13.9); unpublishing
		// another quiz leaves education's link untouched. Done after the local
		// unpublish so a GoPhish failure cannot block it.
		$chain_status = ! empty( $existing['is_default_followup'] )
			? $this->chain->unlink_education_from_quiz( $entity, $user_id )
			: [ 'ok' => true, 'linked' => false, 'message' => '' ];

		$row          = $this->repository->find( (int) $existing['id'] );
		$out          = $this->with_lock_state( $this->prepare( $row, $entity ), $row, $entity );
		$out['chain'] = $chain_status;
		return $out;
	}

	/**
	 * The pass score a submission must beat: the campaign run's override wins,
	 * then the entity's own setting, then the global option (FR-12). Always
	 * clamped to 0–100.
	 *
	 * @param array<string, mixed>|null $page_row
	 */
	public function effective_pass_score( ?int $run_override, ?array $page_row = null ): int {
		$candidates = [
			$run_override,
			isset( $page_row['pass_score'] ) && null !== $page_row['pass_score'] ? (int) $page_row['pass_score'] : null,
			(int) get_option( 'pukat_quiz_pass_score', self::DEFAULT_PASS_SCORE ),
		];

		foreach ( $candidates as $candidate ) {
			if ( null !== $candidate ) {
				return min( max( (int) $candidate, 0 ), 100 );
			}
		}

		return self::DEFAULT_PASS_SCORE;
	}

	/**
	 * The entity's published quiz page row, or null. Read-only and ungated:
	 * used by the scoring and chain services, whose callers have already
	 * passed their own access checks.
	 *
	 * @return array<string, mixed>|null
	 */
	public function published_row_for_entity( string $entity ): ?array {
		$row = $this->repository->find_for_entity( $entity );
		if ( ! $row || self::STATUS_PUBLISHED !== (string) ( $row['status'] ?? '' ) ) {
			return null;
		}

		return $row;
	}

	/**
	 * The entity's published GoPhish quiz master id, or 0 when there is none.
	 * Mirrors FlagPageService::published_master_id_for_entity().
	 */
	public function published_master_id_for_entity( string $entity ): int {
		$row = $this->published_row_for_entity( $entity );

		return ( $row && ! empty( $row['gophish_master_id'] ) ) ? (int) $row['gophish_master_id'] : 0;
	}

	/**
	 * The template a save targets: the one sent (empty clears it → legacy), or
	 * the one already stored. Zero means "no template" (legacy hand-written).
	 *
	 * @param array<string, mixed>      $params
	 * @param array<string, mixed>|null $existing
	 */
	private function resolve_template_id( array $params, ?array $existing ): int {
		if ( array_key_exists( 'template_id', $params ) ) {
			return ( '' === $params['template_id'] || null === $params['template_id'] ) ? 0 : (int) $params['template_id'];
		}

		return (int) ( $existing['template_id'] ?? 0 );
	}

	/**
	 * Build the stored columns for a template-backed quiz: generate html_body
	 * from the template shell, the placeholder values, and the selected
	 * questions (resolved to the entity's own, in order). Quiz Builder v2.
	 *
	 * @param array<string, mixed>      $params
	 * @param array<string, mixed>|null $existing
	 * @return array<string, mixed>|WP_Error
	 */
	private function build_from_template( int $template_id, array $params, ?array $existing, string $entity ): array|WP_Error {
		$template = $this->templates->find( $template_id );
		if ( ! $template ) {
			return $this->validation_error( __( 'The chosen quiz template no longer exists.', 'pukat' ) );
		}

		$field_values = $this->sanitize_field_values(
			array_key_exists( 'field_values', $params )
				? $params['field_values']
				: json_decode( (string) ( $existing['field_values_json'] ?? '' ), true )
		);

		$selected = array_key_exists( 'selected_question_ids', $params )
			? $params['selected_question_ids']
			: json_decode( (string) ( $existing['selected_question_ids_json'] ?? '' ), true );
		$selected = array_values( array_unique( array_filter( array_map( 'intval', (array) ( is_array( $selected ) ? $selected : [] ) ), static fn ( int $i ): bool => $i > 0 ) ) );

		$questions    = $this->questions->selected_questions( $selected, $entity );
		$resolved_ids = array_map( static fn ( array $q ): int => (int) $q['id'], $questions );

		$html = $this->generator->generate( (string) $template['html_body'], $field_values, $questions );
		if ( strlen( $html ) > self::MAX_HTML_BYTES ) {
			return $this->validation_error( __( 'The generated quiz page is too large.', 'pukat' ) );
		}

		return [
			'template_id'                => $template_id,
			'field_values_json'          => (string) wp_json_encode( $field_values ),
			'selected_question_ids_json' => (string) wp_json_encode( $resolved_ids ),
			'html_body'                  => $html,
		];
	}

	/**
	 * Normalise the placeholder value map: known-shape keys, scalar text
	 * values, length-capped. Values are operator input, so they are sanitised
	 * here and escaped again at generation.
	 *
	 * @param mixed $raw
	 * @return array<string, string>
	 */
	private function sanitize_field_values( $raw ): array {
		if ( is_string( $raw ) ) {
			$raw = json_decode( $raw, true );
		}
		if ( ! is_array( $raw ) ) {
			return [];
		}

		$clean = [];
		foreach ( $raw as $key => $value ) {
			$key = strtolower( (string) $key );
			if ( ! preg_match( '/^[a-z0-9_]{1,40}$/', $key ) || is_array( $value ) ) {
				continue;
			}
			$clean[ $key ] = mb_substr( sanitize_textarea_field( (string) $value ), 0, 5000 );
		}

		return $clean;
	}

	/**
	 * The answer key a row is graded/linted against: a template-backed quiz
	 * uses its own selected questions (Quiz Builder v2); a legacy page uses the
	 * whole active bank (v1).
	 *
	 * @param array<string, mixed>|null $row
	 * @return array<string, array{question_id: int, correct: array<int, string>}>
	 */
	private function answer_key_for_row( ?array $row, string $entity ): array {
		if ( $row && ! empty( $row['template_id'] ) ) {
			$ids  = json_decode( (string) ( $row['selected_question_ids_json'] ?? '' ), true );
			$rows = $this->questions->selected_questions( is_array( $ids ) ? $ids : [], $entity );

			return $this->questions->answer_key_from_rows( $rows );
		}

		return $this->questions->answer_key_for_entity( $entity );
	}

	/**
	 * Fields a save only writes when the client actually sent them.
	 *
	 * @param array<string, mixed> $params
	 * @return array<string, mixed>|WP_Error
	 */
	private function optional_settings( array $params ): array|WP_Error {
		$data = [];

		if ( array_key_exists( 'launch_url', $params ) ) {
			$launch_url = $this->sanitize_launch_url( (string) $params['launch_url'] );
			if ( is_wp_error( $launch_url ) ) {
				return $launch_url;
			}
			$data['launch_url'] = $launch_url;
		}

		if ( array_key_exists( 'thankyou_url', $params ) ) {
			$thankyou_url = $this->sanitize_thankyou_url( (string) $params['thankyou_url'] );
			if ( is_wp_error( $thankyou_url ) ) {
				return $thankyou_url;
			}
			$data['thankyou_url'] = $thankyou_url;
		}

		if ( array_key_exists( 'pass_score', $params ) ) {
			$raw = $params['pass_score'];
			if ( null === $raw || '' === $raw ) {
				$data['pass_score'] = null;
			} else {
				$score = (int) $raw;
				if ( $score < 0 || $score > 100 ) {
					return $this->validation_error( __( 'The pass score must be between 0 and 100.', 'pukat' ) );
				}
				$data['pass_score'] = $score;
			}
		}

		return $data;
	}

	/**
	 * Validate the chosen launch URL against the dynamic domains the current
	 * user may see, restricted to domains typed `quiz` (the type landed with
	 * migration 1.27.0, so the picker and this check agree). Empty clears it.
	 *
	 * @return string|WP_Error
	 */
	private function sanitize_launch_url( string $raw ): string|WP_Error {
		$raw = trim( $raw );
		if ( '' === $raw ) {
			return '';
		}

		$url = esc_url_raw( $raw );
		if ( '' === $url || mb_strlen( $url ) > 500 ) {
			return $this->validation_error( __( 'Invalid launch URL.', 'pukat' ) );
		}

		foreach ( ( new MasterComponentService() )->list_dynamic_domains() as $domain ) {
			if ( 'quiz' !== (string) ( $domain['type'] ?? '' ) ) {
				continue;
			}
			if ( $url === esc_url_raw( (string) ( $domain['base_landing_url'] ?? '' ) ) ) {
				return $url;
			}
		}

		return $this->validation_error( __( 'Choose a launch URL from the available quiz domains.', 'pukat' ) );
	}

	/**
	 * Where a target lands after submitting. Free-form on purpose — it is
	 * typically an internal portal that Pukat never calls itself — so only the
	 * shape is checked: http/https with a host. Empty clears it.
	 *
	 * Deliberately NOT wp_http_validate_url(): that helper resolves the host
	 * through DNS and rejects anything that does not resolve from the server,
	 * which would turn every intranet thank-you page into a validation error.
	 *
	 * @return string|WP_Error
	 */
	private function sanitize_thankyou_url( string $raw ): string|WP_Error {
		$raw = trim( $raw );
		if ( '' === $raw ) {
			return '';
		}

		$url = esc_url_raw( $raw );
		if ( '' === $url || mb_strlen( $url ) > 500 ) {
			return $this->validation_error( __( 'Invalid thank-you URL.', 'pukat' ) );
		}

		$parts = wp_parse_url( $url );
		if ( empty( $parts['host'] ) || ! in_array( strtolower( (string) ( $parts['scheme'] ?? '' ) ), [ 'http', 'https' ], true ) ) {
			return $this->validation_error( __( 'The thank-you URL must be a full http:// or https:// address.', 'pukat' ) );
		}

		return $url;
	}

	/**
	 * Shared gate for save/publish/unpublish: entity resolved from the server
	 * and editable by the current user.
	 *
	 * @param array<string, mixed> $params
	 * @return array{0: string, 1: array<string, mixed>|null}|WP_Error
	 */
	private function writable_context( array $params ): array|WP_Error {
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

		// A quiz id targets a specific quiz and must belong to the entity. No
		// id means the default/legacy quiz (back-compat with the one-per-entity
		// callers) on an existing-row op, or a brand-new quiz on save().
		$id = (int) ( $params['id'] ?? 0 );
		if ( $id > 0 ) {
			$row = $this->entity_quiz( $id, $entity );
			if ( ! $row ) {
				return $this->not_found_error( __( 'Quiz not found.', 'pukat' ) );
			}
			return [ $entity, $row ];
		}

		return [ $entity, $this->repository->find_default_for_entity( $entity ) ];
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
	 * Full page for the editor, including a live linter report so the UI can
	 * show what blocks a publish before the operator tries.
	 *
	 * @param array<string, mixed>|null $row
	 * @return array<string, mixed>
	 */
	private function prepare( ?array $row, string $entity ): array {
		$answer_key = $this->answer_key_for_row( $row, $entity );
		$html       = (string) ( $row['html_body'] ?? '' );

		$base = [
			'entity_name'       => $entity,
			'answer_key_count'  => count( $answer_key ),
			'linter'            => $this->linter->inspect( $html, $answer_key ),
			'effective_pass_score' => $this->effective_pass_score( null, $row ),
		];

		if ( ! $row ) {
			return array_merge( $base, [
				'id'                      => null,
				'title'                   => '',
				'template_id'             => null,
				'field_values'            => [],
				'selected_question_ids'   => [],
				'is_default_followup'     => false,
				'html_body'               => '',
				'status'                  => self::STATUS_DRAFT,
				'has_unpublished_changes' => false,
				'pass_score'              => null,
				'published_pass_score'    => null,
				'launch_url'              => '',
				'thankyou_url'            => '',
				'updated_at'              => null,
				'published_at'            => null,
				'gophish_page_id'         => null,
				'gophish_master_id'       => null,
				'synced_at'               => null,
			] );
		}

		$published = $row['published_html'] ?? null;

		$field_values = json_decode( (string) ( $row['field_values_json'] ?? '' ), true );
		$selected_ids = json_decode( (string) ( $row['selected_question_ids_json'] ?? '' ), true );

		return array_merge( $base, [
			'id'                      => (int) $row['id'],
			'title'                   => (string) $row['title'],
			'template_id'             => empty( $row['template_id'] ) ? null : (int) $row['template_id'],
			'field_values'            => is_array( $field_values ) ? $field_values : [],
			'selected_question_ids'   => is_array( $selected_ids ) ? array_map( 'intval', $selected_ids ) : [],
			'is_default_followup'     => (bool) ( $row['is_default_followup'] ?? false ),
			'html_body'               => $html,
			'status'                  => (string) $row['status'],
			'has_unpublished_changes' => null === $published || $published !== $html,
			'pass_score'              => null === ( $row['pass_score'] ?? null ) ? null : (int) $row['pass_score'],
			'published_pass_score'    => null === ( $row['published_pass_score'] ?? null ) ? null : (int) $row['published_pass_score'],
			'launch_url'              => (string) ( $row['launch_url'] ?? '' ),
			'thankyou_url'            => (string) ( $row['thankyou_url'] ?? '' ),
			'updated_at'              => $row['updated_at'] ?? null,
			'published_at'            => $row['published_at'] ?? null,
			'gophish_page_id'         => empty( $row['gophish_page_id'] ) ? null : (int) $row['gophish_page_id'],
			'gophish_master_id'       => empty( $row['gophish_master_id'] ) ? null : (int) $row['gophish_master_id'],
			'synced_at'               => $row['synced_at'] ?? null,
		] );
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
