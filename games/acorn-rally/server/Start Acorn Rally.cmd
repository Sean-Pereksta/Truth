@echo off
setlocal
cd /d "%~dp0"
if exist "..\runtime\node.exe" (
  "..\runtime\node.exe" "host.cjs" --open
) else (
  where node >nul 2>&1
  if errorlevel 1 (
    echo Install Node.js 18 or newer from https://nodejs.org and run this file again.
    pause
    exit /b 1
  )
  node "host.cjs" --open
)
if errorlevel 1 pause
