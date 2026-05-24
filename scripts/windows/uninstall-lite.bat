@echo off
setlocal enabledelayedexpansion

:: =============================================================
::  uninstall-lite.bat -- AllYourLinks Lite Uninstaller (Windows)
:: =============================================================

set "TASK_NAME=AllYourLinks"
set "DEFAULT_INSTALL_DIR=%USERPROFILE%\projects\allyourlinks"
set "PORT=8000"

echo.
echo ==========================================
echo    AllYourLinks -- Lite Uninstaller
echo ==========================================
echo.

:: -- Detect install directory from registry ------------------
set "INSTALL_DIR="

for /f "tokens=3*" %%i in ('reg query "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "%TASK_NAME%" 2^>nul') do (
  set "REG_VAL=%%i %%j"
)

if defined REG_VAL (
  :: Extract path from: wscript.exe "C:\...\start_server.vbs"
  for /f "tokens=2 delims=^"" %%i in ("!REG_VAL!") do (
    set "LAUNCHER_PATH=%%i"
  )
  if defined LAUNCHER_PATH (
    :: Go up two levels from scripts\windows\start_server.vbs
    for %%i in ("!LAUNCHER_PATH!\..\..\..") do set "INSTALL_DIR=%%~fi"
    echo   Installation detected at: !INSTALL_DIR!
  )
)

if not defined INSTALL_DIR (
  echo   No active installation detected in registry.
  echo   Default directory: %DEFAULT_INSTALL_DIR%
  set /p "USE_DEFAULT=  Use this path? (Y/n): "
  if /i "!USE_DEFAULT!"=="n" (
    set /p "INSTALL_DIR=  Enter the full path where the project was installed: "
    if "!INSTALL_DIR!"=="" set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
  ) else (
    set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
  )
)

echo.
echo This will remove:
echo   - Autostart registry entry: %TASK_NAME%
echo   - Project files:  !INSTALL_DIR!
echo.
set /p "CONFIRM=Continue? (y/N): "
if /i not "!CONFIRM!"=="y" (
  echo Uninstall cancelled.
  pause
  exit /b 0
)

:: -- Stop server (kill python process on PORT) ---------------
echo [INFO] Stopping server...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  taskkill /pid %%a /f >nul 2>&1
)
:: Also kill any lingering wscript launcher
taskkill /f /im wscript.exe >nul 2>&1
echo [OK]   Server stopped

:: -- Remove registry autostart entry ------------------------
reg delete "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "%TASK_NAME%" /f >nul 2>&1
if errorlevel 1 (
  echo [WARN] Autostart entry not found or already removed
) else (
  echo [OK]   Autostart entry removed
)

:: -- Remove project files ------------------------------------
if exist "!INSTALL_DIR!" (
  set /p "CONFIRM2=Also delete project files at !INSTALL_DIR!? (y/N): "
  if /i "!CONFIRM2!"=="y" (
    rmdir /s /q "!INSTALL_DIR!"
    echo [OK]   Project files removed
  ) else (
    echo [WARN] Project files kept at !INSTALL_DIR!
  )
) else (
  echo [WARN] Directory !INSTALL_DIR! not found, skipping
)

echo.
echo Uninstall complete.
echo.
pause
