import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const MAX_BODY = 8 * 1024 * 1024
const MAX_CONCURRENT = 2

export async function renderPdf(browser, { html, header, footer }) {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    serviceWorkers: 'block',
  })
  // Reports contain escaped text, inline CSS and data-URI charts only.
  // Never fetch target URLs, remote fonts, images or local files.
  await context.route('**/*', route => route.abort())
  const deadline = setTimeout(() => context.close().catch(() => {}), 30_000)
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(20_000)
    await page.setContent(html, { waitUntil: 'load' })
    await page.emulateMedia({ media: 'print' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
      margin: { top: '25mm', right: '18mm', bottom: '20mm', left: '18mm' },
      tagged: true,
    })
  } finally {
    clearTimeout(deadline)
    await context.close()
  }
}

function authorized(request, token) {
  if (!token) return true // The bundled Compose service is on a private network.
  const actual = Buffer.from(request.headers.authorization || '')
  const expected = Buffer.from(`Bearer ${token}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createPdfServer(browser, { token = process.env.PUKAT_PDF_RENDERER_TOKEN || '' } = {}) {
  let active = 0
  const server = http.createServer(async (request, response) => {
    const error = (status, message) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ message }))
    }
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(browser.isConnected() ? 200 : 503)
      response.end(browser.isConnected() ? 'ready' : 'unavailable')
      return
    }
    if (request.method !== 'POST' || request.url !== '/render') return error(404, 'Not found')
    if (!authorized(request, token)) return error(401, 'Unauthorized')
    if (request.headers['content-type']?.split(';')[0] !== 'application/json') return error(415, 'JSON required')
    if (active >= MAX_CONCURRENT) return error(503, 'Renderer busy; retry shortly')

    active++
    try {
      let size = 0
      const chunks = []
      for await (const chunk of request) {
        size += chunk.length
        if (size > MAX_BODY) {
          error(413, 'Report too large')
          return
        }
        chunks.push(chunk)
      }
      let payload
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
      catch { return error(400, 'Invalid JSON') }
      if (!payload || typeof payload.html !== 'string' || !payload.html.trim()
        || typeof payload.header !== 'string' || typeof payload.footer !== 'string'
        || payload.header.length > 32_768 || payload.footer.length > 32_768) {
        return error(422, 'HTML, header and footer required')
      }
      const pdf = await renderPdf(browser, payload)
      response.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdf.length,
        'Cache-Control': 'no-store',
      })
      response.end(pdf)
    } catch {
      // Do not log report content (target identities) or return browser internals.
      error(502, 'PDF rendering failed')
    } finally {
      active--
    }
  })
  server.requestTimeout = 10_000
  server.headersTimeout = 10_000
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ headless: true })
  const server = createPdfServer(browser)
  server.listen(3001, '0.0.0.0', () => console.log('Pukat PDF renderer ready'))
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      server.close()
      await browser.close()
      process.exit(0)
    })
  }
}
