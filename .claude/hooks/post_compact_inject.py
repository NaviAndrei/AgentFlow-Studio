"""
PostCompact hook: post_compact_inject.py
Fires after Claude compacts context. Re-injects a curated anchor block
(compact-anchor.md) so AgentFlow's project rules survive compaction.
Fail-open: any exception exits 0 silently, never crashes the session.
"""

import sys
import json
import os
from datetime import datetime, timezone
from pathlib import Path

HOOK_LOG = Path(".claude/hook-log.jsonl")
ANCHOR_FILE = "compact-anchor.md"
DRY_RUN = os.environ.get("HOOK_DRY_RUN") == "1"


def log_action(action: str, detail: str) -> None:
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "post_compact_inject",
            "action": action,
            "detail": detail[:200],
        }
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def main() -> None:
    try:
        sys.stdin.read()
    except Exception:
        pass

    if DRY_RUN:
        log_action("dry_run", "HOOK_DRY_RUN=1 — skipping real action")
        sys.exit(0)
        return

    project_root = os.getcwd()
    anchor_path = os.path.join(project_root, ANCHOR_FILE)

    if not os.path.exists(anchor_path):
        sys.exit(0)

    with open(anchor_path, encoding="utf-8") as f:
        content = f.read()[:1500]

    print(json.dumps({"additionalContext": content}))
    log_action("injected", f"anchor={len(content)} chars")


try:
    main()
except Exception:
    sys.exit(0)

sys.exit(0)
