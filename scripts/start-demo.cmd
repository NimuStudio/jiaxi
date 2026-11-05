@echo off
REM ===================================================================
REM  一键启动「家系」演示环境（比赛那天开机后双击这一个就够）
REM
REM  依次拉起四个组件，已在运行的全部自动跳过：
REM    1. MySQL80 服务（Windows 服务，一般开机自启）
REM    2. llama-server 本地推理（Qwen3 1.7B，8080）
REM    3. Next.js 站点（pnpm start，5173）
REM    4. 反向隧道（VPS 18001 转发到本机 5173，clear.ysti.com.cn）
REM  最后自动打开浏览器访问公网地址。
REM
REM  注意：关掉这个窗口 = 关掉站点与隧道（模型和 MySQL 不受影响）。
REM  比赛期间保持窗口开着即可。
REM
REM  实现注记（都踩过坑）：
REM   - 等待用 ping 而不是 timeout：避免和 Git Bash 的 GNU timeout 撞名；
REM   - 进程检测用 PowerShell 而不是 wmic：Win11 24H2 起 wmic 已被移除；
REM   - echo 里不能出现裸箭头符号，cmd 会把它当成重定向写文件。
REM ===================================================================
setlocal
title pedigree-demo
set "PED=D:\develop\chuanzhibei\pedigree"
set "LLAMA=D:\develop\llama\llama-b11852-bin-win-cuda-13.4-x64\llama-server.exe"
set "MODEL=D:\develop\chuanzhibei\ml\out\qwen3-base-Q4_K_M.gguf"

echo [1/4] MySQL ...
sc query MySQL80 | findstr /i "RUNNING" >nul
if errorlevel 1 (
    echo   MySQL80 未在运行，尝试启动...
    net start MySQL80 2>nul || echo   [警告] MySQL 启动失败，登录/云端同步将不可用
) else (
    echo   已在运行
)

echo [2/4] 本地推理 llama-server（8080）...
netstat -ano | findstr ":8080 " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo   启动中：Qwen3-1.7B Q4_K_M
    start "llama-server" /min "%LLAMA%" -m "%MODEL%" -ngl 99 -c 4096 --port 8080 --host 127.0.0.1
    ping -n 9 127.0.0.1 >nul
) else (
    echo   已在运行
)

echo [3/4] 站点 Next.js（5173）...
netstat -ano | findstr ":5173 " | findstr "LISTENING" >nul
if errorlevel 1 (
    cd /d "%PED%"
    start "pedigree-web" /min cmd /c "pnpm start"
    echo   等待站点就绪...
    ping -n 13 127.0.0.1 >nul
) else (
    echo   已在运行
)

echo [4/4] 反向隧道（clear.ysti.com.cn 转发到本机）...
powershell -NoProfile -Command "if (Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*-R 18001*' }) { exit 0 } else { exit 1 }"
if errorlevel 1 (
    start "pedigree-tunnel" /min cmd /c "D:\develop\chuanzhibei\infra\tunnel\tunnel-loop.cmd 18001 5173"
    echo   隧道启动中，断线会自动重连
    ping -n 7 127.0.0.1 >nul
) else (
    echo   已在运行
)

echo.
echo 全部就绪，正在打开 https://clear.ysti.com.cn
start https://clear.ysti.com.cn
echo.
echo 这个窗口可以最小化，但不要关闭（关闭 = 站点下线）。
pause
