@echo off
setlocal EnableDelayedExpansion
set ERR=0
for %%P in (3000 3031) do (
  call "%~dp0port-busy.cmd" %%P
  if errorlevel 1 (
    echo [WARN] Port %%P is in use
    set ERR=1
  )
)
exit /b !ERR!
