import clsx from 'clsx'

export default function AssetCreateCard({ label, icon = 'ti-plus', onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex h-80 cursor-pointer select-none flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white p-5 text-gray-400 transition-all hover:border-gray-300 hover:text-gray-600"
    >
      <i className={clsx('ti text-3xl', icon)} />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}
