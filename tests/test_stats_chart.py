import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from models import Attempt, Problem, db


@pytest.fixture()
def app(tmp_path):
    app = create_app()
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{tmp_path / 'test.db'}",
    )

    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def test_stats_chart_route_renders_chart_containers(client):
    response = client.get("/stats/chart")

    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert 'id="chapterChart"' in html
    assert 'id="weeklyChart"' in html
    assert "cdn.jsdelivr.net/npm/chart.js" in html


def test_api_chapter_stats_returns_accuracy_per_chapter(app, client):
    with app.app_context():
        chapter_a = Problem(title="A", chapter="微分", difficulty=2)
        chapter_b = Problem(title="B", chapter="積分", difficulty=2)
        db.session.add_all([chapter_a, chapter_b])
        db.session.commit()

        db.session.add_all(
            [
                Attempt(problem_id=chapter_a.id, is_correct=True),
                Attempt(problem_id=chapter_a.id, is_correct=False),
            ]
        )
        db.session.commit()

    response = client.get("/api/stats/chapter")

    assert response.status_code == 200
    payload = response.get_json()
    stats_by_chapter = {item["chapter"]: item for item in payload}

    assert stats_by_chapter["微分"]["total"] == 2
    assert stats_by_chapter["微分"]["accuracy"] == 50.0
    assert stats_by_chapter["積分"]["total"] == 0
    assert stats_by_chapter["積分"]["accuracy"] == 0


def test_api_weekly_stats_returns_last_8_weeks_with_counts(app, client):
    with app.app_context():
        problem = Problem(title="A", chapter="極限", difficulty=2)
        db.session.add(problem)
        db.session.commit()

        db.session.add_all(
            [
                Attempt(
                    problem_id=problem.id,
                    is_correct=True,
                    created_at=datetime.utcnow() - timedelta(days=3),
                ),
                Attempt(
                    problem_id=problem.id,
                    is_correct=False,
                    created_at=datetime.utcnow() - timedelta(days=10),
                ),
            ]
        )
        db.session.commit()

    response = client.get("/api/stats/weekly")

    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload) == 8
    assert all("week" in item and "count" in item for item in payload)
    assert sum(item["count"] for item in payload) == 2
