"""Download the newest published ANGEL bundle and forecast on CPU only."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

import numpy as np
import pandas as pd
import requests
from model_config import DATASET_ALPHA, require_dataset_alpha
from angel_explanations import distribution_payload, test_diagnostics_payload, rolling_replay

REPOSITORY = 'QuantLet/onchain-insights'
MANIFEST = 'ammonitor-angel.json'
RUNTIME_REVISION = '303c6399357a00e11897aa30e598bc6f23b6fb45'
RUNTIME = Path(__file__).resolve().parent / 'angel_runtime'


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def newest_release(releases):
    candidates = [r for r in releases if not r.get('draft') and not r.get('prerelease')
                  and any(a['name'] == MANIFEST for a in r.get('assets', []))]
    if not candidates:
        raise ValueError('No published ANGEL release containing ammonitor-angel.json')
    return max(candidates, key=lambda r: pd.Timestamp(r['published_at']))


def download_bundle(cache_dir, repository=REPOSITORY, tag=None):
    """Select by publication time, not lexicographic tag or GitHub latest flag."""
    session = requests.Session()
    headers = {'Accept': 'application/vnd.github+json'}
    if os.environ.get('GH_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GH_TOKEN']
    base = f'https://api.github.com/repos/{repository}'
    if tag:
        from urllib.parse import quote
        response = session.get(base + '/releases/tags/' + quote(tag, safe=''), headers=headers, timeout=60)
        response.raise_for_status()
        release = response.json()
        if release.get('draft') or release.get('prerelease'):
            raise ValueError('Only published stable releases can be deployed')
    else:
        releases = []
        url = base + '/releases?per_page=100'
        while url:
            response = session.get(url, headers=headers, timeout=60)
            response.raise_for_status()
            releases.extend(response.json())
            url = response.links.get('next', {}).get('url')
        release = newest_release(releases)
    directory = Path(cache_dir) / str(release['id'])
    directory.mkdir(parents=True, exist_ok=True)
    assets = {a['name']: a for a in release['assets']}

    def download(name, expected=None):
        if Path(name).name != name or name not in assets:
            raise ValueError(f'Missing or invalid bundle asset: {name}')
        asset = assets[name]
        api_digest = asset.get('digest') or ''
        if expected and api_digest and api_digest != 'sha256:' + expected:
            raise ValueError(f'Manifest and GitHub disagree on {name} digest')
        expected = expected or api_digest.removeprefix('sha256:')
        path = directory / name
        # Always refresh the tiny manifest; large assets can be reused by hash.
        if name != MANIFEST and expected and path.exists() and sha256(path) == expected:
            return path
        response = session.get(asset['browser_download_url'], stream=True, timeout=120)
        response.raise_for_status()
        temporary = path.with_suffix(path.suffix + '.tmp')
        with temporary.open('wb') as stream:
            for block in response.iter_content(1024 * 1024):
                stream.write(block)
        if expected and sha256(temporary) != expected:
            temporary.unlink()
            raise ValueError(f'SHA256 mismatch for {name}')
        temporary.replace(path)
        return path

    manifest_path = download(MANIFEST)
    manifest = json.loads(manifest_path.read_text())
    validate_manifest(manifest)
    if manifest.get('test_diagnostics_asset'):
        if len(manifest.get('test_diagnostics_sha256', '')) != 64:
            raise ValueError('Test diagnostics require a SHA256 hash')
        manifest['_test_diagnostics_path'] = str(download(manifest['test_diagnostics_asset'], manifest['test_diagnostics_sha256']))
    checkpoint = download(manifest['checkpoint_asset'], manifest['checkpoint_sha256'])
    preprocessing = download(manifest['preprocessing_asset'], manifest['preprocessing_sha256'])
    provenance = {'repository': repository, 'tag': release['tag_name'], 'url': release['html_url'],
                  'published_at': release['published_at'], 'release_id': release['id'],
                  'checkpoint_sha256': manifest['checkpoint_sha256'],
                  'preprocessing_sha256': manifest['preprocessing_sha256'],
                  'manifest_sha256': sha256(manifest_path)}
    return manifest, checkpoint, preprocessing, provenance


def validate_manifest(manifest):
    if manifest.get('schema_version') != 1 or manifest.get('model') != 'ANGEL':
        raise ValueError('Unsupported ANGEL bundle schema/model')
    require_dataset_alpha(manifest.get('alpha'), 'ANGEL release')
    columns = manifest.get('input_columns', [])
    if not columns or len(set(columns)) != len(columns) or columns[-1] != 'depeg_bps':
        raise ValueError('Bundle must contain unique ordered columns with depeg_bps last')
    if any(name.startswith('Gegenbauer_') and not name.startswith(f'Gegenbauer_{DATASET_ALPHA}_') for name in columns):
        raise ValueError('ANGEL input columns must use Gegenbauer alpha=0.1')
    if manifest.get('target', {}).get('units') != 'basis_points' or 'no log' not in manifest['target'].get('transformation', ''):
        raise ValueError('Only raw-bps ANGEL bundles are supported')
    if manifest.get('forecast_horizon') != 24 or manifest.get('sequence_length', 0) < 1:
        raise ValueError('Expected a 24-hour forecast and positive sequence length')
    for key in ['checkpoint_sha256', 'preprocessing_sha256']:
        if len(manifest.get(key, '')) != 64:
            raise ValueError(f'Missing SHA256: {key}')
    for key in ['training_data_end_utc', 'preprocessing_fitting_cutoff_utc']:
        if pd.Timestamp(manifest[key]).tzinfo is None:
            raise ValueError(f'{key} must include a UTC offset')


def runtime_modules():
    os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir()) / 'ammonitor-mpl'))
    if str(RUNTIME) not in sys.path:
        sys.path.insert(0, str(RUNTIME))
    import torch
    from models.ANGEL import ANGEL_forecast
    from utils import build_dataset as builder
    torch.set_num_threads(int(os.environ.get('ANGEL_CPU_THREADS', '2')))
    return torch, ANGEL_forecast, builder


def load_model(manifest, checkpoint, state):
    torch, model_class, _ = runtime_modules()
    model = model_class.load_from_checkpoint(str(checkpoint), map_location='cpu', weights_only=True).cpu().eval()
    names = list(getattr(model, 'var_names', [])) + [getattr(model, 'target_name', '')]
    if names != manifest['input_columns'] or model.hparams.enc_in != len(names):
        raise ValueError('Checkpoint feature order does not match the manifest')
    if not np.isclose(model.hparams.alpha, manifest['alpha']):
        raise ValueError('Checkpoint and preprocessing alpha differ')
    require_dataset_alpha(model.hparams.alpha, 'ANGEL checkpoint')
    if model.hparams.seq_len != manifest['sequence_length'] or model.hparams.pred_len != 24:
        raise ValueError('Checkpoint dimensions do not match the manifest')
    if model.hparams.forecast_task != 'distribution' or model.hparams.tail_model != 'gpd' or model.hparams.use_log_price:
        raise ValueError('Expected ANGEL distribution/GPD with raw-bps target')
    reference = state['reference_input']
    if reference.shape != (manifest['sequence_length'], len(names)) or not np.isfinite(reference).all():
        raise ValueError('Invalid reference input fixture')
    with torch.inference_mode():
        actual = model.model(torch.from_numpy(reference[None].astype('float32'))).numpy()
    expected = state['reference_raw_output']
    # Float32 kernels differ slightly across x86/ARM and PyTorch versions.
    if actual.shape != expected.shape or not np.allclose(actual, expected, rtol=1e-5, atol=1e-5):
        raise ValueError('CPU reference prediction differs from released fixture; incompatible runtime')
    return model, {'max_absolute_difference': float(np.max(np.abs(actual - expected))),
                   'rtol': 1e-5, 'atol': 1e-5, 'torch_version': torch.__version__,
                   'runtime_source_revision': RUNTIME_REVISION}


def frozen_coefficients(raw, state, alpha):
    _, _, builder = runtime_modules()
    print(f'Projecting {len(raw):,} raw liquidity rows onto the frozen grid…', flush=True)
    curves = builder.preprocess_liq_curve(raw)
    print(f'Frozen liquidity curve matrix: {curves.shape}', flush=True)
    grid = state['liquidity_tick_grid']
    extra = curves.columns.difference(grid)
    if len(extra):
        raise ValueError('Live liquidity grid has unseen ticks; export a compatible bundle')
    curves = curves.reindex(columns=grid, fill_value=0.)
    center, projection = state['liquidity_centering_curve'], state['liquidity_projection']
    if center.shape != (len(grid),) or projection.shape != (len(grid), 8):
        raise ValueError('Invalid frozen liquidity transform dimensions')
    values = (curves.to_numpy(dtype=float) - center) @ projection
    return pd.DataFrame(values, index=curves.index,
                        columns=[f'Gegenbauer_{alpha}_deg{i}' for i in range(8)])


def build_features(manifest, model, state, cache_dir):
    _, _, builder = runtime_modules()
    print('Building checkpoint-compatible features with the frozen liquidity transform…', flush=True)
    def decompose(alpha, **kwargs):
        raw = pd.read_parquet('data/Uniswap/hourly_liquidity_full.parquet',
             columns=['hour', 'timestamp', 'tickLower', 'active_liquidity_L'],
             filters=[('hour', '>=', pd.Timestamp('2022-01-01', tz='UTC'))])
        return frozen_coefficients(raw, state, alpha)
    flags = ['aave','aave_liq','crv','eth_price','eth_indicators','btc_price','btc_indicators',
             'usd_index','usd_indicators','fear_greed','gegen','gegen_indicators','swap_size','liq_ownership']
    options = {key: bool(model.hparams[key]) for key in flags}
    directory = Path(cache_dir) / 'features'
    directory.mkdir(parents=True, exist_ok=True)
    with patch.object(builder, 'decomp_logL_curve', decompose):
        path = builder.build_dataset(dataset_path=str(directory), alpha=manifest['alpha'],
             train_pct=model.hparams.train_pct, last_date=None, target=False,
             target_window=24, target_threshold=15, depeg_side='both', dynamic_threshold=False,
             use_log_price=False, **options)
    print('Feature dataset built; validating the released reference window…', flush=True)
    features = pd.read_parquet(path)
    features.index = pd.to_datetime(features.index, utc=True).as_unit('ns')
    columns = manifest['input_columns']
    if set(columns) - set(features):
        raise ValueError(f'Missing ANGEL inputs: {sorted(set(columns) - set(features))}')
    features = features[columns].sort_index()
    end = pd.Timestamp(manifest['training_data_end_utc'])
    reference_index = pd.date_range(end=end, periods=manifest['sequence_length'], freq='h')
    reference = features.reindex(reference_index).to_numpy(dtype='float32')
    if not np.allclose(reference, state['reference_input'], rtol=1e-5, atol=1e-4):
        matching = np.isclose(reference, state['reference_input'], rtol=1e-5, atol=1e-4).all(axis=0)
        bad = [name for name, ok in zip(columns, matching) if not ok]
        raise ValueError(f'Rebuilt training reference inputs differ; incompatible feature builder/data: {bad}')
    features.attrs['feature_reference_validated'] = True
    raw_prices = builder.add_forecasting_target(False)
    if not pd.notna(raw_prices.reindex([features.index[-1]]).iloc[0]):
        raise ValueError('Latest forecast origin has no observed pool price')
    features.attrs['observed_prices'] = raw_prices
    return features


def input_window(features, manifest):
    columns, length = manifest['input_columns'], manifest['sequence_length']
    frame = features[columns].iloc[-length:]
    if len(frame) != length or not np.all(np.diff(frame.index.as_unit('ns').asi8) == pd.Timedelta(hours=1).value):
        raise ValueError('ANGEL requires a complete consecutive hourly input window')
    values = frame.to_numpy(dtype='float32')
    if not np.isfinite(values).all():
        raise ValueError('ANGEL input contains missing or infinite feature values')
    return values


def gpd_summary(lower, upper, xi_lower, xi_upper, beta_lower, beta_upper, x_lower, x_upper, alpha,
                splice_lower=.1, splice_upper=.9):
    """Analytical signed ES and clipped quote-loss ES, including all GPD tail mass."""
    if np.any(np.asarray([xi_lower, xi_upper]) >= 1):
        raise ValueError('GPD shape >=1 gives infinite ES; cannot publish finite tail risk')
    es_lower = lower - (beta_lower + xi_lower * (x_lower - lower)) / (1 - xi_lower)
    es_upper = upper + (beta_upper + xi_upper * (upper - x_upper)) / (1 - xi_upper)
    def survival(excess, beta, xi):
        if abs(xi) < 1e-8:
            return np.exp(-excess / beta)
        return 0. if 1 + xi * excess / beta <= 0 else np.exp(-np.log1p(xi * excess / beta) / xi)
    if lower <= 0:
        usdc_es = -es_lower
    else:
        mass = splice_lower * survival(x_lower, beta_lower, xi_lower)
        usdc_es = mass * (beta_lower + xi_lower * x_lower) / (1 - xi_lower) / alpha
    if upper >= 0:
        usdt_es = es_upper
    else:
        mass = (1 - splice_upper) * survival(-x_upper, beta_upper, xi_upper)
        usdt_es = mass * (beta_upper - xi_upper * x_upper) / (1 - xi_upper) / alpha
    return {'lower_es_bps': float(es_lower), 'upper_es_bps': float(es_upper),
            'USDC': {'var_bps': max(float(-lower), 0.), 'es_bps': max(float(usdc_es), 0.)},
            'USDT': {'var_bps': max(float(upper), 0.), 'es_bps': max(float(usdt_es), 0.)}}


def selection_payload(output, columns, timestamp, sequence_length):
    """Export the covariate selector from this forward pass, in manifest order."""
    diagnostics = output.get('interpretability', {})
    weights = diagnostics.get('selection_weights')
    if weights is None:
        return {'status':'unavailable', 'reason':'Checkpoint did not expose covariate selection weights'}
    names = columns[:-1]
    if list(diagnostics.get('feature_names', names)) != names:
        raise ValueError('ANGEL selector feature order differs from the manifest')
    values = weights.detach().cpu().numpy().astype(float)
    if values.shape != (1,len(names)) or not np.isfinite(values).all() or (values < 0).any():
        raise ValueError('Invalid ANGEL selection-weight dimensions or values')
    values = values[0]
    total = float(values.sum())
    if not np.isclose(total, 1., rtol=0, atol=1e-5):
        raise ValueError('ANGEL selection weights do not sum to one')
    selected = values > 1e-8  # Same threshold as the model's selection mask.
    mask = diagnostics.get('selection_mask')
    if mask is not None and not np.array_equal(mask.detach().cpu().numpy(), selected[None]):
        raise ValueError('ANGEL selection mask differs from exported weights')
    ordered = sorted(set(values.tolist()), reverse=True)
    ranks = {v:1+int((values>v).sum()) for v in ordered}
    return {'status':'ok', 'method':'current_window_covariate_selector',
            'timestamp':str(timestamp), 'window_start':str(pd.Timestamp(timestamp)-pd.Timedelta(hours=sequence_length-1)),
            'sequence_length':sequence_length, 'covariates':len(names),
            'selected_covariates':int(selected.sum()), 'weight_sum':total,
            'selected_threshold':1e-8, 'target_branch_excluded':'depeg_bps',
            'scope':'One gate per covariate for the full input window, shared across all 24 forecast hours',
            'features':[{'feature':name, 'weight':float(value), 'selected':bool(chosen), 'rank':ranks[float(value)]}
                        for name,value,chosen in zip(names,values,selected)]}


def predict(manifest, model, features, provenance, validation):
    torch, _, _ = runtime_modules()
    values = input_window(features, manifest)
    origin = features.index[-1]
    with torch.inference_mode():
        output = model(torch.from_numpy(values[None]), var_levels=[.01, .005])
        selection = selection_payload(output, manifest['input_columns'], origin, len(values))
        raw = output['raw_prediction']
        head = model.quantile
        parts = head._tail_params_from_body(raw[..., :head.body_param_dim],
                   raw[..., head.body_param_dim], raw[..., head.body_param_dim + 1])
        tail_parameters = [part[0].cpu().numpy().astype(float) for part in [parts[6],parts[7],parts[8],parts[9],parts[2],parts[4]]]
        levels = [.005, .01, .5, .99, .995]
        quantiles = head.quantile_at_levels(raw, torch.tensor(levels)).cpu().numpy()[0]
    if min(head.u_low, 1 - head.u_high) < .01:
        raise ValueError('Both reported risk levels must lie within the exported GPD tails')
    if not np.isfinite(quantiles).all() or np.any(np.diff(quantiles, axis=1) < -1e-5):
        raise ValueError('Nonfinite or crossing ANGEL forecast quantiles')
    hourly, tails = [], {token: {} for token in ['USDC','USDT']}
    for h, q in enumerate(quantiles):
        params = [part[h] for part in tail_parameters]
        summary = gpd_summary(q[1], q[3], *params, .01, head.u_low, head.u_high)
        hourly.append({'hour':h+1, 'timestamp':str(origin+pd.Timedelta(hours=h+1)),
                       'median_bps':float(q[2]), 'lower_1pct_bps':float(q[1]), 'upper_1pct_bps':float(q[3]),
                       'lower_es_1pct_bps':summary['lower_es_bps'], 'upper_es_1pct_bps':summary['upper_es_bps']})
        if h == 23:
            for alpha, low, high in [(.01,q[1],q[3]),(.005,q[0],q[4])]:
                summary = gpd_summary(low,high,*params,alpha,head.u_low,head.u_high)
                for token in tails:
                    tails[token][str(alpha)] = summary[token]
    a,b = tails['USDC']['0.01']['var_bps'], tails['USDT']['0.01']['var_bps']
    result = {'status':'ok', 'model':'ANGEL', 'forecast_method':'neural_quantile_spline_with_GPD_tails',
              'alpha':float(manifest['alpha']), 'variable_selection':selection,
              'distribution_explorer':distribution_payload(head, raw),
              'timestamp':str(origin), 'horizon_hours':24, 'sequence_length':len(values),
              'input_features':len(manifest['input_columns']), 'quote':'USDT per USDC',
              'unit':'quote_deviation_bps', 'risk_basis':'adverse_deviation_from_peg_at_hour_24',
              'risk_direction':'Balanced' if a == b else 'USDC' if a > b else 'USDT',
              'direction_rule':'larger_1pct_var', 'tails':tails, 'hourly':hourly,
              'tail_method':'analytical_GPD_tail_means_including_clipped_positive_losses',
              'training_data_end':manifest['training_data_end_utc'],
              'preprocessing_fitting_cutoff':manifest['preprocessing_fitting_cutoff_utc'],
              'release':provenance, 'cpu_reference_validation':validation,
              'source_git_commit':manifest['source_git_commit'],
              'feature_reference_validated':bool(features.attrs.get('feature_reference_validated'))}
    json.dumps(result, allow_nan=False)
    return result


def forecast(cache_dir='.angel-cache', repository=REPOSITORY, tag=None, test_diagnostics=None):
    manifest, checkpoint, preprocessing, provenance = download_bundle(cache_dir, repository, tag)
    with np.load(preprocessing, allow_pickle=False) as npz:
        state = {key: npz[key] for key in npz.files}
    model, validation = load_model(manifest, checkpoint, state)
    features = build_features(manifest, model, state, cache_dir)
    result = predict(manifest, model, features, provenance, validation)
    result['replay'] = rolling_replay(model, features, manifest, observed_prices=features.attrs['observed_prices'])
    diagnostics = test_diagnostics or manifest.get('_test_diagnostics_path')
    if diagnostics:
        result['test_diagnostics'] = test_diagnostics_payload(diagnostics, manifest)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', default='.angel-cache')
    parser.add_argument('--repository', default=REPOSITORY)
    parser.add_argument('--tag', help='Optional pinned release for reproducibility; default selects newest published bundle')
    parser.add_argument('--test-diagnostics', help='Pickle-free held-out NPZ for this checkpoint; overrides the release diagnostics asset')
    parser.add_argument('--output', default='dashboard_data/angel_forecast.json')
    args = parser.parse_args()
    result = forecast(args.cache_dir, args.repository, args.tag, args.test_diagnostics)
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2, allow_nan=False))
    temporary.replace(path)
    print(f'Published {result["release"]["tag"]} forecast at {result["timestamp"]}', flush=True)


if __name__ == '__main__':
    main()
