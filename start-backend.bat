@echo off
cd /d "%~dp0backend"

if not exist ".env" (
  copy .env.example .env
  echo Created .env - please add your ANTHROPIC_API_KEY
)

if not exist "venv" (
  echo Creating virtual environment...
  python -m venv venv
)

call venv\Scripts\activate.bat
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting backend on http://localhost:8000
echo API docs: http://localhost:8000/docs
echo.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
