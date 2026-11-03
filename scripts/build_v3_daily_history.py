"""Export reproducible 00:00 UTC liquidity snapshots from a dated dataset release.

Usage:
  python scripts/build_v3_daily_history.py --archive /path/to/uniswap_data.zip

Requires numpy, pandas, scipy and pyarrow. No network calls or onchain queries.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pandas as pd
from scipy.special import eval_gegenbauer

REPOSITORY = "https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data"
POOL = "0x3416cf6c708da44db2624d63ea0aaef7113527c6"
TICKS = np.arange(-50, 51)
ALPHA = 0.4
DEGREE = 5


def fit_scores(liquidity: np.ndarray) -> np.ndarray:
    """Fit degrees 0–5 to log1p(raw L), using the post's endpoint-normalized basis.

    Ordinary least squares on a fixed tickLower/50 grid; no time centering,
    training baseline, time-varying normalization or post-fit coefficient scaling.
    """
    liquidity = np.asarray(liquidity, dtype=float)
    if liquidity.ndim != 2 or liquidity.shape[1] != len(TICKS):
        raise ValueError("Expected one 101-bin liquidity vector per snapshot")
    if not np.isfinite(liquidity).all() or (liquidity < 0).any():
        raise ValueError("Liquidity must be finite and nonnegative")
    u = TICKS / 50.0
    basis = np.column_stack([
        eval_gegenbauer(n, ALPHA, u) / eval_gegenbauer(n, ALPHA, 1.0)
        for n in range(DEGREE + 1)
    ])
    return np.linalg.lstsq(basis, np.log1p(liquidity).T, rcond=None)[0].T


def daily_snapshots(frame: pd.DataFrame) -> pd.DataFrame:
    """Select real midnight observations; never average, interpolate or forward-fill."""
    data = frame.copy()
    data["hour"] = pd.to_datetime(data["hour"], utc=True).dt.as_unit("ns")
    data = data[data["timestamp"] % 86400 == 0].sort_values(["hour", "tickLower"])
    if data.empty:
        raise ValueError("No midnight UTC snapshots in source")
    if not (data["hour"].astype("int64") // 10**9 == data["timestamp"]).all():
        raise ValueError("Source hour and timestamp disagree")
    columns = ["priceMid", "usd_token0", "usd_token1", "active_liquidity_L"]
    if not np.isfinite(data[columns].to_numpy()).all():
        raise ValueError("Daily source contains nonfinite values")
    if (data[["usd_token0", "usd_token1", "active_liquidity_L"]] < 0).any().any():
        raise ValueError("Daily source contains negative liquidity")
    for _, group in data.groupby("hour", sort=True):
        if not np.array_equal(group["tickLower"].to_numpy(), TICKS):
            raise ValueError("Every day must have exactly one observation for each peg-grid bin")
        if not np.array_equal(group["tickUpper"].to_numpy(), TICKS + 1):
            raise ValueError("Unexpected tick-bin widths")
        if group["poolTick"].nunique() != 1 or group["block"].nunique() != 1:
            raise ValueError("A daily curve must come from a single pool state")
    return data


def build_history(archive: Path, tag: str) -> dict:
    with ZipFile(archive) as bundle:
        raw = bundle.read("data/Uniswap/hourly_liquidity_full.parquet")
        state_raw = bundle.read("data/Uniswap/hourly_pool_state_full.parquet")
    columns = ["hour", "timestamp", "block", "poolTick", "tickLower", "tickUpper",
               "priceMid", "usd_token0", "usd_token1", "active_liquidity_L"]
    full = pd.read_parquet(io.BytesIO(raw), columns=columns)
    data = daily_snapshots(full)
    states = pd.read_parquet(io.BytesIO(state_raw))
    states["hour"] = pd.to_datetime(states["hour"], utc=True)
    states = states[states["timestamp"] % 86400 == 0].set_index("hour")
    curves = list(data.groupby("hour", sort=True))
    price_grid = curves[0][1]["priceMid"].to_numpy()
    expected_prices = 1.0001 ** (TICKS + 0.5)
    if not np.allclose(price_grid, expected_prices, rtol=1e-12):
        raise ValueError("Price grid does not match USDT-per-USDC tick prices")
    liquidity = np.stack([group["active_liquidity_L"].to_numpy() for _, group in curves])
    coefficients = fit_scores(liquidity)
    days = []
    for index, (hour, group) in enumerate(curves):
        if not np.allclose(group["priceMid"].to_numpy(), price_grid, rtol=1e-12, atol=0):
            raise ValueError("Daily curves must use the same price grid")
        state = states.loc[hour]
        if state["token0"] != "USDC" or state["token1"] != "USDT" or state["dec0"] != 6 or state["dec1"] != 6:
            raise ValueError("Unexpected pool tokens or decimals")
        tick, block = int(group["poolTick"].iloc[0]), int(group["block"].iloc[0])
        if int(state["poolTick"]) != tick or int(state["block"]) != block:
            raise ValueError("Liquidity and pool state snapshots are not synchronized")
        active = np.flatnonzero((TICKS <= tick) & (tick < TICKS + 1))
        days.append({
            "date": hour.strftime("%Y-%m-%d"), "timestamp": hour.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "block": block, "pool_tick": tick, "tick_price": round(float(1.0001**tick), 10),
            "active_bin": int(active[0]) if len(active) else None,
            "usdc": group["usd_token0"].round(2).tolist(),
            "usdt": group["usd_token1"].round(2).tolist(),
            "scores": coefficients[index].round(8).tolist(),
        })
    observed = pd.DatetimeIndex([hour for hour, _ in curves])
    missing = pd.date_range(observed[0], observed[-1], freq="D").difference(observed)
    return {
        "schema_version": 1,
        "source": {
            "repository": REPOSITORY, "release_tag": tag,
            "release_url": f"{REPOSITORY}/releases/tag/{tag}",
            "asset_url": f"{REPOSITORY}/releases/download/{tag}/uniswap_data.zip",
            "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
            "liquidity_parquet_sha256": hashlib.sha256(raw).hexdigest(),
            "pool_state_parquet_sha256": hashlib.sha256(state_raw).hexdigest(),
            "liquidity_member": "data/Uniswap/hourly_liquidity_full.parquet",
            "pool_state_member": "data/Uniswap/hourly_pool_state_full.parquet",
            "pool_address": POOL, "chain": "Ethereum", "fee_percent": 0.01,
            "sampling": "One actual 00:00 UTC hourly snapshot per day; no averaging or filling",
            "source_hourly_start": str(full["hour"].min()), "source_hourly_end": str(full["hour"].max()),
            "missing_dates": [time.strftime("%Y-%m-%d") for time in missing],
            "valuation": "Source usd_token0/usd_token1 assume both tokens are worth $1; not oracle mark-to-market values",
        },
        "decomposition": {
            "lambda": ALPHA, "degree": DEGREE, "grid": "u = tickLower / 50",
            "transformation": "log1p(active_liquidity_L) in original dataset units",
            "basis": "B_n(u) = C_n^(0.4)(u) / C_n^(0.4)(1)",
            "fit": "Ordinary least squares, degrees 0 through 5 jointly; no time centering",
            "displayed_degrees": [1, 2, 3, 4, 5],
            "note": "Descriptive coefficients for this post; not AMMonitor's centered, weighted-normalized model features",
        },
        "prices": price_grid.round(10).tolist(), "tick_lowers": TICKS.tolist(),
        "bar_width": float(np.median(np.diff(price_grid)) * 0.88), "days": days,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--tag", default="data-2026-11-03")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "assets/amm/v3-daily-history.json")
    args = parser.parse_args()
    history = build_history(args.archive, args.tag)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(history, separators=(",", ":"), allow_nan=False) + "\n")
    print(f"Exported {len(history['days'])} daily curves: {history['days'][0]['date']} to {history['days'][-1]['date']}")
    print(f"{args.output}: {args.output.stat().st_size:,} bytes; {len(history['source']['missing_dates'])} missing days")


if __name__ == "__main__":
    main()
