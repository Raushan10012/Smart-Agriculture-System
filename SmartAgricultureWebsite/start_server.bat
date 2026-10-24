@echo off
title SmartAgri - IoT & Mobile Scanner Server
cd /d "%~dp0"
echo =======================================================
echo   Starting SmartAgri Local Web Server...
echo =======================================================
python server.py
pause
