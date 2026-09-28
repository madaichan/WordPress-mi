import React, { useMemo, useState } from 'react'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { useUpdateUserRoleMutation } from '../../hooks/mutations/useUserMutations.js'
import { useRoles } from '../../hooks/queries/useRoleQueries.js'
import { DataTable } from '../../components/DataTable/index.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import Badge from '../../components/UI/Badge.jsx'

const TABS = [
  { key: 'users', label: 'User Roles' },
  { key: 'audit', label: 'Audit Log' },
]

const USERS_TABLE_KEY = 'users'
const DEFAULT_USERS_TABLE_STATE = { search: '', sort: 'name', order: 'asc', page: 1, perPage: 25, filters: {} }
const AUDIT_TABLE_KEY = 'audit_logs'
const DEFAULT_AUDIT_TABLE_STATE = { search: '', sort: 'created_at', order: 'desc', page: 1, perPage: 50, filters: {} }

export default function Users() {
  const [usersTableState, setUsersTableState] = useState(DEFAULT_USERS_TABLE_STATE)
  const [activeTab, setActiveTab] = useState('users')
  const [auditTableState, setAuditTableState] = useState(DEFAULT_AUDIT_TABLE_STATE)

  // The users endpoint already searches and paginates server-side (ordered by display name),
  // it just isn't registered in the generic Table API — so drive it from the DataTable state.
  const { data: usersData, isLoading, isFetching: isFetchingUsers } = useUsers(
    { search: usersTableState.search, page: usersTableState.page, per_page: usersTableState.perPage },
    { placeholderData: previous => previous }
  )

  const { data: auditSchema } = useTableSchema(AUDIT_TABLE_KEY, { enabled: activeTab === 'audit' })
  const { data: auditRowsData, isLoading: isLoadingAuditRows, isFetching: isFetchingAuditRows } = useTableRows(AUDIT_TABLE_KEY, {
    search: auditTableState.search,
    sort: auditTableState.sort,
    order: auditTableState.order,
    page: auditTableState.page,
    per_page: auditTableState.perPage,
    filters: auditTableState.filters,
  }, { enabled: activeTab === 'audit' })

  const roleMutation = useUpdateUserRoleMutation()
  const { data: roles = [] } = useRoles()

  const users = usersData?.users || []
  const usersMeta = {
    total: usersData?.total,
    per_page: usersData?.per_page ?? usersTableState.perPage,
    has_next: (usersData?.page ?? 1) < (usersData?.last_page ?? 1),
  }

  const usersSchema = useMemo(() => ({
    search: { placeholder: 'Search users...' },
    columns: [
      {
        key: 'username',
        label: 'Username',
        renderer: 'custom',
        render: u => <span className="font-semibold text-gray-900">{u.username || '-'}</span>,
      },
      {
        key: 'name',
        label: 'Name',
        renderer: 'custom',
        render: u => {
          const name = u.display_name || u.username || u.email || `User ${u.id}`
          return (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-gray-900">{name}</span>
            </div>
          )
        },
      },
      {
        key: 'email',
        label: 'Email',
        renderer: 'custom',
        render: u => <span className="text-gray-500">{u.email}</span>,
      },
      {
        key: 'entity',
        label: 'Entity',
        renderer: 'custom',
        render: u => u.entity
          ? <Badge tone="gray" className="text-[10px]">{u.entity}</Badge>
          : <span className="text-gray-300">—</span>,
      },
      {
        key: 'role',
        label: 'Change Role',
        renderer: 'custom',
        render: u => (
          <select
            className="input w-auto py-1 font-medium text-gray-500"
            value={u.pukat_role || 'none'}
            onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}
          >
            <option value="none">No Access</option>
            {roles.map(r => <option key={r.role_slug} value={r.role_slug}>{r.display_name}</option>)}
          </select>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [roles])

  return (
    <PageShell spacing="space-y-4">
      <PageHeader title="User Access" subtitle="Manage roles and permissions" />

      <Tabs items={TABS} active={activeTab} onChange={setActiveTab} className="mb-4" />

      {activeTab === 'users' && (
        <DataTable
          tableKey={USERS_TABLE_KEY}
          schema={usersSchema}
          rows={users}
          meta={usersMeta}
          state={usersTableState}
          loading={isLoading}
          refetching={isFetchingUsers && !isLoading}
          onStateChange={setUsersTableState}
        />
      )}

      {activeTab === 'audit' && (
        <DataTable
          tableKey={AUDIT_TABLE_KEY}
          schema={auditSchema}
          rows={auditRowsData?.rows || []}
          meta={auditRowsData?.meta}
          state={auditTableState}
          loading={isLoadingAuditRows}
          refetching={isFetchingAuditRows}
          onStateChange={setAuditTableState}
        />
      )}
    </PageShell>
  )
}
