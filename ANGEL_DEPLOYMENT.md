# ANGEL CPU forecasting for AMMonitor

The active forecast pipeline is `angel_forecast.py`, using the released ANGEL
checkpoint and its frozen liquidity preprocessing. RF monitoring, SHAP and ALE
remain separate. GARCH helpers remain only for historical reproducibility/tests.

## Release selection and updates

Each run queries all GitHub Releases in `QuantLet/onchain-insights`, ignores
drafts and prereleases, and selects the **most recently published** release
containing `ammonitor-angel.json`. It does not sort tag names or rely on the
repository's manually selected “Latest” badge. It validates schema, both asset
SHA256 hashes, checkpoint feature order and architecture, a CPU reference-output
fixture, and the rebuilt historical reference-input window. An incompatible
new release fails the run rather than silently using an older model or GARCH.
Cache entries are keyed by release ID and verified by hash; manifests refresh
on every run. Checkpoints are loaded with `map_location='cpu'` and
`weights_only=True`; preprocessing uses `allow_pickle=False`.

The workflow runs after `data-release` or `model-release` repository dispatch,
on a daily 10:30 UTC schedule, or manually. A release in another repository does
not itself trigger this repository: it is picked up at the next such run. The
manual `model_release` input pins a tag for rollback; blank means newest.
Publish a new immutable stable release after uploading all three assets. The
current `amm-angel-20261103T093459Z` naming format works without changes.
Raw training data need not be included.

## Bundle contract

Assets are named by the manifest (currently `angel.ckpt` and
`angel_preprocessing.npz`), with `schema_version=1`, `model=ANGEL`, ordered
`input_columns` ending in `depeg_bps`, alpha, sequence length, 24-hour horizon,
raw-basis-point target units, full UTC training/preprocessing cutoffs, and hashes.
The current checkpoint takes 168 hours × 98 inputs (97 covariates plus target).
It uses a distributional spline head with GPD tails, not Student-t innovations.

Required NPZ arrays include `liquidity_tick_grid`, `liquidity_centering_curve`,
`liquidity_projection`, `reference_input`, and `reference_raw_output`. New curves
are reindexed onto the saved grid, centered by the saved curve and multiplied
by the saved projection. The remaining features are calculated with the
checkpoint's feature flags and selected in manifest order. No scaler or
centering mean is refitted on new data. Missing/extra required inputs, unknown
liquidity grid points, nonfinite windows, missing latest prices, or missing
hourly input coverage fail validation.

The runtime is vendored from QuantLet revision
`303c6399357a00e11897aa30e598bc6f23b6fb45`. The release records source commit
`1ea16d1e14c4d133b0cfc32fad30f506bef88bf3`, which was not publicly resolvable
when integrated. Compatibility is checked numerically, not asserted from that
unavailable commit. Strict state loading plus the reference fixture catches
architecture changes; update the vendored runtime when a new architecture is
introduced. Publish the source commit too for full provenance.

CPU output tolerance is rtol=1e-5, atol=1e-5 to allow float32 differences across
ARM/x86 and PyTorch versions. The release's stricter declared tolerance was
not met on the local ARM/PyTorch-2.15 test: maximum absolute difference was
1.91e-6. This difference and the actual runtime version are recorded in JSON.
Rebuilt inputs use rtol=1e-5, atol=1e-4 to allow storage/arithmetic rounding.
These are numerical compatibility checks, not forecast-accuracy validation.

## Forecast outputs and tail risk

Inference takes only the latest complete input window; it does not require
future labels and never invokes training/testing loggers. It exports median,
1%/99% quantiles and signed lower/upper ES for each of 24 hours, plus terminal
1% and 0.5% nonnegative quote-loss VaR/ES for USDC and USDT. The quote convention
is USDT per USDC. USDC loss is max(−depeg_bps,0); USDT loss is max(depeg_bps,0).
Token at risk follows the larger terminal 1% VaR. Loss ES handles cases where
VaR is zero but rare adverse outcomes remain possible.

ES is calculated analytically from the learned GPD tails, including probability
mass beyond the numerical integration grid. Shapes >=1 imply infinite ES and
are rejected; finite numbers are not substituted. These are hourly marginal
forecasts, not a joint path distribution or the probability of any breach over
24 hours. The RF's calibrated monitoring probability retains that separate
meaning.

The workflow first writes `dashboard_data/angel_forecast.json`, then the RF script
requires the same observation timestamp before including it in
`dashboard_data/rf_results.json`. Existing published data is preserved if any
step fails. Standalone forecasts can be generated with:

```bash
pip install -r requirements-monitor.txt
pip install 'torch>=2.6,<3' --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-angel.txt
bash update_data.sh
python angel_forecast.py --output dashboard_data/angel_forecast.json
# Optional deterministic replay/rollback:
python angel_forecast.py --tag amm-angel-20261103T093459Z
```

Run from the repository root. The sentiment source is public Alternative.me;
network requests have an explicit timeout. The workflow's existing downloaded
on-chain data is used for the other features. Large model/raw assets are not
committed to the blog repository.

## Integration validation

The released checkpoint and all 98 features of its 168-hour reference window
were validated on CPU against cached public on-chain data through 2 November
2026 08:00 UTC. Local testing reused historical sentiment observations after
normalizing their daily sampling to UTC; the current public sentiment request
was not used for this cached-data replay. The production fetch explicitly
samples UTC and has a timeout. Feature construction and inference took about
25 seconds locally after reducing position parquet reads to required columns.

The deployed ES calculations have numerical integration regression tests.
No raw data or checkpoint weights are committed to this repository.

## Alpha and inference-time variable selection

`model_config.py` fixes the dashboard feature-basis alpha at 0.1. Bundle manifests,
checkpoint hyperparameters, RF parquet metadata (when present), and all RF
Gegenbauer columns are checked. New RF datasets persist `gegenbauer_alpha` in
parquet metadata. RF and ANGEL JSON expose their alpha, and Models displays it.
The RF retains its train-only fitted transform; ANGEL retains its released frozen
transform. A matching alpha does not imply identical fitted centering or grids.

Every ANGEL forward pass already returns `interpretability.selection_weights`
with shape `[1, number_of_covariates]`. The inference exporter maps these to the
manifest's ordered covariates, validates nonnegative finite weights, a sum of one
(within float32 tolerance), and agreement with the selection mask. All weights,
including zeros, ranks, selected flags, forecast origin and input-window start
are saved as `variable_selection` in `angel_forecast.json` and embedded in
`rf_results.json`. No training or extra forward pass is required.

Explanations → Forecasting model → Current inference displays this current-window ranking with
percentage bars. The selector emits one gate per covariate for the full input
window, shared across horizons. These are not signed SHAP values, causal effects,
or test-set global importance. The target price history is encoded by a separate
branch and has no weight in this covariate ranking. Older snapshots without the
new payload show a pending message until the next inference run; weights from a
different origin are never displayed as current.

## Explanations, distribution explorer and daily replay

The Explanations tab separates the early-warning RF's SHAP/ALE views from
ANGEL covariate selection. ANGEL offers current weights and global statistics.
The default global reference is a **seven-day retrospective replay**, evaluated
at one origin every 24 hours plus the latest origin (eight windows total).
Rank is descending mean selector weight including zeros; selection frequency
is the fraction of replay windows with weight >1e-8; average weight when
selected excludes zero/unselected windows. Never-selected variables show no
conditional average. These gates exclude the separate target-price branch.

`angel_forecast.py` now runs this replay after current inference without fitting
any model or preprocessing. Each origin uses its own complete trailing window.
Real, unfilled pool prices provide outcomes; unavailable future observations
are excluded, with sample counts exported per horizon. The `replay` payload
records checkpoint hash, alpha, origin timestamps, stride, selection statistics,
and all matched forecast/observation pairs. The main page's **Show backtest**
button filters by origin and forecast hour, showing observed prices, median,
1–99% intervals, median MAE, empirical interval coverage and tail exceedances.
Replay is explicitly distinguished from held-out evaluation: a current frozen
checkpoint may have been fitted using data after an earlier replay origin.

The ANGEL card in Models opens a keyboard-accessible architecture dialog.
The separate Probability distribution tab contains Shape and Score sub-tabs. `distribution_explorer` exports the actual sampled
I-/M-spline bases, integration weights, normalization mode, splice probabilities,
shape bounds and all 24 formatted output vectors. Browser controls reconstruct
the same monotone quantile function and slope-matched GPD tails as the CPU
runtime. Density uses f(Q(u))=1/Q′(u); the plot displays the central 99.8% of
probability mass. The 1%, 50% and 99% readouts use the full analytic tails.
Controls change only the local scenario; reset restores the selected hour's
model output. Older snapshots use an explicitly labelled illustrative vector
with the released spline basis until actual parameters are available.

An optional independently held-out NPZ can replace the global replay reference.
Pass `--test-diagnostics PATH`, or add `test_diagnostics_asset` and
`test_diagnostics_sha256` to the release manifest. The NPZ must contain numeric
`selection_weights [N,V]`, `observed_bps [N,24]`, and `quantiles_bps [N,24,3]`
(at levels 0.01, 0.5, 0.99), Unicode `covariate_names` and
`origin_timestamps [N]`, plus scalar `checkpoint_sha256`, `alpha` and
`fit_end_utc`. Pickles are not loaded. Identity, feature order, chronology,
weights, finite observations and quantile ordering are validated before export.
Global aggregation uses every window. The RF exporter also supplies its full
held-out probability/outcome timeline on subsequent monitoring runs.

The November 5 refresh uses release `data-2026-11-05`, a complete ANGEL input
window ending **2026-11-05 01:00 UTC**, daily origins from October 29 through
November 5, and observed pool prices through **2026-11-05 02:00 UTC**. There
are 169 matched hourly outcomes. The prior RF snapshot remains dated November 4;
the header labels that timestamp as the RF snapshot, and the price quote has
its own timestamp. Scheduled full updates continue aligning both models.

Validation: `pytest tests/test_angel_explanations.py tests/test_angel_forecast.py
 tests/test_training_protocol.py`; `node tests/test_angel_explainer.cjs` compares
the browser distribution to all 24 published CPU-runtime forecasts and checks
monotonicity, location/scale effects and independence of the two tail controls.

Architecture detail panels now use illustrative visual walkthroughs in
`angel-architecture-visuals.js`: adjustable dilated causal connections, whole-
sequence linear projection into a variate token, a temperature-controlled
softmax/sparsemax comparison, and a selectable query-by-covariate attention
matrix. Sparsemax is computed from the example scores; selector masks and
attention zeros have separate visual treatments. These examples are labelled
illustrative and are not presented as checkpoint attention diagnostics. Input
branching, RevIN, the hourly output head, and the spliced distribution also have
visual explanations. No equations are shown in the architecture detail panels.

## Probability distribution workspace

Probability distribution is a dedicated, viewport-sized dashboard tab with
keyboard-accessible **Shape** and **Score** sub-tabs. Models retains only the
RF and ANGEL cards; clicking the ANGEL card opens the architecture dialog.
The release link remains independently clickable. On narrow screens the
architecture dialog uses a stage selector in place of the full flow diagram.
Every diagram and control fits the dialog without scrolling.

Shape retains the selected forecast hour, the model output vector, density
plot, and quantile readouts. Its parameter-group selector switches between
location/scale, spline coefficients, and GPD shapes so all controls fit without
an internal scrollbar. Edits remain linked to Score across sub-tab changes.

Score displays just the CDF/realization plot, local contribution plot, two
score cards, and two independent sliders. The realization slider moves the
outcome continuously in bps; the local-contribution slider moves the inspected
CDF gap. Latest observed restores the latest actual hourly observation.
After moving the realization slider, the outcome is labelled hypothetical.
There are no sequence playback, accumulation, or running-mean sections.
Clicking the CRPS or twCRPS card (or using the weighting checkbox) selects the
active contribution plot. On mobile a CDF/Local error switch shows one readable
plot at a time, while both score cards and both sliders remain visible.

The twCRPS explorer uses exactly
`sigmoid((-10-z)/1) + sigmoid((z-10)/1)`: thresholds ±10 bps and h=1 bp.
Weights are not normalized. These settings do not alter the checkpoint or its
training-loss configuration. Both scores describe the fixed distribution from
Shape, evaluated at the selected realization, and are separate from the
historical forecast backtest.

`prediction-scorer.js` integrates squared CDF errors in deviation space.
Eight-point Gauss–Legendre quadrature is applied between spline knots,
realizations, and additional tail / sigmoid grid points. Analytical integrals
of the squared lower CDF and upper survival function include the GPD mass
outside the numerical bounds. Those bounds extend at least to ±50 bps, where
the sigmoid weights equal one to double precision. Full scores are independent
of the finite plot bounds and are expressed in bps.

Validation: `node tests/test_prediction_scorer.cjs` checks analytical uniform
CRPS cases, independent SciPy-quadrature references for asymmetric GPD tails,
the two-sigmoid weighting, and score invariance to plot bounds.
`node tests/test_angel_explainer.cjs` checks the distribution controls and CDF
inversion across all 24 published forecast hours. Browser QA checks tab/card
navigation, the independent sliders, and viewport/content dimensions on desktop
and mobile, including shorter 600px / 667px windows.
