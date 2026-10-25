import unittest
from datetime import datetime, timezone

from app.main import _forecast_for_day, _score_day


class ForecastVintageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.actuals = {
            datetime(2026, 1, 15, hour, minute, tzinfo=timezone.utc): 100.0
            for hour, minute in (
                (0, 0),
                (0, 30),
                (1, 0),
                (1, 30),
            )
        }

    def test_selects_latest_forecast_before_cutoff_and_aligns_hourly_values(self):
        rows = [
            {
                "publishTime": "2026-01-14T09:30:00Z",
                "startTime": "2026-01-15T00:00:00Z",
                "generation": 110,
            },
            {
                "publishTime": "2026-01-14T10:30:00Z",
                "startTime": "2026-01-15T00:00:00Z",
                "generation": 120,
            },
            {
                "publishTime": "2026-01-14T10:30:00Z",
                "startTime": "2026-01-15T01:00:00Z",
                "generation": 130,
            },
            {
                "publishTime": "2026-01-14T12:30:00Z",
                "startTime": "2026-01-15T00:00:00Z",
                "generation": 999,
            },
        ]

        published, forecast = _forecast_for_day(
            rows, self.actuals, datetime(2026, 1, 15).date(), "11:00"
        )

        self.assertEqual(
            published, datetime(2026, 1, 14, 10, 30, tzinfo=timezone.utc)
        )
        self.assertEqual(list(forecast.values()), [120.0, 120.0, 130.0, 130.0])

    def test_prefers_complete_earlier_vintage_to_incomplete_newer_issue(self):
        actuals = {
            datetime(2026, 1, 15, hour, minute, tzinfo=timezone.utc): 100.0
            for hour, minute in (
                (0, 0),
                (0, 30),
                (1, 0),
                (1, 30),
                (2, 0),
                (2, 30),
                (3, 0),
                (3, 30),
                (4, 0),
            )
        }
        rows = [
            {
                "publishTime": "2026-01-14T09:30:00Z",
                "startTime": f"2026-01-15T0{hour}:00:00Z",
                "generation": 110,
            }
            for hour in range(5)
        ]
        rows.extend(
            {
                "publishTime": "2026-01-14T10:30:00Z",
                "startTime": f"2026-01-15T0{hour}:00:00Z",
                "generation": 120,
            }
            for hour in range(4)
        )

        published, forecast = _forecast_for_day(
            rows, actuals, datetime(2026, 1, 15).date(), "11:00"
        )

        self.assertEqual(
            published, datetime(2026, 1, 14, 9, 30, tzinfo=timezone.utc)
        )
        self.assertEqual(len(forecast), 9)

    def test_scores_only_matched_periods_and_uses_signed_forecast_minus_actual_bias(self):
        actuals = {
            datetime(2026, 1, 1, hour, tzinfo=timezone.utc): value
            for hour, value in ((0, 100.0), (1, 200.0), (2, 300.0))
        }
        forecasts = {
            datetime(2026, 1, 1, 0, tzinfo=timezone.utc): 120.0,
            datetime(2026, 1, 1, 1, tzinfo=timezone.utc): 180.0,
        }

        score = _score_day(actuals, forecasts)

        self.assertEqual(score["mae_mw"], 20.0)
        self.assertEqual(score["rmse_mw"], 20.0)
        self.assertEqual(score["bias_mw"], 0.0)
        self.assertAlmostEqual(score["interval_coverage"], 2 / 3, places=4)
        self.assertEqual(score["forecast_intervals"], 2)


if __name__ == "__main__":
    unittest.main()
