#!/usr/bin/env python3
"""HTTP regression checks for explicitly isolated, fictitious Compose stacks."""

import argparse
import http.cookiejar
import json
import os
from pathlib import Path
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["create", "verify"])
    parser.add_argument("--state", required=True, type=Path)
    args = parser.parse_args()
    if os.environ.get("MYRI_ALLOW_FICTITIOUS_TESTS") != "true":
        sys.exit("Requires MYRI_ALLOW_FICTITIOUS_TESTS=true and a dedicated fictitious database.")
    base = os.environ.get("E2E_BASE_URL", "")
    url = urllib.parse.urlsplit(base)
    if url.scheme not in ("http", "https") or url.hostname != "127.0.0.1" or url.port is None or url.path not in ("", "/") or url.username or url.query or url.fragment:
        sys.exit("E2E_BASE_URL must explicitly select an isolated http(s)://127.0.0.1:PORT stack.")
    username, password = os.environ.get("E2E_USERNAME"), os.environ.get("E2E_PASSWORD")
    if not username or not password:
        sys.exit("E2E_USERNAME and E2E_PASSWORD are required.")
    context = ssl.create_default_context(cafile=os.environ.get("E2E_CA_FILE"))
    cookies = http.cookiejar.CookieJar()
    client = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cookies),
        urllib.request.HTTPSHandler(context=context),
    )
    token = {}

    def request(path, body=None, *, status=200, raw=False, csrf=True):
        headers = {}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
            if csrf:
                headers[token["headerName"]] = token["token"]
        req = urllib.request.Request(base.rstrip("/") + path, data=data, headers=headers)
        try:
            response = client.open(req, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            assert response.status == status, f"Unexpected HTTP status: expected {status}, received {response.status}."
            content = response.read()
            return (content, response.headers) if raw else (json.loads(content) if content else None)

    _, headers = request("/config.json", raw=True)
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("Referrer-Policy") == "no-referrer"
    assert headers.get("Cache-Control") == "no-store"
    assert "frame-ancestors 'none'" in headers.get("Content-Security-Policy", "")
    for path in ("/api/v1/people", "/api/v1/dashboard", "/api/v1/audit", "/v3/api-docs"):
        request(path, status=401)
    token = request("/api/v1/auth/csrf")
    login = urllib.request.Request(
        base.rstrip("/") + "/api/v1/auth/login",
        data=urllib.parse.urlencode({"username": username, "password": password}).encode(),
        headers={token["headerName"]: token["token"], "Content-Type": "application/x-www-form-urlencoded"},
    )
    with client.open(login, timeout=30) as response:
        assert response.status == 204, "Login failed."
        if url.scheme == "https":
            assert any(cookie.name == "JSESSIONID" and cookie.secure for cookie in cookies), "Missing Secure session cookie."
    token = request("/api/v1/auth/csrf")
    request("/api/v1/auth/me")
    request("/api/v1/people", {"firstName": "Rejected", "lastName": "Fictitious", "hiredOn": "2020-01-01"}, csrf=False, status=403)
    if args.phase == "create":
        if args.state.exists():
            sys.exit("State file already exists; use verify, not create.")
        person = request("/api/v1/people", {
            "firstName": "Operational", "lastName": "Fictitious", "hiredOn": "2020-01-01", "status": "active",
        }, status=201)
        salary = request(f"/api/v1/people/{person['id']}/salaries", {
            "amount": "45000.12", "currency": "EUR", "effectiveOn": "2020-01-01",
            "reason": "Fictitious operational fixture", "requestKey": "operational-" + person["id"],
        }, status=201)
        task = request("/api/v1/tasks", {
            "title": "Fictitious operational task", "priority": "medium", "status": "todo",
            "personId": person["id"], "dueAt": "2020-01-01T10:00:00Z",
        }, status=201)
        args.state.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with os.fdopen(os.open(args.state, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as state:
            json.dump({"person": person["id"], "salary": salary["id"], "task": task["id"]}, state)
    state = json.loads(args.state.read_text())
    exported, headers = request(f"/api/v1/people/{state['person']}/export", raw=True)
    snapshot = json.loads(exported)
    assert snapshot["person"]["id"] == state["person"], "Person not preserved."
    assert snapshot["salaries"][0]["id"] == state["salary"]
    assert snapshot["salaries"][0]["amount"] == "45000.12", "Financial precision changed."
    assert snapshot["tasks"][0]["id"] == state["task"], "Task not preserved."
    assert headers.get("Cache-Control") == "no-store"
    assert request("/api/v1/audit?personId=" + state["person"])["totalElements"] == 1, "Audit not preserved."
    assert request("/api/v1/todos?view=overdue&personId=" + state["person"])["totalElements"] == 1
    request("/api/v1/dashboard")
    request("/v3/api-docs")
    request("/api/v1/auth/logout", {}, status=204)
    request("/api/v1/auth/me", status=401)
    print("Stack checks passed: authentication, CSRF, headers, precision, fixture persistence and audit.")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as error:
        sys.exit("Stack verification failed: " + (str(error) or "response contract mismatch."))
    except (KeyError, ValueError, OSError, urllib.error.URLError):
        sys.exit("Stack verification failed. Check the isolated stack and configuration; no response data was logged.")
