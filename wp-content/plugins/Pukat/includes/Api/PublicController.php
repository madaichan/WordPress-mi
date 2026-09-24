<?php
/**
 * Public (unauthenticated) REST controller.
 *
 * @package Pukat\Api
 */

declare(strict_types=1);

namespace Pukat\Api;

use Pukat\Services\EntityProfileService;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Read-only endpoints meant for consumers outside a logged-in Pukat session
 * (e.g. the planned Outlook "Report" add-in). Every route here is
 * intentionally public — permission_callback always returns true — so each
 * handler must only ever return explicitly whitelisted, non-sensitive
 * fields. See docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md §9/§12.
 *
 * Routes:
 *   GET /pukat/v1/public/report-contact?entity=<entity_name>
 */
class PublicController extends RestController {

	private EntityProfileService $entities;

	public function __construct( ?EntityProfileService $entities = null ) {
		$this->entities = $entities ?? new EntityProfileService();
	}

	public function register_routes(): void {
		register_rest_route( $this->namespace, '/public/report-contact', [
			'methods'             => 'GET',
			'callback'            => [ $this, 'report_contact' ],
			'permission_callback' => '__return_true',
			'args'                => [
				'entity' => [
					'type'              => 'string',
					'required'          => false,
					'sanitize_callback' => 'sanitize_text_field',
				],
			],
		] );
	}

	/**
	 * Unknown or empty entity returns empty fields with 200, not 404, so an
	 * anonymous caller can't probe which entities exist.
	 */
	public function report_contact( WP_REST_Request $request ): WP_REST_Response {
		return $this->success( $this->entities->public_report_contact( (string) $request->get_param( 'entity' ) ) );
	}
}
