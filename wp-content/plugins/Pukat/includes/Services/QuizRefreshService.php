<?php
/**
 * On-demand refresh of quiz answers, owned by the quiz module.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\CampaignRunRepository;

/**
 * Pulls the newest quiz answers straight from GoPhish when someone opens the
 * Quiz Dashboard, so the page is not limited to whatever the monitoring cron
 * last happened to fetch.
 *
 * Deliberately NOT CampaignRunService::sync_results_for_run(). That method is
 * monitoring's: besides fetching results it rewrites `metrics_json`, updates
 * the run's status, and — the real problem — deletes and re-inserts the run's
 * risk scores, a table with no unique key. Two of those running at once can
 * leave duplicated or momentarily missing risk rows. So this service touches
 * exactly one table, `pukat_quiz_results`, which IS protected by
 * UNIQUE (campaign_run_id, gophish_rid): concurrent refreshes can at worst
 * lose a race on one arrival, which the next refresh grades.
 *
 * Participation is therefore computed in memory and returned, never written —
 * `metrics_json` stays monitoring's to own.
 */
class QuizRefreshService {

	/**
	 * Seconds one entity's refresh result is considered fresh enough.
	 *
	 * Without this, every open of the dashboard — and every impatient click —
	 * would be N GoPhish calls. The window is a throttle, not a mutex: two
	 * genuinely simultaneous first clicks can both get through, which costs one
	 * extra round of calls and cannot corrupt anything, since grading is
	 * idempotent. A real mutex would need GET_LOCK()/add_option(); that is not
	 * worth it to save a handful of requests.
	 */
	public const THROTTLE_SECONDS = 45;

	/** Most runs polled in one refresh, newest first. */
	public const MAX_RUNS = 10;

	private GoPhishService $gophish;
	private CampaignRunRepository $runs;
	private QuizScoringService $scoring;

	public function __construct(
		?GoPhishService $gophish = null,
		?CampaignRunRepository $runs = null,
		?QuizScoringService $scoring = null
	) {
		$this->gophish = $gophish ?? new GoPhishService();
		$this->runs    = $runs ?? new CampaignRunRepository();
		$this->scoring = $scoring ?? new QuizScoringService();
	}

	/**
	 * Refresh one entity's quiz answers.
	 *
	 * Only runs still in flight are polled — the same statuses the results cron
	 * treats as candidates. A finished run cannot gain new answers, so its
	 * numbers keep coming from the snapshot the cron already finalised, and a
	 * refresh never spends a request on it.
	 *
	 * A GoPhish failure never fails the refresh: it comes back as a warning and
	 * the dashboard falls back to stored data for that run, which is the whole
	 * point of not reading GoPhish live on every page render.
	 *
	 * @return array{
	 *     refreshed: bool, refreshed_at: string, throttled: bool, retry_in: int,
	 *     polled: int, graded: int, reach: array<int, array{reached: int, completed: int}>,
	 *     warnings: array<int, string>
	 * }
	 */
	public function refresh_entity( string $entity ): array {
		$entity = trim( $entity );
		$empty  = [
			'refreshed'    => false,
			'refreshed_at' => '',
			'throttled'    => false,
			'retry_in'     => 0,
			'polled'       => 0,
			'graded'       => 0,
			'reach'        => [],
			'warnings'     => [],
		];

		if ( '' === $entity ) {
			return $empty;
		}

		$key  = 'pukat_quiz_refresh_' . md5( strtolower( $entity ) );
		$last = get_transient( $key );
		if ( is_array( $last ) ) {
			$age = max( 0, time() - (int) ( $last['at'] ?? 0 ) );

			return array_merge( $empty, [
				'refreshed_at' => (string) ( $last['refreshed_at'] ?? '' ),
				'throttled'    => true,
				'retry_in'     => max( 0, self::THROTTLE_SECONDS - $age ),
				'reach'        => (array) ( $last['reach'] ?? [] ),
				'warnings'     => (array) ( $last['warnings'] ?? [] ),
			] );
		}

		$polled   = 0;
		$graded   = 0;
		$reach    = [];
		$warnings = [];

		foreach ( $this->runs->quiz_runs_to_poll( $entity, self::MAX_RUNS ) as $run ) {
			$campaign_id = (int) $run['gophish_campaign_id'];
			$results     = $this->gophish->get_campaign_results( $campaign_id );

			if ( is_wp_error( $results ) ) {
				$warnings[] = sprintf(
					/* translators: 1: campaign run name, 2: error message. */
					__( '%1$s could not be refreshed: %2$s', 'pukat' ),
					(string) $run['name'],
					$results->get_error_message()
				);
				continue;
			}

			++$polled;

			$outcome = $this->scoring->record_from_results( $results, [
				'entity'              => $entity,
				'campaign_run_id'     => (int) $run['id'],
				'gophish_campaign_id' => $campaign_id,
				'pass_score_override' => $run['pass_score'],
			] );
			$graded += (int) ( $outcome['graded'] ?? 0 );

			$reach[ (int) $run['id'] ] = $this->reach_from_results( $results );
		}

		$refreshed_at = current_time( 'mysql', true );
		set_transient(
			$key,
			[ 'at' => time(), 'refreshed_at' => $refreshed_at, 'reach' => $reach, 'warnings' => $warnings ],
			self::THROTTLE_SECONDS
		);

		return [
			'refreshed'    => true,
			'refreshed_at' => $refreshed_at,
			'throttled'    => false,
			'retry_in'     => 0,
			'polled'       => $polled,
			'graded'       => $graded,
			'reach'        => $reach,
			'warnings'     => $warnings,
		];
	}

	/**
	 * How many targets in one campaign's results were redirected into the quiz
	 * chain, and how many finished the quiz.
	 *
	 * Counted exactly the way CampaignRunService::aggregate_result_stats()
	 * counts `submitted_data` and `quiz_completed` — reach off the target's
	 * GoPhish `status`, completion off a quiz event in the target's own events,
	 * which GoPhish groups by email. Any other definition would make the
	 * participation number jump whenever a refresh replaced a stored snapshot.
	 *
	 * @param array<string, mixed> $results GoPhish campaign results.
	 * @return array{reached: int, completed: int}
	 */
	private function reach_from_results( array $results ): array {
		$by_email = [];
		foreach ( (array) ( $results['timeline'] ?? [] ) as $event ) {
			if ( ! is_array( $event ) ) {
				continue;
			}
			$email = strtolower( trim( (string) ( $event['email'] ?? '' ) ) );
			if ( '' !== $email ) {
				$by_email[ $email ][] = $event;
			}
		}

		$reached   = 0;
		$completed = 0;

		foreach ( (array) ( $results['results'] ?? [] ) as $target ) {
			if ( ! is_array( $target ) ) {
				continue;
			}

			if ( 'Submitted Data' === sanitize_text_field( (string) ( $target['status'] ?? '' ) ) ) {
				++$reached;
			}

			$email  = strtolower( trim( (string) ( $target['email'] ?? '' ) ) );
			$events = $by_email[ $email ] ?? (array) ( $target['timeline'] ?? [] );
			foreach ( $events as $event ) {
				if ( is_array( $event ) && QuizEventTypes::QUIZ === (string) ( $event['message'] ?? '' ) ) {
					++$completed;
					break;
				}
			}
		}

		return [ 'reached' => $reached, 'completed' => $completed ];
	}
}
