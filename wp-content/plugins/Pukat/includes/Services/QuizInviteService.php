<?php
/**
 * Send the quiz to chosen people outside the redirect chain.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\EntityProfileRepository;
use Pukat\Repositories\QuizPageRepository;
use WP_Error;

/**
 * Pattern B of docs/api_campaignnew.md §4.3 — reaching the people the chain
 * never reaches, typically those who did not fall for the simulation at all.
 *
 * It deliberately does NOT add recipients to the quiz master. GoPhish
 * snapshots the email template into a campaign when the campaign is created,
 * and the master is created with a dummy template because it never sends mail
 * in the chain — so `add_recipients(send_email=true)` on the master would post
 * out the dummy. Swapping the master's assets means recreating it, which the
 * edit lock blocks while a simulation is live. So an invitation is its own
 * ordinary (non-master) quiz campaign, created on demand with the real
 * template and sending profile the operator picks, pointing at the same quiz
 * landing page (docs/PRD_QUIZ_MODULE.md FR-15).
 *
 * Results from that campaign are graded by the same QuizScoringService; its
 * rows simply carry no campaign_run_id.
 */
class QuizInviteService {

	/** One invitation sends real email, so the batch is bounded. */
	private const MAX_TARGETS = 200;

	private QuizPageRepository $pages;
	private EntityProfileService $access;
	private QuizPageSyncService $sync;
	private GoPhishService $gophish;

	public function __construct(
		?QuizPageRepository $pages = null,
		?EntityProfileService $access = null,
		?QuizPageSyncService $sync = null,
		?GoPhishService $gophish = null
	) {
		$this->pages   = $pages ?? new QuizPageRepository();
		$this->access  = $access ?? new EntityProfileService();
		$this->sync    = $sync ?? new QuizPageSyncService();
		$this->gophish = $gophish ?? new GoPhishService();
	}

	/**
	 * @param array<string, mixed> $params targets, template_name, smtp_name, entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function invite( array $params, int $user_id ): array|WP_Error {
		$entity = $this->target_entity( $params );
		if ( '' === $entity ) {
			return $this->error( 'entity_forbidden', __( 'Your account must be assigned to an entity first.', 'pukat' ), 403 );
		}

		$edit_error = $this->access->enforce_entity_editable( $entity );
		if ( $edit_error ) {
			return $edit_error;
		}

		// Which quiz to send: an explicit quiz_id (must belong to the entity),
		// else the entity's default-followup quiz (Quiz Builder v2).
		$quiz_id = (int) ( $params['quiz_id'] ?? 0 );
		if ( $quiz_id > 0 ) {
			$page = $this->pages->find( $quiz_id );
			if ( ! $page || 0 !== strcasecmp( (string) ( $page['entity_name'] ?? '' ), $entity ) ) {
				return $this->error( 'not_found', __( 'Quiz not found.', 'pukat' ), 404 );
			}
		} else {
			$page = $this->pages->find_default_for_entity( $entity );
		}
		if ( ! $page || 'published' !== (string) ( $page['status'] ?? '' ) ) {
			return $this->error( 'validation_error', __( 'Publish the quiz page before sending invitations.', 'pukat' ), 422 );
		}
		if ( empty( $page['gophish_page_id'] ) ) {
			return $this->error( 'validation_error', __( 'Sync the quiz page to GoPhish before sending invitations.', 'pukat' ), 422 );
		}
		$launch_url = trim( (string) ( $page['launch_url'] ?? '' ) );
		if ( '' === $launch_url ) {
			return $this->error( 'validation_error', __( 'Choose a Launch URL on the quiz page before sending invitations.', 'pukat' ), 422 );
		}

		$targets = $this->sanitize_targets( $params['targets'] ?? [], $entity );
		if ( is_wp_error( $targets ) ) {
			return $targets;
		}

		$template = $this->resolve_asset_name( (string) ( $params['template_name'] ?? '' ), $this->gophish->get_email_templates(), __( 'email template', 'pukat' ) );
		if ( is_wp_error( $template ) ) {
			return $template;
		}
		$smtp = $this->resolve_asset_name( (string) ( $params['smtp_name'] ?? '' ), $this->gophish->get_sending_profiles(), __( 'sending profile', 'pukat' ) );
		if ( is_wp_error( $smtp ) ) {
			return $smtp;
		}

		$stamp      = gmdate( 'Ymd-His' );
		$slug       = sanitize_title( $entity );
		$group_name = 'pukat-quiz-invite-' . $slug . '-' . $stamp;

		$group = $this->gophish->create_group( [ 'name' => $group_name, 'targets' => $targets ] );
		if ( is_wp_error( $group ) ) {
			return $group;
		}

		$campaign = $this->gophish->create_campaign( [
			'name'          => 'pukat-quiz-invite-' . $slug . '-' . $stamp,
			'campaign_type' => 'quiz',
			// Not a master: this one really sends email, from assets the
			// operator chose, and it is finished once everyone has answered.
			'is_master'     => false,
			'entity'        => $entity,
			'url'           => $launch_url,
			'template'      => [ 'name' => $template ],
			'page'          => [ 'name' => $this->sync->page_name( $entity, (int) $page['id'] ) ],
			'smtp'          => [ 'name' => $smtp ],
			'groups'        => [ [ 'name' => $group_name ] ],
			'launch_date'   => gmdate( 'Y-m-d\TH:i:s+00:00' ),
		] );
		if ( is_wp_error( $campaign ) ) {
			// Don't leave an orphan group behind when the campaign is refused.
			$this->gophish->delete_group( (int) ( $group['id'] ?? 0 ) );
			return $campaign;
		}

		AuditLogService::log(
			'quiz.invited',
			[
				'entity_name'         => $entity,
				'quiz_page_id'        => (int) $page['id'],
				'gophish_campaign_id' => (int) ( $campaign['id'] ?? 0 ),
				'recipients'          => count( $targets ),
				'template_name'       => $template,
				'smtp_name'           => $smtp,
			],
			$user_id,
			'quiz_page',
			(int) $page['id']
		);

		return [
			'entity_name'         => $entity,
			'quiz_page_id'        => (int) $page['id'],
			'gophish_campaign_id' => (int) ( $campaign['id'] ?? 0 ),
			'campaign_name'       => 'pukat-quiz-invite-' . $slug . '-' . $stamp,
			'recipients'          => count( $targets ),
		];
	}

	/**
	 * Validate the recipient list: real addresses, a bounded batch, and inside
	 * the entity's email-domain allow-list. Unlike a campaign launch there is
	 * no bypass — an invitation is an ad-hoc send, so the guardrail
	 * (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §11/§16) always applies.
	 *
	 * @param mixed $raw
	 * @return array<int, array<string, string>>|WP_Error
	 */
	private function sanitize_targets( mixed $raw, string $entity ): array|WP_Error {
		if ( ! is_array( $raw ) || ! $raw ) {
			return $this->error( 'validation_error', __( 'Choose at least one recipient.', 'pukat' ), 422 );
		}
		if ( count( $raw ) > self::MAX_TARGETS ) {
			return $this->error(
				'validation_error',
				sprintf(
					/* translators: %d: maximum recipients per invitation. */
					__( 'An invitation can go to at most %d people at a time.', 'pukat' ),
					self::MAX_TARGETS
				),
				422
			);
		}

		$allowed = array_map( 'strtolower', ( new EntityProfileRepository() )->active_email_domains( $entity ) );
		if ( EntityProfileService::email_domain_guardrail_required() && ! $allowed ) {
			return $this->error(
				'entity_email_domains_missing',
				sprintf(
					/* translators: %s: entity name. */
					__( 'Entity "%s" has no active company email domain, so invitations cannot be sent. Add one in My Profile → Guardrails first.', 'pukat' ),
					$entity
				),
				422
			);
		}

		$targets  = [];
		$seen     = [];
		$rejected = [];

		foreach ( $raw as $row ) {
			$email = sanitize_email( (string) ( is_array( $row ) ? ( $row['email'] ?? '' ) : $row ) );
			if ( ! is_email( $email ) ) {
				$rejected[] = [ 'email' => (string) ( is_array( $row ) ? ( $row['email'] ?? '' ) : $row ), 'reason' => 'invalid_email' ];
				continue;
			}

			$key = strtolower( $email );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;

			if ( $allowed ) {
				$domain = strtolower( (string) substr( strrchr( $email, '@' ), 1 ) );
				if ( ! in_array( $domain, $allowed, true ) ) {
					$rejected[] = [ 'email' => $email, 'reason' => 'domain_not_allowed' ];
					continue;
				}
			}

			$targets[] = [
				'email'      => $email,
				'first_name' => sanitize_text_field( (string) ( is_array( $row ) ? ( $row['first_name'] ?? '' ) : '' ) ),
				'last_name'  => sanitize_text_field( (string) ( is_array( $row ) ? ( $row['last_name'] ?? '' ) : '' ) ),
				'position'   => sanitize_text_field( (string) ( is_array( $row ) ? ( $row['position'] ?? '' ) : '' ) ),
			];
		}

		if ( $rejected ) {
			return new WP_Error(
				'validation_error',
				__( 'Some recipients are not allowed for this entity.', 'pukat' ),
				[ 'status' => 422, 'details' => $rejected ]
			);
		}
		if ( ! $targets ) {
			return $this->error( 'validation_error', __( 'Choose at least one recipient.', 'pukat' ), 422 );
		}

		return $targets;
	}

	/**
	 * Accept only a GoPhish asset that actually exists, and never one of
	 * Pukat's own dummy chain assets — those exist purely to satisfy GoPhish's
	 * "a campaign needs a template" rule and would send an empty email.
	 *
	 * Note: this checks existence, not which entity may use which asset. Who
	 * owns which GoPhish asset is a Master Library question and is out of scope
	 * for v1 (docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md Q5).
	 *
	 * @param array<int, array<string, mixed>>|WP_Error $available
	 * @return string|WP_Error
	 */
	private function resolve_asset_name( string $name, array|WP_Error $available, string $label ): string|WP_Error {
		$name = trim( $name );
		if ( '' === $name ) {
			return $this->error(
				'validation_error',
				sprintf(
					/* translators: %s: asset kind, e.g. "email template". */
					__( 'Choose an %s for the invitation.', 'pukat' ),
					$label
				),
				422
			);
		}
		if ( is_wp_error( $available ) ) {
			return $available;
		}

		if ( str_starts_with( $name, 'pukat-quiz-tmpl-' ) || str_starts_with( $name, 'pukat-quiz-smtp-' )
			|| str_starts_with( $name, 'pukat-edu-tmpl-' ) || str_starts_with( $name, 'pukat-edu-smtp-' ) ) {
			return $this->error(
				'validation_error',
				__( 'That is one of Pukat\'s placeholder chain assets — pick a real template and sending profile for an invitation.', 'pukat' ),
				422
			);
		}

		foreach ( $available as $asset ) {
			if ( $name === (string) ( $asset['name'] ?? '' ) ) {
				return $name;
			}
		}

		return $this->error(
			'validation_error',
			sprintf(
				/* translators: %s: asset kind, e.g. "email template". */
				__( 'That %s was not found in GoPhish.', 'pukat' ),
				$label
			),
			422
		);
	}

	/**
	 * Server-side entity: always the user's own for non-admins; an admin may
	 * target an entity via `entity`. Identical to QuizPageService.
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

	private function error( string $code, string $message, int $status ): WP_Error {
		return new WP_Error( $code, $message, [ 'status' => $status ] );
	}
}
