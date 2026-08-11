# deploy-vercel.ps1
# AC-14 helper: deploys the local FlavorFind repo to Vercel via the CLI.
# Use this if you do NOT want to push to GitHub first - Vercel can deploy a
# local folder directly.
#
# Usage:
#   .\deploy-vercel.ps1
#
# Prereq: install the Vercel CLI once (`npm i -g vercel`) and run `vercel login`.

$ErrorActionPreference = "Stop"

function Step($msg) { Write-Host "[deploy-vercel] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[deploy-vercel] OK  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[deploy-vercel] WARN $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[deploy-vercel] ERR  $msg" -ForegroundColor Red }

Set-Location $PSScriptRoot

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Err "Vercel CLI not found. Install with: npm i -g vercel"
    exit 1
}

Step "Authenticating with Vercel (opens browser if not already logged in)..."
vercel whoami | Out-Null
Ok "Logged in as: $(vercel whoami)"

Step "Deploying a preview build..."
$preview = vercel --yes
Ok "Preview URL: $preview"

$answer = Read-Host "Promote preview to production now? (yes/no)"
if ($answer -eq "yes") {
    Step "Promoting to production..."
    $prod = vercel --prod --yes
    Ok "Production URL: $prod"
} else {
    Warn "Skipped prod promotion. Re-run with --prod when ready."
}
