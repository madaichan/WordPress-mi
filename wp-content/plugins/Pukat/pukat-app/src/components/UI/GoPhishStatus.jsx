import React from 'react'
import clsx from 'clsx'
import { useGophishStatus } from '../hooks/useGophishStatus.js'

export default function GoPhishStatus({ collapsed = false }) {
  const { label, dotColor } = useGophishStatus()

  if (collapsed) {
    return (
      <div title={label} className="flex items-center justify-center">
        <span className={clsx('w-2.5 h-2.5 rounded-full', dotColor)} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-1">
      <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
      <span className="text-xs text-gray-500 truncate">{label}</span>
    </div>
  )
}
