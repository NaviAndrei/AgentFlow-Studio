import { ChevronRight, CircleDollarSign } from 'lucide-react'
import { useState } from 'react'
import { useLLMConfigStore } from '../store/llmConfigStore'
import { useSimulationMetricsStore } from '../store/simulationMetricsStore'
import { useUIStore } from '../store/uiStore'
import type { RunCostSummary } from '../types'

const NODE_COLOR: Record<string, string> = {
  start: '#16a34a',
  llm: '#7c3aed',
  agent: '#4f46e5',
  tool: '#ea580c',
  memory: '#0891b2',
  output: '#dc2626',
  condition: '#ca8a04',
  router: '#65a30d',
  guardrail: '#be123c',
  evaluator: '#ca8a04',
  loop: '#475569',
  humanInLoop: '#db2777',
  supervisor: '#b45309',
  swarmWorker: '#0d9488',
}

function formatUsd(value: number): string {
  if (value === 0) return '$0.0000'
  if (value < 0.001) return `$${value.toFixed(5)}`
  return `$${value.toPrecision(4)}`
}

/** Per-node cost bars + totals; reused by CostPanel (live) and RunHistoryPanel (snapshot). */
export function CostBreakdown({ summary }: { summary: RunCostSummary }) {
  return (
    <>
      {summary.entries.length === 0 && (
        <p className="rounded border border-dashed border-white/10 px-2 py-3 text-center text-[10px] text-gray-600">
          No LLM-class nodes ran in this flow.
        </p>
      )}
      {summary.entries.map((e) => {
        const entries = summary.entries
        const pct =
          summary.totalCostUsd > 0
            ? (e.estimatedCostUsd / summary.totalCostUsd) * 100
            : 100 / Math.max(entries.length, 1)
        const color = NODE_COLOR[e.nodeType] ?? '#7c3aed'
        return (
          <div key={e.nodeId} className="mb-2">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] text-gray-300">{e.nodeName}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
                {e.tokensIn + e.tokensOut} tok
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(pct, 1)}%`,
                  backgroundColor: color,
                  minWidth: 2,
                }}
              />
            </div>
            <div className="mt-0.5 text-right text-[10px] tabular-nums text-gray-500">
              {formatUsd(e.estimatedCostUsd)}
            </div>
          </div>
        )
      })}
      <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-gray-300">
        <span className="tabular-nums">{summary.totalTokens.toLocaleString()} tokens</span>
        <span className="font-semibold tabular-nums text-accent">
          {formatUsd(summary.totalCostUsd)}
        </span>
      </div>
    </>
  )
}

function BudgetGuardSection() {
  const budgetConfig = useLLMConfigStore((s) => s.budgetConfig)
  const setBudgetConfig = useLLMConfigStore((s) => s.setBudgetConfig)
  const costUsd = useSimulationMetricsStore((s) => s.costUsd)
  const [maxUSD, setMaxUSD] = useState(budgetConfig.maxUSD?.toString() ?? '')
  const [maxTokens, setMaxTokens] = useState(budgetConfig.maxTokens?.toString() ?? '')

  const pct = budgetConfig.maxUSD ? Math.min((costUsd / budgetConfig.maxUSD) * 100, 100) : 0
  const barColor = pct >= 100 ? '#dc2626' : pct >= 80 ? '#ca8a04' : '#16a34a'

  return (
    <div className="mb-3 border-b border-white/10 pb-3">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-300">
        Budget Guard
      </span>
      <label className="mb-2 block">
        <span className="text-[10px] text-gray-500">Max USD</span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={maxUSD}
          onChange={(e) => setMaxUSD(e.target.value)}
          className="mt-0.5 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-200"
        />
      </label>
      <label className="mb-2 block">
        <span className="text-[10px] text-gray-500">Max Tokens</span>
        <input
          type="number"
          min={0}
          step={1}
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          className="mt-0.5 w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-200"
        />
      </label>
      <button
        onClick={() =>
          setBudgetConfig({
            maxUSD: maxUSD.trim() === '' ? undefined : Number(maxUSD),
            maxTokens: maxTokens.trim() === '' ? undefined : Number(maxTokens),
          })
        }
        className="mb-2 w-full rounded bg-accent/20 py-1 text-[11px] font-medium text-accent hover:bg-accent/30"
      >
        Save
      </button>
      {budgetConfig.maxUSD != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: barColor }}
          />
        </div>
      )}
    </div>
  )
}

export function CostPanel() {
  const open = useUIStore((s) => s.costPanelOpen)
  const setOpen = useUIStore((s) => s.setCostPanelOpen)
  const summary = useSimulationMetricsStore((s) => s.costSummary)

  return (
    <div
      className={`fixed right-0 top-12 bottom-0 z-20 flex w-80 flex-col border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <CircleDollarSign size={13} className="text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
          Cost &amp; Tokens
        </span>
        {summary && summary.model && (
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
            {summary.model}
          </span>
        )}
        <button
          onClick={() => setOpen(false)}
          aria-label="Close cost panel"
          className="ml-auto rounded-md p-0.5 text-gray-500 hover:text-gray-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <BudgetGuardSection />
        {!summary && (
          <p className="rounded border border-dashed border-white/10 px-2 py-3 text-center text-[10px] text-gray-600">
            Run the flow to see cost breakdown.
          </p>
        )}
        {summary && <CostBreakdown summary={summary} />}
      </div>
    </div>
  )
}
