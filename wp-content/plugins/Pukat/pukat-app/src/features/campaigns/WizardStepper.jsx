import clsx from 'clsx'

const WIZARD_STEPS = ['Preparation', 'Performing', 'Review & launch']

export default function WizardStepper({ step, onStepChange }) {
  const progress = ((step - 1) / (WIZARD_STEPS.length - 1)) * 100

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="relative flex items-center justify-between w-full px-12 sm:px-24">
        <div className="absolute left-20 right-20 sm:left-32 sm:right-32 top-4 h-0.5 bg-panel-strong z-0">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {WIZARD_STEPS.map((label, i) => {
          const done = i + 1 < step
          const current = i + 1 === step
          return (
            <button
              key={label}
              type="button"
              onClick={() => onStepChange?.(i + 1)}
              className="flex flex-col items-center z-10 focus:outline-none"
            >
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300',
                done && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
                current && 'bg-violet-500 text-white',
                !done && !current && 'bg-panel-muted text-ink-faint border border-line',
              )}>
                {done ? <i className="ti ti-check text-base" /> : i + 1}
              </div>
              <span className={clsx(
                'text-xs mt-2 transition-all duration-300',
                done && 'font-semibold text-emerald-700 dark:text-emerald-300',
                current && 'font-semibold text-violet-500',
                !done && !current && 'font-medium text-ink-faint',
              )}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
