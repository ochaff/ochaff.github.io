import numpy as np
import pandas as pd
import pytest
from scipy.stats import binom

from monitor_models import (HOUR, complete_events, event_onsets, garch_forecast,
                            hourly_prices, hourly_forecast_summary, np_policy, onset_labels, partition_bounds,
                            tail_risk, monitoring_labels, monitoring_bounds,
                            monitoring_level, feature_catalog)


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
    for hour in result['hourly']:
        assert hour['lower_es_1pct_bps'] <= hour['lower_1pct_bps'] <= hour['median_bps']
        assert hour['median_bps'] <= hour['upper_1pct_bps'] <= hour['upper_es_1pct_bps']


def test_forecast_median_and_signed_tail_means_are_not_loss_clipped():
    paths = np.arange(1000, dtype=float)[:, None] + np.array([1, 2])[None, :]
    summary = hourly_forecast_summary(paths, prices().index[0], paths.mean(axis=0))
    assert summary[0]['median_bps'] == 500.5
    assert summary[0]['lower_es_1pct_bps'] == np.arange(1, 11).mean()
    assert summary[0]['upper_es_1pct_bps'] == np.arange(991, 1001).mean()
    # A positive lower ES must remain positive on a signed price chart.
    assert summary[0]['lower_es_1pct_bps'] > 0


def test_monitoring_uses_any_future_breach_without_onset_or_current_breach_censoring():
    p = prices()
    p.iloc[70:80] = 16
    labels = monitoring_labels(p)
    assert labels.target.iloc[46] == 1  # 24 hours before the first breach
    assert labels.target.iloc[69] == 1  # no minimum lead time
    assert labels.eligible.iloc[70]     # monitoring includes ongoing dislocations
    assert labels.target.iloc[70] == 1
    assert labels.target.iloc[79] == 0  # the current hour alone is not a future breach
    assert not labels.eligible.iloc[-24:].any()
    end = p.index[60]
    original = monitoring_labels(p, end=end)
    p.loc[p.index > end] = 100
    pd.testing.assert_frame_equal(original, monitoring_labels(p, end=end))
    assert set(monitoring_bounds(prices(2000))) == {'train', 'calibration', 'test'}


def test_monitoring_band_boundaries():
    assert [monitoring_level(p) for p in [0, .0999, .10, .1999, .20, .4999, .50, 1]] == [
        'Low', 'Low', 'Elevated', 'Elevated', 'High', 'High', 'Critical', 'Critical']


def test_histograms_use_real_reference_values_excluding_current_and_keep_outliers():
    index = pd.date_range('2026-01-01', periods=1000, freq='h', tz='UTC')
    df = pd.DataFrame({'signal': np.arange(1000.), 'constant': 3.}, index=index)
    rows = feature_catalog(df, {'signal': -.1}, {'signal': .2})
    row = rows[0]
    assert row['value'] == 999 and row['local_shap'] == -.1
    assert row['histogram']['reference_count'] == 999
    assert sum(row['histogram']['counts']) == 999
    assert row['histogram']['percentile'] == 100
    assert rows[1]['local_shap'] is None
    assert np.diff(rows[1]['histogram']['edges']).min() > 0
