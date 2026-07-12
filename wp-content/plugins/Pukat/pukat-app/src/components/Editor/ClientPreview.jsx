import { useState } from 'react'
import clsx from 'clsx'

/**
 * ClientPreview.jsx
 *
 * Simulated email client envelope with a desktop/mobile viewport toggle and
 * a sandboxed iframe rendering the template HTML.
 *
 * Extracted from EmailTemplates.jsx and MasterEmailTemplates.jsx where this
 * component was defined near-identically in both. The two copies had
 * diverged in copy (Indonesian vs English) for the timestamp and recipient
 * placeholder text, so those are parameterized rather than hardcoded to
 * preserve each page's original wording exactly.
 *
 * Used by:
 *  - src/pages/Simulation/EmailTemplates.jsx    (Indonesian copy, default)
 *  - src/pages/Admin/MasterEmailTemplates.jsx   (English copy, explicit props)
 */
export default function ClientPreview({
  html,
  sender,
  subject,
  timestampLabel = 'Hari ini, 10:24 AM',
  recipientLabel = '{{.Email}} (Karyawan Target)',
}) {
  const [viewport, setViewport] = useState('desktop') // 'desktop', 'mobile'

  const widthClass = {
    desktop: 'w-full max-w-4xl',
    mobile: 'w-[375px]'
  }[viewport]

  return (
    <div className="w-full flex flex-col items-center space-y-4 animate-fade-in">
      {/* Viewport Control Bar */}
      <div className="flex items-center justify-between w-full max-w-4xl bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs">
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
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" /> Interactive sandbox
        </div>
      </div>

      {/* Simulated Email Client Envelope */}
      <div className={clsx("bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col transition-all duration-300", widthClass)}>
        <div className="bg-white border-b border-gray-150 p-4 space-y-3 shadow-sm select-none">
          <div className="flex flex-wrap items-center justify-between text-xs border-b border-gray-100 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900">
                {sender ? sender.split('<')[0].trim() : 'Sender Name'}
              </span>
              <span className="text-gray-400 font-mono text-[10px]">
                {sender ? `<${sender.split('<')[1] || ''}` : '<sender@example.com>'}
              </span>
            </div>
            <span className="text-gray-400">{timestampLabel}</span>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex gap-2">
              <span className="text-gray-400 w-16">To:</span>
              <span className="text-gray-900 font-medium">{recipientLabel}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 w-16">Subject:</span>
              <span className="text-gray-900 font-semibold">{subject || 'No Subject'}</span>
            </div>
          </div>
        </div>

        {/* Content iframe */}
        <div className="bg-gray-50 p-4 min-h-[400px] flex items-center justify-center">
          <iframe
            srcDoc={html || '<h3>No HTML body</h3>'}
            title="Email Template Preview"
            className="w-full min-h-[380px] bg-white border border-gray-200/80 rounded-lg shadow-sm"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  )
}
