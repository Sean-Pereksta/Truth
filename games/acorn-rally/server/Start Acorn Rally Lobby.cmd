@echo off
setlocal
pushd "%~dp0" || exit /b 1
set "ACORN_LOBBY_NODE=..\runtime\node.exe"
if not exist "%ACORN_LOBBY_NODE%" (
  where.exe node.exe >nul 2>nul
  if errorlevel 1 (
    echo Node.js 18 or newer is required if the bundled runtime is missing.
    popd
    if /i not "%~1"=="--no-open" pause
    exit /b 1
  )
  set "ACORN_LOBBY_NODE=node.exe"
)
set "ACORN_LOBBY_OPEN=--open"
if /i "%~1"=="--no-open" set "ACORN_LOBBY_OPEN="
"%ACORN_LOBBY_NODE%" "lobby-supervisor.cjs" %ACORN_LOBBY_OPEN%
set "ACORN_LOBBY_EXIT=%ERRORLEVEL%"
popd
if not "%ACORN_LOBBY_EXIT%"=="0" if /i not "%~1"=="--no-open" pause
exit /b %ACORN_LOBBY_EXIT%
