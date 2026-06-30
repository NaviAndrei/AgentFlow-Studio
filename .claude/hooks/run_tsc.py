"""
PostToolUse hook: run_tsc.py
Windows-safe replacement for `npx tsc --noEmit 2>&1 | head -5`.
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
            "hook": "run_tsc",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def main() -> None:
    if DRY_RUN:
        log_action("dry_run_tsc")
        sys.exit(0)

    try:
        result = subprocess.run(
            "npx tsc --noEmit",
            shell=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except Exception as e:
        log_action("tsc_error", str(e))
        sys.exit(0)
        return

    if result.returncode == 0:
        log_action("tsc_pass")
        sys.exit(0)
        return

    combined = result.stdout + result.stderr
    lines = combined.splitlines()
    print("\n".join(lines[:5]))
    log_action("tsc_fail", combined[:200])
    sys.exit(0)


try:
    main()
except Exception as e:
    log_action("tsc_error", str(e))
    sys.exit(0)
