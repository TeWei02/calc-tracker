from flask import Flask, render_template, request, redirect, url_for
from models import db, Problem, Attempt
from sqlalchemy import func, case


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///calc_tracker.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    @app.route("/")
    def index():
        chapter_stats = (
            db.session.query(
                Problem.chapter,
                func.count(Attempt.id),
                wrong_countfunc.sum(case((Attempt.is_correct == True, 1), else_=0)),
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

    @app.route("/problems")
    def list_problems():
        chapter = request.args.get("chapter")
        if chapter:
            problems = Problem.query.filter_by(chapter=chapter).all()
        else:
            problems = Problem.query.order_by(Problem.created_at.desc()).all()
        return render_template("practice.html", problems=problems)

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

    @app.route("/stats/wrong")
    def wrong_problems():
        wrong_counts = (
            db.session.query(
                Attempt.problem_id,
                func.sum(case((Attempt.is_correct == False, 1), else_=0)).label(                                   "wrong_count"
                ),
            )
            .group_by(Attempt.problem_id)
            .having(
                func.sum(
                    case((Attempt.is_correct == False, 1), else_=0)
                )
                >= 2
            )
            .subquery()
        )

        problems = (
            db.session.query(Problem, wrong_counts.c.wrong_count)
            .join(wrong_counts, Problem.id == wrong_counts.c.problem_id)
            .all()
        )

        return render_template("stats.html", problems=problems)

    return app


if __name__ == "__main__":
    print("creating app...")
    app = create_app()
    print("starting server on http://127.0.0.1:5000")
    app.run(debug=True)

