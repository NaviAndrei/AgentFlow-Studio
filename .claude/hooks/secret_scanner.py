"""
PreToolUse hook: secret_scanner.py
Blocks writes/edits that introduce hardcoded secrets before Claude executes them.
Exit code 2 = BLOCK, Exit code 0 = ALLOW
"""

import sys
import json
import re
import os
from datetime import datetime, timezone
from pathlib import Path

HOOK_LOG = Path(".claude/hook-log.jsonl")
DRY_RUN = os.environ.get("HOOK_DRY_RUN", "0") == "1"


def log_action(action: str, detail: str) -> None:
    """Append a structured log entry to .claude/hook-log.jsonl."""
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "secret_scanner",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass  # logging must never crash the hook


try:
    input_data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool_name = input_data.get("tool_name", "")
tool_input = input_data.get("tool_input", {})

if tool_name not in ("Write", "Edit", "MultiEdit"):
    sys.exit(0)

content = tool_input.get("content") or tool_input.get("new_string") or ""

SECRET_PATTERNS = [
    (r"sk-[a-zA-Z0-9]{32,}", "OpenAI/Anthropic API key"),
    (r"AKIA[0-9A-Z]{16}", "AWS access key"),
    (r"ghp_[a-zA-Z0-9]{36,}", "GitHub personal access token"),
    (r"AIza[0-9A-Za-z\-_]{35}", "Google/Gemini API key"),
    (r"eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}", "JWT"),
    (r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----", "Private key"),
]

for pattern, label in SECRET_PATTERNS:
    if re.search(pattern, content, re.IGNORECASE):
        if DRY_RUN:
            log_action("dry_run_block", f"{label} | content={content[:100]}")
            print(json.dumps({"decision": "allow", "reason": f"[secret_scanner DRY RUN] Would block: {label}"}))
            sys.exit(0)

        log_action("blocked", f"{label} | content={content[:100]}")
        result = {
            "decision": "block",
            "reason": f"secret_scanner: detected {label}. Use env vars or .env (gitignored).",
        }
        print(json.dumps(result))
        sys.exit(2)

sys.exit(0)
