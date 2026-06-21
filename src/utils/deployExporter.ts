import { zipSync, strToU8 } from 'fflate'
import type { AgentFlowEdge, AgentFlowNode } from '../types'
import { exportEnvVars, exportPython, exportRequirements } from './codeExporter'

const SERVER_PY = `"""FastAPI server wrapping the LangGraph flow."""
from fastapi import FastAPI
from pydantic import BaseModel
from main import graph

app = FastAPI()

class InvokeRequest(BaseModel):
    input: str

@app.post("/invoke")
async def invoke(req: InvokeRequest):
    result = graph.invoke({"messages": [{"role": "user", "content": req.input}]})
    return {"output": str(result.get("messages", [])[-1])}
`

const DOCKERFILE = `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
`

const DOCKER_COMPOSE = `version: "3.9"
services:
  agent:
    build: .
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=\${OPENAI_API_KEY}
`

const README = `# AgentFlow Deploy Bundle

A ready-to-run wrapper around your exported LangGraph flow.

## Local (Docker)

\`\`\`bash
docker compose up
curl http://localhost:8000/invoke -d '{"input":"hello"}'
\`\`\`

## Railway

\`\`\`bash
railway up
\`\`\`

Set environment variables (e.g. \`OPENAI_API_KEY\`) in the Railway dashboard.

## Render

1. Create a new Web Service from this repository.
2. Build command: \`pip install -r requirements.txt\`
3. Start command: \`uvicorn server:app --host 0.0.0.0 --port $PORT\`
4. Add the required environment variables in the Render dashboard.

## Files

- \`main.py\` — exported LangGraph flow; compiles a module-level \`graph\`.
- \`server.py\` — FastAPI wrapper exposing \`POST /invoke\`.
- \`requirements.txt\` — Python dependencies.
- \`Dockerfile\` / \`docker-compose.yml\` — container build + local orchestration.
- \`.env.example\` — API keys this flow needs at runtime.
- \`blueprint.json\` — the raw canvas (nodes/edges) this bundle was exported from.
`

function buildEnvExample(nodes: AgentFlowNode[]): string {
  const vars = exportEnvVars(nodes)
  if (vars.length === 0) return '# No API keys required by this flow.\n'
  return vars.map((v) => `${v}=`).join('\n') + '\n'
}

export function generateDeployZip(
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
  asyncMode: boolean,
): Blob {
  const mainPy = exportPython(nodes, edges, { asyncMode })
  const requirements = exportRequirements(nodes)
  const blueprintJson = JSON.stringify({ nodes, edges }, null, 2)
  const zipped = zipSync({
    'main.py': strToU8(mainPy),
    'requirements.txt': strToU8(requirements),
    'server.py': strToU8(SERVER_PY),
    Dockerfile: strToU8(DOCKERFILE),
    'docker-compose.yml': strToU8(DOCKER_COMPOSE),
    'README.md': strToU8(README),
    '.env.example': strToU8(buildEnvExample(nodes)),
    'blueprint.json': strToU8(blueprintJson),
  })
  return new Blob([zipped], { type: 'application/zip' })
}

export function downloadDeployZip(
  nodes: AgentFlowNode[],
  edges: AgentFlowEdge[],
  asyncMode: boolean,
): void {
  const blob = generateDeployZip(nodes, edges, asyncMode)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'agentflow-deploy.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
