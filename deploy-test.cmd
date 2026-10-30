@echo off
setlocal
set "TEST_DEPLOY_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%TEST_DEPLOY_PY%" (
    echo Python runtime not found: %TEST_DEPLOY_PY%
    exit /b 1
)
"%TEST_DEPLOY_PY%" "%~dp0tools\deploy-test-from-github.py" --apply
exit /b %errorlevel%
