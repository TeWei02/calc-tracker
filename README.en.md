**Language:** [![English](https://img.shields.io/badge/English-English-blue?style=flat-square)](README.en.md) [![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-%E4%B8%AD%E6%96%87%E7%89%88-blue?style=flat-square)](README.md)

# Calc Tracker — Calculus Practice & Mistake Management System

[![Live](https://img.shields.io/badge/Live-tewei02.github.io%2Fcalc--tracker-2ea043?logo=github)](https://tewei02.github.io/calc-tracker/)
[![PWA](https://img.shields.io/badge/PWA-installable-5A0FC8)](https://web.dev/progressive-web-apps/)
[![Python](https://img.shields.io/badge/Python-3-%233776AB?logo=python)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3-%23000000?logo=flask)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-%23003B57?logo=sqlite)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A tool that helps college transfer-exam candidates manage calculus practice problems and mistakes: build a question bank, record every attempt, automatically organize wrong answers, and track accuracy by chapter.

The project comes in **two versions** — the same feature set, two deployment shapes:

| Version | Location | How to run | Data storage | Online URL |
|---------|----------|------------|--------------|------------|
| **Static version (use it online instantly)** | `docs/` | Pure front-end HTML/CSS/JS, no backend | Browser localStorage | <https://tewei02.github.io/calc-tracker/> |
| **Full version (run locally)** | Project root | Flask + SQLite server | SQLite database | Start it yourself |

Live demo (auto-loads a sample question bank): <https://tewei02.github.io/calc-tracker/?demo=1>

---

## Features

| Feature | Description |
|---------|-------------|
| Add questions | Enter question title, chapter, source, difficulty, and notes |
| Question list | Questions listed in reverse chronological order; filter by chapter, search by title |
| Practice mode | Random / wrong-answer-first / difficulty-ordered question selection, built-in timer records time spent per question |
| Wrong-answer stats | Automatically collects questions answered incorrectly 2+ times for focused review |
| Chapter stats | Shows question count, attempt count, correct count, and accuracy per chapter |
| Visual charts | Chapter accuracy bar chart, 8-week practice volume line chart (hand-drawn on Canvas, no external chart library) |
| Solving hints | Offline solving-direction hints by chapter keyword (static version) / generative hints via Groq API (full version) |
| Data export | Attempt records export to CSV (UTF-8 BOM included, no mojibake when opened in Excel), full backup as JSON |
| Offline use | Static version registers a Service Worker and can be installed as a PWA for offline use |

## Static Version (`docs/`)

- Zero external dependencies: no CDN, framework, or third-party libraries; charts are hand-drawn on Canvas
- 5 tabs: Overview / Question Bank / Practice / Mistakes / Data
- Data is stored in browser `localStorage` and never uploaded to any server
- Export / import JSON backups supported, data can be moved across devices
- `?demo=1` loads a sample question bank when data is empty, so you can see the stats and charts right away

> The demo data (12 calculus questions with matching attempt records) is **fictional content** provided only for trying out the interface; it can be cleared in one click on the Data page.

## Full Version (Flask)

```bash
git clone https://github.com/TeWei02/calc-tracker
cd calc-tracker

pip install -r requirements.txt

# Initialize the database
python db_init.py

# Start
python app.py
# Open http://localhost:5000
```

Or with Docker, one command — no need to install Python first:

```bash
git clone https://github.com/TeWei02/calc-tracker
cd calc-tracker
docker compose up -d
```

Open <http://localhost:5000>. On container startup the tables are created automatically; the database lives in the `calc-data` volume, so `docker compose down` won't wipe it (add `-v` to clear it as well). The image serves via gunicorn, runs as non-root, and ships with a `HEALTHCHECK`. SQLite is single-writer, so it keeps 1 worker with 4 threads by default to avoid `database is locked`.

The `GROQ_API_KEY` environment variable enables AI solving hints (`/ai/hint`); when unset, that feature returns a hint message and everything else is unaffected.

## Tech Stack

| Layer | Static version | Full version |
|-------|----------------|--------------|
| Frontend | Vanilla HTML / CSS / JavaScript (Canvas charts) | HTML / Bootstrap 5 / Jinja2 |
| Backend | — | Python, Flask |
| Database | Browser localStorage | SQLite (Flask-SQLAlchemy) |
| Deployment | GitHub Pages (`docs/` directory) | Any Python-capable host, or `docker compose up -d` |

## Project Structure

```
calc-tracker/
├── app.py                  # Flask main program (full version)
├── models.py               # SQLAlchemy data models
├── db_init.py              # Database initialization
├── requirements.txt
├── Dockerfile              # Single image self-hosting (gunicorn, non-root, HEALTHCHECK)
├── docker-compose.yml      # One-command startup, database in calc-data volume
├── docker-entrypoint.sh    # Creates tables before startup, then hands off to gunicorn
├── templates/              # Jinja2 templates (full version)
├── static/                 # Full version static assets
└── docs/                   # Static version (GitHub Pages source)
    ├── index.html          # Single-page app (5 tabs)
    ├── app.js              # App logic: data layer, charts, practice flow
    ├── style.css           # Styles (dark mode supported)
    ├── manifest.json       # PWA config
    ├── sw.js               # Service Worker (offline cache)
    └── icons/              # PWA icons
```

## Development Motivation

To systematically organize calculus questions and sources by chapter, record every practice session, and track weak spots and progress while preparing for the college transfer exam (calculus). The static version was added so this tool can be "open and use" on any device without setting up a server; the project can be extended to other subjects (computer science fundamentals, discrete math, etc.) in the future.

## License

MIT
