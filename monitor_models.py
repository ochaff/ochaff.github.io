"""Monitoring labels, feature distributions and Student-t tail forecasts.

Production training uses monitoring_labels and monitoring_bounds. Legacy onset
and NP helpers remain for reproducibility of earlier research; the dashboard
and current training workflow do not use that alert policy.
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


def monitoring_labels(prices, *, end=None):
    """Any ±15bps breach in the next 24 hours, including ongoing dislocations.

    Monitoring uses neither event-onset declustering nor a minimum lead time.
    Full future coverage is required only for retrospective supervised labels.
    """
    p = hourly_prices(prices)
    if end is not None:
        p = p.loc[:end]
    future = pd.concat([p.shift(-h) for h in range(1, HORIZON + 1)], axis=1)
    return pd.DataFrame({'target': future.abs().ge(THRESHOLD_BPS).any(axis=1).astype(int),
                         'eligible': p.notna() & future.notna().all(axis=1)}, index=p.index)


def monitoring_bounds(prices):
    p = hourly_prices(prices)
    if len(p) < 1000:
        raise ValueError('At least 1,000 hourly observations are required')
    cal, test = p.index[int(len(p) * .70)], p.index[int(len(p) * .85)]
    return {'train': (p.index[0], cal - HOUR),
            'calibration': (cal, test - HOUR), 'test': (test, p.index[-1])}


def monitoring_level(probability):
    for upper, label in [(0.10, 'Low'), (0.20, 'Elevated'), (0.50, 'High')]:
        if probability < upper:
            return label
    return 'Critical'


def feature_group(name):
    if name.startswith(('Gegenbauer_', 'E_')) or name in {
            'low_ratio', 'mid_ratio', 'high_ratio', 'odd_ratio', 'even_ratio',
            'odd_to_even_ratio', 'tangent_up', 'tangent_down', 'swap_size_imbalance'}:
        return 'curve_shape'
    if name.startswith(('w_', 'curve_', 'gauge_')) or name in {'totalValueLockedUSD', 'hourlyVolumeUSD'}:
        return 'curve_pool'
    if name.startswith(('eth_', 'btc_', 'usd_', 'fx_', 'fear_', 'utilisation_', 'supplied_', 'liquidation_')) or name == 'depeg_bps':
        return 'market'
    return 'uniswap_pool'


def feature_catalog(features, local_shap, global_shap):
    """Full-history feature histograms; current observation is excluded.

    Histogram edges span the 0.5th--99.5th percentiles. Outside observations
    are grouped into the end bins; the empirical percentile uses all values.
    This keeps heavy-tailed features readable without fabricating distributions.
    """
    latest = features.index[-1]
    reference = features.loc[features.index < latest]
    records = []
    for name in features:
        numeric = pd.to_numeric(reference[name], errors='coerce')
        observed = numeric.loc[np.isfinite(numeric)]
        values = observed.to_numpy(dtype=float)
        current = features[name].iloc[-1]
        current = float(current) if pd.notna(current) and np.isfinite(current) else None
        histogram = None
        if len(values):
            low, high = np.quantile(values, [.005, .995])
            if low == high:
                margin = max(abs(low) * .02, .001)
                low, high = low - margin, high + margin
            counts, edges = np.histogram(np.clip(values, low, high), bins=28, range=(low, high))
            histogram = {'edges': edges.tolist(), 'counts': counts.tolist(),
                         'reference_count': len(values), 'reference_scope': 'full_history',
                         'reference_start': str(observed.index[0]),
                         'reference_end': str(observed.index[-1]),
                         'percentile': float((values <= current).mean() * 100) if current is not None else None,
                         'lower_tail_count': int((values < low).sum()),
                         'upper_tail_count': int((values > high).sum()),
                         'tail_display': 'outside_0.5_99.5_percentiles_grouped_into_edge_bins'}
        records.append({'feature': name, 'value': current, 'group': feature_group(name),
                        'local_shap': local_shap.get(name),
                        'global_impact': global_shap.get(name), 'histogram': histogram})
    return records


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


def hourly_forecast_summary(paths, origin, means):
    """Signed distribution summaries for plotting, without loss clipping."""
    paths = np.asarray(paths, dtype=float)
    ordered = np.sort(paths, axis=0)
    count = len(ordered) * .01
    whole, fraction = int(count), count - int(count)
    lower_es = (ordered[:whole].sum(axis=0) + fraction * ordered[whole]) / count
    upper_es = (ordered[-whole:].sum(axis=0) + fraction * ordered[-whole - 1]) / count
    return [{'hour': h + 1, 'timestamp': str(origin + (h + 1) * HOUR),
             'mean_bps': float(means[h]),
             'median_bps': float(np.median(paths[:, h])),
             'lower_1pct_bps': float(np.quantile(paths[:, h], .01)),
             'upper_1pct_bps': float(np.quantile(paths[:, h], .99)),
             'lower_es_1pct_bps': float(lower_es[h]),
             'upper_es_1pct_bps': float(upper_es[h])}
            for h in range(paths.shape[1])]


def student_t_marginal(mean, variance, nu, alpha=.01):
    """QuantLet marginal approximation, including exact clipped-loss tail means.

    The multi-step predictive mixture need not itself be Student-t. These are
    Student-t marginals scaled by the analytical expected conditional variance,
    as in QuantLet's probabilistic-forecast benchmark, not simulated path tails.
    """
    from scipy.stats import t
    if not (np.isfinite([mean, variance, nu, alpha]).all()
            and variance >= 0 and nu > 2 and 0 < alpha < .5):
        raise ValueError('Invalid Student-t marginal parameters')
    scale = math.sqrt(variance * (nu - 2) / nu)
    q = t.ppf(alpha, nu)
    lower, upper = mean + scale * q, mean - scale * q
    def first_tail_moment(z):
        return (nu + z * z) / (nu - 1) * t.pdf(z, nu)
    tail = scale * first_tail_moment(q) / alpha
    if scale:
        # Integrate only positive losses. Merely clipping the signed tail mean
        # gives incorrect ES when a token's VaR is zero but rare losses exist.
        zl = (min(lower, 0) - mean) / scale
        zu = (max(upper, 0) - mean) / scale
        es_usdc = max(0., (-mean * t.cdf(zl, nu) + scale * first_tail_moment(zl)) / alpha)
        es_usdt = max(0., (mean * t.sf(zu, nu) + scale * first_tail_moment(zu)) / alpha)
    else:
        es_usdc, es_usdt = max(-mean, 0), max(mean, 0)
    return {'lower_bps': float(lower), 'upper_bps': float(upper),
            'lower_es_bps': float(mean - tail), 'upper_es_bps': float(mean + tail),
            'USDC': {'var_bps': float(max(-lower, 0)), 'es_bps': float(es_usdc)},
            'USDT': {'var_bps': float(max(upper, 0)), 'es_bps': float(es_usdt)}}


def garch_forecast(prices):
    """Constant-mean GARCH(1,1)-t, aligned with QuantLet benchmark 12.

    Fit once at the live origin on expanding history, in signed depeg bps.
    Internal historical gaps are causally forward-filled (reference dataset
    convention); an unobserved latest hour is an error, never a fresh forecast.
    """
    from arch import arch_model
    p = hourly_prices(prices)
    if p.empty or pd.isna(p.iloc[-1]):
        raise ValueError('GARCH requires an observed price at the forecast origin')
    p = p.loc[p.first_valid_index():].astype('float64')
    imputed_hours = int(p.isna().sum())
    p = p.ffill().rename('depeg')
    if len(p) < 720 or float(p.std()) < 1e-8:
        raise ValueError('GARCH requires 720 nonconstant hourly prices')
    model = arch_model(p, mean='Constant', vol='GARCH', p=1, q=1,
                       dist='StudentsT', rescale=False)
    fit = model.fit(disp='off', options={'maxiter': 2000})
    if fit.convergence_flag != 0 or not np.isfinite(fit.params).all():
        raise RuntimeError(f'GARCH optimizer did not converge: {fit.optimization_result.message}')
    nu = max(float(fit.params['nu']), 2.05)  # same lower guard as reference
    forecast = fit.forecast(horizon=HORIZON, method='analytic', reindex=False)
    means = forecast.mean.iloc[-1].to_numpy()
    variances = np.maximum(forecast.variance.iloc[-1].to_numpy(), 1e-12)
    if not np.isfinite(means).all() or not np.isfinite(variances).all():
        raise RuntimeError('GARCH produced nonfinite analytical forecasts')
    hourly = []
    for h, (mean, variance) in enumerate(zip(means, variances), 1):
        marginal = student_t_marginal(mean, variance, nu)
        hourly.append({'hour': h, 'timestamp': str(p.index[-1] + h * HOUR),
                       'mean_bps': float(mean), 'median_bps': float(mean),
                       'variance_bps2': float(variance), 'sigma_bps': float(np.sqrt(variance)),
                       'lower_1pct_bps': marginal['lower_bps'], 'upper_1pct_bps': marginal['upper_bps'],
                       'lower_es_1pct_bps': marginal['lower_es_bps'],
                       'upper_es_1pct_bps': marginal['upper_es_bps']})
    tails = {token: {} for token in ('USDC', 'USDT')}
    for alpha in (.01, .005):
        marginal = student_t_marginal(means[-1], variances[-1], nu, alpha)
        for token in tails:
            tails[token][str(alpha)] = marginal[token]
    usdc, usdt = (tails[token]['0.01']['var_bps'] for token in tails)
    direction = 'Balanced' if usdc == usdt else ('USDC' if usdc > usdt else 'USDT')
    persistence = float(fit.params['alpha[1]'] + fit.params['beta[1]'])
    return {'status': 'ok', 'model': 'Constant-mean GARCH(1,1)', 'innovations': 'Student-t',
            'timestamp': str(p.index[-1]), 'horizon_hours': HORIZON,
            'risk_direction': direction, 'direction_rule': 'larger_1pct_var',
            'quote': 'USDT per USDC', 'risk_basis': 'adverse_deviation_from_peg_at_hour_24',
            'unit': 'quote_deviation_bps', 'tails': tails, 'hourly': hourly,
            'fit_rows': len(p), 'fit_start': str(p.index[0]),
            'fit_end': str(p.index[-1]), 'historical_imputed_hours': imputed_hours,
            'missing_price_policy': 'historical_forward_fill_reject_missing_origin',
            'mean_type': 'Constant', 'fit_window': 'expanding', 'rescale': False,
            'forecast_method': 'analytic_variance_standardized_student_t_marginals',
            'forecast_caveat': 'Multi-step Student-t marginals approximate the predictive variance mixture.',
            'refit_policy': 'once_per_live_workflow_run', 'persistence': persistence,
            'persistence_status': 'near_integrated' if persistence >= .999 else 'mean_reverting_variance',
            'quantile_degrees_of_freedom': nu,
            'reference': {'commit': '303c6399357a00e11897aa30e598bc6f23b6fb45',
                          'url': 'https://github.com/QuantLet/onchain-insights/blob/303c6399357a00e11897aa30e598bc6f23b6fb45/12.%20Evaluation%20of%20Probabilistic%20Forecasts/benchmark_scripts/GARCH_forecast.py'},
            'parameters': {k: float(v) for k, v in fit.params.items()}}
