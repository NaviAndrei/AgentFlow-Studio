"""
PreCompact hook: pre_compact_snapshot.py
Fires before Claude compacts context. Snapshots recent hook log entries
to docs/progress.md so no session context is lost during long sessions.
Observational only — always exits 0, never blocks the compaction.
"""

import sys
import os
import json
from datetime import datetime, timezone
from pathlib import Path

HOOK_LOG = Path(".claude/hook-log.jsonl")
PROGRESS_FILE = Path("docs/progress.md")
DRY_RUN = os.environ.get("HOOK_DRY_RUN") == "1"


def log_action(action: str, detail: str = "") -> None:
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "pre_compact_snapshot",
            "action": action,
        }
        if detail:
            entry["detail"] = detail[:200]
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
        return

    trigger = input_data.get("trigger", "unknown")
    custom_instructions = input_data.get("custom_instructions", "")

    if DRY_RUN:
        log_action("dry_run", "HOOK_DRY_RUN=1 — skipping real action")
        sys.exit(0)
        return

    try:
        last_lines: list[str] = []
        if HOOK_LOG.exists():
            with open(HOOK_LOG, encoding="utf-8") as f:
                last_lines = f.readlines()[-15:]

        PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
        snippet = "".join(last_lines)
        block = (
            f"\n---\n"
            f"## Pre-Compact Snapshot — {datetime.now().isoformat()[:16]}\n"
            f"trigger: {trigger}\n"
            f"custom_instructions: {custom_instructions}\n"
            f"```\n{snippet}```\n"
        )
        with open(PROGRESS_FILE, "a", encoding="utf-8") as f:
            f.write(block)

        log_action("snapshot_appended", f"trigger={trigger} lines={len(last_lines)}")
    except Exception as e:
        log_action("error", f"Unhandled exception: {e}")


try:
    main()
except Exception:
    pass

sys.exit(0)
