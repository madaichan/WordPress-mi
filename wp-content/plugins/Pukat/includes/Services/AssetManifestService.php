<?php
/**
 * Vite build manifest resolver.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * Resolves the hashed production asset names emitted by Vite.
 */
class AssetManifestService {

	private string $dist_dir;

	private string $dist_url;

	public function __construct(
		string $dist_dir = PUKAT_PLUGIN_DIR . 'assets/dist/',
		string $dist_url = PUKAT_PLUGIN_URL . 'assets/dist/'
	) {
		$this->dist_dir = $dist_dir;
		$this->dist_url = $dist_url;
	}

	/**
	 * Get the React application entry assets.
	 *
	 * @return array{dist_dir: string, dist_url: string, js_file: string, css_file: string|null}
	 */
	public function app_entry(): array {
		$js_file  = 'assets/index.js';
		$css_file = null;
		$manifest = $this->manifest();

		if ( isset( $manifest['src/main.jsx']['file'] ) ) {
			$js_file = $manifest['src/main.jsx']['file'];
		}

		if ( isset( $manifest['src/main.jsx']['css'][0] ) ) {
			$css_file = $manifest['src/main.jsx']['css'][0];
		}

		return [
			'dist_dir' => $this->dist_dir,
			'dist_url' => $this->dist_url,
			'js_file'  => $js_file,
			'css_file' => $css_file,
		];
	}

	/**
	 * @return array<string, mixed>
	 */
	private function manifest(): array {
		$manifest_path = $this->dist_dir . '.vite/manifest.json';

		if ( ! file_exists( $manifest_path ) ) {
			return [];
		}

		$manifest = json_decode( (string) file_get_contents( $manifest_path ), true );

		return is_array( $manifest ) ? $manifest : [];
	}
}
