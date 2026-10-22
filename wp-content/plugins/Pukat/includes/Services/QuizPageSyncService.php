<?php
/**
 * Sync a published quiz page to GoPhish and keep its quiz master.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use WP_Error;

/**
 * Pushes a published quiz page to GoPhish as a Landing Page object and
 * creates/refreshes the entity's quiz master campaign
 * (docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md Q3, docs/api_campaignnew.md §4.2).
 *
 * Mirrors FlagPageSyncService; the material differences are both deliberate:
 *
 * - `redirect_url` carries the entity's thank-you URL. The education page
 *   leaves it empty because its chain continues via `next_campaign_id`, while
 *   the quiz is the end of the chain and a target would otherwise be left
 *   sitting on the submitted form (PRD §5.5).
 * - the master is `campaign_type=quiz` with `next_campaign_id` left at 0.
 *
 * `capture_credentials` must stay true: with it false GoPhish strips the
 * `name` attribute off every input when saving the page, and no answer is ever
 * captured.
 */
class QuizPageSyncService {

	private GoPhishService $gophish;
	private GoPhishHtmlAssets $assets;

	public function __construct( ?GoPhishService $gophish = null, ?GoPhishHtmlAssets $assets = null ) {
		$this->gophish = $gophish ?? new GoPhishService();
		$this->assets  = $assets ?? new GoPhishHtmlAssets();
	}

	/**
	 * Create or update the entity's quiz landing page in GoPhish from the given
	 * (published) HTML. Reuses the stored page id, else matches by name, else
	 * creates. Returns the GoPhish page id + name.
	 *
	 * @return array{id: int, name: string}|WP_Error
	 */
	public function push( string $html, string $entity, ?int $existing_page_id = null, string $thankyou_url = '', ?int $quiz_id = null ): array|WP_Error {
		$name    = $this->page_name( $entity, $quiz_id );
		$payload = [
			'name'                => $name,
			'html'                => $this->assets->inline_flag_images( $html ),
			// Without this GoPhish drops every input's name attribute on save.
			'capture_credentials' => true,
			'capture_passwords'   => false,
			'redirect_url'        => esc_url_raw( trim( $thankyou_url ) ),
		];

		// Prefer updating the page we already created for this entity. GoPhish's
		// PUT /api/pages/{id} requires the body `id` to match the URL id.
		if ( $existing_page_id ) {
			$updated = $this->gophish->update_landing_page( $existing_page_id, [ 'id' => $existing_page_id ] + $payload );
			if ( ! is_wp_error( $updated ) ) {
				return [ 'id' => $existing_page_id, 'name' => $name ];
			}
			// Fall through to find-by-name/create if the stored page is gone.
		}

		$pages = $this->gophish->get_landing_pages();
		if ( is_wp_error( $pages ) ) {
			return $pages;
		}

		foreach ( $pages as $page ) {
			if ( $name === (string) ( $page['name'] ?? '' ) ) {
				$id      = (int) $page['id'];
				$updated = $this->gophish->update_landing_page( $id, [ 'id' => $id ] + $payload );
				return is_wp_error( $updated ) ? $updated : [ 'id' => $id, 'name' => $name ];
			}
		}

		$created = $this->gophish->create_landing_page( $payload );
		if ( is_wp_error( $created ) ) {
			return $created;
		}

		return [ 'id' => (int) ( $created['id'] ?? 0 ), 'name' => $name ];
	}

	/**
	 * Stable GoPhish page name (GoPhish rejects duplicates). With many quizzes
	 * per entity (Quiz Builder v2) the quiz id disambiguates; the id-less form
	 * is kept for legacy single-quiz callers.
	 */
	public function page_name( string $entity, ?int $quiz_id = null ): string {
		return 'pukat-quiz-' . $this->assets->slug( $entity ) . ( $quiz_id ? '-' . $quiz_id : '' );
	}

	public function master_name( string $entity, ?int $quiz_id = null ): string {
		return 'pukat-quiz-master-' . $this->assets->slug( $entity ) . ( $quiz_id ? '-' . $quiz_id : '' );
	}

	/**
	 * Ensure the entity's GoPhish quiz master exists and return its id.
	 * Idempotent: reuses the stored master id, else matches by name, else
	 * provisions dummy template + smtp (per entity) and creates the master.
	 *
	 * @return array{id: int, name: string}|WP_Error
	 */
	public function ensure_master( string $entity, string $launch_url, ?int $existing_master_id = null ): array|WP_Error {
		$launch_url = esc_url_raw( trim( $launch_url ) );
		if ( '' === $launch_url ) {
			return $this->missing_launch_url();
		}

		$master_name = $this->master_name( $entity );

		if ( $existing_master_id ) {
			$existing = $this->gophish->get_campaign( $existing_master_id );
			if ( ! is_wp_error( $existing ) && (int) ( $existing['id'] ?? 0 ) === $existing_master_id ) {
				return [ 'id' => $existing_master_id, 'name' => $master_name ];
			}
		}

		$campaigns = $this->gophish->get_campaigns( [ 'is_master' => true, 'campaign_type' => 'quiz' ] );
		if ( ! is_wp_error( $campaigns ) ) {
			foreach ( $campaigns as $campaign ) {
				if ( $master_name === (string) ( $campaign['name'] ?? '' ) ) {
					return [ 'id' => (int) $campaign['id'], 'name' => $master_name ];
				}
			}
		}

		return $this->create_master( $entity, $launch_url );
	}

	/**
	 * Delete any existing quiz master for the entity, then create a fresh one so
	 * it snapshots the latest published page (GoPhish freezes page content at
	 * campaign creation — verified in G3 for education). Safe because the quiz
	 * page is locked for edits while a related simulation is active
	 * (QuizPageService::assert_editable()).
	 *
	 * @return array{id: int, name: string}|WP_Error
	 */
	public function recreate_master( string $entity, string $launch_url, ?int $existing_master_id = null, ?int $quiz_id = null ): array|WP_Error {
		$launch_url = esc_url_raw( trim( $launch_url ) );
		if ( '' === $launch_url ) {
			return $this->missing_launch_url();
		}

		$this->delete_existing_master( $entity, $existing_master_id, $quiz_id );

		return $this->create_master( $entity, $launch_url, $quiz_id );
	}

	/**
	 * Campaigns that would currently send somebody to this quiz master and are
	 * not yet Completed. Wider than the education equivalent on purpose: a quiz
	 * is usually reached indirectly, so a simulation chained to the entity's
	 * *education* master — which in turn chains to this quiz master — counts as
	 * an active user of the quiz page too (PRD FR-11).
	 *
	 * @param int $education_master_id The entity's education master, or 0.
	 * @return array<int, array{id: int, name: string, status: string, via: string}>
	 */
	public function active_simulations_for_quiz( int $quiz_master_id, int $education_master_id = 0 ): array {
		if ( $quiz_master_id <= 0 ) {
			return [];
		}

		$campaigns = $this->gophish->get_campaigns();
		if ( is_wp_error( $campaigns ) ) {
			return [];
		}

		// An education master only counts as a route into the quiz while it
		// actually chains to it.
		$education_chains_here = false;
		if ( $education_master_id > 0 ) {
			foreach ( $campaigns as $c ) {
				if ( (int) ( $c['id'] ?? 0 ) === $education_master_id ) {
					$education_chains_here = (int) ( $c['next_campaign_id'] ?? 0 ) === $quiz_master_id;
					break;
				}
			}
		}

		$active = [];
		foreach ( $campaigns as $c ) {
			$id   = (int) ( $c['id'] ?? 0 );
			$next = (int) ( $c['next_campaign_id'] ?? 0 );

			// The masters themselves are permanently "In progress" by design.
			if ( $id === $quiz_master_id || $id === $education_master_id ) {
				continue;
			}
			if ( 'Completed' === (string) ( $c['status'] ?? '' ) ) {
				continue;
			}

			$via = '';
			if ( $next === $quiz_master_id ) {
				$via = 'quiz';
			} elseif ( $education_chains_here && $education_master_id > 0 && $next === $education_master_id ) {
				$via = 'education';
			}
			if ( '' === $via ) {
				continue;
			}

			$active[] = [
				'id'     => $id,
				'name'   => (string) ( $c['name'] ?? '' ),
				'status' => (string) ( $c['status'] ?? '' ),
				'via'    => $via,
			];
		}

		return $active;
	}

	private function delete_existing_master( string $entity, ?int $existing_master_id, ?int $quiz_id = null ): void {
		if ( $existing_master_id ) {
			$this->gophish->delete_campaign( $existing_master_id, true );
		}

		// Clear any same-named master (stale id / orphan) so create() below does
		// not hit GoPhish's duplicate-name rejection.
		$name      = $this->master_name( $entity, $quiz_id );
		$campaigns = $this->gophish->get_campaigns( [ 'is_master' => true, 'campaign_type' => 'quiz' ] );
		if ( ! is_wp_error( $campaigns ) ) {
			foreach ( $campaigns as $c ) {
				if ( $name === (string) ( $c['name'] ?? '' ) && (int) $c['id'] !== (int) $existing_master_id ) {
					$this->gophish->delete_campaign( (int) $c['id'], true );
				}
			}
		}
	}

	/**
	 * Provision dummy template+smtp (reused by name) and create the master.
	 * The caller must ensure no same-named master already exists.
	 *
	 * The dummy assets are enough because the master never sends email: in the
	 * chain GoPhish registers the target itself. Sending a quiz invitation out
	 * of band uses a separate, non-master campaign with real assets instead
	 * (PRD FR-15) — precisely because GoPhish snapshots the template here.
	 *
	 * @return array{id: int, name: string}|WP_Error
	 */
	private function create_master( string $entity, string $launch_url, ?int $quiz_id = null ): array|WP_Error {
		$template = $this->ensure_dummy_template( $entity );
		if ( is_wp_error( $template ) ) {
			return $template;
		}
		$smtp = $this->ensure_dummy_smtp( $entity );
		if ( is_wp_error( $smtp ) ) {
			return $smtp;
		}

		$created = $this->gophish->create_campaign( [
			'name'             => $this->master_name( $entity, $quiz_id ),
			'campaign_type'    => 'quiz',
			'is_master'        => true,
			'entity'           => $entity,
			'url'              => $launch_url,
			'template'         => [ 'name' => $template ],
			'page'             => [ 'name' => $this->page_name( $entity, $quiz_id ) ],
			'smtp'             => [ 'name' => $smtp ],
			// The quiz is the end of the chain.
			'next_campaign_id' => 0,
			// ≤ now → In progress (can receive redirects); still sends no email.
			'launch_date'      => gmdate( 'Y-m-d\TH:i:s+00:00' ),
		] );
		if ( is_wp_error( $created ) ) {
			return $created;
		}

		return [ 'id' => (int) ( $created['id'] ?? 0 ), 'name' => $this->master_name( $entity, $quiz_id ) ];
	}

	/**
	 * Dummy email template for the master (never sent in the chain, but GoPhish
	 * requires one). Reused by name. Returns the template name.
	 *
	 * @return string|WP_Error
	 */
	private function ensure_dummy_template( string $entity ): string|WP_Error {
		$name      = 'pukat-quiz-tmpl-' . $this->assets->slug( $entity );
		$templates = $this->gophish->get_email_templates();
		if ( ! is_wp_error( $templates ) ) {
			foreach ( $templates as $template ) {
				if ( $name === (string) ( $template['name'] ?? '' ) ) {
					return $name;
				}
			}
		}

		$created = $this->gophish->create_email_template( [
			'name'        => $name,
			'subject'     => 'Security Awareness Quiz',
			'html'        => '<html><body>{{.URL}}</body></html>',
			'text'        => '{{.URL}}',
			'attachments' => [],
		] );

		return is_wp_error( $created ) ? $created : $name;
	}

	/**
	 * Dummy sending profile for the master (never sends in the chain, but
	 * GoPhish requires one). Reused by name. Returns the profile name.
	 *
	 * @return string|WP_Error
	 */
	private function ensure_dummy_smtp( string $entity ): string|WP_Error {
		$name     = 'pukat-quiz-smtp-' . $this->assets->slug( $entity );
		$profiles = $this->gophish->get_sending_profiles();
		if ( ! is_wp_error( $profiles ) ) {
			foreach ( $profiles as $profile ) {
				if ( $name === (string) ( $profile['name'] ?? '' ) ) {
					return $name;
				}
			}
		}

		$created = $this->gophish->create_sending_profile( [
			'name'               => $name,
			'interface_type'     => 'SMTP',
			'host'               => 'localhost:25',
			// GoPhish validates this as a bare email address (no display name).
			'from_address'       => 'noreply@example.com',
			'ignore_cert_errors' => true,
			'headers'            => [],
		] );

		return is_wp_error( $created ) ? $created : $name;
	}

	private function missing_launch_url(): WP_Error {
		return new WP_Error( 'validation_error', __( 'A launch URL is required to create the quiz master.', 'pukat' ), [ 'status' => 422 ] );
	}
}
