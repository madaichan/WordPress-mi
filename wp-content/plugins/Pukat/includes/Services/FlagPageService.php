<?php
/**
 * Flag education page (one per entity) business logic.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

use Pukat\Repositories\FlagPageRepository;
use WP_Error;

/**
 * The single education page an entity shows to colleagues after a simulation
 * (docs/PRD_FLAG_EDUCATION_PAGES.md — one page per entity, not per category).
 * Authored like a landing page: raw HTML, saved as a draft and published
 * explicitly — only the published copy is meant to reach colleagues. Entity
 * scoping is delegated to EntityProfileService, identical to
 * FlagExampleService.
 */
class FlagPageService {

	/** Upper bound for one page's HTML source. */
	private const MAX_HTML_BYTES = 4 * 1024 * 1024;

	/** The UNIQUE index is on VARCHAR(191); reject longer names up front. */
	private const MAX_ENTITY_LEN = 191;

	private const STATUS_DRAFT     = 'draft';
	private const STATUS_PUBLISHED = 'published';

	private FlagPageRepository $repository;
	private EntityProfileService $access;
	private FlagPageSyncService $sync;

	public function __construct( ?FlagPageRepository $repository = null, ?EntityProfileService $access = null, ?FlagPageSyncService $sync = null ) {
		$this->repository = $repository ?? new FlagPageRepository();
		$this->access     = $access ?? new EntityProfileService();
		$this->sync       = $sync ?? new FlagPageSyncService();
	}

	/**
	 * The entity's page. An entity without one yet returns an empty, unsaved
	 * page (id null) rather than 404, so the editor can open straight onto it.
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

		$row = $this->repository->find_for_entity( $entity );
		return $this->with_lock_state( $this->prepare( $row, $entity ), $row );
	}

	/**
	 * Save the working draft. Never touches the published copy.
	 *
	 * @param array<string, mixed> $params title?, html_body, entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function save( array $params, int $user_id ): array|WP_Error {
		$context = $this->writable_context( $params );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		[ $entity, $existing ] = $context;

		$lock = $this->assert_editable( $existing );
		if ( $lock ) {
			return $lock;
		}

		if ( ! array_key_exists( 'html_body', $params ) || ! is_string( $params['html_body'] ) ) {
			return $this->validation_error( __( 'The page HTML is required.', 'pukat' ) );
		}
		$html = (string) $params['html_body'];
		if ( strlen( $html ) > self::MAX_HTML_BYTES ) {
			return $this->validation_error( __( 'The page HTML is too large.', 'pukat' ) );
		}

		$title = mb_substr( trim( sanitize_text_field( (string) ( $params['title'] ?? ( $existing['title'] ?? '' ) ) ) ), 0, 255 );

		// Launch URL is optional; only touched when the client sends the field,
		// so a save that omits it keeps the stored choice.
		$has_launch_url = array_key_exists( 'launch_url', $params );
		$launch_url     = '';
		if ( $has_launch_url ) {
			$launch_url = $this->sanitize_launch_url( (string) $params['launch_url'] );
			if ( is_wp_error( $launch_url ) ) {
				return $launch_url;
			}
		}

		if ( $existing ) {
			$data = [
				'title'      => $title,
				'html_body'  => $html,
				'updated_by' => $user_id,
			];
			if ( $has_launch_url ) {
				$data['launch_url'] = $launch_url;
			}
			$this->repository->update( (int) $existing['id'], $data );
			$id = (int) $existing['id'];
		} else {
			$id = $this->repository->create( [
				'entity_name' => $entity,
				'title'       => $title,
				'html_body'   => $html,
				'launch_url'  => $launch_url,
				'status'      => self::STATUS_DRAFT,
				'created_by'  => $user_id,
				'updated_by'  => $user_id,
			] );
			if ( false === $id ) {
				return $this->db_error( __( 'Failed to save the education page.', 'pukat' ) );
			}
		}

		AuditLogService::log( 'flag_page.saved', [ 'flag_page_id' => $id, 'entity_name' => $entity ], $user_id, 'flag_page', $id );

		return $this->prepare( $this->repository->find_for_entity( $entity ), $entity );
	}

	/**
	 * Copy the saved draft into the published copy.
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

		$lock = $this->assert_editable( $existing );
		if ( $lock ) {
			return $lock;
		}

		if ( ! $existing ) {
			return $this->validation_error( __( 'Save a draft before publishing.', 'pukat' ) );
		}
		if ( '' === trim( (string) $existing['html_body'] ) ) {
			return $this->validation_error( __( 'The draft is empty.', 'pukat' ) );
		}

		$this->repository->update( (int) $existing['id'], [
			'published_html' => (string) $existing['html_body'],
			'status'         => self::STATUS_PUBLISHED,
			'published_by'   => $user_id,
			'published_at'   => current_time( 'mysql' ),
			'updated_by'     => $user_id,
		] );

		AuditLogService::log( 'flag_page.published', [ 'flag_page_id' => (int) $existing['id'], 'entity_name' => $entity ], $user_id, 'flag_page', (int) $existing['id'] );

		// Push the just-published copy to GoPhish Landing Page. A sync failure
		// does not undo the local publish — it is reported back for retry.
		$sync_status = $this->push_to_gophish( (array) $this->repository->find_for_entity( $entity ), $entity );

		// Decision (2026-10-12): create/refresh the GoPhish education master at
		// publish. Recreated each publish so it snapshots the latest page (the
		// master is snapshot, not live). Safe because editing is locked while a
		// related simulation is active.
		$master_status = [ 'ok' => false, 'message' => '' ];
		if ( $sync_status['ok'] ) {
			$master_status = $this->refresh_master( (array) $this->repository->find_for_entity( $entity ), $entity, $user_id );
		}

		$row           = $this->repository->find_for_entity( $entity );
		$out           = $this->with_lock_state( $this->prepare( $row, $entity ), $row );
		$out['sync']   = $sync_status;
		$out['master'] = $master_status;
		return $out;
	}

	/**
	 * Re-push the already-published page to GoPhish (retry after a failed sync),
	 * without changing draft/published state.
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

		$sync_status = $this->push_to_gophish( $existing, $entity, $user_id );

		$out         = $this->prepare( $this->repository->find_for_entity( $entity ), $entity );
		$out['sync'] = $sync_status;
		return $out;
	}

	/**
	 * Ensure the entity's GoPhish education master exists (G3). Requires a
	 * published page that is already synced to a GoPhish landing page and has a
	 * Launch URL chosen. Stores the master id. Idempotent.
	 *
	 * @param array<string, mixed> $params entity? (admin only)
	 * @return array<string, mixed>|WP_Error
	 */
	public function ensure_master( array $params, int $user_id ): array|WP_Error {
		$context = $this->writable_context( $params );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		[ $entity, $existing ] = $context;

		if ( ! $existing || self::STATUS_PUBLISHED !== (string) $existing['status'] ) {
			return $this->validation_error( __( 'Publish the page before creating its education campaign.', 'pukat' ) );
		}
		if ( empty( $existing['gophish_page_id'] ) ) {
			return $this->validation_error( __( 'Sync the page to GoPhish before creating its education campaign.', 'pukat' ) );
		}
		if ( '' === trim( (string) ( $existing['launch_url'] ?? '' ) ) ) {
			return $this->validation_error( __( 'Choose a Launch URL before creating the education campaign.', 'pukat' ) );
		}

		$result = $this->sync->ensure_master(
			$entity,
			(string) $existing['launch_url'],
			empty( $existing['gophish_master_id'] ) ? null : (int) $existing['gophish_master_id']
		);
		if ( is_wp_error( $result ) ) {
			return $result;
		}

		$this->repository->update( (int) $existing['id'], [ 'gophish_master_id' => (int) $result['id'] ] );

		AuditLogService::log(
			'flag_page.master_ensured',
			[ 'flag_page_id' => (int) $existing['id'], 'entity_name' => $entity, 'gophish_master_id' => (int) $result['id'] ],
			$user_id,
			'flag_page',
			(int) $existing['id']
		);

		$out           = $this->prepare( $this->repository->find_for_entity( $entity ), $entity );
		$out['master'] = [ 'ok' => true, 'campaign_id' => (int) $result['id'], 'name' => (string) $result['name'] ];
		return $out;
	}

	/**
	 * The entity's published GoPhish education master id, or 0 when the entity
	 * has no published page synced to a master yet. Read-only and ungated
	 * (no edit/view access check): used by CampaignRunService to chain a
	 * launching simulation to it (docs/PRD_FLAG_EDUCATION_PAGES.md §11 G3b),
	 * where the caller has already passed its own run-level access checks.
	 */
	public function published_master_id_for_entity( string $entity ): int {
		$row = $this->repository->find_for_entity( $entity );
		if ( ! $row || self::STATUS_PUBLISHED !== (string) ( $row['status'] ?? '' ) ) {
			return 0;
		}

		return empty( $row['gophish_master_id'] ) ? 0 : (int) $row['gophish_master_id'];
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
		$result = $this->sync->push( $html, $entity, empty( $row['gophish_page_id'] ) ? null : (int) $row['gophish_page_id'] );

		if ( is_wp_error( $result ) ) {
			return [ 'ok' => false, 'message' => $result->get_error_message() ];
		}

		$this->repository->update( (int) $row['id'], [
			'gophish_page_id' => (int) $result['id'],
			'synced_at'       => current_time( 'mysql' ),
		] );

		AuditLogService::log(
			'flag_page.synced',
			[ 'flag_page_id' => (int) $row['id'], 'entity_name' => $entity, 'gophish_page_id' => (int) $result['id'] ],
			$user_id,
			'flag_page',
			(int) $row['id']
		);

		return [ 'ok' => true, 'message' => __( 'Synced to GoPhish.', 'pukat' ), 'page_id' => (int) $result['id'], 'page_name' => (string) $result['name'] ];
	}

	/**
	 * Clear the published copy and return the page to draft.
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
			return $this->not_found_error( __( 'Education page not found.', 'pukat' ) );
		}

		$lock = $this->assert_editable( $existing );
		if ( $lock ) {
			return $lock;
		}

		$this->repository->update( (int) $existing['id'], [
			'published_html' => null,
			'status'         => self::STATUS_DRAFT,
			'published_by'   => null,
			'published_at'   => null,
			'updated_by'     => $user_id,
		] );

		AuditLogService::log( 'flag_page.unpublished', [ 'flag_page_id' => (int) $existing['id'], 'entity_name' => $entity ], $user_id, 'flag_page', (int) $existing['id'] );

		$row = $this->repository->find_for_entity( $entity );
		return $this->with_lock_state( $this->prepare( $row, $entity ), $row );
	}

	/**
	 * Lock editing while a related simulation is still active (user decision
	 * 2026-10-12): the education page can only be changed when no simulation
	 * chained to its GoPhish master is running. Resilient — a GoPhish read
	 * failure leaves the page editable; the next mutation re-checks.
	 *
	 * @param array<string, mixed>|null $existing
	 */
	private function assert_editable( ?array $existing ): ?WP_Error {
		if ( ! $existing || empty( $existing['gophish_master_id'] ) ) {
			return null;
		}

		$active = $this->sync->active_simulations_for_master( (int) $existing['gophish_master_id'] );
		if ( empty( $active ) ) {
			return null;
		}

		$names = implode( ', ', array_map( static fn ( array $a ): string => $a['name'] . ' (' . $a['status'] . ')', $active ) );

		return new WP_Error(
			'education_locked',
			sprintf(
				/* translators: %s: comma-separated simulation campaign names. */
				__( 'This education page is locked because a related simulation is still active: %s. Complete or stop it before editing.', 'pukat' ),
				$names
			),
			[ 'status' => 409, 'active_simulations' => $active ]
		);
	}

	/**
	 * Create/refresh the GoPhish education master for a just-published page.
	 * Recreated so it snapshots the latest page. Returns a status array.
	 *
	 * @param array<string, mixed> $row
	 * @return array{ok: bool, message: string, campaign_id?: int, name?: string}
	 */
	private function refresh_master( array $row, string $entity, int $user_id ): array {
		if ( '' === trim( (string) ( $row['launch_url'] ?? '' ) ) ) {
			return [ 'ok' => false, 'message' => __( 'No Launch URL chosen — education master not created.', 'pukat' ) ];
		}
		if ( empty( $row['gophish_page_id'] ) ) {
			return [ 'ok' => false, 'message' => __( 'Landing page not synced — education master skipped.', 'pukat' ) ];
		}

		$result = $this->sync->recreate_master(
			$entity,
			(string) $row['launch_url'],
			empty( $row['gophish_master_id'] ) ? null : (int) $row['gophish_master_id']
		);
		if ( is_wp_error( $result ) ) {
			return [ 'ok' => false, 'message' => $result->get_error_message() ];
		}

		$this->repository->update( (int) $row['id'], [ 'gophish_master_id' => (int) $result['id'] ] );

		AuditLogService::log(
			'flag_page.master_ensured',
			[ 'flag_page_id' => (int) $row['id'], 'entity_name' => $entity, 'gophish_master_id' => (int) $result['id'] ],
			$user_id,
			'flag_page',
			(int) $row['id']
		);

		return [ 'ok' => true, 'message' => __( 'Education campaign ready in GoPhish.', 'pukat' ), 'campaign_id' => (int) $result['id'], 'name' => (string) $result['name'] ];
	}

	/**
	 * Append `editable` + `active_simulations` to a prepared page (advisory for
	 * the UI; mutations enforce via assert_editable()).
	 *
	 * @param array<string, mixed>      $out
	 * @param array<string, mixed>|null $row
	 * @return array<string, mixed>
	 */
	private function with_lock_state( array $out, ?array $row ): array {
		$master_id = ( $row && ! empty( $row['gophish_master_id'] ) ) ? (int) $row['gophish_master_id'] : 0;
		$active    = $master_id > 0 ? $this->sync->active_simulations_for_master( $master_id ) : [];

		$out['editable']           = empty( $active );
		$out['active_simulations'] = $active;
		return $out;
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

		return [ $entity, $this->repository->find_for_entity( $entity ) ];
	}

	/**
	 * Validate the chosen launch URL against the dynamic domains the current
	 * user may see (the same list that populates the dropdown). Empty clears it.
	 *
	 * @return string|WP_Error Sanitized URL, '' to clear, or an error.
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
			if ( $url === esc_url_raw( (string) ( $domain['base_landing_url'] ?? '' ) ) ) {
				return $url;
			}
		}

		return $this->validation_error( __( 'Choose a launch URL from the available domains.', 'pukat' ) );
	}

	/**
	 * Server-side entity: always the user's own for non-admins; an admin may
	 * target an entity via `entity`. Identical to FlagExampleService.
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
	 * Full page for the editor. An entity with no saved page yet is returned
	 * as an empty, unsaved shell (id null).
	 *
	 * @param array<string, mixed>|null $row
	 * @return array<string, mixed>
	 */
	private function prepare( ?array $row, string $entity ): array {
		if ( ! $row ) {
			return [
				'id'                      => null,
				'entity_name'             => $entity,
				'title'                   => '',
				'html_body'               => '',
				'status'                  => self::STATUS_DRAFT,
				'has_unpublished_changes' => false,
				'updated_at'              => null,
				'published_at'            => null,
				'gophish_page_id'         => null,
				'synced_at'               => null,
				'launch_url'              => '',
				'gophish_master_id'       => null,
			];
		}

		$published = $row['published_html'] ?? null;

		return [
			'id'                      => (int) $row['id'],
			'entity_name'             => (string) $row['entity_name'],
			'title'                   => (string) $row['title'],
			'html_body'               => (string) $row['html_body'],
			'status'                  => (string) $row['status'],
			'has_unpublished_changes' => null === $published || $published !== (string) $row['html_body'],
			'updated_at'              => $row['updated_at'] ?? null,
			'published_at'            => $row['published_at'] ?? null,
			'gophish_page_id'         => empty( $row['gophish_page_id'] ) ? null : (int) $row['gophish_page_id'],
			'synced_at'               => $row['synced_at'] ?? null,
			'launch_url'              => (string) ( $row['launch_url'] ?? '' ),
			'gophish_master_id'       => empty( $row['gophish_master_id'] ) ? null : (int) $row['gophish_master_id'],
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
