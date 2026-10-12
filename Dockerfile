# syntax=docker/dockerfile:1
#
# Calc Tracker — 微積分練習與錯題管理系統
#
#   docker build -t calc-tracker .
#   docker run -d --name calc-tracker -p 5000:5000 -v calc-data:/app/instance calc-tracker
#
# 或直接用 compose（見 docker-compose.yml）。資料庫是 SQLite，放在
# /app/instance，掛成 volume 就不會隨容器消失。

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    WEB_CONCURRENCY=1 \
    WEB_THREADS=4

WORKDIR /app

# 先裝依賴，之後改程式碼不會讓這一層重跑
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY . .

# 非 root 執行；/app/instance 是 Flask 放 SQLite 的位置
RUN useradd --create-home --uid 10001 ct \
 && mkdir -p /app/instance \
 && chown -R ct:ct /app \
 && chmod +x /app/docker-entrypoint.sh
USER ct

VOLUME ["/app/instance"]
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request as u,sys; sys.exit(0 if u.urlopen('http://127.0.0.1:5000/',timeout=4).status==200 else 1)"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
