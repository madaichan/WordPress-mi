import { Fragment, useState } from 'react'
import Badge from '../../../components/UI/Badge.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'

/**
 * Admin overview of every quiz across all entities (Quiz Builder v2, §13): who
 * uses each quiz and how much. Two notions of "used by":
 *  - linkage: live GoPhish campaigns routed into the quiz master (chain).
 *  - results: participants / attempts / campaign runs recorded locally.
 *
 * Presentational: it renders the rows the page hands it.
 */
export default function QuizOverviewPanel({ quizzes = [], gophishOk = true }) {
  const [expanded, setExpanded] = useState(null)

  if (quizzes.length === 0) {
    return <EmptyState icon="ti-list-search" title="No quizzes yet" description="Quizzes built by any entity will appear here." />
  }

  return (
    <div className="space-y-3">
      {!gophishOk && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-ink-soft">
          GoPhish could not be reached, so chain linkage counts are unavailable. Local results below are still accurate.
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-semibold">Quiz</th>
              <th className="px-3 py-2 font-semibold">Entity</th>
              <th className="px-3 py-2 font-semibold">Template</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold" title="Simulations that end at this quiz, direct or through the education page">Linkage</th>
              <th className="px-3 py-2 text-right font-semibold" title="Distinct people with a recorded result">Participants</th>
              <th className="px-3 py-2 text-right font-semibold" title="Campaign runs that recorded results">Runs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {quizzes.map(q => (
              <Fragment key={q.id}>
                <tr className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-ink">{q.title || 'Untitled quiz'}</div>
                    {q.is_default_followup && <Badge tone="violet">Default follow-up</Badge>}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{q.entity_name}</td>
                  <td className="px-3 py-2 text-ink-soft">
                    {q.template_name || <span className="text-ink-faint">— legacy HTML</span>}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={q.status === 'published' ? 'success' : 'gray'}>{q.status === 'published' ? 'Published' : 'Draft'}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {/* Both routes that end at this quiz: direct + via education. */}
                    {q.linkage_count + (q.education_chain?.campaign_count || 0) > 0 ? (
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                        className="font-mono font-semibold text-violet-600 hover:underline dark:text-violet-400"
                        title="Show how simulations reach this quiz"
                      >
                        {q.linkage_count + (q.education_chain?.campaign_count || 0)}
                      </button>
                    ) : (
                      <span className="font-mono text-ink-faint">{gophishOk ? 0 : '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-soft">{q.participants}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-soft">{q.runs}</td>
                </tr>
                {expanded === q.id && (
                  <tr>
                    <td colSpan={7} className="bg-panel-subtle/50 px-3 py-2">
                      {q.linkage_count > 0 && (
                        <>
                          <p className="mb-1 text-[11px] font-semibold text-ink-soft">Simulation → quiz ({q.linkage_count})</p>
                          <ul className="space-y-1">
                            {(q.linked_campaigns || []).map(c => (
                              <li key={c.id} className="flex items-center gap-2 text-[11px]">
                                <Badge tone="violet">sim → quiz</Badge>
                                <span className="text-ink">{c.name}</span>
                                <span className="text-ink-faint">· {c.status}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {q.education_chain?.campaign_count > 0 && (
                        <>
                          <p className="mt-2 mb-1 text-[11px] font-semibold text-ink-soft">
                            Simulation → education → quiz ({q.education_chain.campaign_count})
                          </p>
                          <ul className="space-y-1">
                            {(q.education_chain.campaigns || []).map(c => (
                              <li key={c.id} className="flex items-center gap-2 text-[11px]">
                                <Badge tone="gray">via education</Badge>
                                <span className="text-ink">{c.name}</span>
                                <span className="text-ink-faint">· {c.status}</span>
                              </li>
                            ))}
                          </ul>
                          {q.education_chain.education_only_count > 0 && (
                            <p className="mt-1 text-[11px] text-ink-faint">
                              {q.education_chain.education_only_count} further campaign(s) chain to that education page without quiz follow-up — not counted here.
                            </p>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-faint">
        <span className="font-semibold">Linkage</span> = simulations that end at this quiz, either straight away or through the education page (click a number for both lists); simulations that only asked for education are left out.
        <span className="ml-1 font-semibold">Participants / Runs</span> come from recorded quiz results (includes manual invites).
      </p>
    </div>
  )
}
