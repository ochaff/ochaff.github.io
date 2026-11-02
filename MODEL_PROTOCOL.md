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
15.81% (Elevated). Its probability is unchanged by the subsequent GARCH audit.

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

Constant-mean GARCH(1,1) with standardized Student-t innovations is fitted to
signed hourly depeg levels in basis points, with `rescale=False` and no input
scaling. The full expanding history is used, requiring at least 720 nonconstant
hours. Internal historical price gaps are forward-filled causally for this fit
only; a missing forecast-origin observation is rejected. Missing realized
prices remain missing for Random Forest labels and the observed price chart.
The export records the number of historical filled hours and the fitting dates.

This matches the model and analytical marginal forecast in QuantLet's
[probabilistic-forecast benchmark](https://github.com/QuantLet/onchain-insights/blob/303c6399357a00e11897aa30e598bc6f23b6fb45/12.%20Evaluation%20of%20Probabilistic%20Forecasts/benchmark_scripts/GARCH_forecast.py).
The live job refits at every update. The reference is a retrospective rolling
benchmark that reuses fixed parameters between refits; its current invocation
sets `refit_every=20000` despite an adjacent daily-refit comment. That test-loop
cadence is not copied into the live monitor.

Forecast 24 hourly expected conditional variances analytically. For horizon h,
`Q_h(u) = mu + sigma_h × sqrt((nu−2)/nu) × t_nu.ppf(u)`, with the reference's
`nu >= 2.05` guard. The median is the constant fitted mean. The signed lower and
upper 1% ES curves use analytical Student-t tail integrals. These multi-step
Student-t marginals **approximate** the predictive variance mixture; they are
not exact recursive-path distribution quantiles. No Monte Carlo sampling,
random seed, artificial smoothing, or monotonicity constraint is used.

Terminal token VaR/ES use nonnegative adverse quote-deviation losses at hour
24: `USDC = max(−depeg_bps, 0)`, `USDT = max(depeg_bps, 0)`. The token with the
larger 1% VaR is the **Token at risk**. These are relative quote deviations,
not USD portfolio P&L. ES integrates positive losses over the worst alpha mass,
including zero losses where appropriate; clipping a signed tail mean alone
would be incorrect when VaR is zero but rare adverse outcomes remain possible.
Both 1% and 0.5% terminal levels are exported.

Each hourly record includes `variance_bps2` and `sigma_bps`. The export includes
parameters, variance persistence `alpha + beta`, the forecast method and a
near-integrated flag when persistence is at least 0.999. The 2 November 2026 fit
is near-integrated; its sigma rises from 9.46 to 9.52 bps over 24 hours. Model
alignment does not establish out-of-sample interval coverage. See
[GARCH_AUDIT.md](GARCH_AUDIT.md) for the old forecast diagnosis and current fit.

The price chart uses signed `price_history` and
`price_ratio = 1 + depeg_bps / 10000`. `depeg_history` remains absolute for the
original page. The chart provides 24-hour, 72-hour and seven-day history
windows, price/bps axes, interval and ES toggles, and ±15 bps reference lines.
Forecast hover values always use bps from peg.

## Audited feature definitions

`feature_dictionary.py` provides definitions, units, exact formulas, notes and
collection/preprocessing sources for all 50 enabled predictors plus the raw
depeg measure. Unknown feature names fail export, requiring an audited definition
when a dataset's feature configuration changes. Gegenbauer alpha variants are
recognized for degrees 0–7. Optional technical indicators outside the current
workflow need definitions before they can be published.

Every model run embeds the dictionary in `rf_results.json` and writes the same
map to `dashboard_data/feature_dictionary.json`. The checked-in human-readable
companion is [FEATURE_DICTIONARY.md](FEATURE_DICTIONARY.md). The Metrics tab
shows a `?` button beside every feature: hover, keyboard focus or tap reveals
the definition. Escape, blur or clicking elsewhere dismisses it. The floating
panel is placed outside the clipped feature grid and constrained to the viewport.

Labels now reflect actual calculations: `net_amountUSD` is swap notional,
`n_in_range_log_return` is a fractional count change, and `gauge_share_3crv`
is an LP-token-per-USD inventory proxy, not a percentage. The underlying model
feature names, values, forest, probability, SHAP values and histograms were not
changed by the dictionary update.

## Liquidity views

The Liquidity tab contains `figures/uni_liquidity.html` and
`figures/crv_balance.html`, side by side on desktop with venue subviews on
phones. Both embeds resize to their available viewport. A Uniswap export can
use a native hourly scrubber marked `data-liquidity-controls`; the parent
reserves that control height when resizing the Plotly canvas. Figure URLs
include the observation timestamp to avoid stale cached plots after updates.
