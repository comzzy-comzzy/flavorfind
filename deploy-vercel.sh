#!/usr/bin/env bash
# deploy-vercel.sh
# AC-14 helper: deploys the local FlavorFind repo to Vercel via the CLI.
# Use this if you do NOT want to push to GitHub first.
#
# Usage:
#   ./deploy-vercel.sh
#
# Prereq: install the Vercel CLI once (`npm i -g vercel`) and run `vercel login`.

set -euo pipefail

cd "$(dirname "$0")"

if ! command -v vercel >/dev/null 2>&1; then
  echo "[deploy-vercel] ERR  Vercel CLI not found. Install with: npm i -g vercel" >&2
  exit 1
fi

echo "[deploy-vercel] Authenticating with Vercel (opens browser if not already logged in)..."
vercel whoami >/dev/null
echo "[deploy-vercel] OK   Logged in as: $(vercel whoami)"

echo "[deploy-vercel] Deploying a preview build..."
PREVIEW=$(vercel --yes)
echo "[deploy-vercel] OK   Preview URL: $PREVIEW"

read -r -p "Promote preview to production now? (yes/no) " answer
if [ "$answer" = "yes" ]; then
  echo "[deploy-vercel] Promoting to production..."
  PROD=$(vercel --prod --yes)
  echo "[deploy-vercel] OK   Production URL: $PROD"
else
  echo "[deploy-vercel] WARN Skipped prod promotion. Re-run with --prod when ready."
fi
