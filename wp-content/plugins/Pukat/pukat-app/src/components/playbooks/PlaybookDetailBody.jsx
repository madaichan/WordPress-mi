/**
 * Read-only detail sections for one playbook: header + tags, stats, technical
 * components, difficulty, attack scenario, and insights.
 *
 * Extracted from the `DetailPanel` of `features/setup/playbooks/Playbooks.jsx`
 * so the Campaign Wizard playbook picker can show the same detail in a modal.
 * Page-specific buttons stay with the caller and come in through `actions`.
 */

import clsx from 'clsx'
import HtmlThumbnail from '../../features/assets/components/HtmlThumbnail.jsx'
import { playbookDisplayStatus } from '../../utils/masterAssetHelpers.js'
import { CATEGORY_TAG, DIFFICULTY_TAG, STATUS_TAG } from '../../utils/playbookUiModel.js'

export function Tag({ children, className }) {
  return (
    <span className={clsx('inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold', className)}>
      {children}
    </span>
  )
}

export function StatMini({ label, value, sub, color }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold" style={{ color }}>{sub}</div>
    </div>
  )
}

export function ComponentRow({ component, onPreview }) {
  const canPreview = component.type === 'email' || component.type === 'page'
  const livePreviewHtml = component.preview?.html
  const hasLivePreview = canPreview && Boolean(livePreviewHtml && livePreviewHtml.trim())

  return (
    <div className="flex h-full items-center gap-3 rounded-lg border border-gray-100 bg-white p-3">
      <span
        className="flex h-11 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100"
        style={hasLivePreview ? undefined : { backgroundColor: component.bg }}
      >
        {hasLivePreview ? (
          <HtmlThumbnail html={livePreviewHtml} className="h-full w-full" />
        ) : (
          <i className={clsx('ti text-[13px]', component.icon)} style={{ color: component.color }} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-gray-800">{component.name}</span>
        <span className="mt-0.5 block text-xs leading-snug text-gray-500">{component.sub}</span>
      </span>
      {canPreview && (
        <button
          type="button"
          onClick={() => onPreview(component)}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
        >
          <i className="ti ti-eye" />
          Preview
        </button>
      )}
      <span
        className="hidden flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline-flex"
        style={{ backgroundColor: component.bg, color: component.color }}
      >
        {component.badge}
      </span>
    </div>
  )
}

/**
 * Wide variant of ComponentRow for the components that carry a rendered
 * preview (email template and landing page), so the thumbnail is large enough
 * to read instead of the 14x11 chip used by the compact rows.
 */
export function ComponentPreviewCard({ component, onPreview }) {
  const livePreviewHtml = component.preview?.html
  const hasLivePreview = Boolean(livePreviewHtml && livePreviewHtml.trim())

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-100 bg-white">
      <div className="relative h-40 flex-shrink-0 border-b border-gray-100">
        {hasLivePreview ? (
          <HtmlThumbnail html={livePreviewHtml} className="h-full w-full" />
        ) : (
          <span className="flex h-full w-full items-center justify-center" style={{ backgroundColor: component.bg }}>
            <i className={clsx('ti text-2xl', component.icon)} style={{ color: component.color }} />
          </span>
        )}
        <span
          className="absolute left-2 top-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm"
          style={{ backgroundColor: component.bg, color: component.color }}
        >
          {component.badge}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-gray-800">{component.name}</div>
          <div className="mt-0.5 text-xs leading-snug text-gray-500">{component.sub}</div>
        </div>
        <button
          type="button"
          onClick={() => onPreview(component)}
          className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
        >
          <i className="ti ti-eye" />
          Preview
        </button>
      </div>
    </div>
  )
}

export function DifficultyBlock({ playbook }) {
  const score = Number(playbook.diffScore.charAt(0))

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex-shrink-0">
        <div className="mb-1.5 text-[10px] font-semibold text-gray-500">PhishScale NIST</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(bar => (
            <span
              key={bar}
              className={clsx(
                'h-1.5 w-5 rounded-full',
                bar <= score ? 'bg-red-500' : 'bg-gray-200'
              )}
            />
          ))}
        </div>
        <div className="mt-1 text-[11px] font-semibold text-red-700">{playbook.diffText}</div>
      </div>
      <p className="border-gray-200 text-xs leading-relaxed text-gray-600 sm:border-l sm:pl-4">
        {playbook.nistInfo}
      </p>
    </div>
  )
}

export default function PlaybookDetailBody({ playbook, onPreviewComponent, actions = null }) {
  const difficulty = playbook.diffScore.charAt(0)
  const components = playbook.components ?? []
  const previewComponents = components.filter(component => component.type === 'email' || component.type === 'page')
  const plainComponents = components.filter(component => component.type !== 'email' && component.type !== 'page')

  return (
    <>
      <div className="space-y-4 border-b border-gray-100 pb-5">
        <div className="flex items-start gap-4">
          <span
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: playbook.iconBg }}
          >
            <i className={clsx('ti text-xl', playbook.iconName)} style={{ color: playbook.iconColor }} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900">{playbook.name}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{playbook.longDesc}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {playbook.source === 'api' && (
            <Tag className={STATUS_TAG[playbookDisplayStatus(playbook.status)] ?? 'bg-gray-100 text-gray-700'}>
              {playbookDisplayStatus(playbook.status)}
            </Tag>
          )}
          <Tag className={CATEGORY_TAG[playbook.category] ?? 'bg-gray-100 text-gray-700'}>{playbook.category}</Tag>
          <Tag className={DIFFICULTY_TAG[difficulty] ?? 'bg-gray-100 text-gray-700'}>Difficulty {playbook.diffScore}</Tag>
          {playbook.deptTag.map(tag => (
            <Tag key={tag} className="bg-gray-100 text-gray-700">{tag}</Tag>
          ))}
          <Tag className="bg-violet-100 text-violet-800">GoPhish</Tag>
          {playbook.editLocked && (
            <Tag className="bg-red-50 text-red-700">
              <i className="ti ti-lock mr-1 text-[10px]" />
              Locked
            </Tag>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatMini label="Used" value={playbook.usedCount} sub="since Jan 2025" color="#6C63FF" />
        <StatMini label="Avg click rate" value={playbook.clickAvg} sub={playbook.clickSub} color="#EF4444" />
        <StatMini label="Avg submit rate" value={playbook.submitAvg} sub={playbook.submitSub} color="#F59E0B" />
      </div>

      <div className="mt-6 border-b border-gray-100 pb-5">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Technical components</h3>
        {previewComponents.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {previewComponents.map(component => (
              <ComponentPreviewCard key={`${playbook.id}-${component.type}`} component={component} onPreview={onPreviewComponent} />
            ))}
          </div>
        )}
        {plainComponents.length > 0 && (
          <div className={clsx('space-y-2', previewComponents.length > 0 && 'mt-3')}>
            {plainComponents.map(component => (
              <ComponentRow key={`${playbook.id}-${component.type}`} component={component} onPreview={onPreviewComponent} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-b border-gray-100 pb-5">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Difficulty level</h3>
        <DifficultyBlock playbook={playbook} />
      </div>

      <div className="mt-6 border-b border-gray-100 pb-5">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Attack scenario</h3>
        <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-4">
          <div className="mb-1 text-xs font-bold text-violet-800">Narrative shown to the target</div>
          <p className="text-xs leading-relaxed text-gray-600">{playbook.scenarioText}</p>
        </div>
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-semibold text-gray-500">Vulnerable targets</div>
          <div className="flex flex-wrap gap-1.5">
            {playbook.deptTag.map(target => (
              <Tag key={`${playbook.id}-${target}`} className="bg-gray-100 text-gray-700">{target}</Tag>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-bold text-gray-900">Insights from previous simulations</h3>
        <div className="space-y-3">
          {playbook.insights.map(insight => (
            <div key={insight.text} className="flex items-start gap-3">
              <i className={clsx('ti mt-0.5 text-lg', insight.icon)} style={{ color: insight.color }} />
              <div>
                <div className="text-xs font-semibold text-gray-800">{insight.text}</div>
                <div className="mt-0.5 text-[11px] text-gray-500">{insight.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
