"""
PostToolUse hook: auto_format.py
Auto-formats code files after Write/Edit/MultiEdit using prettier or ruff.
Reads tool input from stdin (Claude Code passes JSON on stdin).
Windows-compatible.
"""

import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

HOOK_LOG = Path(".claude/hook-log.jsonl")

# Formatter mappings
PRETTIER_EXTS = {".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css"}
RUFF_EXTS = {".py"}


def log_action(action: str, detail: str) -> None:
    """Append a structured log entry to .claude/hook-log.jsonl."""
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "auto_format",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def format_with_prettier(file_path: Path) -> bool:
    """Format file with prettier. Returns True if formatting was attempted."""
    try:
        # shell=True so Windows resolves `npx` (npx.cmd); a bare list raises
        # FileNotFoundError under shell=False, silently disabling formatting.
        subprocess.run(
            f'npx --no-install prettier --write "{file_path}"',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return True
    except Exception:
        return False


def format_with_ruff(file_path: Path) -> bool:
    """Format file with ruff (format + check --fix). Returns True if formatting was attempted."""
    try:
        # shell=True for consistent executable resolution on Windows.
        # First, run ruff format
        subprocess.run(
            f'ruff format "{file_path}"',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        # Then, run ruff check --fix
        subprocess.run(
            f'ruff check --fix "{file_path}"',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return True
    except Exception:
        return False


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    if tool_name not in ("Write", "Edit", "MultiEdit"):
        sys.exit(0)

    tool_input = data.get("tool_input", {})
    file_path_str = tool_input.get("path") or tool_input.get("file_path", "")

    if not file_path_str:
        sys.exit(0)

    file_path = Path(file_path_str)

    # Exit silently if file doesn't exist
    if not file_path.exists():
        sys.exit(0)

    ext = file_path.suffix.lower()

    # Determine formatter and run
    if ext in PRETTIER_EXTS:
        if format_with_prettier(file_path):
            log_action("formatted", f"{ext} → {file_path_str}")
    elif ext in RUFF_EXTS:
        if format_with_ruff(file_path):
            log_action("formatted", f"{ext} → {file_path_str}")
    # All other extensions: skip silently

    sys.exit(0)


main()
