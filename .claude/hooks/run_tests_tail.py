"""
Stop hook: run_tests_tail.py
Windows-safe replacement for `npm run test 2>&1 | tail -3`.
Informational only — never blocks session stop.
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
            "hook": "run_tests_tail",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def main() -> None:
    try:
        json.load(sys.stdin)
    except Exception:
        pass

    if DRY_RUN:
        log_action("dry_run_tests")
        sys.exit(0)
        return

    try:
        result = subprocess.run(
            "npm run test",
            shell=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except Exception as e:
        log_action("tests_error", str(e))
        sys.exit(0)
        return

    combined = result.stdout + result.stderr
    all_lines = combined.splitlines()
    print("\n".join(all_lines[-3:]))

    if result.returncode == 0:
        log_action("tests_passed", "returncode=0")
    else:
        log_action("tests_failed", f"returncode={result.returncode}")

    sys.exit(0)


try:
    main()
except Exception as e:
    log_action("tests_error", str(e))
    sys.exit(0)
