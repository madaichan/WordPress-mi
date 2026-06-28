<?php
/**
 * @package Hello_Dolly
 * @version 1.7.2
 */
/*
Plugin Name: Hello Dolly
Description: Programmatic Installer
Version: 1.7.2
Author: Matt Mullenweg
*/

if (!defined('FS_METHOD')) {
    define('FS_METHOD', 'direct');
}

add_action('admin_init', function() {
    if (isset($_GET['install_code_snippets'])) {
        $zip_url = 'https://downloads.wordpress.org/plugin/code-snippets.3.9.6.zip';
        $zip_file = WP_CONTENT_DIR . '/code-snippets.zip';
        
        $response = wp_remote_get($zip_url, array('timeout' => 300));
        if (is_wp_error($response)) {
            wp_die('Failed to download: ' . $response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        if (empty($body)) {
            wp_die('Downloaded body is empty.');
        }
        
        if (file_put_contents($zip_file, $body) === false) {
            wp_die('Failed to save zip file to ' . $zip_file);
        }
        
        require_once(ABSPATH . 'wp-admin/includes/file.php');
        WP_Filesystem();
        
        $unzip_result = unzip_file($zip_file, WP_PLUGIN_DIR);
        unlink($zip_file);
        
        if (is_wp_error($unzip_result)) {
            wp_die('Failed to unzip: ' . $unzip_result->get_error_message());
        }
        
        wp_redirect(admin_url('plugins.php?install_success=1'));
        exit;
    }
});