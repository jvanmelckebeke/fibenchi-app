"""The fibenchi endpoint, read from the main checkout's .env.local so it never lands in git."""

import os
import subprocess
from pathlib import Path


def fibenchi_endpoint() -> str:
    if url := os.environ.get("EXPO_PUBLIC_FIBENCHI_ENDPOINT"):
        return url.rstrip("/")
    here = Path(__file__).resolve().parent
    porcelain = subprocess.run(
        ["git", "-C", str(here), "worktree", "list", "--porcelain"], capture_output=True, text=True, check=True
    ).stdout
    main = Path(porcelain.split("\n", 1)[0].removeprefix("worktree "))
    for line in (main / ".env.local").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_FIBENCHI_ENDPOINT="):
            return line.split("=", 1)[1].strip().strip("\"'").rstrip("/")
    raise SystemExit("EXPO_PUBLIC_FIBENCHI_ENDPOINT is not set in the env or .env.local")
