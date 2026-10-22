import { useState } from 'react'
import toast from 'react-hot-toast'
import Button from '../../../components/UI/Button.jsx'
import Modal from '../../../components/UI/Modal.jsx'
import { useGophishEmailTemplates, useGophishSmtpProfiles } from '../../../hooks/queries/useGophishQueries.js'

/** Pukat's placeholder chain assets — the backend refuses them, so don't offer them. */
const PLACEHOLDER_PREFIXES = ['pukat-quiz-tmpl-', 'pukat-quiz-smtp-', 'pukat-edu-tmpl-', 'pukat-edu-smtp-']

const isPlaceholder = (name = '') => PLACEHOLDER_PREFIXES.some(prefix => String(name).startsWith(prefix))

/**
 * Send the quiz to people the redirect chain never reaches
 * (docs/PRD_QUIZ_MODULE.md FR-15).
 *
 * This really sends email, which the dialog says plainly. It creates an
 * ordinary quiz campaign with the chosen template and sending profile — not
 * recipients on the master, whose template is a placeholder GoPhish froze at
 * creation.
 */
export default function SendQuizDialog({ onClose, onSend, busy = false }) {
  const [emails, setEmails] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [smtpName, setSmtpName] = useState('')

  const { data: templates = [] } = useGophishEmailTemplates()
  const { data: profiles = [] } = useGophishSmtpProfiles()

  const templateOptions = templates.filter(t => !isPlaceholder(t.name))
  const profileOptions = profiles.filter(p => !isPlaceholder(p.name))

  const recipients = emails
    .split(/[\s,;]+/)
    .map(value => value.trim())
    .filter(Boolean)

  function submit() {
    if (recipients.length === 0) { toast.error('Add at least one recipient email.'); return }
    if (!templateName) { toast.error('Choose the email template to send.'); return }
    if (!smtpName) { toast.error('Choose the sending profile to send from.'); return }

    onSend?.({
      targets: recipients.map(email => ({ email })),
      template_name: templateName,
      smtp_name: smtpName,
    })
  }

  return (
    <Modal
      onClose={onClose}
      title="Send quiz manually"
      subtitle="For people the simulation chain never reached"
      footer={(
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Sending...' : `Send to ${recipients.length || 0} recipient(s)`}
          </Button>
        </div>
      )}
    >
      <div className="space-y-4 text-xs">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300">
          <i className="ti ti-mail-forward mt-0.5 text-base" />
          <span>
            This sends a real email to everyone listed, right away. Recipients must be on this entity&apos;s allow-listed email
            domains, and the quiz page must already be published and synced.
          </span>
        </div>

        <label className="block space-y-1">
          <span className="font-semibold text-ink-soft">Recipients *</span>
          <textarea
            value={emails}
            onChange={e => setEmails(e.target.value)}
            rows={4}
            placeholder="budi@perusahaan.co.id, siti@perusahaan.co.id"
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
          />
          <span className="block text-[10px] text-ink-faint">Separate addresses with commas, spaces or new lines. Up to 200 per send.</span>
        </label>

        <label className="block space-y-1">
          <span className="font-semibold text-ink-soft">Email template *</span>
          <select
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
          >
            <option value="">— Choose a template —</option>
            {templateOptions.map(t => <option key={t.id ?? t.name} value={t.name}>{t.name}</option>)}
          </select>
          <span className="block text-[10px] text-ink-faint">The template must link to the quiz with GoPhish&apos;s {'{{.URL}}'} token.</span>
        </label>

        <label className="block space-y-1">
          <span className="font-semibold text-ink-soft">Sending profile *</span>
          <select
            value={smtpName}
            onChange={e => setSmtpName(e.target.value)}
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
          >
            <option value="">— Choose a sending profile —</option>
            {profileOptions.map(p => <option key={p.id ?? p.name} value={p.name}>{p.name}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  )
}
