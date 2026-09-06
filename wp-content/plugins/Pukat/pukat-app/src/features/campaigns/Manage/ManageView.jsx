import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { DataTable } from '../../../components/DataTable/index.js'
import Card from '../../../components/UI/Card.jsx'
import Button from '../../../components/UI/Button.jsx'
import Drawer from '../../../components/UI/Drawer.jsx'
import Input from '../../../components/UI/Input.jsx'
import Label from '../../../components/UI/Label.jsx'
import Textarea from '../../../components/UI/Textarea.jsx'
import Select from '../../../components/UI/Select.jsx'
import AlertConfirmation from '../../../components/UI/AlertConfirmation.jsx'
import { useTableSchema, useTableRows } from '../../../hooks/queries/useTableQueries.js'
import { useCampaignGroups } from '../../../hooks/queries/useCampaignGroupQueries.js'
import {
  useCreateCampaignGroupMutation,
  useUpdateCampaignGroupMutation,
  useDeleteCampaignGroupMutation,
} from '../../../hooks/mutations/useCampaignGroupMutations.js'
import {
  useCompleteCampaignRunMutation,
  useBulkCompleteCampaignRunMutation,
  useAssignCampaignRunGroupMutation,
  useBulkAssignCampaignRunGroupMutation,
  useSyncCampaignRunResultsMutation,
} from '../../../hooks/mutations/useCampaignMutations.js'

const TABLE_KEY = 'campaign_runs'
const DEFAULT_TABLE_STATE = { search: '', sort: 'created_at', order: 'desc', page: 1, perPage: 10, filters: {} }
const EMPTY_GROUP_FORM = { name: '', description: '' }
// Above this many groups, pills wrap into unmanageable clutter — switch to a
// searchable dropdown instead.
const GROUP_PILL_LIMIT = 5

/**
 * Campaign management: create/rename/delete Campaign Groups (each
 * entity-scoped to its creator, status computed from member campaigns — see
 * docs/PRD_CAMPAIGN_GROUP_MONITORING.md §6.3/§7.2), filter campaigns by
 * group, and Complete or move-to-group campaigns one at a time or in bulk.
 */
export default function ManageView() {
  const navigate = useNavigate()
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [selectedGroupId, setSelectedGroupId] = useState('') // '' = all, '0' = ungrouped, else group id
  const [selectedRowIds, setSelectedRowIds] = useState(new Set())

  const [groupDrawerMode, setGroupDrawerMode] = useState(null) // 'create' | 'edit'
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP_FORM)
  const [deletingGroup, setDeletingGroup] = useState(null)

  const [completingRow, setCompletingRow] = useState(null)
  const [assigningRow, setAssigningRow] = useState(null)
  const [bulkAssigningGroup, setBulkAssigningGroup] = useState(false)
  const [assignGroupValue, setAssignGroupValue] = useState('')
  const [confirmingBulkComplete, setConfirmingBulkComplete] = useState(false)

  const { data: groups = [] } = useCampaignGroups()

  const { data: schema } = useTableSchema(TABLE_KEY)
  const { data: rowsData, isLoading, isFetching, refetch } = useTableRows(TABLE_KEY, {
    search: tableState.search,
    sort: tableState.sort,
    order: tableState.order,
    page: tableState.page,
    per_page: tableState.perPage,
    filters: {
      ...tableState.filters,
      ...(selectedGroupId !== '' ? { campaign_group_id: selectedGroupId } : {}),
    },
  })

  const rows = rowsData?.rows || []
  const meta = rowsData?.meta

  function closeGroupDrawer() {
    setGroupDrawerMode(null)
    setEditingGroup(null)
    setGroupForm(EMPTY_GROUP_FORM)
  }

  const createGroupMutation = useCreateCampaignGroupMutation({ onSuccess: closeGroupDrawer })
  const updateGroupMutation = useUpdateCampaignGroupMutation({ onSuccess: closeGroupDrawer })
  const deleteGroupMutation = useDeleteCampaignGroupMutation({
    onSuccess: () => {
      if (String(selectedGroupId) === String(deletingGroup?.id)) setSelectedGroupId('')
      setDeletingGroup(null)
      refetch()
    },
  })

  const completeMutation = useCompleteCampaignRunMutation({ onSuccess: () => { setCompletingRow(null); refetch() } })
  const bulkCompleteMutation = useBulkCompleteCampaignRunMutation({
    onSuccess: () => { setConfirmingBulkComplete(false); setSelectedRowIds(new Set()); refetch() },
  })
  const assignGroupMutation = useAssignCampaignRunGroupMutation({ onSuccess: () => { setAssigningRow(null); refetch() } })
  const bulkAssignGroupMutation = useBulkAssignCampaignRunGroupMutation({
    onSuccess: () => { setBulkAssigningGroup(false); setSelectedRowIds(new Set()); refetch() },
  })
  const syncResultsMutation = useSyncCampaignRunResultsMutation({ onSuccess: () => refetch() })

  function openCreateGroup() {
    setGroupForm(EMPTY_GROUP_FORM)
    setEditingGroup(null)
    setGroupDrawerMode('create')
  }

  function openEditGroup(group) {
    setGroupForm({ name: group.name, description: group.description || '' })
    setEditingGroup(group)
    setGroupDrawerMode('edit')
  }

  function submitGroup() {
    const name = groupForm.name.trim()
    if (!name) {
      toast.error('Group name is required.')
      return
    }

    const payload = { name, description: groupForm.description.trim() }
    if (groupDrawerMode === 'edit') updateGroupMutation.mutate({ id: editingGroup.id, data: payload })
    else createGroupMutation.mutate(payload)
  }

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'view_report') {
      navigate(`/monitoring?run=${row.id}`)
    } else if (actionKey === 'sync') {
      syncResultsMutation.mutate(row.id)
    } else if (actionKey === 'complete') {
      setCompletingRow(row)
    } else if (actionKey === 'assign_group') {
      setAssigningRow(row)
      setAssignGroupValue(row.campaign_group_id ? String(row.campaign_group_id) : '')
    }
  }

  function handleBulkAction({ actionKey }) {
    if (selectedRowIds.size === 0) return

    if (actionKey === 'complete') {
      setConfirmingBulkComplete(true)
    } else if (actionKey === 'assign_group') {
      setAssignGroupValue('')
      setBulkAssigningGroup(true)
    }
  }

  function closeAssignGroupDrawer() {
    setAssigningRow(null)
    setBulkAssigningGroup(false)
  }

  function submitAssignGroup() {
    const groupId = assignGroupValue === '' ? null : Number(assignGroupValue)
    if (bulkAssigningGroup) {
      bulkAssignGroupMutation.mutate({ ids: Array.from(selectedRowIds), groupId })
    } else if (assigningRow) {
      assignGroupMutation.mutate({ id: assigningRow.id, groupId })
    }
  }

  const selectedCount = selectedRowIds.size
  const isAssigningGroup = Boolean(assigningRow) || bulkAssigningGroup
  const isAssignGroupPending = assignGroupMutation.isPending || bulkAssignGroupMutation.isPending

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Campaign groups</h3>
            <p className="mt-0.5 text-xs text-gray-500">Group campaigns by project/period to filter the Monitoring dashboard.</p>
          </div>
          <Button variant="primary" size="sm" onClick={openCreateGroup}>
            <i className="ti ti-plus text-sm" /> New group
          </Button>
        </div>

        <div className="mt-4">
          {groups.length > GROUP_PILL_LIMIT ? (
            <GroupNavigator
              groups={groups}
              selectedGroupId={selectedGroupId}
              onSelect={setSelectedGroupId}
              onEdit={openEditGroup}
              onDelete={setDeletingGroup}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <GroupPill label="All" active={selectedGroupId === ''} onClick={() => setSelectedGroupId('')} />
              <GroupPill label="Ungrouped" active={String(selectedGroupId) === '0'} onClick={() => setSelectedGroupId('0')} />
              {groups.map(group => (
                <GroupPill
                  key={group.id}
                  label={`${group.name} (${group.member_count})`}
                  status={group.status}
                  active={String(selectedGroupId) === String(group.id)}
                  onClick={() => setSelectedGroupId(String(group.id))}
                  onEdit={() => openEditGroup(group)}
                  onDelete={() => setDeletingGroup(group)}
                />
              ))}
              {groups.length === 0 && (
                <span className="py-1 text-xs text-gray-400">No groups yet — create one to start organizing campaigns.</span>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900">All campaigns</h3>
            <p className="mt-0.5 text-xs text-gray-500">Complete campaigns one at a time or in bulk, and move them between groups.</p>
          </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleBulkAction({ actionKey: 'assign_group' })}>
                <i className="ti ti-folder-symlink text-sm" /> Move {selectedCount} to group
              </Button>
              <Button variant="primary" size="sm" onClick={() => handleBulkAction({ actionKey: 'complete' })}>
                Complete {selectedCount} selected
              </Button>
            </div>
          )}
        </div>
        <div className="p-5">
          <DataTable
            tableKey={TABLE_KEY}
            schema={schema}
            rows={rows}
            meta={meta}
            state={tableState}
            loading={isLoading}
            refetching={isFetching}
            selectedRowIds={selectedRowIds}
            onSelectionChange={setSelectedRowIds}
            onStateChange={setTableState}
            onRowAction={handleRowAction}
            onBulkAction={handleBulkAction}
          />
        </div>
      </Card>

      {groupDrawerMode && (
        <Drawer
          title={groupDrawerMode === 'edit' ? `Edit ${editingGroup?.name ?? 'group'}` : 'New campaign group'}
          subtitle="Used to filter campaigns shown on the Monitoring dashboard"
          widthClass="max-w-sm"
          onClose={closeGroupDrawer}
          footer={
            <>
              <Button variant="outline" onClick={closeGroupDrawer}>Cancel</Button>
              <Button
                variant="primary"
                onClick={submitGroup}
                disabled={createGroupMutation.isPending || updateGroupMutation.isPending}
              >
                {createGroupMutation.isPending || updateGroupMutation.isPending
                  ? 'Saving...'
                  : groupDrawerMode === 'edit' ? 'Save changes' : 'Create group'}
              </Button>
            </>
          }
        >
          <div>
            <Label required>Name</Label>
            <Input
              value={groupForm.name}
              onChange={e => setGroupForm(current => ({ ...current, name: e.target.value }))}
              placeholder="e.g. Awareness Wave Q3 2026"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={groupForm.description}
              onChange={e => setGroupForm(current => ({ ...current, description: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          {groupDrawerMode === 'edit' && (
            <p className="text-xs text-gray-400">
              Entity and status aren&apos;t editable here — entity always matches who created the group, and status is
              computed automatically from the campaigns inside it.
            </p>
          )}
        </Drawer>
      )}

      {deletingGroup && (
        <AlertConfirmation
          title="Delete campaign group?"
          message={`"${deletingGroup.name}" will be removed. Campaigns in it become Ungrouped — nothing else is deleted.`}
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteGroupMutation.isPending}
          onCancel={() => setDeletingGroup(null)}
          onConfirm={() => deleteGroupMutation.mutate(deletingGroup.id)}
        />
      )}

      {completingRow && (
        <AlertConfirmation
          title="Complete this campaign?"
          message={`"${completingRow.name}" will be marked complete. This stops it in GoPhish if it's still running.`}
          icon="ti-circle-check"
          tone="warning"
          confirmLabel="Complete"
          pendingLabel="Completing..."
          isPending={completeMutation.isPending}
          onCancel={() => setCompletingRow(null)}
          onConfirm={() => completeMutation.mutate(completingRow.id)}
        />
      )}

      {confirmingBulkComplete && (
        <AlertConfirmation
          title={`Complete ${selectedCount} campaign${selectedCount === 1 ? '' : 's'}?`}
          message="Each campaign is completed individually — if one can't be completed (e.g. already ended), the rest still go through and you'll see a summary."
          icon="ti-circle-check"
          tone="warning"
          confirmLabel="Complete"
          pendingLabel="Completing..."
          isPending={bulkCompleteMutation.isPending}
          onCancel={() => setConfirmingBulkComplete(false)}
          onConfirm={() => bulkCompleteMutation.mutate(Array.from(selectedRowIds))}
        />
      )}

      {isAssigningGroup && (
        <Drawer
          title={bulkAssigningGroup ? `Move ${selectedCount} campaign${selectedCount === 1 ? '' : 's'}` : `Move "${assigningRow.name}"`}
          subtitle={bulkAssigningGroup ? 'Choose which group these campaigns belong to' : 'Choose which group this campaign belongs to'}
          widthClass="max-w-sm"
          onClose={closeAssignGroupDrawer}
          footer={
            <>
              <Button variant="outline" onClick={closeAssignGroupDrawer}>Cancel</Button>
              <Button variant="primary" onClick={submitAssignGroup} disabled={isAssignGroupPending}>
                {isAssignGroupPending ? 'Moving...' : 'Move'}
              </Button>
            </>
          }
        >
          <div>
            <Label>Campaign group</Label>
            <Select value={assignGroupValue} onChange={e => setAssignGroupValue(e.target.value)}>
              <option value="">Ungrouped</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </Select>
          </div>
        </Drawer>
      )}
    </div>
  )
}

function GroupPill({ label, status, active, onClick, onEdit, onDelete }) {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full border pl-1 pr-1 py-1 text-xs font-semibold transition-colors',
        active ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      )}
    >
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1">
        {label}
        {status && (
          <span
            className={clsx(
              'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
              status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
            )}
          >
            {status === 'active' ? 'Active' : 'Selesai'}
          </span>
        )}
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} className="rounded-full p-1.5 text-gray-400 hover:text-gray-700" aria-label={`Edit ${label}`}>
          <i className="ti ti-edit text-[11px]" />
        </button>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} className="rounded-full p-1.5 text-gray-400 hover:text-red-600" aria-label={`Delete ${label}`}>
          <i className="ti ti-trash text-[11px]" />
        </button>
      )}
    </div>
  )
}

/**
 * Searchable dropdown replacement for the pill row once there are too many
 * groups to scan by eye (see GROUP_PILL_LIMIT). Bundles "All"/"Ungrouped"
 * plus every group into one control, filterable by name.
 */
function GroupNavigator({ groups, selectedGroupId, onSelect, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false)
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const filteredGroups = groups.filter(group => group.name.toLowerCase().includes(query.trim().toLowerCase()))

  const selectedLabel = selectedGroupId === ''
    ? 'All'
    : String(selectedGroupId) === '0'
      ? 'Ungrouped'
      : groups.find(group => String(group.id) === String(selectedGroupId))?.name ?? 'All'

  function choose(value) {
    onSelect(value)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
      >
        <i className="ti ti-folder text-sm text-gray-400" />
        <span className="max-w-[14rem] truncate">{selectedLabel}</span>
        <i className="ti ti-chevron-down text-xs text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 p-2">
            <Input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search groups..."
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => choose('')}
              className={clsx(
                'block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50',
                selectedGroupId === '' ? 'bg-violet-50 font-semibold text-violet-700' : 'text-gray-700'
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => choose('0')}
              className={clsx(
                'block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50',
                String(selectedGroupId) === '0' ? 'bg-violet-50 font-semibold text-violet-700' : 'text-gray-700'
              )}
            >
              Ungrouped
            </button>

            {filteredGroups.length === 0 && query.trim() !== '' && (
              <p className="px-3 py-2 text-xs text-gray-400">No groups match &quot;{query}&quot;.</p>
            )}

            {filteredGroups.map(group => (
              <div
                key={group.id}
                className={clsx(
                  'group flex items-center gap-0.5 rounded-md px-0.5',
                  String(selectedGroupId) === String(group.id) ? 'bg-violet-50' : 'hover:bg-gray-50'
                )}
              >
                <button
                  type="button"
                  onClick={() => choose(String(group.id))}
                  className={clsx(
                    'flex flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm',
                    String(selectedGroupId) === String(group.id) ? 'font-semibold text-violet-700' : 'text-gray-700'
                  )}
                >
                  <span className="truncate">{group.name}</span>
                  <span className="shrink-0 text-xs text-gray-400">({group.member_count})</span>
                  <span
                    className={clsx(
                      'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                      group.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {group.status === 'active' ? 'Active' : 'Selesai'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { onEdit(group); setOpen(false) }}
                  className="rounded p-1.5 text-gray-400 opacity-0 hover:text-gray-700 group-hover:opacity-100"
                  aria-label={`Edit ${group.name}`}
                >
                  <i className="ti ti-edit text-[11px]" />
                </button>
                <button
                  type="button"
                  onClick={() => { onDelete(group); setOpen(false) }}
                  className="rounded p-1.5 text-gray-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                  aria-label={`Delete ${group.name}`}
                >
                  <i className="ti ti-trash text-[11px]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
