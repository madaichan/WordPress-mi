import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import { useSettingsQuery } from '../../hooks/queries/useSettingsQueries.js'
import { useSaveSettingsMutation, useTestGophishConnectionMutation } from '../../hooks/mutations/useSettingsMutations.js'
import PageShell from '../../components/Layout/PageShell.jsx'
import Card from '../../components/UI/Card.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Select from '../../components/UI/Select.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import Switch from '../../components/UI/Switch.jsx'

export default function Settings() {
  const { data: settings, isLoading } = useSettingsQuery()

  const [form, setForm] = useState({
    pukat_org_name:              '',
    pukat_gophish_url:           '',
    pukat_gophish_api_key:       '',
    pukat_timezone:              'UTC',
    pukat_quiz_pass_score:       70,
    pukat_sync_interval_minutes: 1,
    pukat_require_email_domain_guardrail: true,
  })

  const [testResult, setTestResult] = useState(null) // null | 'success' | 'error'

  useEffect(() => {
    if (settings) {
      setForm(prev => ({
        ...prev,
        pukat_org_name:              settings.pukat_org_name              || '',
        pukat_gophish_url:           settings.pukat_gophish_url           || '',
        pukat_timezone:              settings.pukat_timezone              || 'UTC',
        pukat_quiz_pass_score:       settings.pukat_quiz_pass_score       || 70,
        pukat_sync_interval_minutes: settings.pukat_sync_interval_minutes || 1,
        pukat_require_email_domain_guardrail: settings.pukat_require_email_domain_guardrail !== false,
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
      <PageShell spacing="space-y-4" animated={false}>
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-panel-muted" />
        ))}
      </PageShell>
    )
  }

  return (
    <PageShell as="form" onSubmit={handleSave} className="max-w-2xl">

      {/* Organization */}
      <Card>
        <h2 className="text-sm font-semibold text-ink mb-1">Organization</h2>
        <p className="text-xs text-ink-muted mb-4">General settings for your organization.</p>

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
            <p className="text-xs text-ink-faint mt-1">Minimum score to pass a post-simulation quiz.</p>
          </div>
        </div>
      </Card>

      {/* GoPhish Connection */}
      <Card>
        <h2 className="text-sm font-semibold text-ink mb-1">GoPhish Connection</h2>
        <p className="text-xs text-ink-muted mb-4">
          Connect to your GoPhish instance. The API key is stored encrypted and never exposed to the browser.
        </p>

        {/* Status indicator */}
        {testResult && (
          <div className={clsx(
            'flex items-center gap-2 p-3 rounded-lg mb-4 text-sm',
            testResult === 'success' ? 'bg-green-500/10 text-success border border-green-500/20' : 'bg-red-500/10 text-danger border border-red-500/20'
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
            <p className="text-xs text-ink-faint mt-1">
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
                <span className="w-4 h-4 border-2 border-line-strong border-t-transparent rounded-full animate-spin" />
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

      {/* Automation */}
      <Card>
        <h2 className="text-sm font-semibold text-ink mb-1">Automation</h2>
        <p className="text-xs text-ink-muted mb-4">Control how often Pukat pulls fresh results from GoPhish.</p>

        <div>
          <Label>Sync GoPhish results every</Label>
          <Select
            id="sync-interval"
            value={form.pukat_sync_interval_minutes}
            onChange={e => update('pukat_sync_interval_minutes', Number(e.target.value))}
          >
            {(settings?.sync_interval_choices || [1, 5, 15, 30, 60]).map(minutes => (
              <option key={minutes} value={minutes}>{minutes === 1 ? 'minute' : `${minutes} minutes`}</option>
            ))}
          </Select>
          <p className="text-xs text-ink-faint mt-1">
            A shorter interval means fresher data on the Monitoring dashboard, but more frequent calls to your GoPhish server.
          </p>
        </div>
      </Card>

      {/* Guardrails — docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §16 */}
      <Card>
        <h2 className="text-sm font-semibold text-ink mb-1">Guardrails</h2>
        <p className="text-xs text-ink-muted mb-4">Safety checks applied when a Campaign Run is launched.</p>

        <Switch
          checked={form.pukat_require_email_domain_guardrail}
          onChange={value => update('pukat_require_email_domain_guardrail', value)}
          label="Require company email domains before launch"
        />
        <p className="text-xs text-ink-faint mt-1">
          On: an entity with no active company email domain cannot launch campaigns (including General).
          Off: such entities skip the target email-domain check entirely. Changes are recorded in the audit log.
        </p>
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
    </PageShell>
  )
}
