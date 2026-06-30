"""
PostToolUse hook: run_eslint.py
Windows-safe replacement for `npx eslint $CLAUDE_FILE_PATH --max-warnings 0 2>&1 | head -10`.
Informational only — never blocks the tool result.
"""

import sys
import os
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

HOOK_LOG = Path(".claude/hook-log.jsonl")
DRY_RUN = os.environ.get("HOOK_DRY_RUN") == "1"


def log_action(action: str, detail: str = "") -> None:
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "run_eslint",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def main() -> None:
    if DRY_RUN:
        log_action("dry_run_eslint")
        sys.exit(0)

    file_path = os.environ.get("CLAUDE_FILE_PATH", "")
    if not file_path or not Path(file_path).exists():
        log_action("eslint_skip", file_path)
        sys.exit(0)
        return

    try:
        # shell=True so Windows resolves `npx` (npx.cmd); passing a list keeps
        # each argument safely quoted via list2cmdline — no string interpolation.
        result = subprocess.run(
            ["npx", "eslint", file_path, "--max-warnings", "0"],
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as e:
        log_action("eslint_error", str(e))
        sys.exit(0)
        return

    if result.returncode == 0:
        log_action("eslint_pass", file_path)
        sys.exit(0)
        return

    combined = result.stdout + result.stderr
    lines = combined.splitlines()
    print("\n".join(lines[:10]))
    log_action("eslint_fail", combined[:200])
    sys.exit(0)


try:
    main()
except Exception as e:
    log_action("eslint_error", str(e))
    sys.exit(0)
