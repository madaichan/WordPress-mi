import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useSearchFilter } from '../../hooks/useSearchFilter.js'
import { useCampaignList } from '../../hooks/queries/useCampaignQueries.js'
import { useCreateCampaignMutation, useDeleteCampaignMutation } from '../../hooks/mutations/useCampaignMutations.js'
import { buildCampaignLaunchPayload } from '../../utils/campaignLaunch.js'
import WizardStepper from '../../features/campaigns/WizardStepper.jsx'
import DeleteModal from '../../features/campaigns/DeleteModal.jsx'
import WorkspaceHeader from '../../features/campaigns/WorkspaceHeader.jsx'
import WorkspaceTabs from '../../features/campaigns/WorkspaceTabs.jsx'
import Step1 from '../../features/campaigns/Wizard/Step1.jsx'
import Step2 from '../../features/campaigns/Wizard/Step2.jsx'
import Step3 from '../../features/campaigns/Wizard/Step3.jsx'
import { PLAYBOOKS } from '../../features/campaigns/Wizard/wizardData.js'
import OverviewView from '../../features/campaigns/Overview/OverviewView.jsx'
import CalendarView from '../../features/campaigns/Views/CalendarView.jsx'
import MonitoringView from '../../features/campaigns/Views/MonitoringView.jsx'
import AssetsView from '../../features/campaigns/Reports/AssetsView.jsx'
import ReportView from '../../features/campaigns/Reports/ReportView.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'

// ── Static data ──────────────────────────────────────────────────────────────

const STATIC_CAMPAIGNS = [
  { id: 1, name: 'Q2 phishing wave', status: 'active', difficulty: 4, target_count: 1240, launched_at: '2025-06-18T00:00:00Z' },
  { id: 2, name: 'BEC scenario — finance', status: 'scheduled', difficulty: 4, target_count: 420, launched_at: null },
  { id: 3, name: 'Q1 awareness check', status: 'completed', difficulty: 2, target_count: 800, launched_at: '2025-03-10T00:00:00Z' },
]

const INITIAL_FORM = {
  name: 'Q2 Phishing Wave — Finance',
  desc: '',
  template: 't1',
  templateFilter: 'All',
  mode: 'playbook',
  playbook: 'p1',
  dateStart: '2025-06-28',
  dateEnd: '2025-07-05',
  timezone: 'WIB',
  sendingHours: 'work',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Campaigns() {
  const navigate = useNavigate()

  // View state: 'overview' | 'calendar' | 'monitoring' | 'report' | 'assets' | 'new'
  const [view, setView] = useState('new')
  const [reportTab, setReportTab] = useState('report')

  // List state
  const page = 1
  const [deleteTarget, setDelete] = useState(null)

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [csvData, setCsvData] = useState([])

  // Queries
  const { data, isLoading } = useCampaignList({ page, per_page: 10 }, {
    placeholderData: prev => prev,
  })

  const createCampaignMutation = useCreateCampaignMutation({
    onSuccess: () => {
      resetWizard()
      navigate('/monitoring')
    },
  })

  const deleteMutation = useDeleteCampaignMutation({
    onSuccess: () => setDelete(null),
  })

  const rawItems = data?.items ?? STATIC_CAMPAIGNS
  const total = data?.total ?? STATIC_CAMPAIGNS.length

  const { search, setSearch, statusFilter, setFilter, filteredItems: items } = useSearchFilter(rawItems, {
    searchKeys: ['name'],
    statusKey: 'status',
  })

  const activeCount = rawItems.filter(c => c.status === 'active').length
  const completedCount = rawItems.filter(c => c.status === 'completed').length

  const resetWizard = () => {
    setWizardStep(1)
    setForm(INITIAL_FORM)
    setCsvData([])
  }

  const handleLaunch = () => {
    if (!form.name.trim()) { toast.error('Campaign name is required.'); return }
    createCampaignMutation.mutate(buildCampaignLaunchPayload(form, PLAYBOOKS))
  }

  // ── New campaign wizard view ──
  if (view === 'new') {
    return (
      <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
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
            onBack={() => setWizardStep(1)}
            onNext={() => setWizardStep(3)}
          />
        )}
        {wizardStep === 3 && (
          <Step3
            form={form} csvData={csvData}
            onBack={() => setWizardStep(2)}
            onLaunch={handleLaunch}
            onDraft={() => { toast.success('Saved as draft.'); resetWizard(); navigate('/dashboard') }}
            isLaunching={createCampaignMutation.isPending}
          />
        )}
      </div>
    )
  }

  const totalTargets = rawItems.reduce((sum, campaign) => sum + (Number(campaign.target_count) || 0), 0) || 1240
  const openNewCampaign = () => { resetWizard(); setView('new') }

  // ── Campaign workspace view ──
  return (
    <div className="space-y-6">
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
          items={items}
          totalTargets={totalTargets}
          activeCount={activeCount}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setFilter={setFilter}
          isLoading={isLoading}
          onNew={openNewCampaign}
          onDelete={setDelete}
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
    </div>
  )
}
