import os
import tempfile

_db_dir = tempfile.mkdtemp()
# Tests drop all tables, so they only touch a database named explicitly for testing.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{_db_dir}/test.db")
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256"

import pytest
from fastapi.testclient import TestClient

from app import models  # noqa: E402,F401
from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import User
from app.security import hash_password


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add_all([
            User(name="Ravi Kumar", email="owner@test.in", password_hash=hash_password("password1"), role="owner"),
            User(name="Arjun Mehta", email="arjun@test.in", password_hash=hash_password("password1"), role="rep"),
        ])
        db.commit()
    yield


def login(client: TestClient, email: str) -> dict[str, str]:
    res = client.post("/api/auth/login", json={"email": email, "password": "password1"})
    assert res.status_code == 200
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def owner(client):
    return login(client, "owner@test.in")


@pytest.fixture
def rep(client):
    return login(client, "arjun@test.in")
