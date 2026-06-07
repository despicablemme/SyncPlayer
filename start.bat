@echo off
REM ==========================================
REM  🎬 SyncPlay - Windows 一键启动
REM ==========================================
REM  启动信令服务器 + Web 客户端 + 自动打开浏览器
REM  关闭：运行 stop.bat
REM ==========================================

chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ===================================
echo  🎬 SyncPlay - 一键启动
echo ===================================
echo.

REM 脚本所在目录
set "SCRIPT_DIR=%~dp0"
set "LOG_DIR=%TEMP%\syncplay"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM ============ 自动安装辅助函数 ============
REM 检测到环境丢失,尝试用包管理器装:winget(优先) -> choco(兑底) -> 手动
REM 全部失败才退出

REM 跳到错信息标签(变量不像函数能 return,用 goto 模拟)
goto :main_start

REM --- Node.js 安装 ---
:ensure_node
where node >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('node --version') do echo   [OK] Node.js %%v
  exit /b 0
)

echo   [!] Node.js 未安装,尝试自动安装...

REM 方案 1: winget (Win 10/11 自带)
where winget >nul 2>&1
if %errorlevel% equ 0 (
  echo   [...] 用 winget 安装 Node.js LTS...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  if %errorlevel% equ 0 (
    REM 刷新 PATH 以让当前 shell 找到 node
    call :refresh_path
    where node >nul 2>&1
    if %errorlevel% equ 0 (
      for /f "delims=" %%v in ('node --version') do echo   [OK] Node.js %%v
      exit /b 0
    )
  )
)

REM 方案 2: Chocolatey
where choco >nul 2>&1
if %errorlevel% equ 0 (
  echo   [...] 用 Chocolatey 安装 Node.js LTS...
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

REM 全部失败
echo   [X] 自动安装失败
echo       请手动安装: https://nodejs.org/
echo       (下载 LTS 版本,运行安装包,默认选项即可)
pause
exit /b 1

REM --- Python 安装 ---
:ensure_python
set "PYTHON_CMD="
where python3 >nul 2>&1
if %errorlevel% equ 0 (
  set "PYTHON_CMD=python3"
) else (
  where python >nul 2>&1
  if %errorlevel% equ 0 set "PYTHON_CMD=python"
)
if defined PYTHON_CMD (
  for /f "delims=" %%v in ('%PYTHON_CMD% --version 2^>^&1') do echo   [OK] Python %%v
  exit /b 0
)

echo   [!] Python 未安装,尝试自动安装...

where winget >nul 2>&1
if %errorlevel% equ 0 (
  echo   [...] 用 winget 安装 Python...
  winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
  if %errorlevel% equ 0 (
    call :refresh_path
    set "PYTHON_CMD="
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
  echo   [...] 用 Chocolatey 安装 Python...
  choco install python -y
  if %errorlevel% equ 0 (
    call :refresh_path
    set "PYTHON_CMD="
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

echo   [X] 自动安装失败
echo       请手动安装: https://www.python.org/downloads/windows/
echo       (安装时记得勾选 "Add Python to PATH")
pause
exit /b 1

REM 刷新当前 shell 的 PATH(从注册表重读)
:refresh_path
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYSTEM_PATH=%%a"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%a"
set "PATH=%SYSTEM_PATH%;%USER_PATH%;%PATH%"
exit /b 0

REM wait_for_port PORT MAX_SECONDS
REM 轮询端口直到 LISTEN,超时返回 1,成功返回 0
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

:main_start
echo.
echo ===================================
echo  [OK] SyncPlay - 一键启动
echo ===================================
echo.

REM ===== 1. Node 检查 + 自动安装 =====
echo [Check] 检查 Node.js...
call :ensure_node
if %errorlevel% neq 0 exit /b 1

REM ===== 2. Python 检查 + 自动安装 =====
echo [Check] 检查 Python...
set "PYTHON_CMD="
call :ensure_python
if %errorlevel% neq 0 exit /b 1
REM 确保 PYTHON_CMD 被设置(从 ensure_python 返回后应该已有)
where python3 >nul 2>&1
if %errorlevel% equ 0 set "PYTHON_CMD=python3"
where python >nul 2>&1
if %errorlevel% equ 0 if not defined PYTHON_CMD set "PYTHON_CMD=python"

REM ===== 3. 清理已占用端口 =====
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9000 ^| findstr LISTENING') do (
  echo   [!] 清理端口 9000 ^(PID: %%a^)
  taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
  echo   [!] 清理端口 8080 ^(PID: %%a^)
  taskkill /F /PID %%a >nul 2>&1
)

REM ===== 4. 装依赖（首次）=====
if not exist "%SCRIPT_DIR%src\server\node_modules" (
  echo.
  echo [*] 首次启动，安装服务端依赖...
  pushd "%SCRIPT_DIR%src\server"
  call npm install
  popd
  if exist "%SCRIPT_DIR%src\server\node_modules" (
    echo   [OK] 依赖安装完成
  ) else (
    echo [X] 依赖安装失败
    pause
    exit /b 1
  )
)

REM ===== 5. 启动信令服务器 =====
echo.
echo [*] 启动信令服务器 ^(端口 9000^)...
pushd "%SCRIPT_DIR%src\server"
start "SyncPlay-Server" /B cmd /c "npm start > "%LOG_DIR%\server.log" 2>&1"
popd

REM 健康检查:端口 9000 是否在 10s 内监听
call :wait_for_port 9000 10
if %errorlevel% neq 0 (
  echo   [X] 端口 9000 未在 10s 内监听
  echo       日志文件: %LOG_DIR%\server.log
  echo.
  echo   --- 日志内容 ---
  type "%LOG_DIR%\server.log"
  echo   --- 日志结束 ---
  pause
  exit /b 1
)
echo   [OK] 信令服务器已启动 (port 9000)

REM ===== 6. 启动客户端 =====
REM 注意:HTTP 服务根目录是 src\(不是 client\),为了让 ../shared/ 路径能服务
echo [*] 启动 Web 客户端 ^(端口 8080^)...
pushd "%SCRIPT_DIR%src"
start "SyncPlay-Client" /B cmd /c "%PYTHON_CMD% -m http.server 8080 > "%LOG_DIR%\client.log" 2>&1"
popd

REM 健康检查:端口 8080 是否在 10s 内监听
call :wait_for_port 8080 10
if %errorlevel% neq 0 (
  echo   [X] 端口 8080 未在 10s 内监听
  echo       日志文件: %LOG_DIR%\client.log
  echo.
  echo   --- 日志内容 ---
  type "%LOG_DIR%\client.log"
  echo   --- 日志结束 ---
  REM 清理:杀掉已起的 server
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9000 ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
  pause
  exit /b 1
)
echo   [OK] 客户端已启动 (port 8080)

REM ===== 7. 打开浏览器 =====
echo [*] 打开浏览器...
start "" "http://localhost:8080/client/"

REM ===== 8. 提示 =====
echo.
echo ===================================
echo  [OK] SyncPlay 已就绪！
echo ===================================
echo.
echo   [Web]  客户端:    http://localhost:8080/client/
echo   [Sig]  信令服务器: http://localhost:9000
echo.
echo [Tips] 使用方法：
echo   1. 选择视频 - 创建房间 - 复制房间号
echo   2. 另一个窗口/设备打开同一网址
echo   3. 输入房间号加入 - 加载同一个视频
echo.
echo [X] 关闭服务：双击 stop.bat
echo.
echo (此窗口可关闭，服务会在后台继续运行)
echo (日志位置: %LOG_DIR%\)
echo.
echo 3 秒后自动关闭...
timeout /t 3 /nobreak >nul
