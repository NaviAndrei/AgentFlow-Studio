"""
Stop hook: on_stop_reminder.py
Fires when Claude Code finishes a task or session.

Blocking behavior: compares mtimes of .claude/.session_start and
docs/progress.md. If progress.md has not been touched since the session
started, the session is blocked from ending (exit code 2 + JSON "block"
decision) until the user runs 'end session' / /handoff to update the
handoff doc. If progress.md was updated after session start, exits
silently (0).

Works on Windows 11 (no /tmp/, no bash, no PowerShell dependency — pure
subprocess/pathlib).
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime, timezone

PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR", "."))
PROGRESS_FILE = PROJECT_DIR / "docs" / "progress.md"
STATE_FILE = PROJECT_DIR / ".claude" / ".session_start"
HOOK_LOG = PROJECT_DIR / ".claude" / "hook-log.jsonl"


def log_action(action: str, detail: str = "") -> None:
    """Append a structured log entry to .claude/hook-log.jsonl."""
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "on_stop_reminder",
            "action": action,
        }
        if detail:
            entry["detail"] = detail[:200]
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def block(message: str) -> None:
    log_action("blocked", message)
    print(json.dumps({"decision": "block", "reason": message}))
    sys.exit(2)


def allow(detail: str = "") -> None:
    log_action("allowed", detail)
    sys.exit(0)


def main() -> None:
    try:
        # No session-start marker yet: nothing to compare against, start tracking.
        if not STATE_FILE.exists():
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            STATE_FILE.write_text(str(os.path.getmtime(__file__)) if False else "")
            STATE_FILE.touch()
            allow("Session start marker initialized")
            return

        session_start_mtime = STATE_FILE.stat().st_mtime

        if not PROGRESS_FILE.exists():
            block(
                "docs/progress.md does not exist yet. Run 'end session' or "
                "/handoff to create and fill the session handoff doc before "
                "stopping."
            )
            return

        progress_mtime = PROGRESS_FILE.stat().st_mtime

        # Check for unfilled TODO markers (merged from progress_guard.py)
        TODO_MARKERS = ["TODO: fill session name", "TODO: what did we accomplish"]
        try:
            content = PROGRESS_FILE.read_text(encoding="utf-8")
            if any(marker in content for marker in TODO_MARKERS):
                block(
                    "docs/progress.md has unfilled TODO markers. "
                    "Complete the handoff block before stopping."
                )
        except Exception:
            pass

        if progress_mtime < session_start_mtime:
            block(
                "docs/progress.md has not been updated this session. "
                "Run 'end session' or /handoff to record the session "
                "handoff before stopping."
            )
            return

        allow("progress.md updated this session")
    except Exception as e:
        # Never let the hook itself crash the session — fail open.
        log_action("error", f"Unhandled exception: {e}")
        sys.exit(0)


main()
