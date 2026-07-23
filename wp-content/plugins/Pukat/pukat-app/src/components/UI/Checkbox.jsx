import clsx from 'clsx'

export default function Checkbox({ label, className, ...props }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2">
      <input
        type="checkbox"
        className={clsx('rounded border-gray-300 text-violet-500 focus:ring-violet-500', className)}
        {...props}
      />
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  )
}
