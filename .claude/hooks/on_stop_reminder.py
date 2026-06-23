"""
Stop hook: on_stop_reminder.py
Fires when Claude Code finishes a task or session.
1. Prepends a TODO handoff block to docs/progress.md
2. Prints a reminder to fill in the TODOs before /clear
Works on Windows 11 (no /tmp/, no bash).

Enhanced: JSONL logging, dry-run mode.
"""

import sys
import time
import os
import json
from pathlib import Path
from datetime import datetime, timezone

PROGRESS_FILE = Path("docs/progress.md")
STATE_FILE = Path(".claude/.session_start")  # Windows-safe, inside repo
HOOK_LOG = Path(".claude/hook-log.jsonl")
DRY_RUN = os.environ.get("HOOK_DRY_RUN", "0") == "1"


def log_action(action: str, detail: str) -> None:
    """Append a structured log entry to .claude/hook-log.jsonl."""
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "on_stop_reminder",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def build_todo_block() -> str:
    date = today()
    return f"""
---
<!-- auto-prepended by on_stop_reminder.py on {date} -->
## Handoff — {date} (TODO: fill session name)

### What was completed
- [ ] TODO: Task A — description ✅/❌
- [ ] TODO: Task B — description ✅/❌

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | TODO |
| `npm run build` | TODO |
| `npm run test` | TODO: X/Y passing |
| Browser verification | TODO |

### Decisions made this session
- [ ] TODO: one bullet per architectural decision

### Known edge cases / deferred
- [ ] TODO: one bullet per deferred item or known gap

### What to load at resume
```
@CLAUDE.md @docs/progress.md
```
"""


def elapsed_minutes() -> float:
    try:
        start = float(STATE_FILE.read_text().strip())
        return (time.time() - start) / 60
    except Exception:
        return 0


def main():
    # Track session start time
    if not STATE_FILE.exists():
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(str(time.time()))
        log_action("session_start", "Timer initialized")
        sys.exit(0)

    minutes = elapsed_minutes()

    # Only append if session lasted > 5 minutes (skip trivial queries)
    if minutes < 5:
        log_action("skipped", f"Session too short ({minutes:.1f} min)")
        sys.exit(0)

    if DRY_RUN:
        log_action("dry_run", f"Would prepend handoff block ({minutes:.0f} min session)")
        print(
            f"[on_stop_reminder DRY RUN] Would prepend TODO block to progress.md ({minutes:.0f} min session)",
            file=sys.stderr,
        )
        sys.exit(0)

    # Ensure progress.md exists
    if not PROGRESS_FILE.exists():
        PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
        PROGRESS_FILE.write_text(
            "# AgentFlow Studio — Session Handoff\n"
            "> Update at end of every session before /clear.\n"
            "> Start next session: `@CLAUDE.md @docs/progress.md`\n"
        )

    existing = PROGRESS_FILE.read_text(encoding="utf-8")
    lines = existing.splitlines(keepends=True)

    # Find insertion point: after the header block (first --- separator)
    insert_at = next(
        (i for i, line in enumerate(lines) if i > 3 and line.strip() == "---"), 4
    )

    todo_block = build_todo_block()
    updated = "".join(lines[:insert_at]) + todo_block + "".join(lines[insert_at:])
    PROGRESS_FILE.write_text(updated, encoding="utf-8")

    # Reset session timer
    STATE_FILE.write_text(str(time.time()))

    log_action("prepended", f"Handoff TODO block added ({minutes:.0f} min session)")

    # Print reminder to Claude Code's stderr (visible in terminal)
    print(
        "\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"  📋 docs/progress.md updated ({minutes:.0f} min session)\n"
        "  Fill in TODO slots before /clear:\n"
        "  1. Session name in H2 header\n"
        "  2. Task A/B/C bullets with ✅/❌\n"
        "  3. Build & test results\n"
        "  4. Decisions + deferred items\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
        file=sys.stderr,
    )


main()
