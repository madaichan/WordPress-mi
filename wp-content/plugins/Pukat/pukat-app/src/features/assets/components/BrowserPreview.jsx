import { useState } from 'react'
import clsx from 'clsx'

const VIEWPORTS = [
  ['desktop', 'ti-device-desktop', 'Desktop'],
  ['tablet', 'ti-device-tablet', 'Tablet (768px)'],
  ['mobile', 'ti-device-mobile', 'Mobile (375px)'],
]

const WIDTH_CLASS = {
  desktop: 'w-full max-w-5xl',
  tablet: 'w-[768px]',
  mobile: 'w-[375px]',
}

export default function BrowserPreview({ html, redirectUrl, title = 'Landing Page Preview' }) {
  const [viewport, setViewport] = useState('desktop')

  return (
    <div className="flex w-full flex-col items-center space-y-4 animate-fade-in">
      <div className="flex w-full max-w-5xl items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="mr-2 font-semibold text-gray-500">Viewport:</span>
          {VIEWPORTS.map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewport(key)}
              className={clsx('flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-all', viewport === key ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50')}
            >
              <i className={clsx('ti text-sm', icon)} /> {label}
            </button>
          ))}
        </div>
        <div className="flex select-none items-center gap-1 text-[10px] text-gray-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live Sandbox
        </div>
      </div>

      <div className={clsx('flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300', WIDTH_CLASS[viewport])}>
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-yellow-400" />
            <span className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="flex flex-1 select-none items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-xs text-gray-500">
            <i className="ti ti-lock text-emerald-600" />
            <span className="truncate">{redirectUrl || 'https://portal.office.com'}</span>
          </div>
        </div>
        <div className="flex min-h-[500px] w-full items-center justify-center bg-gray-50 p-4">
          <iframe
            srcDoc={html || '<h3>No HTML content</h3>'}
            title={title}
            className="min-h-[480px] w-full rounded-lg border border-gray-200/80 bg-white shadow-sm"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  )
}
