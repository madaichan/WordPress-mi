<?php
/**
 * Quiz REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use WP_REST_Request;
use WP_REST_Response;

/**
 * Class QuizController
 *
 * Manages quiz question bank and result submission.
 *
 * Routes:
 *   GET    /pukat/v1/quiz/questions
 *   POST   /pukat/v1/quiz/questions
 *   DELETE /pukat/v1/quiz/questions/{id}
 *   POST   /pukat/v1/quiz/submit
 *   GET    /pukat/v1/quiz/results/{campaign_id}
 */
class QuizController extends RestController {

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/quiz/questions', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_questions' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_question' ],
				'permission_callback' => [ $this, 'permission_manage' ],
			],
		] );

		register_rest_route( $this->namespace, '/quiz/questions/(?P<id>\d+)', [
			'methods'             => 'DELETE',
			'callback'            => [ $this, 'delete_question' ],
			'permission_callback' => [ $this, 'permission_manage' ],
		] );

		register_rest_route( $this->namespace, '/quiz/submit', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'submit_quiz' ],
			'permission_callback' => '__return_true', // Accessible by targets via email link.
		] );

		register_rest_route( $this->namespace, '/quiz/results/(?P<campaign_id>\d+)', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'get_results' ],
			'permission_callback' => [ $this, 'permission_read' ],
		] );
	}

	public function get_questions( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$questions = $wpdb->get_results(
			"SELECT * FROM {$wpdb->prefix}pukat_quiz_questions ORDER BY created_at DESC",
			ARRAY_A
		);
		return $this->success( $questions ?: [] );
	}

	public function create_question( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$question    = sanitize_textarea_field( (string) $request->get_param( 'question' ) );
		$options     = $request->get_param( 'options' );
		$explanation = sanitize_textarea_field( (string) $request->get_param( 'explanation' ) );
		$difficulty  = min( max( (int) $request->get_param( 'difficulty' ), 1 ), 5 );

		if ( empty( $question ) || empty( $options ) ) {
			return $this->error( 'validation_error', __( 'Question and options are required.', 'pukat' ), 422 );
		}

		$wpdb->insert( $wpdb->prefix . 'pukat_quiz_questions', [
			'question'    => $question,
			'options'     => wp_json_encode( $options ),
			'explanation' => $explanation,
			'difficulty'  => $difficulty,
			'created_by'  => get_current_user_id(),
		] );

		return $this->success( [ 'id' => $wpdb->insert_id ], 201 );
	}

	public function delete_question( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$wpdb->delete( $wpdb->prefix . 'pukat_quiz_questions', [ 'id' => (int) $request->get_param( 'id' ) ] );
		return $this->success( [ 'deleted' => true ] );
	}

	public function submit_quiz( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;

		$campaign_id = (int) $request->get_param( 'campaign_id' );
		$email       = sanitize_email( (string) $request->get_param( 'email' ) );
		$answers     = (array) $request->get_param( 'answers' );

		if ( ! $campaign_id || ! is_email( $email ) || empty( $answers ) ) {
			return $this->error( 'validation_error', __( 'Campaign ID, valid email, and answers are required.', 'pukat' ), 422 );
		}

		// Score the quiz.
		$questions = $wpdb->get_results(
			"SELECT id, options FROM {$wpdb->prefix}pukat_quiz_questions",
			ARRAY_A
		);

		$correct = 0;
		$total   = count( $questions );

		foreach ( $questions as $q ) {
			$q_id     = (int) $q['id'];
			$options  = json_decode( $q['options'], true );
			$given    = $answers[ $q_id ] ?? null;

			foreach ( $options as $option ) {
				if ( ( $option['correct'] ?? false ) && $option['value'] === $given ) {
					$correct++;
					break;
				}
			}
		}

		$score       = $total > 0 ? (int) round( ( $correct / $total ) * 100 ) : 0;
		$pass_score  = (int) get_option( 'pukat_quiz_pass_score', 70 );
		$passed      = $score >= $pass_score;

		$user        = get_user_by( 'email', $email );

		$wpdb->insert( $wpdb->prefix . 'pukat_quiz_results', [
			'campaign_id'  => $campaign_id,
			'user_id'      => $user ? $user->ID : 0,
			'target_email' => $email,
			'score'        => $score,
			'passed'       => $passed ? 1 : 0,
			'answers'      => wp_json_encode( $answers ),
			'completed_at' => current_time( 'mysql' ),
		] );

		if ( ! $passed ) {
			do_action( 'pukat_quiz_failed', $email, $campaign_id, $score );
		}

		return $this->success( [
			'score'      => $score,
			'passed'     => $passed,
			'pass_score' => $pass_score,
			'correct'    => $correct,
			'total'      => $total,
		] );
	}

	public function get_results( WP_REST_Request $request ): WP_REST_Response {
		global $wpdb;
		$campaign_id = (int) $request->get_param( 'campaign_id' );

		$results = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$wpdb->prefix}pukat_quiz_results WHERE campaign_id = %d ORDER BY created_at DESC",
				$campaign_id
			),
			ARRAY_A
		);

		$summary = [
			'total'     => count( $results ),
			'passed'    => count( array_filter( $results, fn( $r ) => $r['passed'] ) ),
			'failed'    => count( array_filter( $results, fn( $r ) => ! $r['passed'] ) ),
			'avg_score' => $results ? (int) round( array_sum( array_column( $results, 'score' ) ) / count( $results ) ) : 0,
			'results'   => $results,
		];

		return $this->success( $summary );
	}
}
