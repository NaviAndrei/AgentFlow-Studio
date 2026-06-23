# scripts/pre-push-check.ps1
# AgentFlow Studio - pre-push verification (Windows 11 native)
# Usage: .\scripts\pre-push-check.ps1
# Dry run: .\scripts\pre-push-check.ps1 -DryRun
[CmdletBinding()]
param([switch]$DryRun)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# --- Helper: timestamped log ---
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message"
}

# --- Helper: run npm command, stream output, set $LASTEXITCODE ---
function Invoke-Npm {
    param([string]$Arguments)
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $argList = $Arguments -split '\s+'
        & npm @argList
    } finally {
        $ErrorActionPreference = $prevPref
    }
}

# ============================================================
# 1. SAFETY CHECKS (fail fast)
# ============================================================

Write-Log "Starting AgentFlow Studio pre-push checks..."

# 1a. Node >= 18
try {
    $nodeVersionRaw = (node --version 2>&1)
    if ($nodeVersionRaw -match '^v(\d+)') {
        $nodeMajor = [int]$Matches[1]
        if ($nodeMajor -lt 18) {
            Write-Error "Node.js version $nodeVersionRaw is below v18. Please upgrade."
            exit 1
        }
        Write-Log "Node.js $nodeVersionRaw detected (>= v18 OK)"
    } else {
        Write-Error "Could not parse Node.js version from: $nodeVersionRaw"
        exit 1
    }
} catch {
    Write-Error "node is not installed or not on PATH. Install Node.js >= 18."
    exit 1
}

# 1b. npm exists
try {
    $npmVersion = (npm --version 2>&1)
    Write-Log "npm v$npmVersion detected"
} catch {
    Write-Error "npm is not installed or not on PATH."
    exit 1
}

# 1c. package.json in current directory
if (-not (Test-Path -Path "package.json")) {
    Write-Error "Run from repo root - package.json not found in $(Get-Location)"
    exit 1
}
Write-Log "package.json found"

# ============================================================
# 2. DRY RUN MODE
# ============================================================

if ($DryRun) {
    Write-Log "=== DRY RUN MODE ==="
    Write-Host '[DRY RUN] Would run: npm run typecheck'
    Write-Host '[DRY RUN] Would run: npm run build'
    Write-Host '[DRY RUN] Would run: npm run test -- --run'
    Write-Log "Dry run complete. No commands executed."
    exit 0
}

# ============================================================
# 3. RUN CHECKS IN SEQUENCE (stop on first failure)
# ============================================================

# Step A: Typecheck
Write-Log "Running typecheck..."
Invoke-Npm 'run typecheck'
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host ([char]0x274C + " Typecheck failed. Fix type errors before push.") -ForegroundColor Red
    exit 1
}
Write-Log "Typecheck passed"

# Step B: Build
Write-Log "Running build..."
Invoke-Npm 'run build'
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host ([char]0x274C + " Build failed. Fix build errors before push.") -ForegroundColor Red
    exit 1
}
Write-Log "Build passed"

# Step C: Tests
Write-Log "Running tests..."
Invoke-Npm 'run test -- --run'
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host ([char]0x274C + " Tests failed. All tests must pass before push.") -ForegroundColor Red
    exit 1
}
Write-Log "Tests passed"

# ============================================================
# 4. BUILD SIZE REPORT
# ============================================================

if (Test-Path -Path "dist") {
    $distSize = (Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum).Sum
    $distKB = [math]::Round($distSize / 1024)
    $gzipEstKB = [math]::Round($distKB * 0.35)
    Write-Host ""
    Write-Host ([char]::ConvertFromUtf32(0x1F4E6) + " Build size: $distKB KB (gzip estimate: ~$gzipEstKB KB)")
} else {
    Write-Log "WARNING: dist/ folder not found after build. Skipping size report."
}

# ============================================================
# 5. SUCCESS
# ============================================================

Write-Host ""
Write-Host ([char]0x2705 + " AgentFlow Studio pre-push check passed.") -ForegroundColor Green
Write-Host ("   Typecheck " + [char]0x2705 + " | Build " + [char]0x2705 + " | Tests " + [char]0x2705) -ForegroundColor Green
exit 0
