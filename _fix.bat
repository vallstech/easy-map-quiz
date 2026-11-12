@echo off
cd /d "%~dp0"
git rm --cached _commit.bat >nul 2>&1
del /q _commit.bat 2>nul
echo _commit.bat> .git\COMMIT_MSG_TMP.txt
echo.>> .git\COMMIT_MSG_TMP.txt
echo Remove the temporary _commit.bat that slipped into the previous commit.>> .git\COMMIT_MSG_TMP.txt
git add -A
git commit -F .git\COMMIT_MSG_TMP.txt
del .git\COMMIT_MSG_TMP.txt
git log --oneline
git status --short
