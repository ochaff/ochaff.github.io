import json
import sys

import numpy as np
import pandas as pd
import pytest
from sklearn.ensemble import RandomForestClassifier

import build_dataset as builder
import train_rf


def test_new_weighted_builder_through_rf_training(tmp_path, monkeypatch):
    index = pd.date_range('2024-01-01', periods=4000, freq='h', tz='UTC')
    rng = np.random.default_rng(42)
    prices = pd.Series(rng.normal(0, .5, len(index)), index=index, name='depeg_bps')
    prices.iloc[np.arange(100, 3950, 80)] = 16
    prices.iloc[800] = np.nan
    monkeypatch.setattr(builder, 'load_uniswap_metrics', lambda: pd.DataFrame(
        {'tvlUSD_100': rng.uniform(1, 10, len(index))}, index=index))
    monkeypatch.setattr(builder, 'add_forecasting_target', lambda use_log_price=False: prices)
    curves = pd.DataFrame(rng.normal(10, 1, (len(index), 21)), index=index)
    cutoffs = []
    def decompose(alpha, train_pct, fit_end):
        cutoffs.append(fit_end)
        return builder.gegenbauer_scores(curves, np.linspace(-1, 1, 21), deg=7,
             alpha=alpha, train_pct=train_pct, fit_end=fit_end,
             center_time=True, normalize_basis=True, return_reconstruction=False)[0]
    monkeypatch.setattr(builder, 'decomp_logL_curve', decompose)
    flags = dict.fromkeys(['aave','aave_liq','crv','eth_price','eth_indicators','btc_price',
        'btc_indicators','usd_index','usd_indicators','fear_greed','gegen','target',
        'gegen_indicators','swap_size','use_log_price','liq_ownership','dynamic_threshold'], False)
    flags.update(gegen=True, target_window=24, target_threshold=15, depeg_side='both')
    frame = train_rf.build_or_load(str(tmp_path), .1, **flags)
    assert np.isnan(frame.loc[index[800], 'depeg_bps'])  # builder filling cannot invent outcomes
    assert cutoffs == [index[2775]]  # train boundary minus full 24-hour outcome window
    assert 'Gegenbauer_0.1_deg7' in frame
    assert frame.attrs['gegenbauer_alpha'] == .1
    assert 'dataset_alpha_0.1' in frame.attrs['dataset_path']
    def small_forest(**kwargs):
        kwargs.update(n_estimators=8, max_depth=3)
        return RandomForestClassifier(**kwargs)
    monkeypatch.setattr(train_rf, 'RandomForestClassifier', small_forest)
    monkeypatch.setitem(sys.modules, 'shap', None)
    result = train_rf.train_and_explain(frame, .1, ale_bootstraps=100)
    assert result['alpha'] == .1
    assert 'Gegenbauer_0.1_deg7' in result['ale']['features']
    assert result['probability'] >= 0
    json.dumps(result, allow_nan=False)
    with pytest.raises(ValueError, match='alpha'):
        train_rf.train_and_explain(frame, .4)


def test_rf_rejects_mixed_alpha_columns_and_mislabelled_metadata():
    frame = pd.DataFrame({f'Gegenbauer_0.1_deg{i}':[0.] for i in range(8)})
    train_rf.validate_rf_dataset(frame)
    wrong = frame.assign(**{'Gegenbauer_0.4_deg0':0.})
    with pytest.raises(ValueError,match='alpha'):
        train_rf.validate_rf_dataset(wrong)
    frame.attrs['gegenbauer_alpha'] = .4
    with pytest.raises(ValueError,match='metadata'):
        train_rf.validate_rf_dataset(frame)


def test_weighted_centering_does_not_see_future_and_skipping_reconstruction_is_exact():
    index = pd.date_range('2024-01-01', periods=100, freq='h', tz='UTC')
    curves = pd.DataFrame(np.random.default_rng(1).normal(size=(100, 21)), index=index)
    kwargs = dict(x_norm=np.linspace(-1, 1, 21), deg=7, alpha=.1, fit_end=index[60])
    full = builder.orthopoly_decompose(curves, **kwargs)
    light = builder.orthopoly_decompose(curves, return_reconstruction=False, **kwargs)
    pd.testing.assert_frame_equal(full[1], light[1])
    assert light[3] is None and light[4] is None
    curves.iloc[61:] += 1000
    changed = builder.orthopoly_decompose(curves, **kwargs)
    np.testing.assert_allclose(full[0], changed[0])
    pd.testing.assert_frame_equal(full[1].iloc[:61], changed[1].iloc[:61])
