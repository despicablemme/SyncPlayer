@echo off
REM ==========================================
REM   SyncPlay Environment Diagnostic v1.0
REM   ASCII-only, no delayed expansion, no UTF-8
REM   Run: double-click diagnose.bat, copy output to developer
REM ==========================================

setlocal
echo.
echo ============================================================
echo   SyncPlay Environment Diagnostic v1.0
echo ============================================================
echo   Time: %date% %time%
echo   Computer: %COMPUTERNAME%
echo   User: %USERNAME%
echo ============================================================
echo.

REM ============= [1/8] Project Structure =============
echo [1/8] Project Structure
echo   Script location: %~dp0
if exist "%~dp0start.bat" (echo   [OK] start.bat) else (echo   [X] Missing: start.bat)
if exist "%~dp0stop.bat"  (echo   [OK] stop.bat)  else (echo   [!]  Missing: stop.bat (optional))
if exist "%~dp0package.json" (echo   [OK] package.json) else (echo   [X] Missing: package.json)
echo   Key directories:
for %%d in (src src\server src\client src\shared test\unit test\e2e test\network docs) do (
  if exist "%~dp0%%d" (echo      [OK] %%d) else (echo      [X] %%d)
)
if exist "%~dp0src\server\node_modules" (
  echo   [OK] src\server\node_modules
) else (
  echo   [!]  src\server\node_modules (will be installed on first start)
)
echo.

REM ============= [2/8] Node.js =============
echo [2/8] Node.js
where node >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('node --version 2^>^&1') do echo   [OK] node: %%v
  for /f "delims=" %%p in ('where node 2^>^&1') do echo       Path: %%p
) else (
  echo   [X] node NOT in PATH
  echo       Checking common install locations:
  if exist "C:\Program Files\nodejs\node.exe" (
    echo       [OK] C:\Program Files\nodejs\node.exe (exists but not in PATH)
  ) else (
    if exist "C:\Program Files (x86)\nodejs\node.exe" (
      echo       [OK] C:\Program Files (x86)\nodejs\node.exe
    ) else (
      if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
        echo       [OK] %LOCALAPPDATA%\Programs\nodejs\node.exe
      ) else (
        echo       (Not found in common locations)
      )
    )
  )
)
echo.

REM ============= [3/8] Python =============
echo [3/8] Python
where python3 >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('python3 --version 2^>^&1') do echo   [OK] python3: %%v
) else (
  where python >nul 2>&1
  if %errorlevel% equ 0 (
    for /f "delims=" %%v in ('python --version 2^>^&1') do echo   [OK] python: %%v
  ) else (
    echo   [X] python NOT in PATH
  )
)
echo.

REM ============= [4/8] Package Managers =============
echo [4/8] Package Managers
where winget >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('winget --version 2^>^&1') do echo   [OK] winget: %%v
) else (
  echo   [X] winget NOT available
)
where choco >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('choco --version 2^>^&1') do echo   [OK] choco: %%v
) else (
  echo   -  choco NOT available
)
echo.

REM ============= [5/8] Port Usage =============
echo [5/8] Port Usage
for %%p in (8080 9000) do (
  netstat -ano | findstr :%%p | findstr LISTENING >nul 2>&1
  if %errorlevel% equ 0 (
    echo   [!]  Port %%p is IN USE:
    netstat -ano | findstr :%%p | findstr LISTENING
  ) else (
    echo   [OK] Port %%p is free
  )
)
echo.

REM ============= [6/8] Network to TURN =============
echo [6/8] Network to Metered TURN Server
ping -n 2 -w 3 global.relay.metered.ca >nul 2>&1
if %errorlevel% equ 0 (
  echo   [OK] Reachable: global.relay.metered.ca
) else (
  echo   [X] NOT reachable: global.relay.metered.ca
  echo       May be blocked by firewall/network
)
echo.

REM ============= [7/8] System Info =============
echo [7/8] System Info
echo   Windows:
ver
net session >nul 2>&1
if %errorlevel% equ 0 (echo   [OK] Administrator) else (echo   [!]  NOT Administrator (installing may need admin))
echo.

REM ============= [8/8] PATH =============
echo [8/8] PATH (entries containing node/python/winget/choco)
for %%p in ("%PATH:;=" "%") do (
  echo %%p | findstr /I "node python winget choco" >nul
  if %errorlevel% equ 0 echo    %%p
)
echo.

echo ============================================================
echo   Diagnostic complete
echo ============================================================
echo.
echo   Select-all (Ctrl+A) in this window, copy, paste to developer.
echo   Or save to file:  diagnose.bat ^> diagnose-output.txt
echo.
pause
