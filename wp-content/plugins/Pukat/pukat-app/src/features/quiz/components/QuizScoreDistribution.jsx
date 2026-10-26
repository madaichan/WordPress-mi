import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import { ChartTooltip, SERIES } from './chartTheme.jsx'

/**
 * How the scores are spread, 20 points per bar.
 *
 * One series, so one hue and no legend — the heading names it. Deliberately
 * NOT coloured pass/fail: the bar that straddles the pass mark would have to
 * be painted one way or the other and would lie either way, so the pass mark
 * is stated in words instead and `passRate` carries that story in the summary
 * cards above.
 */
export default function QuizScoreDistribution({ buckets = [], passScore = 70, total = 0 }) {
  if (total === 0) {
    return (
      <section className="rounded-xl border border-line bg-panel p-5">
        <Header passScore={passScore} />
        <EmptyState icon="ti-chart-histogram" title="Nothing to plot yet" description="Scores appear here once answers are graded." />
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <Header passScore={passScore} />
      <div className="mt-4 h-56 w-full text-line-strong">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 16, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.5} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'currentColor' }}
              tick={{ className: 'fill-ink-muted', fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ className: 'fill-ink-muted', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ className: 'fill-panel-muted', fillOpacity: 0.5 }}
              content={<ChartTooltip />}
            />
            <Bar dataKey="count" name="Submissions" fill={SERIES.score} radius={[4, 4, 0, 0]} maxBarSize={48}>
              <LabelList dataKey="count" position="top" className="fill-ink-muted" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function Header({ passScore }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink">Score distribution</h3>
      <p className="text-[11px] text-ink-faint">
        Submissions per score range. The pass mark applied to these answers is {passScore}%.
      </p>
    </div>
  )
}
