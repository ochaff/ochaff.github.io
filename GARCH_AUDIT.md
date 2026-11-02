# GARCH forecast audit — 2 November 2026

The previous fan's abrupt narrowing was primarily a property of the fitted
AR(1)-GARCH simulation and its central quantiles, not a comparable collapse in
expected conditional variance. It was also a different forecasting
specification from QuantLet's current probabilistic-forecast benchmark.

## Previous export

The old fit used 8,760 hourly signed depeg observations, an AR(1) mean, and
100,000 recursive Student-t paths with seed 42. Its parameters were:

| Parameter | Value |
| --- | ---: |
| Mean intercept | 3.706948 |
| AR(1) | 0.346569 |
| omega | 0.006890 |
| alpha | 0.960139 |
| beta | 0.022967 |
| Student-t nu | 18.816806 |

The conditional variance put about 96% weight on the latest squared shock and
only 2.3% on prior variance. Most simulated paths quickly entered low-volatility
states; rare paths carried substantial variance. A central quantile interval
does not measure the same object as expected conditional standard deviation.

Replaying the published parameters on the matching release gives:

| Forecast hour | Simulated 1%–99% width (bps) | Analytical standard deviation (bps) |
| --- | ---: | ---: |
| 1 | 10.074 | 2.109 |
| 3 | 13.750 | 2.214 |
| 6 | 10.056 | 2.166 |
| 12 | 2.861 | 2.069 |
| 24 | 1.415 | 1.891 |

The sampled hour-24 variance was about 0.261 bps² versus analytical variance
3.574 bps². This discrepancy illustrates unstable sampling of rare paths in
this highly shock-driven fit. It does not by itself prove a recursion bug, nor
does it imply every simulated quantile is biased by the same amount. The
plotted fan was not a reliable visual proxy for expected volatility.

## Alignment with the reference

Source inspected: [QuantLet benchmark 12, GARCH_forecast.py](https://github.com/QuantLet/onchain-insights/blob/303c6399357a00e11897aa30e598bc6f23b6fb45/12.%20Evaluation%20of%20Probabilistic%20Forecasts/benchmark_scripts/GARCH_forecast.py),
revision `303c6399357a00e11897aa30e598bc6f23b6fb45`.

| Choice | Previous dashboard | Aligned dashboard / reference |
| --- | --- | --- |
| Input | Signed hourly depeg bps | Same; levels, not returns |
| Mean | AR(1) | Constant |
| Variance / innovations | GARCH(1,1), standardized Student-t | Same |
| Fit history | Latest year | Expanding available history |
| Scaling | rescale=False | rescale=False, scale=1 |
| Forecast variance | Recursive simulation | Analytical |
| Displayed quantiles | Empirical simulated outcomes | Standardized Student-t quantiles scaled by analytical sigma |

The monitor refits once per live job. The reference performs rolling holdout
evaluation, fixing parameters between refits; its checked-in invocation uses
20,000-origin chunks, despite a comment describing daily refitting. Reusing
that retrospective cadence would leave a live fit stale, so it is not copied.

Internal missing historical hours are forward-filled for GARCH only, keeping
the hourly grid and expanding sample. The new fit contains five such hours.
The origin must be observed. The Random Forest's missing-price censoring and
the observed chart remain unchanged.

## Current fit and limits

At origin **2026-11-02 08:00 UTC**, the model uses **42,393** hours starting
2022-01-01. Optimization converged with:

| Parameter | Value |
| --- | ---: |
| mu (bps) | −0.574359 |
| omega | 0.051130 |
| alpha | 0.849934 |
| beta | 0.150066 |
| Student-t nu | 247.578620 |
| alpha + beta | 0.9999999913 |

Analytical sigma rises gently from **9.4579** to **9.5199 bps** across hours
1–24. Terminal USDC 1% VaR / ES are **22.7750 / 26.0606 bps**; USDT values
are **21.6262 / 24.9119 bps**, so the token at risk is USDC. The current
forecast is wider than the previous simulated central fan because both the
fit specification/history and marginal forecast method changed.

The fitted variance is effectively integrated, not safely far inside the
stationary region. No finite long-run variance is advertised. The large
estimated nu means innovations are close to Gaussian in this run. A constant
mean centers future medians at the historical fitted mean; it does not track
the latest price through an AR term.

For multiple steps, the true predictive distribution is a mixture over future
conditional variances. QuantLet's scaled Student-t marginals approximate that
mixture. Alignment does not demonstrate empirical 98% interval coverage;
that requires a separate rolling out-of-sample calibration assessment. Expected
variance can increase or decrease depending on its starting state: no forced
fan widening or cosmetic smoothing has been added.

The ES extension uses analytical tail integrals of the same marginal
approximation. Tests compare clipped token-loss ES with numerical integration,
including cases where VaR is zero but ES is positive, and verify the GARCH
variance recursion and standardized quantiles. See also the
[arch forecasting documentation](https://arch.readthedocs.io/en/latest/univariate/forecasting.html).
