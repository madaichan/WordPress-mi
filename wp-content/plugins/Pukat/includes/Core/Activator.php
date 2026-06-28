<?php
/**
 * Plugin activator — creates DB tables and sets default options.
 *
 * @package Pukat\Core
 */

declare(strict_types=1);

namespace Pukat\Core;

/**
 * Class Activator
 *
 * Runs on plugin activation (register_activation_hook).
 */
class Activator {

	/**
	 * Activate the plugin.
	 *
	 * Creates custom database tables and sets default plugin options.
	 * Safe to run multiple times (uses dbDelta).
	 */
	public static function activate(): void {
		self::create_tables();
		self::set_default_options();
		self::add_roles();
		self::schedule_cron();

		// Register frontend rewrite rules then flush so /pukat is available immediately.
		( new \Pukat\Frontend\FrontendRouter() )->add_rewrite_rules();
		\Pukat\Frontend\FrontendRouter::flush();

		// Store the version so we can handle future migrations.
		update_option( 'pukat_version', PUKAT_VERSION );
		update_option( 'pukat_db_version', '1.0.0' );
	}

	/**
	 * Create all custom tables via dbDelta.
	 */
	private static function create_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset_collate = $wpdb->get_charset_collate();
		$prefix          = $wpdb->prefix . 'pukat_';

		$sql = [];

		// -----------------------------------------------------------------------
		// pukat_campaigns — mirror + extra metadata for GoPhish campaigns
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}campaigns (
			id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			gophish_id    BIGINT UNSIGNED DEFAULT NULL COMMENT 'GoPhish campaign ID',
			name          VARCHAR(255)    NOT NULL,
			status        VARCHAR(50)     NOT NULL DEFAULT 'draft',
			playbook_id   BIGINT UNSIGNED DEFAULT NULL,
			difficulty    TINYINT UNSIGNED DEFAULT 1 COMMENT 'PhishScale 1-5',
			scheduled_at  DATETIME        DEFAULT NULL,
			launched_at   DATETIME        DEFAULT NULL,
			completed_at  DATETIME        DEFAULT NULL,
			timezone      VARCHAR(100)    DEFAULT 'UTC',
			created_by    BIGINT UNSIGNED NOT NULL DEFAULT 0,
			created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY gophish_id (gophish_id),
			KEY status (status)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_targets — target list per campaign
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}targets (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			campaign_id  BIGINT UNSIGNED NOT NULL,
			first_name   VARCHAR(100)    NOT NULL DEFAULT '',
			last_name    VARCHAR(100)    NOT NULL DEFAULT '',
			email        VARCHAR(255)    NOT NULL,
			position     VARCHAR(255)    DEFAULT NULL,
			department   VARCHAR(255)    DEFAULT NULL,
			created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY campaign_id (campaign_id),
			KEY email (email)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_playbooks — reusable campaign configurations
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}playbooks (
			id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name                 VARCHAR(255)    NOT NULL,
			description          TEXT            DEFAULT NULL,
			gophish_template_id  BIGINT UNSIGNED DEFAULT NULL,
			gophish_page_id      BIGINT UNSIGNED DEFAULT NULL,
			gophish_smtp_id      BIGINT UNSIGNED DEFAULT NULL,
			difficulty           TINYINT UNSIGNED DEFAULT 1,
			created_by           BIGINT UNSIGNED NOT NULL DEFAULT 0,
			created_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_quiz_questions — question bank
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}quiz_questions (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			question     TEXT            NOT NULL,
			options      LONGTEXT        NOT NULL COMMENT 'JSON array of {label, value, correct}',
			explanation  TEXT            DEFAULT NULL,
			difficulty   TINYINT UNSIGNED DEFAULT 1,
			tags         VARCHAR(500)    DEFAULT NULL COMMENT 'comma-separated',
			created_by   BIGINT UNSIGNED NOT NULL DEFAULT 0,
			created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_quiz_results — quiz answers per user per campaign
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}quiz_results (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			campaign_id  BIGINT UNSIGNED NOT NULL,
			user_id      BIGINT UNSIGNED NOT NULL COMMENT 'WP user ID or 0 for email-only target',
			target_email VARCHAR(255)    NOT NULL,
			score        TINYINT UNSIGNED DEFAULT 0 COMMENT 'Percentage 0-100',
			passed       TINYINT(1)      NOT NULL DEFAULT 0,
			answers      LONGTEXT        DEFAULT NULL COMMENT 'JSON snapshot of answers',
			completed_at DATETIME        DEFAULT NULL,
			created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY campaign_id (campaign_id),
			KEY user_id (user_id)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_risk_scores — rolling risk score per user/target
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}risk_scores (
			id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			target_email VARCHAR(255)    NOT NULL,
			user_id      BIGINT UNSIGNED DEFAULT NULL,
			campaign_id  BIGINT UNSIGNED NOT NULL,
			click_score  TINYINT UNSIGNED DEFAULT 0 COMMENT '0-50',
			quiz_score   TINYINT UNSIGNED DEFAULT 0 COMMENT '0-50',
			total_score  TINYINT UNSIGNED DEFAULT 0 COMMENT '0-100',
			risk_tier    VARCHAR(20)     DEFAULT 'low' COMMENT 'low|medium|high|critical',
			created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY target_email (target_email),
			KEY risk_tier (risk_tier)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_coaching_assignments — assigned training modules
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}coaching_assignments (
			id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			target_email  VARCHAR(255)    NOT NULL,
			user_id       BIGINT UNSIGNED DEFAULT NULL,
			campaign_id   BIGINT UNSIGNED NOT NULL,
			module_name   VARCHAR(255)    NOT NULL,
			module_url    VARCHAR(500)    DEFAULT NULL,
			risk_tier     VARCHAR(20)     NOT NULL DEFAULT 'medium',
			status        VARCHAR(50)     NOT NULL DEFAULT 'pending' COMMENT 'pending|in_progress|completed',
			due_at        DATETIME        DEFAULT NULL,
			completed_at  DATETIME        DEFAULT NULL,
			created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY target_email (target_email),
			KEY campaign_id (campaign_id)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_socialization_logs — delivery tracking for socialization emails
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}socialization_logs (
			id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			campaign_id   BIGINT UNSIGNED DEFAULT NULL,
			recipient     VARCHAR(255)    NOT NULL,
			type          VARCHAR(50)     NOT NULL DEFAULT 'pre' COMMENT 'pre|post|debrief|coaching',
			subject       VARCHAR(500)    DEFAULT NULL,
			status        VARCHAR(50)     NOT NULL DEFAULT 'sent',
			opened_at     DATETIME        DEFAULT NULL,
			sent_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY campaign_id (campaign_id),
			KEY recipient (recipient)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_audit_logs — immutable audit trail
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}audit_logs (
			id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			user_id    BIGINT UNSIGNED NOT NULL DEFAULT 0,
			user_email VARCHAR(255)    NOT NULL DEFAULT '',
			action     VARCHAR(255)    NOT NULL COMMENT 'e.g. campaign.created, user.login',
			object_type VARCHAR(100)   DEFAULT NULL,
			object_id  BIGINT UNSIGNED DEFAULT NULL,
			details    LONGTEXT        DEFAULT NULL COMMENT 'JSON payload',
			ip_address VARCHAR(45)     DEFAULT NULL,
			user_agent VARCHAR(500)    DEFAULT NULL,
			created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY user_id (user_id),
			KEY action (action),
			KEY created_at (created_at)
		) $charset_collate;";

		foreach ( $sql as $query ) {
			dbDelta( $query );
		}
	}

	/**
	 * Write default plugin options if they don't exist.
	 */
	private static function set_default_options(): void {
		$defaults = [
			'pukat_gophish_url'     => '',
			'pukat_gophish_api_key' => '', // stored encrypted
			'pukat_org_name'        => get_bloginfo( 'name' ),
			'pukat_org_logo'        => '',
			'pukat_timezone'        => get_option( 'timezone_string', 'UTC' ),
			'pukat_quiz_pass_score' => 70,
			'pukat_risk_thresholds' => wp_json_encode( [
				'low'      => [ 'min' => 0,  'max' => 29 ],
				'medium'   => [ 'min' => 30, 'max' => 59 ],
				'high'     => [ 'min' => 60, 'max' => 79 ],
				'critical' => [ 'min' => 80, 'max' => 100 ],
			] ),
			'pukat_blackout_dates'  => wp_json_encode( [] ),
		];

		foreach ( $defaults as $key => $value ) {
			if ( false === get_option( $key ) ) {
				add_option( $key, $value );
			}
		}
	}

	/**
	 * Register custom WP roles for Pukat.
	 */
	private static function add_roles(): void {
		// pukat_admin — full access.
		add_role(
			'pukat_admin',
			__( 'Pukat Admin', 'pukat' ),
			[
				'read'                    => true,
				'pukat_manage_campaigns'  => true,
				'pukat_view_reports'      => true,
				'pukat_manage_users'      => true,
				'pukat_manage_settings'   => true,
			]
		);

		// pukat_operator — run campaigns, view reports.
		add_role(
			'pukat_operator',
			__( 'Pukat Operator', 'pukat' ),
			[
				'read'                   => true,
				'pukat_manage_campaigns' => true,
				'pukat_view_reports'     => true,
			]
		);

		// pukat_viewer — read-only.
		add_role(
			'pukat_viewer',
			__( 'Pukat Viewer', 'pukat' ),
			[
				'read'               => true,
				'pukat_view_reports' => true,
			]
		);

		// Grant WP administrators all Pukat caps.
		$admin_role = get_role( 'administrator' );
		if ( $admin_role ) {
			$admin_role->add_cap( 'pukat_manage_campaigns' );
			$admin_role->add_cap( 'pukat_view_reports' );
			$admin_role->add_cap( 'pukat_manage_users' );
			$admin_role->add_cap( 'pukat_manage_settings' );
		}
	}

	/**
	 * Schedule the recurring cron job for syncing campaign results.
	 */
	private static function schedule_cron(): void {
		if ( ! wp_next_scheduled( 'pukat_process_campaign_results' ) ) {
			wp_schedule_event( time(), 'every_5_minutes', 'pukat_process_campaign_results' );
		}
	}
}
