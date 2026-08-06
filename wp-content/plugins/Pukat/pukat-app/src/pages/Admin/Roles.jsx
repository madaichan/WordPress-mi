import { useState } from 'react'
import toast from 'react-hot-toast'
import PageShell from '../../components/Layout/PageShell.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Card from '../../components/UI/Card.jsx'
import Table from '../../components/UI/Table.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import TableActionButton from '../../components/UI/TableActionButton.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import Input from '../../components/UI/Input.jsx'
import Label from '../../components/UI/Label.jsx'
import Textarea from '../../components/UI/Textarea.jsx'
import Checkbox from '../../components/UI/Checkbox.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import EmptyState from '../../components/UI/EmptyState.jsx'
import { useRoles, usePermissionRegistry } from '../../hooks/queries/useRoleQueries.js'
import { useCreateRoleMutation, useUpdateRoleMutation, useDeleteRoleMutation } from '../../hooks/mutations/useRoleMutations.js'

const EMPTY_FORM = { display_name: '', description: '', permissions: [] }

function formatActionLabel(action) {
  return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ')
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
  const { data: roles = [], isLoading } = useRoles()
  const { data: registry = {} } = usePermissionRegistry()

  const [drawerMode, setDrawerMode] = useState(null) // 'create' | 'edit'
  const [editingSlug, setEditingSlug] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deletingRole, setDeletingRole] = useState(null)

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

  return (
    <PageShell>
      <PageHeader
        title="Roles"
        subtitle="Create roles and control exactly what each one can see and do"
        actions={
          <Button variant="primary" onClick={openCreate}>
            <i className="ti ti-plus text-sm" />
            New role
          </Button>
        }
      />

      <Card className="p-0">
        <Table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Description</th>
              <th>Type</th>
              <th>Users</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-gray-400">Loading roles...</td>
              </tr>
            )}
            {!isLoading && roles.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="No roles yet" description="Create your first custom role to get started." />
                </td>
              </tr>
            )}
            {!isLoading && roles.map((role) => {
              const canDelete = !role.is_system_role && role.user_count === 0
              const deleteTitle = role.is_system_role
                ? 'System roles cannot be deleted'
                : role.user_count > 0
                  ? `${role.user_count} user(s) still assigned to this role`
                  : 'Delete'

              return (
                <tr key={role.role_slug}>
                  <td className="font-medium text-gray-900">{role.display_name}</td>
                  <td className="text-gray-500">{role.description || '—'}</td>
                  <td>
                    <Badge tone={role.is_system_role ? 'violet' : 'gray'}>
                      {role.is_system_role ? 'System' : 'Custom'}
                    </Badge>
                  </td>
                  <td className="text-gray-500">{role.user_count}</td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <TableActionButton icon="ti-edit" label="Edit" onClick={() => openEdit(role)} />
                      <TableActionButton
                        icon="ti-trash"
                        label="Delete"
                        tone="red"
                        disabled={!canDelete}
                        title={deleteTitle}
                        onClick={() => setDeletingRole(role)}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

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
            <Label>Permissions</Label>
            <div className="mt-2 space-y-4">
              {groupNames.map((groupName) => (
                <div key={groupName} className="rounded-xl border border-gray-200 p-4">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">{groupName}</h4>
                  <div className="space-y-3">
                    {groupEntriesByMenu(registry[groupName]).map(({ menu, label, entries }) => {
                      const allChecked = entries.every((entry) => form.permissions.includes(entry.key))
                      return (
                        <div key={menu} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <span className="w-40 flex-shrink-0 text-xs font-semibold text-gray-700">{label}</span>
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
