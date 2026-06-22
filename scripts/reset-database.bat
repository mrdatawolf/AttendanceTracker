@echo off
echo.
echo ==========================================
echo   Database Reset Tool
echo ==========================================
echo.
echo WARNING: This will DELETE ALL DATA!
echo.
echo Press Ctrl+C to cancel, or
pause

node "%~dp0reset-database.js"

echo.
pause
