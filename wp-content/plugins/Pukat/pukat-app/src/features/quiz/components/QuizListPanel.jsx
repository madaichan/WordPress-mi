import { useState } from 'react'
import Badge from '../../../components/UI/Badge.jsx'
import Button from '../../../components/UI/Button.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import Modal from '../../../components/UI/Modal.jsx'

/** Direct vs via-education counts from a quiz's linked campaigns. */
function split(linked = []) {
  return {
    direct: linked.filter(c => c.via === 'quiz').length,
    education: linked.filter(c => c.via === 'education').length,
  }
}

/**
 * The entity's quizzes (docs/PRD_QUIZ_MODULE.md §13). An entity may own several;
 * one is the default-followup — the quiz the education → quiz chain uses. Each
 * row shows how many simulations route into the quiz (its chain linkage), click
 * for the detail. A presentational container: it renders the list the page
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
            const { direct, education } = split(quiz.linked_campaigns)
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
                  {/* Chain linkage: how many simulations route into this quiz */}
                  {!gophishOk ? (
                    <span className="text-[11px] text-ink-faint"><i className="ti ti-link-off" /> linkage unavailable (GoPhish unreachable)</span>
                  ) : count > 0 ? (
                    <button
                      type="button"
                      onClick={() => setDetail(quiz)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-600 hover:bg-violet-500/20 dark:text-violet-400"
                      title="Show the simulations linked to this quiz"
                    >
                      <i className="ti ti-link" />
                      {count} simulation{count > 1 ? 's' : ''}
                      <span className="font-normal text-ink-faint">({direct} direct · {education} via edu)</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-ink-faint"><i className="ti ti-link" /> no linked simulation</span>
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

      {detail && (
        <Modal
          open
          onClose={() => setDetail(null)}
          title="Linked simulations"
          subtitle={`${detail.title || 'Quiz'} · ${detail.linkage_count || 0} simulation(s) route into this quiz`}
        >
          {(detail.linked_campaigns || []).length === 0 ? (
            <p className="text-sm text-ink-faint">No simulation is chained to this quiz.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {detail.linked_campaigns.map(c => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate text-ink">{c.name}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={c.via === 'quiz' ? 'violet' : 'gray'}>{c.via === 'quiz' ? 'direct → quiz' : 'via education'}</Badge>
                    <span className="text-ink-faint">{c.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-ink-faint">
            <span className="font-semibold">Direct</span> = a simulation that chains straight to this quiz.
            <span className="ml-1 font-semibold">Via education</span> = a simulation that chains to the education page, which then leads here.
          </p>
        </Modal>
      )}
    </div>
  )
}
