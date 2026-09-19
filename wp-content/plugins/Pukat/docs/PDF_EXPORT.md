# Campaign PDF export

Updated: 2026-09-18.

Both the single Campaign Run export and the Campaign Group / multi-campaign
export (a single group, or the "All active groups" selection on Monitoring)
use an approved HTML report design with real campaign data. WordPress prepares
and escapes the document; a private Playwright service prints it using
Chromium. The existing endpoints and frontend Export PDF button are unchanged:

```text
GET /wp-json/pukat/v1/campaign-runs/{id}/report/export
GET /wp-json/pukat/v1/campaign-groups/{id}/report/export
GET /wp-json/pukat/v1/campaign-groups/active/report/export
```

## Editing the design

The active templates live in `includes/Views/reports/`:

- `campaign-run.php`: the three main report sections/pages and responsive-user
  appendices from `docs/prototypes/new-export-campaign.html`.
- `campaign-run.css`: typography, metric cards, charts, tables and print rules
  shared by both report types.
- `header.php` and `footer.php`: repeating page chrome for the single Campaign
  Run report, with inline styles because Chromium does not apply document CSS
  to these templates. `pageNumber` and `totalPages` are populated automatically.
- `campaign-group.php`: the six-page Campaign Group / multi-campaign report from
  `docs/prototypes/exportpdf-multi-campaign-draft.html`.
- `campaign-group.css`: portfolio-specific additions layered on top of
  `campaign-run.css` (metrics grid, comparison/snapshot tables, hourly chart,
  action cards, event register, definitions).
- `campaign-group-header.php` and `campaign-group-footer.php`: repeating page
  chrome for the Campaign Group report.

`CampaignReportPdfService::campaign_run_report_data()` / `campaign_group_report_data()`
prepare each report's whitelisted view data; `campaign_run_document()` /
`campaign_group_document()` apply it to the templates. Dynamic text must remain
escaped. The approved design references are `docs/prototypes/new-export-campaign.html`
(single run) and `docs/prototypes/exportpdf-multi-campaign-draft.html` (group);
their placeholder users, campaign IDs, ratings and dates are not production
data. The former preview was removed.

The Campaign Group report aggregates `CampaignGroupService::report()` /
`report_active()`'s already-computed shape — it does not fetch or union
per-target data, so it cannot deduplicate recipients across campaigns.
Consolidated rates are recalculated from summed counts, never averaged from
individual campaign rates. A campaign with no `synced_at` contributes to the
snapshot/planned-scope register but is excluded from the recorded denominator
and shown as unavailable ("—"), not as a zero-response campaign. Each
campaign's group label is resolved via an authorised `campaign_group_id => name`
map built from `CampaignGroupService::list()` (`CampaignGroupController::groups_by_id()`),
since the aggregate report's per-run breakdown does not otherwise carry a
group name. Overall risk reuses the same exposure/reporting thresholds as the
single Campaign Run report (`campaign_run_vulnerability_level()` /
`campaign_run_compliance_level()`).

The active single-run headings follow the revised reference: Phishing Simulation /
Campaign Evaluation, Campaign Overview & Scenario, Key Observations, Key Findings,
Recommendations & Follow-up Actions, Approval and Users with Recorded Campaign
Responses. Reference spelling and remaining mixed-language labels are normalised
to proficient English. Email metrics retain the accurate "Sent" label for GoPhish
sent records. Recommendations include recurring simulation/trend review; priorities
are explicit view data and do not depend on wording in recommendation titles.

The layout uses serif titles, campaign facts, a summary/assessment sidebar,
metrics, a CSS donut, response rankings, department details, observations,
findings, a risk matrix, recommendations and approval blocks. CSS is copied from
the design reference with print overrides: fixed 297 mm page heights and
unbreakable large tables are removed so long data can continue across pages.
Chromium supplies repeating headers/footers and the real page count.

Report copy uses formal British English at C2 proficiency level, including
headings, assessments, recommendations, appendix descriptions and empty states.
Percentages use a decimal point (18.5%) and dates use English month abbreviations
(15 May 2026), independently of the WordPress interface language. Campaign names,
department names, job titles and participant identities remain as recorded.

The executive summary, Campaign Coverage fact and coverage assessment use the
actual number of distinct departments represented by all campaign recipients,
including recipients with no recorded response. Department names are trimmed
and compared without regard to case. The count is unavailable when recipient
records are incomplete or department metadata is missing; the Unassigned bucket
does not establish an additional department. No fixed department count is used.

The multi-campaign report design started as a draft, available as
[standalone HTML](prototypes/exportpdf-multi-campaign-draft.html) with
[source-field mapping and integration notes](prototypes/exportpdf-multi-campaign-draft.md)
(illustrative data). It has since been connected to the Campaign Group export
endpoints — see `campaign-group.php` above.

Click/data metrics count each exposed user once, including those who later
report. The donut's categories are exclusive, with reporting taking priority.
Rankings count unique users who click/submit or report; their activity count does
not add overlapping click and report totals. Department reporting/opening values
come from target timelines or statuses. Exposure rate thresholds for departments
are <15% LOW, 15–<40% MEDIUM and ≥40% HIGH, consistent with the existing department
cutoffs. Overall Assessment takes the higher of the existing exposure and
reporting risk levels; coverage is evaluated separately.

Positions come from target details or the locked snapshot's target metadata.
Missing position data is shown as unavailable. Partial target details do not
produce fabricated exposure unions, donut distributions or department rankings.
The response appendix includes users who open, click, submit or report. It is
sorted by name/email with one row per user and groups of up to 25. A row displays
Reported > Submitted > Clicked > Opened and the timestamp of that selected stage,
converted from GoPhish ISO time to the WordPress site timezone. Missing event
timestamps show a dash. Every group may span more than one PDF page when text is
long; table headings repeat and data is never clipped to a fixed page height.

## Running locally

From the WordPress workspace root:

```bash
docker compose up -d --build pdf-renderer wordpress
```

Compose connects WordPress and the renderer using the internal `pdf_network`.
The renderer has no published host port or runtime Internet access. Playwright
1.63.0 is pinned in the renderer's package and lockfile; Chromium and its system
dependencies are installed during the image build. Node modules are image-local,
not committed. The frontend Node service is independent.

If WordPress is already running and should keep its current container, start the
renderer and attach WordPress to that network once instead:

```bash
docker compose up -d --build pdf-renderer
docker network connect plugindev_pdf_network plugindev_wordpress
```

For deployments outside this Compose stack, provision the same service and set
`PUKAT_PDF_RENDERER_URL` as a PHP constant or environment variable. The default is
`http://pdf-renderer:3001/render`. The URL is server configuration, never a request
parameter. If using a separately hosted service, configure a private connection
or HTTPS and the same `PUKAT_PDF_RENDERER_TOKEN` in WordPress and the renderer;
WordPress sends it as a Bearer token. Do not publish an unauthenticated renderer.

The service accepts only HTML/header/footer JSON, disables document JavaScript
and remote asset requests, limits payloads to 8 MiB and parallel renders to two,
and closes rendering contexts after 30 seconds. WordPress validates complete PDF
output and returns a JSON error with HTTP 503 if the renderer is unavailable.
There is no fallback that silently changes the approved report design.

Group and active-group PDF exports now use `CampaignReportPdfService::render_campaign_group()`
and the same Chromium renderer as the single Campaign Run report, replacing the
former Dompdf-based `render()`. The `dompdf/dompdf` Composer dependency is no
longer used by this plugin but has not been removed from `composer.json`, since
that is a separate dependency-cleanup decision. The obsolete single-run HTML
heredoc and its old static prototypes were removed.

## Validation

```bash
docker run --rm --network none \
  -v "$PWD/wp-content/plugins/Pukat/tools/pdf-renderer/server.test.mjs:/app/server.test.mjs:ro" \
  plugindev-pdf-renderer npm test

docker exec plugindev_wordpress php \
  wp-content/plugins/Pukat/tools/smoke-campaign-pdf.php /tmp/pukat-pdf-review
```

Renderer tests cover actual PDF generation, token enforcement, malformed and
oversized input, remote asset/script blocking, and concurrent request limits.
The smoke tool writes a synthetic browser preview to
`/tmp/pukat-pdf-review/sample-preview.html`; it does not recreate the deleted old
preview in the repository. Copy it outside the repository for review if desired:

```bash
docker cp plugindev_wordpress:/tmp/pukat-pdf-review/sample-preview.html /tmp/pukat-campaign-preview.html
```

The read-only WordPress smoke tool renders synthetic normal/unsynced/clean/long/
no-response/partial/zero-target and 200-target cases, checks escaping, click/report overlap,
ranking uniqueness, position metadata, timezone conversion, appendix completeness
and secret exclusion, tests renderer failures and
REST authorization/not-found/success, and — for the Campaign Group report —
checks an active-selection PDF, a single group with no synced results, escaping
of dynamic campaign names, summed (not averaged) consolidated rates, pending
campaigns excluded from the recorded denominator, group-label resolution, and
the live `/campaign-groups/{id}/report/export` and `/campaign-groups/active/report/export`
REST routes. The local fixture uses administrator user ID 1; smoke artifacts
stay in `/tmp`, and `live-rest.pdf` / `group-live-rest.pdf` contain local
campaign data.

Printing uses A4, a 25 mm top margin, 18 mm side margins and a 20 mm bottom margin,
configured in `tools/pdf-renderer/server.mjs`. Reference:
[Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf) and
[browser installation](https://playwright.dev/docs/browsers).
