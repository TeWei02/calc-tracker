import csv
import io
import os
from datetime import datetime, timedelta

from flask import Flask, render_template, request, redirect, url_for, jsonify, Response
from models import db, Problem, Attempt
from sqlalchemy import func, case


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///calc_tracker.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    # ── 首頁 ───────────────────────────────────────────────
    @app.route("/")
    def index():
        chapter_stats = (
            db.session.query(
                Problem.chapter,
                func.count(Attempt.id),
                func.sum(case((Attempt.is_correct == True, 1), else_=0)),
            )
            .join(Attempt, Attempt.problem_id == Problem.id, isouter=True)
            .group_by(Problem.chapter)
            .all()
        )

        stats = []
        for chapter, total_attempts, correct_attempts in chapter_stats:
            total_attempts = total_attempts or 0
            correct_attempts = correct_attempts or 0
            accuracy = (
                round(correct_attempts * 100 / total_attempts, 1)
                if total_attempts > 0
                else None
            )
            stats.append(
                {
                    "chapter": chapter,
                    "total_attempts": total_attempts,
                    "correct_attempts": correct_attempts,
                    "accuracy": accuracy,
                }
            )

        return render_template("index.html", stats=stats)

    # ── 新增題目 ───────────────────────────────────────────
    @app.route("/problems/new", methods=["GET", "POST"])
    def add_problem():
        if request.method == "POST":
            title = request.form["title"]
            description = request.form.get("description", "")
            chapter = request.form["chapter"]
            source = request.form.get("source", "")
            difficulty = int(request.form.get("difficulty", 2))

            problem = Problem(
                title=title,
                description=description,
                chapter=chapter,
                source=source,
                difficulty=difficulty,
            )
            db.session.add(problem)
            db.session.commit()
            return redirect(url_for("list_problems"))

        return render_template("add_problem.html")

    # ── 題目列表 ───────────────────────────────────────────
    @app.route("/problems")
    def list_problems():
        chapter = request.args.get("chapter")
        if chapter:
            problems = Problem.query.filter_by(chapter=chapter).all()
        else:
            problems = Problem.query.order_by(Problem.created_at.desc()).all()
        return render_template("practice.html", problems=problems)

    # ── 新增作答紀錄 ───────────────────────────────────────
    @app.route("/attempts/<int:problem_id>", methods=["POST"])
    def add_attempt(problem_id):
        is_correct = request.form.get("is_correct") == "true"
        spent_seconds_raw = request.form.get("spent_seconds")
        spent_seconds = int(spent_seconds_raw) if spent_seconds_raw else None

        attempt = Attempt(
            problem_id=problem_id,
            is_correct=is_correct,
            spent_seconds=spent_seconds,
        )
        db.session.add(attempt)
        db.session.commit()
        return redirect(url_for("list_problems"))

    # ── 錯題統計 ───────────────────────────────────────────
    @app.route("/stats/wrong")
    def wrong_problems():
        wrong_counts = (
            db.session.query(
                Attempt.problem_id,
                func.sum(case((Attempt.is_correct == False, 1), else_=0)).label(
                    "wrong_count"
                ),
            )
            .group_by(Attempt.problem_id)
            .having(
                func.sum(
                    case((Attempt.is_correct == False, 1), else_=0)
                ) >= 2
            )
            .subquery()
        )

        problems = (
            db.session.query(Problem, wrong_counts.c.wrong_count)
            .join(wrong_counts, Problem.id == wrong_counts.c.problem_id)
            .all()
        )

        return render_template("stats.html", problems=problems)

    # ── C1: 統計圖表頁面 (/stats/chart) ───────────────────
    @app.route("/stats/chart")
    def stats_chart():
        return render_template("stats_chart.html")

    # C1: 各章節正確率 API
    @app.route("/api/stats/chapter")
    def api_chapter_stats():
        rows = (
            db.session.query(
                Problem.chapter,
                func.count(Attempt.id).label("total"),
                func.sum(case((Attempt.is_correct == True, 1), else_=0)).label("correct"),
            )
            .join(Attempt, Attempt.problem_id == Problem.id, isouter=True)
            .group_by(Problem.chapter)
            .all()
        )
        data = []
        for chapter, total, correct in rows:
            total = total or 0
            correct = correct or 0
            accuracy = round(correct * 100 / total, 1) if total > 0 else 0
            data.append({"chapter": chapter, "accuracy": accuracy, "total": total})
        return jsonify(data)

    # C1: 每週練習題數 API
    @app.route("/api/stats/weekly")
    def api_weekly_stats():
        # 取最近 8 週資料
        eight_weeks_ago = datetime.utcnow() - timedelta(weeks=8)
        rows = (
            db.session.query(Attempt.created_at)
            .filter(Attempt.created_at >= eight_weeks_ago)
            .all()
        )

        # 用 dict 統計每週 (ISO week)
        weekly = {}
        for (created_at,) in rows:
            week_label = created_at.strftime("%Y-W%W")
            weekly[week_label] = weekly.get(week_label, 0) + 1

        # 產生最近 8 週完整標籤（即使沒資料也補 0）
        result = []
        for i in range(7, -1, -1):
            d = datetime.utcnow() - timedelta(weeks=i)
            label = d.strftime("%Y-W%W")
            result.append({"week": label, "count": weekly.get(label, 0)})

        return jsonify(result)

    # ── C2: 匯出 CSV (/export/csv) ────────────────────────
    @app.route("/export/csv")
    def export_csv():
        attempts = (
            db.session.query(Attempt, Problem)
            .join(Problem, Attempt.problem_id == Problem.id)
            .order_by(Attempt.created_at.desc())
            .all()
        )

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "題目ID", "題目標題", "章節", "難度", "來源",
            "是否正確", "花費秒數", "作答時間"
        ])

        for attempt, problem in attempts:
            writer.writerow([
                problem.id,
                problem.title,
                problem.chapter,
                problem.difficulty,
                problem.source or "",
                "正確" if attempt.is_correct else "錯誤",
                attempt.spent_seconds or "",
                attempt.created_at.strftime("%Y-%m-%d %H:%M:%S") if attempt.created_at else "",
            ])

        # UTF-8 BOM 讓 Excel 正確顯示中文
        response_data = "\ufeff" + output.getvalue()
        filename = f"calc_tracker_export_{datetime.now().strftime('%Y%m%d')}.csv"

        return Response(
            response_data,
            mimetype="text/csv; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # ── C3: AI 提示功能 (/ai/hint) ─────────────────────────
    @app.route("/ai/hint", methods=["POST"])
    def ai_hint():
        problem_id = request.json.get("problem_id")
        problem = Problem.query.get_or_404(problem_id)

        groq_api_key = os.environ.get("GROQ_API_KEY")
        if not groq_api_key:
            return jsonify({"error": "未設定 GROQ_API_KEY 環境變數"}), 500

        try:
            import httpx

            prompt = (
                f"你是一位微積分家教老師。以下是一道學生遇到困難的題目：\n\n"
                f"題目：{problem.title}\n"
                f"描述：{problem.description or '（無額外描述）'}\n"
                f"章節：{problem.chapter}\n\n"
                f"請給學生一個解題「提示」，幫助他自己想出解法。"
                f"不要直接給出完整答案，只給方向和關鍵步驟提示（100字以內，繁體中文）。"
            )

            resp = httpx.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama3-8b-8192",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                },
                timeout=30,
            )
            resp.raise_for_status()
            hint = resp.json()["choices"][0]["message"]["content"].strip()
            return jsonify({"hint": hint})

        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return app


if __name__ == "__main__":
    print("creating app...")
    app = create_app()
    print("starting server on http://127.0.0.1:5000")
    app.run(debug=True)
