# CoinSwag Native Production Launcher (Zero-Docker PowerShell Runner)
Write-Host "======================================================================" -ForegroundColor DarkCyan
Write-Host "          COINSWAG AUTOMATED ZERO-KYC CRYPTO SWAP ENGINE" -ForegroundColor Yellow
Write-Host "              Monero (XMR) Zero-Knowledge Privacy Hub" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor DarkCyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "[1/3] Building all monorepo packages in dependency order..." -ForegroundColor Cyan
npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed! Exiting." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "[2/3] Launching production cluster via PM2..." -ForegroundColor Cyan
npx.cmd pm2 start ecosystem.config.cjs
npx.cmd pm2 status

Write-Host ""
Write-Host "======================================================================" -ForegroundColor DarkCyan
Write-Host "[3/3] COINSWAG PRODUCTION CLUSTER RUNNING LIVE!" -ForegroundColor Green
Write-Host "  * Web App:          http://localhost:5173" -ForegroundColor White
Write-Host "  * Backend REST API: http://localhost:3001" -ForegroundColor White
Write-Host "  * Health Check:     http://localhost:3001/health" -ForegroundColor White
Write-Host "  * Monero Hub:       Active (0.45% / 0.75% Zero-KYC Routing)" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor DarkCyan
