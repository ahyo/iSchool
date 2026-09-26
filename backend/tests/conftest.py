import os

import pytest

# Gunakan database khusus test (akan di-drop & di-seed ulang)
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://localhost/ischool_test")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def seeded_db():
    seed(reset=True)


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


def _login(client, username):
    r = client.post("/api/auth/login", json={"username": username, "password": "demo123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def auth(client):
    cache = {}

    def get(username):
        if username not in cache:
            cache[username] = _login(client, username)
        return cache[username]

    return get
