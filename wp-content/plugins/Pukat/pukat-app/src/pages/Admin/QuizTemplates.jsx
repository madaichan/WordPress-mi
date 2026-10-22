import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import { useQuizTemplates } from '../../hooks/queries/useQuizQueries.js'
import {
  useCreateQuizTemplateMutation,
  useDeleteQuizTemplateMutation,
  useUpdateQuizTemplateMutation,
} from '../../hooks/mutations/useQuizMutations.js'
import { QuizTemplateAdminPanel } from '../../features/quiz/components/index.js'

/**
 * Admin-only catalogue of reusable quiz templates (docs/PRD_QUIZ_MODULE.md §13).
 * Its own admin-panel page (not a tab in the operator Quiz Module) because the
 * catalogue is shared across entities and only admins author it — operators
 * merely pick a template in the builder. The route is gated by
 * `quiz_templates.view`, so this page only appears for admins.
 *
 * Orchestration layer: owns the queries + mutations and hands data/callbacks to
 * QuizTemplateAdminPanel (AGENTS.md §4.2).
 */
export default function QuizTemplates() {
  const { data, isLoading } = useQuizTemplates()
  const createTemplate = useCreateQuizTemplateMutation()
  const updateTemplate = useUpdateQuizTemplateMutation()
  const deleteTemplate = useDeleteQuizTemplateMutation()

  const templates = data?.templates || []
  const busy = createTemplate.isPending || updateTemplate.isPending || deleteTemplate.isPending

  return (
    <PageShell animated={false}>
      <PageHeader
        title="Quiz Templates"
        subtitle="Reusable, styled quiz shells operators build from — shared across all entities"
      />
      {isLoading ? (
        <p className="text-sm text-ink-faint">Loading templates…</p>
      ) : (
        <QuizTemplateAdminPanel
          templates={templates}
          busy={busy}
          onCreate={(payload, done) => createTemplate.mutate(payload, { onSuccess: done })}
          onUpdate={({ id, data: payload }, done) => updateTemplate.mutate({ id, data: payload }, { onSuccess: done })}
          onDelete={template => deleteTemplate.mutate(template.id)}
        />
      )}
    </PageShell>
  )
}
