import clsx from 'clsx'

/**
 * SidebarBrand.jsx
 *
 * The "Flow beyond" logo block shown at the top of both the Admin sidebar
 * (Sidebar.jsx, collapsible) and Frontend sidebar (FrontendLayout.jsx, fixed).
 *
 * Extracted because both sidebars had this block copy-pasted with slightly
 * different icon size/color and container padding — those differences are
 * preserved exactly via props rather than standardized away, since unifying
 * the visual style was not part of this refactor.
 */
export default function SidebarBrand({
  className,
  iconClassName,
  textClassName,
  collapsed = false,
  toggle,
  toggleTitle,
}) {
  return (
    <div className={className}>
      <i className={clsx('ti ti-shield-alert flex-shrink-0', iconClassName)} />
      {!collapsed && <span className={textClassName}>Flow beyond</span>}
      {toggle && (
        <button
          onClick={toggle}
          className={clsx('ml-auto text-gray-500 hover:text-gray-300 transition-colors p-1 rounded', collapsed && 'mx-auto')}
          title={toggleTitle}
        >
          <i className={clsx('ti', collapsed ? 'ti-layout-sidebar-right' : 'ti-layout-sidebar')} />
        </button>
      )}
    </div>
  )
}
