---
description: Security-focused audit. Checks for hardcoded secrets, missing auth, unvalidated inputs, CORS gaps, and dangerouslySetInnerHTML.
argument-hint: [filepath or directory, default: src/]
context: fork
agent: Explore
---

Target: $ARGUMENTS (default: src/)
READ-ONLY. Do not modify files. Report only.

SCAN 1 — SECRETS & CREDENTIALS
grep -rn "sk-\|Bearer \|API_KEY=\|api_key\|secret\|password\|token" $ARGUMENTS --include="*.ts" --include="*.tsx" | grep -v ".env\|process.env\|import\|test\|mock"

SCAN 2 — DANGEROUS HTML
grep -rn "dangerouslySetInnerHTML" $ARGUMENTS --include="*.tsx"

SCAN 3 — UNHANDLED FETCH ERRORS
grep -rn "\.fetch(\|fetch(" $ARGUMENTS --include="*.ts" --include="*.tsx" -A3 | grep -v "try\|catch\|\.catch\|await.*fetch" | head -30

SCAN 4 — EVAL / DYNAMIC CODE
grep -rn "eval(\|new Function(\|setTimeout.*string" $ARGUMENTS --include="*.ts" --include="*.tsx"

SCAN 5 — MISSING AUTH CHECKS (for API/simulation paths)
grep -rn "runNode\|startRun\|executeFlow" src/store --include="*.ts" | head -20
Check if any execution path can be triggered without role/permission check.
Reference: src/store/uiStore.ts ROLE_PERMISSIONS — verify simulationStore respects these.

SCAN 6 — MCP TOOL CALLS (new attack surface from F1)
If src/utils/mcp.ts exists:
cat src/utils/mcp.ts
Verify: fetchMCPManifest validates URL scheme (https only in production).
Verify: tool call responses are not rendered as HTML anywhere.
Verify: MCPDiscoveryError does not leak internal server details to the UI.

Output:
## Security Scan — [date]
### 🚨 Critical
### ⚠️ High
### 📋 Medium
### ℹ️ Informational
Each entry: file:line, what was found, why it's a risk, recommended fix.