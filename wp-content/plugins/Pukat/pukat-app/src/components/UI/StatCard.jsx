import React from 'react'

export default function StatCard({ icon, iconBg, iconColor, label, value, sub, trend }) {
  return (
    <div className="stat-card card-hover cursor-default">
      <div className={`stat-icon ${iconBg}`}>
        <i className={`ti ${icon} text-xl ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-tight">
          {value ?? <span className="inline-block w-12 h-6 bg-gray-100 rounded animate-pulse" />}
        </p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  )
}
