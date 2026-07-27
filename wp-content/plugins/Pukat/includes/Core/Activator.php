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
		update_option( 'pukat_db_version', '1.3.0' );
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

		foreach ( $sql as $query ) {
			dbDelta( $query );
		}

		self::ensure_playbook_entity_column();
		self::ensure_campaign_run_risk_score_column();
		self::ensure_playbook_master_legacy_column();
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
