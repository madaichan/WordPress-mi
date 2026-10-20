import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useFlags } from '../../hooks/queries/useFlagQueries.js'
import { useCreateFlagMutation, useUpdateFlagMutation, useDeleteFlagMutation } from '../../hooks/mutations/useFlagMutations.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import { DataTable } from '../../components/DataTable/index.js'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import TableActionMenu from '../../components/UI/TableActionMenu.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Select from '../../components/UI/Select.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'

const COLORS = ['danger', 'warning', 'info', 'violet', 'success', 'gray']
const EMPTY_FORM = { label: '', color: 'gray', is_active: true }
const TABLE_KEY = 'flags'
const DEFAULT_TABLE_STATE = { search: '', sort: 'label', order: 'asc', page: 1, perPage: 25, filters: {} }
// Flag categories come from a plain list endpoint (useFlags), not the backend
// server-driven Table API/TableRegistry like `landing_pages` — the list is
// small (a handful of shared categories), so search/sort/pagination for the
// shared DataTable UI are done client-side here instead.
const SEARCHABLE_FIELDS = ['label', 'flag_key']

/**
 * Admin management of the shared Flag categories. Each entity's example
 * images are uploaded by that entity's users from My Profile — see
 * docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md.
 */
export default function MasterFlags() {
  const { data: flags = [], isLoading, isFetching, refetch } = useFlags()
  const [drawer, setDrawer] = useState(null) // null | { mode: 'create' } | { mode: 'edit', id }
  const [form, setForm] = useState(EMPTY_FORM)
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [deletingFlag, setDeletingFlag] = useState(null)

  const close = () => { setDrawer(null); setForm(EMPTY_FORM) }
  const createMutation = useCreateFlagMutation({ onSuccess: close })
  const updateMutation = useUpdateFlagMutation({ onSuccess: close })
  const toggleMutation = useUpdateFlagMutation()
  const deleteMutation = useDeleteFlagMutation({ onSuccess: () => setDeletingFlag(null) })
  const isSaving = createMutation.isPending || updateMutation.isPending

  const filteredFlags = useMemo(() => {
    const term = tableState.search.trim().toLowerCase()
    if (!term) return flags
    return flags.filter(flag => SEARCHABLE_FIELDS.some(
      field => String(flag[field] || '').toLowerCase().includes(term)
    ))
  }, [flags, tableState.search])

  const sortedFlags = useMemo(() => {
    if (tableState.sort !== 'label') return filteredFlags
    const sorted = [...filteredFlags].sort(
      (a, b) => String(a.label || '').localeCompare(String(b.label || ''))
    )
    if (tableState.order === 'desc') sorted.reverse()
    return sorted
  }, [filteredFlags, tableState.sort, tableState.order])

  const perPage = tableState.perPage || DEFAULT_TABLE_STATE.perPage
  const pageCount = Math.max(1, Math.ceil(sortedFlags.length / perPage))
  const currentPage = Math.min(tableState.page || 1, pageCount)
  const pagedFlags = useMemo(
    () => sortedFlags.slice((currentPage - 1) * perPage, currentPage * perPage),
    [sortedFlags, currentPage, perPage]
  )
  const tableMeta = { total: sortedFlags.length, per_page: perPage, has_next: currentPage < pageCount }

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

  function confirmDelete() {
    if (deletingFlag) deleteMutation.mutate(deletingFlag.id)
  }

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'edit') openEdit(row)
    else if (actionKey === 'toggle') toggleMutation.mutate({ id: row.id, data: { is_active: !row.is_active } })
    else if (actionKey === 'delete') setDeletingFlag(row)
  }

  async function syncFlags() {
    const result = await refetch()
    if (result.error) {
      toast.error(result.error.message || 'Failed to refresh flag categories.')
      return
    }
    toast.success(`Refresh complete - ${result.data?.length ?? 0} flag categories`)
  }

  function renderActionsCell(row) {
    return (
      <div className="inline-flex items-center justify-end gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>
          <i className="ti ti-edit" />
          Edit
        </Button>
        <TableActionMenu
          items={[
            { key: 'toggle', label: row.is_active ? 'Deactivate' : 'Activate', icon: row.is_active ? 'ti-eye-off' : 'ti-eye', disabled: toggleMutation.isPending },
            { key: 'delete', label: 'Delete', icon: 'ti-trash' },
          ]}
          triggerTitle="More Actions"
          onSelect={actionKey => handleRowAction({ actionKey, row })}
        />
      </div>
    )
  }

  const schema = useMemo(() => ({
    search: { placeholder: 'Search flag categories...' },
    columns: [
      {
        key: 'label',
        label: 'Category',
        renderer: 'custom',
        sortable: true,
        render: row => <Badge tone={row.color || 'gray'}>{row.label}</Badge>,
      },
      {
        key: 'flag_key',
        label: 'Key',
        renderer: 'custom',
        render: row => <span className="font-mono text-xs text-ink-muted">{row.flag_key}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        renderer: 'custom',
        render: row => <Badge tone={row.is_active ? 'success' : 'gray'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
      },
      {
        key: 'actions',
        label: 'Actions',
        renderer: 'custom',
        align: 'right',
        render: row => renderActionsCell(row),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [toggleMutation.isPending])

  return (
    <PageShell>
      <PageHeader
        title="Flag Categories"
        subtitle="Shared warning-sign categories. Each entity uploads its own example screenshots from My Profile."
        actions={
          <>
            <Button variant="outline" onClick={syncFlags} disabled={isFetching}>
              <i className={`ti ti-refresh text-base ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setDrawer({ mode: 'create' }) }}>
              <i className="ti ti-plus text-sm" />
              Add category
            </Button>
          </>
        }
      />

      <DataTable
        tableKey={TABLE_KEY}
        schema={schema}
        rows={pagedFlags}
        meta={tableMeta}
        state={{ ...tableState, page: currentPage }}
        loading={isLoading}
        refetching={isFetching && !isLoading}
        onStateChange={setTableState}
        onRowAction={handleRowAction}
      />

      {deletingFlag && (
        <AlertConfirmation
          title="Delete flag category?"
          message={`"${deletingFlag.label}" will be deleted. Categories that still have examples cannot be deleted — deactivate them instead.`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingFlag(null)}
          onConfirm={confirmDelete}
        />
      )}

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
