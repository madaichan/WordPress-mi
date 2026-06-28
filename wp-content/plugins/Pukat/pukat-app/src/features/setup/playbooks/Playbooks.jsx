import { Link } from 'react-router-dom'
import clsx from 'clsx'

const PLAYBOOKS = [
  {
    source: 'wordpress-plugin',
    badge: 'bg-indigo-100 text-indigo-700',
    title: 'New hire training',
    desc: 'Automated simulation for new employees registered in WordPress within their first 30 days.',
  },
  {
    source: 'gophish',
    badge: 'bg-amber-100 text-amber-700',
    title: 'Finance spear phishing',
    desc: 'Transfer-fraud or account-update scenario targeting finance staff.',
  },
  {
    source: 'wordpress-plugin',
    badge: 'bg-indigo-100 text-indigo-700',
    title: 'Executive impersonation',
    desc: 'Spoofed executive email requesting urgent action.',
  },
]

export default function Playbooks() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Playbooks</h1>
        <p className="text-sm text-gray-500 mt-0.5">Automated campaign templates based on common attack patterns</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLAYBOOKS.map(playbook => (
          <div key={playbook.title} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between h-48">
            <div>
              <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', playbook.badge)}>
                {playbook.source}
              </span>
              <h3 className="text-base font-semibold text-gray-900 mt-2">{playbook.title}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{playbook.desc}</p>
            </div>
            <Link to="/campaigns" className="text-xs font-semibold text-violet-500 hover:text-violet-600 text-left">
              Use playbook →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
