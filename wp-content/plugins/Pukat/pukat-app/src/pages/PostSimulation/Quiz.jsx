import { useState } from 'react'

export default function Quiz() {
  const [result, setResult] = useState(null)

  const submitAnswer = (correct) => {
    setResult(correct
      ? { ok: true, text: 'Correct. Ignore suspicious emails and verify through official internal channels.' }
      : { ok: false, text: 'Not quite. Do not click links or reply to suspicious emails. Verify through IT or the official portal.' })
  }

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quiz</h1>
        <p className="text-sm text-gray-500 mt-0.5">Cybersecurity evaluation mini quiz</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            If you receive an email urgently asking you to update your password through a special link, what is the best action?
          </h3>
          <div className="flex flex-col gap-2 pt-2">
            <button onClick={() => submitAnswer(false)} className="text-left px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-medium transition-all">
              A. Click the link immediately and change the password as soon as possible.
            </button>
            <button onClick={() => submitAnswer(true)} className="text-left px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-medium transition-all">
              B. Ignore the email, then contact internal IT or check the official company portal separately.
            </button>
            <button onClick={() => submitAnswer(false)} className="text-left px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-medium transition-all">
              C. Reply to the email and ask the sender whether it is legitimate.
            </button>
          </div>
          {result && (
            <div className={result.ok
              ? 'text-xs rounded-xl p-4 mt-3 bg-emerald-50 text-emerald-800 border border-emerald-100'
              : 'text-xs rounded-xl p-4 mt-3 bg-red-50 text-red-800 border border-red-100'}
            >
              {result.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
