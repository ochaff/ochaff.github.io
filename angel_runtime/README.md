# ANGEL inference runtime

Vendored from QuantLet/onchain-insights revision
303c6399357a00e11897aa30e598bc6f23b6fb45, directory
`[SUPPLEMENT] Pytorch lightning forecasting repo`.

The bundle's strict checkpoint state loading, CPU reference-output fixture and
reconstructed reference-input window are verified before forecasts are used.
The current release records a newer source revision that is not publicly
resolvable; this runtime's compatibility is established numerically, not by
claiming its files match that unavailable revision. Future architecture changes
may require updating this runtime. No training or test logger is invoked.

Local compatibility patches: optional no-date-cutoff filtering, projected
parquet reads, a sentiment HTTP timeout and explicit UTC sentiment sampling.
Frozen liquidity parameters bypass refitting. All 98 reference-input columns
are checked against the bundle after these patches.
