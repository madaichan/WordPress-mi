import { useState } from 'react'
import toast from 'react-hot-toast'
import { useFlags } from '../../hooks/queries/useFlagQueries.js'
import { useCreateFlagMutation, useUpdateFlagMutation, useDeleteFlagMutation } from '../../hooks/mutations/useFlagMutations.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Card from '../../components/UI/Card.jsx'
import Table from '../../components/UI/Table.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Select from '../../components/UI/Select.jsx'

const COLORS = ['danger', 'warning', 'info', 'violet', 'success', 'gray']
const EMPTY_FORM = { label: '', color: 'gray', is_active: true }

/**
 * Admin management of the shared Flag categories. Each entity's example
 * images are uploaded by that entity's users from My Profile — see
 * docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md.
 */
export default function MasterFlags() {
  const { data: flags = [], isLoading } = useFlags()
  const [drawer, setDrawer] = useState(null) // null | { mode: 'create' } | { mode: 'edit', id }
  const [form, setForm] = useState(EMPTY_FORM)

  const close = () => { setDrawer(null); setForm(EMPTY_FORM) }
  const createMutation = useCreateFlagMutation({ onSuccess: close })
  const updateMutation = useUpdateFlagMutation({ onSuccess: close })
  const toggleMutation = useUpdateFlagMutation()
  const deleteMutation = useDeleteFlagMutation()
  const isSaving = createMutation.isPending || updateMutation.isPending

  function openEdit(flag) {
    setForm({ label: flag.label, color: flag.color || 'gray', is_active: flag.is_active })
    setDrawer({ mode: 'edit', id: flag.id })
  }

  function submit() {
    if (!form.label.trim()) {
      toast.error('Label is required.')
      return
    }
    if (drawer.mode === 'edit') updateMutation.mutate({ id: drawer.id, data: form })
    else createMutation.mutate(form)
  }

  function remove(flag) {
    if (window.confirm(`Delete Flag category "${flag.label}"? Categories that still have examples cannot be deleted — deactivate them instead.`)) {
      deleteMutation.mutate(flag.id)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Flag Categories"
        subtitle="Shared warning-sign categories. Each entity uploads its own example screenshots from My Profile."
        actions={
          <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setDrawer({ mode: 'create' }) }}>
            <i className="ti ti-plus text-sm" />
            Add category
          </Button>
        }
      />

      <Card className="p-0">
        <Table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Key</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(4)].map((_, i) => <tr key={i}>{[...Array(4)].map((_, j) => <td key={j}><div className="h-4 animate-pulse rounded bg-gray-100" /></td>)}</tr>)
              : flags.map(flag => (
                  <tr key={flag.id}>
                    <td><Badge tone={flag.color || 'gray'}>{flag.label}</Badge></td>
                    <td className="font-mono text-xs text-gray-500">{flag.flag_key}</td>
                    <td><Badge tone={flag.is_active ? 'success' : 'gray'}>{flag.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <button type="button" className="text-xs font-semibold text-gray-600 hover:underline" onClick={() => openEdit(flag)}>Edit</button>
                        <button
                          type="button"
                          className="text-xs font-semibold text-violet-600 hover:underline"
                          onClick={() => toggleMutation.mutate({ id: flag.id, data: { is_active: !flag.is_active } })}
                          disabled={toggleMutation.isPending}
                        >
                          {flag.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" className="text-xs font-semibold text-danger hover:underline" onClick={() => remove(flag)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </Table>
      </Card>

      {drawer && (
        <Drawer
          onClose={close}
          title={drawer.mode === 'edit' ? 'Edit Flag category' : 'New Flag category'}
          subtitle={drawer.mode === 'edit' ? 'The key cannot be changed.' : 'The key is derived from the label.'}
          footer={
            <>
              <Button variant="outline" className="ml-auto" onClick={close} disabled={isSaving}>Cancel</Button>
              <Button variant="primary" onClick={submit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
            </>
          }
        >
          <div>
            <Label required>Label</Label>
            <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Invoice fraud" />
          </div>
          <div>
            <Label>Color</Label>
            <Select value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}>
              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="mt-2"><Badge tone={form.color}>{form.label || 'Preview'}</Badge></div>
          </div>
        </Drawer>
      )}
    </PageShell>
  )
}
