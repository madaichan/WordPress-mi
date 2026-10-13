import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useFlagExamples } from '../../hooks/queries/useFlagQueries.js'
import Tabs from '../../components/UI/Tabs.jsx'
import EntityFlagExamplesPanel from './EntityFlagExamplesPanel.jsx'
import EntityFlagPageEditor from './EntityFlagPageEditor.jsx'

const SUBTABS = [
  { key: 'page', label: 'Education Page', icon: 'ti-edit' },
  { key: 'images', label: 'Images', icon: 'ti-photo' },
]

/**
 * The My Profile > Flags tab: author the entity's single education page
 * (Education Page sub-tab) or manage its example images per category (Images
 * sub-tab) — docs/PRD_FLAG_EDUCATION_PAGES.md. One page per entity, so there
 * is no category switcher: the editor's image picker selects which example
 * images to insert.
 */
export default function EntityFlagsPanel({ adminEntity = null, canManageExamples = false, canEditPage = false, canPublishPage = false }) {
  const params = useMemo(() => (adminEntity ? { entity: adminEntity } : {}), [adminEntity])
  const { data: exampleData } = useFlagExamples(params)
  const examples = useMemo(() => exampleData?.examples || [], [exampleData])

  const [subTab, setSubTab] = useState('page')
  const [dirty, setDirty] = useState(false)

  // Warn when leaving the browser tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined
    const warnOnLeave = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warnOnLeave)
    return () => window.removeEventListener('beforeunload', warnOnLeave)
  }, [dirty])

  const handleDirtyChange = useCallback(value => setDirty(Boolean(value)), [])

  return (
    <div className="space-y-4">
      <Tabs items={SUBTABS} active={subTab} onChange={setSubTab} ariaLabel="Flag sections" />

      {/* Stays mounted behind the Images tab so unsaved edits survive the switch. */}
      <div className={clsx(subTab === 'images' && 'hidden')}>
        <EntityFlagPageEditor
          examples={examples}
          adminEntity={adminEntity}
          canEdit={canEditPage}
          canPublish={canPublishPage}
          onDirtyChange={handleDirtyChange}
        />
      </div>

      {subTab === 'images' && (
        <EntityFlagExamplesPanel canManage={canManageExamples} adminEntity={adminEntity} />
      )}
    </div>
  )
}
