import React from 'react'

export default function Socialization() {
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="page-header">
        <div><h1 className="page-title">Pre-Simulation Socialization</h1><p className="page-subtitle">Notify users before the simulation begins</p></div>
      </div>
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 text-2xl"><i className="ti ti-mail" /></div>
          <div><p className="text-sm font-semibold text-gray-800">Email Socialization</p><p className="text-xs text-gray-500">Send awareness email to all targets before simulation launch</p></div>
        </div>
        <div className="space-y-3">
          <div><label className="label">Subject</label><input className="input" placeholder="[Security Awareness] Upcoming Phishing Simulation Notice" /></div>
          <div><label className="label">Message</label><textarea className="input" rows={5} placeholder="Dear Team,&#10;&#10;We will be conducting a phishing simulation exercise between [date] and [date]..." /></div>
          <div><label className="label">Schedule</label><input type="datetime-local" className="input" /></div>
        </div>
        <div className="flex justify-end mt-4">
          <button className="btn btn-primary"><i className="ti ti-send" /> Schedule Send</button>
        </div>
      </div>
      <div className="card bg-amber-50 border-amber-100">
        <div className="flex items-start gap-3">
          <i className="ti ti-alert-triangle text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Acceptance Criteria</p>
            <ul className="text-xs text-amber-700 mt-1 space-y-1 list-disc list-inside">
              <li>At least 80% user reach before simulation launch</li>
              <li>Audit log of delivery per recipient</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
