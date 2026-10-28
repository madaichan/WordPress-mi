<?php
/**
 * The GoPhish redirect chain simulation → education → quiz.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\FlagPageRepository;
use Pukat\Repositories\QuizPageRepository;

/**
 * Keeps `next_campaign_id` honest across the chain
 * (docs/api_campaignnew.md §3.1.1, docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md Q4).
 *
 * This exists because **both** masters are recreated — with a new id — every
 * time their page is published (FR-12 of the education PRD, FR-7 here). A link
 * set once therefore goes stale silently: the campaign still runs, the chain
 * just stops leading anywhere. So the link is re-established on every publish,
 * from both sides:
 *
 * - publishing the quiz page points the entity's education master at the new
 *   quiz master;
 * - publishing the education page points the new education master at the
 *   existing quiz master.
 *
 * Reads the two pages through their repositories rather than their services on
 * purpose: FlagPageService and QuizPageService both call into this class, and
 * going back through them would build a construction cycle.
 */
class QuizChainService {

	private FlagPageRepository $flag_pages;
	private QuizPageRepository $quiz_pages;
	private GoPhishService $gophish;

	public function __construct(
		?FlagPageRepository $flag_pages = null,
		?QuizPageRepository $quiz_pages = null,
		?GoPhishService $gophish = null
	) {
		$this->flag_pages = $flag_pages ?? new FlagPageRepository();
		$this->quiz_pages = $quiz_pages ?? new QuizPageRepository();
		$this->gophish    = $gophish ?? new GoPhishService();
	}

	/**
	 * Point the entity's education master at its quiz master. A no-op (ok, with
	 * a message) when either side has no published master — that is the normal
	 * state for an entity that only uses one of the two pages, not an error.
	 *
	 * @return array{ok: bool, linked: bool, message: string, education_master_id?: int, quiz_master_id?: int}
	 */
	public function link_education_to_quiz( string $entity, int $user_id = 0 ): array {
		$education_id = $this->published_master_id( $this->flag_pages->find_for_entity( $entity ) );
		$quiz_id      = $this->published_master_id( $this->quiz_pages->find_for_entity( $entity ) );

		if ( $education_id <= 0 || $quiz_id <= 0 ) {
			return [
				'ok'      => true,
				'linked'  => false,
				'message' => __( 'No education → quiz chain to set: this entity has only one of the two pages published.', 'pukat' ),
			];
		}

		$result = $this->gophish->set_next_campaign( $education_id, $quiz_id );
		if ( is_wp_error( $result ) ) {
			return [
				'ok'                  => false,
				'linked'              => false,
				'message'             => $result->get_error_message(),
				'education_master_id' => $education_id,
				'quiz_master_id'      => $quiz_id,
			];
		}

		AuditLogService::log(
			'quiz_page.chain_linked',
			[ 'entity_name' => $entity, 'education_master_id' => $education_id, 'quiz_master_id' => $quiz_id ],
			$user_id,
			'quiz_page',
			$quiz_id
		);

		return [
			'ok'                  => true,
			'linked'              => true,
			'message'             => __( 'Education now continues to the quiz.', 'pukat' ),
			'education_master_id' => $education_id,
			'quiz_master_id'      => $quiz_id,
		];
	}

	/**
	 * Drop the education → quiz link, used when the quiz page is unpublished so
	 * education does not redirect targets to a master that is about to go away.
	 *
	 * @return array{ok: bool, linked: bool, message: string}
	 */
	public function unlink_education_from_quiz( string $entity, int $user_id = 0 ): array {
		$education_row = $this->flag_pages->find_for_entity( $entity );
		$education_id  = $this->published_master_id( $education_row );
		$quiz_id       = $this->published_master_id( $this->quiz_pages->find_for_entity( $entity ) );

		if ( $education_id <= 0 ) {
			return [ 'ok' => true, 'linked' => false, 'message' => __( 'No education master to unlink.', 'pukat' ) ];
		}

		// Only clear a link that actually points at this entity's quiz master —
		// never stomp on a chain somebody else set up.
		$current = $this->gophish->get_campaign( $education_id );
		if ( is_wp_error( $current ) ) {
			return [ 'ok' => false, 'linked' => false, 'message' => $current->get_error_message() ];
		}
		$next = (int) ( $current['next_campaign_id'] ?? 0 );
		if ( 0 === $next || ( $quiz_id > 0 && $next !== $quiz_id ) ) {
			return [ 'ok' => true, 'linked' => false, 'message' => __( 'The education master does not point at this quiz.', 'pukat' ) ];
		}

		$result = $this->gophish->set_next_campaign( $education_id, 0 );
		if ( is_wp_error( $result ) ) {
			return [ 'ok' => false, 'linked' => false, 'message' => $result->get_error_message() ];
		}

		AuditLogService::log(
			'quiz_page.chain_unlinked',
			[ 'entity_name' => $entity, 'education_master_id' => $education_id ],
			$user_id,
			'quiz_page',
			$education_id
		);

		return [ 'ok' => true, 'linked' => false, 'message' => __( 'Education no longer continues to the quiz.', 'pukat' ) ];
	}

	/**
	 * Which master a launching simulation should chain to, given the run's
	 * follow-up choices (PRD FR-13). Education wins when both are on, because
	 * the quiz then sits behind education in the chain. Quiz without education
	 * is a supported shape: the simulation points straight at the quiz master.
	 *
	 * Never throws and never blocks a launch — an unavailable master comes back
	 * as `ok: false` with a message for the UI to surface.
	 *
	 * @return array{stage: string, campaign_id: int, ok: bool, message: string}
	 */
	public function resolve_simulation_target( string $entity, bool $education_enabled, bool $quiz_enabled ): array {
		if ( ! $education_enabled && ! $quiz_enabled ) {
			return [ 'stage' => 'none', 'campaign_id' => 0, 'ok' => true, 'message' => '' ];
		}

		$education_id = $this->published_master_id( $this->flag_pages->find_for_entity( $entity ) );
		$quiz_id      = $this->published_master_id( $this->quiz_pages->find_for_entity( $entity ) );

		if ( $education_enabled ) {
			if ( $education_id > 0 ) {
				return [ 'stage' => 'education', 'campaign_id' => $education_id, 'ok' => true, 'message' => '' ];
			}

			return [
				'stage'       => 'education',
				'campaign_id' => 0,
				'ok'          => false,
				'message'     => sprintf(
					/* translators: %s: entity name. */
					__( 'Entity "%s" has no published education page synced to GoPhish, so education follow-up was skipped. Publish its Flag education page, then re-launch or re-link.', 'pukat' ),
					$entity
				),
			];
		}

		if ( $quiz_id > 0 ) {
			return [ 'stage' => 'quiz', 'campaign_id' => $quiz_id, 'ok' => true, 'message' => '' ];
		}

		return [
			'stage'       => 'quiz',
			'campaign_id' => 0,
			'ok'          => false,
			'message'     => sprintf(
				/* translators: %s: entity name. */
				__( 'Entity "%s" has no published quiz page synced to GoPhish, so quiz follow-up was skipped. Publish its quiz page, then re-launch or re-link.', 'pukat' ),
				$entity
			),
		];
	}

	/**
	 * A page row's GoPhish master id, but only while the page is published.
	 *
	 * @param array<string, mixed>|null $row
	 */
	private function published_master_id( ?array $row ): int {
		if ( ! $row || 'published' !== (string) ( $row['status'] ?? '' ) ) {
			return 0;
		}

		return empty( $row['gophish_master_id'] ) ? 0 : (int) $row['gophish_master_id'];
	}
}
