<?php
/**
 * Encryption service for sensitive option values (GoPhish API key).
 *
 * @package Pukat\Services
 */

declare(strict_types=1);

namespace Pukat\Services;

/**
 * Class EncryptionService
 *
 * AES-256-GCM encryption using WordPress AUTH_KEY as the passphrase.
 * Falls back to base64 if openssl extension is unavailable (not recommended for production).
 */
class EncryptionService {

	private const CIPHER    = 'aes-256-gcm';
	private const TAG_LEN   = 16;
	private const IV_LEN    = 12;
	private const PREFIX    = 'pukat_enc:';

	/**
	 * Encrypt a plaintext string.
	 *
	 * @param string $plaintext Value to encrypt.
	 * @return string Encrypted, base64-encoded value prefixed with 'pukat_enc:'.
	 */
	public static function encrypt( string $plaintext ): string {
		if ( ! extension_loaded( 'openssl' ) || empty( $plaintext ) ) {
			return $plaintext;
		}

		$key = self::derive_key();
		$iv  = random_bytes( self::IV_LEN );
		$tag = '';

		$ciphertext = openssl_encrypt(
			$plaintext,
			self::CIPHER,
			$key,
			OPENSSL_RAW_DATA,
			$iv,
			$tag,
			'',
			self::TAG_LEN
		);

		if ( false === $ciphertext ) {
			return $plaintext; // fallback — don't lose the data.
		}

		return self::PREFIX . base64_encode( $iv . $tag . $ciphertext );
	}

	/**
	 * Decrypt a value previously encrypted by ::encrypt().
	 *
	 * @param string $encrypted_value The stored encrypted value.
	 * @return string Decrypted plaintext, or the original string if not encrypted by us.
	 */
	public static function decrypt( string $encrypted_value ): string {
		if ( ! extension_loaded( 'openssl' ) || ! str_starts_with( $encrypted_value, self::PREFIX ) ) {
			return $encrypted_value;
		}

		$raw = base64_decode( substr( $encrypted_value, strlen( self::PREFIX ) ) );
		if ( strlen( $raw ) < self::IV_LEN + self::TAG_LEN ) {
			return $encrypted_value;
		}

		$iv         = substr( $raw, 0, self::IV_LEN );
		$tag        = substr( $raw, self::IV_LEN, self::TAG_LEN );
		$ciphertext = substr( $raw, self::IV_LEN + self::TAG_LEN );
		$key        = self::derive_key();

		$plaintext = openssl_decrypt(
			$ciphertext,
			self::CIPHER,
			$key,
			OPENSSL_RAW_DATA,
			$iv,
			$tag
		);

		return ( false === $plaintext ) ? $encrypted_value : $plaintext;
	}

	/**
	 * Derive a 256-bit key from WordPress secret keys.
	 *
	 * @return string 32-byte binary key.
	 */
	private static function derive_key(): string {
		$secret = defined( 'AUTH_KEY' ) ? AUTH_KEY : 'pukat-default-key-change-me';
		$salt   = defined( 'AUTH_SALT' ) ? AUTH_SALT : 'pukat-salt';
		return hash_hkdf( 'sha256', $secret . $salt, 32, 'pukat-encryption-v1' );
	}
}
