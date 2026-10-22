import Badge from '../../../components/UI/Badge.jsx'
import Button from '../../../components/UI/Button.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'

/**
 * The entity's quizzes (docs/PRD_QUIZ_MODULE.md §13). An entity may own several;
 * one is the default-followup — the quiz the education → quiz chain uses. A
 * presentational container: it renders the list the page hands it and calls
 * back for create / open / set-default / delete.
 */
export default function QuizListPanel({
  quizzes = [],
  canEdit = false,
  canPublish = false,
  busy = false,
  onCreate,
  onOpen,
  onSetDefault,
  onDelete,
}) {
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
          {quizzes.map(quiz => (
            <div key={quiz.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{quiz.title || 'Untitled quiz'}</span>
                  <Badge tone={quiz.status === 'published' ? 'success' : 'gray'}>{quiz.status === 'published' ? 'Published' : 'Draft'}</Badge>
                  {quiz.is_default_followup && <Badge tone="violet">Default follow-up</Badge>}
                  {!quiz.template_id && <Badge tone="warning">Legacy HTML</Badge>}
                </div>
                <p className="text-[11px] text-ink-faint">
                  {quiz.gophish_master_id ? `GoPhish master #${quiz.gophish_master_id}` : 'Not synced to GoPhish'}
                  {quiz.updated_at ? ` · updated ${quiz.updated_at}` : ''}
                </p>
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
          ))}
        </div>
      )}
    </div>
  )
}
