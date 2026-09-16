import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { chromium } from 'playwright'
import { createPdfServer } from './server.mjs'

let browser, server, endpoint
const token = 'local-test-token'
before(async () => {
  browser = await chromium.launch({ headless: true })
  server = createPdfServer(browser, { token })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  endpoint = `http://127.0.0.1:${server.address().port}/render`
})
after(async () => {
  await new Promise(resolve => server.close(resolve))
  await browser.close()
})
const document = { html: '<html><body><h1>Campaign report</h1></body></html>', header: '<span>Organization</span>', footer: '<span class="pageNumber"></span>' }
const post = (body, headers = {}) => fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})

test('valid document produces a complete Chromium PDF', async () => {
  const response = await post(document)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  const pdf = Buffer.from(await response.arrayBuffer())
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.match(pdf.subarray(-1024).toString(), /%%EOF/)
})
test('rejects unauthorized, malformed and oversized requests', async () => {
  assert.equal((await post(document, { Authorization: '' })).status, 401)
  assert.equal((await post('{')).status, 400)
  assert.equal((await post(null)).status, 422)
  assert.equal((await post({ ...document, html: '' })).status, 422)
  assert.equal((await post(document, { 'Content-Type': 'text/html' })).status, 415)
  assert.equal((await post({ ...document, html: 'x'.repeat(8 * 1024 * 1024) })).status, 413)
})
test('scripts and remote assets never reach a local resource server', async () => {
  let hits = 0
  const resource = http.createServer((request, response) => { hits++; response.end('secret') })
  await new Promise(resolve => resource.listen(0, '0.0.0.0', resolve))
  try {
    const url = `http://127.0.0.1:${resource.address().port}`
    const response = await post({ ...document,
      html: `<html><body><img src="${url}/image"><script>fetch('${url}/script')</script><h1>Report</h1></body></html>`,
    })
    assert.equal(response.status, 200)
    await response.arrayBuffer()
    assert.equal(hits, 0)
  } finally { await new Promise(resolve => resource.close(resolve)) }
})
test('caps concurrent work and recovers after requests finish', async () => {
  const pending = []
  // Reserve both slots with incomplete request bodies.
  for (let i = 0; i < 2; i++) {
    const request = http.request(endpoint, { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
    } })
    request.on('error', () => {})
    request.write('{')
    pending.push(request)
  }
  try {
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal((await post(document)).status, 503)
  } finally { pending.forEach(request => request.end('}')) }
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal((await post(document)).status, 200)
})
