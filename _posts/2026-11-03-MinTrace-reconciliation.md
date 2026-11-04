---
layout: post
title: "MinTrace: choosing the right projection"
date: 2026-11-03
categories: [Time series]
series: "The hidden structure in hierarchical time series"
series_part: 2
preview_image: /assets/exploration-previews/mint-projection.svg
preview_alt: "OLS and covariance-weighted forecasts landing at different points on a coherent plane"
preview_fit: contain
description: "From OLS to MinTrace: explore how error variances, correlations and sample size change the projection onto a coherent hierarchy."
mint_explorers: true
---

In the [first post]({% post_url 2025-10-30-HTS-visualization %}), we saw a hierarchy become a geometric constraint. If $z=x+y$, coherent forecasts lie on a plane. Independently generated forecasts can leave that plane; reconciliation brings them back.

But **where on the plane should they land?** The shortest path treats every forecast as equally trustworthy. A total with a large forecast-error variance then has just as much influence as a much more precise bottom series. Coherence alone does not settle how to share the correction.

MinTrace, usually abbreviated **MinT**, chooses the projection using the covariance of the base forecast errors. To understand it, we will move from equal weights, to unequal variances, to correlated errors—and then ask how much covariance we can realistically estimate.

## Why the closest point can be a poor forecast

The unweighted perpendicular projection illustrated as GTOP in Part 1 is **OLS reconciliation** in this Euclidean setup. It minimises the sum of squared adjustments to the base forecasts. That is a useful geometric baseline, but it ignores which forecasts are noisy.

Suppose the true future values are $(z,x,y)=(7,4,3)$, while the base forecasts are $(19,4,3)$. The total is wrong by 12; the two bottom forecasts happen to be correct. OLS spreads the mismatch equally across the three coordinates:

| | Total $z$ | Bottom $x$ | Bottom $y$ |
|---|---:|---:|---:|
| Base forecasts | 19 | 4 | 3 |
| OLS reconciliation | 15 | 8 | 7 |
| WLS with error variances $(100,1,1)$ | 7.235 | 4.118 | 3.118 |

OLS makes the forecasts coherent, but moves both accurate bottom forecasts by 4. **WLS** penalises adjustments relative to each series' error variance: moving a noisy total is cheaper than moving a precise bottom forecast. Most of the correction therefore goes to $z$.

This example does not mean OLS always performs poorly. When forecast errors have equal variances and are uncorrelated, its metric is appropriate. It also guarantees that projection cannot increase the *all-node Euclidean squared error* against a coherent truth. In the example, that total error falls from 144 to 48—even though bottom-level error rises from 0 to 32. The choice of metric and evaluation targets matters.

**GLS** takes the next step. Two forecasts with correlated errors are not two independent sources of evidence. Variances tell us their individual precision; covariances tell us how much information they share. The MinT construction uses both. See the [original MinT paper](https://robjhyndman.com/papers/mint.pdf) for the optimal reconciliation result.

## One projection, two operations

Let $m$ be the number of bottom series and $N$ the number of all series, including aggregates. At a fixed forecast horizon, write

$$
\mathbf y=\mathbf S\mathbf b,
\qquad
\hat{\mathbf y}=\mathbf S\mathbf b+\boldsymbol\varepsilon,
\qquad
\mathbb E[\boldsymbol\varepsilon]=0,
\qquad
\operatorname{Cov}(\boldsymbol\varepsilon)=\mathbf W.
$$

Here $\mathbf S$ is the known, full-column-rank summing matrix. For our three-series example, with the total listed first,

$$
\mathbf S=\begin{pmatrix}1&1\\1&0\\0&1\end{pmatrix},
\qquad
\mathbf b=\begin{pmatrix}x\\y\end{pmatrix},
\qquad
\mathbf y=\begin{pmatrix}z\\x\\y\end{pmatrix}.
$$

Every coherent vector is determined by its bottom coordinates. A linear reconciler can therefore be written as

$$
\hat{\mathbf y}
\;\xrightarrow{\quad\mathbf G\quad}\;
\tilde{\mathbf b}
\;\xrightarrow{\quad\mathbf S\quad}\;
\tilde{\mathbf y},
\qquad
\tilde{\mathbf b}=\mathbf G\hat{\mathbf y},
\quad
\tilde{\mathbf y}=\mathbf S\mathbf G\hat{\mathbf y}.
$$

The statistical work happens in $\mathbf G$: it combines the base forecasts to estimate the bottom series. Multiplication by $\mathbf S$ then propagates those estimates through the hierarchy. This is the sense in which the accuracy gain is earned at the bottom-coordinate estimation step.

There is a small but important distinction: **$\mathbf G$ is a rectangular estimator; $\mathbf P=\mathbf S\mathbf G$ is the projection.** The projection lands on the coherent subspace, not on the coordinate plane obtained by deleting the aggregates. If $\mathbf G\mathbf S=\mathbf I_m$, then $\mathbf P^2=\mathbf P$ and already-coherent forecasts stay unchanged.

For a positive-definite covariance $\mathbf W$, estimate the bottom coordinates by generalised least squares:

$$
\tilde{\mathbf b}
=\underset{\mathbf u\in\mathbb R^m}{\arg\min}\;
(\hat{\mathbf y}-\mathbf S\mathbf u)^\top\mathbf W^{-1}
(\hat{\mathbf y}-\mathbf S\mathbf u).
$$

The normal equations give

$$
\boxed{\quad
\mathbf G_\star=(\mathbf S^\top\mathbf W^{-1}\mathbf S)^{-1}
\mathbf S^\top\mathbf W^{-1},
\qquad
\mathbf P_\star=\mathbf S\mathbf G_\star.
\quad}
$$

With $\mathbf W=\mathbf I$, this is OLS. With diagonal $\mathbf W$, it is variance-weighted WLS. With the full forecast-error covariance, it is GLS and the oracle MinT reconciler. A common positive scalar multiplying $\mathbf W$ cancels from $\mathbf G$.

{% include mint-projection.html %}

For this particular plane, there is an especially transparent formula. Set $\mathbf c=(1,-1,-1)^\top$, so the base mismatch is $\delta=\mathbf c^\top\hat{\mathbf y}=\hat z-\hat x-\hat y$. Then

$$
\tilde{\mathbf y}
=\hat{\mathbf y}-\frac{\mathbf W\mathbf c}{\mathbf c^\top\mathbf W\mathbf c}\,\delta.
$$

OLS corrects in direction $\mathbf c$, perpendicular to the plane in ordinary Euclidean geometry. WLS and GLS correct in direction $\mathbf W\mathbf c$. They are perpendicular under the $\mathbf W^{-1}$ metric, so their paths can look oblique in the original coordinates. This is the [geometric view of reconciliation](https://robjhyndman.com/publications/hierarchical-geometry/): the constraint stays fixed while the metric changes the landing point.

In the correlated-error preset, GLS can even give a negative weight to a base forecast. Such a weight can subtract a shared error component; it does not represent a negative share of the hierarchy.

## What “minimum trace” actually guarantees

We have a weighted projection. Why is it an accuracy-optimal one?

Under the unbiased-error model above, the reconciled bottom error is $\mathbf G\boldsymbol\varepsilon$, with covariance $\mathbf G\mathbf W\mathbf G^\top$. For the GLS estimator,

$$
\mathbf V_\star
=\mathbf G_\star\mathbf W\mathbf G_\star^\top
=(\mathbf S^\top\mathbf W^{-1}\mathbf S)^{-1}.
$$

Now take any other linear estimator preserving unbiasedness, $\mathbf G\mathbf S=\mathbf I_m$. Write it as $\mathbf G=\mathbf G_\star+\mathbf D$, so $\mathbf D\mathbf S=0$. Expanding its error covariance gives

$$
\mathbf G\mathbf W\mathbf G^\top
=\mathbf V_\star+\mathbf D\mathbf W\mathbf D^\top.
$$

The cross terms vanish because $\mathbf G_\star\mathbf W=\mathbf V_\star\mathbf S^\top$. The extra term is positive semidefinite: every linear combination of bottom errors has variance at least as large as under GLS.

This is stronger than minimising one trace. In particular, GLS minimises **bottom-level MSE**,

$$
\mathbb E\|\tilde{\mathbf b}-\mathbf b\|^2
=\operatorname{tr}(\mathbf G\mathbf W\mathbf G^\top).
$$

It also minimises MSE for any fixed linear reporting target $\mathbf R\mathbf b$, since its covariance is

$$
\mathbf R\mathbf V_\star\mathbf R^\top
+\mathbf R\mathbf D\mathbf W\mathbf D^\top\mathbf R^\top.
$$

Choosing $\mathbf R=\mathbf S$ recovers the all-node trace criterion that gives MinTrace its name. Choosing another fixed summing matrix gives the same conclusion for another reporting hierarchy over these same bottom series. The input forecasts, their covariance, and the admissible estimators remain fixed in this comparison.

The guarantee is **expected squared error, among linear unbiased estimators, using the true covariance**. It does not say that every realised forecast improves, or that replacing $\mathbf W$ with a noisy estimate preserves optimality. Bias in the base forecasts also needs attention rather than being removed automatically by reconciliation.

## Aggregates help by correcting bottom forecasts

Partition the summing matrix and base forecasts into aggregate and bottom blocks:

$$
\mathbf S=\begin{pmatrix}\mathbf A\\\mathbf I_m\end{pmatrix},
\qquad
\hat{\mathbf y}=\begin{pmatrix}\hat{\mathbf a}\\\hat{\mathbf b}\end{pmatrix},
\qquad
\mathbf G=\begin{pmatrix}\mathbf K&\mathbf G_b\end{pmatrix}.
$$

Because $\mathbf G\mathbf S=\mathbf I_m$, we have $\mathbf G_b=\mathbf I_m-\mathbf K\mathbf A$. Therefore

$$
\boxed{\qquad
\tilde{\mathbf b}
=\hat{\mathbf b}
+\mathbf K\underbrace{(\hat{\mathbf a}-\mathbf A\hat{\mathbf b})}_{\text{incoherence}}.
\qquad}
$$

The aggregates contribute through their disagreement with what the bottom forecasts imply. If every base forecast is already coherent, that correction is zero. Otherwise, the covariance tells the reconciler how much of the mismatch is informative about bottom forecast errors.

This explains why forecasting an aggregate separately can help: its model may capture a pattern that is hard to estimate in each individual series. But an aggregate forecast can also repeat errors already present in the bottoms. GLS uses the cross-covariances to distinguish shared noise from useful additional evidence.

## Estimating the metric: the $N/T$ regime

In practice, $\mathbf W$ is unknown. Let $T$ now denote the number of aligned residual vectors available to estimate the $N\times N$ forecast-error covariance. A centred sample estimate is

$$
\hat{\mathbf W}
=\frac{1}{T-1}\sum_{t=1}^{T}
(\mathbf e_t-\bar{\mathbf e})(\mathbf e_t-\bar{\mathbf e})^\top.
$$

There are $N(N+1)/2$ distinct covariance entries, and the sample matrix has rank at most $\min(N,T-1)$. When $N\ge T$, it is singular. Even when invertible, an estimate close to singularity can make the projection sensitive to sampling noise.

Three common choices retain different amounts of information:

| Covariance used for reconciliation | Information retained | Main trade-off |
|---|---|---|
| Sample $\hat{\mathbf W}$ | Variances and all estimated covariances | Rich metric, but potentially noisy or singular |
| Shrunk $(1-\alpha)\hat{\mathbf W}+\alpha\operatorname{diag}(\hat{\mathbf W})$ | Variances, with damped off-diagonal covariances | More stable, at the cost of attenuating genuine correlations |
| WLS $\operatorname{diag}(\hat{\mathbf W})$ | Individual error variances | Estimates fewer quantities, but discards cross-series error dependence |

At $\alpha=0$, shrinkage gives the sample estimate; at $\alpha=1$, it gives variance-scaled WLS. With positive sample variances, any $\alpha>0$ makes this diagonal-target shrinkage estimate positive definite. These are standard practical approximations described in [Forecasting: Principles and Practice](https://otexts.com/fpp3/hierarchical-forecasting.html#the-mint-optimal-reconciliation-approach).

{% include mint-regime.html %}

When $N/T$ is small, there is more scope to estimate correlations reliably. When it is large, shrinkage or WLS can sacrifice some covariance detail to reduce estimation error. **$N/T$ is a diagnostic, not a universal switching rule:** correlation strength, covariance structure and the effective number of independent residuals also matter. A short sample does not automatically make WLS best, and a long sample does not make every covariance estimate reliable.

The experiment uses independent synthetic errors so that its expected risk is known. For real forecasts, estimate errors at the intended horizon where possible and compare reconcilers with rolling-origin evaluation. One-step residuals are often used with the simplifying assumption $\mathbf W_h=k_h\mathbf W_1$; this assumes the covariance shape is stable across horizons. Serially dependent or overlapping forecast errors also provide less information than the raw residual count suggests. Choose shrinkage from the training data or validation, keeping the final evaluation period separate.

## From reconciliation to hierarchy design

For a fixed hierarchy, MinT asks how to combine the available base forecasts. The useful perspective is that $\mathbf S$ acts as a design matrix, each aggregate forecast is a noisy measurement of a combination of bottom series, and $\mathbf G$ estimates the bottom coordinates from those measurements.

That prepares a different question: **which aggregates should we forecast in the first place?** Changing the hierarchy changes the measurements available to GLS—and the size of the covariance matrix we must estimate. An aggregate can offer a useful forecasting signal while also increasing the statistical burden of reconciliation.

The next post will explore **hierarchical morphology search** through this lens. We will keep the bottom series and evaluation targets fixed while changing the aggregate structure. That common yardstick matters: comparing the total error over different, changing lists of nodes would mix a change in forecast quality with a change in what is being scored.

The foundation is now in place: estimate bottom coordinates, reaggregate coherently, and distinguish the information offered by an aggregate from the information a finite-sample reconciler can use.
