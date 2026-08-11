#!/usr/bin/env bash
# deploy-github.sh
# AC-13 helper: pushes the local FlavorFind repo to a user-supplied GitHub URL.
#
# Usage:
#   ./deploy-github.sh https://github.com/<your-username>/<repo>.git
#
# This script will:
#   1. Validate the URL looks like a GitHub HTTPS URL.
#   2. Check that the working tree is clean.
#   3. Add (or replace) the `origin` remote.
#   4. Push the `master` branch and set upstream.
#   5. Print the public GitHub URL on success.
#
# It does NOT create the GitHub repo for you - you must create an empty repo at
# https://github.com/new first (do not initialize with README/.gitignore/license,
# this repo already has those).

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "[deploy-github] ERR  Usage: $0 https://github.com/<user>/<repo>.git" >&2
  exit 1
fi

REPO_URL="$1"

if ! echo "$REPO_URL" | grep -Eq '^https://github\.com/[^/]+/[^/]+(\.git)?/?$'; then
  echo "[deploy-github] ERR  RepoUrl must look like https://github.com/<user>/<repo>.git" >&2
  exit 1
fi

cd "$(dirname "$0")"

echo "[deploy-github] Working dir: $(pwd)"

# Working tree clean?
if [ -n "$(git status --porcelain)" ]; then
  echo "[deploy-github] WARN Working tree is dirty; uncommitted changes will NOT be pushed."
  git status --porcelain | sed 's/^/[deploy-github]   /'
  read -r -p "Continue anyway? (yes/no) " answer
  if [ "$answer" != "yes" ]; then
    echo "[deploy-github] ERR  Aborted by user." >&2
    exit 1
  fi
else
  echo "[deploy-github] OK   Working tree is clean."
fi

# Add or replace origin remote
EXISTING=$(git remote get-url origin 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "[deploy-github] Replacing existing origin remote ($EXISTING) -> $REPO_URL"
  git remote remove origin
fi
git remote add origin "$REPO_URL"
echo "[deploy-github] OK   Remote origin -> $REPO_URL"

# Push
echo "[deploy-github] Pushing master -> origin (this may prompt for GitHub credentials)..."
git push -u origin master

PUBLIC_URL=$(echo "$REPO_URL" | sed -E 's/\.git$//')
echo ""
echo "[deploy-github] OK   GitHub URL: $PUBLIC_URL"
echo "[deploy-github] Next step: open https://vercel.com/new and Import this repo."
