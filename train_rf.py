"""
Train a Random Forest on the depeg dataset, compute SHAP explanations,
and write dashboard_data/rf_results.json for the monitoring page.
"""
import os
import sys
import json
import warnings
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score

warnings.filterwarnings("ignore")

# ─── repo root so build_dataset imports work ──────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_dataset import build_dataset

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
    path = build_dataset(dataset_path=dataset_path, alpha=alpha, **kwargs)
    df = pd.read_parquet(path)
    return df


def train_and_explain(df, alpha):
    # ── Feature / target split ────────────────────────────────────────────────
    drop_cols = {"target", "depeg_bps"} | {c for c in df.columns if "target" in c.lower()}
    feature_cols = [c for c in df.columns if c not in drop_cols]

    df_clean = df.dropna(subset=["target"]).copy()
    X = df_clean[feature_cols].astype("float32")
    y = df_clean["target"].astype(int)

    # Fill remaining NaN with forward-fill then column median
    X = X.ffill().bfill()
    X = X.fillna(X.median())

    # ── Time-based split (last 20% as test) ───────────────────────────────────
    split = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split], X.iloc[split:]
    y_train, y_test = y.iloc[:split], y.iloc[split:]

    print(f"Train: {len(X_train):,} rows  Test: {len(X_test):,} rows")
    print(f"Positive rate train: {y_train.mean():.2%}  test: {y_test.mean():.2%}")

    # ── Train RF ──────────────────────────────────────────────────────────────
    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_leaf=20,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)

    test_proba = rf.predict_proba(X_test)[:, 1]
    try:
        auc = roc_auc_score(y_test, test_proba)
        print(f"Test AUC: {auc:.4f}")
    except Exception:
        auc = None

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
    prob = float(rf.predict_proba(X_latest)[0, 1])
    print(f"24h depeg probability (latest obs): {prob:.1%}")

    # ── Notable metric values ─────────────────────────────────────────────────
    latest_full = df_clean.iloc[-1]
    notable = {}
    for col in NOTABLE_COLS:
        if col in df_clean.columns:
            val = latest_full[col]
            notable[col] = None if pd.isna(val) else float(val)
    notable["display_names"] = {c: _display(c) for c in notable if c != "display_names"}

    # ── Depeg history (last 7 days = 168 h) ──────────────────────────────────
    hist_df = df_clean[["depeg_bps"]].iloc[-168:].copy()
    hist_df.index = hist_df.index.astype(str)
    depeg_history = [
        {"timestamp": ts, "depeg_bps": None if pd.isna(v) else float(v)}
        for ts, v in hist_df["depeg_bps"].items()
    ]

    return {
        "probability": prob,
        "auc": auc,
        "timestamp": str(df_clean.index[-1]),
        "alpha": alpha,
        "local_shap": local_shap,
        "global_shap": global_shap,
        "notable_values": notable,
        "depeg_history": depeg_history,
    }


def main():
    ALPHA = 0.4
    DATASET_PATH = "./preprocessed_datasets"

    print("Building dataset…")
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
        target=True,
        target_window=24,
        target_threshold=5,
        depeg_side="both",
        dynamic_threshold=True,
        use_log_price=False,
    )

    print(f"Dataset shape: {df.shape}")
    result = train_and_explain(df, ALPHA)

    out_dir = "dashboard_data"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "rf_results.json")
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"Saved → {out_path}")


if __name__ == "__main__":
    main()
