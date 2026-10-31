#!/usr/bin/env bash
# File: deploy/deploy.sh
# Scripted deploy on the Oracle VM: pull, install, build, reload pm2 (ARCHITECTURE §N+9).
# Optional arg: a git SHA to roll back to (PLAN Rollback & Recovery -> deploy.sh rollback path).
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET_SHA="${1:-}"

echo "[deploy] pulling latest"
if [ -n "$TARGET_SHA" ]; then
  echo "[deploy] rollback requested -> checking out $TARGET_SHA"
  git checkout "$TARGET_SHA"
else
  git pull --ff-only
fi

echo "[deploy] installing deps"
npm ci

echo "[deploy] building"
GIT_SHA="$(git rev-parse --short HEAD)"
export GIT_SHA
npm run build

echo "[deploy] reloading pm2 (sha=${GIT_SHA})"
pm2 startOrReload ecosystem.config.cjs --update-env

echo "[deploy] health check"
sleep 3
if curl -s localhost:3000/api/health | grep -q '"ok":true'; then
  echo "[deploy] OK"
else
  echo "[deploy] HEALTH CHECK FAILED" >&2
  exit 1
fi
