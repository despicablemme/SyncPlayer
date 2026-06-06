@echo off
REM 🛑 SyncPlay - Windows 关闭所有服务

chcp 65001 >nul

echo.
echo 🛑 关闭 SyncPlay...
echo.

set "CLOSED=0"

REM 通过端口找 PID 并 kill
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9000 ^| findstr LISTENING') do (
  echo   - 关闭信令服务器 ^(端口 9000, PID: %%a^)
  taskkill /F /PID %%a >nul 2>&1
  if !errorlevel! equ 0 set /a "CLOSED=CLOSED+1"
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
  echo   - 关闭客户端 ^(端口 8080, PID: %%a^)
  taskkill /F /PID %%a >nul 2>&1
  if !errorlevel! equ 0 set /a "CLOSED=CLOSED+1"
)

REM 兜底：清理所有相关后台 cmd 窗口
taskkill /F /FI "WINDOWTITLE eq SyncPlay-Server*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq SyncPlay-Client*" >nul 2>&1

echo.
if !CLOSED! gtr 0 (
  echo ✅ 已关闭 !CLOSED! 个服务
) else (
  echo   SyncPlay 未在运行
)
echo.
pause
