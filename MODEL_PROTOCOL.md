# AMMonitor model and display protocol

Run `pip install -r requirements-monitor.txt`, `bash update_data.sh`, then
`python -u train_rf.py`. The GitHub workflow tests the model helpers and publishes
`dashboard_data/rf_results.json`. Both monitoring pages consume that file.
The standalone tabbed dashboard is `depeg-monitor-ida.html`.

For an existing feature dataset, use
`python train_rf.py --dataset-parquet /path/to/features.parquet --alpha 0.1 --output /tmp/results.json`.
RF training now defaults to and accepts alpha 0.1. Supplied parquet files are
checked against their Gegenbauer column names; a mismatched alpha is rejected.
The workflow explicitly invokes `train_rf.py --alpha 0.1`.

The updated forecasting builder is called with `train_pct=0.70` and
`last_date=None`. Its weighted-normalized, time-centered Gegenbauer definition
is retained. For RF, the centering mean is fitted only through the RF training
partition's final complete 24-hour label origin, rather than using a fraction
of an independently growing liquidity dataset. This cutoff is passed via the
optional `feature_fit_end` argument; forecasting callers retain their defaults.
The adapter restores raw observed depeg values after building so forward-filled
prices cannot create monitoring outcomes. Only required liquidity columns are
read, and unused reconstructions are skipped without changing coefficients.
The existing published alpha-0.4 results remain historical until the next full
workflow run regenerates the model and explanations from alpha 0.1.

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

Histograms use the full available history of hourly feature observations,
excluding the current row. Each feature records its finite-value reference
start and end dates, observation count and `full_history` scope. Edges span the empirical 0.5th–99.5th percentiles; observations
outside this range are grouped into the end bins. The displayed percentile
rank uses all reference values. Current markers outside the displayed range
are clamped to an edge and flagged with an arrow. No synthetic distributions
are substituted for missing history.

The Drivers tab is removed. Metrics displays local SHAP beside Feature Importance,
including average absolute SHAP across the test sample and its global rank
across all predictors (ties share a competition rank). Filtering and pagination
do not change those ranks. Help icons explain both quantities and the
pre-calibration probability scale. If SHAP is unavailable, fallback forest
importance is not presented as average absolute SHAP.

The default view sorts by absolute local SHAP. Other choices sort by global
impact or filter Uniswap curve shape, market, Curve pool and Uniswap pool
features. Pagination adapts to viewport height; it preserves the no-scroll
layout. The raw current deviation is also available in market metrics,
without falsely attributing a SHAP value to a non-model feature.

## Accumulated Local Effects (ALE)

Every RF training run now computes first-order ALE for all 50 predictors of
the **calibrated class-1 probability**. This differs from SHAP, which explains
the base forest before calibration. ALE follows the local endpoint-difference
construction of [Apley and Zhu](https://arxiv.org/abs/1612.08468): each reference
row is evaluated with just the selected feature moved to its bin's lower and
upper edges, leaving its other features unchanged. The within-bin mean
probability differences are accumulated. The resulting piecewise-linear curve
is centered so its empirical average over the reference values is zero.

The reference uses all available hourly model-input rows before the current
observation, after the same causal filling and fit-period-median imputation
used for prediction. It is for explanation only and does not enter forest
fitting, calibration or held-out scoring. The default grid requests 30
order-statistic quantile bins; duplicate edges are merged. Discrete or tied
features therefore have fewer bins, rather than artificial empty intervals.
A constant predictor has zero effect on its observed support, without implying
anything about unobserved values. Raw `depeg_bps` is not a forest input and has
no ALE curve.

Approximate **95% pointwise** percentile intervals use 300 circular moving-block
bootstrap resamples of the chronological reference rows, with 168-hour blocks
and seed 42. The fitted forest, calibrator and bin edges remain fixed. Local
endpoint predictions are reused, so bootstrap resampling does not require
additional model evaluations or forest fitting. Each resample's curve is
recentered against its own reference distribution. A resample missing a bin is
excluded; intervals are omitted if fewer than max(100, 80% of requested)
resamples cover the entire grid. Counts and interval status are exported.
These bands quantify reference-history variability conditional on the fitted
model, not model-refitting uncertainty, simultaneous coverage, or prediction
uncertainty. Temporal stability and the adequacy of the chosen block length
are assumptions, not guaranteed by this procedure.

`train_rf.py` embeds `ale` in `dashboard_data/rf_results.json` and writes the
identical standalone object to `dashboard_data/ale_results.json`; the workflow
archives and commits both. The JSON records timestamp, reference period,
probability units, centering, bootstrap settings, and a feature-name map. Each
feature contains x/grid edges, centered effects, lower/upper interval bounds,
local bin effects, bin counts, interval status and a full-range histogram.
Values are probabilities in JSON; the page multiplies by 100 for percentage
points. Settings are configurable with `--ale-bins`, `--ale-bootstraps` and
`--ale-block-hours`; defaults are 30, 300 and 168.

Clicking a Metrics histogram opens an accessible dialog
with the ALE curve, 95% band and historical distribution below it. A red line
marks the current value on both aligned x axes. The default central 99% view
matches the compact histogram's percentile limits, grouping distribution tails
at the edges; Full range shows a separate histogram across all observed values.
Markers outside the selected range are clamped and explicitly labeled. There
is no ALE extrapolation beyond reference support. The caption distinguishes
global probability effects from causal effects, local SHAP and individual
predictions. Escape, the close button or a backdrop click closes the dialog
and restores focus. A timestamp mismatch does not display stale ALE data.

## ANGEL forecast and price chart

Forecasting now uses the newest published ANGEL bundle from QuantLet Releases,
with frozen preprocessing, verified hashes and reference fixtures, and CPU-only
inference. See [ANGEL_DEPLOYMENT.md](ANGEL_DEPLOYMENT.md) for the release contract,
selection policy, implementation, tail-risk definitions and runtime checks.
The former GARCH implementation is retained for historical reproducibility.

The chart shows signed price history, ANGEL median and 1st–99th percentiles,
optional signed ES, and ±15 bps thresholds. Forecast hover values always use
basis points from peg. The Models tab shows the checkpoint release and training
cutoff. The RF probability remains a separate calibrated monitoring model.

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

## Saved RF prediction timeline

`rf_prediction_history.json` archives actual saved monitoring outputs; no past
probabilities are recomputed with a later fit. Each training run preserves the
previous published output and appends its new score, with observation time,
first-recorded time, risk band, alpha, protocol and model/run reference. Exact
reruns deduplicate; changed scores at the same origin remain separate revisions.
The full archive is retained and the latest seven days by observation time are
embedded in `rf_results.json` as `prediction_history`. The workflow commits and
archives the history file alongside the model outputs.

The initial archive recovers committed results from repository commits. Legacy
monitoring outputs are marked explicitly; onset/NP-policy results are excluded.
Historical model versions and calibration protocols may differ. Risk-band colors
apply today's descriptive thresholds to each saved probability. The archive never interpolates missing hours.

The monitor's scatter plot uses `hourly_prediction_history`: 168 hourly scores
from the current calibrated model applied to the last seven days of feature rows,
including the latest prediction. These are retrospective current-model scores,
not predictions issued by historical model versions. They are recomputed on every
training run and kept separate from the immutable saved-run archive. The caption
and hover identify this basis. Missing feature values use the same causal forward
fill and train-only medians as the live prediction. Until hourly scores are
available, the plot falls back to saved run outputs with their original labels.
