import json
import sys

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

import train_rf


def test_monitoring_export_and_test_data_do_not_change_the_fitted_forest(monkeypatch):
    # A small real forest exercises calibration, validation and serialization;
    # SHAP is unrelated to the alert-policy isolation under test.
    def small_forest(**kwargs):
        kwargs.update(n_estimators=8, max_depth=3)
        return RandomForestClassifier(**kwargs)
    monkeypatch.setattr(train_rf, 'RandomForestClassifier', small_forest)
    monkeypatch.setitem(sys.modules, 'shap', None)
    index = pd.date_range('2024-01-01', periods=4000, freq='h', tz='UTC')
    rng = np.random.default_rng(42)
    frame = pd.DataFrame({'signal': rng.normal(size=len(index)),
                          'depeg_bps': rng.normal(0, .5, len(index))}, index=index)
    frame.iloc[np.arange(100, 3950, 80), frame.columns.get_loc('depeg_bps')] = 16
    first = train_rf.train_and_explain(frame, .4)
    assert 'early_warning' not in first
    assert first['monitoring']['mode'] == 'probability_risk_bands'
    assert set(first['monitoring']['split_periods']) == {'train', 'calibration', 'test'}
    assert first['monitoring']['risk_level'] in {'Low', 'Elevated', 'High', 'Critical'}
    assert 'depeg_bps_lag1h' not in [r['feature'] for r in first['feature_catalog']]
    assert first['feature_catalog'][0]['histogram']['reference_count'] > 0
    assert len(first['price_history']) == 168
    assert any(point['depeg_bps'] < 0 for point in first['price_history'])
    for point in first['price_history']:
        assert point['price_ratio'] == 1 + point['depeg_bps'] / 10_000
    json.dumps(first, allow_nan=False)

    # Changes only in the held-out test period leave forest fitting and its
    # fallback feature importances unchanged. They may change current risk.
    frame.loc[index[-400:], 'signal'] = 1e9
    frame.loc[index[-1], 'depeg_bps'] = 16
    second = train_rf.train_and_explain(frame, .4)
    assert first['global_shap'] == second['global_shap']
    assert 'early_warning' not in second
    assert np.isfinite(second['probability'])
