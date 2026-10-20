import { useState } from 'react'
import clsx from 'clsx'
import Modal from '../../../components/UI/Modal.jsx'
import PlaybookDetailBody from '../../../components/playbooks/PlaybookDetailBody.jsx'
import { PlaybookPreviewModal } from '../../../components/playbooks/PlaybookFormControls.jsx'
import { componentPreviewPanel } from '../../../utils/playbookUiModel.js'

/**
 * Read-only playbook detail in a wide modal, so the wizard can show the same
 * sections as the Playbooks page without leaving Step 2. Owns the nested
 * email/landing-page preview, which renders above this modal.
 */
export default function PlaybookDetailModal({ playbook, readiness, selected = false, onSelect, onClose }) {
  const [componentPreview, setComponentPreview] = useState(null)

  if (!playbook) return null

  const errors = Array.isArray(readiness?.errors) ? readiness.errors : []
  const notReady = Boolean(readiness) && !readiness.ready && errors.length > 0

  return (
    <>
      <Modal
        title={playbook.name}
        subtitle={`${playbook.entity} · ${playbook.category} · Difficulty ${playbook.diffScore}`}
        className="max-w-5xl"
        onClose={onClose}
        icon={(
          <span
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: playbook.iconBg }}
          >
            <i className={clsx('ti', playbook.iconName)} style={{ color: playbook.iconColor }} />
          </span>
        )}
        footer={(
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-line bg-panel px-4 py-2 text-sm font-semibold text-ink-soft transition-all hover:bg-panel-subtle"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onSelect?.(playbook.id)}
              disabled={selected}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selected ? (<><i className="ti ti-check" /> Selected</>) : 'Select this playbook'}
            </button>
          </>
        )}
      >
        {notReady && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
              <i className="ti ti-alert-triangle" />
              This playbook is not ready to launch yet
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-300">
              {errors.map(error => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}
        <PlaybookDetailBody
          playbook={playbook}
          onPreviewComponent={component => setComponentPreview(componentPreviewPanel(component))}
        />
      </Modal>
      <PlaybookPreviewModal preview={componentPreview} onClose={() => setComponentPreview(null)} />
    </>
  )
}
