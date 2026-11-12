@echo off
cd /d "%~dp0"
del /q _check_timer.py _check_ids.py _js_check.js 2>nul
git add -A
git commit -F .git\COMMIT_MSG_TMP.txt
del .git\COMMIT_MSG_TMP.txt
git log --oneline
git status --short
