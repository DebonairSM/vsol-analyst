@echo off
REM Database Backup Script for VSol Analyst
REM This script can be used with Windows Task Scheduler

cd /d "%~dp0"
call npm run backup

if errorlevel 1 (
    echo Backup failed!
    exit /b 1
)

echo Backup completed successfully!
exit /b 0

