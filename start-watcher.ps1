# AyakaGeminiAccountSwitcher — Watcher Launcher
# Run this BEFORE starting Gemini CLI
# It watches in the background and auto-switches accounts when quota exhausts

$WatcherDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting AyakaGeminiAccountSwitcher Watcher..." -ForegroundColor Cyan
Write-Host "Keep this window open while using Gemini CLI." -ForegroundColor Yellow
Write-Host ""

Set-Location $WatcherDir
node "$WatcherDir\watcher.js"
