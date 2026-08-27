#!/usr/bin/env python3
"""Poll Core conversion analytics from HQ and fail if map data disappears."""

from __future__ import annotations

import json
import os
import tempfile
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


CORE_URL = os.environ.get("BETMAN_CORE_URL", "http://127.0.0.1:18081").rstrip("/")
TOKEN = os.environ.get("BETMAN_HQ_AUTH_SUMMARY_TOKEN", "")
HQ_URL = os.environ.get("BETMAN_HQ_INTERNAL_URL", "http://127.0.0.1:14320").rstrip("/")
OUTPUT = Path(os.environ.get(
    "BETMAN_HQ_CONVERSION_STATUS",
    "/opt/betman/betman_hq/runtime/conversion-status.json",
))
MIN_LANDING_SESSIONS = int(os.environ.get("BETMAN_HQ_CONVERSION_MIN_LANDINGS", "1"))


def fetch_json(url: str, token: str | None = None) -> dict:
    headers = {"User-Agent": "betman-hq-conversion-poller/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def warm_page() -> int:
    request = urllib.request.Request(
        f"{HQ_URL}/conversion",
        headers={"User-Agent": "betman-hq-conversion-poller/1.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        response.read(1024)
        return int(response.status)


def write_status(payload: dict) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=OUTPUT.name + ".", dir=OUTPUT.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.chmod(temporary, 0o640)
        os.replace(temporary, OUTPUT)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> int:
    checked_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if not TOKEN:
        raise SystemExit("BETMAN_HQ_AUTH_SUMMARY_TOKEN is not configured")

    summary = fetch_json(f"{CORE_URL}/api/hq/auth-summary", TOKEN)
    traffic = summary.get("conversionTraffic") if isinstance(summary, dict) else None
    traffic = traffic if isinstance(traffic, dict) else {}
    totals = traffic.get("totals") if isinstance(traffic.get("totals"), dict) else {}
    geographies = traffic.get("geographies") if isinstance(traffic.get("geographies"), list) else []
    cities = traffic.get("cities") if isinstance(traffic.get("cities"), list) else []
    campaigns = traffic.get("campaigns") if isinstance(traffic.get("campaigns"), list) else []
    landing_sessions = int(totals.get("landingSessions") or 0)

    failures: list[str] = []
    if summary.get("ok") is not True:
        failures.append("Core auth summary did not return ok=true")
    if traffic.get("available") is not True:
        failures.append("conversionTraffic is unavailable")
    if traffic.get("stale") is True:
        failures.append("conversionTraffic is stale")
    if landing_sessions < MIN_LANDING_SESSIONS:
        failures.append(f"landingSessions below threshold: {landing_sessions}")
    if landing_sessions > 0 and not geographies:
        failures.append("geographies array is empty while landing sessions exist")
    if landing_sessions > 0 and not cities:
        failures.append("cities array is empty while landing sessions exist")

    page_status = None
    if not failures:
        page_status = warm_page()
        if page_status < 200 or page_status >= 400:
            failures.append(f"HQ conversion page warm returned HTTP {page_status}")

    status = {
        "checkedAt": checked_at,
        "ok": not failures,
        "failures": failures,
        "coreUrl": CORE_URL,
        "hqUrl": HQ_URL,
        "pageStatus": page_status,
        "generatedAt": traffic.get("generatedAt"),
        "available": traffic.get("available"),
        "stale": traffic.get("stale"),
        "totals": {
            "landingSessions": landing_sessions,
            "signups": int(totals.get("signups") or 0),
            "trials": int(totals.get("trials") or 0),
            "verifiedTrials": int(totals.get("verifiedTrials") or 0),
            "conversions": int(totals.get("conversions") or 0),
        },
        "counts": {
            "campaigns": len(campaigns),
            "geographies": len(geographies),
            "cities": len(cities),
        },
        "topGeographies": geographies[:10],
        "topCities": cities[:20],
    }
    write_status(status)

    if failures:
        raise SystemExit("; ".join(failures))
    print(
        "ok "
        f"landings={landing_sessions} "
        f"geographies={len(geographies)} "
        f"cities={len(cities)} "
        f"page={page_status}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
