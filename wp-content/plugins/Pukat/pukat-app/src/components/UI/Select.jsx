import clsx from 'clsx'

export default function Select({ error, errorMessage, className, children, ...props }) {
  return (
    <>
      <div className="relative">
        <select
          className={clsx('input appearance-none pr-9', error && 'input-error', className)}
          {...props}
        >
          {children}
        </select>
        <i className="ti ti-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
      </div>
      {errorMessage && <p className="mt-1 text-xs text-danger">{errorMessage}</p>}
    </>
  )
}
