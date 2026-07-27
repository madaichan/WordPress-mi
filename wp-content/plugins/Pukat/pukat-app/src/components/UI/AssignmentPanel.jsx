import { useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import Button, { IconButton } from './Button.jsx'
import { getPukatRoleLabel } from '../../utils/roles.js'

export default function AssignmentPanel({
  item,
  resourceLabel = 'asset',
  users,
  onClose,
  onSave,
  showUserRole = true,
}) {
  const [mode, setMode] = useState(item.assignedTo ?? 'all')
  const [selected, setSelected] = useState(item.users ?? [])
  const [searchQuery, setSearchQuery] = useState('')

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return users

    return users.filter(user => {
      const roleLabel = getPukatRoleLabel(user.role)
      const text = [
        user.name,
        user.email,
        user.entity,
        roleLabel,
      ].filter(Boolean).join(' ').toLowerCase()

      return text.includes(query)
    })
  }, [searchQuery, users])

  function toggleUser(userId) {
    setSelected(current => (
      current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId]
    ))
  }

  function save() {
    if (mode === 'specific' && selected.length === 0) {
      toast.error('Choose at least one user or assign to all users.')
      return
    }

    onSave({
      assignedTo: mode,
      users: mode === 'all' ? [] : selected,
    })
  }

  const options = [
    ['all', 'All users', `Everyone with access can use this ${resourceLabel}.`],
    ['specific', 'Specific users', `Only selected users can use this ${resourceLabel}.`],
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-gray-950/40 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-gray-100 p-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <i className="ti ti-user-check text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-gray-900">Assign {resourceLabel}</h2>
            <p className="mt-0.5 truncate text-xs text-gray-500">{item.name}</p>
          </div>
          <IconButton label="Close assignment panel" onClick={onClose}>
            <i className="ti ti-x text-base" />
          </IconButton>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section className="space-y-2">
            {options.map(([key, title, desc]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                  mode === key ? 'border-violet-300 bg-violet-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                )}
              >
                <span className={clsx(
                  'flex h-4 w-4 items-center justify-center rounded-full border',
                  mode === key ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
                )}>
                  {mode === key && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{title}</span>
                  <span className="block text-xs text-gray-500">{desc}</span>
                </span>
              </button>
            ))}
          </section>

          {mode === 'specific' && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Users</div>
                <div className="text-[10px] font-semibold text-gray-400">{selected.length} selected</div>
              </div>
              <div className="relative mb-3">
                <i className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search users..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                    aria-label="Clear user search"
                  >
                    <i className="ti ti-x text-sm" />
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {filteredUsers.map(user => (
                  <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selected.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="rounded border-gray-300 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">{user.name}</span>
                      <span className="block truncate text-xs text-gray-500">{user.email}</span>
                    </span>
                    {showUserRole && user.role && (
                      <span className="ml-auto hidden text-[10px] font-semibold text-gray-400 sm:block">
                        {getPukatRoleLabel(user.role)}
                      </span>
                    )}
                  </label>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-xs font-medium text-gray-400">
                    No users found.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 p-5">
          <Button onClick={onClose} className="ml-auto">Cancel</Button>
          <Button onClick={save} variant="primary">
            <i className="ti ti-device-floppy" />
            Save assignment
          </Button>
        </footer>
      </aside>
    </div>
  )
}
