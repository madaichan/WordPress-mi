import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCampaignList, useCampaignRun } from '../../hooks/queries/useCampaignQueries.js'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { usePlaybooks } from '../../hooks/queries/usePlaybookQueries.js'
import { useEntityReadiness } from '../../hooks/queries/useEntityQueries.js'
import { useFlagPage } from '../../hooks/queries/useFlagQueries.js'
import { useQuizPage } from '../../hooks/queries/useQuizQueries.js'
import {
  useMasterDynamicDomains,
  useMasterEmailTemplates,
  useMasterLandingPages,
  useMasterSendingProfiles,
} from '../../hooks/queries/useMasterAssetQueries.js'
import { useGophishSmtpProfiles } from '../../hooks/queries/useGophishQueries.js'
import {
  useCreateCampaignRunMutation,
  useUpdateCampaignRunMutation,
  useImportCampaignRunTargetsMutation,
  useLaunchCampaignRunMutation,
  useDeleteCampaignMutation,
} from '../../hooks/mutations/useCampaignMutations.js'
import { useCreatePlaybookMutation } from '../../hooks/mutations/usePlaybookMutations.js'
import { buildCampaignLaunchPayload, buildTargetImportPayload, customCampaignReadinessMessage, regionForTimezone, localDateAndTimeFromScheduleAt, todayDateString, addDaysToDateString, minSendTimeForDate, isScheduleSendTimeInvalid } from '../../utils/campaignLaunch.js'
import { playbookComponentOptions } from '../../utils/playbookComponentOptions.js'
import { GENERAL_ENTITY, assetEntityForUser, canCreatePlaybook, getUserEntity } from '../../utils/entityAssignmentHelpers.js'
import { resolveSendingProfileRefId } from '../../utils/resolveSendingProfileRef.js'
import useAppStore from '../../store/useAppStore.js'
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
    customComponents: { email: '', page: '', smtp: '', domain: '' },
    scheduleEnabled: true,
    dateStart: today,
    dateEnd: addDaysToDateString(today, 1),
    sendTime: minSendTimeForDate(today),
    timezone: 'WIB',
    followUp: {
      // Both default on; Step 3 gates each on the entity actually having the
      // matching published master, and the launch payload drops whichever is
      // unavailable.
      quizEnabled: true,
      quizPassScore: null,
      educationEnabled: true,
      forceResetPasswordReminderEnabled: false,
    },
  }
}

const PLAYBOOK_TYPE_COLORS = {
  BEC: 'text-red-700 dark:text-red-300',
  Credential: 'text-amber-700 dark:text-amber-300',
  Malware: 'text-emerald-700 dark:text-emerald-300',
  Vishing: 'text-purple-700 dark:text-purple-300',
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

  if (normalized === 'active') return { label: 'Active', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' }
  if (normalized === 'approved') return { label: 'Approved', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' }
  if (normalized === 'archived') return { label: 'Archived', className: 'bg-panel-muted text-ink-muted' }

  return { label: 'Draft', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' }
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
    // Derived fields the picker searches and sorts on (see utils/playbookPickerState.js).
    entity: row.entity || GENERAL_ENTITY,
    scenario: row.objective || row.scenario || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
    ready: Boolean(row.readiness?.ready),
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

  const { data: playbookRows = [], isLoading: playbooksLoading, refetch: refetchPlaybooks } = usePlaybooks({
    placeholderData: previous => previous,
  })

  // Custom campaign — same master-asset sources as the Create-playbook drawer
  // (features/setup/playbooks/Playbooks.jsx), so Step2 can offer the same
  // Email template / Landing page / SMTP profile / Dynamic domain pickers.
  const currentUser = useAppStore(state => state.user)
  const isFullAdmin = useAppStore(state => state.isAdmin())
  const hasPlaybookCreateCapability = useAppStore(state => state.hasPermission('master_playbooks.create'))
  const canBypassEmailDomainGuardrail = useAppStore(state => state.hasPermission('guardrails.bypass'))
  // A run belongs to its creator's entity, or General when they have none
  // (CampaignRunService::create()) — pre-check that entity's readiness so a
  // blocked launch (PRD_ENTITY_PROFILE_AND_GUARDRAILS §16) fails before a
  // draft run is created. The backend still enforces it.
  const runEntity = getUserEntity(currentUser) || GENERAL_ENTITY
  const { data: runEntityReadiness, refetch: refetchRunEntityReadiness } = useEntityReadiness(runEntity)
  // Education follow-up (G3b) can only be linked when this entity has a
  // published education page already synced to a GoPhish master. Gate the
  // wizard toggle on that; the backend re-checks and only links a live master.
  const { data: runEntityFlagPage, refetch: refetchRunEntityFlagPage } = useFlagPage(
    isFullAdmin ? { entity: runEntity } : {},
    { enabled: view === 'new' },
  )
  const educationFollowUpAvailable = runEntityFlagPage?.status === 'published'
    && Boolean(runEntityFlagPage?.gophish_master_id)
  // Quiz follow-up is gated the same way, on its own published master — it can
  // be chained with or without education (PRD_QUIZ_MODULE FR-13).
  const { data: runEntityQuizPage } = useQuizPage(
    isFullAdmin ? { entity: runEntity } : {},
    { enabled: view === 'new' },
  )
  const quizFollowUpAvailable = runEntityQuizPage?.status === 'published'
    && Boolean(runEntityQuizPage?.gophish_master_id)
  const canUseCustomCampaign = canCreatePlaybook(currentUser, { isFullAdmin, hasCreateCapability: hasPlaybookCreateCapability })
  const defaultEntity = useMemo(() => assetEntityForUser(currentUser), [currentUser])

  const { data: emailTemplates = [], refetch: refetchEmailTemplates } = useMasterEmailTemplates()
  const { data: landingPages = [], refetch: refetchLandingPages } = useMasterLandingPages()
  const { data: sendingProfiles = [], refetch: refetchSendingProfiles } = useMasterSendingProfiles()
  const { data: dynamicDomains = [], refetch: refetchDynamicDomains } = useMasterDynamicDomains()
  const { data: gophishSmtpProfiles = [], refetch: refetchGophishSmtpProfiles } = useGophishSmtpProfiles()

  // Same bundle `features/setup/playbooks/Playbooks.jsx` builds: the component
  // pickers for custom mode read the options, and the wizard playbook preview
  // reads the raw masters to resolve component names and HTML previews.
  const masterAssets = useMemo(() => ({
    emailTemplates,
    landingPages,
    sendingProfiles,
    dynamicDomains,
    gophishSmtpProfiles,
  }), [dynamicDomains, emailTemplates, gophishSmtpProfiles, landingPages, sendingProfiles])

  const componentOptions = useMemo(() => playbookComponentOptions(masterAssets), [masterAssets])

  // The Step 3 checklist mirrors the server-side launch guards: playbook and
  // component readiness, entity guardrails, and the education page. Those can
  // all change in another tab while the wizard sits open, so re-pull every
  // source it reads instead of making the user restart the wizard. Step 3 owns
  // the entity email-domain query and refetches that one itself.
  const refreshChecklistSources = useCallback(async () => {
    const results = await Promise.all([
      refetchPlaybooks(),
      refetchEmailTemplates(),
      refetchLandingPages(),
      refetchSendingProfiles(),
      refetchDynamicDomains(),
      refetchGophishSmtpProfiles(),
      refetchRunEntityReadiness(),
      refetchRunEntityFlagPage(),
    ])

    return results.find(result => result?.error)?.error || null
  }, [
    refetchDynamicDomains,
    refetchEmailTemplates,
    refetchGophishSmtpProfiles,
    refetchLandingPages,
    refetchPlaybooks,
    refetchRunEntityFlagPage,
    refetchRunEntityReadiness,
    refetchSendingProfiles,
  ])

  const wizardPlaybooks = useMemo(() => (
    Array.isArray(playbookRows)
      ? playbookRows
          .filter(row => String(row?.status || '').toLowerCase() !== 'archived')
          .map(playbookMasterToWizardCard)
      : []
  ), [playbookRows])

  // In custom mode the Playbook Master is an implementation detail the user
  // never picked, so a `playbook_not_ready` rejection has to be restated in
  // terms of the components they did pick — and its per-reason breakdown shown
  // instead of dropped. Playbook mode keeps the backend's own wording, which is
  // accurate there.
  const mapCustomModeReadinessError = useCallback(
    err => (form.mode === 'custom' ? customCampaignReadinessMessage(err) : null),
    [form.mode]
  )

  const createCampaignRunMutation = useCreateCampaignRunMutation({ mapErrorMessage: mapCustomModeReadinessError })
  const updateCampaignRunMutation = useUpdateCampaignRunMutation({ mapErrorMessage: mapCustomModeReadinessError })
  const importTargetsMutation = useImportCampaignRunTargetsMutation()
  const launchCampaignRunMutation = useLaunchCampaignRunMutation()
  const createPlaybookMutation = useCreatePlaybookMutation({ mapErrorMessage: mapCustomModeReadinessError })

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
        quizPassScore: editRunData.follow_up?.quiz_pass_score ?? null,
        educationEnabled: editRunData.follow_up?.education_enabled ?? true,
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

  // Custom campaign mode has no Playbook Master to point a Campaign Run at,
  // so it auto-creates one (status 'active', straight from the 4 picked
  // components) and hands its id back — CampaignRunService only cares that
  // the playbook is active and ready, not how it was made. Returns null (and
  // has already shown a toast) if the components couldn't be resolved/saved.
  async function resolveCustomModePlaybookId() {
    const { email, page, smtp, domain } = form.customComponents || {}

    let resolvedSmtp
    try {
      resolvedSmtp = await resolveSendingProfileRefId({
        smtpValue: smtp,
        sendingProfiles,
        gophishSmtpProfiles,
        entity: defaultEntity,
      })
    } catch (error) {
      toast.error(error.message || 'Failed to prepare the SMTP profile.')
      return null
    }

    if (resolvedSmtp !== smtp) {
      await refetchSendingProfiles()
    }

    try {
      const playbook = await createPlaybookMutation.mutateAsync({
        status: 'active',
        entity: defaultEntity,
        name: `${form.name.trim()} — Custom`,
        description: `Auto-generated components for the "${form.name.trim()}" campaign.`,
        difficulty: 3,
        default_email_template_version_id: Number(email),
        default_landing_page_version_id: Number(page),
        default_sending_profile_ref_id: Number(resolvedSmtp),
        default_dynamic_domain_id: domain ? Number(domain) : null,
      })
      return playbook.id
    } catch {
      // useCreatePlaybookMutation's own onError handler already surfaces this via toast.
      return null
    }
  }

  function validateCustomModeComponents() {
    const { email, page, smtp } = form.customComponents || {}
    if (!email) { toast.error('Select an email template for the custom campaign.'); return false }
    if (!page) { toast.error('Select a landing page for the custom campaign.'); return false }
    if (!smtp) { toast.error('Select an SMTP profile for the custom campaign.'); return false }
    return true
  }

  // Launches a run; on a target_email_domain_forbidden guardrail rejection
  // (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md FR-7/FR-8), lists the
  // offending emails and — only for users holding guardrails.bypass — offers
  // to retry past it. Returns the launched run on success, or false if launch
  // did not go through (caller should stop, not reset the wizard/navigate).
  const launchRunWithGuardrailRetry = async (runId) => {
    try {
      return await launchCampaignRunMutation.mutateAsync(runId)
    } catch (err) {
      if (err.code !== 'target_email_domain_forbidden') {
        throw err
      }

      const badEmails = (err.details || []).map(item => item.email).filter(Boolean)
      const emailList = badEmails.length > 0 ? badEmails.join(', ') : 'one or more targets'

      if (!canBypassEmailDomainGuardrail) {
        toast.error(`Blocked — these targets use a domain not allowed for this entity: ${emailList}`)
        return false
      }

      const confirmed = window.confirm(
        `These targets use an email domain not on this entity's allow-list:\n\n${emailList}\n\nLaunch anyway?`
      )
      if (!confirmed) return false

      return await launchCampaignRunMutation.mutateAsync({ id: runId, data: { bypass_email_domain_guardrail: true } })
    }
  }

  // Surface the follow-up chain result (CampaignRunService::launch() returns
  // `follow_up_link` only when the run opted into a stage). A link failure is a
  // warning, not a launch failure — the simulation already ran.
  const surfaceFollowUpLinkResult = (launchedRun) => {
    const link = launchedRun?.follow_up_link || launchedRun?.education_link
    if (!link) return
    const stage = link.stage === 'quiz' ? 'Quiz' : 'Education'
    if (link.ok) {
      toast.success(`${stage} follow-up linked to this simulation.`)
    } else {
      toast.error(link.message || `${stage} follow-up could not be linked — the simulation launched without it.`)
    }
  }

  // Drop a follow-up stage from the saved run unless this entity actually has
  // the matching published master to chain to. The toggles default on but are
  // meaningless — and the backend link would just warn — without one.
  const withEffectiveFollowUp = (f) => ({
    ...f,
    followUp: {
      ...f.followUp,
      educationEnabled: educationFollowUpAvailable && (f.followUp?.educationEnabled ?? true),
      quizEnabled: quizFollowUpAvailable && (f.followUp?.quizEnabled ?? true),
    },
  })

  const handleLaunch = async () => {
    if (!form.name.trim()) { toast.error('Campaign name is required.'); return }
    if (isScheduleSendTimeInvalid(form)) { toast.error('Send time must be at least 5 minutes from now.'); return }

    let playbookIdForRun = null

    if (form.mode === 'custom') {
      if (!validateCustomModeComponents()) return
    } else {
      const selectedPlaybook = wizardPlaybooks.find(playbook => String(playbook.id) === String(form.playbook))

      if (!selectedPlaybook) {
        toast.error('Select a Playbook Master first.')
        return
      }

      if (String(selectedPlaybook.status || '').toLowerCase() !== 'active') {
        toast.error('Playbook Master must be Active before creating a Campaign Run.')
        return
      }

      playbookIdForRun = selectedPlaybook.id
    }

    if (csvData.length === 0) {
      toast.error('Import targets before launching.')
      return
    }

    if (runEntityReadiness && !runEntityReadiness.can_launch) {
      toast.error(`Entity "${runEntity}" has no active company email domain. Add one in My Profile > Guardrails before launching.`)
      return
    }

    try {
      setLaunchStage('creating')

      if (form.mode === 'custom') {
        playbookIdForRun = await resolveCustomModePlaybookId()
        if (!playbookIdForRun) return
      }

      const payload = buildCampaignLaunchPayload(withEffectiveFollowUp({ ...form, playbook: playbookIdForRun }), wizardPlaybooks)
      const run = editingRunId
        ? await updateCampaignRunMutation.mutateAsync({ id: editingRunId, data: payload })
        : await createCampaignRunMutation.mutateAsync(payload)

      setLaunchStage('importing-targets')
      await importTargetsMutation.mutateAsync({ campaignRunId: run.id, targets: buildTargetImportPayload(csvData) })

      setLaunchStage('launching')
      const launched = await launchRunWithGuardrailRetry(run.id)
      if (!launched) return
      surfaceFollowUpLinkResult(launched)

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

    let playbookIdForRun = null

    if (form.mode === 'custom') {
      if (!validateCustomModeComponents()) return
    } else {
      const selectedPlaybook = wizardPlaybooks.find(playbook => String(playbook.id) === String(form.playbook))

      if (!selectedPlaybook) {
        toast.error('Select a Playbook Master first.')
        return
      }

      if (String(selectedPlaybook.status || '').toLowerCase() !== 'active') {
        toast.error('Playbook Master must be Active before saving a draft.')
        return
      }

      playbookIdForRun = selectedPlaybook.id
    }

    try {
      setIsSavingDraft(true)

      if (form.mode === 'custom') {
        playbookIdForRun = await resolveCustomModePlaybookId()
        if (!playbookIdForRun) return
      }

      const payload = buildCampaignLaunchPayload(withEffectiveFollowUp({ ...form, playbook: playbookIdForRun }), wizardPlaybooks)
      let run
      if (editingRunId) {
        run = await updateCampaignRunMutation.mutateAsync({ id: editingRunId, data: payload })
      } else {
        // Creating a Campaign Run without launching leaves it at status
        // draft_run — that already is the draft, no separate "draft"
        // endpoint/flag exists (see CampaignRunService::create()).
        run = await createCampaignRunMutation.mutateAsync(payload)
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
          <div className="rounded-xl border border-line bg-panel p-8 text-center text-sm text-ink-muted">
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
            componentOptions={componentOptions}
            masterAssets={masterAssets}
            canUseCustom={canUseCustomCampaign}
            onBack={() => setWizardStep(1)}
            onNext={() => setWizardStep(3)}
          />
        )}
        {wizardStep === 3 && (
          <Step3
            form={form} setForm={setForm} csvData={csvData}
            playbooks={wizardPlaybooks}
            componentOptions={componentOptions}
            onBack={() => setWizardStep(2)}
            onLaunch={handleLaunch}
            onDraft={handleSaveDraft}
            isLaunching={createPlaybookMutation.isPending || createCampaignRunMutation.isPending || updateCampaignRunMutation.isPending || importTargetsMutation.isPending || launchCampaignRunMutation.isPending}
            isSavingDraft={isSavingDraft}
            launchStage={launchStage}
            isEditing={Boolean(editingRunId)}
            entity={runEntity}
            canBypassEmailDomainGuardrail={canBypassEmailDomainGuardrail}
            educationFollowUpAvailable={educationFollowUpAvailable}
            quizFollowUpAvailable={quizFollowUpAvailable}
            quizPassScore={runEntityQuizPage?.effective_pass_score ?? null}
            onRefreshChecklist={refreshChecklistSources}
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
