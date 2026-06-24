import json
import subprocess
from pathlib import Path


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
    parts = []
    try:
        root = Path(__file__).resolve().parents[2]

        for rel in ("CLAUDE.md", "docs/progress.md", "ARCHITECTURE.md"):
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
            print(json.dumps({"additionalContext": "", "systemMessage": "session_start: loaded project context"}))
        except Exception:
            pass


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
