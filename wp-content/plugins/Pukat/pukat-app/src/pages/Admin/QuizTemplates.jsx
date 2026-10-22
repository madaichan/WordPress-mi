import { useState } from 'react'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import { useQuizPagesOverview, useQuizTemplates } from '../../hooks/queries/useQuizQueries.js'
import {
  useCreateQuizTemplateMutation,
  useDeleteQuizTemplateMutation,
  useUpdateQuizTemplateMutation,
} from '../../hooks/mutations/useQuizMutations.js'
import { QuizOverviewPanel, QuizTemplateAdminPanel } from '../../features/quiz/components/index.js'

const TABS = [
  { key: 'templates', label: 'Templates', icon: 'ti-layout-board' },
  { key: 'overview', label: 'Quizzes', icon: 'ti-list-search' },
]

/**
 * Admin-only area for the quiz template catalogue (shared, admin-authored) and
 * a cross-entity overview of every quiz — who uses it (live GoPhish chain
 * linkage) and how much (recorded results). Its own admin-panel page because
 * operators only pick templates in the builder (docs/PRD_QUIZ_MODULE.md §13).
 * Both routes are gated by quiz_templates.view, so this page is admin-only.
 *
 * Orchestration layer: owns the queries + mutations and hands data/callbacks
 * to the panels (AGENTS.md §4.2).
 */
export default function QuizTemplates() {
  const [tab, setTab] = useState('templates')

  const { data: templatesData, isLoading: loadingTemplates } = useQuizTemplates()
  const { data: overviewData, isLoading: loadingOverview, isError: overviewError, error: overviewErrObj } = useQuizPagesOverview({ enabled: tab === 'overview' })
  const createTemplate = useCreateQuizTemplateMutation()
  const updateTemplate = useUpdateQuizTemplateMutation()
  const deleteTemplate = useDeleteQuizTemplateMutation()

  const templates = templatesData?.templates || []
  const busy = createTemplate.isPending || updateTemplate.isPending || deleteTemplate.isPending

  return (
    <PageShell animated={false}>
      <PageHeader
        title="Quiz Templates"
        subtitle="Reusable quiz shells and a cross-entity view of every quiz"
      />

      <Tabs items={TABS} active={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === 'templates' && (
          loadingTemplates
            ? <p className="text-sm text-ink-faint">Loading templates…</p>
            : (
              <QuizTemplateAdminPanel
                templates={templates}
                busy={busy}
                onCreate={(payload, done) => createTemplate.mutate(payload, { onSuccess: done })}
                onUpdate={({ id, data: payload }, done) => updateTemplate.mutate({ id, data: payload }, { onSuccess: done })}
                onDelete={template => deleteTemplate.mutate(template.id)}
              />
            )
        )}

        {tab === 'overview' && (
          loadingOverview
            ? <p className="text-sm text-ink-faint">Loading quizzes…</p>
            : overviewError
              ? <p className="text-sm text-danger">{overviewErrObj?.message || 'Could not load the quiz overview.'}</p>
              : (
                <QuizOverviewPanel
                  quizzes={overviewData?.quizzes || []}
                  gophishOk={overviewData?.gophish_ok !== false}
                />
              )
        )}
      </div>
    </PageShell>
  )
}
