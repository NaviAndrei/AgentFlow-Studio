import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

HOOK_LOG = Path(".claude/hook-log.jsonl")
DRY_RUN = os.environ.get("HOOK_DRY_RUN") == "1"


def log_action(action: str, detail: str = "") -> None:
    try:
        HOOK_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hook": "session_start",
            "action": action,
        }
        if detail:
            entry["detail"] = detail[:200]
        with open(HOOK_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass


def read_head(path: Path, limit: int = 2000) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        return f"--- {path.as_posix()} ---\n{text[:limit]}"
    except Exception:
        return ""


def run_git(args: list[str]) -> str:
    try:
        result = subprocess.run(
            args,
            shell=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def main() -> None:
    log_action("started")

    try:
        sys.stdin.read()
    except Exception:
        pass

    if DRY_RUN:
        log_action("dry_run", "HOOK_DRY_RUN=1 — skipping project file reads")
        print(
            json.dumps(
                {"additionalContext": "", "systemMessage": "session_start: dry run"}
            )
        )
        return

    parts = []
    try:
        root = Path(__file__).resolve().parents[2]

        # Only load ARCHITECTURE.md when recent changes touch architecture-relevant paths
        arch_paths = ["src/nodes/", "src/store/", "src/utils/", "src/simulation/"]
        changed_files = run_git(["git", "diff", "--name-only", "HEAD"])
        load_architecture = any(p in changed_files for p in arch_paths)

        core_files = ["CLAUDE.md", "docs/progress.md"]
        if load_architecture:
            core_files.append("ARCHITECTURE.md")

        for rel in core_files:
            p = root / rel
            if p.exists():
                content = read_head(p)
                if content:
                    parts.append(content)

        status = run_git(["git", "status", "-sb"])
        if status:
            parts.append(f"--- git status -sb ---\n{status}")

        log = run_git(["git", "log", "--oneline", "-5"])
        if log:
            parts.append(f"--- git log --oneline -5 ---\n{log}")
    except Exception:
        pass

    try:
        output = {
            "additionalContext": "\n---\n".join(parts),
            "systemMessage": "session_start: loaded project context",
        }
        print(json.dumps(output))
    except Exception:
        try:
            print(
                json.dumps(
                    {
                        "additionalContext": "",
                        "systemMessage": "session_start: loaded project context",
                    }
                )
            )
        except Exception:
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
