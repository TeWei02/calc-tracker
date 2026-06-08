import csv
import io
import re

from app import create_app
from models import Attempt, Problem, db


def test_export_csv_contains_required_columns_and_content():
    app = create_app()
    app.config["TESTING"] = True

    with app.app_context():
        db.drop_all()
        db.create_all()

        problem = Problem(
            title="求極限 lim x->0 sinx/x",
            description="請使用洛必達法則驗證",
            chapter="極限",
            difficulty=2,
        )
        db.session.add(problem)
        db.session.flush()

        attempt = Attempt(problem_id=problem.id, is_correct=False)
        db.session.add(attempt)
        db.session.commit()

    client = app.test_client()
    response = client.get("/export/csv")

    assert response.status_code == 200
    assert response.mimetype == "text/csv"
    assert re.match(
        r"attachment; filename=calc_tracker_export_\d{8}\.csv",
        response.headers["Content-Disposition"],
    )

    csv_text = response.get_data(as_text=True)
    assert csv_text.startswith("\ufeff")

    rows = list(csv.reader(io.StringIO(csv_text[1:])))
    assert rows[0] == ["題目內容", "章節", "答題日期", "是否正確", "錯誤原因"]
    assert rows[1][0] == "求極限 lim x->0 sinx/x\n請使用洛必達法則驗證"
    assert rows[1][1] == "極限"
    assert rows[1][2] != ""
    assert rows[1][3] == "錯誤"
    assert rows[1][4] == "未提供"
