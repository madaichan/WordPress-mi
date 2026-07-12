import React, { useState } from 'react'
import clsx from 'clsx'
import { useAuditLogs, useUsers } from '../../hooks/queries/useUserQueries.js'
import { useUpdateUserRoleMutation } from '../../hooks/mutations/useUserMutations.js'
import { ROLE_LABELS, ROLE_VALUES, getPukatRoleBadge, normalizePukatRole } from '../../utils/roles.js'

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
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">User Access</h1><p className="page-subtitle">Manage roles and permissions</p></div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {['users', 'audit'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={clsx('px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize', activeTab===t ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t === 'users' ? 'User Roles' : 'Audit Log'}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <>
          <input className="input max-w-xs" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="card p-0">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>User</th><th>Email</th><th>Pukat Role</th><th>Change Role</th></tr></thead>
                <tbody>
                  {isLoading ? [...Array(5)].map((_,i) => <tr key={i}>{[...Array(4)].map((_,j) => <td key={j}><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>) :
                  users.map(u => {
                    const role = normalizePukatRole(u.pukat_role)

                    return (
                      <tr key={u.id}>
                        <td><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">{u.display_name?.charAt(0)}</div><span className="font-medium">{u.display_name}</span></div></td>
                        <td className="text-gray-500">{u.email}</td>
                        <td><span className={clsx('badge', getPukatRoleBadge(role))}>{ROLE_LABELS[role]}</span></td>
                        <td>
                          <select className="input py-1 text-xs w-auto" value={role} onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}>
                            {ROLE_VALUES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'audit' && (
        <div className="card p-0">
          <div className="table-wrapper">
            <table className="table">
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
                {logs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No audit logs yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
