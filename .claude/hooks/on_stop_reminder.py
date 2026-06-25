"""
Stop hook: on_stop_reminder.py
Fires when Claude Code finishes a task or session.
1. Auto-fills a session handoff block (real test/typecheck/git data, no TODO slots)
   and prepends it to docs/progress.md.
2. Auto-syncs the "## Open TODOs" section against code reality (checks off items
   whose grep signal says they're done, adds new items found via "// TODO:" in
   files changed this session).
3. Prints a summary to stderr.
Works on Windows 11 (no /tmp/, no bash, no PowerShell dependency — pure subprocess).
"""

import sys
import time
import os
import json
import re
import subprocess
from pathlib import Path
from datetime import datetime, timezone

PROGRESS_FILE = Path("docs/progress.md")
STATE_FILE = Path(".claude/.session_start")  # Windows-safe, inside repo
HOOK_LOG = Path(".claude/hook-log.jsonl")
DRY_RUN = os.environ.get("HOOK_DRY_RUN", "0") == "1"
CMD_TIMEOUT_SECONDS = 30

# One entry per Open TODO that has a code-checkable signal. "match" is looked
# up as a case-insensitive substring of the TODO line (backticks stripped),
# so it doesn't need to equal the whole line.
TODO_SYNC_RULES = {
    "Wire real LLM calls into default:": {
        "grep_file": "src/store/simulationStore.ts",
        "grep_pattern": "fakeStreamTextFor",
        "done_if": "zero_matches",
    },
    "tool:/retriever: cases": {
        "grep_file": "src/store/simulationStore.ts",
        "grep_pattern": "fakeOutputFor",
        "done_if": "zero_matches",
    },
    "tool-call dispatch loop for tool: nodes": {
        "grep_file": "src/store/simulationStore.ts",
        "grep_pattern": "toolRegistry",
        "done_if": "nonzero_matches",
    },
    "-StepOnly param for pre-push-check.ps1": {
        "grep_file": "scripts/pre-push-check.ps1",
        "grep_pattern": "StepOnly",
        "done_if": "nonzero_matches",
    },
}


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


def today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def run_subprocess(command: str, timeout: int = CMD_TIMEOUT_SECONDS):
    """Run a shell command, returning (returncode, stdout, stderr).
    returncode is None on any failure/timeout so callers can fall back safely."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        log_action("subprocess_error", f"{command}: {e}")
        return None, "", str(e)


def get_test_status() -> str:
    returncode, out, err = run_subprocess("npm run test -- --run")
    if returncode is None:
        return "TODO: X/Y passing (test run failed or timed out)"
    combined = out + err
    match = re.search(
        r"Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)", combined
    )
    if not match:
        return "TODO: X/Y passing (could not parse vitest output)"
    passed, total = int(match.group(1)), int(match.group(3))
    status = "✅" if passed == total else "⚠️"
    return f"{status} {passed}/{total} passing"


def get_typecheck_status() -> str:
    returncode, out, err = run_subprocess("npm run typecheck")
    if returncode is None:
        return "TODO (typecheck run failed or timed out)"
    if returncode == 0:
        return "✅ clean"
    tail_lines = (out + err).strip().splitlines()[-3:]
    return f"❌ FAILED: {' | '.join(tail_lines)[:300]}"


def get_changed_files() -> list[str]:
    returncode, out, err = run_subprocess("git diff --name-only HEAD")
    if returncode == 0 and out.strip():
        return [line.strip() for line in out.strip().splitlines() if line.strip()]
    return []


def get_last_commit_subject() -> str:
    returncode, out, err = run_subprocess("git log -1 --format=%s")
    if returncode == 0 and out.strip():
        return out.strip()
    return "session name unavailable (git log failed)"


def next_session_number(content: str) -> int:
    nums = re.findall(r"Session (\d+)", content)
    return max((int(n) for n in nums), default=0) + 1


def build_filled_handoff_block(existing_content: str, changed_files: list[str]) -> str:
    date = today()
    session_num = next_session_number(existing_content)
    session_subject = get_last_commit_subject()
    test_status = get_test_status()
    typecheck_status = get_typecheck_status()

    if changed_files:
        shown = changed_files[:15]
        completed_bullets = "\n".join(f"- [x] Modified `{f}`" for f in shown)
        if len(changed_files) > 15:
            completed_bullets += (
                f"\n- [ ] ...and {len(changed_files) - 15} more files "
                "(see `git diff --name-only HEAD`)"
            )
    else:
        completed_bullets = "- [ ] TODO: no changed files detected — fill in manually"

    return f"""
---
<!-- auto-prepended by on_stop_reminder.py on {date} -->
## Handoff — {date} (Session {session_num} — {session_subject})

### What was completed
{completed_bullets}
- [ ] TODO: annotate WHY each change was made (auto-detected list above is files only)

### Build & Test Status
| Check | Result |
|---|---|
| `npm run typecheck` | {typecheck_status} |
| `npm run build` | TODO (not run by hook) |
| `npm run test` | {test_status} |
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


def check_rule(rule: dict) -> bool:
    try:
        path = Path(rule["grep_file"])
        if not path.exists():
            return False
        text = path.read_text(encoding="utf-8", errors="ignore")
        found = rule["grep_pattern"] in text
        return (not found) if rule["done_if"] == "zero_matches" else found
    except Exception:
        return False


def sync_open_todos(content: str, changed_files: list[str]):
    """Check off Open TODOs whose grep signal says they're done, and add new
    ones discovered via '// TODO:' comments in files changed this session."""
    changes: list[str] = []

    section_start = re.search(r"^## Open TODOs\s*$", content, re.MULTILINE)
    if not section_start:
        return content, changes

    start = section_start.end()
    next_header = re.search(r"^## ", content[start:], re.MULTILINE)
    end = start + next_header.start() if next_header else len(content)
    section = content[start:end]

    new_lines = []
    for line in section.splitlines(keepends=True):
        stripped = line.strip()
        if stripped.startswith("- [ ]"):
            normalized = stripped.replace("`", "").lower()
            matched_key, matched_rule = None, None
            for key, rule in TODO_SYNC_RULES.items():
                if key.replace("`", "").lower() in normalized:
                    matched_key, matched_rule = key, rule
                    break
            if matched_rule and check_rule(matched_rule):
                new_line = (
                    line.rstrip("\n").replace("- [ ]", "- [x]", 1)
                    + " — auto-synced done (on_stop_reminder)\n"
                )
                changes.append(f"auto-checked: {matched_key}")
                new_lines.append(new_line)
                continue
        new_lines.append(line)
    new_section = "".join(new_lines)

    existing_lower = new_section.lower()
    new_item_lines = []
    todo_scan_exts = (".ts", ".tsx", ".js", ".jsx")
    for f in changed_files:
        # Only scan actual feature source files — exclude hook/automation
        # infra (e.g. this very script contains the literal string
        # '// TODO:' in its own implementation, which would self-match).
        if f.startswith(".claude/") or not f.endswith(todo_scan_exts):
            continue
        path = Path(f)
        if not path.exists() or not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            if "// TODO:" not in line:
                continue
            todo_text = line.split("// TODO:", 1)[1].strip()
            if not todo_text or todo_text.lower() in existing_lower:
                continue
            entry = (
                f"- [ ] {todo_text} — found in `{f}:{lineno}` "
                "— auto-added (on_stop_reminder)\n"
            )
            new_item_lines.append(entry)
            existing_lower += entry.lower()
            changes.append(f"auto-added: {todo_text[:60]}")

    if new_item_lines:
        new_section = new_section.rstrip("\n") + "\n" + "".join(new_item_lines) + "\n"

    return content[:start] + new_section + content[end:], changes


def elapsed_minutes() -> float:
    try:
        start = float(STATE_FILE.read_text().strip())
        return (time.time() - start) / 60
    except Exception:
        return 0


def _main_impl():
    # Track session start time
    if not STATE_FILE.exists():
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(str(time.time()))
        log_action("session_start", "Timer initialized")
        return

    minutes = elapsed_minutes()

    # Only append if session lasted > 5 minutes (skip trivial queries)
    if minutes < 5:
        log_action("skipped", f"Session too short ({minutes:.1f} min)")
        return

    if DRY_RUN:
        log_action("dry_run", f"Would auto-fill handoff block ({minutes:.0f} min session)")
        print(
            f"[on_stop_reminder DRY RUN] Would auto-fill handoff block and sync "
            f"Open TODOs in progress.md ({minutes:.0f} min session)",
            file=sys.stderr,
        )
        return

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

    # Insertion point: after the intro header block (first --- separator)
    insert_at = next(
        (i for i, line in enumerate(lines) if i > 3 and line.strip() == "---"), 4
    )

    # If a stale unfilled template sits at the top (from an older hook version
    # or an interrupted run), replace it instead of skipping or duplicating —
    # find its closing "---" (shared with the next real entry) and splice it out.
    if "(TODO: fill session name)" in existing[:400]:
        stale_end = next(
            (j for j in range(insert_at + 1, len(lines)) if lines[j].strip() == "---"),
            None,
        )
        if stale_end is not None:
            lines = lines[:insert_at] + lines[stale_end:]
            log_action("replaced_stale", "Removed unfilled template block")

    changed_files = get_changed_files()
    new_block = build_filled_handoff_block(existing, changed_files)
    updated = "".join(lines[:insert_at]) + new_block + "".join(lines[insert_at:])

    updated, todo_changes = sync_open_todos(updated, changed_files)

    PROGRESS_FILE.write_text(updated, encoding="utf-8")

    # Reset session timer
    STATE_FILE.write_text(str(time.time()))

    log_action(
        "prepended",
        f"Auto-filled handoff block ({minutes:.0f} min session); "
        f"todo_changes={len(todo_changes)}",
    )

    summary_lines = "\n".join(f"  - {c}" for c in todo_changes) or "  (none)"
    print(
        "\n"
        + "=" * 40 + "\n"
        f"  docs/progress.md auto-filled ({minutes:.0f} min session)\n"
        f"  Open TODOs synced:\n{summary_lines}\n"
        "  Still needs human input: WHY decisions were made, deferred items.\n"
        + "=" * 40 + "\n",
        file=sys.stderr,
    )


def main():
    try:
        _main_impl()
    except Exception as e:
        log_action("error", f"Unhandled exception: {e}")
    sys.exit(0)


main()
