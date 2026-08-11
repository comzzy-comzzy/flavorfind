# deploy-github.ps1
# AC-13 helper: pushes the local FlavorFind repo to a user-supplied GitHub URL.
#
# Usage:
#   .\deploy-github.ps1 -RepoUrl "https://github.com/<your-username>/<repo>.git"
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

param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl
)

$ErrorActionPreference = "Stop"

function Write-Step($msg)  { Write-Host "[deploy-github] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "[deploy-github] OK  $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[deploy-github] WARN $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "[deploy-github] ERR  $msg" -ForegroundColor Red }

# 1. Validate the URL
if ($RepoUrl -notmatch '^https://github\.com/[^/]+/[^/]+(\.git)?/?$') {
    Write-Err "RepoUrl must look like https://github.com/<user>/<repo>.git"
    exit 1
}

# 2. Working tree clean?
$status = git status --porcelain
if ($status) {
    Write-Warn "Working tree is dirty; uncommitted changes will NOT be pushed."
    Write-Warn "Files:"; $status | ForEach-Object { Write-Warn "  $_" }
    $answer = Read-Host "Continue anyway? (yes/no)"
    if ($answer -ne "yes") {
        Write-Err "Aborted by user."
        exit 1
    }
} else {
    Write-Ok "Working tree is clean."
}

# 3. Add or replace origin remote
$existing = git remote get-url origin 2>$null
if ($existing) {
    Write-Step "Replacing existing origin remote ($existing) -> $RepoUrl"
    git remote remove origin
}
git remote add origin $RepoUrl
Write-Ok "Remote origin -> $RepoUrl"

# 4. Push
Write-Step "Pushing master -> origin (this may prompt for GitHub credentials)..."
git push -u origin master
if ($LASTEXITCODE -ne 0) {
    Write-Err "git push failed (exit $LASTEXITCODE). Check credentials and try again."
    exit $LASTEXITCODE
}
Write-Ok "Push complete."

# 5. Print public URL
$publicUrl = $RepoUrl -replace '\.git$', ''
Write-Host ""
Write-Ok "GitHub URL: $publicUrl"
Write-Host "Next step: open https://vercel.com/new and Import this repo." -ForegroundColor Cyan
