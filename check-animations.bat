@echo off
cd /d "D:\Programming\Task - Project\spark-new-ideas-main"
start /B node dist/server/server.js
timeout /t 3 /nobreak >nul
curl -s -o NUL -w "HTTP %%{http_code}" http://localhost:4000/
echo.
curl -s http://localhost:4000/ | findstr /C:"bell-field" /C:"energy-orb" /C:"emerald-horizon" /C:"dot-matrix" /C:"amber-mesh" /C:"glass-shimmer"
echo.
echo === SSR HTML first 3 lines ===
curl -s http://localhost:4000/ | findstr /C:"<html" /C:"<body" /C:"<main"