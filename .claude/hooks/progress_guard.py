"""
Stop hook: progress_guard.py
Fires when Claude Code is stopping.
Checks if docs/progress.md has unfilled TODO markers in the handoff block.
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone

PROGRESS_FILE = Path("docs/progress.md")
HOOK_LOG = Path(".claude/hook-log.jsonl")

# TODO markers to check
TODO_MARKERS = [
    "TODO: fill session name",
    "TODO: what did we accomplish",
]


def log_action(action: str, detail: str = "") -> None:
    """Append a structured log entry to .claude/hook-log.jsonl."""
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "progress_guard",
            "action": action,
        }
        if detail:
            entry["detail"] = detail[:200]
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def main():
    # Read stdin for stop_hook_active flag
    try:
        input_data = json.loads(sys.stdin.read())
        if input_data.get("stop_hook_active"):
            log_action("skipped", "stop_hook_active=true")
            sys.exit(0)
    except Exception:
        pass

    # Check if progress.md exists
    if not PROGRESS_FILE.exists():
        log_action("skipped", "progress.md not found")
        sys.exit(0)

    # Read progress.md
    try:
        content = PROGRESS_FILE.read_text(encoding="utf-8")
    except Exception as e:
        log_action("error", f"Failed to read progress.md: {str(e)[:100]}")
        sys.exit(0)

    # Check for unfilled TODO markers
    has_unfilled = any(marker in content for marker in TODO_MARKERS)

    if has_unfilled:
        message = "progress_guard: docs/progress.md has unfilled TODOs. Update the handoff block before closing."
        log_action("guard_warned")
        print(
            json.dumps({"systemMessage": " " + message}),
            file=sys.stderr,
        )
    else:
        message = "progress_guard: handoff block looks complete."
        log_action("guard_passed")
        print(
            json.dumps({"systemMessage": " " + message}),
            file=sys.stderr,
        )

    sys.exit(0)


main()
