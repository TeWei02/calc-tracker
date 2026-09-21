# Calc Tracker — 微積分練習與錯題管理系統

[![Live](https://img.shields.io/badge/Live-tewei02.github.io%2Fcalc--tracker-2ea043?logo=github)](https://tewei02.github.io/calc-tracker/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](https://web.dev/progressive-web-apps/)
[![Python](https://img.shields.io/badge/Python-3-%233776AB?logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3-%23000000?logo=flask)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-%23003B57?logo=sqlite)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一個幫助大學轉學考生管理微積分練習題與錯題的工具：建立題庫、記錄每次作答、自動整理錯題、統計各章節正確率。

專案提供**兩種版本**，同一套功能、兩種部署形態：

| 版本 | 位置 | 執行方式 | 資料儲存 | 線上網址 |
|------|------|----------|----------|----------|
| **靜態版（線上下載即用）** | `docs/` | 純前端 HTML/CSS/JS，免後端 | 瀏覽器 localStorage | <https://tewei02.github.io/calc-tracker/> |
| **完整版（本機執行）** | 專案根目錄 | Flask + SQLite 伺服器 | SQLite 資料庫 | 需自行啟動 |

線上示範（自動載入示範題庫）：<https://tewei02.github.io/calc-tracker/?demo=1>

---

## 功能

| 功能 | 說明 |
|------|------|
| 新增題目 | 輸入題目標題、章節、來源、難度與備註 |
| 題目列表 | 依時間倒序列出題目，可依章節篩選、依標題搜尋 |
| 練習模式 | 隨機／優先錯題／難度排序出題，內建計時器記錄每題花費時間 |
| 錯題統計 | 自動整理答錯 2 次以上的題目，集中複習 |
| 章節統計 | 顯示各章節題目數、作答次數、答對次數與正確率 |
| 視覺化圖表 | 章節正確率柱狀圖、近 8 週練習量折線圖（Canvas 手繪，無外部圖表函式庫） |
| 解題提示 | 依章節關鍵字提供離線解題方向提示（靜態版）／Groq API 生成式提示（完整版） |
| 資料匯出 | 作答紀錄匯出 CSV（含 UTF-8 BOM，Excel 開啟中文不亂碼）、完整備份 JSON |
| 離線使用 | 靜態版註冊 Service Worker，可安裝為 PWA 離線使用 |

## 靜態版（`docs/`）

- 零外部依賴：沒有任何 CDN、框架或第三方函式庫，圖表以 Canvas 手繪
- 5 個頁籤：總覽 / 題庫 / 練習 / 錯題 / 資料
- 資料存於瀏覽器 `localStorage`，不上傳任何伺服器
- 支援匯出 / 匯入 JSON 備份，可跨裝置搬移資料
- `?demo=1` 會在資料為空時載入示範題庫，方便直接檢視統計與圖表

> 示範資料（12 題微積分題目與對應作答紀錄）為**虛構內容**，僅供試用介面，可在「資料」頁一鍵清空。

## 完整版（Flask）

```bash
git clone https://github.com/TeWei02/calc-tracker
cd calc-tracker

pip install -r requirements.txt

# 初始化資料庫
python db_init.py

# 啟動
python app.py
# 開啟 http://localhost:5000
```

環境變數 `GROQ_API_KEY` 可啟用 AI 解題提示（`/ai/hint`），未設定時該功能回傳提示訊息，其餘功能不受影響。

## 技術棧

| Layer | 靜態版 | 完整版 |
|-------|--------|--------|
| 前端 | 原生 HTML / CSS / JavaScript（Canvas 圖表） | HTML / Bootstrap 5 / Jinja2 |
| 後端 | — | Python, Flask |
| 資料庫 | 瀏覽器 localStorage | SQLite (Flask-SQLAlchemy) |
| 部署 | GitHub Pages（`docs/` 目錄） | 任意支援 Python 的主機 |

## 專案結構

```
calc-tracker/
├── app.py                  # Flask 主程式（完整版）
├── models.py               # SQLAlchemy 資料模型
├── db_init.py              # 資料庫初始化
├── requirements.txt
├── templates/              # Jinja2 模板（完整版）
├── static/                 # 完整版靜態資源
└── docs/                   # 靜態版（GitHub Pages 來源）
    ├── index.html          # 單頁應用（5 個頁籤）
    ├── app.js              # 應用邏輯：資料層、圖表、練習流程
    ├── style.css           # 樣式（支援深色模式）
    ├── manifest.json       # PWA 設定
    ├── sw.js               # Service Worker（離線快取）
    └── icons/              # PWA 圖示
```

## 開發動機

為準備大學轉學考（微積分），系統性整理各章節題目與來源、記錄每次練習結果、追蹤弱點與進步。
靜態版的加入是為了讓這個工具能在任何裝置上「打開就用」，不需要架設伺服器；
未來可擴充至其他科目（計概、離散等）。

## License

MIT
