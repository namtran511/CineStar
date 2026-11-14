@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "%~dp0.tools\node-v22.16.0-win-x64\node.exe" (
  "%~dp0.tools\node-v22.16.0-win-x64\node.exe" scripts\launch.mjs
) else (
  node scripts\launch.mjs
)
pause
