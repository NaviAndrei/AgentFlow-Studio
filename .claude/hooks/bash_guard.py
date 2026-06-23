"""
PreToolUse hook: bash_guard.py
Blocks dangerous bash commands before Claude executes them.
Exit code 2 = BLOCK, Exit code 0 = ALLOW

Enhanced: JSONL logging, dry-run mode, Windows-specific patterns.
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
            "hook": "bash_guard",
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

if tool_name != "Bash":
    sys.exit(0)

command = tool_input.get("command", "")

BLOCKED_PATTERNS = [
    # Unix destructive
    (r"rm\s+-rf\s+[/~]", "rm -rf on root/home is blocked"),
    (r"cat\s+\.env", "Reading .env files is blocked - security"),
    (r"cat\s+.*secret", "Reading files with 'secret' is blocked"),
    (r"find\s+/\s+", "find / on full filesystem is blocked - too expensive"),
    (r"curl.*\|.*bash", "Piping curl into bash is blocked - security"),
    (r"wget.*\|.*bash", "Piping wget into bash is blocked - security"),
    (r":\(\)\{.*\}.*:", "Fork bomb detected - blocked"),
    (r"dd\s+if=.*of=/dev/", "Direct device write is blocked"),
    # Windows destructive
    (r"del\s+/s\s+/q\s+[cC]:\\", "del /s /q on system drive root is blocked"),
    (r"rd\s+/s\s+/q\s+[cC]:\\", "rd /s /q on system drive root is blocked"),
    (r"\bformat\s+[a-zA-Z]:", "Formatting a drive is blocked"),
    (r"\bdiskpart\b", "diskpart is blocked - dangerous disk operations"),
    (r"Remove-Item\s+.*-Recurse.*[cC]:\\(?:Windows|Users|Program)", "Recursive delete on system dirs is blocked"),
]

for pattern, reason in BLOCKED_PATTERNS:
    if re.search(pattern, command, re.IGNORECASE):
        if DRY_RUN:
            log_action("dry_run_block", f"{reason} | cmd={command[:100]}")
            print(json.dumps({"decision": "allow", "reason": f"[bash_guard DRY RUN] Would block: {reason}"}))
            sys.exit(0)

        log_action("blocked", f"{reason} | cmd={command[:100]}")
        result = {
            "decision": "block",
            "reason": f"[bash_guard] BLOCKED: {reason}\nCommand: {command[:100]}",
        }
        print(json.dumps(result))
        sys.exit(2)

log_action("allowed", command[:100])
sys.exit(0)
