<?php
/**
 * Quiz question bank REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Repositories\QuizResultRepository;
use Pukat\Services\EntityProfileService;
use Pukat\Services\PermissionRegistry;
use Pukat\Services\QuizInviteService;
use Pukat\Services\QuizQuestionService;
use Pukat\Services\QuizScoringService;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class QuizController
 *
 * The per-entity question bank behind the Quiz Module
 * (docs/PRD_QUIZ_MODULE.md §8). The quiz page itself lives in
 * QuizPageController.
 *
 * Routes:
 *   GET    /pukat/v1/quiz/questions?entity=
 *   POST   /pukat/v1/quiz/questions
 *   PUT    /pukat/v1/quiz/questions/{id}
 *   DELETE /pukat/v1/quiz/questions/{id}
 *   GET    /pukat/v1/quiz/results?entity=&campaign_run_id=
 *   GET    /pukat/v1/quiz/results/{campaign_id}
 *   POST   /pukat/v1/quiz/invite
 *
 * `POST /quiz/submit` was removed with the Quiz Module (PRD §8): the quiz page
 * is served by GoPhish, not Pukat, so answers arrive through campaign results
 * and are graded server-side by QuizScoringService. Nothing called the old
 * route — the frontend's quizApi.submit was exported but never used.
 */
class QuizController extends RestController {

	private QuizQuestionService $questions;
	private QuizInviteService $invites;
	private QuizResultRepository $results;
	private QuizScoringService $scoring;
	private EntityProfileService $access;

	public function __construct(
		?QuizQuestionService $questions = null,
		?QuizInviteService $invites = null,
		?QuizResultRepository $results = null,
		?QuizScoringService $scoring = null,
		?EntityProfileService $access = null
	) {
		$this->questions = $questions ?? new QuizQuestionService();
		$this->invites   = $invites ?? new QuizInviteService();
		$this->results   = $results ?? new QuizResultRepository();
		$this->scoring   = $scoring ?? new QuizScoringService();
		$this->access    = $access ?? new EntityProfileService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/quiz/questions', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_questions' ],
				'permission_callback' => [ $this, 'permission_view_quiz' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_question' ],
				'permission_callback' => [ $this, 'permission_manage_quiz' ],
			],
		] );

		register_rest_route( $this->namespace, '/quiz/questions/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_question' ],
				'permission_callback' => [ $this, 'permission_view_quiz' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_question' ],
				'permission_callback' => [ $this, 'permission_manage_quiz' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_question' ],
				'permission_callback' => [ $this, 'permission_manage_quiz' ],
			],
		] );

		register_rest_route( $this->namespace, '/quiz/results', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'list_results' ],
			'permission_callback' => [ $this, 'permission_view_quiz' ],
		] );

		register_rest_route( $this->namespace, '/quiz/results/(?P<campaign_id>\d+)', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_results' ],
			'permission_callback' => [ $this, 'permission_view_quiz' ],
		] );

		register_rest_route( $this->namespace, '/quiz/invite', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'send_invite' ],
			'permission_callback' => [ $this, 'permission_invite_quiz' ],
		] );
	}

	/**
	 * Phase 3 of docs/IMPLEMENTATION_PLAN_RBAC.md: granular capability checks.
	 * The question bank stays on post_sim.manage/view rather than taking its
	 * own resource, so a role can curate questions without being able to
	 * publish a page to GoPhish — that is what quiz_pages.* gates
	 * (docs/PRD_QUIZ_MODULE.md §8).
	 */
	public function permission_manage_quiz(): bool|WP_Error {
		return $this->require_capability( 'post_sim.manage' );
	}

	public function permission_view_quiz(): bool|WP_Error {
		return $this->require_capability( 'post_sim.view' );
	}

	/** Sending an invitation really sends email, so it has its own key. */
	public function permission_invite_quiz(): bool|WP_Error {
		return $this->require_capability( 'quiz_pages.invite' );
	}

	private function require_capability( string $permission_key ): bool|WP_Error {
		if ( ! is_user_logged_in() ) {
			return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'pukat' ), [ 'status' => 401 ] );
		}
		if ( ! current_user_can( PermissionRegistry::capability_for( $permission_key ) ) ) {
			return new WP_Error( 'rest_forbidden', __( 'Insufficient permissions.', 'pukat' ), [ 'status' => 403 ] );
		}
		return true;
	}

	public function get_questions( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->questions->list( $request->get_params() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function get_question( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->questions->get_one( [ 'id' => (int) $request->get_param( 'id' ) ] );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function create_question( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->questions->create( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result, 201 );
	}

	public function update_question( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->questions->update( (int) $request->get_param( 'id' ), $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	public function delete_question( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->questions->delete( (int) $request->get_param( 'id' ), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result );
	}

	/**
	 * Graded results for one GoPhish campaign: a summary, the per-target rows,
	 * and the per-question breakdown with its own denominator per question
	 * (docs/PRD_QUIZ_MODULE.md FR-16).
	 *
	 * Rows are filtered to the entities the caller may see — the old route
	 * scoped by campaign id alone, which let any viewer read another entity's
	 * results. The stored answer payload is never part of this response.
	 */
	public function get_results( WP_REST_Request $request ): WP_REST_Response {
		$campaign_id = (int) $request->get_param( 'campaign_id' );

		return $this->success(
			[ 'campaign_id' => $campaign_id ] + $this->summarize( $this->results->list_for_campaign( $campaign_id ) )
		);
	}

	/**
	 * Graded results for an entity, or for one Campaign Run. This is the view
	 * the Quiz Module page uses: the per-campaign route above needs a GoPhish
	 * campaign id, which only the monitoring side has to hand.
	 */
	public function list_results( WP_REST_Request $request ): WP_REST_Response {
		$run_id = (int) $request->get_param( 'campaign_run_id' );

		if ( $run_id > 0 ) {
			$rows = $this->results->list_for_run( $run_id );
		} else {
			$entity = $this->target_entity( (string) $request->get_param( 'entity' ) );
			if ( '' === $entity ) {
				return $this->error( 'entity_forbidden', __( 'Your account must be assigned to an entity first.', 'pukat' ), 403 );
			}
			$rows = $this->results->list_for_entity( $entity, (int) ( $request->get_param( 'limit' ) ?: 200 ) );
		}

		return $this->success( $this->summarize( $rows ) );
	}

	/**
	 * Server-side entity: an admin may name one, everyone else gets their own —
	 * the same rule the quiz page and question bank follow.
	 */
	private function target_entity( string $requested ): string {
		if ( $this->access->current_user_can_admin_assets() ) {
			$requested = trim( sanitize_text_field( $requested ) );
			if ( '' !== $requested ) {
				return $requested;
			}
		}

		return trim( $this->access->current_user_entity() );
	}

	/**
	 * Shared shape for both results endpoints: rows filtered to what the caller
	 * may see, a summary, and the per-question breakdown.
	 *
	 * @param array<int, array<string, mixed>> $rows
	 * @return array<string, mixed>
	 */
	private function summarize( array $rows ): array {
		$visible = array_values( array_filter(
			$rows,
			fn ( array $row ): bool => $this->access->current_user_can_view_entity( (string) ( $row['entity_name'] ?? '' ) )
		) );

		$total = count( $visible );

		return [
			'total'        => $total,
			'passed'       => count( array_filter( $visible, static fn ( array $r ): bool => ! empty( $r['passed'] ) ) ),
			'failed'       => count( array_filter( $visible, static fn ( array $r ): bool => empty( $r['passed'] ) ) ),
			'avg_score'    => $total ? (int) round( array_sum( array_column( $visible, 'score' ) ) / $total ) : 0,
			'results'      => $visible,
			'per_question' => $this->scoring->per_question_breakdown( $visible ),
		];
	}

	public function send_invite( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->invites->invite( $request->get_params(), get_current_user_id() );

		return is_wp_error( $result ) ? $this->from_wp_error( $result ) : $this->success( $result, 201 );
	}
}
