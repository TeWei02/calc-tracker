import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from models import Problem, db


@pytest.fixture()
def app():
    app = create_app()
    app.config["TESTING"] = True

    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _create_problem():
    problem = Problem(
        title="求函數極限",
        description="請求 lim x->0 sin(x)/x",
        chapter="極限",
        source="測試資料",
        difficulty=2,
    )
    db.session.add(problem)
    db.session.commit()
    return problem


def test_problem_detail_contains_ai_hint_button(client, app):
    with app.app_context():
        problem = _create_problem()
        problem_id = problem.id

    response = client.get(f"/problems/{problem_id}")

    assert response.status_code == 200
    assert "獲取 AI 提示".encode("utf-8") in response.data
    assert b"ai-hint-loading" in response.data


def test_ai_hint_accepts_question_id(client, app, monkeypatch):
    with app.app_context():
        problem = _create_problem()
        problem_id = problem.id

    monkeypatch.setenv("GROQ_API_KEY", "test-key")

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "先觀察題目條件與已知量。"}}]}

    class FakeHttpxModule:
        @staticmethod
        def post(*args, **kwargs):
            return FakeResponse()

    monkeypatch.setitem(sys.modules, "httpx", FakeHttpxModule)

    response = client.post("/ai/hint", json={"question_id": problem_id})

    assert response.status_code == 200
    assert response.get_json()["hint"] == "先觀察題目條件與已知量。"
