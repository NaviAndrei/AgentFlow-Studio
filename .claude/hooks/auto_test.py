#!/usr/bin/env python3
"""PostToolUse hook: Auto-run sibling test files after source edits."""

import json
import os
import sys
import subprocess
from pathlib import Path

DRY_RUN = os.environ.get("HOOK_DRY_RUN") == "1"


def log_action(action: str, detail: str = "") -> None:
    try:
        log_file = Path(".claude/hook-log.jsonl")
        log_file.parent.mkdir(parents=True, exist_ok=True)
        entry = {"hook": "auto_test", "action": action}
        if detail:
            entry["detail"] = detail[:200]
        with open(log_file, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def main():
    try:
        # Read JSON from stdin
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    # Exit if tool is not Write/Edit/MultiEdit
    tool_name = data.get("tool_name", "")
    if tool_name not in ("Write", "Edit", "MultiEdit"):
        sys.exit(0)

    # Extract file path from tool_input (Claude Code sends "tool_input", not "parameters")
    tool_input = data.get("tool_input", {})
    file_path = tool_input.get("file_path") or tool_input.get("path", "")
    if not file_path:
        sys.exit(0)

    file_path = Path(file_path)

    # Exit if file is in excluded directories
    parts = file_path.parts
    if "node_modules" in parts or ".claude" in parts or "dist" in parts:
        sys.exit(0)

    # Derive stem name (without extension)
    stem = file_path.stem

    # Search for test file in same directory
    test_dir = file_path.parent
    test_suffixes = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"]

    test_file = None
    for suffix in test_suffixes:
        candidate = test_dir / (stem + suffix)
        if candidate.exists():
            test_file = candidate
            break

    # Exit if no test file found
    if not test_file:
        sys.exit(0)

    if DRY_RUN:
        log_action("dry_run_test", str(test_file))
        sys.exit(0)

    # Run vitest with timeout. shell=True so Windows resolves `npx` (npx.cmd) —
    # a bare ["npx", ...] list raises FileNotFoundError under shell=False.
    # Matches the subprocess convention in on_stop_reminder.py.
    try:
        result = subprocess.run(
            f'npx --no-install vitest run "{test_file}" --reporter=verbose',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        # On timeout: exit 0 silently
        sys.exit(0)
    except Exception:
        # On any other error: exit 0 silently
        sys.exit(0)

    # Log to hook-log.jsonl
    log_file = Path(".claude/hook-log.jsonl")
    log_file.parent.mkdir(parents=True, exist_ok=True)

    if result.returncode == 0:
        # Tests passed
        log_entry = {"action": "tests_passed", "detail": str(test_file)}
        with open(log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
        sys.exit(0)
    else:
        # Tests failed
        log_entry = {"action": "tests_failed", "detail": str(test_file)}
        with open(log_file, "a") as f:
            f.write(json.dumps(log_entry) + "\n")

        # Get last 1500 chars of output
        output = result.stdout + result.stderr
        last_output = output[-1500:] if len(output) > 1500 else output

        # Print decision JSON and exit 2
        decision = {
            "decision": "block",
            "reason": f"auto_test: tests failed for {test_file}:\n{last_output}",
        }
        print(json.dumps(decision))
        sys.exit(2)


if __name__ == "__main__":
    main()
