<?php
/**
 * Frontend router — registers the /pukat rewrite rule and intercepts the template.
 *
 * @package Pukat\Frontend
 */

declare(strict_types=1);

namespace Pukat\Frontend;

/**
 * Class FrontendRouter
 *
 * Registers a custom rewrite rule so that WordPress serves the Pukat
 * React SPA at the /pukat URL without needing a WP page to exist.
 */
class FrontendRouter {

	/** @var string The URL slug for the front page. */
	const SLUG = 'pukat';

	/**
	 * Register WordPress hooks. Called during plugin init.
	 */
	public function register(): void {
		add_action( 'init',             [ $this, 'add_rewrite_rules' ] );
		add_filter( 'query_vars',       [ $this, 'add_query_vars' ] );
		add_filter( 'template_include', [ $this, 'intercept_template' ], 999 );
	}

	/**
	 * Add the /pukat rewrite rule.
	 * Matches /pukat and /pukat/* (for deep-linking future sub-routes).
	 */
	public function add_rewrite_rules(): void {
		add_rewrite_rule(
			'^' . self::SLUG . '(/.*)?$',
			'index.php?pukat_frontend=1',
			'top'
		);
	}

	/**
	 * Register the custom query var so WP doesn't strip it.
	 *
	 * @param array $vars Existing query vars.
	 * @return array
	 */
	public function add_query_vars( array $vars ): array {
		$vars[] = 'pukat_frontend';
		return $vars;
	}

	/**
	 * Intercept the template and render the Pukat frontend SPA instead.
	 *
	 * @param string $template The template file WP would normally use.
	 * @return string
	 */
	public function intercept_template( string $template ): string {
		if ( get_query_var( 'pukat_frontend' ) ) {
			FrontendPage::render();
			return '';
		}
		return $template;
	}

	/**
	 * Flush rewrite rules — call once on plugin activation.
	 */
	public static function flush(): void {
		flush_rewrite_rules();
	}
}
