<?php
/**
 * Plugin activator — creates DB tables and sets default options.
 *
 * @package Pukat\Core
 */

declare(strict_types=1);

namespace Pukat\Core;

use Pukat\Services\PermissionRegistry;

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
		self::seed_rbac_defaults();
		self::schedule_cron();

		// Register frontend rewrite rules then flush so /pukat is available immediately.
		( new \Pukat\Frontend\FrontendRouter() )->add_rewrite_rules();
		\Pukat\Frontend\FrontendRouter::flush();

		// Store the version so we can handle future migrations.
		update_option( 'pukat_version', PUKAT_VERSION );
		update_option( 'pukat_db_version', '1.7.0' );
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
			entity               VARCHAR(255)    NOT NULL DEFAULT 'General',
			created_by           BIGINT UNSIGNED NOT NULL DEFAULT 0,
			created_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_email_template_masters — WordPress-owned email template masters
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}email_template_masters (
			id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name        VARCHAR(255)    NOT NULL,
			description TEXT            DEFAULT NULL,
			category    VARCHAR(100)    DEFAULT NULL,
			entity      VARCHAR(255)    NOT NULL DEFAULT 'General',
			status      VARCHAR(50)     NOT NULL DEFAULT 'draft',
			created_by  BIGINT UNSIGNED NOT NULL DEFAULT 0,
			updated_by  BIGINT UNSIGNED DEFAULT NULL,
			created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY status (status),
			KEY entity (entity)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_email_template_versions — versioned email template content
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}email_template_versions (
			id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			template_master_id BIGINT UNSIGNED NOT NULL,
			version            INT UNSIGNED    NOT NULL DEFAULT 1,
			subject            VARCHAR(500)    NOT NULL DEFAULT '',
			html_body          LONGTEXT        NOT NULL,
			text_body          LONGTEXT        DEFAULT NULL,
			variables_json     LONGTEXT        DEFAULT NULL,
			language           VARCHAR(20)     DEFAULT NULL,
			status             VARCHAR(50)     NOT NULL DEFAULT 'draft',
			created_by         BIGINT UNSIGNED NOT NULL DEFAULT 0,
			updated_by         BIGINT UNSIGNED DEFAULT NULL,
			approved_by        BIGINT UNSIGNED DEFAULT NULL,
			created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			approved_at        DATETIME        DEFAULT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY template_version (template_master_id, version),
			KEY template_master_id (template_master_id),
			KEY status (status)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_landing_page_masters — WordPress-owned landing page masters
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}landing_page_masters (
			id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name        VARCHAR(255)    NOT NULL,
			description TEXT            DEFAULT NULL,
			category    VARCHAR(100)    DEFAULT NULL,
			entity      VARCHAR(255)    NOT NULL DEFAULT 'General',
			status      VARCHAR(50)     NOT NULL DEFAULT 'draft',
			created_by  BIGINT UNSIGNED NOT NULL DEFAULT 0,
			updated_by  BIGINT UNSIGNED DEFAULT NULL,
			created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY status (status),
			KEY entity (entity)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_landing_page_versions — versioned landing page content
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}landing_page_versions (
			id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			landing_page_master_id BIGINT UNSIGNED NOT NULL,
			version                INT UNSIGNED    NOT NULL DEFAULT 1,
			html_body              LONGTEXT        NOT NULL,
			capture_settings_json  LONGTEXT        DEFAULT NULL,
			redirect_settings_json LONGTEXT        DEFAULT NULL,
			variables_json         LONGTEXT        DEFAULT NULL,
			language               VARCHAR(20)     DEFAULT NULL,
			status                 VARCHAR(50)     NOT NULL DEFAULT 'draft',
			created_by             BIGINT UNSIGNED NOT NULL DEFAULT 0,
			updated_by             BIGINT UNSIGNED DEFAULT NULL,
			approved_by            BIGINT UNSIGNED DEFAULT NULL,
			created_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			approved_at            DATETIME        DEFAULT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY landing_page_version (landing_page_master_id, version),
			KEY landing_page_master_id (landing_page_master_id),
			KEY status (status)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_sending_profile_refs — WordPress-owned references to GoPhish SMTP profiles
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}sending_profile_refs (
			id                         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name                       VARCHAR(255)    NOT NULL,
			from_name                  VARCHAR(255)    DEFAULT NULL,
			from_email                 VARCHAR(255)    NOT NULL DEFAULT '',
			reply_to                   VARCHAR(255)    DEFAULT NULL,
			gophish_sending_profile_id BIGINT UNSIGNED DEFAULT NULL,
			environment                VARCHAR(50)     NOT NULL DEFAULT 'production',
			allowed_domains_json       LONGTEXT        DEFAULT NULL,
			rate_limit_json            LONGTEXT        DEFAULT NULL,
			entity                     VARCHAR(255)    NOT NULL DEFAULT 'General',
			status                     VARCHAR(50)     NOT NULL DEFAULT 'draft',
			created_by                 BIGINT UNSIGNED NOT NULL DEFAULT 0,
			updated_by                 BIGINT UNSIGNED DEFAULT NULL,
			created_at                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY gophish_sending_profile_id (gophish_sending_profile_id),
			KEY status (status),
			KEY entity (entity)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_dynamic_domains — authorized domains usable by campaign runs
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}dynamic_domains (
			id                              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			domain                          VARCHAR(255)    NOT NULL,
			base_landing_url                VARCHAR(500)    DEFAULT NULL,
			tracking_url                    VARCHAR(500)    DEFAULT NULL,
			environment                     VARCHAR(50)     NOT NULL DEFAULT 'production',
			owner_entity                    VARCHAR(255)    NOT NULL DEFAULT 'General',
			authorization_status            VARCHAR(50)     NOT NULL DEFAULT 'pending',
			dns_status                      VARCHAR(50)     NOT NULL DEFAULT 'unknown',
			tls_status                      VARCHAR(50)     NOT NULL DEFAULT 'unknown',
			allowed_playbooks_json          LONGTEXT        DEFAULT NULL,
			allowed_sending_profiles_json   LONGTEXT        DEFAULT NULL,
			status                          VARCHAR(50)     NOT NULL DEFAULT 'draft',
			created_by                      BIGINT UNSIGNED NOT NULL DEFAULT 0,
			updated_by                      BIGINT UNSIGNED DEFAULT NULL,
			created_at                      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at                      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY domain (domain),
			KEY status (status),
			KEY owner_entity (owner_entity),
			KEY authorization_status (authorization_status)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_playbook_masters — WordPress-owned campaign blueprints
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}playbook_masters (
			id                                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name                              VARCHAR(255)    NOT NULL,
			description                       TEXT            DEFAULT NULL,
			objective                         TEXT            DEFAULT NULL,
			scenario                          VARCHAR(255)    DEFAULT NULL,
			difficulty                        TINYINT UNSIGNED DEFAULT 1,
			risk_level                        VARCHAR(50)     DEFAULT NULL,
			default_email_template_version_id BIGINT UNSIGNED DEFAULT NULL,
			default_landing_page_version_id   BIGINT UNSIGNED DEFAULT NULL,
			default_sending_profile_ref_id    BIGINT UNSIGNED DEFAULT NULL,
			default_dynamic_domain_id         BIGINT UNSIGNED DEFAULT NULL,
			allowed_overrides_json            LONGTEXT        DEFAULT NULL,
			rules_json                        LONGTEXT        DEFAULT NULL,
			metrics_json                      LONGTEXT        DEFAULT NULL,
			entity                            VARCHAR(255)    NOT NULL DEFAULT 'General',
			status                            VARCHAR(50)     NOT NULL DEFAULT 'draft',
			version                           INT UNSIGNED    NOT NULL DEFAULT 1,
			legacy_playbook_id                BIGINT UNSIGNED DEFAULT NULL,
			created_by                        BIGINT UNSIGNED NOT NULL DEFAULT 0,
			updated_by                        BIGINT UNSIGNED DEFAULT NULL,
			approved_by                       BIGINT UNSIGNED DEFAULT NULL,
			created_at                        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at                        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			approved_at                       DATETIME        DEFAULT NULL,
			PRIMARY KEY (id),
			KEY status (status),
			KEY entity (entity),
			KEY default_email_template_version_id (default_email_template_version_id),
			KEY default_landing_page_version_id (default_landing_page_version_id),
			KEY default_sending_profile_ref_id (default_sending_profile_ref_id),
			KEY default_dynamic_domain_id (default_dynamic_domain_id),
			KEY legacy_playbook_id (legacy_playbook_id)
		) $charset_collate;";

		// -----------------------------------------------------------------------
		// pukat_campaign_runs — immutable execution snapshots from Playbook Master
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}campaign_runs (
			id                         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			playbook_master_id         BIGINT UNSIGNED NOT NULL,
			playbook_version           INT UNSIGNED    NOT NULL DEFAULT 1,
			name                       VARCHAR(255)    NOT NULL,
			target_segment_id          BIGINT UNSIGNED DEFAULT NULL,
			target_group_name          VARCHAR(255)    DEFAULT NULL,
			schedule_at                DATETIME        DEFAULT NULL,
			timezone                   VARCHAR(100)    NOT NULL DEFAULT 'UTC',
			status                     VARCHAR(50)     NOT NULL DEFAULT 'draft_run',
			snapshot_json              LONGTEXT        DEFAULT NULL,
			gophish_template_id        BIGINT UNSIGNED DEFAULT NULL,
			gophish_page_id            BIGINT UNSIGNED DEFAULT NULL,
			gophish_group_id           BIGINT UNSIGNED DEFAULT NULL,
			gophish_sending_profile_id BIGINT UNSIGNED DEFAULT NULL,
			gophish_campaign_id        BIGINT UNSIGNED DEFAULT NULL,
			sync_state_json            LONGTEXT        DEFAULT NULL,
			metrics_json               LONGTEXT        DEFAULT NULL,
			created_by                 BIGINT UNSIGNED NOT NULL DEFAULT 0,
			launched_by                BIGINT UNSIGNED DEFAULT NULL,
			created_at                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at                 DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			launched_at                DATETIME        DEFAULT NULL,
			completed_at               DATETIME        DEFAULT NULL,
			PRIMARY KEY (id),
			KEY playbook_master_id (playbook_master_id),
			KEY status (status),
			KEY gophish_campaign_id (gophish_campaign_id),
			KEY schedule_at (schedule_at)
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
			campaign_id  BIGINT UNSIGNED NOT NULL DEFAULT 0,
			campaign_run_id BIGINT UNSIGNED DEFAULT NULL,
			click_score  TINYINT UNSIGNED DEFAULT 0 COMMENT '0-50',
			quiz_score   TINYINT UNSIGNED DEFAULT 0 COMMENT '0-50',
			total_score  TINYINT UNSIGNED DEFAULT 0 COMMENT '0-100',
			risk_tier    VARCHAR(20)     DEFAULT 'low' COMMENT 'low|medium|high|critical',
			created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY target_email (target_email),
			KEY campaign_id (campaign_id),
			KEY campaign_run_id (campaign_run_id),
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

		// -----------------------------------------------------------------------
		// pukat_role_meta — display/description metadata for RBAC roles
		// (the roles themselves and their capability grants live in WP's
		// native wp_user_roles option, see PermissionRegistry + seed_rbac_defaults())
		// -----------------------------------------------------------------------
		$sql[] = "CREATE TABLE IF NOT EXISTS {$prefix}role_meta (
			id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			role_slug      VARCHAR(60)     NOT NULL,
			display_name   VARCHAR(255)    NOT NULL,
			description    TEXT            DEFAULT NULL,
			is_system_role TINYINT(1)      NOT NULL DEFAULT 0,
			created_by     BIGINT UNSIGNED NOT NULL DEFAULT 0,
			updated_by     BIGINT UNSIGNED DEFAULT NULL,
			created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY role_slug (role_slug)
		) $charset_collate;";

		foreach ( $sql as $query ) {
			dbDelta( $query );
		}

		self::ensure_playbook_entity_column();
		self::ensure_campaign_run_risk_score_column();
		self::ensure_playbook_master_legacy_column();
		self::ensure_quiz_results_campaign_run_column();
		self::ensure_campaign_runs_follow_up_column();
		self::ensure_socialization_logs_campaign_run_column();
		self::ensure_targets_campaign_run_column();
	}

	/**
	 * Apply incremental database changes for already-active installations.
	 */
	public static function maybe_upgrade(): void {
		$db_version = (string) get_option( 'pukat_db_version', '0.0.0' );

		if ( version_compare( $db_version, '1.1.0', '<' ) ) {
			self::create_tables();
			update_option( 'pukat_db_version', '1.1.0' );
			$db_version = '1.1.0';
		}

		if ( version_compare( $db_version, '1.2.0', '<' ) ) {
			self::create_tables();
			self::ensure_campaign_run_risk_score_column();
			update_option( 'pukat_db_version', '1.2.0' );
			$db_version = '1.2.0';
		}

		if ( version_compare( $db_version, '1.3.0', '<' ) ) {
			self::create_tables();
			self::ensure_playbook_master_legacy_column();
			update_option( 'pukat_db_version', '1.3.0' );
			$db_version = '1.3.0';
		}

		if ( version_compare( $db_version, '1.4.0', '<' ) ) {
			self::create_tables();
			self::ensure_quiz_results_campaign_run_column();
			self::ensure_campaign_runs_follow_up_column();
			self::ensure_socialization_logs_campaign_run_column();
			update_option( 'pukat_db_version', '1.4.0' );
			$db_version = '1.4.0';
		}

		if ( version_compare( $db_version, '1.5.0', '<' ) ) {
			self::create_tables();
			self::ensure_targets_campaign_run_column();
			update_option( 'pukat_db_version', '1.5.0' );
			$db_version = '1.5.0';
		}

		if ( version_compare( $db_version, '1.6.0', '<' ) ) {
			self::create_tables();
			self::seed_rbac_defaults();
			update_option( 'pukat_db_version', '1.6.0' );
			$db_version = '1.6.0';
		}

		if ( version_compare( $db_version, '1.7.0', '<' ) ) {
			self::seed_rbac_defaults();
			update_option( 'pukat_db_version', '1.7.0' );
		}
	}

	/**
	 * Ensure existing playbook tables can store assignment entity metadata.
	 */
	private static function ensure_playbook_entity_column(): void {
		global $wpdb;

		$table  = $wpdb->prefix . 'pukat_playbooks';
		$column = $wpdb->get_var(
			$wpdb->prepare( "SHOW COLUMNS FROM {$table} LIKE %s", 'entity' )
		);

		if ( ! $column ) {
			$wpdb->query( "ALTER TABLE {$table} ADD entity VARCHAR(255) NOT NULL DEFAULT 'General' AFTER difficulty" );
		}
	}

	/**
	 * Ensure risk scores can be linked to Campaign Run records in the new flow.
	 */
	private static function ensure_campaign_run_risk_score_column(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_risk_scores';

		$column = $wpdb->get_var(
			$wpdb->prepare( "SHOW COLUMNS FROM {$table} LIKE %s", 'campaign_run_id' )
		);

		if ( ! $column ) {
			$wpdb->query( "ALTER TABLE {$table} ADD campaign_run_id BIGINT UNSIGNED DEFAULT NULL AFTER campaign_id" );
		}

		$index = $wpdb->get_var(
			$wpdb->prepare( "SHOW INDEX FROM {$table} WHERE Key_name = %s", 'campaign_run_id' )
		);

		if ( ! $index ) {
			$wpdb->query( "ALTER TABLE {$table} ADD INDEX campaign_run_id (campaign_run_id)" );
		}
	}

	/**
	 * Ensure migrated Playbook Masters can reference their legacy playbook source.
	 */
	private static function ensure_playbook_master_legacy_column(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_playbook_masters';

		$column = $wpdb->get_var(
			$wpdb->prepare( "SHOW COLUMNS FROM {$table} LIKE %s", 'legacy_playbook_id' )
		);

		if ( ! $column ) {
			$wpdb->query( "ALTER TABLE {$table} ADD legacy_playbook_id BIGINT UNSIGNED DEFAULT NULL AFTER version" );
		}

		$index = $wpdb->get_var(
			$wpdb->prepare( "SHOW INDEX FROM {$table} WHERE Key_name = %s", 'legacy_playbook_id' )
		);

		if ( ! $index ) {
			$wpdb->query( "ALTER TABLE {$table} ADD INDEX legacy_playbook_id (legacy_playbook_id)" );
		}
	}

	/**
	 * Ensure quiz results can be linked to Campaign Run records in the new flow.
	 */
	private static function ensure_quiz_results_campaign_run_column(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_quiz_results';

		$column = $wpdb->get_var(
			$wpdb->prepare( "SHOW COLUMNS FROM {$table} LIKE %s", 'campaign_run_id' )
		);

		if ( ! $column ) {
			$wpdb->query( "ALTER TABLE {$table} ADD campaign_run_id BIGINT UNSIGNED DEFAULT NULL AFTER campaign_id" );
		}

		$index = $wpdb->get_var(
			$wpdb->prepare( "SHOW INDEX FROM {$table} WHERE Key_name = %s", 'campaign_run_id' )
		);

		if ( ! $index ) {
			$wpdb->query( "ALTER TABLE {$table} ADD INDEX campaign_run_id (campaign_run_id)" );
		}
	}

	/**
	 * Ensure Campaign Runs can store the wizard's Follow-Up preferences (quiz, reminder).
	 */
	private static function ensure_campaign_runs_follow_up_column(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_campaign_runs';

		$column = $wpdb->get_var(
			$wpdb->prepare( "SHOW COLUMNS FROM {$table} LIKE %s", 'follow_up_json' )
		);

		if ( ! $column ) {
			$wpdb->query( "ALTER TABLE {$table} ADD follow_up_json LONGTEXT DEFAULT NULL AFTER metrics_json" );
		}
	}

	/**
	 * Ensure socialization logs can be linked to Campaign Run records in the new flow.
	 */
	private static function ensure_socialization_logs_campaign_run_column(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_socialization_logs';

		$column = $wpdb->get_var(
			$wpdb->prepare( "SHOW COLUMNS FROM {$table} LIKE %s", 'campaign_run_id' )
		);

		if ( ! $column ) {
			$wpdb->query( "ALTER TABLE {$table} ADD campaign_run_id BIGINT UNSIGNED DEFAULT NULL AFTER campaign_id" );
		}

		$index = $wpdb->get_var(
			$wpdb->prepare( "SHOW INDEX FROM {$table} WHERE Key_name = %s", 'campaign_run_id' )
		);

		if ( ! $index ) {
			$wpdb->query( "ALTER TABLE {$table} ADD INDEX campaign_run_id (campaign_run_id)" );
		}
	}

	/**
	 * Ensure imported targets can be linked to a Campaign Run in the new flow.
	 */
	private static function ensure_targets_campaign_run_column(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_targets';

		$column = $wpdb->get_var(
			$wpdb->prepare( "SHOW COLUMNS FROM {$table} LIKE %s", 'campaign_run_id' )
		);

		if ( ! $column ) {
			$wpdb->query( "ALTER TABLE {$table} ADD campaign_run_id BIGINT UNSIGNED DEFAULT NULL AFTER campaign_id" );
		}

		$index = $wpdb->get_var(
			$wpdb->prepare( "SHOW INDEX FROM {$table} WHERE Key_name = %s", 'campaign_run_id' )
		);

		if ( ! $index ) {
			$wpdb->query( "ALTER TABLE {$table} ADD INDEX campaign_run_id (campaign_run_id)" );
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
	 * RBAC role metadata — display name/description for the 4 system roles.
	 * The roles/capabilities themselves live in WP's native role storage
	 * (seeded by `grant_rbac_capabilities()`); this table only carries what
	 * WP roles can't (description, `is_system_role`, audit trail columns).
	 *
	 * @var array<string, array{0: string, 1: string}> role_slug => [display_name, description]
	 */
	private const RBAC_SYSTEM_ROLES = [
		'pukat_admin'    => [ 'Admin', 'Full access to every feature, including role and permission management.' ],
		'pukat_operator' => [ 'Operator', 'Runs campaigns, manages master content, and edits own-entity assets.' ],
		'pukat_reviewer' => [ 'Reviewer / Approver', 'Reviews and approves master playbooks, email templates, and landing pages before they go live.' ],
		'pukat_viewer'   => [ 'Viewer', 'Read-only access to dashboards, reports, and master data.' ],
	];

	/**
	 * Seed the RBAC system: register the new Reviewer/Approver role, grant
	 * every system role its capability set from the Permission Registry, and
	 * record role metadata. Idempotent — safe to run on every activation and
	 * every version upgrade (see `activate()`/`maybe_upgrade()`).
	 *
	 * Phase 1 of `docs/IMPLEMENTATION_PLAN_RBAC.md`: this only seeds
	 * capabilities, it does not change what any REST endpoint actually
	 * checks — `pukat_admin`/`pukat_operator`/`pukat_viewer` end up with the
	 * exact same effective access they have today via the old 4-capability
	 * model. Controllers migrate to these granular capabilities in Phase 3.
	 */
	private static function seed_rbac_defaults(): void {
		self::seed_role_meta_table();
		self::grant_rbac_capabilities();
	}

	/**
	 * Insert the 4 system roles into `wp_pukat_role_meta` if not already present.
	 */
	private static function seed_role_meta_table(): void {
		global $wpdb;

		$table = $wpdb->prefix . 'pukat_role_meta';

		foreach ( self::RBAC_SYSTEM_ROLES as $slug => [ $display_name, $description ] ) {
			$exists = $wpdb->get_var(
				$wpdb->prepare( "SELECT id FROM {$table} WHERE role_slug = %s", $slug )
			);

			if ( $exists ) {
				continue;
			}

			$wpdb->insert(
				$table,
				[
					'role_slug'      => $slug,
					'display_name'   => $display_name,
					'description'    => $description,
					'is_system_role' => 1,
					'created_by'     => 0,
					'created_at'     => current_time( 'mysql' ),
					'updated_at'     => current_time( 'mysql' ),
				],
				[ '%s', '%s', '%s', '%d', '%d', '%s', '%s' ]
			);
		}
	}

	/**
	 * Register the Reviewer/Approver WP role and grant every system role
	 * (plus WP `administrator`) its Permission Registry capabilities.
	 *
	 * `pukat_admin`/`administrator` get every registry key, including
	 * `approve`-gated ones. `pukat_operator` gets every `shared` +
	 * `operator`-gated key but NOT `approve`-gated ones (Phase 4 of
	 * docs/IMPLEMENTATION_PLAN_RBAC.md — Operator lost approval rights on
	 * the 3 master resources; Reviewer/Approver is the only non-admin role
	 * that can approve now). `pukat_viewer` gets every `shared` (view-only)
	 * key. `pukat_reviewer` is new and does not map to an existing gate — it
	 * gets view + approve only, see `reviewer_capability_keys()`.
	 */
	private static function grant_rbac_capabilities(): void {
		add_role( 'pukat_reviewer', __( 'Pukat Reviewer / Approver', 'pukat' ), [ 'read' => true ] );

		$shared_keys   = PermissionRegistry::keys_by_gate( 'shared' );
		$operator_keys = PermissionRegistry::keys_by_gate( 'operator' );
		$admin_keys    = PermissionRegistry::keys_by_gate( 'admin' );
		$approve_keys  = PermissionRegistry::keys_by_gate( 'approve' );

		$role_keys = [
			'pukat_admin'    => array_merge( $shared_keys, $operator_keys, $admin_keys, $approve_keys ),
			'pukat_operator' => array_merge( $shared_keys, $operator_keys ),
			'pukat_viewer'   => $shared_keys,
			'pukat_reviewer' => self::reviewer_capability_keys(),
			'administrator'  => array_merge( $shared_keys, $operator_keys, $admin_keys, $approve_keys ),
		];

		foreach ( $role_keys as $role_slug => $keys ) {
			$role = get_role( $role_slug );

			if ( ! $role ) {
				continue;
			}

			foreach ( $keys as $key ) {
				$role->add_cap( PermissionRegistry::capability_for( $key ) );
			}
		}

		// Defensively strip approve-gated capabilities from Operator. Phase 1
		// originally seeded these onto Operator (approve was operator-gated
		// back then); add_cap() above is purely additive, so an install that
		// already ran that seed needs an explicit remove_cap() to actually
		// lose the capability rather than just stop being re-granted it.
		$operator_role = get_role( 'pukat_operator' );
		if ( $operator_role ) {
			foreach ( $approve_keys as $key ) {
				$operator_role->remove_cap( PermissionRegistry::capability_for( $key ) );
			}
		}
	}

	/**
	 * The Reviewer/Approver's fixed capability set — view + approve on the
	 * 3 approvable master resources, nothing else. Doesn't derive from a
	 * registry gate like the other 3 system roles because it's a genuinely
	 * new cross-cutting role, not a reproduction of an existing gate.
	 *
	 * @return string[]
	 */
	private static function reviewer_capability_keys(): array {
		return [
			'dashboard.view',
			'master_playbooks.view',
			'master_playbooks.approve',
			'master_email_templates.view',
			'master_email_templates.approve',
			'master_landing_pages.view',
			'master_landing_pages.approve',
		];
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
