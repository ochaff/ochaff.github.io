# AMMonitor model and display protocol

Run `pip install -r requirements-monitor.txt`, `bash update_data.sh`, then
`python -u train_rf.py`. The GitHub workflow tests the model helpers and publishes
`dashboard_data/rf_results.json`. Both monitoring pages consume that file.
The standalone tabbed dashboard is `depeg-monitor-ida.html`.

For an existing feature dataset, use
`python train_rf.py --dataset-parquet /path/to/features.parquet --alpha 0.4 --output /tmp/results.json`.
The alpha must match the precomputed Gegenbauer features.

## Monitoring Random Forest

The model again predicts **any ±15 bps threshold breach in the next 24 hours**.
This includes ongoing dislocations; it uses no onset declustering, minimum lead
requirement, or Neyman–Pearson threshold. Its configuration is the previous
balanced Random Forest: 300 trees, maximum depth 10, minimum leaf size 20,
square-root feature sampling, and seed 42. The additional onset-model price lags
are removed.

The chronological split is 70% forest fitting, 15% sigmoid probability
calibration, and 15% testing. Outcome windows are capped at each partition's
end, excluding its final 24 hours from supervised scoring. Feature imputation
uses causal forward filling and forest-fit medians, preserving the safeguards
against using future observations. Both fit and calibration periods require
two target classes. The newest feature row receives a live prediction even
though its future outcome has not yet matured.

Monitoring severity bands are descriptive display levels:

| Probability | Level |
| --- | --- |
| Below 10% | Low |
| 10% to below 20% | Elevated |
| 20% to below 50% | High |
| 50% or above | Critical |

`monitoring` stores the active target, level, bands and split periods. The
current export no longer contains `early_warning` or an NP cutoff. The
2 November 2026 data were retrained under this monitoring objective, yielding
15.81% (Elevated). The existing GARCH forecast was retained unchanged.

## Feature monitor

`feature_catalog` includes current values, full local SHAP contributions,
global importance, feature-group labels and historical histograms. SHAP
explains the **base forest score**, before sigmoid calibration. Positive local
SHAP is red; negative local SHAP is green. If SHAP fails, local attributions
remain unavailable and the global basis is explicitly marked as forest
feature importance.

Histograms use the previous 90 days of hourly feature observations, excluding
the current row. Edges span the empirical 0.5th–99.5th percentiles; observations
outside this range are grouped into the end bins. The displayed percentile
rank uses all reference values. Current markers outside the displayed range
are clamped to an edge and flagged with an arrow. No synthetic distributions
are substituted for missing history.

The default view sorts by absolute local SHAP. Other choices sort by global
impact or filter Uniswap curve shape, market, Curve pool and Uniswap pool
features. Pagination adapts to viewport height; it preserves the no-scroll
layout. The raw current deviation is also available in market metrics,
without falsely attributing a SHAP value to a non-model feature.

## GARCH forecast and price chart

AR(1)-GARCH(1,1) with standardized Student-t innovations is fitted to signed
hourly depeg levels in basis points. It uses the latest 8,760 observations of
the latest contiguous price history, requiring at least 720 nonconstant hours.
Optimization must converge and the autoregressive mean must be stationary.

Simulate 100,000 recursive 24-hour paths with seed 42. Student-t draws are
scaled by `sqrt((nu - 2) / nu)`. Export the simulated median, mean, 1st and 99th
percentiles, and mean of the lowest and highest 1% of signed outcomes at each
forecast hour. Price-chart tail means retain their signs; hover descriptions
for forecast VaR/ES use bps from peg even when the axis shows the price ratio.

Terminal token VaR/ES use nonnegative adverse quote-deviation losses at hour
24: `USDC = max(-depeg_bps, 0)`, `USDT = max(depeg_bps, 0)`. The token with the
larger 1% VaR is the **Token at risk**. These are relative quote deviations,
not USD portfolio P&L. ES averages the worst alpha fraction, with fractional
order-statistic weighting. Fit dates, parameters and simulation settings are
included in the JSON.

The price chart uses signed `price_history` and
`price_ratio = 1 + depeg_bps / 10000`. `depeg_history` remains absolute for the
original page. The chart provides 24-hour, 72-hour and seven-day history
windows, price/bps axes, interval and ES toggles, and ±15 bps reference lines.

The 2 November uploaded GARCH run was enriched by replaying the matching
public release with its original fitted parameters and random seed. Existing
means, quantiles and VaR/ES matched within 1e-12 and were preserved exactly.
Future workflow runs export the chart fields directly.

Simulation follows the [arch forecasting API](https://arch.readthedocs.io/en/latest/univariate/forecasting.html).

## Liquidity views

The Liquidity tab contains `figures/uni_liquidity.html` and
`figures/crv_balance.html`, side by side on desktop with venue subviews on
phones. Both embeds resize to their available viewport. A Uniswap export can
use a native hourly scrubber marked `data-liquidity-controls`; the parent
reserves that control height when resizing the Plotly canvas. Figure URLs
include the observation timestamp to avoid stale cached plots after updates.
