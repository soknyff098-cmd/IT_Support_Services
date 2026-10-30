@echo off
chcp 65001 >nul
echo ======================================================
echo   IT Helpdesk Pro - Starting Clean Dev Server...
echo ======================================================
if exist ".next" (
  echo Cleaning old .next cache...
  rmdir /s /q ".next"
)
if not exist "node_modules" (
  echo Installing npm packages...
  call npm install
)
echo Starting http://localhost:3000 ...
call npm run dev
pause
