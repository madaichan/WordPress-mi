import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { post } from '../../api/client.js'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useCsvUpload } from '../../hooks/useCsvUpload.js'
import { useCampaignItems } from '../../hooks/queries/useCampaignQueries.js'
import { useLaunchCampaignMutation } from '../../hooks/mutations/useCampaignMutations.js'
import { useGophishEmailTemplates, useGophishLandingPages, useGophishSmtpProfiles } from '../../hooks/queries/useGophishQueries.js'
import Card from '../../components/UI/Card.jsx'
import Label from '../../components/UI/Label.jsx'
import Select from '../../components/UI/Select.jsx'
import Button from '../../components/UI/Button.jsx'
import Table from '../../components/UI/Table.jsx'

export default function Preparation() {
  const navigate = useNavigate()
  const { csvData, csvErrors, getRootProps, getInputProps, isDragActive } = useCsvUpload()
  const [step, setStep] = useState(1) // 1=targets, 2=templates, 3=review

  // GoPhish data
  const { data: emailTemplates = [] } = useGophishEmailTemplates()
  const { data: landingPages = [] } = useGophishLandingPages()
  const { data: smtpProfiles = [] } = useGophishSmtpProfiles()
  const { data: campaigns = [] } = useCampaignItems({ per_page: 100 })

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedLandingPage, setSelectedLandingPage] = useState(null)
  const [selectedSmtp,     setSelectedSmtp]     = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [targetsImportedForCampaign, setTargetsImportedForCampaign] = useState('')

  const targetsSynced = targetsImportedForCampaign === String(selectedCampaign) && csvData.length > 0

  const launchMutation = useLaunchCampaignMutation({
    onSuccess: () => navigate('/monitoring'),
  })

  const handleImport = async () => {
    if (!selectedCampaign) return toast.error('Please select a campaign first.')
    if (csvData.length === 0) return toast.error('No targets to import.')
    try {
      await post('/targets/import', {
        campaign_id: selectedCampaign,
        targets: csvData.map(r => ({
          email:      r.email,
          first_name: r.first_name || r.firstname || '',
          last_name:  r.last_name  || r.lastname  || '',
          department: r.department || '',
          position:   r.position   || '',
        })),
      })
      setTargetsImportedForCampaign(String(selectedCampaign))
      toast.success(`${csvData.length} targets imported!`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleCampaignChange = (e) => {
    setSelectedCampaign(e.target.value)
    setTargetsImportedForCampaign('')
  }

  const handleLaunch = () => {
    if (!selectedCampaign) return toast.error('Please select a campaign first.')
    if (!targetsSynced) return toast.error('Import targets to GoPhish before launching.')
    if (!selectedTemplate) return toast.error('Please select an email template.')
    if (!selectedLandingPage) return toast.error('Please select a landing page.')
    if (!selectedSmtp) return toast.error('Please select an SMTP sending profile.')

    launchMutation.mutate({
      id: selectedCampaign,
      data: {
        group_name: `Group-Campaign-${selectedCampaign}`,
        gophish_template_id: Number(selectedTemplate),
        gophish_page_id: Number(selectedLandingPage),
        gophish_smtp_id: Number(selectedSmtp),
      },
    })
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {['Import Targets', 'Select Templates', 'Review & Save'].map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => setStep(i + 1)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                step === i + 1
                  ? 'bg-violet-500 text-white'
                  : step > i + 1
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <span className={clsx(
                'w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold',
                step === i + 1 ? 'bg-white text-violet-600' : step > i + 1 ? 'bg-violet-500 text-white' : 'bg-gray-200 text-gray-500'
              )}>
                {step > i + 1 ? <i className="ti ti-check text-xs" /> : i + 1}
              </span>
              {s}
            </button>
            {i < 2 && <i className="ti ti-chevron-right text-gray-300 mx-1" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Target Import */}
      {step === 1 && (
        <Card className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Import Targets via CSV</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded">email, first_name, last_name, department, position</code>
            </p>
          </div>

          {/* Campaign selector */}
          <div>
            <Label>Assign to Campaign</Label>
            <Select
              id="prep-campaign"
              value={selectedCampaign}
              onChange={handleCampaignChange}
            >
              <option value="">— Select campaign —</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            id="csv-dropzone"
            className={clsx(
              'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
              isDragActive ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50'
            )}
          >
            <input {...getInputProps()} id="csv-file-input" />
            <i className="ti ti-file-spreadsheet text-4xl text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-600">
              {isDragActive ? 'Drop CSV here...' : 'Drag & drop CSV, or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Supports up to 10,000 rows</p>
          </div>

          {/* Preview */}
          {csvData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-800">Preview ({csvData.length} targets)</p>
                <Button variant="primary" size="sm" onClick={handleImport} id="btn-import-targets">
                  <i className="ti ti-upload" /> Import
                </Button>
              </div>
              <Table wrapperClassName="max-h-48 overflow-y-auto" className="text-xs">
                <thead>
                  <tr>
                    <th>Email</th><th>First Name</th><th>Last Name</th><th>Department</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      <td>{r.email}</td>
                      <td>{r.first_name || r.firstname}</td>
                      <td>{r.last_name  || r.lastname}</td>
                      <td>{r.department}</td>
                    </tr>
                  ))}
                  {csvData.length > 20 && (
                    <tr><td colSpan={4} className="text-center text-gray-400">...and {csvData.length - 20} more</td></tr>
                  )}
                </tbody>
              </Table>
              {csvErrors.length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                  <strong>{csvErrors.length} rows skipped:</strong> {csvErrors.slice(0,3).join(', ')}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setStep(2)}>
              Next: Templates <i className="ti ti-arrow-right" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Template Selection */}
      {step === 2 && (
        <Card className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Select GoPhish Templates</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose email template, landing page, and SMTP sending profile.</p>
          </div>

          {/* Email Templates */}
          <div>
            <Label>Email Template</Label>
            <div className="grid gap-2">
              {emailTemplates.length === 0 ? (
                <p className="text-xs text-gray-400 p-3 bg-gray-50 rounded-lg">No email templates found in GoPhish. Create one in GoPhish admin first.</p>
              ) : emailTemplates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTemplate(t.id)}
                  className={clsx(
                    'text-left p-3 rounded-lg border transition-all',
                    selectedTemplate === t.id
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 hover:border-violet-200'
                  )}
                >
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.subject || 'No subject'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Landing Pages */}
          <div>
            <Label>Landing Page</Label>
            <div className="grid gap-2">
              {landingPages.length === 0 ? (
                <p className="text-xs text-gray-400 p-3 bg-gray-50 rounded-lg">No landing pages found in GoPhish. Create one in GoPhish admin first.</p>
              ) : landingPages.map(page => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setSelectedLandingPage(page.id)}
                  className={clsx(
                    'text-left p-3 rounded-lg border transition-all',
                    selectedLandingPage === page.id
                      ? 'border-violet-500 bg-violet-50 text-violet-700'
                      : 'border-gray-200 hover:border-violet-200'
                  )}
                >
                  <p className="text-sm font-medium">{page.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {page.capture_credentials ? 'Captures credentials' : 'No credential capture'}
                    {page.redirect_url ? ` · Redirects after submit` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* SMTP Profile */}
          <div>
            <Label>Sending Profile (SMTP)</Label>
            <Select id="smtp-profile" value={selectedSmtp || ''} onChange={e => setSelectedSmtp(e.target.value)}>
              <option value="">— Select SMTP profile —</option>
              {smtpProfiles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            {smtpProfiles.length === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 mt-2">
                No SMTP profiles found in GoPhish. Create a sending profile in GoPhish before launching.
              </p>
            )}
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <i className="ti ti-arrow-left" /> Back
            </Button>
            <Button variant="primary" onClick={() => setStep(3)}>
              Review <i className="ti ti-arrow-right" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Review Configuration</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Targets</span>
              <span className="font-medium text-gray-800">
                {csvData.length} loaded {targetsSynced ? 'and synced' : ''}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Campaign</span>
              <span className="font-medium text-gray-800">
                {campaigns.find(c => String(c.id) === String(selectedCampaign))?.name || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Email Template</span>
              <span className="font-medium text-gray-800">
                {emailTemplates.find(t => t.id === selectedTemplate)?.name || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">Landing Page</span>
              <span className="font-medium text-gray-800">
                {landingPages.find(page => page.id === selectedLandingPage)?.name || '—'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-t border-gray-50">
              <span className="text-gray-500">SMTP Profile</span>
              <span className="font-medium text-gray-800">
                {smtpProfiles.find(s => String(s.id) === String(selectedSmtp))?.name || '—'}
              </span>
            </div>
          </div>

          {csvData.length === 0 && (
            <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
              <i className="ti ti-alert-triangle mr-1" /> No targets imported yet. Go back to Step 1.
            </div>
          )}

          {csvData.length > 0 && !targetsSynced && (
            <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
              <i className="ti ti-alert-triangle mr-1" /> Targets are loaded locally but have not been imported to GoPhish yet.
            </div>
          )}

          {(!selectedTemplate || !selectedLandingPage || !selectedSmtp) && (
            <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
              <i className="ti ti-alert-triangle mr-1" /> Complete the GoPhish template, landing page, and SMTP selections before launch.
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)}>
              <i className="ti ti-arrow-left" /> Back
            </Button>
            <Button variant="primary" onClick={handleLaunch} disabled={launchMutation.isPending}>
              {launchMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <i className="ti ti-player-play" /> Launch in GoPhish
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
