import json

import numpy as np
import pandas as pd
import pytest

from ale import accumulated_local_effects


class AdditiveProbability:
    # Reverse class order verifies we explain class 1 rather than column 1.
    classes_ = np.array([1, 0])

    def predict_proba(self, x):
        p = .4 + .1 * x['signal'].to_numpy() + .05 * x['other'].to_numpy()
        return np.column_stack([p, 1 - p])


def test_linear_ale_matches_known_effect_and_bootstrap_centering():
    index = pd.date_range('2025-01-01', periods=600, freq='h', tz='UTC')
    signal = np.sin(np.arange(600) / 30)
    frame = pd.DataFrame({'signal': signal, 'other': signal ** 2, 'constant': 3.}, index=index)
    result = accumulated_local_effects(AdditiveProbability(), frame,
                                      bootstrap_replicates=120, block_hours=24)
    row = result['features']['signal']
    np.testing.assert_allclose(row['effect'], .1 * (np.array(row['x']) - signal.mean()), atol=1e-14)
    interpolated = np.interp(signal, row['x'], row['effect'])
    assert abs(interpolated.mean()) < 1e-14
    assert row['effective_bins'] == 30
    assert row['ci_status'] == 'ok'
    assert np.all(np.array(row['ci_lower']) < np.array(row['ci_upper']))
    assert sum(row['bin_counts']) == len(frame)
    assert sum(row['distribution']['counts']) == len(frame)
    assert result['features']['constant']['effect'] == [0.]
    assert result['features']['constant']['ci_lower'] == [0.]
    assert result['confidence']['model_refitted'] is False
    assert result['confidence']['coverage'] == 'pointwise_approximate'
    json.dumps(result, allow_nan=False)
    repeated = accumulated_local_effects(AdditiveProbability(), frame,
                                         bootstrap_replicates=120, block_hours=24)
    assert repeated == result


def test_discrete_bins_merge_and_unsupported_bootstrap_bands_are_not_fabricated():
    frame = pd.DataFrame({'signal': np.repeat([0., 1., 2.], 200), 'other': 0.},
                         index=pd.date_range('2025-01-01', periods=600, freq='h'))
    result = accumulated_local_effects(AdditiveProbability(), frame, bootstrap_replicates=100,
                                      block_hours=168)
    row = result['features']['signal']
    assert row['effective_bins'] == 2
    assert min(row['bin_counts']) > 0
    if row['bootstrap_valid_replicates'] < 100:
        assert row['ci_status'] == 'insufficient_bootstrap_support'
        assert all(v is None for v in row['ci_lower'])
    frame.iloc[0, 0] = np.nan
    with pytest.raises(ValueError, match='finite'):
        accumulated_local_effects(AdditiveProbability(), frame)
    frame.iloc[0, 0] = 0
    with pytest.raises(ValueError, match='consecutive'):
        accumulated_local_effects(AdditiveProbability(), frame.drop(frame.index[12]))


def test_ale_uses_conditional_local_neighbourhoods_for_correlated_interaction():
    class Interaction:
        classes_ = np.array([0, 1])

        def predict_proba(self, x):
            p = .2 + .1 * x['signal'].to_numpy() * x['other'].to_numpy()
            return np.column_stack([1 - p, p])
    signal = np.linspace(0, 1, 1200)
    frame = pd.DataFrame({'signal': signal, 'other': signal},
                         index=pd.date_range('2025-01-01', periods=1200, freq='h'))
    result = accumulated_local_effects(Interaction(), frame, bootstrap_replicates=100, block_hours=12)
    row = result['features']['signal']
    edges = np.array(row['bin_edges'])
    ids = np.clip(np.searchsorted(edges, signal, side='left') - 1, 0, len(edges) - 2)
    expected = [.1 * (hi - lo) * signal[ids == i].mean()
                for i, (lo, hi) in enumerate(zip(edges[:-1], edges[1:]))]
    np.testing.assert_allclose(row['local_effect'], expected, atol=1e-14)
