import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import { useSettingsQuery } from '../../hooks/queries/useSettingsQueries.js'
import { useSaveSettingsMutation, useTestGophishConnectionMutation } from '../../hooks/mutations/useSettingsMutations.js'
import Card from '../../components/UI/Card.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Select from '../../components/UI/Select.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'

export default function Settings() {
  const { data: settings, isLoading } = useSettingsQuery()

  const [form, setForm] = useState({
    pukat_org_name:        '',
    pukat_gophish_url:     '',
    pukat_gophish_api_key: '',
    pukat_timezone:        'UTC',
    pukat_quiz_pass_score: 70,
  })

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

  const saveMutation = useSaveSettingsMutation()
  const testConnectionMutation = useTestGophishConnectionMutation({
    onSuccess: () => setTestResult('success'),
    onError: () => setTestResult('error'),
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
    setTestResult(null)
    try {
      // Save URL + key first if changed, then test the persisted values.
      if (form.pukat_gophish_url) {
        const payload = {
          pukat_gophish_url: form.pukat_gophish_url,
        }

        if (form.pukat_gophish_api_key) {
          payload.pukat_gophish_api_key = form.pukat_gophish_api_key
        }

        await saveMutation.mutateAsync(payload)
      }

      await testConnectionMutation.mutateAsync()
    } catch {
      // Mutation hooks handle toast messaging and local success/error state.
    }
  }

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const isTestingConnection = saveMutation.isPending || testConnectionMutation.isPending

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-gray-100" />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl animate-fade-in">

      {/* Organization */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Organization</h2>
        <p className="text-xs text-gray-500 mb-4">General settings for your organization.</p>

        <div className="space-y-4">
          <div>
            <Label>Organization Name</Label>
            <Input
              id="org-name"
              value={form.pukat_org_name}
              onChange={e => update('pukat_org_name', e.target.value)}
              placeholder="e.g. Flow Beyond Pte Ltd"
            />
          </div>
          <div>
            <Label>Timezone</Label>
            <Select
              id="timezone"
              value={form.pukat_timezone}
              onChange={e => update('pukat_timezone', e.target.value)}
            >
              {['UTC', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quiz Pass Score (%)</Label>
            <Input
              id="quiz-pass-score"
              type="number"
              min="0"
              max="100"
              value={form.pukat_quiz_pass_score}
              onChange={e => update('pukat_quiz_pass_score', Number(e.target.value))}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum score to pass a post-simulation quiz.</p>
          </div>
        </div>
      </Card>

      {/* GoPhish Connection */}
      <Card>
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
            <Label>GoPhish API URL</Label>
            <Input
              id="gophish-url"
              type="url"
              value={form.pukat_gophish_url}
              onChange={e => update('pukat_gophish_url', e.target.value)}
              placeholder="https://your-gophish-server:3333"
            />
          </div>
          <div>
            <Label>
              GoPhish API Key
              {settings?.has_api_key && (
                <Badge tone="success" className="ml-2 text-xs">
                  <i className="ti ti-lock-check" /> Key stored
                </Badge>
              )}
            </Label>
            <Input
              id="gophish-api-key"
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

          <Button
            type="button"
            id="btn-test-connection"
            variant="secondary"
            className="w-full"
            onClick={handleTestConnection}
            disabled={isTestingConnection || !form.pukat_gophish_url}
          >
            {isTestingConnection ? (
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
          </Button>
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          id="btn-save-settings"
          variant="primary"
          disabled={saveMutation.isPending}
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
        </Button>
      </div>
    </form>
  )
}
