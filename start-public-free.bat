@echo off
setlocal enabledelayedexpansion
title CoinSwag Zero-KYC Public Launcher

echo ================================================================
echo    CoinSwag Automated Crypto Swap - Zero-KYC Public Launcher
echo ================================================================
echo.

:: 1. Verify Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Check if build exists, if not build it
if not exist "apps\web\dist\index.html" (
    echo [*] Production build not found. Compiling CoinSwag (takes ~1-2 min)...
    call npm.cmd run build
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Build failed. Please inspect errors above.
        pause
        exit /b 1
    )
)

:: 3. Start CoinSwag Production Server (Unified API + Web Proxy)
echo [*] Starting CoinSwag Production Server on localhost:5173 (API: 3001)...
start "CoinSwag Server Engine" /min cmd /c "node server-prod.js"

:: Wait 3 seconds for server boot
timeout /t 3 /nobreak >nul

:: 4. Check for cloudflared.exe
if not exist "cloudflared.exe" (
    echo [*] Downloading Cloudflare Tunnel Client (Standalone .exe, No Account Needed)...
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe', 'cloudflared.exe')"
    if not exist "cloudflared.exe" (
        echo [!] Cloudflare download failed. Switching to Pinggy SSH Tunnel (Zero Install)...
        goto PINGGY_FALLBACK
    )
)

echo.
echo ================================================================
echo  ESTABLISHING ZERO-KYC ENCRYPTED PUBLIC TUNNEL...
echo  - Zero Identity / Zero KYC / Zero Credit Card
echo  - Source Code is 100%% Private (Runs locally in memory)
echo ================================================================
echo.
echo Look for your public HTTPS link below:
echo.

.\cloudflared.exe tunnel --url http://localhost:5173
goto CLEANUP

:PINGGY_FALLBACK
echo.
echo [*] Launching instant fallback tunnel via Pinggy SSH...
ssh -p 443 -R0:localhost:5173 a.pinggy.io

:CLEANUP
echo.
echo [*] Stopping background CoinSwag server...
taskkill /F /FI "WINDOWTITLE eq CoinSwag Server Engine*" >nul 2>nul
echo Done.
