import { useState } from 'react'
import { ChevronRight, Plug, Plus, Trash2 } from 'lucide-react'
import { useMCPStore } from '../store/mcpStore'
import { useUIStore } from '../store/uiStore'
import type { MCPServerConfig } from '../types'

function StatusDot({ isConnected }: { isConnected?: boolean }) {
  if (isConnected === true) return <span className="h-2 w-2 rounded-full bg-green-500" title="Connected" />
  if (isConnected === false) return <span className="h-2 w-2 rounded-full bg-red-500" title="Unreachable" />
  return <span className="h-2 w-2 rounded-full bg-gray-600" title="Not tested" />
}

const inputCls =
  'w-full rounded-md border border-white/10 bg-surface-2 px-2 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 outline-none focus:border-accent/60'
const labelCls = 'mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-gray-500'

interface AddFormState {
  serverKey: string
  label: string
  endpointUrl: string
  authToken: string
  description: string
}

const emptyForm = (): AddFormState => ({
  serverKey: '',
  label: '',
  endpointUrl: '',
  authToken: '',
  description: '',
})

export function MCPServersPanel() {
  const open = useUIStore((s) => s.mcpPanelOpen)
  const toggleMcpPanel = useUIStore((s) => s.toggleMcpPanel)
  const servers = useMCPStore((s) => s.servers)
  const addServer = useMCPStore((s) => s.addServer)
  const removeServer = useMCPStore((s) => s.removeServer)
  const testConnection = useMCPStore((s) => s.testConnection)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AddFormState>(emptyForm)
  const [testing, setTesting] = useState<string | null>(null)

  const serverList = Object.values(servers)

  const handleSave = () => {
    const key = form.serverKey.trim()
    const label = form.label.trim()
    const url = form.endpointUrl.trim()
    if (!key || !label || !url) return
    const config: MCPServerConfig = {
      serverKey: key,
      label,
      endpointUrl: url,
      authToken: form.authToken.trim() || undefined,
      description: form.description.trim() || undefined,
    }
    addServer(config)
    setForm(emptyForm())
    setShowForm(false)
    setTesting(key)
    void testConnection(key).finally(() => setTesting(null))
  }

  const handleTest = (serverKey: string) => {
    setTesting(serverKey)
    void testConnection(serverKey).finally(() => setTesting(null))
  }

  return (
    <div
      className={`fixed right-0 top-12 bottom-0 z-20 flex w-80 flex-col border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
      }`}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <Plug size={13} className="text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300">
          MCP Servers
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          title="Add server"
          className="ml-auto rounded-md border border-white/10 p-1 text-gray-400 hover:border-accent/50 hover:text-white"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={toggleMcpPanel}
          aria-label="Close MCP Servers panel"
          className="rounded-md p-0.5 text-gray-500 hover:text-gray-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Inline add form */}
        {showForm && (
          <div className="rounded-lg border border-white/10 bg-surface-2 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              New Server
            </p>
            <label className="block">
              <span className={labelCls}>Server Key (unique id)</span>
              <input
                className={inputCls}
                value={form.serverKey}
                onChange={(e) => setForm((f) => ({ ...f, serverKey: e.target.value }))}
                placeholder="e.g. my-mcp"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Display Name</span>
              <input
                className={inputCls}
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="My MCP Server"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Endpoint URL</span>
              <input
                className={inputCls}
                value={form.endpointUrl}
                onChange={(e) => setForm((f) => ({ ...f, endpointUrl: e.target.value }))}
                placeholder="http://localhost:8000"
              />
            </label>
            <label className="block">
              <span className={labelCls}>Auth Token (optional)</span>
              <input
                type="password"
                className={inputCls}
                value={form.authToken}
                onChange={(e) => setForm((f) => ({ ...f, authToken: e.target.value }))}
                placeholder="Bearer token…"
              />
              <p className="mt-1 text-[10px] text-amber-400">
                Token is session-only — never saved to disk or exported in plain text.
              </p>
            </label>
            <label className="block">
              <span className={labelCls}>Description (optional)</span>
              <input
                className={inputCls}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this server expose?"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!form.serverKey.trim() || !form.label.trim() || !form.endpointUrl.trim()}
                className="flex-1 rounded-md bg-accent px-2 py-1.5 text-[11px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save &amp; Test
              </button>
              <button
                onClick={() => { setShowForm(false); setForm(emptyForm()) }}
                className="rounded-md border border-white/10 px-2 py-1.5 text-[11px] text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Server list */}
        {serverList.length === 0 && !showForm && (
          <p className="rounded border border-dashed border-white/10 px-3 py-4 text-center text-[10px] text-gray-600">
            No MCP servers registered. Add one to connect nodes to external tools.
          </p>
        )}

        {serverList.map((server) => (
          <div
            key={server.serverKey}
            className="rounded-lg border border-white/10 bg-surface-2 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <StatusDot isConnected={server.isConnected} />
              <span className="flex-1 truncate text-[11px] font-medium text-gray-200">
                {server.label}
              </span>
              <button
                onClick={() => removeServer(server.serverKey)}
                aria-label={`Delete ${server.label}`}
                className="text-gray-600 hover:text-red-400"
              >
                <Trash2 size={11} />
              </button>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-gray-600">{server.endpointUrl}</p>
            {server.description && (
              <p className="mt-0.5 text-[10px] text-gray-500">{server.description}</p>
            )}
            <button
              onClick={() => handleTest(server.serverKey)}
              disabled={testing === server.serverKey}
              className="mt-2 rounded-md border border-white/10 px-2 py-1 text-[10px] text-gray-400 hover:border-accent/50 hover:text-white disabled:opacity-50"
            >
              {testing === server.serverKey ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
