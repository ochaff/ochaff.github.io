"""Event-onset labels, validation-only NP policy and Student-t tail forecasts.

Reference: QuantLet/onchain-insights, Quantlet 8 (cv_results_report.py and
threshold_selection.py). The NP bound is nominal: hourly scores are dependent,
so the iid calibration assumption is not established by this implementation.
"""
from __future__ import annotations

import math
import numpy as np
import pandas as pd
from scipy.stats import binom

HORIZON = 24
MIN_LEAD = 2
RESET = 24
THRESHOLD_BPS = 15
NP_FPR = 0.08
NP_DELTA = 0.05
MIN_VALIDATION_EVENTS = 5
HOUR = pd.Timedelta(hours=1)


def hourly_prices(series):
    """Keep missing hours explicit; never invent realized prices by filling."""
    series = series.copy()
    series.index = pd.DatetimeIndex(pd.to_datetime(series.index, utc=True))
    series = series.sort_index().astype(float).replace([np.inf, -np.inf], np.nan)
    if series.index.has_duplicates or series.index.hasnans or series.empty:
        raise ValueError("Prices need unique, nonempty UTC hourly timestamps")
    if (series.index != series.index.floor('h')).any():
        raise ValueError("Prices must lie on the hourly grid")
    return series.reindex(pd.date_range(series.index[0], series.index[-1], freq='h'))


def event_onsets(prices, threshold=THRESHOLD_BPS, reset=RESET):
    """An onset needs 24 consecutive observed, threshold-free preceding hours.

    Unknown prices break the quiet history, preventing gaps and left-boundary
    breaches from being counted as new, fully observed events.
    """
    quiet, events = 0, []
    for time, value in prices.items():
        if not np.isfinite(value):
            quiet = 0
        elif abs(value) >= threshold:
            if quiet >= reset:
                events.append(time)
            quiet = 0
        else:
            quiet += 1
    return pd.DatetimeIndex(events, tz='UTC')


def onset_labels(prices, *, end=None):
    """2--24h onset labels with complete past/future and current-breach censoring."""
    prices = hourly_prices(prices)
    if end is not None:
        prices = prices.loc[:end]
    known = prices.notna()
    history = known.shift(1, fill_value=False).rolling(HORIZON).sum().eq(HORIZON)
    future = pd.concat([known.shift(-h, fill_value=False)
                        for h in range(1, HORIZON + 1)], axis=1).all(axis=1)
    onsets = event_onsets(prices)
    y = pd.Series(0, index=prices.index, dtype=int)
    late = pd.Series(False, index=prices.index)
    for event in onsets:
        y.loc[event - HORIZON * HOUR:event - MIN_LEAD * HOUR] = 1
        late.loc[event - (MIN_LEAD - 1) * HOUR:event - HOUR] = True
    breached = prices.abs().ge(THRESHOLD_BPS)
    eligible = known & history & future & ~breached & ~late
    reasons = pd.Series('', index=prices.index, dtype=object)
    reasons.loc[~future] = 'incomplete_future'
    reasons.loc[~history] = 'incomplete_history'
    reasons.loc[late] = 'inside_minimum_lead'
    reasons.loc[breached] = 'already_depegged'
    reasons.loc[~known] = 'missing_price'
    return pd.DataFrame({'target': y, 'eligible': eligible, 'censor_reason': reasons}), onsets


def complete_events(prices, start, end):
    """Events with their entire 24h warning history inside this partition."""
    p = hourly_prices(prices).loc[:end]
    events = event_onsets(p)
    return events[(events >= start + HORIZON * HOUR) & (events <= end)]


def partition_bounds(prices):
    """Reserve the latest 15% as test; expand validation backward to five events.

    Calibration is a separate chronological tail of the preceding history.
    Labels are subsequently rebuilt with each partition's end as context cap,
    removing all rows whose 24h outcome would cross the next boundary.
    """
    p = hourly_prices(prices)
    n = len(p)
    if n < 1000:
        raise ValueError('At least 1,000 hourly observations are required')
    test_start = p.index[int(n * .85)]
    val_end = test_start - HOUR
    candidates = complete_events(p, p.index[0], val_end)
    if len(candidates) < MIN_VALIDATION_EVENTS:
        raise ValueError('Validation requires at least five complete depeg events')
    val_start = min(p.index[int(n * .70)], candidates[-MIN_VALIDATION_EVENTS] - HORIZON * HOUR)
    prefix = p.index[p.index < val_start]
    if len(prefix) < 500:
        raise ValueError('Five validation events leave insufficient fit/calibration history')
    cal_start = prefix[int(len(prefix) * .80)]
    return {'train': (p.index[0], cal_start - HOUR),
            'calibration': (cal_start, val_start - HOUR),
            'validation': (val_start, val_end),
            'test': (test_start, p.index[-1])}


def np_policy(y, probability, *, event_count):
    """Strict NP order-statistic cutoff, chosen only on held-out negatives."""
    y, p = np.asarray(y), np.asarray(probability, dtype=float)
    if len(y) != len(p) or not np.isfinite(p).all():
        raise ValueError('One finite validation score per outcome is required')
    if event_count < MIN_VALIDATION_EVENTS:
        raise ValueError('NP validation requires at least five complete depeg events')
    negatives = np.sort(p[y == 0])
    n = len(negatives)
    required = math.ceil(math.log(NP_DELTA) / math.log1p(-NP_FPR))
    rank = None
    if n >= required:
        lo, hi = 1, n
        while lo < hi:
            mid = (lo + hi) // 2
            if binom.sf(mid - 1, n, 1 - NP_FPR) <= NP_DELTA:
                hi = mid
            else:
                lo = mid + 1
        rank = lo
    # nextafter implements score > order statistic despite an alert >= cutoff.
    cutoff = float(np.nextafter(negatives[rank - 1], np.inf)) if rank else None
    alert = p >= cutoff if cutoff is not None else np.zeros(len(p), dtype=bool)
    return {'method': 'neyman_pearson', 'target_fpr': NP_FPR, 'delta': NP_DELTA,
            'threshold': cutoff, 'order_rank': rank, 'negative_rows': n,
            'required_negative_rows': required, 'validation_events': int(event_count),
            'validation_rows': len(y), 'validation_fpr': float(alert[y == 0].mean()) if n else None,
            'validation_tpr': float(alert[y == 1].mean()) if (y == 1).any() else None,
            'nominal_violation_bound': float(binom.sf(rank - 1, n, 1 - NP_FPR)) if rank else None,
            'status': 'selected' if rank else 'insufficient_negatives_no_alert_rule',
            'guarantee_scope': 'nominal_iid_independent_calibration_assumptions_unverified'}


def tail_risk(paths):
    """Adverse deviation from peg at each hour; USDT per USDC quote convention.

    Lower quote = USDC weakens. Upper quote = USDT weakens. Both sides use
    quote-deviation bps (not USD portfolio P&L); ES averages exactly the worst
    alpha fraction, including fractional order-statistic weights if needed.
    """
    paths = np.asarray(paths, dtype=float)
    if paths.ndim != 2 or not np.isfinite(paths).all() or len(paths) < 200:
        raise ValueError('At least 200 finite forecast paths are required')
    results = {}
    for token, losses in [('USDC', np.maximum(-paths, 0)), ('USDT', np.maximum(paths, 0))]:
        terminal = np.sort(losses[:, -1])[::-1]
        levels = {}
        for alpha in (.01, .005):
            count = len(terminal) * alpha
            whole = int(count)
            frac = count - whole
            es = (terminal[:whole].sum() + (frac * terminal[whole] if frac else 0)) / count
            levels[str(alpha)] = {'var_bps': float(np.quantile(losses[:, -1], 1 - alpha)),
                                  'es_bps': float(es)}
        results[token] = levels
    usdc = results['USDC']['0.01']['var_bps']
    usdt = results['USDT']['0.01']['var_bps']
    direction = 'Balanced' if usdc == usdt else ('USDC' if usdc > usdt else 'USDT')
    return results, direction


def garch_forecast(prices, *, simulations=100_000, seed=42, lookback=24 * 365):
    """Fit AR(1)-GARCH(1,1)-t to signed depeg levels, simulate the next 24h."""
    from arch import arch_model
    p = hourly_prices(prices)
    # Use only the latest contiguous observed block: dropping missing hours
    # would silently treat multi-hour gaps as one-hour transitions.
    missing = np.flatnonzero(p.isna().to_numpy())
    if len(missing):
        p = p.iloc[missing[-1] + 1:]
    p = p.iloc[-lookback:].rename('depeg')
    if len(p) < 720 or float(p.std()) < 1e-8:
        raise ValueError('GARCH requires 720 nonconstant, contiguous hourly prices')
    if simulations < 20_000:
        raise ValueError('Use at least 20,000 paths for the 0.5% tail')
    model = arch_model(p, mean='AR', lags=1, vol='GARCH', p=1, q=1,
                       dist='StudentsT', rescale=False)
    fit = model.fit(disp='off', options={'maxiter': 2000})
    if fit.convergence_flag != 0 or not np.isfinite(fit.params).all():
        raise RuntimeError(f'GARCH optimizer did not converge: {fit.optimization_result.message}')
    phi = float(fit.params['depeg[1]'])
    if abs(phi) >= 1:
        raise RuntimeError('GARCH autoregressive mean is not stationary')
    nu = float(fit.params['nu'])
    rng = np.random.default_rng(seed)
    def innovations(size):
        # arch expects unit-variance innovations, not raw Student-t draws.
        return rng.standard_t(nu, size=size) * np.sqrt((nu - 2) / nu)
    forecast = fit.forecast(horizon=HORIZON, method='simulation', simulations=simulations,
                            rng=innovations, reindex=False)
    paths = forecast.simulations.values[-1]
    tails, direction = tail_risk(paths)
    hourly = []
    for h in range(HORIZON):
        hourly.append({'hour': h + 1, 'timestamp': str(p.index[-1] + (h + 1) * HOUR),
                       'mean_bps': float(forecast.mean.iloc[-1, h]),
                       'lower_1pct_bps': float(np.quantile(paths[:, h], .01)),
                       'upper_1pct_bps': float(np.quantile(paths[:, h], .99))})
    return {'status': 'ok', 'model': 'AR(1)-GARCH(1,1)', 'innovations': 'Student-t',
            'timestamp': str(p.index[-1]), 'horizon_hours': HORIZON,
            'risk_direction': direction, 'direction_rule': 'larger_1pct_var',
            'quote': 'USDT per USDC', 'risk_basis': 'adverse_deviation_from_peg_at_hour_24',
            'unit': 'quote_deviation_bps', 'tails': tails, 'hourly': hourly,
            'fit_rows': len(p), 'fit_start': str(p.index[0]), 'simulations': simulations,
            'random_seed': seed, 'parameters': {k: float(v) for k, v in fit.params.items()}}
