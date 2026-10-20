<?php
/**
 * Pre-React theme bootstrap for the SPA shells.
 *
 * @package Pukat\Core
 */

declare(strict_types=1);

namespace Pukat\Core;

/**
 * Class ThemeBoot
 *
 * Applies the stored light/dark preference to <html> before the React bundle
 * parses, so the page never flashes the wrong theme. The preference itself
 * lives in localStorage under the same key as pukat-app/src/utils/theme.js
 * ('pukat:theme'); this is only the paint-ahead, React still owns the state.
 *
 * Also sets the two splash variables inline so the PHP loading screen below
 * matches — inline so it holds even in Vite dev mode, where index.css is
 * injected by JS and the stylesheet's own :root block is not there yet.
 */
class ThemeBoot {

	/**
	 * localStorage key shared with src/utils/theme.js.
	 */
	public const STORAGE_KEY = 'pukat:theme';

	/**
	 * Output the blocking <script> that pre-applies the theme.
	 *
	 * Must be emitted in <head>, before any themed markup.
	 */
	public static function render_boot_script(): void {
		$key = self::STORAGE_KEY;
		?>
		<script>
			(function () {
				try {
					var stored = null;
					try { stored = window.localStorage.getItem('<?php echo esc_js( $key ); ?>'); } catch (e) {}
					var dark = stored === 'dark' || (
						stored !== 'light' &&
						window.matchMedia &&
						window.matchMedia('(prefers-color-scheme: dark)').matches
					);
					var root = document.documentElement;
					root.classList.toggle('dark', dark);
					root.dataset.pukatTheme = dark ? 'dark' : 'light';
					root.style.colorScheme = dark ? 'dark' : 'light';
					root.style.setProperty('--pk-splash-bg', dark ? '15 22 41' : '249 250 251');
					root.style.setProperty('--pk-splash-fg', '108 99 255');
				} catch (e) {}
			})();
		</script>
		<?php
	}

	/**
	 * Background for the shell <body> and the splash, as a CSS value.
	 *
	 * The fallback keeps the original navy if the boot script never ran
	 * (JS disabled), which is also what index.css resolves to in dark mode.
	 */
	public static function splash_background(): string {
		return 'rgb(var(--pk-splash-bg, 15 22 41))';
	}

	/**
	 * Accent colour for the splash spinner/label.
	 */
	public static function splash_accent(): string {
		return 'rgb(var(--pk-splash-fg, 108 99 255))';
	}
}
