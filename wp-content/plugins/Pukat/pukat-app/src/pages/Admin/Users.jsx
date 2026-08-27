import React, { useState } from 'react'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { useUpdateUserRoleMutation } from '../../hooks/mutations/useUserMutations.js'
import { useRoles } from '../../hooks/queries/useRoleQueries.js'
import { DataTable } from '../../components/DataTable/index.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import Input from '../../components/UI/Input.jsx'
import Card from '../../components/UI/Card.jsx'
import Table from '../../components/UI/Table.jsx'
import Badge from '../../components/UI/Badge.jsx'

const TABS = [
  { key: 'users', label: 'User Roles' },
  { key: 'audit', label: 'Audit Log' },
]

const AUDIT_TABLE_KEY = 'audit_logs'
const DEFAULT_AUDIT_TABLE_STATE = { search: '', sort: 'created_at', order: 'desc', page: 1, perPage: 50, filters: {} }

export default function Users() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('users')
  const [auditTableState, setAuditTableState] = useState(DEFAULT_AUDIT_TABLE_STATE)

  const { data: usersData, isLoading } = useUsers({ search, per_page: 50 })

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

  return (
    <PageShell spacing="space-y-4">
      <PageHeader title="User Access" subtitle="Manage roles and permissions" />

      <Tabs items={TABS} active={activeTab} onChange={setActiveTab} className="mb-4" />

      {activeTab === 'users' && (
        <>
          <Input className="max-w-xs" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          <Card className="p-0">
            <Table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Entity</th>
                  <th>Change Role</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? [...Array(5)].map((_, i) => <tr key={i}>{[...Array(5)].map((_, j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>) :
                  users.map(u => {
                    const role = u.pukat_role || 'none'
                    const name = u.display_name || u.username || u.email || `User ${u.id}`
                    const initial = name.charAt(0).toUpperCase()

                    return (
                      <tr key={u.id}>
                        <td className="font-medium text-gray-900">{u.username || '-'}</td>
                        <td><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">{initial}</div><span className="font-medium text-gray-900">{name}</span></div></td>
                        <td className="text-gray-500">{u.email}</td>
                        <td>{u.entity ? <Badge tone="gray">{u.entity}</Badge> : <span className="font-medium text-gray-900">-</span>}</td>
                        <td>
                          <select className="input py-1 font-medium text-gray-500 w-auto" value={role} onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}>
                            <option value="none">No Access</option>
                            {roles.map(r => <option key={r.role_slug} value={r.role_slug}>{r.display_name}</option>)}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </Table>
          </Card>
        </>
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
