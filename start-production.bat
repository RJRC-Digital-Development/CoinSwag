@echo off
TITLE CoinSwag Production Launcher (Zero-KYC Monero Hub)
echo ======================================================================
echo           COINSWAG AUTOMATED ZERO-KYC CRYPTO SWAP ENGINE
echo               Monero (XMR) Zero-Knowledge Privacy Hub
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] Building all monorepo packages in dependency order...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed! Please inspect logs above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Checking PM2 process manager...
call npx --no-install pm2 -v >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Starting production cluster via PM2...
    call npx pm2 start ecosystem.config.cjs
    call npx pm2 status
) else (
    echo PM2 not installed globally. Starting via npx pm2...
    call npx pm2 start ecosystem.config.cjs
)

echo.
echo ======================================================================
echo [3/3] COINSWAG PRODUCTION CLUSTER RUNNING!
echo.
echo   * Web App:          http://localhost:5173
echo   * Backend REST API: http://localhost:3001
echo   * Health Check:     http://localhost:3001/health
echo   * Monero Hub:       Active (0.45%% / 0.75%% Zero-KYC Routing)
echo.
echo To manage processes:
echo   npx pm2 status
echo   npx pm2 logs
echo   npx pm2 stop all
echo ======================================================================
pause
