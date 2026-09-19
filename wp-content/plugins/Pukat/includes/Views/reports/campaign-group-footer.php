<?php
/** Chromium fills pageNumber/totalPages, including table continuation pages. */
defined( 'ABSPATH' ) || exit;
?>
<div style="width:100%;margin:0 18mm;padding-top:7px;border-top:1px solid #d9dee7;font-family:Arial,Helvetica,sans-serif;font-size:7px;color:#8a94a3;display:flex;justify-content:space-between;">
    <span><strong style="color:#667286;font-weight:600;">PUKAT MONITORING</strong> · <?php echo esc_html( $data['prepared_at_short'] ); ?> · Confidential</span>
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>
