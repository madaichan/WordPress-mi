<?php
/**
 * Adds the meta_entity user meta value to the WordPress users list table.
 *
 * @package WordPressMI
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_filter( 'manage_users_columns', 'wpmi_add_meta_entity_user_column' );
add_filter( 'manage_users_custom_column', 'wpmi_render_meta_entity_user_column', 10, 3 );

/**
 * Add the Meta Entity column to /wp-admin/users.php.
 *
 * @param array<string, string> $columns Existing users table columns.
 * @return array<string, string>
 */
function wpmi_add_meta_entity_user_column( array $columns ): array {
	$updated_columns = [];

	foreach ( $columns as $key => $label ) {
		$updated_columns[ $key ] = $label;

		if ( 'email' === $key ) {
			$updated_columns['meta_entity'] = __( 'Meta Entity', 'default' );
		}
	}

	if ( ! isset( $updated_columns['meta_entity'] ) ) {
		$updated_columns['meta_entity'] = __( 'Meta Entity', 'default' );
	}

	return $updated_columns;
}

/**
 * Render the meta_entity value for each user row.
 *
 * @param string $output      Current column output.
 * @param string $column_name Current column name.
 * @param int    $user_id     User ID.
 * @return string
 */
function wpmi_render_meta_entity_user_column( string $output, string $column_name, int $user_id ): string {
	if ( 'meta_entity' !== $column_name ) {
		return $output;
	}

	$meta_entity = get_user_meta( $user_id, 'meta_entity', true );

	if ( '' === $meta_entity || null === $meta_entity ) {
		return '&mdash;';
	}

	if ( is_scalar( $meta_entity ) ) {
		return esc_html( (string) $meta_entity );
	}

	return esc_html( wp_json_encode( $meta_entity ) ?: '' );
}
