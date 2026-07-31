@echo off
setlocal enabledelayedexpansion

:: =============================================================
::  install-lite.bat -- AllYourLinks Lite Installer (Windows)
::  Installs the frontend-only version (no backend required)
:: =============================================================

set "DEFAULT_INSTALL_DIR=%USERPROFILE%\projects\allyourlinks"
set "TASK_NAME=AllYourLinks"
set "PORT=8000"

echo.
echo ==========================================
echo    AllYourLinks -- Lite Installer
echo ==========================================
echo.

:: -- 1. Detect project root -----------------------------------
set "SCRIPT_DIR=%~dp0"
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

:: -- 2. Choose install path -----------------------------------
echo   Default install directory: %DEFAULT_INSTALL_DIR%
set /p "USE_DEFAULT=  Use this path? (Y/n): "

if /i "!USE_DEFAULT!"=="n" (
  set /p "INSTALL_DIR=  Enter full install path: "
  if "!INSTALL_DIR!"=="" set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
) else (
  set "INSTALL_DIR=%DEFAULT_INSTALL_DIR%"
)

echo [INFO] Source:      %SOURCE_DIR%
echo [INFO] Destination: !INSTALL_DIR!
echo.

:: -- 3. Check Python ------------------------------------------
echo [INFO] Checking dependencies...

python --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python is not installed or not in PATH.
  echo         Download it from https://www.python.org/downloads/
  echo         Make sure to check "Add Python to PATH" during installation.
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set "PYTHON_VER=%%i"
echo [OK]   Python found: %PYTHON_VER%

:: -- 4. Guard: source != destination -------------------------
if /i "%SOURCE_DIR%"=="!INSTALL_DIR!\" (
  echo [ERROR] Source and destination are the same directory.
  echo         Please choose a different destination path.
  pause
  exit /b 1
)

:: -- 5. Prepare install directory ----------------------------
echo [INFO] Preparing install directory...

if exist "!INSTALL_DIR!" (
  echo [WARN] Directory already exists.
  set /p "CONFIRM=Overwrite? (y/N): "
  if /i not "!CONFIRM!"=="y" (
    echo Installation cancelled.
    pause
    exit /b 0
  )
  rmdir /s /q "!INSTALL_DIR!"
)

xcopy "%SOURCE_DIR%" "!INSTALL_DIR!\" /e /i /h /y >nul
echo [OK]   Files copied to !INSTALL_DIR!

:: -- 6. Create silent launcher (VBScript) --------------------
echo [INFO] Creating silent launcher...

set "LAUNCHER=!INSTALL_DIR!\scripts\windows\start_server.vbs"

(
  echo Set oShell = CreateObject^("WScript.Shell"^)
  echo oShell.CurrentDirectory = "!INSTALL_DIR!"
  echo oShell.Run "python -m http.server %PORT%", 0, False
) > "!LAUNCHER!"

echo [OK]   Silent launcher created

:: -- 7. Add to startup registry (more reliable than schtasks) -
echo [INFO] Configuring autostart...

reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" ^
  /v "%TASK_NAME%" ^
  /t REG_SZ ^
  /d "wscript.exe \"!LAUNCHER!\"" ^
  /f >nul

if errorlevel 1 (
  echo [WARN] Could not add autostart entry to registry.
  echo        Start the server manually: wscript.exe "!LAUNCHER!"
) else (
  echo [OK]   Autostart entry added to registry
)

:: -- 8. Start server now (silently) --------------------------
echo [INFO] Starting server...
start "" wscript.exe "!LAUNCHER!"
timeout /t 2 /nobreak >nul

netstat -an | findstr ":%PORT% " | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [WARN] Server may not have started yet.
  echo        Check that http://localhost:%PORT% is accessible.
) else (
  echo [OK]   Server listening on port %PORT%
)

:: -- 9. Summary ----------------------------------------------
echo.
echo ==========================================
echo    Installation complete
echo ==========================================
echo.
echo   Dashboard:    http://localhost:%PORT%
echo   Installed at: !INSTALL_DIR!
echo.
echo   Server will start automatically on login (no console window).
echo   To start manually: wscript.exe "!LAUNCHER!"
echo.
echo   To uninstall: !INSTALL_DIR!\scripts\windows\uninstall-lite.bat
echo.
pause
