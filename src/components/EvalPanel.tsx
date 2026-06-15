import { useState } from 'react'
import { ChevronRight, FlaskConical, Plus, Trash2 } from 'lucide-react'
import { useEvalStore } from '../store/evalStore'

function badgeColor(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function statusDot(status: string): string {
  switch (status) {
    case 'pass':
      return 'bg-green-500'
    case 'partial':
      return 'bg-yellow-500'
    case 'fail':
      return 'bg-red-500'
    default:
      return 'bg-gray-600'
  }
}

export function EvalPanel() {
  const evalOpen = useEvalStore((s) => s.evalOpen)
  const setEvalOpen = useEvalStore((s) => s.setEvalOpen)
  const testCases = useEvalStore((s) => s.testCases)
  const addTestCase = useEvalStore((s) => s.addTestCase)
  const removeTestCase = useEvalStore((s) => s.removeTestCase)
  const runs = useEvalStore((s) => s.runs)
  const lastRun = runs.length > 0 ? runs[runs.length - 1] : null

  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const [expectedOutput, setExpectedOutput] = useState('')
  const [description, setDescription] = useState('')

  const resetForm = () => {
    setAdding(false)
    setInput('')
    setExpectedOutput('')
    setDescription('')
  }

  const handleSave = () => {
    if (input.trim() === '' || expectedOutput.trim() === '') return
    addTestCase({
      input: input.trim(),
      expectedOutput: expectedOutput.trim(),
      description: description.trim() || undefined,
    })
    resetForm()
  }

  return (
    <div
      className={`fixed right-0 top-12 bottom-12 z-20 flex w-80 flex-col border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ${
        evalOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <FlaskConical size={13} className="text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
          Eval Suite
        </span>
        <button
          onClick={() => setEvalOpen(false)}
          aria-label="Close eval panel"
          className="ml-auto rounded-md p-0.5 text-gray-500 hover:text-gray-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Test Cases ({testCases.length})
            </span>
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-gray-300 hover:border-accent/50 hover:text-white"
              >
                <Plus size={10} />
                Add
              </button>
            )}
          </div>

          {adding && (
            <div className="mb-3 rounded-md border border-white/10 bg-canvas p-2">
              <label className="mb-1 block text-[10px] text-gray-500">
                Input
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={2}
                className="mb-2 w-full resize-none rounded border border-white/10 bg-surface px-2 py-1 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
              />
              <label className="mb-1 block text-[10px] text-gray-500">
                Expected output (substring)
              </label>
              <input
                value={expectedOutput}
                onChange={(e) => setExpectedOutput(e.target.value)}
                className="mb-2 w-full rounded border border-white/10 bg-surface px-2 py-1 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
              />
              <label className="mb-1 block text-[10px] text-gray-500">
                Description (optional)
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mb-2 w-full rounded border border-white/10 bg-surface px-2 py-1 text-[11px] text-gray-200 focus:border-accent/50 focus:outline-none"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleSave}
                  className="rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-black hover:opacity-90"
                >
                  Save
                </button>
                <button
                  onClick={resetForm}
                  className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-300 hover:border-accent/50 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {testCases.length === 0 && !adding && (
            <p className="rounded border border-dashed border-white/10 px-2 py-3 text-center text-[10px] text-gray-600">
              No test cases yet. Add one to grade each run.
            </p>
          )}

          <ul className="space-y-1">
            {testCases.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded border border-white/5 bg-canvas px-2 py-1.5"
              >
                <span className="flex-1 truncate text-[11px] text-gray-300">
                  {t.description ?? t.input}
                </span>
                <button
                  onClick={() => removeTestCase(t.id)}
                  aria-label="Remove test case"
                  className="text-gray-600 hover:text-red-400"
                >
                  <Trash2 size={11} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {lastRun && (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Last Run
            </div>
            <div className="mb-3 flex items-baseline gap-2 rounded-md border border-white/10 bg-canvas px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                Quality
              </span>
              <span
                className={`text-2xl font-bold tabular-nums ${badgeColor(lastRun.qualityScore)}`}
              >
                {lastRun.qualityScore}
              </span>
              <span className="text-[11px] text-gray-500">/100</span>
            </div>
            <ul className="space-y-1">
              {lastRun.results.map((r) => {
                const tc = testCases.find((t) => t.id === r.testCaseId)
                const label = tc?.description ?? tc?.input ?? r.testCaseId
                return (
                  <li
                    key={r.testCaseId}
                    className="flex items-center gap-2 rounded border border-white/5 bg-canvas px-2 py-1"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(r.status)}`}
                    />
                    <span className="flex-1 truncate text-[11px] text-gray-300">
                      {label}
                    </span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums text-gray-400">
                      {r.score.toFixed(1)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
