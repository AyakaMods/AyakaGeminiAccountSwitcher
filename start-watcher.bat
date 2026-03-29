@echo off
title AyakaGeminiAccountSwitcher - Watcher
color 0B
echo.
echo  AyakaGeminiAccountSwitcher - Watcher
echo  by AyakaMods
echo  Keep this window open while using Gemini CLI.
echo.
cd /d "%~dp0"
node watcher.js
pause
