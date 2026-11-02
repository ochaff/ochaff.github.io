import json
import sys

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

import train_rf


def test_live_censoring_and_test_data_cannot_select_the_cutoff(monkeypatch):
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
    assert first['early_warning']['policy']['validation_events'] >= 5
    assert isinstance(first['early_warning']['alert'], bool)
    json.dumps(first, allow_nan=False)

    # Changes only in the held-out test period must leave the selected NP
    # cutoff and its calibration-negative population exactly unchanged.
    frame.loc[index[-400:], 'signal'] = 1e9
    frame.loc[index[-1], 'depeg_bps'] = 16
    second = train_rf.train_and_explain(frame, .4)
    assert first['early_warning']['policy'] == second['early_warning']['policy']
    assert second['early_warning']['status'] == 'censored'
    assert second['early_warning']['alert'] is None
    assert second['early_warning']['censor_reason'] == 'already_depegged'
