"""Shared feature-basis contract for the dashboard's two models."""
import math

DATASET_ALPHA = 0.1


def require_dataset_alpha(value, source):
    if (not isinstance(value, (int, float)) or not math.isfinite(value)
            or not math.isclose(value, DATASET_ALPHA, rel_tol=0, abs_tol=1e-12)):
        raise ValueError(f'{source} must use Gegenbauer alpha={DATASET_ALPHA}; got {value!r}')
