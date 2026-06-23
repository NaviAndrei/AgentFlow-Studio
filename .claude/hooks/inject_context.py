"""
UserPromptSubmit hook: inject_context.py
Auto-injects relevant context into prompt based on keywords.
Reduces need to manually attach context files.
Returns JSON with "additionalContext" if relevant context found.

Enhanced: JSONL logging, expanded keyword map.
"""

import sys
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HOOK_LOG = Path(".claude/hook-log.jsonl")


def log_action(action: str, detail: str) -> None:
    """Append a structured log entry to .claude/hook-log.jsonl."""
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "inject_context",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


try:
    input_data: dict[str, Any] = json.load(sys.stdin)
except Exception:
    sys.exit(0)

prompt: str = input_data.get("prompt", "").lower()

# Keyword → path map for AgentFlow Studio context injection
CONTEXT_MAP: dict[str, str] = {
    # Core areas
    "node": "src/nodes",
    "blueprint": "src/blueprints",
    "component": "src/components",
    "store": "src/store",
    "type": "src/types",
    "util": "src/utils",
    # Specific subsystems
    "exporter": "src/utils/codeExporter.ts",
    "deploy": "src/utils/deployExporter.ts",
    "simulation": "src/store/simulationStore.ts",
    "canvas": "src/store/canvasStore.ts",
    "eval": "src/store/evalStore.ts",
    "prompt": "src/store/promptStore.ts",
    "run-history": "src/store/runHistoryStore.ts",
    "run history": "src/store/runHistoryStore.ts",
    # Documentation
    "progress": "docs/progress.md",
    "layout": "docs/layout-fix-log.md",
    "decision": "DECISIONS.md",
    "architecture": "ARCHITECTURE.md",
    # Testing
    "test": "src/utils/codeExporter.test.ts",
    # Hooks
    "hook": ".claude/hooks",
}

injected: list[str] = []
added: set[str] = set()
project_root: str = os.getcwd()

for keyword, rel_path in CONTEXT_MAP.items():
    if keyword not in prompt:
        continue
    if rel_path in added:
        continue
    full_path = os.path.join(project_root, rel_path)
    if not os.path.exists(full_path):
        continue
    try:
        if os.path.isfile(full_path):
            with open(full_path, encoding="utf-8") as f:
                content = f.read()[:1500]
            injected.append(f"[context: {rel_path}]\n{content}")
        elif os.path.isdir(full_path):
            files: list[str] = os.listdir(full_path)[:10]
            injected.append(f"[context: {rel_path}/]\nFiles: {', '.join(files)}")
        added.add(rel_path)
    except Exception:
        pass

if injected:
    log_action("injected", f"keywords matched → {len(injected)} contexts: {', '.join(sorted(added))}")
    print(json.dumps({"additionalContext": "\n---\n".join(injected)}))
else:
    log_action("no_match", f"prompt length={len(prompt)}")

sys.exit(0)
