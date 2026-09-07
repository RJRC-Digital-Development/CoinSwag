# CoinSwag Zero-KYC Public Launcher (PowerShell)
$Host.UI.RawUI.WindowTitle = "CoinSwag Zero-KYC Public Launcher"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   CoinSwag Automated Crypto Swap - Zero-KYC Public Launcher   " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not installed." -ForegroundColor Red
    exit 1
}

# 2. Check Build
if (-not (Test-Path "apps\web\dist\index.html")) {
    Write-Host "[*] Production build not found. Compiling project..." -ForegroundColor Yellow
    npm.cmd run build
}

# 3. Start Production Server
Write-Host "[*] Starting CoinSwag server engine..." -ForegroundColor Green
$serverJob = Start-Process -FilePath "node" -ArgumentList "server-prod.js" -PassThru -WindowStyle Hidden

Start-Sleep -Seconds 3

# 4. Check for cloudflared.exe
if (-not (Test-Path "cloudflared.exe")) {
    Write-Host "[*] Downloading Cloudflare Quick Tunnel (No Account / No KYC)..." -ForegroundColor Yellow
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " ESTABLISHING ZERO-KYC PUBLIC HTTPS TUNNEL...                   " -ForegroundColor Green
Write-Host " - 100% Free / Zero Credit Card / Zero KYC                      " -ForegroundColor Green
Write-Host " - Source Code Remains 100% Private (Runs only on your PC)      " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    if (Test-Path "cloudflared.exe") {
        .\cloudflared.exe tunnel --url http://localhost:5173
    } else {
        Write-Host "[*] Using SSH fallback tunnel..." -ForegroundColor Yellow
        ssh -p 443 -R0:localhost:5173 a.pinggy.io
    }
} finally {
    Write-Host "`n[*] Shutting down local CoinSwag server..." -ForegroundColor Yellow
    if ($serverJob -and -not $serverJob.HasExited) {
        Stop-Process -Id $serverJob.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[✔] Clean shutdown complete." -ForegroundColor Green
}
