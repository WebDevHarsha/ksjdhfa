import unittest
from datetime import datetime, timezone

from app.main import _forecast_for_day, _percentile, _score_day


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

    def test_selects_latest_eligible_forecast_per_interval_and_aligns_hourly_values(self):
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

        forecast, published = _forecast_for_day(
            rows, self.actuals, datetime(2026, 1, 15).date(), "11:00"
        )

        self.assertEqual(
            published[datetime(2026, 1, 15, 0, 0, tzinfo=timezone.utc)],
            datetime(2026, 1, 14, 10, 30, tzinfo=timezone.utc),
        )
        self.assertEqual(list(forecast.values()), [120.0, 120.0, 130.0, 130.0])
        self.assertEqual(
            published[datetime(2026, 1, 15, 0, 0, tzinfo=timezone.utc)],
            datetime(2026, 1, 14, 10, 30, tzinfo=timezone.utc),
        )
        self.assertEqual(
            published[datetime(2026, 1, 15, 0, 30, tzinfo=timezone.utc)],
            datetime(2026, 1, 14, 10, 30, tzinfo=timezone.utc),
        )

    def test_uses_newer_vintage_for_intervals_where_it_is_available(self):
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

        forecast, published = _forecast_for_day(
            rows, actuals, datetime(2026, 1, 15).date(), "11:00"
        )

        self.assertEqual(len(forecast), 9)
        self.assertEqual(
            published[datetime(2026, 1, 15, 0, 0, tzinfo=timezone.utc)],
            datetime(2026, 1, 14, 10, 30, tzinfo=timezone.utc),
        )
        self.assertEqual(
            published[datetime(2026, 1, 15, 4, 0, tzinfo=timezone.utc)],
            datetime(2026, 1, 14, 9, 30, tzinfo=timezone.utc),
        )

    def test_excludes_forecasts_published_after_cutoff(self):
        rows = [
            {
                "publishTime": "2026-01-14T11:30:00Z",
                "startTime": "2026-01-15T00:00:00Z",
                "generation": 999,
            }
        ]
        forecasts, publish_times = _forecast_for_day(
            rows, self.actuals, datetime(2026, 1, 15).date(), "11:00"
        )

        self.assertEqual(forecasts, {})
        self.assertEqual(publish_times, {})

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
        self.assertAlmostEqual(score["interval_coverage"], 2 / 48, places=4)
        self.assertEqual(score["forecast_intervals"], 2)
        self.assertEqual(score["coverage_status"], "partial")

    def test_distinguishes_missing_actuals_missing_forecasts_and_complete_coverage(self):
        no_actuals = _score_day({}, {})
        first_interval = next(iter(self.actuals))
        no_forecast = _score_day({first_interval: 100.0}, {})
        complete_actuals = {
            datetime(2026, 1, 15, hour, minute, tzinfo=timezone.utc): 100.0
            for hour in range(24)
            for minute in (0, 30)
        }
        complete = _score_day(complete_actuals, complete_actuals.copy())

        self.assertEqual(no_actuals["coverage_status"], "no_actuals")
        self.assertEqual(no_forecast["coverage_status"], "no_forecast")
        self.assertEqual(complete["coverage_status"], "complete")
        self.assertEqual(complete["interval_coverage"], 1.0)

    def test_calculates_interpolated_percentiles(self):
        self.assertEqual(_percentile([0.0, 10.0, 20.0, 30.0], 0.5), 15.0)
        self.assertIsNone(_percentile([], 0.9))


if __name__ == "__main__":
    unittest.main()
