<?php
/**
 * Shared HTML/asset transforms applied when pushing a Pukat page to GoPhish.
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * Both pages Pukat pushes to GoPhish — the Flag education page and the quiz
 * page — carry images inserted from the Flag gallery, marked on their
 * `<figure>` with `data-pukat-img="{id}"` and holding a plain URL in the draft
 * (docs/PRD_FLAG_EDUCATION_PAGES.md FR-6b). On sync that URL becomes a base64
 * data URI so GoPhish serves a self-contained page, and the identity attribute
 * is dropped.
 *
 * Extracted from FlagPageSyncService when the quiz page needed the identical
 * transform (docs/IMPLEMENTATION_PLAN_QUIZ_MODULE.md Q3). Behaviour is
 * unchanged from that original, deliberately — including the limit that only a
 * double-quoted `src` is swapped, which is what buildFigureHtml() emits.
 */
class GoPhishHtmlAssets {

	private FlagExampleService $examples;

	public function __construct( ?FlagExampleService $examples = null ) {
		$this->examples = $examples ?? new FlagExampleService();
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
	 * Stable GoPhish object name fragment for an entity. GoPhish rejects
	 * duplicate names, so every per-entity object is keyed on this.
	 */
	public function slug( string $entity ): string {
		$slug = sanitize_title( $entity );

		return '' === $slug ? 'entity' : $slug;
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
