import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import useAppStore from '../../store/useAppStore.js'
import { useMyProfile } from '../../hooks/queries/useProfileQueries.js'
import { useQuizPage, useQuizPages, useQuizQuestions, useQuizTemplates } from '../../hooks/queries/useQuizQueries.js'
import {
  useCreateQuizPageMutation,
  useCreateQuizQuestionMutation,
  useDeleteQuizPageMutation,
  useDeleteQuizQuestionMutation,
  usePublishQuizPageMutation,
  useSaveQuizPageMutation,
  useSetDefaultQuizPageMutation,
  useSyncQuizPageMutation,
  useUnpublishQuizPageMutation,
  useUpdateQuizQuestionMutation,
} from '../../hooks/mutations/useQuizMutations.js'
import { quizApi } from '../../api/index.js'
import {
  QuestionBankPanel,
  QuizBuilder,
  QuizListPanel,
  SendQuizDialog,
} from '../../features/quiz/components/index.js'

/**
 * Quiz Module (docs/PRD_QUIZ_MODULE.md FR-1, §13 Quiz Builder v2) — the
 * orchestration layer: it owns the queries, the mutations, the permission
 * props and the composition, and hands plain data plus callbacks to the
 * components (AGENTS.md §4.2).
 */
export default function Quiz() {
  const [tab, setTab] = useState('bank')
  const [inviting, setInviting] = useState(false)
  const [sending, setSending] = useState(false)
  // Quiz Page tab: null = quiz list; a number = that quiz open in the builder.
  const [openQuizId, setOpenQuizId] = useState(null)

  const { data: profile } = useMyProfile()
  const entityName = String(profile?.entity || '').trim()
  const isGeneralEntity = entityName.toLowerCase() === 'general'
  const isAdmin = useAppStore(state => state.isAdmin())
  const canManageBankPerm = useAppStore(state => state.hasPermission('post_sim.manage'))
  const canEditPagePerm = useAppStore(state => state.hasPermission('quiz_pages.edit'))
  const canPublishPagePerm = useAppStore(state => state.hasPermission('quiz_pages.publish'))
  const canInvitePerm = useAppStore(state => state.hasPermission('quiz_pages.invite'))

  // Mirrors backend scoping only to avoid showing actions that would 403 — the
  // backend is the real enforcement.
  const canManageBank = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canManageBankPerm))
  const canEditPage = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canEditPagePerm))
  const canPublishPage = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canPublishPagePerm))
  const canInvite = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canInvitePerm))

  const tabs = useMemo(() => ([
    { key: 'bank', label: 'Question Bank', icon: 'ti-list-numbers' },
    { key: 'page', label: 'Quiz Page', icon: 'ti-file-code' },
  ]), [])

  const requestExtras = useMemo(() => ({}), [])
  const { data: bank, isLoading: loadingBank } = useQuizQuestions(requestExtras)
  const { data: pagesData, isLoading: loadingPages } = useQuizPages(requestExtras, { enabled: tab === 'page' })
  const { data: openPage, isLoading: loadingOpenPage } = useQuizPage(
    { ...requestExtras, id: openQuizId },
    { enabled: tab === 'page' && Boolean(openQuizId) },
  )
  const { data: templatesData } = useQuizTemplates(requestExtras, { enabled: tab === 'page' })

  const createQuestion = useCreateQuizQuestionMutation()
  const updateQuestion = useUpdateQuizQuestionMutation()
  const deleteQuestion = useDeleteQuizQuestionMutation()
  const createPage = useCreateQuizPageMutation()
  const setDefaultPage = useSetDefaultQuizPageMutation()
  const deletePage = useDeleteQuizPageMutation()
  const saveMutation = useSaveQuizPageMutation()
  const publishMutation = usePublishQuizPageMutation()
  const unpublishMutation = useUnpublishQuizPageMutation()
  const syncMutation = useSyncQuizPageMutation()

  const questions = bank?.questions || []
  const quizzes = pagesData?.quizzes || []
  const templates = templatesData?.templates || []
  const bankBusy = createQuestion.isPending || updateQuestion.isPending || deleteQuestion.isPending
  const pageBusy = createPage.isPending || setDefaultPage.isPending || deletePage.isPending

  const defaultQuiz = quizzes.find(q => q.is_default_followup)
  const canSendInvite = canInvite && Boolean(defaultQuiz && defaultQuiz.status === 'published' && defaultQuiz.gophish_master_id)

  async function handleSendInvite(payload) {
    setSending(true)
    try {
      const result = await quizApi.invite(payload)
      toast.success(`Quiz sent to ${result?.recipients ?? 0} recipient(s).`)
      setInviting(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <PageShell animated={false}>
      <PageHeader
        title="Quiz Module"
        subtitle={entityName ? `Question bank and quizzes for ${entityName}` : 'Question bank and quizzes'}
        actions={canSendInvite ? (
          <Button variant="outline" onClick={() => setInviting(true)}>
            <i className="ti ti-send text-base" />
            <span>Send quiz manually</span>
          </Button>
        ) : null}
      />

      {!entityName && (
        <p className="mb-4 text-sm text-ink-muted">Your account must be assigned to an entity before you can manage its quiz.</p>
      )}

      <Tabs items={tabs} active={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === 'bank' && (
          loadingBank
            ? <p className="text-sm text-ink-faint">Loading questions…</p>
            : (
              <QuestionBankPanel
                questions={questions}
                canManage={canManageBank}
                busy={bankBusy}
                onCreate={(data, done) => createQuestion.mutate(data, { onSuccess: done })}
                onUpdate={({ id, data }, done) => updateQuestion.mutate({ id, data }, { onSuccess: done })}
                onDelete={question => deleteQuestion.mutate(question.id)}
              />
            )
        )}

        {tab === 'page' && (
          openQuizId
            ? (loadingOpenPage || !openPage
              ? <p className="text-sm text-ink-faint">Loading quiz…</p>
              : (
                <QuizBuilder
                  key={openPage.id}
                  page={openPage}
                  templates={templates}
                  questions={questions}
                  canEdit={canEditPage}
                  canPublish={canPublishPage}
                  onBack={() => setOpenQuizId(null)}
                  saveMutation={saveMutation}
                  publishMutation={publishMutation}
                  unpublishMutation={unpublishMutation}
                  syncMutation={syncMutation}
                />
              ))
            : (loadingPages
              ? <p className="text-sm text-ink-faint">Loading quizzes…</p>
              : (
                <QuizListPanel
                  quizzes={quizzes}
                  gophishOk={pagesData?.gophish_ok !== false}
                  canEdit={canEditPage}
                  canPublish={canPublishPage}
                  busy={pageBusy}
                  onCreate={() => createPage.mutate({ data: {} }, { onSuccess: res => setOpenQuizId(res?.id || null) })}
                  onOpen={quiz => setOpenQuizId(quiz.id)}
                  onSetDefault={quiz => setDefaultPage.mutate({ data: { id: quiz.id } })}
                  onDelete={quiz => deletePage.mutate({ data: { id: quiz.id } })}
                />
              ))
        )}
      </div>

      {inviting && (
        <SendQuizDialog
          busy={sending}
          onClose={() => setInviting(false)}
          onSend={handleSendInvite}
        />
      )}
    </PageShell>
  )
}
