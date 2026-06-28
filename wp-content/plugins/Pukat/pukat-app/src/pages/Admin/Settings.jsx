import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi, gophishApi } from '../../api/index.js'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function Settings() {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn:  settingsApi.get,
  })

  const [form, setForm] = useState({
    pukat_org_name:        '',
    pukat_gophish_url:     '',
    pukat_gophish_api_key: '',
    pukat_timezone:        'UTC',
    pukat_quiz_pass_score: 70,
  })

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // null | 'success' | 'error'

  useEffect(() => {
    if (settings) {
      setForm(prev => ({
        ...prev,
        pukat_org_name:        settings.pukat_org_name        || '',
        pukat_gophish_url:     settings.pukat_gophish_url     || '',
        pukat_timezone:        settings.pukat_timezone        || 'UTC',
        pukat_quiz_pass_score: settings.pukat_quiz_pass_score || 70,
      }))
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      toast.success('Settings saved successfully.')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSave = (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.pukat_gophish_api_key) {
      delete payload.pukat_gophish_api_key // Don't overwrite if empty
    }
    saveMutation.mutate(payload)
  }

  const handleTestConnection = async () => {
    // Save URL + key first if changed
    if (form.pukat_gophish_url) {
      saveMutation.mutate({
        pukat_gophish_url:     form.pukat_gophish_url,
        pukat_gophish_api_key: form.pukat_gophish_api_key || undefined,
      })
    }
    setTesting(true)
    setTestResult(null)
    try {
      await gophishApi.status()
      setTestResult('success')
      toast.success('Successfully connected to GoPhish!')
      qc.invalidateQueries({ queryKey: ['gophish-status'] })
    } catch (err) {
      setTestResult('error')
      toast.error(`Connection failed: ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-32 animate-pulse bg-gray-100" />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl animate-fade-in">

      {/* Organization */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Organization</h2>
        <p className="text-xs text-gray-500 mb-4">General settings for your organization.</p>

        <div className="space-y-4">
          <div>
            <label className="label">Organization Name</label>
            <input
              id="org-name"
              className="input"
              value={form.pukat_org_name}
              onChange={e => update('pukat_org_name', e.target.value)}
              placeholder="e.g. Flow Beyond Pte Ltd"
            />
          </div>
          <div>
            <label className="label">Timezone</label>
            <select
              id="timezone"
              className="input"
              value={form.pukat_timezone}
              onChange={e => update('pukat_timezone', e.target.value)}
            >
              {['UTC', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quiz Pass Score (%)</label>
            <input
              id="quiz-pass-score"
              type="number"
              min="0"
              max="100"
              className="input"
              value={form.pukat_quiz_pass_score}
              onChange={e => update('pukat_quiz_pass_score', Number(e.target.value))}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum score to pass a post-simulation quiz.</p>
          </div>
        </div>
      </div>

      {/* GoPhish Connection */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">GoPhish Connection</h2>
        <p className="text-xs text-gray-500 mb-4">
          Connect to your GoPhish instance. The API key is stored encrypted and never exposed to the browser.
        </p>

        {/* Status indicator */}
        {testResult && (
          <div className={clsx(
            'flex items-center gap-2 p-3 rounded-lg mb-4 text-sm',
            testResult === 'success' ? 'bg-green-50 text-success border border-green-100' : 'bg-red-50 text-danger border border-red-100'
          )}>
            <i className={clsx('ti', testResult === 'success' ? 'ti-check-circle' : 'ti-alert-circle')} />
            {testResult === 'success' ? 'Connected successfully!' : 'Connection failed. Check URL and API key.'}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">GoPhish API URL</label>
            <input
              id="gophish-url"
              className="input"
              type="url"
              value={form.pukat_gophish_url}
              onChange={e => update('pukat_gophish_url', e.target.value)}
              placeholder="https://your-gophish-server:3333"
            />
          </div>
          <div>
            <label className="label">
              GoPhish API Key
              {settings?.has_api_key && (
                <span className="ml-2 badge badge-success text-xs">
                  <i className="ti ti-lock-check" /> Key stored
                </span>
              )}
            </label>
            <input
              id="gophish-api-key"
              className="input"
              type="password"
              value={form.pukat_gophish_api_key}
              onChange={e => update('pukat_gophish_api_key', e.target.value)}
              placeholder={settings?.has_api_key ? '••••••••••••• (leave blank to keep current)' : 'Paste your GoPhish API key'}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-400 mt-1">
              Find this in GoPhish → Account Settings → API Key.
            </p>
          </div>

          <button
            type="button"
            id="btn-test-connection"
            onClick={handleTestConnection}
            disabled={testing || !form.pukat_gophish_url}
            className="btn btn-secondary w-full"
          >
            {testing ? (
              <>
                <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Testing connection...
              </>
            ) : (
              <>
                <i className="ti ti-plug-connected" />
                Test Connection
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <button
          type="submit"
          id="btn-save-settings"
          disabled={saveMutation.isPending}
          className="btn btn-primary"
        >
          {saveMutation.isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <i className="ti ti-device-floppy" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </form>
  )
}
