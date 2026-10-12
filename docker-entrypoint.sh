#!/bin/sh
# 啟動前先確保資料表存在（重複執行安全），再用 gunicorn 提供服務。
set -e

echo "初始化資料庫（若已存在則不動作）..."
python db_init.py

# SQLite 同時只有一個寫入者，worker 開多反而容易遇到 database is locked；
# 預設 1 個 worker 搭配多執行緒，對這種小工具足夠。
exec gunicorn \
  --bind "0.0.0.0:${PORT:-5000}" \
  --workers "${WEB_CONCURRENCY:-1}" \
  --threads "${WEB_THREADS:-4}" \
  --access-logfile - \
  --error-logfile - \
  "app:create_app()"
