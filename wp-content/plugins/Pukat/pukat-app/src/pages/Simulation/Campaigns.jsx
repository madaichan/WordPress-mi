import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCampaignList, useCampaignRun } from '../../hooks/queries/useCampaignQueries.js'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { usePlaybooks } from '../../hooks/queries/usePlaybookQueries.js'
import {
  useCreateCampaignMutation,
  useCreateCampaignRunMutation,
  useUpdateCampaignRunMutation,
  useImportCampaignRunTargetsMutation,
  useLaunchCampaignRunMutation,
  useDeleteCampaignMutation,
} from '../../hooks/mutations/useCampaignMutations.js'
import { buildCampaignLaunchPayload, buildTargetImportPayload, regionForTimezone, localDateAndTimeFromScheduleAt, todayDateString, addDaysToDateString, minSendTimeForDate, isScheduleSendTimeInvalid } from '../../utils/campaignLaunch.js'
import WizardStepper from '../../features/campaigns/WizardStepper.jsx'
import DeleteModal from '../../features/campaigns/DeleteModal.jsx'
import WorkspaceHeader from '../../features/campaigns/WorkspaceHeader.jsx'
import WorkspaceTabs from '../../features/campaigns/WorkspaceTabs.jsx'
import Step1 from '../../features/campaigns/Wizard/Step1.jsx'
import Step2 from '../../features/campaigns/Wizard/Step2.jsx'
import Step3 from '../../features/campaigns/Wizard/Step3.jsx'
import OverviewView from '../../features/campaigns/Overview/OverviewView.jsx'
import CalendarView from '../../features/campaigns/Views/CalendarView.jsx'
import MonitoringView from '../../features/campaigns/Views/MonitoringView.jsx'
import AssetsView from '../../features/campaigns/Reports/AssetsView.jsx'
import ReportView from '../../features/campaigns/Reports/ReportView.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'

// ── Static data ──────────────────────────────────────────────────────────────

const STATIC_CAMPAIGNS = [
  { id: 1, name: 'Q2 phishing wave', status: 'active', difficulty: 4, target_count: 1240, launched_at: '2025-06-18T00:00:00Z' },
  { id: 2, name: 'BEC scenario — finance', status: 'scheduled', difficulty: 4, target_count: 420, launched_at: null },
  { id: 3, name: 'Q1 awareness check', status: 'completed', difficulty: 2, target_count: 800, launched_at: '2025-03-10T00:00:00Z' },
]

function makeInitialForm() {
  const today = todayDateString()

  return {
    name: '',
    desc: '',
    mode: 'playbook',
    playbook: '',
    scheduleEnabled: true,
    dateStart: today,
    dateEnd: addDaysToDateString(today, 1),
    sendTime: minSendTimeForDate(today),
    timezone: 'WIB',
    followUp: {
      quizEnabled: true,
      forceResetPasswordReminderEnabled: false,
    },
  }
}

const PLAYBOOK_TYPE_COLORS = {
  BEC: 'text-red-700',
  Credential: 'text-amber-700',
  Malware: 'text-emerald-700',
  Vishing: 'text-purple-700',
}

function difficultyNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 3
  return Math.min(Math.max(number, 1), 5)
}

function playbookTypeFromRow(row) {
  const text = `${row.scenario || ''} ${row.name || ''} ${row.description || ''}`.toLowerCase()

  if (/(bec|invoice|vendor|ceo|payment|billing)/.test(text)) return 'BEC'
  if (/(malware|attachment|file|policy|hr)/.test(text)) return 'Malware'
  if (/(vishing|voice|phone|call)/.test(text)) return 'Vishing'

  return 'Credential'
}

function statusMeta(status) {
  const normalized = String(status || 'draft').toLowerCase()

  if (normalized === 'active') return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' }
  if (normalized === 'approved') return { label: 'Approved', className: 'bg-blue-100 text-blue-700' }
  if (normalized === 'archived') return { label: 'Archived', className: 'bg-gray-100 text-gray-600' }

  return { label: 'Draft', className: 'bg-amber-100 text-amber-700' }
}

function playbookMasterToWizardCard(row) {
  const type = playbookTypeFromRow(row)
  const status = statusMeta(row.status)

  return {
    id: String(row.id),
    name: row.name || `Playbook ${row.id}`,
    desc: row.description || row.objective || 'Reusable Playbook Master from database.',
    type,
    typeColor: PLAYBOOK_TYPE_COLORS[type] ?? PLAYBOOK_TYPE_COLORS.Credential,
    diff: difficultyNumber(row.difficulty),
    status: row.status || 'draft',
    statusLabel: status.label,
    statusClass: status.className,
    readiness: row.readiness || { ready: false, errors: [] },
    raw: row,
  }
}

const TABLE_KEY = 'campaigns'
const DEFAULT_TABLE_STATE = { search: '', sort: 'created_at', order: 'desc', page: 1, perPage: 10, filters: {} }

// ── Main component ────────────────────────────────────────────────────────────

export default function Campaigns() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // View state: 'overview' | 'calendar' | 'monitoring' | 'report' | 'assets' | 'new'
  const [view, setView] = useState('new')
  const [reportTab, setReportTab] = useState('report')

  // List state
  const page = 1
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [deleteTarget, setDelete] = useState(null)

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [form, setForm] = useState(makeInitialForm)
  const [csvData, setCsvData] = useState([])
  const [launchStage, setLaunchStage] = useState(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  // Resuming an existing `draft_run` via the "Edit" row action on Manage
  // Campaigns (/campaigns?edit=<id>) — editingRunId is only set once that
  // draft has actually loaded and prefilled the form below, so save/launch
  // know to update the existing run instead of creating a new one.
  const editRunIdParam = searchParams.get('edit')
  const editRunId = editRunIdParam ? Number(editRunIdParam) : null
  const [editingRunId, setEditingRunId] = useState(null)

  // Queries
  const { data } = useCampaignList({ page, per_page: 10 }, {
    placeholderData: prev => prev,
  })

  const { data: editRunData, isError: isEditRunError } = useCampaignRun(editRunId)

  const { data: schema } = useTableSchema(TABLE_KEY)
  const { data: rowsData, isLoading: isLoadingRows, isFetching: isFetchingRows, refetch: refetchRows } = useTableRows(TABLE_KEY, {
    search: tableState.search,
    sort: tableState.sort,
    order: tableState.order,
    page: tableState.page,
    per_page: tableState.perPage,
    filters: tableState.filters,
  })

  const { data: playbookRows = [], isLoading: playbooksLoading } = usePlaybooks({
    placeholderData: previous => previous,
  })

  const wizardPlaybooks = useMemo(() => (
    Array.isArray(playbookRows)
      ? playbookRows
          .filter(row => String(row?.status || '').toLowerCase() !== 'archived')
          .map(playbookMasterToWizardCard)
      : []
  ), [playbookRows])

  const createCampaignMutation = useCreateCampaignMutation({
    onSuccess: () => {
      resetWizard()
      navigate('/manage-campaigns')
    },
  })

  const createCampaignRunMutation = useCreateCampaignRunMutation()
  const updateCampaignRunMutation = useUpdateCampaignRunMutation()
  const importTargetsMutation = useImportCampaignRunTargetsMutation()
  const launchCampaignRunMutation = useLaunchCampaignRunMutation()

  const deleteMutation = useDeleteCampaignMutation({
    onSuccess: () => {
      setDelete(null)
      // useDeleteCampaignMutation only invalidates the legacy campaigns.list cache,
      // not this table's own query key namespace — refetch it explicitly.
      refetchRows()
    },
  })

  const rawItems = data?.items ?? STATIC_CAMPAIGNS
  const total = data?.total ?? STATIC_CAMPAIGNS.length

  const tableRows = rowsData?.rows || []

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'view_report') navigate(`/reports/${row.id}`)
    else if (actionKey === 'delete') setDelete(row)
  }

  const activeCount = rawItems.filter(c => c.status === 'active').length
  const completedCount = rawItems.filter(c => c.status === 'completed').length

  useEffect(() => {
    if (!wizardPlaybooks.length) return

    setForm(current => {
      if (current.mode !== 'playbook') return current
      if (wizardPlaybooks.some(playbook => String(playbook.id) === String(current.playbook))) return current

      return { ...current, playbook: wizardPlaybooks[0].id }
    })
  }, [wizardPlaybooks])

  useEffect(() => {
    if (!editRunId) return

    if (isEditRunError) {
      toast.error('Failed to load this draft.')
      navigate('/manage-campaigns')
      return
    }

    if (!editRunData || editingRunId === editRunId) return

    if (editRunData.status !== 'draft_run') {
      toast.error('This campaign is no longer a draft and cannot be edited here.')
      navigate('/manage-campaigns')
      return
    }

    const timezone = editRunData.timezone || 'Asia/Jakarta'
    const { date, time } = localDateAndTimeFromScheduleAt(editRunData.schedule_at, timezone)
    const playbookId = editRunData.source_playbook?.id ?? editRunData.playbook_master_id

    setForm(f => ({
      ...f,
      name: editRunData.name || '',
      playbook: playbookId ? String(playbookId) : '',
      scheduleEnabled: Boolean(editRunData.schedule_at),
      dateStart: date,
      dateEnd: date,
      sendTime: time,
      timezone: regionForTimezone(timezone),
      followUp: {
        quizEnabled: editRunData.follow_up?.quiz_enabled ?? true,
        forceResetPasswordReminderEnabled: editRunData.follow_up?.force_reset_password_reminder_enabled ?? false,
      },
    }))
    setCsvData(Array.isArray(editRunData.targets) ? editRunData.targets : [])
    setWizardStep(1)
    setView('new')
    setEditingRunId(editRunId)
  }, [editRunId, editRunData, isEditRunError, editingRunId, navigate])

  const resetWizard = () => {
    setWizardStep(1)
    setForm(makeInitialForm())
    setCsvData([])
    setEditingRunId(null)
  }

  const handleLaunch = async () => {
    if (!form.name.trim()) { toast.error('Campaign name is required.'); return }
    if (isScheduleSendTimeInvalid(form)) { toast.error('Send time must be at least 5 minutes from now.'); return }

    if (form.mode !== 'playbook') {
      createCampaignMutation.mutate(buildCampaignLaunchPayload(form, []))
      return
    }

    const selectedPlaybook = wizardPlaybooks.find(playbook => String(playbook.id) === String(form.playbook))

    if (!selectedPlaybook) {
      toast.error('Select a Playbook Master first.')
      return
    }

    if (String(selectedPlaybook.status || '').toLowerCase() !== 'active') {
      toast.error('Playbook Master must be Active before creating a Campaign Run.')
      return
    }

    if (csvData.length === 0) {
      toast.error('Import targets before launching.')
      return
    }

    try {
      setLaunchStage('creating')
      const run = editingRunId
        ? await updateCampaignRunMutation.mutateAsync({ id: editingRunId, data: buildCampaignLaunchPayload(form, wizardPlaybooks) })
        : await createCampaignRunMutation.mutateAsync(buildCampaignLaunchPayload(form, wizardPlaybooks))

      setLaunchStage('importing-targets')
      await importTargetsMutation.mutateAsync({ campaignRunId: run.id, targets: buildTargetImportPayload(csvData) })

      setLaunchStage('launching')
      await launchCampaignRunMutation.mutateAsync(run.id)

      resetWizard()
      navigate('/manage-campaigns')
    } catch {
      // Backend error is already surfaced via toast by the mutations' own onError handlers.
    } finally {
      setLaunchStage(null)
    }
  }

  const handleSaveDraft = async () => {
    if (!form.name.trim()) { toast.error('Campaign name is required.'); return }
    if (isScheduleSendTimeInvalid(form)) { toast.error('Send time must be at least 5 minutes from now.'); return }

    if (form.mode !== 'playbook') {
      createCampaignMutation.mutate(buildCampaignLaunchPayload(form, []))
      return
    }

    const selectedPlaybook = wizardPlaybooks.find(playbook => String(playbook.id) === String(form.playbook))

    if (!selectedPlaybook) {
      toast.error('Select a Playbook Master first.')
      return
    }

    if (String(selectedPlaybook.status || '').toLowerCase() !== 'active') {
      toast.error('Playbook Master must be Active before saving a draft.')
      return
    }

    try {
      setIsSavingDraft(true)
      let run
      if (editingRunId) {
        run = await updateCampaignRunMutation.mutateAsync({ id: editingRunId, data: buildCampaignLaunchPayload(form, wizardPlaybooks) })
      } else {
        // Creating a Campaign Run without launching leaves it at status
        // draft_run — that already is the draft, no separate "draft"
        // endpoint/flag exists (see CampaignRunService::create()).
        run = await createCampaignRunMutation.mutateAsync(buildCampaignLaunchPayload(form, wizardPlaybooks))
      }

      // Targets typed/imported in Step1 only exist in local component state
      // until they're persisted here — without this, they're silently lost
      // the moment the wizard unmounts (e.g. re-opening this draft via Edit).
      if (csvData.length > 0) {
        await importTargetsMutation.mutateAsync({ campaignRunId: run.id, targets: buildTargetImportPayload(csvData) })
      }

      resetWizard()
      navigate('/manage-campaigns')
    } catch {
      // Backend error is already surfaced via toast by the mutation's own onError handler.
    } finally {
      setIsSavingDraft(false)
    }
  }

  // ── New campaign wizard view ──
  if (view === 'new') {
    // editRunId is set but the draft hasn't finished loading (or prefilling)
    // yet — hold off rendering the wizard so it never briefly shows the
    // blank/demo makeInitialForm() values before the real draft data lands.
    if (editRunId && editingRunId !== editRunId) {
      return (
        <PageShell>
          <PageHeader title="Edit draft campaign" subtitle="Simulation / Edit campaign" />
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading draft…
          </div>
        </PageShell>
      )
    }

    return (
      <PageShell>
        {/* Header */}
        <PageHeader
          title={editingRunId ? 'Edit draft campaign' : 'New campaign'}
          subtitle={editingRunId ? 'Simulation / Edit campaign' : 'Simulation / New campaign'}
        />

        {/* Stepper */}
        <WizardStepper step={wizardStep} onStepChange={setWizardStep} />

        {/* Step content */}
        {wizardStep === 1 && (
          <Step1
            form={form} setForm={setForm}
            csvData={csvData} setCsvData={setCsvData}
            onCancel={() => { const wasEditing = Boolean(editingRunId); resetWizard(); navigate(wasEditing ? '/manage-campaigns' : '/dashboard') }}
            onNext={() => setWizardStep(2)}
          />
        )}
        {wizardStep === 2 && (
          <Step2
            form={form} setForm={setForm}
            playbooks={wizardPlaybooks}
            playbooksLoading={playbooksLoading}
            onBack={() => setWizardStep(1)}
            onNext={() => setWizardStep(3)}
          />
        )}
        {wizardStep === 3 && (
          <Step3
            form={form} setForm={setForm} csvData={csvData}
            playbooks={wizardPlaybooks}
            onBack={() => setWizardStep(2)}
            onLaunch={handleLaunch}
            onDraft={handleSaveDraft}
            isLaunching={createCampaignMutation.isPending || createCampaignRunMutation.isPending || updateCampaignRunMutation.isPending || importTargetsMutation.isPending || launchCampaignRunMutation.isPending}
            isSavingDraft={isSavingDraft}
            launchStage={launchStage}
            isEditing={Boolean(editingRunId)}
          />
        )}
      </PageShell>
    )
  }

  const totalTargets = rawItems.reduce((sum, campaign) => sum + (Number(campaign.target_count) || 0), 0) || 1240
  const openNewCampaign = () => { resetWizard(); setView('new') }

  // ── Campaign workspace view ──
  return (
    <PageShell>
      <WorkspaceHeader
        total={total}
        activeCount={activeCount}
        completedCount={completedCount}
        onNew={openNewCampaign}
      />

      <WorkspaceTabs active={view} onChange={setView} />

      {view === 'overview' && (
        <OverviewView
          campaigns={rawItems}
          totalTargets={totalTargets}
          activeCount={activeCount}
          schema={schema}
          rows={tableRows}
          meta={rowsData?.meta}
          tableState={tableState}
          onTableStateChange={setTableState}
          loading={isLoadingRows}
          refetching={isFetchingRows}
          onNew={openNewCampaign}
          onRowAction={handleRowAction}
        />
      )}

      {view === 'calendar' && (
        <CalendarView
          campaigns={rawItems}
          onNew={openNewCampaign}
        />
      )}

      {view === 'monitoring' && (
        <MonitoringView campaigns={rawItems} />
      )}

      {view === 'report' && (
        <ReportView
          activeTab={reportTab}
          onTabChange={setReportTab}
          onNew={openNewCampaign}
        />
      )}

      {view === 'assets' && (
        <AssetsView onNew={openNewCampaign} />
      )}

      {deleteTarget && (
        <DeleteModal
          campaign={deleteTarget}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDelete(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </PageShell>
  )
}
