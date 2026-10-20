import clsx from 'clsx'

export default function AssetCreateCard({ label, icon = 'ti-plus', onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex h-80 cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-panel p-5 text-ink-faint transition-all hover:border-line-strong hover:text-ink-muted"
    >
      <i className={clsx('ti text-3xl', icon)} />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}
