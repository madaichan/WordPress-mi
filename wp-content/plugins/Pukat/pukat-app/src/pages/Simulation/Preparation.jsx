import React, { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { gophishApi, campaignApi } from '../../api/index.js'
import { post } from '../../api/client.js'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Preparation() {
  const [csvData,    setCsvData]    = useState([])
  const [csvErrors,  setCsvErrors]  = useState([])
  const [step,       setStep]       = useState(1) // 1=targets, 2=templates, 3=review

  // GoPhish data
  const { data: emailTemplates = [] } = useQuery({ queryKey: ['gophish-email-templates'], queryFn: gophishApi.emailTemplates })
  const { data: landingPages   = [] } = useQuery({ queryKey: ['gophish-landing-pages'],   queryFn: gophishApi.landingPages })
  const { data: smtpProfiles   = [] } = useQuery({ queryKey: ['gophish-smtp'],             queryFn: gophishApi.smtpProfiles })
  const { data: campaigns      = [] } = useQuery({ queryKey: ['campaigns'],                queryFn: () => campaignApi.list({ per_page: 100 }).then(d => d.items || []) })

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [selectedPage,     setSelectedPage]     = useState(null)
  const [selectedSmtp,     setSelectedSmtp]     = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState('')

  // CSV Drop
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errors = []
        const rows = result.data.filter((row, i) => {
          if (!row.email || !row.email.includes('@')) {
            errors.push(`Row ${i + 2}: invalid email "${row.email}"`)
            return false
          }
          return true
        })
        setCsvData(rows)
        setCsvErrors(errors)
        toast.success(`Loaded ${rows.length} valid targets.${errors.length ? ` (${errors.length} rows skipped)` : ''}`)
      },
      error: (err) => toast.error('CSV parse error: ' + err.message),
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
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
      toast.success(`${csvData.length} targets imported!`)
    } catch (err) {
      toast.error(err.message)
    }
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
        <div className="card space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Import Targets via CSV</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded">email, first_name, last_name, department, position</code>
            </p>
          </div>

          {/* Campaign selector */}
          <div>
            <label className="label">Assign to Campaign</label>
            <select
              id="prep-campaign"
              className="input"
              value={selectedCampaign}
              onChange={e => setSelectedCampaign(e.target.value)}
            >
              <option value="">— Select campaign —</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
                <button onClick={handleImport} id="btn-import-targets" className="btn btn-primary btn-sm">
                  <i className="ti ti-upload" /> Import
                </button>
              </div>
              <div className="table-wrapper max-h-48 overflow-y-auto">
                <table className="table text-xs">
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
                </table>
              </div>
              {csvErrors.length > 0 && (
                <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                  <strong>{csvErrors.length} rows skipped:</strong> {csvErrors.slice(0,3).join(', ')}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="btn btn-primary">
              Next: Templates <i className="ti ti-arrow-right" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Template Selection */}
      {step === 2 && (
        <div className="card space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Select GoPhish Templates</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose email template, landing page, and SMTP sending profile.</p>
          </div>

          {/* Email Templates */}
          <div>
            <label className="label">Email Template</label>
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

          {/* SMTP Profile */}
          <div>
            <label className="label">Sending Profile (SMTP)</label>
            <select id="smtp-profile" className="input" value={selectedSmtp || ''} onChange={e => setSelectedSmtp(e.target.value)}>
              <option value="">— Select SMTP profile —</option>
              {smtpProfiles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="btn btn-secondary">
              <i className="ti ti-arrow-left" /> Back
            </button>
            <button onClick={() => setStep(3)} className="btn btn-primary">
              Review <i className="ti ti-arrow-right" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Review Configuration</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Targets</span>
              <span className="font-medium text-gray-800">{csvData.length} imported</span>
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

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="btn btn-secondary">
              <i className="ti ti-arrow-left" /> Back
            </button>
            <a href="#/simulation/performing" className="btn btn-primary">
              <i className="ti ti-player-play" /> Go to Performing
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
