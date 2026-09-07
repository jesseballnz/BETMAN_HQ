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
SNAPSHOT = Path(os.environ.get(
    "BETMAN_HQ_CONVERSION_SNAPSHOT",
    "/opt/betman/betman_hq/runtime/conversion-cities-snapshot.json",
))
HISTORY_DIR = Path(os.environ.get(
    "BETMAN_HQ_CONVERSION_HISTORY_DIR",
    "/opt/betman/betman_hq/runtime/conversion-history",
))
MIN_LANDING_SESSIONS = int(os.environ.get("BETMAN_HQ_CONVERSION_MIN_LANDINGS", "1"))
MIN_CITY_FLOOR = int(os.environ.get("BETMAN_HQ_CONVERSION_MIN_CITIES", "50"))
MAX_CITY_DROP_RATIO = float(os.environ.get("BETMAN_HQ_CONVERSION_MAX_CITY_DROP_RATIO", "0.40"))
HISTORY_KEEP = int(os.environ.get("BETMAN_HQ_CONVERSION_HISTORY_KEEP", "48"))


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


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.chmod(temporary, 0o640)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_status(payload: dict) -> None:
    write_json(OUTPUT, payload)


def load_previous_snapshot() -> dict:
    if not SNAPSHOT.exists():
        return {}
    try:
        payload = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def prune_history(directory: Path, keep: int) -> None:
    if keep <= 0 or not directory.exists():
        return
    files = sorted(
        (path for path in directory.glob("conversion-cities-*.json") if path.is_file()),
        key=lambda path: path.name,
    )
    for stale in files[0:max(0, len(files) - keep)]:
        try:
            stale.unlink()
        except OSError:
            pass


def persist_full_city_snapshot(
    *,
    checked_at: str,
    traffic: dict,
    totals: dict,
    geographies: list,
    cities: list,
    campaigns: list,
) -> None:
    """Persist the full city array so recovery never depends on topCities truncation."""
    payload = {
        "checkedAt": checked_at,
        "generatedAt": traffic.get("generatedAt"),
        "schemaVersion": 1,
        "source": "core-auth-summary-conversionTraffic",
        "totals": {
            "landingSessions": int(totals.get("landingSessions") or 0),
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
        "geographies": geographies,
        "cities": cities,
        "campaigns": campaigns,
    }
    write_json(SNAPSHOT, payload)

    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    stamp = checked_at.replace(":", "").replace("-", "")
    history_path = HISTORY_DIR / f"conversion-cities-{stamp}.json"
    write_json(history_path, payload)
    prune_history(HISTORY_DIR, HISTORY_KEEP)


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

    previous = load_previous_snapshot()
    previous_cities = previous.get("cities") if isinstance(previous.get("cities"), list) else []
    previous_count = len(previous_cities)
    current_count = len(cities)
    if current_count > 0 and current_count < MIN_CITY_FLOOR:
        failures.append(f"city count {current_count} is below floor {MIN_CITY_FLOOR}")
    if previous_count >= MIN_CITY_FLOOR and current_count > 0:
        drop_ratio = 1.0 - (current_count / previous_count)
        if drop_ratio >= MAX_CITY_DROP_RATIO:
            failures.append(
                "city count dropped too far: "
                f"{previous_count} -> {current_count} "
                f"(drop={drop_ratio:.0%}, max={MAX_CITY_DROP_RATIO:.0%})"
            )

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
        "snapshot": {
            "path": str(SNAPSHOT),
            "historyDir": str(HISTORY_DIR),
            "previousCityCount": previous_count,
            "currentCityCount": current_count,
            "minCityFloor": MIN_CITY_FLOOR,
        },
    }
    write_status(status)

    # Only advance the durable full-city snapshot when the poll is healthy.
    # This stops a thin/partial Core response from overwriting recovery data.
    if not failures and current_count > 0:
        persist_full_city_snapshot(
            checked_at=checked_at,
            traffic=traffic,
            totals=totals,
            geographies=geographies,
            cities=cities,
            campaigns=campaigns,
        )

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
