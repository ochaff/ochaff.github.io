import pytest
from prediction_history import prediction_record, merge_history, recent_history


def result(timestamp='2026-11-02T08:00:00Z', probability=.15):
    return dict(timestamp=timestamp,probability=probability,target_threshold_bps=15,
                target_window_hours=24,calibrated=True,alpha=.1,
                monitoring={'mode':'probability_risk_bands'})


def test_saved_scores_are_immutable_deduplicated_and_revisions_retained():
    first=prediction_record(result(),recorded_at='2026-11-02T09:00:00Z')
    history=merge_history({},first)
    same=prediction_record(result(),recorded_at='2026-11-03T09:00:00Z')
    history=merge_history(history,same)
    assert history['records']==[first]
    revised=prediction_record(result(probability=.25))
    history=merge_history(history,revised)
    assert len(history['records'])==2
    assert {r['risk_level'] for r in history['records']}=={'Elevated','High'}
    old=prediction_record(result('2026-10-25T08:00:00Z'))
    future=prediction_record(result('2026-11-03T08:00:00Z'))
    history=merge_history(merge_history(history,old),future)
    week=recent_history(history,result()['timestamp'],revised['id'])
    assert len(week['records'])==2 and week['current_id']==revised['id']
    assert len(history['records'])==4


def test_onset_policy_and_invalid_scores_do_not_enter_monitoring_history():
    bad=result();bad['early_warning']={'method':'NP'}
    with pytest.raises(ValueError):prediction_record(bad)
    for value in [-1,2,float('nan')]:
        with pytest.raises(ValueError):prediction_record(result(probability=value))
