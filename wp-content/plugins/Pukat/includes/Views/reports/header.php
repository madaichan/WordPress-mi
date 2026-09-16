<?php
/** Chromium header template: self-contained styles because page CSS is unavailable here. */
defined( 'ABSPATH' ) || exit;
?>
<div style="width:100%;margin:0 17mm;font-family:Arial,sans-serif;color:#173f54;border-bottom:1px solid #dce5eb;padding-bottom:10px;display:flex;align-items:center;gap:16px;">
    <span style="font-size:14px;font-weight:bold;max-width:48%;overflow-wrap:anywhere;"><?php echo $org_name; ?></span>
    <span style="margin-left:auto;text-align:right;font-size:8px;line-height:1.6;color:#657589;">PUKAT · CAMPAIGN #<?php echo (int) ( $run['id'] ?? 0 ); ?><br><?php echo $report_date; ?> | CONFIDENTIAL</span>
</div>
