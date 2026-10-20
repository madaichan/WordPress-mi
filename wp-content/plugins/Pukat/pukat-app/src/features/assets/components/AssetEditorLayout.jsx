import clsx from 'clsx'

export default function AssetEditorLayout({ fileName, lineCount, lineCountLabel = 'lines', elevated = false, children }) {
  return (
    <div className={clsx('flex flex-col overflow-hidden rounded-xl border border-line bg-panel lg:col-span-3', elevated && 'shadow-sm')}>
      <div className="flex items-center justify-between border-b border-line bg-panel-subtle px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
          <span className="ml-2 font-mono text-ink-muted">{fileName}</span>
        </div>
        <div className="flex items-center gap-3 text-ink-muted">
          <span className="select-none">{lineCount} {lineCountLabel}</span>
          <span className="select-none text-ink-faint">HTML Source</span>
        </div>
      </div>
      {children}
    </div>
  )
}
