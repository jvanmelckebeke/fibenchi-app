#!/usr/bin/env bash
# Prepare one UX-loop run: serve each build, capture it, snapshot the truth,
# render both glossaries and every tester and grader prompt.
#
#   scripts/ux-loop/prepare.sh <run-dir> <label>=<git-ref> [<label>=<git-ref> ...]
#
# Example: prepare.sh /tmp/ux/run2 pr48=origin/feat/home-overview main=origin/main
#
# Builds are captured one after another, each followed at once by its own
# ground-truth snapshot. Testers get <run>/<label>/*.png only; the rendered
# text and manifest go to <run>/<label>-text/ for the grader.
set -euo pipefail

run=${1:?run dir}; shift
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$run/answers" "$run/prompts"
port=8121
labels=()

for spec in "$@"; do
  label=${spec%%=*}; ref=${spec#*=}
  labels+=("$label")
  "$here/serve.sh" "$ref" "$port"
  rm -rf "${run:?}/$label" "${run:?}/$label-text"
  python3 "$here/capture.py" --base "http://localhost:$port" --out "$run/$label"
  python3 "$here/ground_truth.py" --out "$run/truth-$label.json"
  mkdir -p "$run/$label-text"
  mv "$run/$label"/*.txt "$run/$label/manifest.json" "$run/$label-text/"
  fuser -k "$port/tcp" 2>/dev/null || true
done

for variant in bare explained; do
  python3 "$here/build_brief.py" --variant "$variant" --out "$run/glossary-$variant.md"
done

python3 "$here/render_prompts.py" "$run" "${labels[@]}"
