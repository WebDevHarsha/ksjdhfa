from __future__ import annotations

import asyncio
import math
import os
import time
from collections import defaultdict
from datetime import date, datetime, time as day_time, timedelta, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

API_ROOT = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
MONTH_START = date(2026, 1, 1)
MONTH_END = date(2026, 1, 31)
ACTUALS_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
ACTUALS_END = datetime(2026, 2, 1, tzinfo=timezone.utc)
FORECASTS_START = datetime(2025, 12, 31, tzinfo=timezone.utc)
FORECASTS_END = datetime(2026, 1, 31, tzinfo=timezone.utc)
CACHE_SECONDS = 900

app = FastAPI(
    title="Meridian Wind Desk API",
    description="Day-ahead UK wind forecast and actual generation analysis.",
    version="1.0.0",
)

configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_cache: tuple[float, list[dict[str, Any]], list[dict[str, Any]]] | None = None
_cache_lock = asyncio.Lock()


def _month_chunks(start: date, end: date):
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=6), end)
        yield cursor, chunk_end
        cursor = chunk_end + timedelta(days=1)


def _forecast_chunks(start: datetime, end: datetime):
    cursor = start
    while cursor < end:
        chunk_end = min(
            cursor + timedelta(days=6) - timedelta(seconds=1),
            end - timedelta(seconds=1),
        )
        yield cursor, chunk_end
        cursor = chunk_end + timedelta(seconds=1)


async def _get_records(
    client: httpx.AsyncClient, dataset: str, params: dict[str, str]
) -> list[dict[str, Any]]:
    try:
        response = await client.get(f"{API_ROOT}/{dataset}", params=params)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Elexon {dataset} data request failed: {exc}",
        ) from exc

    records = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        raise HTTPException(
            status_code=502,
            detail=f"Elexon {dataset} returned an unexpected response.",
        )
    return [record for record in records if isinstance(record, dict)]


async def _load_source_data() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    global _cache

    now = time.monotonic()
    if _cache is not None and now - _cache[0] < CACHE_SECONDS:
        return _cache[1], _cache[2]

    async with _cache_lock:
        now = time.monotonic()
        if _cache is not None and now - _cache[0] < CACHE_SECONDS:
            return _cache[1], _cache[2]

        timeout = httpx.Timeout(60.0, connect=15.0)
        limits = httpx.Limits(max_connections=5, max_keepalive_connections=5)
        async with httpx.AsyncClient(timeout=timeout, limits=limits) as client:
            actual_tasks = [
                _get_records(
                    client,
                    "FUELHH",
                    {
                        "settlementDateFrom": chunk_start.isoformat(),
                        "settlementDateTo": chunk_end.isoformat(),
                        "fuelType": "WIND",
                    },
                )
                for chunk_start, chunk_end in _month_chunks(MONTH_START, MONTH_END)
            ]
            forecast_tasks = [
                _get_records(
                    client,
                    "WINDFOR",
                    {
                        "PublishDateTimeFrom": _iso_utc(chunk_start),
                        "PublishDateTimeTo": _iso_utc(chunk_end),
                        "StartTimeFrom": _iso_utc(ACTUALS_START),
                        "StartTimeTo": _iso_utc(ACTUALS_END),
                    },
                )
                for chunk_start, chunk_end in _forecast_chunks(
                    FORECASTS_START, FORECASTS_END
                )
            ]
            groups = await asyncio.gather(
                asyncio.gather(*actual_tasks),
                asyncio.gather(*forecast_tasks),
            )

        actuals = _deduplicate(groups[0], ("startTime", "fuelType"))
        forecasts = _deduplicate(
            groups[1], ("publishTime", "startTime", "generation")
        )
        _cache = (time.monotonic(), actuals, forecasts)
        return actuals, forecasts


def _deduplicate(
    groups: list[list[dict[str, Any]]], keys: tuple[str, ...]
) -> list[dict[str, Any]]:
    records: dict[tuple[Any, ...], dict[str, Any]] = {}
    for group in groups:
        for row in group:
            records[tuple(row.get(key) for key in keys)] = row
    return list(records.values())


def _iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace(
        "+00:00", "Z"
    )


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _generation(row: dict[str, Any]) -> float | None:
    value = row.get("generation")
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _floor_to_hour(value: datetime) -> datetime:
    return value.replace(minute=0, second=0, microsecond=0)


def _actuals_by_time(
    rows: list[dict[str, Any]], delivery_day: date
) -> dict[datetime, float]:
    start = datetime.combine(delivery_day, day_time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    result: dict[datetime, float] = {}
    for row in rows:
        start_time = _parse_datetime(row.get("startTime"))
        generation = _generation(row)
        if start_time is None or generation is None:
            continue
        if start <= start_time < end and row.get("fuelType", "WIND") == "WIND":
            result[start_time] = generation
    return result


def _forecast_for_day(
    rows: list[dict[str, Any]],
    actuals: dict[datetime, float],
    delivery_day: date,
    decision_time: str,
) -> tuple[datetime | None, dict[datetime, float]]:
    previous_day = delivery_day - timedelta(days=1)
    cutoff_hour, cutoff_minute = (int(part) for part in decision_time.split(":"))
    cutoff = datetime.combine(
        previous_day,
        day_time(cutoff_hour, cutoff_minute),
        tzinfo=timezone.utc,
    )
    snapshots: dict[datetime, dict[datetime, float]] = defaultdict(dict)
    for row in rows:
        publish_time = _parse_datetime(row.get("publishTime"))
        start_time = _parse_datetime(row.get("startTime"))
        generation = _generation(row)
        if (
            publish_time is None
            or start_time is None
            or generation is None
            or publish_time > cutoff
        ):
            continue
        snapshots[publish_time][start_time] = generation

    if not actuals or not snapshots:
        return None, {}

    candidates: list[tuple[datetime, int, dict[datetime, float]]] = []
    for publish_time, values in snapshots.items():
        matched = sum(
            1
            for actual_time in actuals
            if actual_time in values or _floor_to_hour(actual_time) in values
        )
        if matched:
            candidates.append((publish_time, matched, values))
    if not candidates:
        return None, {}

    minimum_complete_coverage = max(1, math.ceil(len(actuals) * 0.9))
    sufficiently_complete = [
        candidate
        for candidate in candidates
        if candidate[1] >= minimum_complete_coverage
    ]
    if sufficiently_complete:
        publish_time, _, vintage = max(sufficiently_complete, key=lambda item: item[0])
    else:
        publish_time, _, vintage = max(
            candidates, key=lambda item: (item[1], item[0])
        )

    aligned = {
        actual_time: vintage.get(actual_time, vintage.get(_floor_to_hour(actual_time)))
        for actual_time in actuals
    }
    return publish_time, {
        actual_time: generation
        for actual_time, generation in aligned.items()
        if generation is not None
    }


def _score_day(
    actuals: dict[datetime, float], forecasts: dict[datetime, float]
) -> dict[str, float | int | None]:
    errors = [
        forecasts[instant] - actual
        for instant, actual in actuals.items()
        if instant in forecasts
    ]
    count = len(errors)
    if not count:
        return {
            "mae_mw": None,
            "rmse_mw": None,
            "bias_mw": None,
            "interval_coverage": 0.0,
            "actual_intervals": len(actuals),
            "forecast_intervals": 0,
            "actual_average_mw": None,
            "forecast_average_mw": None,
        }

    return {
        "mae_mw": round(sum(abs(error) for error in errors) / count, 1),
        "rmse_mw": round((sum(error * error for error in errors) / count) ** 0.5, 1),
        "bias_mw": round(sum(errors) / count, 1),
        "interval_coverage": round(count / len(actuals), 4) if actuals else 0.0,
        "actual_intervals": len(actuals),
        "forecast_intervals": count,
        "actual_average_mw": round(
            sum(actuals[instant] for instant in actuals if instant in forecasts) / count,
            1,
        ),
        "forecast_average_mw": round(
            sum(forecasts[instant] for instant in actuals if instant in forecasts)
            / count,
            1,
        ),
    }


def _daily_result(
    rows: list[dict[str, Any]], forecast_rows: list[dict[str, Any]], delivery_day: date,
    decision_time: str
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    actuals = _actuals_by_time(rows, delivery_day)
    publish_time, forecasts = _forecast_for_day(
        forecast_rows, actuals, delivery_day, decision_time
    )
    score = _score_day(actuals, forecasts)
    interval_rows = [
        {
            "start_time": _iso_utc(instant),
            "actual_mw": round(actual, 1),
            "forecast_mw": (
                round(forecasts[instant], 1) if instant in forecasts else None
            ),
            "error_mw": (
                round(forecasts[instant] - actual, 1)
                if instant in forecasts
                else None
            ),
        }
        for instant, actual in sorted(actuals.items())
    ]
    lead_hours = (
        (datetime.combine(delivery_day, day_time.min, tzinfo=timezone.utc) - publish_time)
        .total_seconds()
        / 3600
        if publish_time is not None
        else None
    )
    result = {
        "date": delivery_day.isoformat(),
        **score,
        "forecast_publish_time": _iso_utc(publish_time) if publish_time else None,
        "forecast_lead_hours": round(lead_hours, 2) if lead_hours is not None else None,
    }
    return result, interval_rows


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "meridian-wind-desk"}


@app.get("/api/dashboard")
async def dashboard(
    delivery_date: str = Query(alias="date", pattern=r"^2026-01-\d{2}$"),
    decision_time: str = Query(default="11:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$"),
) -> dict[str, Any]:
    try:
        selected_day = date.fromisoformat(delivery_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="date must be a valid January 2026 day") from exc
    if not MONTH_START <= selected_day <= MONTH_END:
        raise HTTPException(status_code=422, detail="date must be within January 2026")

    actual_rows, forecast_rows = await _load_source_data()
    daily: list[dict[str, Any]] = []
    selected_intervals: list[dict[str, Any]] = []
    selected_summary: dict[str, Any] | None = None
    for day_number in range(1, 32):
        delivery_day = date(2026, 1, day_number)
        day_summary, intervals = _daily_result(
            actual_rows, forecast_rows, delivery_day, decision_time
        )
        daily.append(day_summary)
        if delivery_day == selected_day:
            selected_summary = day_summary
            selected_intervals = intervals

    if selected_summary is None:
        raise HTTPException(status_code=500, detail="Could not calculate selected delivery day")

    return {
        "month": "2026-01",
        "date": selected_day.isoformat(),
        "decision_time": decision_time,
        **selected_summary,
        "daily": daily,
        "intervals": selected_intervals,
        "source": "Elexon BMRS",
    }
