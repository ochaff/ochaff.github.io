import numpy as np
import pandas as pd
import pytest
from scipy.stats import binom

from monitor_models import (HOUR, complete_events, event_onsets, garch_forecast,
                            hourly_prices, np_policy, onset_labels, partition_bounds,
                            tail_risk)


def prices(n=200):
    return pd.Series(0., index=pd.date_range('2025-01-01', periods=n, freq='h', tz='UTC'))


def test_onset_leads_censoring_and_complete_windows():
    p = prices()
    p.iloc[50:53] = 16
    labels, events = onset_labels(p)
    assert list(events) == [p.index[50]]
    assert labels.target.iloc[26:49].eq(1).all()  # inclusive 24h to 2h lead
    assert labels.target.iloc[25] == 0
    assert labels.censor_reason.iloc[49] == 'inside_minimum_lead'
    assert labels.censor_reason.iloc[50:53].eq('already_depegged').all()
    assert not labels.eligible.iloc[:24].any()
    assert not labels.eligible.iloc[-24:].any()
    assert labels.eligible.iloc[26]


def test_full_quiet_reset_and_missing_prices_do_not_create_events():
    p = prices()
    p.iloc[[30, 40, 65]] = 16
    assert list(event_onsets(p)) == [p.index[30], p.index[65]]
    p.iloc[64] = np.nan
    assert list(event_onsets(p)) == [p.index[30]]
    labels, _ = onset_labels(p)
    assert not labels.eligible.iloc[60]
    assert not labels.eligible.iloc[70]
    assert pd.isna(hourly_prices(p.drop(p.index[64])).iloc[64])


def test_partition_end_censors_future_and_validation_expands_to_five_events():
    p = prices(2000)
    p.iloc[np.arange(100, 1650, 100)] = 16
    bounds = partition_bounds(p)
    start, end = bounds['validation']
    assert len(complete_events(p, start, end)) >= 5
    assert end < bounds['test'][0]
    assert bounds['calibration'][1] < start
    original, _ = onset_labels(p, end=end)
    p.loc[p.index > end] = 100
    modified, _ = onset_labels(p, end=end)
    pd.testing.assert_frame_equal(original, modified)
    assert not original.eligible.iloc[-24:].any()


def test_insufficient_validation_events_fails_instead_of_relaxing_policy():
    with pytest.raises(ValueError, match='five'):
        partition_bounds(prices(2000))
    with pytest.raises(ValueError, match='five'):
        np_policy([0, 1], [.1, .8], event_count=4)


def test_np_rank_bound_and_ties_are_strict():
    p = np.linspace(0, 1, 1000)
    policy = np_policy(np.zeros(1000), p, event_count=5)
    k = policy['order_rank']
    assert binom.sf(k - 1, 1000, .92) <= .05
    assert binom.sf(k - 2, 1000, .92) > .05
    assert policy['threshold'] > p[k - 1]
    assert policy['validation_fpr'] <= .08
    tied = np_policy(np.zeros(1000), np.full(1000, .5), event_count=5)
    assert tied['threshold'] > .5
    assert tied['validation_fpr'] == 0
    insufficient = np_policy(np.zeros(10), np.full(10, .5), event_count=5)
    assert insufficient['threshold'] is None
    assert insufficient['status'] == 'insufficient_negatives_no_alert_rule'


def test_tail_direction_quote_convention_and_es_ordering():
    paths = np.linspace(-40, 10, 1000)[:, None]
    tails, direction = tail_risk(paths)
    assert direction == 'USDC'
    assert tail_risk(-paths)[1] == 'USDT'
    for token in tails.values():
        assert token['0.005']['var_bps'] >= token['0.01']['var_bps']
        assert token['0.01']['es_bps'] >= token['0.01']['var_bps']
        assert token['0.005']['es_bps'] >= token['0.005']['var_bps']
    assert tail_risk(np.ones((1000, 24)))[0]['USDC']['0.01']['es_bps'] == 0


def test_student_t_garch_forecast_has_24_hours_and_finite_tail_risk():
    rng = np.random.default_rng(11)
    p = prices(1000)
    for i in range(1, len(p)):
        p.iloc[i] = .7 * p.iloc[i - 1] + rng.standard_t(7)
    result = garch_forecast(p, simulations=20_000)
    assert len(result['hourly']) == 24
    assert result['hourly'][-1]['timestamp'] == str(p.index[-1] + 24 * HOUR)
    assert result['parameters']['nu'] > 2
    assert result['simulations'] == 20_000
    for token in result['tails'].values():
        assert token['0.005']['es_bps'] >= token['0.005']['var_bps'] >= 0
