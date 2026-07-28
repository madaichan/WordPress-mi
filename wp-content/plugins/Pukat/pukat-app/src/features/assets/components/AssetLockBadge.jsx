export default function AssetLockBadge({ locked, reason }) {
  if (!locked) return null

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700"
      title={reason}
    >
      <i className="ti ti-lock text-[10px]" />
      Locked
    </span>
  )
}
