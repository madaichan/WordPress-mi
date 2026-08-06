<?php
/**
 * Master component REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\MasterComponentService;
use Pukat\Services\PermissionRegistry;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Manages WordPress-owned master components for Playbook Master.
 */
class MasterComponentController extends RestController {

	private MasterComponentService $components;

	public function __construct( ?MasterComponentService $components = null ) {
		$this->components = $components ?? new MasterComponentService();
	}

	/**
	 * Phase 3 of docs/IMPLEMENTATION_PLAN_RBAC.md: granular capability checks
	 * replacing permission_read()/permission_manage() across all 4
	 * sub-resources. *.view/create/edit/delete all keep the exact
	 * shared/operator population permission_read()/permission_manage() had —
	 * pure swaps, no behavior change. Version-create routes reuse .create
	 * (a new version is new content); version-update reuses .edit. The 2
	 * "approve" routes are NOT migrated here — still permission_manage(),
	 * exactly as before; Phase 4 migrates them with the new self-approval
	 * guard as their own reviewable unit.
	 *
	 * sending-profiles here got a NEW registry menu, sending_profile_references
	 * — discovered while migrating this controller that MasterComponentService
	 * manages the WordPress-owned reference table (wp_pukat_sending_profile_refs,
	 * no credentials), a genuinely different resource from GoPhishProxy's live
	 * GoPhish SMTP CRUD (already mapped to the admin-gated master_sending_profiles.*
	 * in Phase 3.10). Reusing that key here would have silently locked
	 * operators out of a reference table they can use today (e.g. while
	 * building a Playbook Master) — sending_profile_references.* is
	 * shared/operator-gated instead, matching today's actual behavior exactly.
	 */
	public function permission_view_email_template_master(): bool|WP_Error {
		return $this->require_capability( 'master_email_templates.view' );
	}

	public function permission_create_email_template_master(): bool|WP_Error {
		return $this->require_capability( 'master_email_templates.create' );
	}

	public function permission_edit_email_template_master(): bool|WP_Error {
		return $this->require_capability( 'master_email_templates.edit' );
	}

	public function permission_delete_email_template_master(): bool|WP_Error {
		return $this->require_capability( 'master_email_templates.delete' );
	}

	public function permission_view_landing_page_master(): bool|WP_Error {
		return $this->require_capability( 'master_landing_pages.view' );
	}

	public function permission_create_landing_page_master(): bool|WP_Error {
		return $this->require_capability( 'master_landing_pages.create' );
	}

	public function permission_edit_landing_page_master(): bool|WP_Error {
		return $this->require_capability( 'master_landing_pages.edit' );
	}

	public function permission_delete_landing_page_master(): bool|WP_Error {
		return $this->require_capability( 'master_landing_pages.delete' );
	}

	public function permission_view_sending_profile_reference(): bool|WP_Error {
		return $this->require_capability( 'sending_profile_references.view' );
	}

	public function permission_create_sending_profile_reference(): bool|WP_Error {
		return $this->require_capability( 'sending_profile_references.create' );
	}

	public function permission_edit_sending_profile_reference(): bool|WP_Error {
		return $this->require_capability( 'sending_profile_references.edit' );
	}

	public function permission_delete_sending_profile_reference(): bool|WP_Error {
		return $this->require_capability( 'sending_profile_references.delete' );
	}

	public function permission_validate_sending_profile_reference(): bool|WP_Error {
		return $this->require_capability( 'sending_profile_references.validate' );
	}

	public function permission_view_dynamic_domain(): bool|WP_Error {
		return $this->require_capability( 'domains.view' );
	}

	public function permission_create_dynamic_domain(): bool|WP_Error {
		return $this->require_capability( 'domains.create' );
	}

	public function permission_edit_dynamic_domain(): bool|WP_Error {
		return $this->require_capability( 'domains.edit' );
	}

	public function permission_delete_dynamic_domain(): bool|WP_Error {
		return $this->require_capability( 'domains.delete' );
	}

	public function permission_validate_dynamic_domain(): bool|WP_Error {
		return $this->require_capability( 'domains.validate' );
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

	public function register_routes(): void {
		$this->register_email_template_routes();
		$this->register_landing_page_routes();
		$this->register_sending_profile_routes();
		$this->register_dynamic_domain_routes();
	}

	private function register_email_template_routes(): void {
		register_rest_route( $this->namespace, '/master/email-templates', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_email_templates' ],
				'permission_callback' => [ $this, 'permission_view_email_template_master' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_email_template' ],
				'permission_callback' => [ $this, 'permission_create_email_template_master' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/email-templates/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_email_template' ],
				'permission_callback' => [ $this, 'permission_view_email_template_master' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_email_template' ],
				'permission_callback' => [ $this, 'permission_edit_email_template_master' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_email_template' ],
				'permission_callback' => [ $this, 'permission_delete_email_template_master' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/email-templates/(?P<id>\d+)/versions', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_email_template_versions' ],
				'permission_callback' => [ $this, 'permission_view_email_template_master' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_email_template_version' ],
				'permission_callback' => [ $this, 'permission_create_email_template_master' ], // a new version is new content
			],
		] );

		register_rest_route( $this->namespace, '/master/email-template-versions/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_email_template_version' ],
				'permission_callback' => [ $this, 'permission_edit_email_template_master' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/email-template-versions/(?P<id>\d+)/approve', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'approve_email_template_version' ],
			'permission_callback' => [ $this, 'permission_manage' ], // Phase 4 migrates this + adds the self-approval guard
		] );
	}

	private function register_landing_page_routes(): void {
		register_rest_route( $this->namespace, '/master/landing-pages', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_landing_pages' ],
				'permission_callback' => [ $this, 'permission_view_landing_page_master' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_landing_page' ],
				'permission_callback' => [ $this, 'permission_create_landing_page_master' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/landing-pages/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_landing_page' ],
				'permission_callback' => [ $this, 'permission_view_landing_page_master' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_landing_page' ],
				'permission_callback' => [ $this, 'permission_edit_landing_page_master' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_landing_page' ],
				'permission_callback' => [ $this, 'permission_delete_landing_page_master' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/landing-pages/(?P<id>\d+)/versions', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_landing_page_versions' ],
				'permission_callback' => [ $this, 'permission_view_landing_page_master' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_landing_page_version' ],
				'permission_callback' => [ $this, 'permission_create_landing_page_master' ], // a new version is new content
			],
		] );

		register_rest_route( $this->namespace, '/master/landing-page-versions/(?P<id>\d+)', [
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_landing_page_version' ],
				'permission_callback' => [ $this, 'permission_edit_landing_page_master' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/landing-page-versions/(?P<id>\d+)/approve', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'approve_landing_page_version' ],
			'permission_callback' => [ $this, 'permission_manage' ], // Phase 4 migrates this + adds the self-approval guard
		] );
	}

	private function register_sending_profile_routes(): void {
		register_rest_route( $this->namespace, '/master/sending-profiles', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_sending_profiles' ],
				'permission_callback' => [ $this, 'permission_view_sending_profile_reference' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_sending_profile' ],
				'permission_callback' => [ $this, 'permission_create_sending_profile_reference' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/sending-profiles/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_sending_profile' ],
				'permission_callback' => [ $this, 'permission_view_sending_profile_reference' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_sending_profile' ],
				'permission_callback' => [ $this, 'permission_edit_sending_profile_reference' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_sending_profile' ],
				'permission_callback' => [ $this, 'permission_delete_sending_profile_reference' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/sending-profiles/(?P<id>\d+)/validate-gophish', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'validate_sending_profile_gophish_mapping' ],
			'permission_callback' => [ $this, 'permission_validate_sending_profile_reference' ],
		] );
	}

	private function register_dynamic_domain_routes(): void {
		register_rest_route( $this->namespace, '/master/dynamic-domains', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'list_dynamic_domains' ],
				'permission_callback' => [ $this, 'permission_view_dynamic_domain' ],
			],
			[
				'methods'             => 'POST',
				'callback'            => [ $this, 'create_dynamic_domain' ],
				'permission_callback' => [ $this, 'permission_create_dynamic_domain' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/dynamic-domains/(?P<id>\d+)', [
			[
				'methods'             => 'GET',
				'callback'            => [ $this, 'get_dynamic_domain' ],
				'permission_callback' => [ $this, 'permission_view_dynamic_domain' ],
			],
			[
				'methods'             => 'PUT',
				'callback'            => [ $this, 'update_dynamic_domain' ],
				'permission_callback' => [ $this, 'permission_edit_dynamic_domain' ],
			],
			[
				'methods'             => 'DELETE',
				'callback'            => [ $this, 'delete_dynamic_domain' ],
				'permission_callback' => [ $this, 'permission_delete_dynamic_domain' ],
			],
		] );

		register_rest_route( $this->namespace, '/master/dynamic-domains/(?P<id>\d+)/health-check', [
			'methods'             => 'POST',
			'callback'            => [ $this, 'health_check_dynamic_domain' ],
			'permission_callback' => [ $this, 'permission_validate_dynamic_domain' ],
		] );
	}

	public function list_email_templates( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->components->list_email_templates() );
	}

	public function get_email_template( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->get_email_template( (int) $request->get_param( 'id' ) );
		return $result ? $this->success( $result ) : $this->error( 'not_found', __( 'Email template master not found.', 'pukat' ), 404 );
	}

	public function create_email_template( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->create_email_template( $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result, 201 );
	}

	public function update_email_template( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->update_email_template( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result );
	}

	public function delete_email_template( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->delete_email_template( (int) $request->get_param( 'id' ) );
		return $this->delete_response( $result );
	}

	public function list_email_template_versions( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->list_email_template_versions( (int) $request->get_param( 'id' ) );
		return $this->result_response( $result );
	}

	public function create_email_template_version( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->create_email_template_version( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result, 201 );
	}

	public function update_email_template_version( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->update_email_template_version( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result );
	}

	public function approve_email_template_version( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->approve_email_template_version( (int) $request->get_param( 'id' ), get_current_user_id() );
		return $this->result_response( $result );
	}

	public function list_landing_pages( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->components->list_landing_pages() );
	}

	public function get_landing_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->get_landing_page( (int) $request->get_param( 'id' ) );
		return $result ? $this->success( $result ) : $this->error( 'not_found', __( 'Landing page master not found.', 'pukat' ), 404 );
	}

	public function create_landing_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->create_landing_page( $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result, 201 );
	}

	public function update_landing_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->update_landing_page( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result );
	}

	public function delete_landing_page( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->delete_landing_page( (int) $request->get_param( 'id' ) );
		return $this->delete_response( $result );
	}

	public function list_landing_page_versions( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->list_landing_page_versions( (int) $request->get_param( 'id' ) );
		return $this->result_response( $result );
	}

	public function create_landing_page_version( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->create_landing_page_version( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result, 201 );
	}

	public function update_landing_page_version( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->update_landing_page_version( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result );
	}

	public function approve_landing_page_version( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->approve_landing_page_version( (int) $request->get_param( 'id' ), get_current_user_id() );
		return $this->result_response( $result );
	}

	public function list_sending_profiles( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->components->list_sending_profiles() );
	}

	public function get_sending_profile( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->get_sending_profile( (int) $request->get_param( 'id' ) );
		return $result ? $this->success( $result ) : $this->error( 'not_found', __( 'Sending profile reference not found.', 'pukat' ), 404 );
	}

	public function create_sending_profile( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->create_sending_profile( $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result, 201 );
	}

	public function update_sending_profile( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->update_sending_profile( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result );
	}

	public function delete_sending_profile( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->delete_sending_profile( (int) $request->get_param( 'id' ) );
		return $this->delete_response( $result );
	}

	public function validate_sending_profile_gophish_mapping( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->validate_sending_profile_gophish_mapping( (int) $request->get_param( 'id' ) );
		return $this->result_response( $result );
	}

	public function list_dynamic_domains( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->components->list_dynamic_domains() );
	}

	public function get_dynamic_domain( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->get_dynamic_domain( (int) $request->get_param( 'id' ) );
		return $result ? $this->success( $result ) : $this->error( 'not_found', __( 'Dynamic domain not found.', 'pukat' ), 404 );
	}

	public function create_dynamic_domain( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->create_dynamic_domain( $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result, 201 );
	}

	public function update_dynamic_domain( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->update_dynamic_domain( (int) $request->get_param( 'id' ), $this->request_params( $request ), get_current_user_id() );
		return $this->result_response( $result );
	}

	public function delete_dynamic_domain( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->delete_dynamic_domain( (int) $request->get_param( 'id' ) );
		return $this->delete_response( $result );
	}

	public function health_check_dynamic_domain( WP_REST_Request $request ): WP_REST_Response {
		$result = $this->components->health_check_dynamic_domain( (int) $request->get_param( 'id' ) );
		return $this->result_response( $result );
	}

	/**
	 * @return array<string, mixed>
	 */
	private function request_params( WP_REST_Request $request ): array {
		$params = $request->get_params();
		$json   = $request->get_json_params();

		if ( is_array( $json ) ) {
			$params = array_merge( $params, $json );
		}

		return $params;
	}

	private function result_response( mixed $result, int $success_status = 200 ): WP_REST_Response {
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( $result, $success_status );
	}

	private function delete_response( mixed $result ): WP_REST_Response {
		if ( is_wp_error( $result ) ) {
			return $this->from_wp_error( $result );
		}

		return $this->success( [ 'deleted' => true ] );
	}
}
