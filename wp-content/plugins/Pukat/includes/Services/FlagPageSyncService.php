<?php
/**
 * Sync a published Flag education page to its GoPhish education master.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use WP_Error;

/**
 * Pushes a published Education Page to GoPhish as a Landing Page object
 * (docs/PRD_FLAG_EDUCATION_PAGES.md §11, G2). Every image inserted from the
 * Flag gallery carries a `data-pukat-img="{id}"` identity on its <figure> and
 * a plain URL in the draft (FR-6b); on sync that URL is replaced with a base64
 * data URI so the page renders without reaching back to WordPress, and the
 * identity attribute is dropped.
 *
 * Only the GoPhish *Page* is synced here — it needs no phish `url`. The
 * education *master campaign* (which does need a url) is created later when the
 * page is linked to a simulation (G3).
 */
class FlagPageSyncService {

	private FlagExampleService $examples;
	private GoPhishService $gophish;

	public function __construct( ?FlagExampleService $examples = null, ?GoPhishService $gophish = null ) {
		$this->examples = $examples ?? new FlagExampleService();
		$this->gophish  = $gophish ?? new GoPhishService();
	}

	/**
	 * Create or update the entity's education landing page in GoPhish from the
	 * given (published) HTML. Reuses the stored page id, else matches by name,
	 * else creates. Returns the GoPhish page id + name.
	 *
	 * @return array{id: int, name: string}|WP_Error
	 */
	public function push( string $html, string $entity, ?int $existing_page_id = null ): array|WP_Error {
		$name    = $this->page_name( $entity );
		$payload = [
			'name'                => $name,
			'html'                => $this->inline_flag_images( $html ),
			// Capture the education form's answers (answer_1/2/3, lang, ...).
			'capture_credentials' => true,
			'capture_passwords'   => false,
			// Redirect chaining uses next_campaign_id on the campaign, not this.
			'redirect_url'        => '',
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
	 * Stable, unique-per-entity GoPhish page name (GoPhish rejects duplicates).
	 */
	public function page_name( string $entity ): string {
		return 'pukat-edu-' . $this->slug( $entity );
	}

	/**
	 * Ensure the entity's GoPhish education master campaign exists and return
	 * its id (docs/api_campaignnew.md §2.3/§3). Idempotent: reuses the stored
	 * master id, else matches by name, else provisions dummy template + smtp
	 * (per entity) and creates the master referencing the already-synced
	 * landing page `pukat-edu-<entity>`.
	 *
	 * The master is `campaign_type=education`, `is_master=true`, `url` set to
	 * the chosen launch domain, and `launch_date` ≤ now so it is In progress
	 * (required to receive redirects). It sends no email in the chain.
	 *
	 * NOTE: GoPhish snapshots the page/template into the campaign at creation,
	 * so an already-created master does not pick up later page edits — that is
	 * a known limitation (would need recreating the master).
	 *
	 * @param int|null $existing_master_id Stored master id to reuse if valid.
	 * @return array{id: int, name: string}|WP_Error
	 */
	public function ensure_master( string $entity, string $launch_url, ?int $existing_master_id = null ): array|WP_Error {
		$launch_url = esc_url_raw( trim( $launch_url ) );
		if ( '' === $launch_url ) {
			return new WP_Error( 'validation_error', __( 'A launch URL is required to create the education master.', 'pukat' ), [ 'status' => 422 ] );
		}

		$master_name = $this->master_name( $entity );

		// Reuse the stored master if it still exists.
		if ( $existing_master_id ) {
			$existing = $this->gophish->get_campaign( $existing_master_id );
			if ( ! is_wp_error( $existing ) && (int) ( $existing['id'] ?? 0 ) === $existing_master_id ) {
				return [ 'id' => $existing_master_id, 'name' => $master_name ];
			}
		}

		// Reuse by name (created in a previous run).
		$campaigns = $this->gophish->get_campaigns( [ 'is_master' => true, 'campaign_type' => 'education' ] );
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
	 * Delete any existing master for the entity, then create a fresh one so it
	 * snapshots the latest published page (GoPhish freezes page content at
	 * campaign creation — verified). Safe because the education page is locked
	 * for edits while a related simulation is active
	 * (FlagPageService::assert_editable()).
	 *
	 * @return array{id: int, name: string}|WP_Error
	 */
	public function recreate_master( string $entity, string $launch_url, ?int $existing_master_id = null ): array|WP_Error {
		$launch_url = esc_url_raw( trim( $launch_url ) );
		if ( '' === $launch_url ) {
			return new WP_Error( 'validation_error', __( 'A launch URL is required to create the education master.', 'pukat' ), [ 'status' => 422 ] );
		}

		$this->delete_existing_master( $entity, $existing_master_id );

		return $this->create_master( $entity, $launch_url );
	}

	/**
	 * Simulations currently chained to this master (`next_campaign_id`) and not
	 * yet Completed — i.e. active users of the education page. Drives the edit
	 * lock (decision: the education page can only be edited when no related
	 * simulation is active).
	 *
	 * @return array<int, array{id: int, name: string, status: string}>
	 */
	public function active_simulations_for_master( int $master_id ): array {
		if ( $master_id <= 0 ) {
			return [];
		}

		$campaigns = $this->gophish->get_campaigns();
		if ( is_wp_error( $campaigns ) ) {
			return [];
		}

		$active = [];
		foreach ( $campaigns as $c ) {
			if ( (int) ( $c['next_campaign_id'] ?? 0 ) !== $master_id ) {
				continue;
			}
			if ( 'Completed' === (string) ( $c['status'] ?? '' ) ) {
				continue;
			}
			$active[] = [ 'id' => (int) $c['id'], 'name' => (string) ( $c['name'] ?? '' ), 'status' => (string) ( $c['status'] ?? '' ) ];
		}

		return $active;
	}

	public function master_name( string $entity ): string {
		return 'pukat-edu-master-' . $this->slug( $entity );
	}

	private function delete_existing_master( string $entity, ?int $existing_master_id ): void {
		if ( $existing_master_id ) {
			$this->gophish->delete_campaign( $existing_master_id, true );
		}

		// Clear any same-named master (stale id / orphan) so create() below does
		// not hit GoPhish's duplicate-name rejection.
		$name      = $this->master_name( $entity );
		$campaigns = $this->gophish->get_campaigns( [ 'is_master' => true, 'campaign_type' => 'education' ] );
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
	 * @return array{id: int, name: string}|WP_Error
	 */
	private function create_master( string $entity, string $launch_url ): array|WP_Error {
		$template = $this->ensure_dummy_template( $entity );
		if ( is_wp_error( $template ) ) {
			return $template;
		}
		$smtp = $this->ensure_dummy_smtp( $entity );
		if ( is_wp_error( $smtp ) ) {
			return $smtp;
		}

		$created = $this->gophish->create_campaign( [
			'name'          => $this->master_name( $entity ),
			'campaign_type' => 'education',
			'is_master'     => true,
			'entity'        => $entity,
			'url'           => $launch_url,
			'template'      => [ 'name' => $template ],
			'page'          => [ 'name' => $this->page_name( $entity ) ],
			'smtp'          => [ 'name' => $smtp ],
			// ≤ now → In progress (can receive redirects); still sends no email.
			'launch_date'   => gmdate( 'Y-m-d\TH:i:s+00:00' ),
		] );
		if ( is_wp_error( $created ) ) {
			return $created;
		}

		return [ 'id' => (int) ( $created['id'] ?? 0 ), 'name' => $this->master_name( $entity ) ];
	}

	/**
	 * Dummy email template for the master (never sent in the chain, but GoPhish
	 * requires one). Reused by name. Returns the template name.
	 *
	 * @return string|WP_Error
	 */
	private function ensure_dummy_template( string $entity ): string|WP_Error {
		$name      = 'pukat-edu-tmpl-' . $this->slug( $entity );
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
			'subject'     => 'Security Awareness',
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
		$name     = 'pukat-edu-smtp-' . $this->slug( $entity );
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

	private function slug( string $entity ): string {
		$slug = sanitize_title( $entity );
		return '' === $slug ? 'entity' : $slug;
	}

	/**
	 * Replace the `src` of every `<figure data-pukat-img="{id}">`'s image with a
	 * base64 data URI, and strip the identity attribute. Everything outside
	 * those figures is left byte-for-byte unchanged. An id whose example can no
	 * longer be read (deleted, out of scope) is left as-is.
	 */
	public function inline_flag_images( string $html ): string {
		$result = preg_replace_callback(
			'#<figure\b([^>]*?)\s*data-pukat-img="(\d+)"([^>]*)>(.*?)</figure>#is',
			function ( array $m ): string {
				$id       = (int) $m[2];
				$data_uri = $this->examples->data_uri( $id );
				$inner    = $m[4];

				if ( ! is_wp_error( $data_uri ) && isset( $data_uri['data_uri'] ) ) {
					$inner = $this->replace_first_img_src( $inner, (string) $data_uri['data_uri'] );
				}

				// Rebuild the opening tag without the data-pukat-img attribute.
				$attrs = trim( $m[1] . $m[3] );
				return '<figure' . ( '' === $attrs ? '' : ' ' . $attrs ) . '>' . $inner . '</figure>';
			},
			$html
		);

		return null === $result ? $html : $result;
	}

	/**
	 * Count how many Pukat images a page would inline — used to report sync
	 * readiness without doing the (potentially large) base64 work.
	 */
	public function count_flag_images( string $html ): int {
		return preg_match_all( '#<figure\b[^>]*\bdata-pukat-img="\d+"#is', $html );
	}

	/**
	 * Swap the first `<img src="...">` in a fragment (double-quoted src, as
	 * buildFigureHtml emits). Uses a callback so the replacement string is never
	 * treated as a backreference pattern.
	 */
	private function replace_first_img_src( string $fragment, string $src ): string {
		$done = false;

		$out = preg_replace_callback(
			'#(<img\b[^>]*?\ssrc=")[^"]*(")#is',
			function ( array $m ) use ( $src, &$done ): string {
				if ( $done ) {
					return $m[0];
				}
				$done = true;
				return $m[1] . $src . $m[2];
			},
			$fragment,
			1
		);

		return null === $out ? $fragment : $out;
	}
}
