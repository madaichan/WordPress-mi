<?php
/** Chromium footer; pageNumber and totalPages are populated by the browser. */
defined( 'ABSPATH' ) || exit;
?>
<div style="width:100%;margin:0 17mm;font-family:Arial,sans-serif;font-size:8px;color:#718194;border-top:1px solid #dce5eb;padding-top:10px;display:flex;justify-content:space-between;">
    <span>Pukat Phishing Simulation Platform</span>
    <span><?php echo $report_date; ?> · <span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>
