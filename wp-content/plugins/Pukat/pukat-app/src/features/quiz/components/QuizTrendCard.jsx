import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Badge from '../../../components/UI/Badge.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import { ChartTooltip, SERIES } from './chartTheme.jsx'

// How a run's targets got to the quiz. Education-only runs never offered one
// and so never reach this table (PRD §13.11).
const VIA_LABEL = {
  direct: 'Simulation → quiz',
  education: 'Simulation → education → quiz',
}

/**
 * Is understanding improving? Average score and pass rate per campaign run,
 * oldest run first.
 *
 * Only runs that chain into a quiz appear — a simulation that stopped at
 * education is not this page's business, and counting it would drag
 * participation down with people who were never offered a quiz.
 *
 * Both series are percentages, so they share one y-axis — the submission and
 * reach counts, which are a different scale entirely, go in the table below
 * rather than onto a second axis. The table is also the chart's text
 * equivalent, so the trend is never colour-only.
 *
 * A run where nobody answered breaks the line instead of plotting a zero: no
 * answers is a delivery problem, and a zero would read as "everyone failed".
 */
export default function QuizTrendCard({ trend = [] }) {
  const scored = trend.filter(point => point.avgScore !== null)

  return (
    <section className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">Per campaign run</h3>
        <p className="text-[11px] text-ink-faint">
          Average score and pass rate of each run&apos;s answers, oldest first. A gap means that run was never
          answered. Only runs whose chain leads to a quiz are counted.
        </p>
      </div>

      {trend.length === 0 ? (
        <EmptyState
          icon="ti-trending-up"
          title="No quiz-linked runs yet"
          description="A run shows up here once it chains into a quiz, directly or through an education page."
        />
      ) : (
        <>
          {scored.length > 0 && (
            <div className="h-64 w-full text-line-strong">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 16, bottom: 0, left: -24 }}>
                  <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: 'currentColor' }}
                    tick={{ className: 'fill-ink-muted', fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={value => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                    tick={{ className: 'fill-ink-muted', fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip suffix="%" />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="plainline"
                    wrapperStyle={{ paddingBottom: 8, fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    name="Average score"
                    stroke={SERIES.score}
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 0, fill: SERIES.score }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="passRate"
                    name="Pass rate"
                    stroke={SERIES.passRate}
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 0, fill: SERIES.passRate }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-ink-soft">
              <thead>
                <tr className="border-b border-line text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  <th className="py-2 pr-3">Run</th>
                  <th className="py-2 pr-3">Linkage</th>
                  <th className="py-2 pr-3">Reached the quiz</th>
                  <th className="py-2 pr-3">Finished</th>
                  <th className="py-2 pr-3">Participation</th>
                  <th className="py-2 pr-3">Avg score</th>
                  <th className="py-2">Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {[...trend].reverse().map(point => (
                  <tr key={point.runId} className="border-b border-line-soft last:border-0">
                    <td className="py-2 pr-3 text-ink">{point.name}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={point.via === 'education' ? 'info' : 'violet'}>{VIA_LABEL[point.via]}</Badge>
                    </td>
                    <td className="py-2 pr-3">{point.reached}</td>
                    <td className="py-2 pr-3">{point.completed}</td>
                    <td className="py-2 pr-3">{point.participation}%</td>
                    <td className="py-2 pr-3">{point.avgScore === null ? '—' : `${point.avgScore}%`}</td>
                    <td className="py-2">{point.passRate === null ? '—' : `${point.passRate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
