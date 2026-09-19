# Multi-campaign Monitoring report — design draft

Date: 2026-09-18.

Open [the standalone HTML draft](exportpdf-multi-campaign-draft.html), or visit:

```text
http://localhost:8080/wp-content/plugins/Pukat/docs/prototypes/exportpdf-multi-campaign-draft.html
```

The prototype uses formal British English at C2 proficiency level and the
approved Campaign Run report's typography, colours, rules and masthead. Its base
CSS is embedded from `includes/Views/reports/campaign-run.css` so the file can be
opened directly without remote assets. It contains six logical report pages;
long content may require additional printed pages.

All values and participant names in this standalone draft are illustrative, and
every page is marked as a draft. The selector previews all active groups or
either of two named groups. Switching selection recalculates counts, rates,
comparisons, departments, activity, findings and coverage. The toolbar also
provides browser printing. The draft itself makes no API requests.

**Status: connected.** This layout has since been adapted into
`includes/Views/reports/campaign-group.php` / `campaign-group.css`, fed by real
data from `CampaignReportPdfService::campaign_group_report_data()`, and wired
into the existing group/active-group Export PDF endpoints
(`CampaignGroupController::export_report()` / `export_active_report()`), which
now render via `ChromiumPdfService` instead of the former Dompdf renderer. See
`docs/PDF_EXPORT.md` for the current design/data notes. This file and the
standalone HTML draft remain as the design-review record; they are not updated
to track the live templates.

## Report structure

1. Reporting scope, executive summary, consolidated metrics and response signals.
2. Campaign comparisons and the launch/synchronisation register.
3. Departmental responses and recorded click activity by UTC hour.
4. Consolidated assessment and principal findings.
5. Proposed remediation, recommended owners and completion windows, and approval.
6. Recent activity and the report's counting and interpretation conventions.

The all-groups example contains five campaigns in two active groups. Four have
results: 900 recipient records, 890 sent emails, 605 opens, 156 clicks, 28 data
submissions and 305 reports. A fifth, scheduled campaign has 100 planned records
and unavailable results. The consolidated click rate is 17.3%, calculated from
156/900; averaging campaign percentages would incorrectly give 16.0%.

## Mapping to the existing Monitoring page

The actual `/monitoring` route uses
`pukat-app/src/pages/Simulation/Performing.jsx`. Its group report comes from
`CampaignGroupService::report()` / `report_active()`.

| Draft content | Existing source | Integration notes |
| --- | --- | --- |
| Consolidated counts and rates | `report.stats` | Use backend counts directly; calculate rates from summed counts and `stats.total`. |
| Campaign comparisons | `report.campaign_runs[].stats`, name, ID and status | Empty/missing statistics mean unavailable results, not demonstrated zero responses. |
| Planned scope | `campaign_runs[].target_count` | Keep planned records separate from `stats.total`, the recorded denominator. |
| Launch and last sync | `campaign_runs[].launched_at`, `schedule_at`, `synced_at` | Convert dates to the site timezone; a missing sync timestamp alone must not erase otherwise available statistics. |
| Group labels and group count | Monitoring's authorised group metadata | Per-run group IDs/names are not in the aggregate report today; resolve them through authorised, batched metadata when integrating. |
| Department analysis | `report.department_breakdown` | Available fields are total, clicked, submitted, click rate and risk; departmental opens/reports are not supplied. |
| Hourly chart | `report.hourly_activity[0..23]` | Current buckets are UTC, combine all dates and count click events, including repeats. |
| Recent activity register | `report.recent_events` | Up to 30 events; name, department, message and ISO timestamp. Email and campaign attribution are not provided. |
| Assessment and findings | Derived draft view data | Proposed application of existing exposure/reporting criteria; aggregate API does not currently provide an overall assessment. |
| Recommended owner and due window | Proposed report content | Recommendations for review, not existing assignment or tracking data. |
| Report reference and prepared date | Report metadata / `generated_at` | The prototype's reference/date are illustrative and fixed. |

Recipient totals are records summed across campaigns, not unique people. Do not
deduplicate identities from aggregate counters, add overlapping stage counts, or
infer a combined click/submission union. A complete participant appendix would
require additional authorised per-campaign detail, which the group report does
not currently return.

The default all-active-groups selection includes completed member campaigns when
their group remains active. It excludes ungrouped campaigns and groups whose
members are all terminal. A named group includes all its members. These rules
match `CampaignGroupService` rather than filtering to running campaigns alone.

## Connecting the draft after design review (done)

This layout was adapted into group-report views, with whitelisted data prepared
in `CampaignReportPdfService::campaign_group_report_data()`. The group
controller's existing authorisation and selection logic (`CampaignGroupService::report()`
/ `report_active()`) is unchanged; the completed document is sent to
`ChromiumPdfService`, as the single Campaign Run export already did. Report data
excludes the full snapshot and any secrets. Missing result fields (an
unsynchronised campaign) remain explicitly unavailable rather than shown as
zero-response outcomes. Group and active-group exports now render through
`ChromiumPdfService`; the former Dompdf renderer is no longer used by either
export endpoint.

For local review, `window.pukatReportDraft.document()` returns rendered,
script-free HTML and independent repeating header/footer templates suitable for
the existing private PDF renderer. `window.pukatReportDraft.select(scope)` accepts
`active`, `q3` or `executive`. These helpers belong to the illustrative prototype,
not the production report API.
