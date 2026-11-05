"""Small, JSON-safe ANGEL distribution and held-out diagnostics exports."""
from __future__ import annotations
import numpy as np
import pandas as pd


def distribution_payload(head, raw):
    """Export the actual sampled spline basis and formatted head vector (not logits)."""
    body = head.body
    if not all(hasattr(body, key) for key in ('I', 'M', 'u', 'wu')):
        return {'status': 'unavailable', 'reason': 'This head is not an I-spline'}
    array = lambda value: value.detach().cpu().numpy().astype(float).tolist()
    return {'status': 'ok', 'u': array(body.u), 'I': array(body.I), 'M': array(body.M),
            'integration_weights': array(body.wu), 'normalization': body.revin_type,
            'degree': body.degree, 'knots': array(body.knots), 'epsilon': body.eps,
            'u_low': head.u_low, 'u_high': head.u_high,
            'xi_min': head.xi_min, 'xi_max': head.xi_max,
            'parameter_order': ['location_bps', 'positive_scale_bps',
                                *[f'spline_score_{i}' for i in range(body.K)],
                                'raw_xi_down', 'raw_xi_up'],
            'hourly_parameters': array(raw[0])}


def test_diagnostics_payload(path, manifest):
    """Read an explicit, pickle-free test export tied to the released checkpoint.

    NPZ keys: checkpoint_sha256, alpha, covariate_names, fit_end_utc,
    origin_timestamps [N], selection_weights [N,V], observed_bps [N,H],
    quantiles_bps [N,H,3] at [0.01,0.5,0.99]. No subsampling before aggregation.
    """
    with np.load(path, allow_pickle=False) as data:
        if str(data['checkpoint_sha256'].item()) != manifest['checkpoint_sha256']:
            raise ValueError('Test diagnostics checkpoint does not match the release')
        if float(data['alpha'].item()) != float(manifest['alpha']):
            raise ValueError('Test diagnostics alpha does not match the release')
        names = data['covariate_names'].tolist()
        if names != manifest['input_columns'][:-1]:
            raise ValueError('Test diagnostics covariate order differs from the release')
        origins = pd.DatetimeIndex(pd.to_datetime(data['origin_timestamps'].astype(str), utc=True))
        fit_end = pd.Timestamp(str(data['fit_end_utc'].item()))
        if fit_end.tzinfo is None or not len(origins) or not origins.is_monotonic_increasing or origins.has_duplicates or origins[0] <= fit_end:
            raise ValueError('Test origins must be unique, chronological and after fitting')
        weights = np.asarray(data['selection_weights'], dtype=float)
        if (weights.shape != (len(origins), len(names)) or not np.isfinite(weights).all()
                or (weights < 0).any() or not np.allclose(weights.sum(1), 1, rtol=0, atol=1e-5)):
            raise ValueError('Invalid test selection weights')
        observed = np.asarray(data['observed_bps'], dtype=float)
        quantiles = np.asarray(data['quantiles_bps'], dtype=float)
        horizon = manifest['forecast_horizon']
        if (observed.shape != (len(origins), horizon) or quantiles.shape != (*observed.shape, 3)
                or not np.isfinite(observed).all() or not np.isfinite(quantiles).all()
                or (np.diff(quantiles, axis=-1) < 0).any()):
            raise ValueError('Invalid observed values or crossing test quantiles')
    chosen = weights > 1e-8
    mean = weights.mean(0)
    frequency = chosen.mean(0)
    conditional = np.divide((weights * chosen).sum(0), chosen.sum(0),
                            out=np.zeros(len(names)), where=chosen.sum(0) > 0)
    features = [{'feature': name, 'rank': 1 + int((mean > mean[i]).sum()),
                 'mean_weight': float(mean[i]), 'selection_frequency': float(frequency[i]),
                 'avg_weight_when_selected': float(conditional[i]) if chosen[:, i].any() else None}
                for i, name in enumerate(names)]
    # Retain every origin and horizon. The browser may decimate rendering only.
    backtest = []
    for h in range(horizon):
        lower, median, upper = quantiles[:, h, :].T
        y = observed[:, h]
        backtest.append({'hour': h + 1, 'samples': len(y),
                         'mae_bps': float(np.abs(y - median).mean()),
                         'coverage_1_99': float(((y >= lower) & (y <= upper)).mean()),
                         'lower_exceedance': float((y < lower).mean()),
                         'upper_exceedance': float((y > upper).mean()),
                         'records': [{'timestamp': str(t + pd.Timedelta(hours=h + 1)),
                                      'origin': str(t), 'observed_bps': float(a),
                                      'lower_1pct_bps': float(b), 'median_bps': float(c),
                                      'upper_1pct_bps': float(d)}
                                     for t, a, b, c, d in zip(origins, y, lower, median, upper)]})
    return {'status': 'ok', 'checkpoint_sha256': manifest['checkpoint_sha256'],
            'alpha': float(manifest['alpha']), 'basis': 'held_out_test_windows',
            'fit_end': str(fit_end), 'test_start': str(origins[0]), 'test_end': str(origins[-1]),
            'variable_selection': {'windows': len(weights), 'selected_threshold': 1e-8,
                                   'ranking_basis': 'mean_weight_including_zeros', 'features': features},
            'backtest': backtest}


def rolling_replay(model, features, manifest, *, observed_prices, days=7, stride_hours=24):
    """Replay a frozen checkpoint on causal daily windows, without fitting.

    Include the latest origin for selection statistics; score forecasts only
    where a real future observation is available. This is retrospective replay,
    not a claim that the checkpoint was fitted before each historical origin.
    """
    import torch
    from angel_forecast import input_window
    end = features.index[-1]
    if days < 1 or stride_hours < 1:
        raise ValueError('Replay days and stride must be positive')
    origins = pd.date_range(start=end - pd.Timedelta(days=days), end=end, freq=f'{stride_hours}h')
    if origins[-1] != end:
        origins = origins.append(pd.DatetimeIndex([end]))
    inputs = np.stack([input_window(features.loc[:t], manifest) for t in origins])
    if any(features.loc[:t].index[-1] != t for t in origins):
        raise ValueError('Replay origins are missing input data')
    with torch.inference_mode():
        output = model(torch.from_numpy(inputs))
        raw = output['raw_prediction']
        quantiles = model.quantile.quantile_at_levels(raw, torch.tensor([.01, .5, .99])).cpu().numpy()
        weights = output['interpretability']['selection_weights'].cpu().numpy().astype(float)
    if (weights.shape != (len(origins), len(manifest['input_columns']) - 1)
            or not np.isfinite(weights).all() or (weights < 0).any()
            or not np.allclose(weights.sum(1), 1, rtol=0, atol=1e-5)):
        raise ValueError('Invalid replay selection weights')
    if not np.isfinite(quantiles).all() or (np.diff(quantiles, axis=-1) < -1e-5).any():
        raise ValueError('Invalid replay forecast quantiles')
    chosen = weights > 1e-8
    mean = weights.mean(0)
    conditional = np.divide((weights * chosen).sum(0), chosen.sum(0),
                            out=np.zeros(weights.shape[1]), where=chosen.sum(0) > 0)
    selection = [{'feature': name, 'rank': 1 + int((mean > mean[i]).sum()),
                  'mean_weight': float(mean[i]), 'selection_frequency': float(chosen[:, i].mean()),
                  'avg_weight_when_selected': float(conditional[i]) if chosen[:, i].any() else None}
                 for i, name in enumerate(manifest['input_columns'][:-1])]
    backtest = []
    for h in range(manifest['forecast_horizon']):
        records = []
        for i, t in enumerate(origins):
            ts = t + pd.Timedelta(hours=h + 1)
            y = observed_prices.get(ts, np.nan)
            if not np.isfinite(y):
                continue
            q = quantiles[i, h]
            records.append({'origin': str(t), 'timestamp': str(ts), 'observed_bps': float(y),
                            'lower_1pct_bps': float(q[0]), 'median_bps': float(q[1]),
                            'upper_1pct_bps': float(q[2])})
        row = {'hour': h + 1, 'samples': len(records), 'records': records}
        if records:
            y, lower, median, upper = (np.array([r[key] for r in records]) for key in
                                     ['observed_bps', 'lower_1pct_bps', 'median_bps', 'upper_1pct_bps'])
            row.update(mae_bps=float(np.abs(y - median).mean()),
                       coverage_1_99=float(((y >= lower) & (y <= upper)).mean()),
                       lower_exceedance=float((y < lower).mean()), upper_exceedance=float((y > upper).mean()))
        backtest.append(row)
    return {'status': 'ok', 'basis': 'retrospective_daily_origins',
            'checkpoint_sha256': manifest['checkpoint_sha256'], 'alpha': float(manifest['alpha']),
            'test_start': str(origins[0]), 'test_end': str(origins[-1]),
            'stride_hours': stride_hours, 'origins': [str(t) for t in origins],
            'variable_selection': {'windows': len(origins), 'selected_threshold': 1e-8,
                                   'ranking_basis': 'mean_weight_including_zeros', 'features': selection},
            'backtest': backtest}
