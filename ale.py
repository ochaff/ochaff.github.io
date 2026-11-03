"""First-order ALE with pointwise, fixed-model moving-block bootstrap bands.

Uses observed-neighbourhood endpoint differences (Apley & Zhu, 2020), then
integrates and empirically centers the piecewise-linear curve. Bootstrap
resamples chronological rows in circular blocks; neither the forest nor its
calibrator is refitted. Edges stay fixed across resamples for comparable x's.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _centered_curve(differences, counts, fraction_sums):
    nodes = np.r_[0., np.cumsum(differences)]
    center = np.sum(nodes[:-1] * counts + differences * fraction_sums) / counts.sum()
    return nodes - center


def _block_indices(n, replicates, block_length, seed):
    rng = np.random.default_rng(seed)
    offsets = np.arange(block_length)
    blocks = int(np.ceil(n / block_length))
    # At today's history size this is ~51 MB. Endpoint predictions are reused
    # for every bootstrap: there are only two model evaluations per feature.
    draws = np.empty((replicates, n), dtype=np.int32)
    for i in range(replicates):
        starts = rng.integers(0, n, size=blocks)
        draws[i] = ((starts[:, None] + offsets) % n).ravel()[:n]
    return draws


def accumulated_local_effects(model, features, *, bins=30, bootstrap_replicates=300,
                              block_hours=168, seed=42, timestamp=None, progress=None):
    """Export every predictor's centered ALE of class-1 probability.

    `features` must be the full, ordered hourly reference matrix, excluding
    the current observation. All preprocessing must match model inference.
    Bands are approximate pointwise 95% percentile intervals conditional on
    the fixed fitted model, not simultaneous or model-refitting intervals.
    """
    if bins < 2 or bootstrap_replicates < 100 or block_hours < 1:
        raise ValueError('ALE requires >=2 bins, >=100 bootstrap replicates and positive block hours')
    if len(features) < 4 or not np.isfinite(features.to_numpy(dtype=float)).all():
        raise ValueError('ALE requires at least four complete finite reference rows')
    index = pd.DatetimeIndex(features.index)
    if not index.is_monotonic_increasing or index.has_duplicates or not np.all(
            np.diff(index.asi8) == pd.Timedelta(hours=1).value):
        raise ValueError('Block-bootstrap ALE reference must have a unique, consecutive hourly index')
    classes = list(model.classes_)
    if 1 not in classes:
        raise ValueError('ALE requires the positive class 1')
    positive = classes.index(1)
    n = len(features)
    length = min(block_hours, n // 2)
    draws = _block_indices(n, bootstrap_replicates, length, seed)
    results = {}
    for position, name in enumerate(features, 1):
        if progress:
            progress(f'ALE {position}/{len(features.columns)}: {name}')
        values = features[name].to_numpy(dtype=float)
        # Order-statistic quantiles keep edges on observed values; interpolated
        # quantiles can create empty intervals for low-cardinality predictors.
        edges = np.unique(np.quantile(values, np.linspace(0, 1, bins + 1), method='inverted_cdf'))
        if len(edges) == 1:
            results[name] = {'status': 'constant', 'requested_bins': bins, 'effective_bins': 0,
                             'x': edges.tolist(), 'effect': [0.], 'ci_lower': [0.], 'ci_upper': [0.],
                             'ci_status': 'constant_on_observed_support',
                             'bootstrap_valid_replicates': bootstrap_replicates,
                             'bin_edges': edges.tolist(), 'bin_counts': [n], 'local_effect': [],
                             'distribution': {'edges': [float(edges[0] - .5), float(edges[0] + .5)],
                                              'counts': [n]}}
            continue
        k = len(edges) - 1
        ids = np.searchsorted(edges, values, side='left') - 1
        ids = np.clip(ids, 0, k - 1)
        counts = np.bincount(ids, minlength=k)
        if (counts == 0).any():
            raise RuntimeError(f'Empty quantile ALE bin for {name}')
        fraction = (values - edges[ids]) / (edges[ids + 1] - edges[ids])
        lower, upper = features.copy(), features.copy()
        lower[name], upper[name] = edges[ids], edges[ids + 1]
        delta = (model.predict_proba(upper)[:, positive] - model.predict_proba(lower)[:, positive])
        if not np.isfinite(delta).all():
            raise RuntimeError(f'Nonfinite endpoint predictions for {name}')
        local = np.bincount(ids, weights=delta, minlength=k) / counts
        curve = _centered_curve(local, counts, np.bincount(ids, weights=fraction, minlength=k))
        boot = []
        for sampled in draws:
            b_ids = ids[sampled]
            b_counts = np.bincount(b_ids, minlength=k)
            # Do not fabricate effects for an unobserved bootstrap bin.
            if (b_counts == 0).any():
                continue
            b_local = np.bincount(b_ids, weights=delta[sampled], minlength=k) / b_counts
            boot.append(_centered_curve(b_local, b_counts,
                        np.bincount(b_ids, weights=fraction[sampled], minlength=k)))
        supported = len(boot) >= max(100, int(np.ceil(.8 * bootstrap_replicates)))
        low, high = np.quantile(boot, [.025, .975], axis=0) if supported else (
            [None] * len(edges), [None] * len(edges))
        distribution_counts, distribution_edges = np.histogram(values, bins=bins)
        results[name] = {'status': 'ok', 'requested_bins': bins, 'effective_bins': k,
                         'x': edges.tolist(), 'effect': curve.tolist(),
                         'ci_lower': list(low), 'ci_upper': list(high),
                         'ci_status': 'ok' if supported else 'insufficient_bootstrap_support',
                         'bootstrap_valid_replicates': len(boot),
                         'bin_edges': edges.tolist(), 'bin_counts': counts.tolist(),
                         'local_effect': local.tolist(),
                         'distribution': {'edges': distribution_edges.tolist(),
                                          'counts': distribution_counts.tolist()}}
    return {'schema_version': 1, 'timestamp': str(timestamp or index[-1]),
            'method': 'first_order_accumulated_local_effects',
            'response': 'calibrated_probability_of_any_15bps_breach_in_next_24h',
            'effect_unit': 'probability', 'centering': 'empirical_mean_of_piecewise_linear_ALE_is_zero',
            'requested_bins': bins, 'binning': 'quantile_edges_duplicates_merged',
            'reference_scope': 'full_history_excluding_current', 'reference_rows': n,
            'reference_start': str(index[0]), 'reference_end': str(index[-1]),
            'confidence': {'level': .95, 'coverage': 'pointwise_approximate',
                           'method': 'circular_moving_block_percentile_bootstrap',
                           'block_hours': length, 'replicates': bootstrap_replicates, 'seed': seed,
                           'model_refitted': False, 'grid_refitted': False,
                           'scope': 'reference_history_uncertainty_conditional_on_fixed_fitted_model',
                           'assumptions': 'Block length and approximate time stability are not coverage guarantees.'},
            'features': results}
