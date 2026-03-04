from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Problem(db.Model):
    __tablename__ = "problems"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)          # 題目簡短描述
    description = db.Column(db.Text, nullable=True)            # 題目全文或補充
    chapter = db.Column(db.String(100), nullable=False)        # 章節：極限、微分、積分...
    source = db.Column(db.String(255), nullable=True)          # 來源：書名＋頁碼、考古題
    difficulty = db.Column(db.Integer, nullable=False, default=2)  # 1~3 等級
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    attempts = db.relationship("Attempt", backref="problem", lazy=True)


class Attempt(db.Model):
    __tablename__ = "attempts"

    id = db.Column(db.Integer, primary_key=True)
    problem_id = db.Column(db.Integer, db.ForeignKey("problems.id"), nullable=False)
    is_correct = db.Column(db.Boolean, nullable=False)
    spent_seconds = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
