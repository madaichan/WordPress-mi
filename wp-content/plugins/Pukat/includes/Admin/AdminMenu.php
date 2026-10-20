<?php
/**
 * Admin menu registration.
 *
 * @package Pukat\Admin
 */

declare(strict_types=1);

namespace Pukat\Admin;

use Pukat\Services\PermissionRegistry;

/**
 * Class AdminMenu
 *
 * Registers the Pukat top-level menu and all submenus in WP Admin.
 * The React SPA handles all routing internally — each submenu item simply
 * opens the same PHP page container with a different URL hash.
 */
class AdminMenu {

	/** @var string The parent menu slug. */
	const MENU_SLUG = 'pukat';

	/**
	 * Register menus. Called on 'admin_menu' hook.
	 */
	public function register(): void {
		// Top-level menu — callback is never reached because load-{hook} exits first.
		// The capability is the Permission Registry's `admin_panel.view`, not the
		// legacy `pukat_manage_settings` this used to hardcode: that capability
		// was never in the registry, so a role created from the Roles page could
		// hold every one of its 77 keys and still be unable to open this panel
		// (docs/PRD_RBAC_COVERAGE_COMPLETION.md §2.1). It stays admin-gated by
		// seed, so the same people can open it today as yesterday — the
		// difference is that it's now configurable from the Roles page.
		//
		// This key is a PREREQUISITE, not a replacement for the per-submenu
		// gates below: WordPress hides the entire submenu tree when the
		// top-level capability is missing, so a role needs this key plus the
		// key of whichever page it should reach.
		$top_hook = add_menu_page(
			__( 'Pukat', 'pukat' ),
			__( 'Pukat', 'pukat' ),
			PermissionRegistry::capability_for( 'admin_panel.view' ),
			self::MENU_SLUG,
			'__return_empty_string',
			$this->get_menu_icon(),
			30
		);
		if ( $top_hook ) {
			add_action( 'load-' . $top_hook, static function (): void {
				AdminPage::render_standalone();
			} );
		}

		// Admin Panel submenus — only admin/management features.
		// Operational features (Campaigns, Simulation, Reports, etc.)
		// are accessible via the front page at /pukat.
		//
		// Each capability is the Permission Registry key of the SPA route the
		// submenu opens — deliberately the exact same key that route declares in
		// `pukat-app/src/config/appRoutes.jsx`, so a submenu can never be visible
		// for a page whose own `<PermissionRoute>` guard would then bounce the
		// user straight back to the dashboard. Keep the two in sync when either
		// side changes.
		//
		// Domains/Entities/Flag categories/Roles/My Profile had no submenu at
		// all until now — those pages existed but were reachable only by typing
		// their hash URL (docs/PRD_RBAC_COVERAGE_COMPLETION.md §3).
		$submenus = [
			'dashboard'         => [ __( 'Dashboard', 'pukat' ),               PermissionRegistry::capability_for( 'dashboard.view' ),               '' ],
			'master_playbooks'  => [ __( 'Master Playbooks', 'pukat' ),        PermissionRegistry::capability_for( 'master_playbooks.view' ),        '#/master/playbooks' ],
			'master_smtp'       => [ __( 'Master Sending Profiles', 'pukat' ), PermissionRegistry::capability_for( 'master_sending_profiles.view' ), '#/master/sending-profiles' ],
			'master_emails'     => [ __( 'Master Email Templates', 'pukat' ),  PermissionRegistry::capability_for( 'master_email_templates.view' ),  '#/master/email-templates' ],
			'master_landings'   => [ __( 'Master Landing Pages', 'pukat' ),    PermissionRegistry::capability_for( 'master_landing_pages.view' ),    '#/master/landing-pages' ],
			// `master_entities.view` is `shared` (My Profile self-service needs
			// it) and `flags.view` likewise — the admin oversight pages are
			// gated by the admin-only `.oversee`/`.edit` instead, same choice
			// `appRoutes.jsx` makes for these two routes.
			'master_entities'   => [ __( 'Entities', 'pukat' ),                PermissionRegistry::capability_for( 'master_entities.oversee' ),      '#/master/entities' ],
			'master_flags'      => [ __( 'Flag Categories', 'pukat' ),         PermissionRegistry::capability_for( 'flags.edit' ),                   '#/master/flags' ],
			'master_domains'    => [ __( 'Domains', 'pukat' ),                 PermissionRegistry::capability_for( 'domains.view' ),                 '#/master/domains' ],
			// Deliberately `read`, not a registry key: My Profile only ever
			// touches the logged-in user's own data, so it is ungated in
			// `appRoutes.jsx` too (docs/PRD_USER_PROFILE.md §9).
			'my_profile'        => [ __( 'My Profile', 'pukat' ),              'read',                                                               '#/admin/my-profile' ],
			'users'             => [ __( 'User Access', 'pukat' ),             PermissionRegistry::capability_for( 'users.view' ),                   '#/admin/users' ],
			'roles'             => [ __( 'Roles', 'pukat' ),                   PermissionRegistry::capability_for( 'users.manage_roles' ),           '#/admin/roles' ],
			'settings'          => [ __( 'Settings', 'pukat' ),                PermissionRegistry::capability_for( 'settings.view' ),                '#/admin/settings' ],
		];

		// Every page above lives behind the panel's own door, so a role without
		// `admin_panel.view` must not get these submenus registered at all —
		// not merely be redirected after clicking one.
		//
		// This guard is what keeps the per-page capabilities above from
		// *widening* access: most of them (`dashboard.view`, `master_*.view`,
		// `domains.view`) are `shared`, held by Operator/Viewer/Reviewer too.
		// Without the guard, WordPress would render the Pukat menu for those
		// roles — core only drops a top-level menu when the user lacks the
		// parent capability AND no submenu is accessible (wp-admin/includes/
		// menu.php, the "Remove menus that have no accessible submenus" loop)
		// — and every item would dead-end in AdminPage's redirect to /pukat.
		// Before this change all submenus were gated by the legacy
		// `pukat_manage_settings`, which produced the same effect implicitly.
		//
		// The 'Open Front Page' link below stays outside the guard: it is the
		// one item panel-less roles are meant to see, exactly as today.
		$can_open_panel = current_user_can( PermissionRegistry::capability_for( 'admin_panel.view' ) );

		foreach ( $can_open_panel ? $submenus : [] as $slug => $args ) {
			[ $title, $capability, $hash ] = $args;

			$hook = add_submenu_page(
				self::MENU_SLUG,
				$title . ' — Pukat',
				$title,
				$capability,
				self::MENU_SLUG . '_' . $slug,
				'__return_empty_string' // never called; load-{hook} exits first
			);
			if ( $hook ) {
				add_action( 'load-' . $hook, static function () use ( $hash ): void {
					AdminPage::render_standalone( $hash );
				} );
			}
		}

		// Add a direct link to the front page from WP Admin sidebar.
		// Redirect happens on load-{hook} (fires before any HTML output),
		// same as every submenu above — doing it from the page callback
		// itself is too late: WP has already started streaming the admin
		// chrome by then, so wp_redirect() fails silently with "headers
		// already sent" and the user is stranded on a blank admin page.
		$frontend_hook = add_submenu_page(
			self::MENU_SLUG,
			__( 'Open Front Page', 'pukat' ),
			'Open App (/pukat)',
			'read',
			self::MENU_SLUG . '_frontend',
			'__return_empty_string'
		);
		if ( $frontend_hook ) {
			add_action( 'load-' . $frontend_hook, static function (): void {
				wp_redirect( home_url( '/pukat' ) );
				exit;
			} );
		}

		// Remove the duplicate top-level item that WP auto-creates.
		remove_submenu_page( self::MENU_SLUG, self::MENU_SLUG );
	}

	/**
	 * Returns a base64-encoded SVG icon for the menu.
	 *
	 * @return string
	 */
	private function get_menu_icon(): string {
		// Shield with hook icon — inline SVG as data URI.
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"/>
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
		</svg>';

		return 'data:image/svg+xml;base64,' . base64_encode( $svg );
	}
}
