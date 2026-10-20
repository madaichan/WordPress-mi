import { useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import Button, { IconButton } from './Button.jsx'
import { getPukatRoleLabel } from '../../utils/roles.js'
import Portal from './Portal.jsx'

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
    <Portal>
      <div
        className="fixed inset-0 z-50 flex justify-end bg-gray-950/40 backdrop-blur-sm"
        onMouseDown={event => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <aside className="flex h-full w-full max-w-md flex-col bg-panel shadow-2xl">
          <header className="flex items-start gap-3 border-b border-line-soft p-5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <i className="ti ti-user-check text-base" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink">Assign {resourceLabel}</h2>
              <p className="mt-0.5 truncate text-xs text-ink-muted">{item.name}</p>
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
                    mode === key ? 'border-violet-300 bg-violet-500/10' : 'border-line bg-panel hover:bg-panel-subtle'
                  )}
                >
                  <span className={clsx(
                    'flex h-4 w-4 items-center justify-center rounded-full border',
                    mode === key ? 'border-violet-500 bg-violet-500' : 'border-line-strong'
                  )}>
                    {mode === key && <span className="h-1.5 w-1.5 rounded-full bg-panel" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="block text-xs text-ink-muted">{desc}</span>
                  </span>
                </button>
              ))}
            </section>

            {mode === 'specific' && (
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Users</div>
                  <div className="text-[10px] font-semibold text-ink-faint">{selected.length} selected</div>
                </div>
                <div className="relative mb-3">
                  <i className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)}
                    placeholder="Search users..."
                    className="w-full rounded-xl border border-line bg-panel py-2 pl-9 pr-9 text-sm text-ink outline-none transition-all placeholder:text-ink-faint focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-panel-subtle hover:text-ink-soft"
                      aria-label="Clear user search"
                    >
                      <i className="ti ti-x text-sm" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {filteredUsers.map(user => (
                    <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-soft p-3 hover:bg-panel-subtle">
                      <input
                        type="checkbox"
                        checked={selected.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="rounded border-line-strong text-violet-500 focus:ring-violet-500"
                      />
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-700 dark:text-violet-300">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
                        <span className="block truncate text-xs text-ink-muted">{user.email}</span>
                      </span>
                      {showUserRole && user.role && (
                        <span className="ml-auto hidden text-[10px] font-semibold text-ink-faint sm:block">
                          {getPukatRoleLabel(user.role)}
                        </span>
                      )}
                    </label>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs font-medium text-ink-faint">
                      No users found.
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <footer className="flex items-center gap-3 border-t border-line-soft bg-panel-subtle p-5">
            <Button onClick={onClose} className="ml-auto">Cancel</Button>
            <Button onClick={save} variant="primary">
              <i className="ti ti-device-floppy" />
              Save assignment
            </Button>
          </footer>
        </aside>
      </div>
    </Portal>
  )
}
