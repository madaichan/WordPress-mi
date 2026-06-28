import React, { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gophishApi } from '../api/index.js'
import useAppStore from '../store/useAppStore.js'
import clsx from 'clsx'

export default function GoPhishStatus({ collapsed = false }) {
  const status = useAppStore((s) => s.gophishStatus)
  const setStatus = useAppStore((s) => s.setGophishStatus)

  // Ping GoPhish every 60s
  const { data, isLoading, isError } = useQuery({
    queryKey: ['gophish-status'],
    queryFn: gophishApi.status,
    refetchInterval: 60_000,
    retry: false,
  })

  useEffect(() => {
    if (isLoading)         setStatus('checking')
    else if (isError)      setStatus('disconnected')
    else if (data)         setStatus('connected')
    else                   setStatus('disconnected')
  }, [isLoading, isError, data, setStatus])

  const label = status === 'connected'
    ? 'GoPhish connected'
    : status === 'checking'
    ? 'Checking...'
    : 'GoPhish offline'

  const dotColor = status === 'connected'
    ? 'bg-success animate-pulse'
    : status === 'checking'
    ? 'bg-warning animate-pulse'
    : 'bg-danger'

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
