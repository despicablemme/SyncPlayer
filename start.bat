@echo off
REM ==========================================
REM   SyncPlay - Windows One-Click Launcher
REM ==========================================
REM   Starts signaling server (port 9000) and
REM   static HTTP server (port 8080), then opens browser.
REM   Auto-installs Node.js / Python if missing.
REM
REM   ASCII-only, no delayed expansion, no UTF-8
REM   to avoid Chinese Windows encoding issues.
REM ==========================================

echo.
echo ===================================
echo   SyncPlay Launcher
echo   Press any key to start...
echo ===================================
echo.
pause >nul

setlocal

REM Script location and log directory
set "SCRIPT_DIR=%~dp0"
set "LOG_DIR=%TEMP%\syncplay"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM ============================================
REM   Auto-install helpers
REM ============================================

REM Jump to main (skip function definitions)
goto :main_start

REM --- Node.js installer ---
:ensure_node
where node >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('node --version') do echo   [OK] Node.js %%v
  exit /b 0
)

echo   [!] Node.js NOT found, attempting auto-install...

REM Try winget first (Win 10 1709+ and Win 11)
where winget >nul 2>&1
if %errorlevel% equ 0 (
  echo   [...] Installing via winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  if %errorlevel% equ 0 (
    call :refresh_path
    where node >nul 2>&1
    if %errorlevel% equ 0 (
      for /f "delims=" %%v in ('node --version') do echo   [OK] Node.js %%v
      exit /b 0
    )
  )
)

REM Try Chocolatey
where choco >nul 2>&1
if %errorlevel% equ 0 (
  echo   [...] Installing via Chocolatey...
  choco install nodejs-lts -y
  if %errorlevel% equ 0 (
    call :refresh_path
    where node >nul 2>&1
    if %errorlevel% equ 0 (
      for /f "delims=" %%v in ('node --version') do echo   [OK] Node.js %%v
      exit /b 0
    )
  )
)

REM All failed
echo   [X] Auto-install FAILED
echo       Please install manually: https://nodejs.org/
echo       (Download LTS, run installer, default options)
pause
exit /b 1

REM --- Python installer ---
:ensure_python
where python3 >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('python3 --version 2^>^&1') do echo   [OK] Python %%v
  set "PYTHON_CMD=python3"
  exit /b 0
)
where python >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('python --version 2^>^&1') do echo   [OK] Python %%v
  set "PYTHON_CMD=python"
  exit /b 0
)

echo   [!] Python NOT found, attempting auto-install...

where winget >nul 2>&1
if %errorlevel% equ 0 (
  echo   [...] Installing via winget...
  winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
  if %errorlevel% equ 0 (
    call :refresh_path
    where python3 >nul 2>&1
    if %errorlevel% equ 0 set "PYTHON_CMD=python3"
    where python >nul 2>&1
    if %errorlevel% equ 0 if not defined PYTHON_CMD set "PYTHON_CMD=python"
    if defined PYTHON_CMD (
      for /f "delims=" %%v in ('%PYTHON_CMD% --version 2^>^&1') do echo   [OK] Python %%v
      exit /b 0
    )
  )
)

where choco >nul 2>&1
if %errorlevel% equ 0 (
  echo   [...] Installing via Chocolatey...
  choco install python -y
  if %errorlevel% equ 0 (
    call :refresh_path
    where python3 >nul 2>&1
    if %errorlevel% equ 0 set "PYTHON_CMD=python3"
    where python >nul 2>&1
    if %errorlevel% equ 0 if not defined PYTHON_CMD set "PYTHON_CMD=python"
    if defined PYTHON_CMD (
      for /f "delims=" %%v in ('%PYTHON_CMD% --version 2^>^&1') do echo   [OK] Python %%v
      exit /b 0
    )
  )
)

echo   [X] Auto-install FAILED
echo       Please install manually: https://www.python.org/downloads/windows/
echo       (Remember to check "Add Python to PATH" during install)
pause
exit /b 1

REM --- Refresh PATH from registry + hardcoded node.js locations ---
:refresh_path
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYSTEM_PATH=%%a"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%a"
set "PATH=%SYSTEM_PATH%;%USER_PATH%;%PATH%"

REM Hardcode common node.js install locations
REM (Win10 has known issues with registry PATH refresh after winget)
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
exit /b 0

REM --- Wait for port to be listening (timeout in seconds) ---
:wait_for_port
set "WP_PORT=%~1"
set "WP_MAX=%~2"
set "WP_ELAPSED=0"
:wait_loop
if %WP_ELAPSED% geq %WP_MAX% exit /b 1
netstat -ano | findstr :%WP_PORT% | findstr LISTENING >nul
if %errorlevel% equ 0 exit /b 0
timeout /t 1 /nobreak >nul
set /a "WP_ELAPSED=WP_ELAPSED+1"
goto :wait_loop

REM ============================================
REM   Main flow
REM ============================================
:main_start
echo.
echo ===================================
echo  SyncPlay - One-Click Launcher
echo ===================================
echo.

REM ===== 1. Node check + auto-install =====
echo [Check] Node.js...
call :ensure_node
if %errorlevel% neq 0 exit /b 1

REM ===== 2. Python check + auto-install =====
echo [Check] Python...
set "PYTHON_CMD="
call :ensure_python
if %errorlevel% neq 0 exit /b 1
REM Make sure PYTHON_CMD is set (defensive)
where python3 >nul 2>&1
if %errorlevel% equ 0 set "PYTHON_CMD=python3"
where python >nul 2>&1
if %errorlevel% equ 0 if not defined PYTHON_CMD set "PYTHON_CMD=python"

REM ===== 3. Clean up occupied ports =====
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9000 ^| findstr LISTENING') do (
  echo   [!] Killing port 9000 (PID: %%a)
  taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
  echo   [!] Killing port 8080 (PID: %%a)
  taskkill /F /PID %%a >nul 2>&1
)

REM ===== 4. Install server deps (first run) =====
if not exist "%SCRIPT_DIR%src\server\node_modules" (
  echo.
  echo [Install] First run, installing server dependencies...
  pushd "%SCRIPT_DIR%src\server"
  call npm install
  popd
  if exist "%SCRIPT_DIR%src\server\node_modules" (
    echo   [OK] Dependencies installed
  ) else (
    echo   [X] npm install FAILED
    pause
    exit /b 1
  )
)

REM ===== 5. Start signaling server =====
echo.
echo [Start] Signaling server (port 9000)...
if not exist "%SCRIPT_DIR%src\server" (
  echo.
  echo   *** ERROR: Cannot find src\server directory ***
  echo   Script location: %SCRIPT_DIR%
  echo   Please make sure you copied the entire project (including src/ folder).
  echo.
  pause
  exit /b 1
)
pushd "%SCRIPT_DIR%src\server"
start "SyncPlay-Server" /B cmd /c "npm start > "%LOG_DIR%\server.log" 2>&1"
popd

REM Health check: port 9000 must be listening within 10s
call :wait_for_port 9000 10
if %errorlevel% neq 0 (
  echo   [X] Port 9000 NOT listening within 10s
  echo       Log file: %LOG_DIR%\server.log
  echo.
  echo   --- Log content ---
  if exist "%LOG_DIR%\server.log" (
    type "%LOG_DIR%\server.log"
  ) else (
    echo       (log file does not exist - server may have failed to start)
  )
  echo   --- End of log ---
  pause
  exit /b 1
)
echo   [OK] Signaling server started (port 9000)

REM ===== 6. Start client (HTTP server) =====
REM Note: HTTP server root is src/ (not client/), so ../shared/ paths work
echo [Start] Web client (port 8080)...
if not exist "%SCRIPT_DIR%src" (
  echo   *** ERROR: Cannot find src directory ***
  pause
  exit /b 1
)
pushd "%SCRIPT_DIR%src"
start "SyncPlay-Client" /B cmd /c "%PYTHON_CMD% -m http.server 8080 > "%LOG_DIR%\client.log" 2>&1"
popd

REM Health check: port 8080 must be listening within 10s
call :wait_for_port 8080 10
if %errorlevel% neq 0 (
  echo   [X] Port 8080 NOT listening within 10s
  echo       Log file: %LOG_DIR%\client.log
  echo.
  echo   --- Log content ---
  if exist "%LOG_DIR%\client.log" (
    type "%LOG_DIR%\client.log"
  ) else (
    echo       (log file does not exist - client may have failed to start)
  )
  echo   --- End of log ---
  REM Cleanup: kill the server we started
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
  pause
  exit /b 1
)
echo   [OK] Client started (port 8080)

REM ===== 7. Open browser =====
echo.
echo [Open] Browser...
start "" "http://localhost:8080/client/"

REM ===== 8. Final message =====
echo.
echo ===================================
echo  SyncPlay is ready!
echo ===================================
echo.
echo   [Web]  Client:    http://localhost:8080/client/
echo   [Sig]  Signaling: http://localhost:9000
echo.
echo   [Tips] How to use:
echo     1. Pick a video, click "Create Room", copy the room ID
echo     2. Open same URL in another window/device
echo     3. Click "Join Room", enter the room ID
echo.
echo   [Stop] Run stop.bat to stop both services
echo.
echo (You can close this window - services keep running in background)
echo (Log location: %LOG_DIR%\)
echo.
pause
