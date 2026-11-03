"""Keep issued RF outputs separate from retrospective hourly model scores."""
from datetime import datetime, timezone
import hashlib
import json
import math
import os

import pandas as pd

from monitor_models import monitoring_level


def hourly_scores(model, features, *, alpha, calibration_end):
    """Score each recent hour with the current fit, separate from issued outputs."""
    end = features.index[-1]
    recent = features.loc[features.index > end - pd.Timedelta(days=7)]
    probabilities = model.predict_proba(recent)[:, 1]
    if any(not math.isfinite(float(p)) or not 0 <= p <= 1 for p in probabilities):
        raise ValueError('Invalid hourly RF probability')
    return {'basis':'retrospective_current_model', 'alpha':alpha,
            'calibration_end':str(calibration_end), 'timestamp':str(end),
            'records':[{'timestamp':str(ts), 'probability':float(p),
                        'risk_level':monitoring_level(float(p))}
                       for ts,p in zip(recent.index,probabilities)]}


def prediction_record(result, *, recorded_at=None, source='workflow', model_reference=None):
    if result.get('early_warning') or result.get('target_threshold_bps') != 15 or result.get('target_window_hours') != 24:
        raise ValueError('Only 24-hour ±15bps monitoring probabilities belong in this archive')
    probability = result['probability']
    if not isinstance(probability, (int,float)) or not math.isfinite(probability) or not 0 <= probability <= 1:
        raise ValueError('Invalid RF probability')
    timestamp = pd.Timestamp(result['timestamp'])
    if timestamp.tzinfo is None:
        raise ValueError('Prediction timestamps must be timezone-aware')
    protocol = ('monitoring_any_breach_v2' if result.get('monitoring', {}).get('mode') == 'probability_risk_bands'
                else 'legacy_monitoring')
    record = {'timestamp':timestamp.tz_convert('UTC').isoformat(), 'probability':probability,
              'risk_level':monitoring_level(probability), 'protocol':protocol, 'alpha':result.get('alpha'),
              'calibrated':bool(result.get('calibrated')), 'source':source,
              'recorded_at':recorded_at or datetime.now(timezone.utc).isoformat(),
              'model_reference':model_reference or os.environ.get('GITHUB_SHA'),
              'workflow_run_id':os.environ.get('GITHUB_RUN_ID')}
    identity = {k:record[k] for k in ['timestamp','probability','protocol','alpha','calibrated']}
    record['id'] = hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()[:24]
    return record


def merge_history(existing, record):
    """Immutable scores; exact reruns deduplicate, changed scores remain revisions."""
    records = {r['id']:r for r in existing.get('records', [])}
    records.setdefault(record['id'],record)
    return {'schema_version':1, 'basis':'saved_run_outputs',
            'records':sorted(records.values(),key=lambda r:(r['timestamp'],r['recorded_at'],r['id']))}


def recent_history(archive, timestamp, current_id, hours=168):
    end = pd.Timestamp(timestamp)
    start = end - pd.Timedelta(hours=hours)
    return {'basis':'saved_run_outputs', 'time_basis':'observation_timestamp', 'window_hours':hours,
            'start':start.isoformat(), 'end':end.isoformat(), 'current_id':current_id,
            'records':[r for r in archive['records'] if start <= pd.Timestamp(r['timestamp']) <= end]}
