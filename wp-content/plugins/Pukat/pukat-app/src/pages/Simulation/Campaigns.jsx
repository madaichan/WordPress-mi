import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCampaignList } from '../../hooks/queries/useCampaignQueries.js'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { usePlaybooks } from '../../hooks/queries/usePlaybookQueries.js'
import { useCreateCampaignMutation, useCreateCampaignRunMutation, useImportCampaignRunTargetsMutation, useLaunchCampaignRunMutation, useDeleteCampaignMutation } from '../../hooks/mutations/useCampaignMutations.js'
import { buildCampaignLaunchPayload, buildTargetImportPayload } from '../../utils/campaignLaunch.js'
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

const INITIAL_FORM = {
  name: 'Q2 Phishing Wave — Finance',
  desc: '',
  mode: 'playbook',
  playbook: '',
  dateStart: '2025-06-28',
  dateEnd: '2025-07-05',
  timezone: 'WIB',
  followUp: {
    quizEnabled: true,
    forceResetPasswordReminderEnabled: false,
  },
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

  // View state: 'overview' | 'calendar' | 'monitoring' | 'report' | 'assets' | 'new'
  const [view, setView] = useState('new')
  const [reportTab, setReportTab] = useState('report')

  // List state
  const page = 1
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [deleteTarget, setDelete] = useState(null)

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [csvData, setCsvData] = useState([])
  const [launchStage, setLaunchStage] = useState(null)

  // Queries
  const { data } = useCampaignList({ page, per_page: 10 }, {
    placeholderData: prev => prev,
  })

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
      navigate('/monitoring')
    },
  })

  const createCampaignRunMutation = useCreateCampaignRunMutation()
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

  const resetWizard = () => {
    setWizardStep(1)
    setForm(INITIAL_FORM)
    setCsvData([])
  }

  const handleLaunch = async () => {
    if (!form.name.trim()) { toast.error('Campaign name is required.'); return }

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
      const run = await createCampaignRunMutation.mutateAsync(buildCampaignLaunchPayload(form, wizardPlaybooks))

      setLaunchStage('importing-targets')
      await importTargetsMutation.mutateAsync({ campaignRunId: run.id, targets: buildTargetImportPayload(csvData) })

      setLaunchStage('launching')
      await launchCampaignRunMutation.mutateAsync(run.id)

      resetWizard()
      navigate('/monitoring')
    } catch {
      // Backend error is already surfaced via toast by the mutations' own onError handlers.
    } finally {
      setLaunchStage(null)
    }
  }

  // ── New campaign wizard view ──
  if (view === 'new') {
    return (
      <PageShell>
        {/* Header */}
        <PageHeader title="New campaign" subtitle="Simulation / New campaign" />

        {/* Stepper */}
        <WizardStepper step={wizardStep} onStepChange={setWizardStep} />

        {/* Step content */}
        {wizardStep === 1 && (
          <Step1
            form={form} setForm={setForm}
            csvData={csvData} setCsvData={setCsvData}
            onCancel={() => { resetWizard(); navigate('/dashboard') }}
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
            onDraft={() => { toast.success('Saved as draft.'); resetWizard(); navigate('/dashboard') }}
            isLaunching={createCampaignMutation.isPending || createCampaignRunMutation.isPending || importTargetsMutation.isPending || launchCampaignRunMutation.isPending}
            launchStage={launchStage}
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
