import { describe, expect, it } from 'vitest'
import { buildFigureHtml, buildStarterHtml, flagPageStatus, insertAtCursor } from './flagPageTemplate.js'

describe('buildStarterHtml', () => {
  it('returns the bilingual starter with the GoPhish capture field', () => {
    const html = buildStarterHtml()

    expect(html).toContain('lang-switch')
    expect(html).toContain('name="rid"')
    expect(html).toContain('{{.RId}}')
    expect(html).toContain('answer_1')
  })

  it('uses empty image-box placeholders, not the prototype\'s relative files', () => {
    const html = buildStarterHtml()

    expect(html).toContain('class="image-box"')
    expect(html).toContain('Insert an example image here.')
    expect(html).not.toContain('image_1.png')
  })
})

describe('buildFigureHtml', () => {
  it('tags the figure with the data-pukat-img identity and keeps a url src', () => {
    const html = buildFigureHtml({ src: 'https://wp/a.png', caption: 'Sender <x>', alt: 'Spoofing', flagExampleId: 123 })

    expect(html).toContain('<figure data-pukat-img="123">')
    expect(html).toContain('src="https://wp/a.png"')
    expect(html).toContain('<figcaption>Sender &lt;x&gt;</figcaption>')
  })

  it('omits the identity attribute and caption when not given', () => {
    const html = buildFigureHtml({ src: 'x', alt: 'Spoofing' })

    expect(html).toContain('<figure>')
    expect(html).not.toContain('data-pukat-img')
    expect(html).not.toContain('<figcaption>')
  })
})

describe('insertAtCursor', () => {
  it('inserts at the caret position on its own line', () => {
    const html = insertAtCursor('<p>a</p><p>b</p>', '<figure></figure>', 8)

    expect(html).toBe('<p>a</p>\n<figure></figure>\n<p>b</p>')
  })

  it('falls back to before </body> when the caret is unknown', () => {
    const html = insertAtCursor('<body>\n<p>Hi</p>\n</BODY>', '<figure></figure>')

    expect(html.indexOf('<figure></figure>')).toBeGreaterThan(html.indexOf('<p>Hi</p>'))
    expect(html.indexOf('<figure></figure>')).toBeLessThan(html.indexOf('</BODY>'))
  })

  it('appends when there is no body tag, including on empty input', () => {
    expect(insertAtCursor('<p>Hi</p>', '<figure></figure>')).toMatch(/^<p>Hi<\/p>\n<figure><\/figure>/)
    expect(insertAtCursor('', '<figure></figure>')).toContain('<figure></figure>')
  })
})

describe('flagPageStatus', () => {
  it('maps page state to a status key', () => {
    expect(flagPageStatus(null).key).toBe('none')
    expect(flagPageStatus({ id: null, status: 'draft' }).key).toBe('none')
    expect(flagPageStatus({ id: 1, status: 'draft' }).key).toBe('draft')
    expect(flagPageStatus({ id: 1, status: 'published', has_unpublished_changes: true }).key).toBe('changes')
    expect(flagPageStatus({ id: 1, status: 'published', has_unpublished_changes: false }).key).toBe('published')
  })
})
