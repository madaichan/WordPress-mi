<?php
/**
 * Quiz template catalogue smoke test — Quiz Builder v2, Fase 2
 * (docs/PRD_QUIZ_MODULE.md §13, IMPLEMENTATION_PLAN_QUIZ_MODULE.md §13 v2).
 *
 * Exercises QuizTemplateService (admin-only CRUD + the template-side marker
 * validation) and confirms the quiz_templates.* capabilities seed to admin
 * roles but not to operators. Loading wp-load.php triggers maybe_upgrade, so
 * running this is also what applies the 1.29.0 migration on a dev box.
 *
 * It never touches a real entity or quiz page: the one quiz_pages row it
 * inserts (to prove the delete-in-use guard) uses a throwaway entity name and
 * is removed again. See the memory note on not mutating real data.
 *
 * Usage from the WordPress container:
 *   php wp-content/plugins/Pukat/tools/smoke-quiz-template.php
 *
 * @package Pukat
 */

declare(strict_types=1);

$wp_load = dirname( __DIR__, 4 ) . '/wp-load.php';
if ( ! file_exists( $wp_load ) ) {
	fwrite( STDERR, "wp-load.php was not found. Run this from a WordPress install.\n" );
	exit( 1 );
}

require $wp_load;

use Pukat\Services\PermissionRegistry;
use Pukat\Services\QuizTemplateService;

if ( ! class_exists( QuizTemplateService::class ) ) {
	fwrite( STDERR, "Pukat is not loaded. Make sure the plugin is active.\n" );
	exit( 1 );
}

global $wpdb;

$failures = [];
function check( string $label, bool $ok, array &$failures ): void {
	echo '[' . ( $ok ? 'PASS' : 'FAIL' ) . "] {$label}\n";
	if ( ! $ok ) {
		$failures[] = $label;
	}
}
function is_err( $v, string $code = '' ): bool {
	return is_wp_error( $v ) && ( '' === $code || $v->get_error_code() === $code );
}

echo "db_version = " . get_option( 'pukat_db_version' ) . "\n\n";

// --- capability seeding -----------------------------------------------------
foreach ( [ 'view', 'create', 'edit', 'delete' ] as $action ) {
	$cap   = PermissionRegistry::capability_for( "quiz_templates.{$action}" );
	$admin = get_role( 'pukat_admin' );
	$oper  = get_role( 'pukat_operator' );
	check( "pukat_admin has {$cap}", $admin && $admin->has_cap( $cap ), $failures );
	check( "pukat_operator does NOT have {$cap}", $oper && ! $oper->has_cap( $cap ), $failures );
}

$svc = new QuizTemplateService();
$created_ids = [];

// --- create: valid ----------------------------------------------------------
$good_html = "<html><body><h1>{{pukat:title}}</h1><p>{{pukat:intro}}</p><form method=\"post\">{{pukat:questions}}</form></body></html>";
$ok = $svc->create( [
	'name'         => 'ZZSmokeTpl Basic',
	'description'  => 'throwaway',
	'html_body'    => $good_html,
	'placeholders' => [
		[ 'key' => 'title', 'label' => 'Title', 'type' => 'text', 'required' => true ],
		[ 'key' => 'intro', 'label' => 'Intro', 'type' => 'textarea', 'required' => false ],
	],
], 1 );
check( 'create valid template', is_array( $ok ) && ! empty( $ok['id'] ), $failures );
if ( is_array( $ok ) ) {
	$created_ids[] = (int) $ok['id'];
	check( 'created template decodes 2 placeholders', is_array( $ok['placeholders'] ) && 2 === count( $ok['placeholders'] ), $failures );
	check( 'get returns html_body', is_string( $ok['html_body'] ?? null ) && str_contains( $ok['html_body'], '{{pukat:questions}}' ), $failures );
}

// --- create: reject missing question slot -----------------------------------
$r = $svc->create( [ 'name' => 'ZZSmokeTpl NoSlot', 'html_body' => '<form method="post"></form>', 'placeholders' => [] ], 1 );
check( 'reject template with no question slot (422)', is_err( $r, 'quiz_template_invalid' ), $failures );

// --- create: reject undeclared marker ---------------------------------------
$r = $svc->create( [ 'name' => 'ZZSmokeTpl Undeclared', 'html_body' => '<p>{{pukat:ghost}}</p>{{pukat:questions}}', 'placeholders' => [] ], 1 );
check( 'reject undeclared {{pukat:ghost}} marker (422)', is_err( $r, 'quiz_template_invalid' ), $failures );

// --- create: reject duplicate placeholder key -------------------------------
$r = $svc->create( [
	'name'         => 'ZZSmokeTpl Dup',
	'html_body'    => '{{pukat:questions}}',
	'placeholders' => [ [ 'key' => 'a', 'label' => 'A' ], [ 'key' => 'a', 'label' => 'A2' ] ],
], 1 );
check( 'reject duplicate placeholder key (422)', is_err( $r, 'quiz_template_invalid' ), $failures );

// --- list excludes html_body ------------------------------------------------
$list = $svc->list();
$row  = null;
foreach ( $list['templates'] as $t ) {
	if ( in_array( (int) $t['id'], $created_ids, true ) ) { $row = $t; break; }
}
check( 'list returns the created template', null !== $row, $failures );
check( 'list row has no html_body', $row && ! array_key_exists( 'html_body', $row ), $failures );

// --- update -----------------------------------------------------------------
if ( $created_ids ) {
	$u = $svc->update( [ 'id' => $created_ids[0], 'name' => 'ZZSmokeTpl Renamed', 'html_body' => $good_html, 'placeholders' => [ [ 'key' => 'title', 'label' => 'T' ], [ 'key' => 'intro', 'label' => 'I' ] ] ], 1 );
	check( 'update renames template', is_array( $u ) && 'ZZSmokeTpl Renamed' === $u['name'], $failures );
}

// --- delete-in-use guard ----------------------------------------------------
if ( $created_ids ) {
	$tid = $created_ids[0];
	$wpdb->insert( $wpdb->prefix . 'pukat_quiz_pages', [
		'entity_name' => 'ZZSmokeTplEntity',
		'title'       => 'throwaway',
		'template_id' => $tid,
		'html_body'   => '<form method="post"></form>',
		'status'      => 'draft',
	] );
	$page_id = (int) $wpdb->insert_id;
	$blocked = $svc->delete( [ 'id' => $tid ], 1 );
	check( 'delete blocked while a quiz uses the template (409)', is_err( $blocked, 'quiz_template_in_use' ), $failures );
	$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'id' => $page_id ] );

	$del = $svc->delete( [ 'id' => $tid ], 1 );
	check( 'delete succeeds once unused', is_array( $del ) && ! empty( $del['ok'] ), $failures );
	$created_ids = array_values( array_filter( $created_ids, fn( $i ) => $i !== $tid ) );
}

// --- cleanup any stragglers -------------------------------------------------
foreach ( $created_ids as $id ) {
	$wpdb->delete( $wpdb->prefix . 'pukat_quiz_templates', [ 'id' => $id ] );
}
$wpdb->delete( $wpdb->prefix . 'pukat_quiz_pages', [ 'entity_name' => 'ZZSmokeTplEntity' ] );

echo "\n" . ( $failures ? count( $failures ) . " FAILURE(S)\n" : "ALL PASS\n" );
exit( $failures ? 1 : 0 );
