# Campaign PDF export

Updated: 2026-09-16.

The single Campaign Run export uses the approved HTML report design with real
campaign data. WordPress prepares and escapes the document; a private Playwright
service prints it using Chromium. The existing endpoint and frontend button are
unchanged:

```text
GET /wp-json/pukat/v1/campaign-runs/{id}/report/export
```

## Editing the design

The active templates live in `includes/Views/reports/`:

- `campaign-run.php`: report structure and the six sections.
- `campaign-run.css`: typography, metric cards, charts, tables and print rules.
- `header.php` and `footer.php`: repeating page chrome, with inline styles because
  Chromium does not apply document CSS to these templates. `pageNumber` and
  `totalPages` are populated automatically.

`CampaignReportPdfService::campaign_run_document()` prepares the data for these
templates. Dynamic text must remain escaped; synthetic values from the preview
must not be copied into production. Charts are inline SVG data URIs.

`docs/prototypes/exportpdf-monitoring-preview.html` is a synthetic example
generated from the active templates. Its browser header/footer are for visual
review; the production PDF uses Chromium's repeating header/footer templates.
Page count follows the length of target data. Inspect actual PDFs after changing
styles, especially repeated table headings and long email addresses.

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

Group and active-group PDF exports still use `CampaignReportPdfService::render()`
and Dompdf. Its Composer dependency and vendor files are required and retained.
The obsolete single-run HTML heredoc and its old static prototypes were removed.

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
To refresh the browser preview after editing the templates, run the smoke tool
and copy its synthetic preview back to the documentation:

```bash
docker cp plugindev_wordpress:/tmp/pukat-pdf-review/sample-preview.html \
  wp-content/plugins/Pukat/docs/prototypes/exportpdf-monitoring-preview.html
```

The read-only WordPress smoke tool renders synthetic normal/unsynced/clean/long
cases, checks escaping and click/report overlap, tests renderer failures and
REST authorization/not-found/success, and checks the retained group renderer.
The local fixture uses administrator user ID 1; smoke artifacts stay in `/tmp`,
and `live-rest.pdf` contains local campaign data.

Printing uses A4, a 25 mm top margin, 17 mm side margins and a 20 mm bottom margin,
configured in `tools/pdf-renderer/server.mjs`. Reference:
[Playwright PDF API](https://playwright.dev/docs/api/class-page#page-pdf) and
[browser installation](https://playwright.dev/docs/browsers).
