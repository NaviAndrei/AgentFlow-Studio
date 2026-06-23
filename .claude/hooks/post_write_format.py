"""
PostToolUse hook: post_write_format.py
Logs writes to sensitive TypeScript/store/docs files.
Reads tool input from stdin (Claude Code passes JSON on stdin).
Windows-compatible.

Enhanced: JSONL structured logging, dry-run mode, expanded sensitive patterns.
"""

import sys
import json
import os
from pathlib import Path
from datetime import datetime, timezone

LOG_FILE = Path("docs/layout-fix-log.md")
HOOK_LOG = Path(".claude/hook-log.jsonl")
DRY_RUN = os.environ.get("HOOK_DRY_RUN", "0") == "1"

SENSITIVE_PATTERNS = [
    "src/store/",
    "src/utils/codeExporter",
    "src/utils/autoLayout",
    "src/utils/deployExporter",
    "src/components/",
    "src/nodes/",
    "src/types/",
    "CLAUDE.md",
    "ARCHITECTURE.md",
    "DECISIONS.md",
    "docs/",
    ".claude/",
]


def log_action(action: str, detail: str) -> None:
    """Append a structured log entry to .claude/hook-log.jsonl."""
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "post_write_format",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def is_sensitive(path: str) -> bool:
    return any(p in path for p in SENSITIVE_PATTERNS)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    if tool_name not in ("Write", "Edit", "MultiEdit", "str_replace_editor"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    file_path = tool_input.get("path") or tool_input.get("file_path", "")

    if not file_path or not is_sensitive(file_path):
        log_action("skipped", f"Non-sensitive: {file_path}")
        sys.exit(0)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    if DRY_RUN:
        log_action("dry_run", f"Would log write to {file_path}")
        sys.exit(0)

    # Structured JSONL log
    log_action("logged_write", f"{tool_name} → {file_path}")

    # Markdown log (backwards compatible)
    if not LOG_FILE.exists():
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        LOG_FILE.write_text("# File Edit Log\n\n")

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"- `{file_path}` edited at {timestamp}\n")


main()
sys.exit(0)
