"""Load data/course.json, faq.json and jobs.json into SQLite. The API also does this at start-up."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "api"))
from app import db  # noqa: E402

db.init_db()
print(db.seed())
