import clsx from 'clsx'

export default function Table({ wrapperClassName, className, children, ...props }) {
  return (
    <div className={clsx('table-wrapper', wrapperClassName)}>
      <table className={clsx('table', className)} {...props}>
        {children}
      </table>
    </div>
  )
}
