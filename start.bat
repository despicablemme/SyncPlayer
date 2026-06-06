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

REM ===== 1. Node 检查 =====
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [X] Node.js 未安装
  echo     请访问 https://nodejs.org/ 安装
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo   [OK] Node.js %%v

REM ===== 2. Python 检查 =====
set "PYTHON_CMD="
where python >nul 2>&1
if %errorlevel% equ 0 (
  set "PYTHON_CMD=python"
) else (
  where python3 >nul 2>&1
  if %errorlevel% equ 0 set "PYTHON_CMD=python3"
)
if not defined PYTHON_CMD (
  echo [X] Python 未安装
  echo     请访问 https://www.python.org/ 安装
  echo     安装时记得勾选 "Add Python to PATH"
  pause
  exit /b 1
)
for /f "delims=" %%v in ('%PYTHON_CMD% --version 2^>^&1') do echo   [OK] Python %%v

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
echo   [OK] 信令服务器已启动

REM ===== 6. 启动客户端 =====
echo [*] 启动 Web 客户端 ^(端口 8080^)...
pushd "%SCRIPT_DIR%src\client"
start "SyncPlay-Client" /B cmd /c "%PYTHON_CMD% -m http.server 8080 > "%LOG_DIR%\client.log" 2>&1"
popd
echo   [OK] 客户端已启动

REM 等待服务起来
timeout /t 3 /nobreak >nul

REM ===== 7. 打开浏览器 =====
echo [*] 打开浏览器...
start "" "http://localhost:8080"

REM ===== 8. 提示 =====
echo.
echo ===================================
echo  [OK] SyncPlay 已就绪！
echo ===================================
echo.
echo   [Web]  客户端:    http://localhost:8080
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
