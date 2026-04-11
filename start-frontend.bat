@echo off
cd /d "%~dp0frontend"

if not exist "node_modules" (
  echo Installing npm packages...
  npm install
)

echo.
echo Starting frontend on http://localhost:5173
echo.
npm run dev
