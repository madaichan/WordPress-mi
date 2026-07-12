import { useGophishStatusQuery } from './queries/useGophishQueries.js'

/**
 * useGophishStatus.js
 *
 * Polls GoPhish connectivity every 60s and derives the display label/dot
 * color for it. Extracted from GoPhishStatus.jsx to separate the polling/
 * business logic from rendering.
 *
 * Status is derived directly from the query result each render — it used to
 * be mirrored into a global Zustand field (`gophishStatus`), but nothing
 * outside this hook ever read that field, so the mirror was redundant global
 * state for a value TanStack Query's own cache already provides.
 *
 * @returns {{ status: 'checking'|'connected'|'disconnected', label: string, dotColor: string }}
 */
export function useGophishStatus() {
  const { data, isLoading, isError } = useGophishStatusQuery({
    refetchInterval: 60_000,
    retry: false,
  })

  const status = isLoading ? 'checking' : (isError || !data) ? 'disconnected' : 'connected'

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

  return { status, label, dotColor }
}
