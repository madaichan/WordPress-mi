import clsx from 'clsx'

export default function Checkbox({ label, className, ...props }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2">
      <input
        type="checkbox"
        className={clsx('rounded border-line-strong text-violet-500 focus:ring-violet-500', className)}
        {...props}
      />
      {label && <span className="text-sm text-ink-soft">{label}</span>}
    </label>
  )
}
