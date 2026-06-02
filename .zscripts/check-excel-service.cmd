@echo off
python -c "import json,urllib.request; r=urllib.request.urlopen('http://127.0.0.1:3031/api/health',timeout=5); d=json.loads(r.read()); print('OK' if d.get('status')=='ok' else d)"
if errorlevel 1 (
  echo Excel-service НЕ отвечает на порту 3031.
  exit /b 1
)
exit /b 0
