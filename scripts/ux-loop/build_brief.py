"""Render the tester glossary for one variant, and check it covers every tracked ticker.

    python3 scripts/ux-loop/build_brief.py --variant bare|explained --out <file.md>

`bare` gives the owner's knowledge only (tickers, groups, abbreviations).
`explained` adds the meaning of the app's own symbols.
"""

import argparse
import json
import urllib.request
from pathlib import Path

import yaml

from env import fibenchi_endpoint

HERE = Path(__file__).resolve().parent


def render(glossary: dict, variant: str) -> str:
    owner = glossary["owner"]
    lines = ["# Glossary", "", owner["context"].strip(), "", "## Groups", ""]
    lines += [f"- **{k}**: {v}" for k, v in owner["groups"].items()]
    lines += ["", "## Abbreviations", ""]
    lines += [f"- **{k}**: {v}" for k, v in owner["abbreviations"].items()]
    lines += ["", "## Tickers", ""]
    lines += [f"- `{k}`: {v}" for k, v in owner["tickers"].items()]
    if variant == "explained":
        lines += ["", "## What the app's symbols mean", ""]
        lines += [f"- **{k}**: {v}" for k, v in glossary["ui"].items()]
    return "\n".join(lines) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description="Render the tester glossary")
    ap.add_argument("--variant", choices=["bare", "explained"], required=True)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    glossary = yaml.safe_load((HERE / "glossary.yaml").read_text())

    with urllib.request.urlopen(f"{fibenchi_endpoint()}/api/companion/config", timeout=20) as r:
        tracked = set(json.load(r)["tickers"])
    missing = sorted(tracked - set(glossary["owner"]["tickers"]))
    if missing:
        raise SystemExit(f"glossary.yaml has no entry for: {', '.join(missing)}")
    groups = {g for g in glossary["owner"]["groups"]}
    args.out.write_text(render(glossary, args.variant))
    print(f"{args.variant} glossary -> {args.out} ({len(tracked)} tickers, {len(groups)} groups)")


if __name__ == "__main__":
    main()
