@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

:: =============================================================
::  uninstall-lite.bat — AllYourLinks Lite Uninstaller (Windows)
::  Usage: double-click or run from command prompt
:: =============================================================

set "TASK_NAME=AllYourLinks"
set "DEFAULT_INSTALL_DIR=%USERPROFILE%\projects\allyourlinks"
set "PORT=8000"

echo.
echo ╔══════════════════════════════════════╗
echo ║   AllYourLinks — Lite Uninstaller    ║
echo ╚══════════════════════════════════════╝
echo.

:: ── Detect install directory from scheduled task ─────────────
set "INSTALL_DIR="
for /f "tokens=*" %%i in ('schtasks /query /tn "%TASK_NAME%" /fo list 2^>nul ^| findstr /i "Task To Run"') do (
  set "TASK_LINE=%%i"
)

:: Extract path from task line if found
if defined TASK_LINE (
  :: Try to find the install dir from the start_server.bat path in the task
  for /f "tokens=*" %%j in ('schtasks /query /tn "%TASK_NAME%" /fo list 2^>nul ^| findstr /i "start_server"') do (
    set "TASK_CMD=%%j"
  )
)

:: If we couldn't auto-detect, ask the user
if not defined INSTALL_DIR (
  echo   No active installation detected via scheduled task.
  echo   Default directory: %DEFAULT_INSTALL_DIR%
  set /p "use_default=  Use this path? (Y/n): "
  if /i "!use_default!"=="n" (
    set /p "INSTALL_DIR=  Enter the full path where the project was installed: "
    if "!INSTALL_DIR!"=="" set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
  ) else (
    set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
  )
) else (
  echo   Installation detected at: %INSTALL_DIR%
)

echo.
echo This will remove:
echo   - Scheduled task: %TASK_NAME%
echo   - Project files:  %INSTALL_DIR%
echo.
set /p "confirm=Continue? (y/N): "
if /i not "%confirm%"=="y" (
  echo Uninstall cancelled.
  pause
  exit /b 0
)

:: ── Stop server if running ────────────────────────────────────
echo [INFO] Stopping server...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  taskkill /pid %%a /f >nul 2>&1
)
echo [OK]   Server stopped

:: ── Remove scheduled task ────────────────────────────────────
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
if errorlevel 1 (
  echo [WARN] Scheduled task not found or already removed
) else (
  echo [OK]   Scheduled task removed
)

:: ── Remove project files ─────────────────────────────────────
if exist "%INSTALL_DIR%" (
  set /p "confirm2=Also delete project files at %INSTALL_DIR%? (y/N): "
  if /i "!confirm2!"=="y" (
    rmdir /s /q "%INSTALL_DIR%"
    echo [OK]   Project files removed
  ) else (
    echo [WARN] Project files kept at %INSTALL_DIR%
  )
) else (
  echo [WARN] Directory %INSTALL_DIR% not found, skipping
)

echo.
echo Uninstall complete.
echo.
pause
