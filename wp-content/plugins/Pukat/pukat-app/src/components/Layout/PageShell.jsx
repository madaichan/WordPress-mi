import clsx from 'clsx'

export default function PageShell({
  as: Component = 'div',
  children,
  className,
  animated = true,
  spacing = 'space-y-6',
  ...props
}) {
  return (
    <Component
      {...props}
      className={clsx(
        'mt-4 min-w-0 lg:flex lg:min-h-[calc(100vh-110px)] lg:flex-col',
        spacing,
        animated && 'animate-fade-in',
        className
      )}
    >
      {children}
    </Component>
  )
}
