import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'

const DAYS = [
  26, 27, 28, 29, 30, 31, 1,
  2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29,
  30, 1, 2, 3, 4, 5, 6,
]

export default function Calendar() {
  const navigate = useNavigate()

  return (
    <PageShell animated={false}>
      <PageHeader
        title="Simulation calendar"
        subtitle="Phishing simulation delivery schedule — June 2025"
        actions={
          <Button variant="primary" onClick={() => navigate('/campaigns')}>
            <i className="ti ti-circle-plus" />
            New campaign
          </Button>
        }
      />

      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-ink-muted border-b border-line-soft pb-3 mb-3">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2 min-h-96">
          {DAYS.map((day, index) => {
            const muted = index < 6 || index > 34
            const q2 = index >= 23 && index <= 30
            const bec = index === 33
            return (
              <div
                key={`${day}-${index}`}
                className={clsx(
                  'border rounded-lg p-2 text-xs font-medium relative min-h-14',
                  muted && 'border-line-soft text-ink-faint bg-panel-subtle',
                  !muted && !q2 && !bec && 'border-line text-ink-soft bg-panel',
                  q2 && 'border-blue-500/30 bg-blue-50/50 text-blue-900 dark:text-blue-300',
                  bec && 'border-line bg-panel-subtle/50 text-ink-soft',
                )}
              >
                {day}
                {q2 && <div className="absolute bottom-1 left-1 right-1 bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[9px] px-1 rounded truncate font-semibold">Q2 phishing</div>}
                {bec && <div className="absolute bottom-1 left-1 right-1 bg-panel-muted text-ink-muted text-[9px] px-1 rounded truncate font-semibold">BEC scenario</div>}
              </div>
            )
          })}
        </div>
      </div>
    </PageShell>
  )
}
