import json
import unittest
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.special import eval_gegenbauer

from scripts.build_v3_daily_history import daily_snapshots, fit_scores, TICKS


class DailyHistoryTests(unittest.TestCase):
    def sample(self):
        rows = []
        for hour, value in [("2023-03-10T00:00Z", 10), ("2023-03-10T01:00Z", 1000), ("2023-03-11T00:00Z", 20)]:
            stamp = pd.Timestamp(hour)
            for tick in TICKS:
                rows.append(dict(hour=stamp, timestamp=int(stamp.timestamp()), tickLower=tick,
                                 tickUpper=tick+1, priceMid=1.0001**(tick+.5), usd_token0=value,
                                 usd_token1=0, active_liquidity_L=value, poolTick=0, block=int(stamp.timestamp())))
        data = pd.DataFrame(rows)
        data["hour"] = data["hour"].astype("datetime64[us, UTC]")
        return data

    def test_midnight_selection_preserves_real_observations_and_handles_microsecond_parquet_timestamps(self):
        daily = daily_snapshots(self.sample())
        self.assertEqual(daily.hour.nunique(), 2)
        self.assertEqual(set(daily.usd_token0), {10, 20})
        self.assertEqual(len(daily), 202)

    def test_missing_or_duplicate_bins_and_invalid_source_values_are_rejected(self):
        data = self.sample()
        for invalid in [data.iloc[1:], pd.concat([data, data.iloc[[0]]])]:
            with self.assertRaisesRegex(ValueError, "exactly one"):
                daily_snapshots(invalid)
        data.loc[0, "active_liquidity_L"] = -1
        with self.assertRaisesRegex(ValueError, "negative"):
            daily_snapshots(data)

    def test_fit_recovers_a_known_log_liquidity_curve_in_the_documented_basis(self):
        expected = np.array([5, .2, -.3, .15, .1, -.1])
        u = TICKS / 50
        phi = np.column_stack([eval_gegenbauer(n, .4, u)/eval_gegenbauer(n, .4, 1) for n in range(6)])
        raw_liquidity = np.expm1(phi @ expected)
        actual = fit_scores(raw_liquidity[None, :])[0]
        np.testing.assert_allclose(actual, expected, atol=1e-12)

    def test_export_has_complete_daily_coverage_and_synchronized_dimensions(self):
        path = Path(__file__).resolve().parents[1] / "assets/amm/v3-daily-history.json"
        data = json.loads(path.read_text())
        self.assertEqual(data["source"]["release_tag"], "data-2026-11-03")
        self.assertEqual(data["source"]["missing_dates"], [])
        self.assertEqual(len(data["prices"]), 101)
        days = data["days"]
        self.assertEqual(len(days), 1768)
        self.assertEqual(days[0]["date"], "2022-01-01")
        self.assertEqual(days[-1]["date"], "2026-11-03")
        expected = pd.date_range("2022-01-01", "2026-11-03", freq="D").strftime("%Y-%m-%d").tolist()
        self.assertEqual([day["date"] for day in days], expected)
        for day in days:
            self.assertTrue(day["timestamp"].endswith("T00:00:00Z"))
            self.assertEqual(len(day["usdc"]), 101)
            self.assertEqual(len(day["usdt"]), 101)
            self.assertEqual(len(day["scores"]), 6)
            self.assertTrue(np.isfinite(day["scores"]).all())
            self.assertGreaterEqual(min(day["usdc"] + day["usdt"]), 0)
            if day["active_bin"] is not None:
                self.assertEqual(data["tick_lowers"][day["active_bin"]], day["pool_tick"])
        stressed = next(day for day in days if day["date"] == "2023-03-12")
        self.assertIsNone(stressed["active_bin"])
        self.assertEqual(sum(stressed["usdt"]), 0)


if __name__ == "__main__":
    unittest.main()
