@echo off
REM ===================================================================
REM  一键停止「家系」演示环境
REM
REM  依次停掉三个组件（没有在跑的自动跳过）：
REM    1. Next.js 站点（5173，含 pnpm/node 进程树与窗口）
REM    2. llama-server 本地推理（8080）
REM    3. 反向隧道（ssh -R 18001 + 守护循环）
REM  MySQL80 是 Windows 服务保持运行（开机自启，不影响别的东西）。
REM
REM  实现注记（都踩过坑）：
REM   - 等待用 ping 而不是 timeout：避免和 Git Bash 的 GNU timeout 撞名；
REM   - 进程检测用 PowerShell 而不是 wmic：Win11 24H2 起 wmic 已被移除；
REM   - echo 里不能出现裸箭头符号，cmd 会把它当成重定向写文件。
REM ===================================================================
title pedigree-stop
echo.
echo 正在停止「家系」演示环境...

echo [1/3] 停止站点（5173）...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /f /t /pid %%p >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq pedigree-web*" >nul 2>&1

echo [2/3] 停止本地推理 llama-server（8080）...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8080 " ^| findstr "LISTENING"') do taskkill /f /t /pid %%p >nul 2>&1
taskkill /f /im llama-server.exe >nul 2>&1

echo [3/3] 停止反向隧道（18001 转发到 5173）...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and ($_.CommandLine -like '*-R 18001*' -or $_.CommandLine -like '*tunnel-loop*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
taskkill /f /fi "WINDOWTITLE eq tunnel-loop-18001*" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq pedigree-tunnel*" >nul 2>&1

ping -n 3 127.0.0.1 >nul
echo.
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if errorlevel 1 (
  echo   站点        ：已停止
) else (
  echo   [警告] 站点仍在监听 5173，请记下 PID 手动结束：
  netstat -ano | findstr ":5173 " | findstr "LISTENING"
)
netstat -ano | findstr ":8080 " | findstr "LISTENING" >nul
if errorlevel 1 (
  echo   本地推理    ：已停止
) else (
  echo   [警告] llama-server 仍在监听 8080，请记下 PID 手动结束：
  netstat -ano | findstr ":8080 " | findstr "LISTENING"
)
echo   隧道        ：已停止（公网地址将不可访问，属预期）
echo   MySQL80     ：保持运行（Windows 服务，开机自启）
echo.
echo 全部完成。下次演示请双击桌面的「启动家系演示」。
pause
