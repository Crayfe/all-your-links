@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

:: =============================================================
::  install-lite.bat — AllYourLinks Lite Installer (Windows)
::  Installs the frontend-only version (no backend required)
::  Usage: double-click or run from command prompt
:: =============================================================

set "DEFAULT_INSTALL_DIR=%USERPROFILE%\projects\allyourlinks"
set "TASK_NAME=AllYourLinks"
set "PORT=8000"

echo.
echo ╔══════════════════════════════════════╗
echo ║   AllYourLinks — Lite Installer      ║
echo ╚══════════════════════════════════════╝
echo.

:: ── 1. Detect project root ───────────────────────────────────
set "SCRIPT_DIR=%~dp0"
:: Go up two levels from scripts\windows\ to project root
for %%i in ("%SCRIPT_DIR%..\..\") do set "PROJECT_ROOT=%%~fi"

if not exist "%PROJECT_ROOT%index.html" (
  echo [ERROR] Project not found at %PROJECT_ROOT%
  echo         Make sure you run this script from inside the project folder.
  pause
  exit /b 1
)

set "SOURCE_DIR=%PROJECT_ROOT%"
echo [INFO] Project detected at: %SOURCE_DIR%
echo.

:: ── 2. Choose install path ────────────────────────────────────
echo   Default install directory: %DEFAULT_INSTALL_DIR%
set /p "use_default=  Use this path? (Y/n): "

if /i "%use_default%"=="n" (
  set /p "INSTALL_DIR=  Enter full install path (e.g. C:\Users\you\apps\allyourlinks): "
  if "!INSTALL_DIR!"=="" set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
) else (
  set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
)

:: Normalize: remove trailing backslash
if "%INSTALL_DIR:~-1%"=="\" set "INSTALL_DIR=%INSTALL_DIR:~0,-1%"

echo [INFO] Source:      %SOURCE_DIR%
echo [INFO] Destination: %INSTALL_DIR%
echo.

:: ── 3. Check dependencies ─────────────────────────────────────
echo [INFO] Checking dependencies...

python --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python is not installed or not in PATH.
  echo         Download it from https://www.python.org/downloads/
  echo         Make sure to check "Add Python to PATH" during installation.
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VER=%%i
echo [OK]   Python found: %PYTHON_VER%

:: ── 4. Guard: source != destination ──────────────────────────
if /i "%SOURCE_DIR%"=="%INSTALL_DIR%\" (
  echo [ERROR] Source and destination are the same directory.
  echo         Please choose a different destination path.
  pause
  exit /b 1
)

:: ── 5. Prepare install directory ─────────────────────────────
echo [INFO] Preparing install directory...

if exist "%INSTALL_DIR%" (
  echo [WARN] Directory '%INSTALL_DIR%' already exists.
  set /p "confirm=Overwrite? (y/N): "
  if /i not "!confirm!"=="y" (
    echo Installation cancelled.
    pause
    exit /b 0
  )
  rmdir /s /q "%INSTALL_DIR%"
)

xcopy "%SOURCE_DIR%" "%INSTALL_DIR%\" /e /i /h /y >nul
echo [OK]   Files copied to %INSTALL_DIR%

:: ── 6. Create startup script ─────────────────────────────────
echo [INFO] Creating startup script...

set "START_SCRIPT=%INSTALL_DIR%\start_server.bat"
(
  echo @echo off
  echo cd /d "%INSTALL_DIR%"
  echo python -m http.server %PORT%
) > "%START_SCRIPT%"

echo [OK]   Startup script created at %START_SCRIPT%

:: ── 7. Create scheduled task ──────────────────────────────────
echo [INFO] Configuring scheduled task...

schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "cmd /c start /min \"\" \"%START_SCRIPT%\"" ^
  /sc onlogon ^
  /rl limited ^
  /f >nul

if errorlevel 1 (
  echo [WARN] Could not create scheduled task automatically.
  echo        You can start the server manually by running:
  echo        %START_SCRIPT%
) else (
  echo [OK]   Scheduled task created: server will start on login
)

:: ── 8. Start server now ───────────────────────────────────────
echo [INFO] Starting server...
start /min "" "%START_SCRIPT%"
timeout /t 2 /nobreak >nul

netstat -an | findstr ":%PORT% " | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [WARN] Server may not have started yet.
  echo        Check that http://localhost:%PORT% is accessible.
) else (
  echo [OK]   Server listening on port %PORT%
)

:: ── 9. Summary ────────────────────────────────────────────────
echo.
echo ╔══════════════════════════════════════╗
echo ║       Installation complete          ║
echo ╚══════════════════════════════════════╝
echo.
echo   Dashboard:    http://localhost:%PORT%
echo   Installed at: %INSTALL_DIR%
echo.
echo   The server will start automatically on login.
echo   To start manually: %START_SCRIPT%
echo.
echo   To uninstall: %INSTALL_DIR%\scripts\windows\uninstall-lite.bat
echo.
pause
