<?php
/**
 * Admin menu registration.
 *
 * @package Pukat\Admin
 */

declare(strict_types=1);

namespace Pukat\Admin;

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
		// Capability is admin-only: the admin panel's whole domain is Pukat
		// admin/management features, operational work happens in the /pukat
		// front page (see comment below) — 'read' (WP's default, held by
		// every role including Subscriber) let any logged-in user load this
		// page at all, which was the actual gap, not the per-submenu gates.
		$top_hook = add_menu_page(
			__( 'Pukat', 'pukat' ),
			__( 'Pukat', 'pukat' ),
			'pukat_manage_settings',
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
		$submenus = [
			'dashboard'         => [ __( 'Dashboard', 'pukat' ),          'pukat_manage_settings',  '' ],
			'master_playbooks'  => [ __( 'Master Playbooks', 'pukat' ),   'pukat_manage_settings',  '#/master/playbooks' ],
			'master_smtp'       => [ __( 'Master Sending Profiles', 'pukat' ), 'pukat_manage_settings', '#/master/sending-profiles' ],
			'master_emails'     => [ __( 'Master Email Templates', 'pukat' ), 'pukat_manage_settings', '#/master/email-templates' ],
			'master_landings'   => [ __( 'Master Landing Pages', 'pukat' ), 'pukat_manage_settings', '#/master/landing-pages' ],
			'users'             => [ __( 'User Access', 'pukat' ),        'pukat_manage_users',     '#/admin/users' ],
			'settings'          => [ __( 'Settings', 'pukat' ),           'pukat_manage_settings',  '#/admin/settings' ],
		];

		foreach ( $submenus as $slug => $args ) {
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
		add_submenu_page(
			self::MENU_SLUG,
			__( 'Open Front Page', 'pukat' ),
			'Open App (/pukat)',
			'read',
			self::MENU_SLUG . '_frontend',
			static function (): void {
				wp_redirect( home_url( '/pukat' ) );
				exit;
			}
		);

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
