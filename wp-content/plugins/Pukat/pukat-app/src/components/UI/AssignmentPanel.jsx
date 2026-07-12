import { useState } from 'react'
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
  const [mode, setMode] = useState(item.assignedTo)
  const [selected, setSelected] = useState(item.users)

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
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Users</div>
              <div className="space-y-2">
                {users.map(user => (
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
