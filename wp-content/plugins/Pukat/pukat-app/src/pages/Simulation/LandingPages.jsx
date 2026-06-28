import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

/* ─── Data ───────────────────────────────────────────────────────────── */

const LANDING_PAGES = [
  {
    id: 'djp',
    name: 'DJP Pajak Login',
    category: 'login',
    description: 'Kloning form login portal DJP Online Direktorat Jenderal Pajak.',
    html: `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>DJP Online - Login</title>
  <style>
    body { margin:0; font-family:sans-serif; background:#0b172a; color:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:360px; padding:32px; text-align:center; }
    .logo { width:48px; height:48px; border-radius:50%; background:rgba(234,179,8,.2); border:1px solid rgba(234,179,8,.4); color:#eab308; font-weight:700; font-size:14px; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; }
    h3 { font-size:11px; color:#9ca3af; margin:0 0 4px; }
    h4 { font-size:14px; margin:0 0 24px; }
    input { width:100%; box-sizing:border-box; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:4px; padding:8px 12px; font-size:12px; color:#fff; margin-bottom:12px; }
    input::placeholder { color:#6b7280; }
    button { width:100%; background:#eab308; color:#0b172a; border:none; padding:10px; font-size:12px; font-weight:700; border-radius:4px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">DJP</div>
    <h3>DIREKTORAT JENDERAL PAJAK</h3>
    <h4>DJP Online Login Portal</h4>
    <form action="" method="POST">
      <input type="text" name="npwp" placeholder="NPWP / NIK" />
      <input type="password" name="password" placeholder="Kata Sandi" />
      <button type="submit">MASUK</button>
    </form>
  </div>
</body>
</html>`,
    thumbnail: {
      accent: (
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-8 rounded bg-blue-700/60 flex-shrink-0" />
          <div className="h-3 bg-blue-700/40 w-16 rounded" />
        </div>
      ),
      bars: [{ w: 'w-full' }, { w: 'w-4/5' }],
    },
    badges: ['Data', 'Pass'],
  },
  {
    id: 'ms',
    name: 'Microsoft 365 Login',
    category: 'login',
    description: 'Kloning form login portal email korporat Outlook 365.',
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Sign in to your account</title>
  <style>
    body { margin:0; font-family:'Segoe UI',sans-serif; background:#f2f2f2; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:440px; background:#fff; padding:44px; box-shadow:0 2px 6px rgba(0,0,0,.2); }
    .logo { display:flex; align-items:center; gap:4px; margin-bottom:16px; }
    .logo .grid { display:grid; grid-template-columns:1fr 1fr; gap:2px; width:16px; height:16px; }
    .logo .grid div:nth-child(1) { background:#f25022; }
    .logo .grid div:nth-child(2) { background:#7fba00; }
    .logo .grid div:nth-child(3) { background:#00a4ef; }
    .logo .grid div:nth-child(4) { background:#ffb900; }
    .logo span { font-size:14px; font-weight:600; color:#5e5e5e; }
    h2 { font-size:24px; font-weight:600; margin:0 0 24px; }
    input { width:100%; box-sizing:border-box; border:none; border-bottom:1px solid #666; padding:6px 0; font-size:14px; outline:none; margin-bottom:16px; }
    .link { font-size:13px; color:#0067b8; text-decoration:none; }
    .actions { display:flex; justify-content:flex-end; margin-top:24px; }
    button { background:#0067b8; color:#fff; border:none; padding:8px 24px; font-size:14px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><div class="grid"><div></div><div></div><div></div><div></div></div><span>Microsoft</span></div>
    <h2>Sign in</h2>
    <form action="" method="POST">
      <input type="email" name="email" placeholder="Email, phone, or Skype" />
      <p style="font-size:13px;color:#666">No account? <a href="#" class="link">Create one!</a></p>
      <div class="actions"><button type="submit">Next</button></div>
    </form>
  </div>
</body>
</html>`,
    thumbnail: {
      accent: (
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-2.5 bg-blue-500/80 rounded" />
        </div>
      ),
      bars: [{ w: 'w-full' }, { w: 'w-4/5' }],
    },
    badges: ['Data', 'Pass'],
  },
  {
    id: 'hr',
    name: 'HR Portal — Data',
    category: 'form',
    description: 'Form input pembaruan data karyawan korporat.',
    html: `<!DOCTYPE html>
<html>
<head>
  <title>HR Portal - Data Update</title>
  <style>
    body { margin:0; font-family:sans-serif; background:#f9fafb; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:400px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:32px; }
    h2 { font-size:18px; margin:0 0 4px; }
    p { font-size:12px; color:#6b7280; margin:0 0 24px; }
    label { display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px; }
    input, select { width:100%; box-sizing:border-box; border:1px solid #d1d5db; border-radius:6px; padding:8px 12px; font-size:13px; margin-bottom:16px; }
    button { width:100%; background:#dc2626; color:#fff; border:none; padding:10px; font-size:13px; font-weight:600; border-radius:6px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Pembaruan Data Karyawan</h2>
    <p>Silakan lengkapi data berikut untuk verifikasi HR</p>
    <form action="" method="POST">
      <label>Nama Lengkap</label>
      <input type="text" name="fullname" placeholder="Nama sesuai KTP" />
      <label>NIK Karyawan</label>
      <input type="text" name="nik" placeholder="Nomor Induk Karyawan" />
      <label>Email Korporat</label>
      <input type="email" name="email" placeholder="nama@perusahaan.co.id" />
      <label>Departemen</label>
      <select name="department">
        <option>Finance</option>
        <option>Engineering</option>
        <option>Human Resources</option>
        <option>Marketing</option>
      </select>
      <button type="submit">Kirim Data</button>
    </form>
  </div>
</body>
</html>`,
    thumbnail: {
      accent: (
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-2.5 bg-red-500/80 rounded" />
        </div>
      ),
      bars: [{ w: 'w-full' }, { w: 'w-4/5' }],
    },
    badges: ['Data'],
  },
  {
    id: 'vpn',
    name: 'IT Helpdesk — VPN Reset',
    category: 'login',
    html: `<!DOCTYPE html>
<html>
<head>
  <title>VPN Portal Gateway</title>
  <style>
    body { margin:0; font-family:sans-serif; background:#f3f4f6; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:380px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:32px; text-align:center; }
    .icon { width:40px; height:40px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; margin:0 auto 8px; border-radius:6px; font-size:20px; }
    h3 { font-size:14px; margin:0 0 4px; }
    p { font-size:12px; color:#6b7280; margin:0 0 20px; }
    input { width:100%; box-sizing:border-box; border:1px solid #e5e7eb; border-radius:4px; padding:8px 12px; font-size:12px; margin-bottom:12px; }
    button { width:100%; background:#2563eb; color:#fff; border:none; padding:10px; font-size:12px; font-weight:700; border-radius:4px; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔑</div>
    <h3>VPN Portal Gateway</h3>
    <p>Autentikasi Ulang Koneksi VPN Korporat</p>
    <form action="" method="POST">
      <input type="text" name="username" placeholder="Username Korporat" />
      <input type="password" name="password" placeholder="Password Active Directory" />
      <button type="submit">RESET KONEKSI</button>
    </form>
  </div>
</body>
</html>`,
    description: null,
    meta: 'Belum dipakai · Dibuat kemarin',
    chips: [
      { label: 'Login page', cls: 'bg-blue-50 text-blue-700' },
      { label: 'Cleartext ⚠', cls: 'bg-red-50 text-red-700 border border-red-200' },
    ],
    thumbnail: {
      accent: null,
      bars: [{ w: 'w-3/4' }, { w: 'w-1/2' }],
    },
    badges: ['Data', 'Pass'],
  },
  {
    id: 'google',
    name: 'Google Redirect',
    category: 'redirect',
    description: 'Halaman edukasi landing page yang me-redirect target langsung ke portal resmi setelah klik.',
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="3;url=https://www.google.com">
  <style>
    body { margin:0; font-family:sans-serif; background:#f0fdf4; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { text-align:center; padding:40px; }
    .icon { font-size:48px; margin-bottom:16px; }
    h2 { font-size:18px; color:#166534; margin:0 0 8px; }
    p { font-size:13px; color:#6b7280; margin:0 0 24px; max-width:360px; }
    a { color:#2563eb; font-size:13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h2>Terima kasih!</h2>
    <p>Anda akan dialihkan ke halaman resmi dalam beberapa detik...</p>
    <a href="https://www.google.com">Klik di sini jika tidak otomatis redirect</a>
  </div>
</body>
</html>`,
    thumbnail: {
      accent: (
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-2.5 bg-emerald-500/80 rounded" />
        </div>
      ),
      bars: [{ w: 'w-3/4' }],
    },
    badges: ['Data'],
  },
]

const CATEGORIES = [
  { key: 'all', label: 'Semua', count: 5 },
  { key: 'login', label: 'Login page', count: 3 },
  { key: 'form', label: 'Form submission', count: 1 },
  { key: 'redirect', label: 'Redirect only', count: 1 },
]

/* ─── Sub-components ─────────────────────────────────────────────────── */

function CaptureBadge({ label }) {
  const isPass = label === 'Pass'
  return (
    <span
      className={clsx(
        'rounded-full text-[9px] font-semibold px-1.5 py-0.5',
        isPass ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
      )}
    >
      {label} ✓
    </span>
  )
}

function ThumbnailMockup({ page }) {
  return (
    <div className="h-32 bg-[#1F1F1F] rounded-lg border border-gray-800 p-3 relative flex flex-col justify-center gap-2 overflow-hidden select-none">
      {/* GoPhish badge */}
      <span className="absolute top-2 right-2 rounded-full text-[9px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">
        GoPhish
      </span>

      {/* Accent element */}
      {page.thumbnail.accent}

      {/* Bars */}
      <div className="space-y-2 mt-2">
        {page.thumbnail.bars.map((bar, i) => (
          <div key={i} className={clsx('h-2.5 bg-gray-700/60 rounded', bar.w)} />
        ))}
      </div>

      {/* Badges */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        {page.badges.map((badge) => (
          <CaptureBadge key={badge} label={badge} />
        ))}
      </div>
    </div>
  )
}

function LandingPageCard({ page, onEdit, onPreview }) {
  return (
    <div
      className="landing-page-card bg-white border border-gray-200 rounded-xl p-5 shadow-none flex flex-col justify-between h-80 transition-all hover:border-gray-300"
      data-category={page.category}
      data-title={page.name}
    >
      <div className="space-y-4">
        <ThumbnailMockup page={page} />
        <div>
          {page.chips ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">{page.name}</h3>
              </div>
              {page.meta && (
                <p className="text-[10px] text-gray-400 mt-0.5">{page.meta}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {page.chips.map((chip) => (
                  <span
                    key={chip.label}
                    className={clsx('rounded-full text-[9px] font-semibold px-2.5 py-0.5', chip.cls)}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-gray-900">{page.name}</h3>
              {page.description && (
                <p className="text-xs text-gray-500 mt-1">{page.description}</p>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50">
        <button
          onClick={() => onEdit(page.id)}
          className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all"
        >
          <i className="ti ti-edit text-sm" />
          <span>Edit</span>
        </button>
        <button
          onClick={() => onPreview(page.id)}
          className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all"
        >
          <i className="ti ti-eye text-sm" />
          <span>Preview</span>
        </button>
      </div>
    </div>
  )
}

function CreateCard({ onClick }) {
  return (
    <div
      onClick={onClick}
      className="border border-dashed border-gray-200 hover:border-gray-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer h-80 transition-all select-none text-gray-400 hover:text-gray-600 bg-white"
    >
      <i className="ti ti-plus text-3xl" />
      <span className="text-sm font-semibold">Buat landing page baru</span>
    </div>
  )
}

/* ─── Browser Sandbox Preview ────────────────────────────────────────── */

function BrowserPreview({ html, redirectUrl }) {
  const [viewport, setViewport] = useState('desktop') // 'desktop', 'tablet', 'mobile'

  const widthClass = {
    desktop: 'w-full max-w-5xl',
    tablet: 'w-[768px]',
    mobile: 'w-[375px]'
  }[viewport]

  return (
    <div className="w-full flex flex-col items-center space-y-4 animate-fade-in">
      {/* Viewport Control Bar */}
      <div className="flex items-center justify-between w-full max-w-5xl bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-500 mr-2">Viewport:</span>
          <button
            onClick={() => setViewport('desktop')}
            className={clsx(
              'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
              viewport === 'desktop' ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <i className="ti ti-device-desktop text-sm" /> Desktop
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={clsx(
              'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
              viewport === 'tablet' ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <i className="ti ti-device-tablet text-sm" /> Tablet (768px)
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={clsx(
              'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
              viewport === 'mobile' ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <i className="ti ti-device-mobile text-sm" /> Mobile (375px)
          </button>
        </div>
        <div className="text-gray-400 select-none text-[10px] flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live Sandbox
        </div>
      </div>

      {/* Browser Shell */}
      <div className={clsx("bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col transition-all duration-300", widthClass)}>
        {/* Browser Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          {/* Dot buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          {/* Address bar */}
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 flex-1 text-xs text-gray-500 select-none font-mono">
            <i className="ti ti-lock text-emerald-600" />
            <span className="truncate">{redirectUrl || 'https://portal.office.com'}</span>
          </div>
        </div>

        {/* Content iframe */}
        <div className="bg-gray-50 p-4 min-h-[500px] flex items-center justify-center w-full">
          <iframe
            srcDoc={html || '<h3>No HTML content</h3>'}
            title="Landing Page Preview"
            className="w-full min-h-[480px] bg-white border border-gray-200/80 rounded-lg shadow-sm"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  )
}

function PreviewFallback() {
  return (
    <div className="text-center text-gray-400 space-y-2 py-12">
      <i className="ti ti-eye-off text-3xl" />
      <p className="text-xs font-medium">
        Silakan klik &quot;Preview&quot; pada salah satu landing page di daftar atau klik tab &quot;Editor&quot; untuk mengedit template
      </p>
    </div>
  )
}

/* ─── HTML Syntax Highlighter ────────────────────────────────────────── */

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Sign in to your account</title>
  <style>body { font-family: sans-serif; }</style>
</head>
<body>
  <div class="login-card">
    <h2>Sign In</h2>
    <form action="" method="POST">
      <input type="email" name="email" placeholder="Email" />
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Submit</button>
    </form>
  </div>
</body>
</html>`

/**
 * Lightweight HTML syntax highlighter — returns an HTML string with
 * <span> color classes applied to tags, attributes, values, and comments.
 */
function highlightHtml(code) {
  // Escape HTML entities first so the code displays literally
  let safe = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Comments: <!-- ... -->
  safe = safe.replace(
    /(&lt;!--[\s\S]*?--&gt;)/g,
    '<span class="text-gray-500 italic">$1</span>'
  )

  // DOCTYPE
  safe = safe.replace(
    /(&lt;!DOCTYPE\s+[^&]*&gt;)/gi,
    '<span class="text-blue-400">$1</span>'
  )

  // Tags, attributes, and values
  // Opening/self-closing tags: <tagname attr="val" ...> or <tagname ... />
  safe = safe.replace(
    /(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)([^&]*?)(\/?)(&gt;)/g,
    (_, open, tagName, attrs, selfClose, close) => {
      // Highlight attributes within the tag
      const highlightedAttrs = attrs.replace(
        /([a-zA-Z-]+)(=)(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;|[^\s&]+)/g,
        '<span class="text-yellow-400">$1$2</span><span class="text-green-300">$3</span>'
      )
      return `<span class="text-blue-400">${open}${tagName}</span>${highlightedAttrs}<span class="text-blue-400">${selfClose}${close}</span>`
    }
  )

  return safe
}

/**
 * HtmlCodeEditor — a functional code editor with:
 * - Real <textarea> for editing
 * - Syntax-highlighted overlay (rendered behind the text via transparent textarea)
 * - Dynamic line numbers
 * - Synchronized scrolling between textarea and highlight layer
 */
function HtmlCodeEditor({ value, onChange }) {
  const textareaRef = useRef(null)
  const highlightRef = useRef(null)
  const lineNumRef = useRef(null)

  const lineCount = value.split('\n').length

  // Sync scroll between textarea → highlight overlay & line numbers
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop
      highlightRef.current.scrollLeft = ta.scrollLeft
    }
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = ta.scrollTop
    }
  }, [])

  const handleKeyDown = useCallback((e) => {
    // Tab inserts 2 spaces instead of moving focus
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.target
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newVal = ta.value.substring(0, start) + '  ' + ta.value.substring(end)
      onChange(newVal)
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }, [onChange])

  const highlighted = useMemo(() => highlightHtml(value), [value])

  return (
    <div className="bg-[#1e1e1e] font-mono text-[11px] h-[420px] flex relative">
      {/* Line numbers */}
      <div
        ref={lineNumRef}
        className="text-gray-600 select-none text-right pr-3 pl-3 border-r border-gray-800 flex-shrink-0 overflow-hidden pt-4 pb-4"
        style={{ width: 48, lineHeight: '1.625' }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="h-[17.875px] flex items-center justify-end">{i + 1}</div>
        ))}
      </div>

      {/* Stacked layers: highlight (behind) + textarea (in front, transparent text) */}
      <div className="relative flex-1 overflow-hidden">
        {/* Syntax-highlighted layer */}
        <pre
          ref={highlightRef}
          className="absolute inset-0 p-4 m-0 overflow-hidden pointer-events-none text-gray-300 whitespace-pre-wrap break-words"
          style={{ lineHeight: '1.625', wordBreak: 'break-all' }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
        />

        {/* Actual textarea (transparent text, visible caret) */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="absolute inset-0 w-full h-full resize-none p-4 m-0 bg-transparent border-none outline-none overflow-auto"
          style={{
            lineHeight: '1.625',
            color: 'transparent',
            caretColor: '#d4d4d4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        />
      </div>
    </div>
  )
}

/* ─── Editor Pane ────────────────────────────────────────────────────── */

function EditorPane({
  editingName,
  name,
  setName,
  htmlCode,
  setHtmlCode,
  redirectUrl,
  setRedirectUrl,
  captureData,
  setCaptureData,
  capturePass,
  setCapturePass,
  onBack,
  onSave
}) {
  const title = editingName ? `Edit: ${editingName}` : 'Buat landing page'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Konfigurasi template HTML untuk menangkap input kredensial simulasi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            onClick={() => onSave(name, htmlCode)}
            className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
          >
            Simpan template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left settings panel (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Konfigurasi template
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Nama template *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Microsoft 365 Login"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">
                Redirect URL (setelah submit)
              </label>
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={captureData}
                  onChange={(e) => setCaptureData(e.target.checked)}
                  className="mt-0.5 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                />
                <div>
                  <span className="block font-semibold text-gray-900">Capture submitted data</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">
                    Tangkap data parameter input yang dimasukkan user target
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={capturePass}
                  onChange={(e) => setCapturePass(e.target.checked)}
                  className="mt-0.5 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                />
                <div>
                  <span className="block font-semibold text-gray-900">Capture passwords</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">
                    Tangkap input password (direkomendasikan dalam mode terenkripsi)
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Code editor panel (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-gray-500 font-mono ml-2">template.html</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 select-none">
                {htmlCode.split('\n').length} baris
              </span>
              <span className="text-gray-400 select-none">HTML Source</span>
            </div>
          </div>

          {/* Functional Code Editor */}
          <HtmlCodeEditor value={htmlCode} onChange={setHtmlCode} />
        </div>
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export default function LandingPages() {
  const [pages, setPages] = useState(LANDING_PAGES)
  const [activeTab, setActiveTab] = useState('list')
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const [previewTitle, setPreviewTitle] = useState('Microsoft 365 Login')
  
  // Editor / Preview Shared state (lifting state up)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingHtml, setEditingHtml] = useState('')
  const [editingRedirectUrl, setEditingRedirectUrl] = useState('https://portal.office.com')
  const [editingCaptureData, setEditingCaptureData] = useState(true)
  const [editingCapturePass, setEditingCapturePass] = useState(true)

  const [syncing, setSyncing] = useState(false)

  /* ── Filtered cards ── */
  const filteredPages = useMemo(() => {
    let list = pages
    if (activeFilter !== 'all') {
      list = list.filter((p) => p.category === activeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [pages, activeFilter, searchQuery])

  const categories = useMemo(() => {
    return [
      { key: 'all', label: 'Semua', count: pages.length },
      { key: 'login', label: 'Login page', count: pages.filter((p) => p.category === 'login').length },
      { key: 'form', label: 'Form submission', count: pages.filter((p) => p.category === 'form').length },
      { key: 'redirect', label: 'Redirect only', count: pages.filter((p) => p.category === 'redirect').length },
    ]
  }, [pages])

  /* ── Handlers ── */
  const switchTab = useCallback((tab, reset) => {
    setActiveTab(tab)
    if (tab === 'list') {
      setEditingId(null)
      setEditingName('')
      setEditingHtml('')
      setEditingRedirectUrl('https://portal.office.com')
      setEditingCaptureData(true)
      setEditingCapturePass(true)
    }
  }, [])

  const handleEdit = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      setEditingId(page.id)
      setEditingName(page.name)
      setEditingHtml(page.html || '')
      setEditingRedirectUrl(page.redirectUrl || 'https://portal.office.com')
      setEditingCaptureData(page.badges?.includes('Data') ?? true)
      setEditingCapturePass(page.badges?.includes('Pass') ?? true)
      setActiveTab('editor')
    }
  }, [pages])

  const handlePreview = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      setPreviewId(id)
      setPreviewTitle(page.name)
      setEditingId(page.id)
      setEditingName(page.name)
      setEditingHtml(page.html || '')
      setEditingRedirectUrl(page.redirectUrl || 'https://portal.office.com')
      setEditingCaptureData(page.badges?.includes('Data') ?? true)
      setEditingCapturePass(page.badges?.includes('Pass') ?? true)
      setActiveTab('preview')
    }
  }, [pages])

  const handleCreate = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingHtml(DEFAULT_HTML)
    setEditingRedirectUrl('https://portal.office.com')
    setEditingCaptureData(true)
    setEditingCapturePass(true)
    setActiveTab('editor')
  }, [])

  const handleSave = useCallback((name, html) => {
    if (editingId) {
      setPages(prev => prev.map(p => p.id === editingId ? {
        ...p,
        name: name || p.name,
        html,
        redirectUrl: editingRedirectUrl,
        badges: [
          ...(editingCaptureData ? ['Data'] : []),
          ...(editingCapturePass ? ['Pass'] : [])
        ]
      } : p))
      toast.success(`Template "${name || 'Landing Page'}" berhasil disimpan`)
    } else {
      const newId = 'custom_' + Date.now()
      const newPage = {
        id: newId,
        name: name || 'Landing Page Baru',
        category: 'login',
        description: 'Template kustom dibuat oleh pengguna.',
        html,
        redirectUrl: editingRedirectUrl,
        thumbnail: {
          accent: null,
          bars: [{ w: 'w-3/4' }, { w: 'w-1/2' }],
        },
        badges: [
          ...(editingCaptureData ? ['Data'] : []),
          ...(editingCapturePass ? ['Pass'] : [])
        ]
      }
      setPages(prev => [...prev, newPage])
      toast.success(`Template baru "${newPage.name}" berhasil dibuat`)
    }
    setActiveTab('list')
    setEditingId(null)
    setEditingName('')
    setEditingHtml('')
    setEditingRedirectUrl('https://portal.office.com')
    setEditingCaptureData(true)
    setEditingCapturePass(true)
  }, [editingId, editingRedirectUrl, editingCaptureData, editingCapturePass])

  const handleSync = useCallback(() => {
    setSyncing(true)
    toast('Menyinkronkan data dari GoPhish...', { icon: '🔄' })
    setTimeout(() => {
      setSyncing(false)
      toast.success('Sinkronisasi selesai — 5 landing pages')
    }, 1500)
  }, [])

  /* ── Tab button classes ── */
  const tabBtnClass = (tab) =>
    clsx(
      'landing-tab-btn flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none select-none',
      activeTab === tab
        ? 'border-violet-500 text-violet-500'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    )

  /* ── Filter pill classes ── */
  const pillClass = (key) =>
    clsx(
      'landing-filter-pill px-4 py-1.5 rounded-full text-xs font-semibold transition-all select-none',
      activeFilter === key
        ? 'bg-gray-950 text-white'
        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
    )

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landing pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">Dikelola di GoPhish · terhubung via API</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <i className="ti ti-search text-base" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari landing page..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-all disabled:opacity-60"
          >
            <i className={clsx('ti ti-refresh text-base', syncing && 'animate-spin')} />
            <span>Sync GoPhish</span>
          </button>
          {/* Create button */}
          <button
            onClick={handleCreate}
            className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all"
          >
            <i className="ti ti-plus text-base" />
            <span>Buat landing page</span>
          </button>
        </div>
      </div>

      {/* ── Sub Tab Bar ── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 -mb-px" aria-label="Landing page subtabs">
          <button onClick={() => switchTab('list')} className={tabBtnClass('list')}>
            <i className="ti ti-list text-base" />
            <span>Daftar landing page</span>
          </button>
          <button onClick={() => switchTab('editor')} className={tabBtnClass('editor')}>
            <i className="ti ti-edit text-base" />
            <span>Editor</span>
          </button>
          <button onClick={() => switchTab('preview')} className={tabBtnClass('preview')}>
            <i className="ti ti-eye text-base" />
            <span>Preview</span>
          </button>
        </nav>
      </div>

      {/* ── Tab Panes ── */}
      <div className="space-y-6">

        {/* TAB 1: LIST PANE */}
        {activeTab === 'list' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveFilter(cat.key)}
                  className={pillClass(cat.key)}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>

            {/* Landing Pages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPages.map((page) => (
                <LandingPageCard
                  key={page.id}
                  page={page}
                  onEdit={handleEdit}
                  onPreview={handlePreview}
                />
              ))}
              <CreateCard onClick={handleCreate} />
            </div>
          </div>
        )}

        {/* TAB 2: EDITOR PANE */}
        {activeTab === 'editor' && (
          <EditorPane
            editingName={editingName}
            name={editingName}
            setName={setEditingName}
            htmlCode={editingHtml}
            setHtmlCode={setEditingHtml}
            redirectUrl={editingRedirectUrl}
            setRedirectUrl={setEditingRedirectUrl}
            captureData={editingCaptureData}
            setCaptureData={setEditingCaptureData}
            capturePass={editingCapturePass}
            setCapturePass={setEditingCapturePass}
            onBack={() => switchTab('list')}
            onSave={handleSave}
          />
        )}

        {/* TAB 3: PREVIEW PANE */}
        {activeTab === 'preview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewTitle}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Menampilkan simulasi tampilan persis di mata korban target
                </p>
              </div>
              <button
                onClick={() => switchTab('list')}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
              >
                Kembali ke daftar
              </button>
            </div>

            {/* Preview Viewport */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-100 flex flex-col items-center justify-center p-6 min-h-[450px]">
              {editingHtml ? (
                <BrowserPreview html={editingHtml} redirectUrl={editingRedirectUrl} />
              ) : (
                <PreviewFallback />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
