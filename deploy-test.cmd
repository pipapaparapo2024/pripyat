@echo off
setlocal
if exist "%~dp0.venv\Scripts\python.exe" (
  "%~dp0.venv\Scripts\python.exe" "%~dp0tools\deploy-test-from-github.py" --apply
) else (
  py -3 "%~dp0tools\deploy-test-from-github.py" --apply
)
exit /b %errorlevel%
