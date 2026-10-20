<?php
/**
 * Shared test-identity resolution for the RBAC smoke scripts.
 *
 * Several smoke scripts need "a user holding exactly role X" to assert a
 * permission matrix. They used to hardcode the user IDs of whichever install
 * they were first written against (`$admin_id = 2; // john_editor`), which
 * rots silently: on an install where user 2 holds a different role, every
 * assertion for that identity fails (or the script fatals on an unexpected
 * 403) and reports a regression that isn't one.
 *
 * Require this file after wp-load.php and resolve identities by role instead.
 *
 * @package Pukat
 */

declare(strict_types=1);

if ( ! function_exists( 'pukat_smoke_resolve_identity' ) ) {

	/**
	 * A user holding $role, creating an ephemeral one when no fixture fits.
	 *
	 * A candidate must hold the target role and NOT be a WP `administrator`:
	 * that role alone grants every Pukat capability, so an administrator can
	 * never stand in for a narrower role.
	 *
	 * @param int[] $ephemeral Collects the IDs this call created, for cleanup.
	 */
	function pukat_smoke_resolve_identity( string $role, array &$ephemeral ): int {
		foreach ( get_users( [ 'role' => $role, 'number' => 20, 'fields' => [ 'ID' ] ] ) as $candidate ) {
			$user = get_userdata( (int) $candidate->ID );
			if ( $user && ! in_array( 'administrator', $user->roles, true ) ) {
				return (int) $user->ID;
			}
		}

		$login = 'pukat_smoke_' . str_replace( 'pukat_', '', $role ) . '_' . time();
		$id    = wp_insert_user( [
			'user_login' => $login,
			'user_pass'  => wp_generate_password(),
			'user_email' => $login . '@example.test',
			'role'       => $role,
		] );

		if ( is_wp_error( $id ) ) {
			fwrite( STDERR, "Could not create ephemeral {$role} test user: " . $id->get_error_message() . "\n" );
			exit( 1 );
		}

		$ephemeral[] = (int) $id;

		return (int) $id;
	}

	/**
	 * Print the resolved identities so a failing run says who it ran as.
	 *
	 * @param array<string, int> $identities role label => user ID.
	 */
	function pukat_smoke_print_identities( array $identities ): void {
		$parts = [];
		foreach ( $identities as $label => $user_id ) {
			$user    = get_userdata( $user_id );
			$parts[] = sprintf( '%s: %s (%d)', $label, $user ? $user->user_login : '?', $user_id );
		}
		echo 'Identities — ' . implode( ', ', $parts ) . "\n\n";
	}

	/**
	 * Delete the ephemeral users a run created.
	 *
	 * @param int[] $ephemeral IDs collected by pukat_smoke_resolve_identity().
	 * @return int[] IDs that survived deletion (empty when cleanup succeeded).
	 */
	function pukat_smoke_cleanup_identities( array $ephemeral ): array {
		require_once ABSPATH . 'wp-admin/includes/user.php';

		$leftover = [];
		foreach ( $ephemeral as $user_id ) {
			wp_delete_user( $user_id );
			if ( get_userdata( $user_id ) ) {
				$leftover[] = $user_id;
			}
		}

		return $leftover;
	}
}
