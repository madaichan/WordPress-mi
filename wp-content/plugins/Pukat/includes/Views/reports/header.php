<?php
/** Repeating Chromium masthead; styles are independent of page CSS. */
defined( 'ABSPATH' ) || exit;
?>
<div style="width:100%;margin:0 18mm;padding-bottom:8px;border-bottom:1px solid #8f99a8;font-family:Arial,Helvetica,sans-serif;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;">
    <div style="font-size:18px;font-weight:700;letter-spacing:-.3px;color:#17365d;">pukat<span style="display:block;margin-top:2px;font-size:7.5px;font-weight:400;color:#687386;letter-spacing:.7px;text-transform:uppercase;">Phishing Simulation Platform</span></div>
    <div style="text-align:right;font-size:7.5px;line-height:1.45;color:#687386;text-transform:uppercase;letter-spacing:.45px;">Security Awareness Campaign Report<br>CAM-<?php echo sprintf( '%03d', $data['campaign_id'] ); ?> · Confidential</div>
</div>
