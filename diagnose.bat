@echo off
REM ==========================================
REM   SyncPlay 环境诊断脚本
REM ==========================================
REM   作用:一键收集本机环境信息,贴给开发者
REM   用法:双击或在 cmd 里跑 diagnose.bat
REM   输出:把整个窗口内容复制粘贴给我即可
REM ==========================================

chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   SyncPlay 环境诊断 v1.0
echo ============================================================
echo   时间: %date% %time%
echo   电脑: %COMPUTERNAME%
echo   用户: %USERNAME%
echo ============================================================
echo.

REM ============= [1/8] 脚本与项目结构 =============
echo [1/8] 脚本与项目结构
echo   脚本位置: %~dp0
if exist "%~dp0start.bat" (echo   [OK] start.bat) else (echo   [X] 缺 start.bat)
if exist "%~dp0stop.bat"  (echo   [OK] stop.bat)  else (echo   [!]  缺 stop.bat (非必需))
if exist "%~dp0package.json" (echo   [OK] package.json) else (echo   [X] 缺 package.json)
echo   关键目录:
for %%d in (src src\server src\client src\shared test\unit test\e2e test\network docs) do (
  if exist "%~dp0%%d" (echo      [OK] %%d) else (echo      [X] %%d)
)
echo   服务端依赖:
if exist "%~dp0src\server\node_modules" (echo      [OK] src\server\node_modules) else (echo      [!]  src\server\node_modules (首次启 start.bat 会自动 npm install))
echo.

REM ============= [2/8] Node.js =============
echo [2/8] Node.js
where node >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('node --version 2^>^&1') do echo   [OK] node: %%v
  for /f "delims=" %%p in ('where node 2^>^&1') do echo       路径: %%p
) else (
  echo   [X] node 不在 PATH 中
  echo       但可能在以下位置:
  set "NODE_FOUND="
  if exist "C:\Program Files\nodejs\node.exe" (
    echo       [OK] C:\Program Files\nodejs\node.exe ^(没在 PATH^)
    set "NODE_FOUND=1"
  )
  if exist "C:\Program Files (x86)\nodejs\node.exe" (
    echo       [OK] C:\Program Files (x86)\nodejs\node.exe
    set "NODE_FOUND=1"
  )
  if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    echo       [OK] %LOCALAPPDATA%\Programs\nodejs\node.exe
    set "NODE_FOUND=1"
  )
  if not defined NODE_FOUND echo       (常见位置都没找到)
)
echo.

REM ============= [3/8] Python =============
echo [3/8] Python
set "PYTHON_OK=0"
where python3 >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('python3 --version 2^>^&1') do echo   [OK] python3: %%v
  set "PYTHON_OK=1"
)
if !PYTHON_OK! equ 0 (
  where python >nul 2>&1
  if %errorlevel% equ 0 (
    for /f "delims=" %%v in ('python --version 2^>^&1') do echo   [OK] python: %%v
    set "PYTHON_OK=1"
  )
)
if !PYTHON_OK! equ 0 (
  echo   [X] python 不在 PATH 中
)
echo.

REM ============= [4/8] 包管理器 =============
echo [4/8] 包管理器
where winget >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('winget --version 2^>^&1') do echo   [OK] winget: %%v
) else (
  echo   [X] winget 不可用 ^(Win10 早期版本可能没自带^)
)
where choco >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%v in ('choco --version 2^>^&1') do echo   [OK] choco: %%v
) else (
  echo   -  choco 不可用
)
echo.

REM ============= [5/8] 端口占用 =============
echo [5/8] 端口占用
for %%p in (8080 9000) do (
  netstat -ano | findstr :%%p | findstr LISTENING >nul 2>&1
  if %errorlevel% equ 0 (
    echo   [!]  端口 %%p 被占用
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
      echo       PID: %%a
    )
  ) else (
    echo   [OK] 端口 %%p 空闲
  )
)
echo.

REM ============= [6/8] 网络到 TURN =============
echo [6/8] 网络到 Metered TURN 服务器
ping -n 2 -w 3 global.relay.metered.ca >nul 2>&1
if %errorlevel% equ 0 (
  echo   [OK] 可达 global.relay.metered.ca
) else (
  echo   [X] 不可达 global.relay.metered.ca
  echo       可能被防火墙/网络阻挡
)
echo.

REM ============= [7/8] 系统信息 =============
echo [7/8] 系统信息
echo   Windows: 
ver
net session >nul 2>&1
if %errorlevel% equ 0 (echo   [OK] 已是管理员) else (echo   [!]  非管理员 ^(首次装 Node/Python 可能要管理员^))
echo.

REM ============= [8/8] PATH 节选 =============
echo [8/8] PATH 节选 ^(只列含 node/python/winget/choco 的^)
for %%p in ("%PATH:;=" "%") do (
  echo %%p | findstr /I "node python winget choco" >nul
  if !errorlevel! equ 0 echo    %%p
)
echo.

echo ============================================================
echo   诊断完成
echo ============================================================
echo.
echo   操作:全选这个窗口的内容(Ctrl+A),复制,贴给开发者
echo   或者重定向到文件:diagnose.bat ^> diagnose-output.txt
echo.
pause
