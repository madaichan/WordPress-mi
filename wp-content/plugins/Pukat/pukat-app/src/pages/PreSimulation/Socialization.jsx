import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Card from '../../components/UI/Card.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Textarea from '../../components/UI/Textarea.jsx'
import Button from '../../components/UI/Button.jsx'

export default function Socialization() {
  return (
    <PageShell animated={false}>
      <PageHeader title="Pre-Simulation Socialization" subtitle="Notify users before the simulation begins" />
      <Card>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 text-2xl"><i className="ti ti-mail" /></div>
          <div><p className="text-sm font-semibold text-gray-800">Email Socialization</p><p className="text-xs text-gray-500">Send awareness email to all targets before simulation launch</p></div>
        </div>
        <div className="space-y-3">
          <div><Label>Subject</Label><Input placeholder="[Security Awareness] Upcoming Phishing Simulation Notice" /></div>
          <div><Label>Message</Label><Textarea rows={5} placeholder="Dear Team,&#10;&#10;We will be conducting a phishing simulation exercise between [date] and [date]..." /></div>
          <div><Label>Schedule</Label><Input type="datetime-local" /></div>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="primary"><i className="ti ti-send" /> Schedule Send</Button>
        </div>
      </Card>
      <Card className="bg-amber-50 border-amber-100">
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
      </Card>
    </PageShell>
  )
}
