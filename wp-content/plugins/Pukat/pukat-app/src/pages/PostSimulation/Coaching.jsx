export default function Coaching() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Coaching</h1>
        <p className="text-sm text-gray-500 mt-0.5">Post-simulation awareness education and coaching program</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-xl">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Active education modules</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
            <div>
              <h4 className="text-xs font-semibold text-gray-900">Recognizing spoofed sender domains</h4>
              <p className="text-[10px] text-gray-400">Audience: High-risk users (42 enrolled)</p>
            </div>
            <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700">running</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-gray-900">The importance of two-factor authentication (2FA)</h4>
              <p className="text-[10px] text-gray-400">Audience: All staff</p>
            </div>
            <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700">done</span>
          </div>
        </div>
      </div>
    </div>
  )
}
