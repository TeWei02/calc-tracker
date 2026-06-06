# Calc Tracker — 微積分練習與錯題管理系統

[![Python](https://img.shields.io/badge/Python-3-%233776AB?logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3-%23000000?logo=flask)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-%23003B57?logo=sqlite)](https://www.sqlite.org/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5-%237952B3?logo=bootstrap)](https://getbootstrap.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

一個幫助大學轉學考生管理微積分練習題與錯題的 Web 應用程式。使用 Flask + SQLite 實作，記錄每題作答情況、章節統計與錯題清單。

## 功能

| 功能 | 說明 |
|------|------|
| 新增題目 | 輸入題目標題、章節、來源、難度與備註 |
| 題目列表 | 依時間或章節列出所有題目，練習時可標記答對/答錯 |
| 錯題統計 | 自動整理錯兩次以上的題目，集中複習 |
| 章節統計 | 顯示各章節作答次數與正確率，掌握弱項 |
| 視覺化圖表 | 章節統計圖表 (Chart.js) |

## 快速開始

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

## 技術棧

| Layer | Technology |
|-------|-----------|
| Backend | Python, Flask |
| Database | SQLite (Flask-SQLAlchemy) |
| Frontend | HTML, Bootstrap 5, Jinja2, Chart.js |

## 專案結構

```
calc-tracker/
├── app.py              # Flask 主程式
├── models.py           # SQLAlchemy 資料模型
├── db_init.py          # 資料庫初始化
├── requirements.txt    # 相依套件
├── templates/          # Jinja2 模板
│   ├── layout.html     # 共用佈局
│   ├── index.html      # 題目列表
│   ├── add_problem.html
│   ├── practice.html   # 練習模式
│   ├── stats.html      # 章節統計
│   └── stats_chart.html
└── static/
    ├── main.js
    └── style.css
```

## 開發動機

為準備大學轉學考（微積分），系統性整理各章節題目與來源、記錄每次練習結果、追蹤弱點與進步。未來可擴充至其他科目（計概、離散等）或加入 AI 輔助提示功能。

## License

MIT
