#!/usr/bin/env bash
# Serve one git ref of the app on Expo web, for the UX capture.
#
#   scripts/ux-loop/serve.sh <git-ref> <port>
#
# Checks the ref out into a throwaway detached worktree next to the others,
# borrows node_modules and .env.local from the main checkout, drops the web
# sparkline overlay in, and starts Metro in the background. Stop it with
# `fuser -k <port>/tcp` (pkill -f can match the calling shell).
set -euo pipefail

ref=${1:?git ref}
port=${2:?port}
here=$(cd "$(dirname "$0")" && pwd)
main=$(git -C "$here" worktree list --porcelain | awk '/^worktree /{print $2; exit}')
slug=$(echo "$ref" | tr '/' '-')
wt="$(dirname "$main")/.worktrees/ux-capture-$slug"

git -C "$main" fetch -q origin || true
if [ -d "$wt" ]; then
  git -C "$wt" checkout -q --detach "$ref"
else
  git -C "$main" worktree add -q --detach "$wt" "$ref"
fi
ln -sfn "$main/node_modules" "$wt/node_modules"
cp "$main/.env.local" "$wt/.env.local"
cp "$here/overlay/sparkline.web.tsx" "$wt/components/sparkline.web.tsx"

fuser -k "$port/tcp" 2>/dev/null || true
(cd "$wt" && CI=1 nohup npx expo start --web --port "$port" -c >"$wt/.expo-web.log" 2>&1 &)

for _ in $(seq 1 90); do
  curl -sf -o /dev/null "http://localhost:$port" && { echo "serving $ref from $wt on :$port"; exit 0; }
  sleep 2
done
echo "Metro did not come up, see $wt/.expo-web.log" >&2
exit 1
