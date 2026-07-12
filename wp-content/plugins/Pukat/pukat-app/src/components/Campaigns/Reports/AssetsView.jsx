import clsx from 'clsx'
import { Link } from 'react-router-dom'

const EMAIL_TEMPLATES = [
  { name: 'Microsoft Office 365 alert', desc: 'Security-login email style with an urgent password update request.', meta: 'sender: security@microsoft-update.net' },
  { name: 'Google security notification', desc: 'Reports an unknown login from a new device.', meta: 'sender: support@google-help.com' },
  { name: 'Internal HR payroll info', desc: 'New-quarter payroll notification email with an attached document link.', meta: 'sender: payroll@internal-company.id' },
]

const LANDING_PAGES = [
  { name: 'Microsoft account authentication', desc: 'Cloned login form for the corporate Outlook 365 email portal.', badge: 'high-risk', cls: 'bg-red-100 text-red-700' },
  { name: 'Google login SSO interface', desc: 'Cloned single sign-on authentication form for Google Workspace.', badge: 'high-risk', cls: 'bg-red-100 text-red-700' },
  { name: 'Awareness instruction guide', desc: 'Instant education landing page after a user clicks a phishing link.', badge: 'low', cls: 'bg-emerald-100 text-emerald-700' },
]

export default function AssetsView({ onNew }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Campaign assets</h2>
        <p className="text-sm text-gray-500 mt-0.5">Playbooks, email templates, and landing pages for simulations.</p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Playbooks</h3>
          <Link to="/setup/playbooks" className="text-xs font-semibold text-violet-500 hover:text-violet-600">Manage playbooks</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { badge: 'wordpress-plugin', cls: 'bg-indigo-100 text-indigo-700', title: 'New hire training', desc: 'Automated simulation for new employees in their first 30 days.' },
            { badge: 'gophish', cls: 'bg-amber-100 text-amber-700', title: 'Finance spear phishing', desc: 'Transfer-fraud or account-update scenario for finance staff.' },
            { badge: 'wordpress-plugin', cls: 'bg-indigo-100 text-indigo-700', title: 'Executive impersonation', desc: 'Spoofed executive email that appears to come from company leadership.' },
          ].map(item => (
            <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between h-48">
              <div>
                <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', item.cls)}>{item.badge}</span>
                <h4 className="text-base font-semibold text-gray-900 mt-2">{item.title}</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
              </div>
              <button onClick={onNew} className="text-xs font-semibold text-violet-500 hover:text-violet-600 text-left">Use playbook →</button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Email templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {EMAIL_TEMPLATES.map(template => (
            <div key={template.name} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between h-40">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{template.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{template.desc}</p>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">{template.meta}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Landing pages</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {LANDING_PAGES.map(page => (
            <div key={page.name} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between h-40">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">{page.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{page.desc}</p>
              </div>
              <span className={clsx('rounded-full text-xs font-semibold px-2 py-0.5 w-fit', page.cls)}>{page.badge}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
