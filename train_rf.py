"""
Train a 24-hour monitoring Random Forest with probability risk bands,
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
from monitor_models import (monitoring_labels, hourly_prices, monitoring_bounds,
                            monitoring_level, feature_catalog, garch_forecast, HORIZON)
from feature_dictionary import feature_dictionary


def _display(col):
    return feature_dictionary([col])[col]['label']


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
    X = df[feature_cols].replace([np.inf, -np.inf], np.nan).ffill().astype('float32')
    bounds = monitoring_bounds(prices)
    parts = {}
    for name, (start, end) in bounds.items():
        labels = monitoring_labels(prices, end=end)
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
    X_test, y_test = parts['test']
    if any(len(part[0]) == 0 for part in parts.values()):
        raise ValueError('Each chronological partition needs uncensored observations')
    if y_train.nunique() != 2 or y_cal.nunique() != 2:
        raise ValueError('Fit and probability-calibration periods each need both target classes')

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

    test_proba = model.predict_proba(X_test)[:, 1]
    auc = float(roc_auc_score(y_test, test_proba)) if y_test.nunique() == 2 else None
    brier = float(brier_score_loss(y_test, test_proba))
    print(f'Test AUC: {auc}; Brier score: {brier:.4f}', flush=True)

    local_values, global_values = {}, {}
    global_basis = 'mean_abs_shap'

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
        global_values = {f: float(v) for f, v in zip(feature_cols, mean_abs)}
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

        local_values = {f: float(v) for f, v in zip(feature_cols, sv_local_cls1)}
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
        global_basis = 'forest_feature_importance'
        global_values = {f: float(v) for f, v in zip(feature_cols, fi)}
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
    print(f"Calibrated next-24h probability of a ±{TARGET_THRESHOLD_BPS} bps breach: {prob:.1%}")

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
        "monitoring": {
            "mode": "probability_risk_bands",
            "target_definition": "any_threshold_breach_in_next_24h",
            "horizon_hours": HORIZON,
            "risk_level": monitoring_level(prob),
            "bands": [{"label": "Low", "min": 0, "max": .10},
                      {"label": "Elevated", "min": .10, "max": .20},
                      {"label": "High", "min": .20, "max": .50},
                      {"label": "Critical", "min": .50, "max": 1}],
            "split_periods": {name: {"start": str(start), "end": str(end),
                                     "eligible_rows": len(parts[name][0])}
                              for name, (start, end) in bounds.items()},
        },
        "feature_catalog": [dict(item, display_name=_display(item['feature']))
                            for item in feature_catalog(X.assign(depeg_bps=prices), local_values, global_values)],
        "feature_dictionary": feature_dictionary([*X.columns, 'depeg_bps']),
        "global_impact_basis": global_basis,
        "shap_basis": "uncalibrated_base_random_forest",
        "alpha": alpha,
        "local_shap": local_shap,
        "global_shap": global_shap,
        "notable_values": notable,
        "depeg_history": depeg_history,
        "price_history": [
            {"timestamp": str(ts),
             "depeg_bps": float(value) if pd.notna(value) else None,
             "price_ratio": 1 + float(value) / 10_000 if pd.notna(value) else None}
            for ts, value in prices.iloc[-168:].items()
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset-parquet', help='Use an existing feature dataset instead of rebuilding')
    parser.add_argument('--alpha', type=float, default=.4)
    parser.add_argument('--output', default='dashboard_data/rf_results.json')
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
            target=False,  # Monitoring breach labels use partition-specific outcome caps.
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

    print('Fitting QuantLet-aligned Student-t GARCH analytical forecasts…', flush=True)
    result['forecasting'] = garch_forecast(df['depeg_bps'])
    result['schema_version'] = 5
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = out_path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2, allow_nan=False))
    temporary.replace(out_path)
    dictionary_path = out_path.parent / 'feature_dictionary.json'
    temporary_dictionary = dictionary_path.with_suffix('.tmp')
    temporary_dictionary.write_text(json.dumps(result['feature_dictionary'], indent=2, allow_nan=False))
    temporary_dictionary.replace(dictionary_path)
    print(f'Saved → {out_path}', flush=True)


if __name__ == "__main__":
    main()
