@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%SCRIPT_DIR%tracking-sa-dashboard.ps1"
endlocal
