import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import { DataTable } from '../../components/DataTable/index.js'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import TableActionMenu from '../../components/UI/TableActionMenu.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import Input from '../../components/UI/Input.jsx'
import Label from '../../components/UI/Label.jsx'
import Textarea from '../../components/UI/Textarea.jsx'
import Checkbox from '../../components/UI/Checkbox.jsx'
import Select from '../../components/UI/Select.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import { useRoles, usePermissionRegistry } from '../../hooks/queries/useRoleQueries.js'
import { useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation } from '../../hooks/mutations/useRoleMutations.js'
import { frontendNavGroups, frontendRoutePermissions } from '../../config/appRoutes.jsx'

const EMPTY_FORM = { display_name: '', description: '', permissions: [], landing_menu: '' }
const TABLE_KEY = 'roles'
const DEFAULT_TABLE_STATE = { search: '', sort: 'role', order: 'asc', page: 1, perPage: 25, filters: {} }
// Roles come from a plain list endpoint (useRoles), not the backend server-driven Table
// API/TableRegistry like `landing_pages` — the list is small, so search/sort/pagination
// for the shared DataTable UI are done client-side here instead.
const SEARCHABLE_FIELDS = ['display_name', 'description', 'role_slug']

// Only pages that actually exist in the frontend SPA (/pukat) can be a
// landing page — same source of truth the sidebar itself renders from, so
// this list can never drift from what a role can actually navigate to.
// The menu key sent to the backend (PermissionRegistry) is derived from
// each route's `<menu>.view` permission, not invented separately here.
const LANDING_PAGE_OPTIONS = frontendNavGroups
  .flatMap((group) => group.items)
  .reduce((options, item) => {
    const permission = frontendRoutePermissions.get(item.to)
    const menu = permission?.endsWith('.view') ? permission.slice(0, -'.view'.length) : null
    if (menu && !options.some((opt) => opt.menu === menu)) {
      options.push({ menu, label: item.label })
    }
    return options
  }, [])

function formatActionLabel(action) {
  return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ')
}

function landingPageLabel(menu) {
  return LANDING_PAGE_OPTIONS.find((opt) => opt.menu === menu)?.label || 'Dashboard'
}

/** Registry entries for a group come back flat (menu.view, menu.create, ...) — regroup by menu for the matrix. */
function groupEntriesByMenu(entries) {
  const byMenu = new Map()
  entries.forEach((entry) => {
    if (!byMenu.has(entry.menu)) {
      byMenu.set(entry.menu, { menu: entry.menu, label: entry.label, entries: [] })
    }
    byMenu.get(entry.menu).entries.push(entry)
  })
  return Array.from(byMenu.values())
}

export default function Roles() {
  const { data: roles = [], isLoading, isFetching, refetch } = useRoles()
  const { data: registry = {} } = usePermissionRegistry()

  const [drawerMode, setDrawerMode] = useState(null) // 'create' | 'edit'
  const [editingSlug, setEditingSlug] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletingRole, setDeletingRole] = useState(null)
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)

  const createMutation = useCreateRoleMutation({ onSuccess: closeDrawer })
  const updateMutation = useUpdateRoleMutation({ onSuccess: closeDrawer })
  const deleteMutation = useDeleteRoleMutation({ onSuccess: () => setDeletingRole(null) })
  const saving = createMutation.isPending || updateMutation.isPending

  function closeDrawer() {
    setDrawerMode(null)
    setEditingSlug(null)
    setForm(EMPTY_FORM)
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditingSlug(null)
    setDrawerMode('create')
  }

  function openEdit(role) {
    setForm({
      display_name: role.display_name,
      description: role.description || '',
      permissions: [...role.permissions],
      landing_menu: role.landing_menu || '',
    })
    setEditingSlug(role.role_slug)
    setDrawerMode('edit')
  }

  function togglePermission(key) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((k) => k !== key)
        : [...current.permissions, key],
    }))
  }

  function toggleAllInMenu(menuEntries, checked) {
    setForm((current) => {
      const keys = menuEntries.map((entry) => entry.key)
      const withoutMenu = current.permissions.filter((k) => !keys.includes(k))
      return { ...current, permissions: checked ? [...withoutMenu, ...keys] : withoutMenu }
    })
  }

  function submit() {
    const displayName = form.display_name.trim()
    if (!displayName) {
      toast.error('Display name is required.')
      return
    }

    const payload = {
      display_name: displayName,
      description: form.description.trim(),
      permissions: form.permissions,
      landing_menu: form.landing_menu,
    }

    if (drawerMode === 'edit') {
      updateMutation.mutate({ slug: editingSlug, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function confirmDelete() {
    if (!deletingRole) return
    deleteMutation.mutate(deletingRole.role_slug)
  }

  const groupNames = Object.keys(registry)

  const tableRows = useMemo(() => roles.map(role => ({ ...role, id: role.role_slug })), [roles])

  const filteredRows = useMemo(() => {
    const term = tableState.search.trim().toLowerCase()
    if (!term) return tableRows
    return tableRows.filter(row => SEARCHABLE_FIELDS.some(
      field => String(row[field] || '').toLowerCase().includes(term)
    ))
  }, [tableRows, tableState.search])

  const sortedRows = useMemo(() => {
    if (tableState.sort !== 'role') return filteredRows
    const sorted = [...filteredRows].sort(
      (a, b) => String(a.display_name || '').localeCompare(String(b.display_name || ''))
    )
    if (tableState.order === 'desc') sorted.reverse()
    return sorted
  }, [filteredRows, tableState.sort, tableState.order])

  const perPage = tableState.perPage || DEFAULT_TABLE_STATE.perPage
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / perPage))
  const currentPage = Math.min(tableState.page || 1, pageCount)
  const pagedRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * perPage, currentPage * perPage),
    [sortedRows, currentPage, perPage]
  )
  const tableMeta = { total: sortedRows.length, per_page: perPage, has_next: currentPage < pageCount }

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'edit') openEdit(row)
    else if (actionKey === 'delete') setDeletingRole(row)
  }

  async function syncRoles() {
    const result = await refetch()
    if (result.error) {
      toast.error(result.error.message || 'Failed to refresh roles.')
      return
    }
    toast.success(`Refresh complete - ${result.data?.length ?? 0} roles`)
  }

  function renderActionsCell(role) {
    const canDelete = !role.is_system_role && role.user_count === 0
    const deleteReason = role.is_system_role
      ? 'System roles cannot be deleted'
      : role.user_count > 0
        ? `${role.user_count} user(s) still assigned to this role`
        : ''

    return (
      <div className="inline-flex items-center justify-end gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => openEdit(role)}>
          <i className="ti ti-edit" />
          Edit
        </Button>
        <TableActionMenu
          items={[{ key: 'delete', label: 'Delete', icon: 'ti-trash', disabled: !canDelete, reason: deleteReason }]}
          triggerTitle="More Actions"
          onSelect={actionKey => handleRowAction({ actionKey, row: role })}
        />
      </div>
    )
  }

  const schema = useMemo(() => ({
    search: { placeholder: 'Search roles...' },
    columns: [
      {
        key: 'role',
        label: 'Role',
        renderer: 'custom',
        sortable: true,
        render: row => <span className="font-semibold text-ink">{row.display_name}</span>,
      },
      {
        key: 'description',
        label: 'Description',
        renderer: 'custom',
        render: row => row.description
          ? <span className="text-ink-muted">{row.description}</span>
          : <span className="text-ink-faint">—</span>,
      },
      {
        key: 'type',
        label: 'Type',
        renderer: 'custom',
        render: row => (
          <Badge tone={row.is_system_role ? 'violet' : 'gray'} className="text-[10px]">
            {row.is_system_role ? 'System' : 'Custom'}
          </Badge>
        ),
      },
      {
        key: 'landing_menu',
        label: 'Lands on',
        renderer: 'custom',
        render: row => <span className="text-ink-muted">{landingPageLabel(row.landing_menu)}</span>,
      },
      {
        key: 'user_count',
        label: 'Users',
        renderer: 'custom',
        render: row => <span className="text-ink-muted">{row.user_count}</span>,
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
  }), [])

  return (
    <PageShell>
      <PageHeader
        title="Roles"
        subtitle="Create roles and control exactly what each one can see and do"
        actions={
          <>
            <Button variant="outline" onClick={syncRoles} disabled={isFetching}>
              <i className={clsx('ti ti-refresh text-base', isFetching && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
            <Button variant="primary" onClick={openCreate}>
              <i className="ti ti-plus text-sm" />
              New role
            </Button>
          </>
        }
      />

      <DataTable
        tableKey={TABLE_KEY}
        schema={schema}
        rows={pagedRows}
        meta={tableMeta}
        state={{ ...tableState, page: currentPage }}
        loading={isLoading}
        refetching={isFetching && !isLoading}
        onStateChange={setTableState}
        onRowAction={handleRowAction}
      />

      {drawerMode && (
        <Drawer
          title={drawerMode === 'edit' ? `Edit ${form.display_name}` : 'New role'}
          subtitle="Choose exactly what this role can view and do"
          widthClass="max-w-2xl"
          onClose={closeDrawer}
          footer={
            <>
              <Button variant="outline" onClick={closeDrawer}>Cancel</Button>
              <Button variant="primary" onClick={submit} disabled={saving}>
                {saving ? 'Saving...' : drawerMode === 'edit' ? 'Save changes' : 'Create role'}
              </Button>
            </>
          }
        >
          <div>
            <Label required>Display name</Label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm((c) => ({ ...c, display_name: e.target.value }))}
              placeholder="e.g. Regional Manager"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              placeholder="What is this role for?"
            />
          </div>

          <div>
            <Label>Default landing page</Label>
            <Select
              value={form.landing_menu}
              onChange={(e) => setForm((c) => ({ ...c, landing_menu: e.target.value }))}
            >
              <option value="">Dashboard (default)</option>
              {LANDING_PAGE_OPTIONS.map(({ menu, label }) => (
                <option key={menu} value={menu}>{label}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-ink-faint">Where this role&rsquo;s users land right after logging in.</p>
          </div>

          <div>
            <Label>Permissions</Label>
            <div className="mt-2 space-y-4">
              {groupNames.map((groupName) => (
                <div key={groupName} className="rounded-xl border border-line p-4">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">{groupName}</h4>
                  <div className="space-y-3">
                    {groupEntriesByMenu(registry[groupName]).map(({ menu, label, entries }) => {
                      const allChecked = entries.every((entry) => form.permissions.includes(entry.key))
                      return (
                        <div key={menu} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <span className="w-40 flex-shrink-0 text-xs font-semibold text-ink-soft">{label}</span>
                          <Checkbox
                            label="All"
                            checked={allChecked}
                            onChange={(e) => toggleAllInMenu(entries, e.target.checked)}
                          />
                          {entries.map((entry) => (
                            <Checkbox
                              key={entry.key}
                              label={formatActionLabel(entry.action)}
                              checked={form.permissions.includes(entry.key)}
                              onChange={() => togglePermission(entry.key)}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Drawer>
      )}

      {deletingRole && (
        <AlertConfirmation
          title="Delete role?"
          message={`"${deletingRole.display_name}" will be permanently removed. This cannot be undone.`}
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingRole(null)}
          onConfirm={confirmDelete}
        />
      )}
    </PageShell>
  )
}
