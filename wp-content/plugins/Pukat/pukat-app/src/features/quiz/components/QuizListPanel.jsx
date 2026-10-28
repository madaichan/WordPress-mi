import { useState } from 'react'
import Badge from '../../../components/UI/Badge.jsx'
import Button from '../../../components/UI/Button.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import Modal from '../../../components/UI/Modal.jsx'

/**
 * The entity's quizzes (docs/PRD_QUIZ_MODULE.md §13). An entity may own several;
 * one is the default-followup — the quiz the education → quiz chain uses. Each
 * row shows the simulations pointed straight at the quiz, click for the detail;
 * the education route is a separate note, because it belongs to the entity (one
 * shared link) and not to any campaign the operator picked. A presentational container: it renders the list the page
 * hands it and calls back for create / open / set-default / delete.
 */
export default function QuizListPanel({
  quizzes = [],
  gophishOk = true,
  canEdit = false,
  canPublish = false,
  busy = false,
  onCreate,
  onOpen,
  onSetDefault,
  onDelete,
}) {
  // { quiz, mode } — which quiz's chain to show, and which side of it:
  // 'direct' = campaigns pointed at the quiz, 'education' = campaigns that
  // reach it through the entity's education page.
  const [detail, setDetail] = useState(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs text-ink-muted">
          Build a quiz without code: pick a template, fill its fields, and choose which questions appear. One quiz is the
          <span className="font-semibold text-ink-soft"> default follow-up</span> — the quiz used after the education page in a chained simulation.
        </p>
        {canEdit && (
          <Button variant="primary" size="sm" onClick={onCreate} disabled={busy}>
            <i className="ti ti-plus text-sm" />
            <span>New quiz</span>
          </Button>
        )}
      </div>

      {quizzes.length === 0 ? (
        <EmptyState
          icon="ti-list-check"
          title="No quizzes yet"
          description={canEdit ? 'Create a quiz from a template to get started.' : 'This entity has no quizzes yet.'}
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {quizzes.map(quiz => {
            const count = quiz.linkage_count || 0
            const edu = quiz.education_chain || {}
            const eduCount = edu.campaign_count || 0
            return (
              <div key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{quiz.title || 'Untitled quiz'}</span>
                    <Badge tone={quiz.status === 'published' ? 'success' : 'gray'}>{quiz.status === 'published' ? 'Published' : 'Draft'}</Badge>
                    {quiz.is_default_followup && <Badge tone="violet">Default follow-up</Badge>}
                    {!quiz.template_id && <Badge tone="warning">Legacy HTML</Badge>}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-faint">
                    <span>{quiz.gophish_master_id ? `GoPhish master #${quiz.gophish_master_id}` : 'Not synced to GoPhish'}</span>
                    {quiz.updated_at && <span>· updated {quiz.updated_at}</span>}
                  </p>
                  {/* Chain linkage, by the two routes that end at this quiz:
                      simulation -> quiz, and simulation -> education -> quiz.
                      A simulation that only asked for education is not shown. */}
                  {!gophishOk ? (
                    <span className="text-[11px] text-ink-faint"><i className="ti ti-link-off" /> linkage unavailable (GoPhish unreachable)</span>
                  ) : count + eduCount === 0 ? (
                    <span className="text-[11px] text-ink-faint"><i className="ti ti-link" /> no simulation leads to this quiz</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {count > 0 && (
                        <ChainChip
                          icon="ti-link"
                          label={`${count} simulation${count > 1 ? 's' : ''} → quiz`}
                          title="Show the simulations that chain straight to this quiz"
                          onClick={() => setDetail({ quiz, mode: 'direct' })}
                        />
                      )}
                      {eduCount > 0 && (
                        <ChainChip
                          icon="ti-arrow-ramp-right-2"
                          label={`${eduCount} simulation${eduCount > 1 ? 's' : ''} → education → quiz`}
                          title="Show the simulations that reach this quiz through the education page"
                          onClick={() => setDetail({ quiz, mode: 'education' })}
                        />
                      )}
                    </div>
                  )}
                  {gophishOk && edu.education_only_count > 0 && (
                    <p className="text-[11px] text-ink-faint">
                      {`${edu.education_only_count} other campaign${edu.education_only_count > 1 ? 's' : ''} stop${edu.education_only_count > 1 ? '' : 's'} at the education page (no quiz follow-up asked for)`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpen?.(quiz)}>{canEdit ? 'Edit' : 'View'}</Button>
                  {canPublish && !quiz.is_default_followup && (
                    <Button variant="outline" size="sm" onClick={() => onSetDefault?.(quiz)} disabled={busy} title="Use this quiz as the education → quiz follow-up">
                      Set default
                    </Button>
                  )}
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => onDelete?.(quiz)} disabled={busy}>
                      <i className="ti ti-trash text-sm text-danger" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {detail && <ChainModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

/**
 * One quiz's chain, from whichever side the operator clicked: the campaigns
 * pointed straight at the quiz, or the ones that only reach it because the
 * entity's education page currently continues here.
 */
function ChainModal({ detail, onClose }) {
  const { quiz, mode } = detail
  const education = quiz.education_chain || {}
  const viaEducation = mode === 'education'
  const campaigns = (viaEducation ? education.campaigns : quiz.linked_campaigns) || []

  return (
    <Modal
      open
      onClose={onClose}
      title={viaEducation ? 'Simulation → education → quiz' : 'Simulation → quiz'}
      subtitle={
        viaEducation
          ? `${quiz.title || 'Quiz'} · ${campaigns.length} simulation(s) run the education page first, then land here`
          : `${quiz.title || 'Quiz'} · ${campaigns.length} simulation(s) chain straight to this quiz`
      }
    >
      {campaigns.length === 0 ? (
        <p className="text-sm text-ink-faint">
          {viaEducation ? 'No simulation reaches this quiz through the education page.' : 'No simulation chains straight to this quiz.'}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {campaigns.map(c => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="min-w-0 truncate text-ink">{c.name}</span>
              <span className="flex items-center gap-2">
                <Badge tone={viaEducation ? 'gray' : 'violet'}>{viaEducation ? 'sim → education → quiz' : 'sim → quiz'}</Badge>
                <span className="text-ink-faint">{c.status}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">
        {viaEducation ? (
          <>
            These simulations asked for quiz follow-up and were chained to the entity&apos;s education page, which continues to
            whichever quiz is the default follow-up — right now, this one. The onward link is one shared setting read live from
            GoPhish, not recorded per campaign, so finished runs stay in the list and the route changes if the default changes.
            {education.education_only_count > 0 &&
              ` ${education.education_only_count} further campaign(s) chain to the same education page without asking for a quiz; they are left out.`}
          </>
        ) : (
          <>
            These simulations carry their own link to this quiz master, with no education page in between.
            {education.chained && ' Simulations that go through education are listed under the other count on the quiz row.'}
          </>
        )}
      </p>
    </Modal>
  )
}

/** One clickable linkage count on a quiz row. */
function ChainChip({ icon, label, title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-600 hover:bg-violet-500/20 dark:text-violet-400"
    >
      <i className={`ti ${icon}`} />
      {label}
    </button>
  )
}
