import numpy as np
import pandas as pd
import pytest
import torch

from angel_explanations import rolling_replay, test_diagnostics_payload as export_test_diagnostics


class ReplayModel:
    def __init__(self):
        self.quantile = self
        self.seen = None

    def __call__(self, x):
        self.seen = x.clone()
        # Alternate sparse gates across daily origins; exact future values in
        # this deterministic fixture make alignment errors observable.
        even = (x[:, -1, 0] // 24).long() % 2 == 0
        weights = torch.where(even[:, None], torch.tensor([1., 0.]), torch.tensor([.25, .75]))
        median = x[:, -1, 0, None] + torch.arange(1, 25)[None]
        raw = torch.stack([median - 1, median, median + 1], dim=-1)
        return {'raw_prediction': raw, 'interpretability': {'selection_weights': weights}}

    def quantile_at_levels(self, raw, levels):
        return raw


def test_daily_replay_is_causal_aggregates_zeros_and_scores_observed_outcomes_only():
    idx = pd.date_range('2026-10-01', periods=337, freq='h', tz='UTC')
    frame = pd.DataFrame({'a': np.arange(len(idx)), 'b': 0., 'depeg_bps': np.arange(len(idx))}, index=idx)
    manifest = {'input_columns': list(frame), 'sequence_length': 168,
                'forecast_horizon': 24, 'checkpoint_sha256': 'a' * 64, 'alpha': .1}
    model = ReplayModel()
    replay = rolling_replay(model, frame, manifest, observed_prices=frame.depeg_bps)
    assert len(replay['origins']) == 8
    assert pd.DatetimeIndex(replay['origins']).equals(pd.date_range(end=idx[-1], periods=8, freq='24h'))
    for i, origin in enumerate(replay['origins']):
        expected = frame.loc[:origin].iloc[-168:].to_numpy(dtype='float32')
        np.testing.assert_array_equal(model.seen[i].numpy(), expected)
    assert sum(h['samples'] for h in replay['backtest']) == 168
    assert all(h['samples'] == 7 and h['mae_bps'] == 0 and h['coverage_1_99'] == 1 for h in replay['backtest'])
    assert all(pd.Timestamp(r['timestamp']) <= idx[-1] for h in replay['backtest'] for r in h['records'])
    a, b = replay['variable_selection']['features']
    assert a['mean_weight'] == .625 and a['selection_frequency'] == 1 and a['avg_weight_when_selected'] == .625
    assert b['mean_weight'] == .375 and b['selection_frequency'] == .5 and b['avg_weight_when_selected'] == .75
    assert replay['basis'] == 'retrospective_daily_origins'
    # Outcomes cannot affect gates or parameters at an earlier origin.
    changed = frame.depeg_bps.copy();changed.iloc[-1] += 999
    revised = rolling_replay(model, frame, manifest, observed_prices=changed)
    assert revised['variable_selection'] == replay['variable_selection']
    assert revised['backtest'][-1]['mae_bps'] > 0
    with pytest.raises(ValueError, match='consecutive'):
        rolling_replay(model, frame.drop(idx[-10]), manifest, observed_prices=frame.depeg_bps)


def test_held_out_npz_checks_identity_chronology_feature_order_and_conditional_mean(tmp_path):
    path = tmp_path / 'test.npz'
    manifest = {'checkpoint_sha256': 'a' * 64, 'alpha': .1,
                'input_columns': ['a', 'b', 'c', 'depeg_bps'], 'forecast_horizon': 24}
    data = dict(checkpoint_sha256='a' * 64, alpha=.1, covariate_names=['a', 'b', 'c'],
                fit_end_utc='2026-10-01T00:00:00Z',
                origin_timestamps=['2026-10-02T00:00:00Z', '2026-10-03T00:00:00Z'],
                selection_weights=[[1., 0., 0.], [.25, .75, 0.]], observed_bps=np.zeros((2, 24)),
                quantiles_bps=np.tile([-1., 0., 1.], (2, 24, 1)))
    np.savez(path, **data)
    result = export_test_diagnostics(path, manifest)
    assert result['variable_selection']['features'][1]['selection_frequency'] == .5
    assert result['variable_selection']['features'][1]['avg_weight_when_selected'] == .75
    assert result['variable_selection']['features'][2]['avg_weight_when_selected'] is None
    for key, value, error in [('checkpoint_sha256', 'b' * 64, 'checkpoint'),
                              ('covariate_names', ['b', 'a', 'c'], 'order'),
                              ('fit_end_utc', '2026-10-02T00:00:00Z', 'after fitting'),
                              ('selection_weights', [[1., 1., 0.], [1., 0., 0.]], 'selection')]:
        np.savez(path, **dict(data, **{key: value}))
        with pytest.raises(ValueError, match=error):
            export_test_diagnostics(path, manifest)
