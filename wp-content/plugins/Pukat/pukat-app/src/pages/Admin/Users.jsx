import React, { useState } from 'react'
import { useAuditLogs, useUsers } from '../../hooks/queries/useUserQueries.js'
import { useUpdateUserRoleMutation } from '../../hooks/mutations/useUserMutations.js'
import { ROLE_LABELS, ROLE_VALUES, getPukatRoleBadge, normalizePukatRole } from '../../utils/roles.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import Input from '../../components/UI/Input.jsx'
import Card from '../../components/UI/Card.jsx'
import Table from '../../components/UI/Table.jsx'
import Badge from '../../components/UI/Badge.jsx'
import EmptyState from '../../components/UI/EmptyState.jsx'

const TABS = [
  { key: 'users', label: 'User Roles' },
  { key: 'audit', label: 'Audit Log' },
]

export default function Users() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('users')

  const { data: usersData, isLoading } = useUsers({ search, per_page: 50 })
  const { data: logs = [] } = useAuditLogs({ limit: 50 }, {
    enabled: activeTab === 'audit',
  })

  const roleMutation = useUpdateUserRoleMutation()

  const users = usersData?.users || []

  return (
    <div className="space-y-4 animate-fade-in mt-4">
      <PageHeader title="User Access" subtitle="Manage roles and permissions" />

      <Tabs items={TABS} active={activeTab} onChange={setActiveTab} className="mb-4" />

      {activeTab === 'users' && (
        <>
          <Input className="max-w-xs" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          <Card className="p-0">
            <Table>
              <thead><tr><th>User</th><th>Email</th><th>Pukat Role</th><th>Change Role</th></tr></thead>
              <tbody>
                {isLoading ? [...Array(5)].map((_,i) => <tr key={i}>{[...Array(4)].map((_,j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>) :
                users.map(u => {
                  const role = normalizePukatRole(u.pukat_role)

                  return (
                    <tr key={u.id}>
                      <td><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">{u.display_name?.charAt(0)}</div><span className="font-medium">{u.display_name}</span></div></td>
                      <td className="text-gray-500">{u.email}</td>
                      <td><Badge tone={getPukatRoleBadge(role).replace('badge-', '')}>{ROLE_LABELS[role]}</Badge></td>
                      <td>
                        <select className="input py-1 text-xs w-auto" value={role} onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}>
                          {ROLE_VALUES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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
        <Card className="p-0">
          <Table>
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Object</th><th>IP</th></tr></thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i}>
                  <td className="text-xs text-gray-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="text-xs">{l.user_email}</td>
                  <td><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{l.action}</code></td>
                  <td className="text-xs text-gray-500">{l.object_type}{l.object_id ? ` #${l.object_id}` : ''}</td>
                  <td className="text-xs text-gray-400">{l.ip_address}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5}><EmptyState title="No audit logs yet." /></td></tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
