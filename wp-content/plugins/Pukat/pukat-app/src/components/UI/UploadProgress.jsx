import clsx from 'clsx'

function formatSize(bytes) {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Two-phase upload indicator: `uploading` shows real transfer progress,
 * `processing` covers the server-side work after the last byte is sent
 * (which can take a while for large images), with an elapsed-time counter so
 * a long wait doesn't look like a hang.
 */
export default function UploadProgress({ fileName, fileSize, percent = 0, phase = 'uploading', elapsedSeconds = 0, processingHint }) {
  const isProcessing = phase === 'processing'

  return (
    <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs">
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <span className="min-w-0 flex-1 truncate font-semibold text-violet-700">
          {isProcessing ? 'Processing on the server…' : `Uploading… ${percent}%`}
        </span>
        <span className="shrink-0 tabular-nums text-violet-500">{elapsedSeconds}s</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
        <div
          className={clsx('h-full rounded-full bg-violet-500 transition-all duration-300', isProcessing && 'animate-pulse')}
          style={{ width: `${isProcessing ? 100 : percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-violet-600">
        <span className="truncate">{fileName}{fileSize ? ` · ${formatSize(fileSize)}` : ''}</span>
        {isProcessing && processingHint && <span className="shrink-0">{processingHint}</span>}
      </div>
    </div>
  )
}
