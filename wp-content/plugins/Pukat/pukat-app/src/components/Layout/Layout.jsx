import React from 'react'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import useAppStore from '../../store/useAppStore.js'
import clsx from 'clsx'

export default function Layout({ children }) {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const sidebarW  = collapsed ? 'w-16' : 'w-[220px]'

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content — offset by sidebar width */}
      <div
        className={clsx('flex flex-col flex-1 transition-all duration-300', collapsed ? 'ml-16' : 'ml-[220px]')}
        style={{ minHeight: '100vh' }}
      >
        <Header />
        <main className="flex-1 p-6 overflow-y-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
