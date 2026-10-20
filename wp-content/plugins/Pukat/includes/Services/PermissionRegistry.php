<?php
/**
 * RBAC permission registry.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * Whitelist registry for RBAC permission keys.
 *
 * Every permission key a role can be granted lives here — a `menu.view` key
 * per sidebar item plus a `menu.action` key per meaningful action within it.
 * A menu that owns no page at all (`guardrails`, `asset_governance`) sets
 * `'has_view' => false` and contributes only its action keys, so the Roles UI
 * never shows a `.view` toggle that nothing reads.
 * Roles only ever grant/revoke keys that already exist in this list (see
 * `docs/PRD_RBAC.md` §5.2); admins cannot invent new permission strings from
 * the UI, only toggle the ones a developer registered here. Each key maps
 * 1:1 to one WP capability string, so enforcement everywhere else stays a
 * plain `current_user_can()` call.
 *
 * `view_gate`/action gate values are seed hints consumed by
 * `Activator::seed_rbac_defaults()` to reproduce today's exact behavior for
 * the built-in Admin/Operator/Viewer roles (see docs/IMPLEMENTATION_PLAN_RBAC.md
 * Phase 1) — `shared` means anyone with a Pukat role can view it (mirrors
 * `RestController::permission_read()`), `admin` means only Admin/WP
 * administrator (mirrors `permission_admin()`). Action gates of `operator`
 * mirror `permission_manage()`, `admin` mirrors `permission_admin()`.
 */
class PermissionRegistry {

	private const CAPABILITY_PREFIX = 'pukat_';

	/**
	 * Menu keys that resolve to an actual page in the frontend SPA (`/pukat`),
	 * mapped to that page's canonical hash route — the same paths
	 * `frontendNavGroups` in `pukat-app/src/config/appRoutes.jsx` renders in
	 * the sidebar. Only these are valid `wp_pukat_role_meta.landing_menu`
	 * targets: menus absent here (settings, users, audit_logs, domains,
	 * sending_profile_references) live only in the wp-admin panel, which has
	 * no single "first access" landing page to redirect to.
	 *
	 * @var array<string, string>
	 */
	private const LANDING_MENU_ROUTES = [
		'dashboard'               => '/dashboard',
		'calendar'                => '/calendar',
		'campaigns'               => '/campaigns',
		'monitoring'              => '/monitoring',
		'master_playbooks'        => '/playbooks',
		'master_sending_profiles' => '/sending-profiles',
		'master_email_templates'  => '/email-templates',
		'master_landing_pages'    => '/landing-pages',
		'reports'                 => '/reports',
		'post_sim'                => '/post/quiz',
	];

	private const MENUS = [
		'dashboard'                => [
			'label'     => 'Dashboard',
			'group'     => 'Overview',
			'view_gate' => 'shared',
			'actions'   => [],
		],
		'master_playbooks'         => [
			'label'     => 'Master Playbooks',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'create'  => 'operator',
				'edit'    => 'operator',
				'delete'  => 'operator',
				'approve' => 'approve',
			],
		],
		'master_sending_profiles'  => [
			'label'     => 'Master Sending Profiles',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'create'        => 'admin',
				'edit'          => 'admin',
				'delete'        => 'admin',
				'test'          => 'admin',
				'assign_entity' => 'admin',
			],
		],
		'master_email_templates'   => [
			'label'     => 'Master Email Templates',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'create'        => 'operator',
				'edit'          => 'operator',
				'delete'        => 'operator',
				'approve'       => 'approve',
				'assign_entity' => 'operator',
			],
		],
		'master_landing_pages'     => [
			'label'     => 'Master Landing Pages',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'create'        => 'operator',
				'edit'          => 'operator',
				'delete'        => 'operator',
				'approve'       => 'approve',
				'assign_entity' => 'operator',
			],
		],
		// Entity Profile — descriptive metadata (contact, description, status)
		// plus the per-entity email-domain allow-list. Corrected 2026-09-25
		// (see docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md's revision note): this
		// is NOT admin-only governance content like Master Sending Profiles —
		// an entity's own non-admin users self-manage their own profile/allow-
		// list (EntityProfileService enforces the actual per-entity scoping;
		// these gates only control whether a role can touch the feature AT
		// ALL, same role-vs-entity split as everywhere else in this registry).
		// create/delete stay admin-only — that's genuinely governance (which
		// entities exist at all), not content only the entity itself knows.
		'master_entities'          => [
			'label'     => 'Master Entities',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'create'  => 'admin',
				'edit'    => 'operator',
				'delete'  => 'admin',
				// Admin oversight page (Master Entities): cross-entity guardrail
				// monitoring + enable/disable. Self-service editing lives on
				// My Profile instead — see the PRD's §14.
				'oversee' => 'admin',
			],
		],
		// Flag categories (Phishing/Scam/External/Spoofing, ...) are one shared
		// taxonomy — admin-managed. Flag examples are per-entity galleries the
		// entity's own users upload to from My Profile; FlagExampleService
		// enforces which entity's rows a user may touch.
		// See docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md §9.
		'flags'                    => [
			'label'     => 'Flag Categories',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'create' => 'admin',
				'edit'   => 'admin',
				'delete' => 'admin',
			],
		],
		'flag_examples'            => [
			'label'     => 'Flag Examples',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'upload' => 'operator',
				'delete' => 'operator',
			],
		],
		// Per-entity education page per Flag category, authored on My Profile >
		// Flags. FlagPageService enforces which entity's page a user may touch.
		// See docs/PRD_FLAG_EDUCATION_PAGES.md.
		'flag_pages'               => [
			'label'     => 'Flag Education Pages',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'edit'    => 'operator',
				'publish' => 'operator',
			],
		],
		'sending_profile_references' => [
			'label'     => 'Sending Profile References',
			'group'     => 'Master Library',
			'view_gate' => 'shared',
			'actions'   => [
				'create'   => 'operator',
				'edit'     => 'operator',
				'delete'   => 'operator',
				'validate' => 'operator',
			],
		],
		'domains'                  => [
			'label'     => 'Domains',
			'group'     => 'Master Of Simulation',
			'view_gate' => 'shared',
			'actions'   => [
				'create'    => 'operator',
				'edit'      => 'operator',
				'delete'    => 'operator',
				'validate'  => 'operator',
				'authorize' => 'operator',
			],
		],
		// The wp-admin panel's front door (`/wp-admin/admin.php?page=pukat_*`):
		// `AdminMenu`'s top-level menu plus `AdminPage::render_standalone()`.
		// A PREREQUISITE, not a replacement — every page inside the panel is
		// still gated by its own key (`settings.view`, `users.view`,
		// `master_*.view`, ...). WordPress hides the whole submenu tree when
		// the top-level capability is missing, so a role without this key sees
		// no Pukat submenu at all even when it holds those page keys.
		// Admin-gated to reproduce exactly who can open the panel today (the
		// legacy `pukat_manage_settings` holders: `pukat_admin` + WP
		// `administrator`) — see docs/PRD_RBAC_COVERAGE_COMPLETION.md §9.
		'admin_panel'              => [
			'label'     => 'Admin Panel (wp-admin)',
			'group'     => 'Admin',
			'view_gate' => 'admin',
			'actions'   => [],
		],
		'users'                    => [
			'label'     => 'User Access',
			'group'     => 'Admin',
			'view_gate' => 'admin',
			'actions'   => [
				'assign_role'  => 'admin',
				'manage_roles' => 'admin',
			],
		],
		'settings'                 => [
			'label'     => 'Settings',
			'group'     => 'Admin',
			'view_gate' => 'admin',
			'actions'   => [
				'edit' => 'admin',
			],
		],
		'audit_logs'               => [
			'label'     => 'Audit Log',
			'group'     => 'Admin',
			'view_gate' => 'admin',
			'actions'   => [],
		],
		'campaigns'                => [
			'label'     => 'New Campaign',
			'group'     => 'Simulation',
			'view_gate' => 'shared',
			'actions'   => [
				'create'   => 'operator',
				'edit'     => 'operator',
				'delete'   => 'operator',
				'launch'   => 'operator',
				// Renamed from `cancel` — docs/PRD_CAMPAIGN_GROUP_MONITORING.md §6.4
				// merged cancel/recall/complete into one action, always ending in
				// `status = 'completed'`. See Activator.php's RBAC migration for
				// the capability re-seed (existing `pukat_campaigns_cancel`
				// grants become `pukat_campaigns_complete`).
				'complete' => 'operator',
			],
		],
		// No dedicated page — same class of registry-only entry as `audit_logs`.
		// `bypass` gates the `bypass_email_domain_guardrail` flag on
		// CampaignRunService::create() (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md
		// FR-8): lets a request past the target-email-domain guardrail even when
		// some targets fail it. Admin-only by default, on purpose — this isn't a
		// feature toggle, it's an override of a data-integrity check.
		'guardrails'               => [
			'label'    => 'Guardrails',
			'group'    => 'Simulation',
			'has_view' => false,
			'actions'  => [
				'bypass' => 'admin',
			],
		],
		// No page either — the single key behind `current_user_can_admin_assets()`,
		// duplicated verbatim across 7 services + GoPhishProxy. Grants the
		// right to cross entity boundaries: write `General` assets and assets
		// belonging to another entity. Role still decides WHICH FEATURE is
		// reachable and entity-scoping still decides WHICH ROWS (the split in
		// docs/PRD_RBAC.md §4 is unchanged) — this key only makes "who may
		// cross the boundary" configurable instead of hardcoded to the legacy
		// `pukat_manage_settings` capability.
		// Blast radius is large by design: admin-gated, and it lands on exactly
		// the roles that hold `pukat_manage_settings` today, so no one's
		// effective access changes on upgrade
		// (docs/PRD_RBAC_COVERAGE_COMPLETION.md §9).
		'asset_governance'         => [
			'label'    => 'Asset Governance',
			'group'    => 'Governance',
			'has_view' => false,
			'actions'  => [
				'manage_all' => 'admin',
			],
		],
		// `monitoring`/`calendar` split out of `campaigns.view` 2026-08-07 so
		// the Roles UI can control "Monitoring"/"Simulation Calendar"
		// independently instead of only as a bundle with "New Campaign" (all
		// 3 previously shared one `campaigns.view` toggle). Unlike every
		// other menu in this registry, these two gate NO backend REST
		// resource — confirmed by reading every GET handler in
		// CampaignController/CampaignRunController, all still uniformly
		// gated by `campaigns.view`; the standalone /calendar and /monitoring
		// pages (Calendar.jsx, Performing.jsx) are static mockups with zero
		// data-fetching calls. Their `.view` key therefore only ever gates
		// client-side route/nav visibility via `<PermissionRoute>` (see its
		// own doc comment: "Frontend-only UX guard, not enforcement") — do
		// not assume a backend capability check exists for these two, there
		// isn't one, by design, unless/until these pages get real data.
		'monitoring'               => [
			'label'     => 'Monitoring',
			'group'     => 'Simulation',
			'view_gate' => 'shared',
			'actions'   => [],
		],
		'calendar'                 => [
			'label'     => 'Simulation Calendar',
			'group'     => 'Overview',
			'view_gate' => 'shared',
			'actions'   => [],
		],
		// `playbooks` and `sending_profiles` (non-master) menus were removed
		// 2026-08-07 — confirmed zero backend consumers anywhere (nothing
		// ever called require_capability() with either key). The apps'
		// Playbooks/Sending Profiles nav items are gated by
		// `master_playbooks.view`/`master_sending_profiles.view` instead
		// (same master-catalog data the admin panel's Master Library pages
		// show — there was never a separate resource these keys could have
		// meaningfully gated). Keeping them in the registry only made the
		// Roles UI's "Simulation" group look like it independently
		// controlled apps nav visibility for those two, when toggling it
		// silently did nothing.
		'email_templates'          => [
			'label'     => 'Email Templates (GoPhish)',
			'group'     => 'Campaign Setup',
			'view_gate' => 'shared',
			'actions'   => [
				'create' => 'operator',
				'edit'   => 'operator',
				'delete' => 'operator',
			],
		],
		'landing_pages'            => [
			'label'     => 'Landing Pages (GoPhish)',
			'group'     => 'Campaign Setup',
			'view_gate' => 'shared',
			'actions'   => [
				'create' => 'operator',
				'edit'   => 'operator',
				'delete' => 'operator',
			],
		],
		'reports'                  => [
			'label'     => 'Reports',
			'group'     => 'Reports',
			'view_gate' => 'shared',
			'actions'   => [],
		],
		'post_sim'                 => [
			'label'     => 'Post Simulation',
			'group'     => 'Post Sim',
			'view_gate' => 'shared',
			'actions'   => [
				'manage' => 'operator',
			],
		],
	];

	/**
	 * Every permission key with its metadata, flattened from `self::MENUS`.
	 *
	 * @return array<string, array{key: string, capability: string, menu: string, action: string, label: string, group: string, gate: string}>
	 */
	public static function all(): array {
		$entries = [];

		foreach ( self::MENUS as $menu => $config ) {
			// Menus with `has_view => false` are registry-only entries that
			// gate an action without owning a page (see the const's own doc
			// comment) — they emit no `.view` key at all, instead of emitting
			// one nothing ever checks.
			if ( $config['has_view'] ?? true ) {
				$view_key             = "{$menu}.view";
				$entries[ $view_key ] = [
					'key'        => $view_key,
					'capability' => self::capability_for( $view_key ),
					'menu'       => $menu,
					'action'     => 'view',
					'label'      => $config['label'],
					'group'      => $config['group'],
					'gate'       => $config['view_gate'],
				];
			}

			foreach ( $config['actions'] as $action => $gate ) {
				$key             = "{$menu}.{$action}";
				$entries[ $key ] = [
					'key'        => $key,
					'capability' => self::capability_for( $key ),
					'menu'       => $menu,
					'action'     => $action,
					'label'      => $config['label'],
					'group'      => $config['group'],
					'gate'       => $gate,
				];
			}
		}

		return $entries;
	}

	/**
	 * Map a permission key (`menu.action`) to its WP capability string.
	 */
	public static function capability_for( string $key ): string {
		return self::CAPABILITY_PREFIX . str_replace( '.', '_', $key );
	}

	/**
	 * Whether a permission key exists in the registry — the whitelist check
	 * every role-permission mutation must pass before touching WP roles.
	 */
	public static function has_key( string $key ): bool {
		return array_key_exists( $key, self::all() );
	}

	/**
	 * All permission keys whose seed gate matches (`shared`, `operator`, or `admin`).
	 * Consumed by `Activator::seed_rbac_defaults()` — not meant for runtime
	 * authorization decisions, those always go through `capability_for()` +
	 * `current_user_can()` on a specific key.
	 *
	 * @return string[]
	 */
	public static function keys_by_gate( string $gate ): array {
		return array_keys( array_filter( self::all(), static fn( array $entry ): bool => $entry['gate'] === $gate ) );
	}

	/**
	 * All permission keys, grouped by sidebar group label — the shape the
	 * `GET /permissions/registry` endpoint and the Roles admin UI render.
	 *
	 * @return array<string, array>
	 */
	public static function grouped(): array {
		$grouped = [];

		foreach ( self::all() as $entry ) {
			$grouped[ $entry['group'] ][] = $entry;
		}

		return $grouped;
	}

	/**
	 * Resolve a `landing_menu` value (a bare menu key, e.g. 'monitoring') to
	 * its frontend SPA hash route (e.g. '/monitoring'). Returns null for an
	 * empty value or a menu with no frontend route (see `LANDING_MENU_ROUTES`)
	 * — callers should fall back to the default `/dashboard` route in that case.
	 */
	public static function landing_route_for_menu( string $menu ): ?string {
		return self::LANDING_MENU_ROUTES[ $menu ] ?? null;
	}
}
