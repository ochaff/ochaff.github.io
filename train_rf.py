"""
Train an onset-based Random Forest, calibrate a validation-only NP alert policy,
fit Student-t GARCH forecasts, and write dashboard_data/rf_results.json.
"""
import os
import sys
import json
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import brier_score_loss, roc_auc_score


# ─── repo root so build_dataset imports work ──────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from monitor_models import (onset_labels, hourly_prices, partition_bounds, complete_events,
                            np_policy, garch_forecast, MIN_LEAD, RESET, HORIZON)

# ─── Feature display names ────────────────────────────────────────────────────
DISPLAY = {
    "w_USDC": "Curve USDC weight",
    "w_USDT": "Curve USDT weight",
    "w_DAI":  "Curve DAI weight",
    "curve_entropy":            "Curve pool entropy",
    "totalValueLockedUSD":      "Curve TVL (USD)",
    "hourlyVolumeUSD":          "Curve hourly volume (USD)",
    "gauge_share_3crv":         "3CRV gauge share",
    "hhi_24h_rolling_mean":     "Liq. ownership HHI (24h MA)",
    "tick_width_24h_rolling_median": "Tick width (24h median)",
    "n_in_range_log_return":    "In-range positions (log ret.)",
    "weighted_mean_age_hours":  "LP position age (hours)",
    "swap_count_100":           "Uniswap swap count (1bp pool)",
    "swap_count_500":           "Uniswap swap count (5bp pool)",
    "net_amountUSD_100":        "Uniswap net flow USD (1bp)",
    "tvlUSD_100":               "Uniswap TVL (1bp pool)",
    "tvlUSD_500":               "Uniswap TVL (5bp pool)",
    "liquidation_USD":          "AAVE liquidations (USD)",
    "supplied_USD_usdt":        "AAVE USDT supplied (USD)",
    "utilisation_rate_usdt":    "AAVE USDT utilisation",
    "supplied_USD_usdc":        "AAVE USDC supplied (USD)",
    "utilisation_rate_usdc":    "AAVE USDC utilisation",
    "eth_price_usd":            "ETH price (USD)",
    "btc_price_usd":            "BTC price (USD)",
    "usd_index":                "USD index (DXY proxy)",
    "fx_volatility":            "FX volatility (7d)",
    "fear_greed_index":         "Fear & greed index",
}
for i in range(8):
    DISPLAY[f"Gegenbauer_0.4_deg{i}"] = f"Liq. curve shape (deg {i})"
    DISPLAY[f"Gegenbauer_0.5_deg{i}"] = f"Liq. curve shape (deg {i})"


def _display(col):
    return DISPLAY.get(col, col)


# ─── Notable metric definitions ────────────────────────────────────────────────
NOTABLE_COLS = [
    # The monitored pool is the Uniswap USDC/USDT v3 0.01% pool (fee tier 100).
    # Keep these raw measures in the dashboard payload, independently of whether
    # they rank among the model's top explanatory features for a given run.
    "tvlUSD_100", "net_amountUSD_100", "swap_count_100",
    "w_USDC", "w_USDT", "w_DAI",
    "curve_entropy",
    "Gegenbauer_0.4_deg0", "Gegenbauer_0.4_deg1", "Gegenbauer_0.4_deg2",
    "hhi_24h_rolling_mean",
    "tick_width_24h_rolling_median",
    "utilisation_rate_usdt", "utilisation_rate_usdc",
    "fear_greed_index",
    "depeg_bps",
]


def build_or_load(dataset_path, alpha, **kwargs):
    os.makedirs(dataset_path, exist_ok=True)
    from build_dataset import build_dataset
    path = build_dataset(dataset_path=dataset_path, alpha=alpha, **kwargs)
    df = pd.read_parquet(path)
    return df


TARGET_THRESHOLD_BPS = 15
TARGET_WINDOW_HOURS = 24


def train_and_explain(df, alpha):
    # Preserve every realized hour and the latest live observation separately
    # from the mature, uncensored rows available for supervised fitting.
    df = df.copy()
    df.index = pd.to_datetime(df.index, utc=True)
    df = df.sort_index()
    prices = hourly_prices(df['depeg_bps'])
    df = df.reindex(prices.index)
    drop_cols = {'target', 'depeg_bps'} | {c for c in df.columns if 'target' in c.lower()}
    feature_cols = [c for c in df.columns if c not in drop_cols
                    and pd.api.types.is_numeric_dtype(df[c])]
    for lag in range(1, 8):
        name = f'depeg_bps_lag{lag}h'
        df[name] = prices.shift(lag)
        if name not in feature_cols:
            feature_cols.append(name)
    X = df[feature_cols].replace([np.inf, -np.inf], np.nan).ffill().astype('float32')
    bounds = partition_bounds(prices)
    parts = {}
    for name, (start, end) in bounds.items():
        labels, _ = onset_labels(prices, end=end)
        selected = labels.index[(labels.index >= start) & labels.eligible]
        parts[name] = (X.loc[selected], labels.loc[selected, 'target'])
        print(f'{name}: {len(selected):,} mature rows, {start} through {end}', flush=True)
    X_train, y_train = parts['train']
    # Imputation is learned exclusively on fit data. Never backward-fill or
    # compute medians on calibration, validation or test observations.
    medians = X_train.median().fillna(0)
    X = X.fillna(medians)
    parts = {name: (features.fillna(medians), labels)
             for name, (features, labels) in parts.items()}
    X_train, y_train = parts['train']
    X_cal, y_cal = parts['calibration']
    X_val, y_val = parts['validation']
    X_test, y_test = parts['test']
    if any(len(part[0]) == 0 for part in parts.values()):
        raise ValueError('Each chronological partition needs uncensored observations')
    if y_train.nunique() != 2 or y_cal.nunique() != 2:
        raise ValueError('Fit and probability-calibration periods each need both target classes')
    validation_events = complete_events(prices, *bounds['validation'])

    # ── Train RF ──────────────────────────────────────────────────────────────
    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_leaf=20,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        # Keep the hosted runner stable. ``-1`` starts a worker per CPU and can
        # multiply the memory used by a forest on top of dataset construction.
        n_jobs=int(os.environ.get("RF_N_JOBS", "1")),
    )
    rf.fit(X_train, y_train)

    # `class_weight="balanced"` is useful for learning rare events but changes
    # the class prior, so its raw `predict_proba` output is not a calibrated risk.
    # Fit a sigmoid calibrator only on the temporally subsequent calibration set.
    calibrated = True
    # scikit-learn 1.7+ removed ``cv="prefit"``. Wrapping the already
    # fitted forest in FrozenEstimator preserves the two-stage, temporal
    # calibration design: fitting the calibrator cannot refit the forest.
    model = CalibratedClassifierCV(
        estimator=FrozenEstimator(rf), method="sigmoid"
    )
    model.fit(X_cal, y_cal)

    policy = np_policy(y_val, model.predict_proba(X_val)[:, 1],
                       event_count=len(validation_events))
    policy['validation_start'], policy['validation_end'] = map(str, bounds['validation'])
    policy['validation_event_times'] = [str(t) for t in validation_events]
    print(f"NP threshold: {policy['threshold']}; events={len(validation_events)}; "
          f"validation FPR={policy['validation_fpr']}", flush=True)

    test_proba = model.predict_proba(X_test)[:, 1]
    auc = float(roc_auc_score(y_test, test_proba)) if y_test.nunique() == 2 else None
    brier = float(brier_score_loss(y_test, test_proba))
    print(f'Test AUC: {auc}; Brier score: {brier:.4f}', flush=True)

    # ── SHAP ──────────────────────────────────────────────────────────────────
    try:
        import shap

        # Global SHAP on a sample of test data (cap at 2000 rows for speed)
        shap_sample = X_test.sample(min(2000, len(X_test)), random_state=0)
        explainer = shap.TreeExplainer(rf)
        sv_global = explainer.shap_values(shap_sample)

        # Handle both old list-return and new array-return APIs
        if isinstance(sv_global, list):
            sv_global_cls1 = sv_global[1]   # class-1 SHAP values
        else:
            sv_global_cls1 = sv_global[..., 1] if sv_global.ndim == 3 else sv_global

        mean_abs = np.abs(sv_global_cls1).mean(axis=0)
        global_shap = sorted(
            [
                {"feature": f, "importance": float(v), "display_name": _display(f)}
                for f, v in zip(feature_cols, mean_abs)
            ],
            key=lambda x: x["importance"],
            reverse=True,
        )[:20]

        # Local SHAP for the most recent observation
        X_latest = X.iloc[[-1]]
        sv_local = explainer.shap_values(X_latest)
        if isinstance(sv_local, list):
            sv_local_cls1 = sv_local[1][0]
        else:
            sv_local_cls1 = sv_local[0, :, 1] if sv_local.ndim == 3 else sv_local[0]

        local_shap = sorted(
            [
                {
                    "feature": f,
                    "shap_value": float(v),
                    "feature_value": float(X_latest[f].values[0]),
                    "display_name": _display(f),
                }
                for f, v in zip(feature_cols, sv_local_cls1)
            ],
            key=lambda x: abs(x["shap_value"]),
            reverse=True,
        )[:20]

    except Exception as e:
        print(f"SHAP failed: {e}. Falling back to RF feature importance.")
        fi = rf.feature_importances_
        global_shap = sorted(
            [
                {"feature": f, "importance": float(v), "display_name": _display(f)}
                for f, v in zip(feature_cols, fi)
            ],
            key=lambda x: x["importance"],
            reverse=True,
        )[:20]
        local_shap = []

    # ── Latest-row prediction ─────────────────────────────────────────────────
    X_latest = X.iloc[[-1]]
    prob = float(model.predict_proba(X_latest)[0, 1])
    print(f"Calibrated 2–24h probability of a ±{TARGET_THRESHOLD_BPS} bps depeg onset: {prob:.1%}")

    latest_price = prices.iloc[-1]
    full_history = len(prices) > 24 and prices.iloc[-25:-1].notna().all()
    live_reason = ('missing_price' if not np.isfinite(latest_price) else
                   'already_depegged' if abs(latest_price) >= TARGET_THRESHOLD_BPS else
                   'incomplete_history' if not full_history else None)
    live_eligible = live_reason is None

    # ── Notable metric values ─────────────────────────────────────────────────
    latest_full = df.iloc[-1]
    notable = {}
    for col in NOTABLE_COLS:
        if col in df.columns:
            val = latest_full[col]
            notable[col] = None if pd.isna(val) else float(val)
    notable["display_names"] = {c: _display(c) for c in notable if c != "display_names"}

    # ── Depeg history (last 7 days = 168 h) ──────────────────────────────────
    hist_df = prices.abs().rename("depeg_bps").to_frame().iloc[-168:].copy()
    hist_df.index = hist_df.index.astype(str)
    depeg_history = [
        {"timestamp": ts, "depeg_bps": None if pd.isna(v) else float(v)}
        for ts, v in hist_df["depeg_bps"].items()
    ]

    return {
        "probability": prob,
        "auc": auc,
        "brier_score": brier,
        "calibrated": calibrated,
        "target_threshold_bps": TARGET_THRESHOLD_BPS,
        "target_window_hours": TARGET_WINDOW_HOURS,
        "timestamp": str(df.index[-1]),
        "early_warning": {
            "policy": policy,
            "alert": bool(prob >= policy['threshold']) if live_eligible and policy['threshold'] is not None else None,
            "status": ('active' if policy['threshold'] is not None else policy['status']) if live_eligible else 'censored',
            "censor_reason": live_reason,
            "min_lead_hours": MIN_LEAD, "max_lead_hours": HORIZON,
            "event_reset_hours": RESET,
            "split_periods": {name: {"start": str(start), "end": str(end),
                                     "eligible_rows": len(parts[name][0])}
                              for name, (start, end) in bounds.items()},
            "test_events": len(complete_events(prices, *bounds['test'])),
            "test_fpr": float((test_proba[y_test == 0] >= policy['threshold']).mean())
                if policy['threshold'] is not None and (y_test == 0).any() else None,
        },
        "shap_basis": "uncalibrated_base_random_forest",
        "alpha": alpha,
        "local_shap": local_shap,
        "global_shap": global_shap,
        "notable_values": notable,
        "depeg_history": depeg_history,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset-parquet', help='Use an existing feature dataset instead of rebuilding')
    parser.add_argument('--alpha', type=float, default=.4)
    parser.add_argument('--output', default='dashboard_data/rf_results.json')
    parser.add_argument('--simulations', type=int, default=100_000)
    args = parser.parse_args()
    ALPHA = args.alpha
    DATASET_PATH = './preprocessed_datasets'

    if args.dataset_parquet:
        df = pd.read_parquet(args.dataset_parquet)
    else:
        print('Building dataset…', flush=True)
        df = build_or_load(
            dataset_path=DATASET_PATH,
            alpha=ALPHA,
            aave=True,
            aave_liq=True,
            crv=True,
            eth_price=True,
            eth_indicators=False,
            btc_price=True,
            btc_indicators=False,
            usd_index=True,
            usd_indicators=False,
            fear_greed=True,
            gegen=True,
            gegen_indicators=False,
            swap_size=True,
            liq_ownership=True,
            target=False,  # Event-onset labels are rebuilt with partition-specific outcome caps.
            target_window=TARGET_WINDOW_HOURS,
            target_threshold=TARGET_THRESHOLD_BPS,
            depeg_side="both",
            # The dashboard is explicitly a ±15 bps event monitor. Dynamic
            # quantile excursions describe a different target and must not be
            # mixed into this probability.
            dynamic_threshold=False,
            use_log_price=False,
        )

    print(f"Dataset shape: {df.shape}")
    result = train_and_explain(df, ALPHA)

    print('Fitting Student-t GARCH and simulating 24-hour forecasts…', flush=True)
    result['forecasting'] = garch_forecast(df['depeg_bps'], simulations=args.simulations)
    result['schema_version'] = 2
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = out_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2, allow_nan=False))
    temporary.replace(out_path)
    print(f'Saved → {out_path}', flush=True)


if __name__ == "__main__":
    main()
