1. Entropy of a proper scoring rule
For a proper scoring rule (S(F,y)) and a predictive distribution (F), the associated entropy is typically defined as
$$
H_S(F) ;=; \mathbb{E}_{Y \sim F}\big[ S(F,Y) \big].
$$

For the log-score (S_{\log}(F,y) = -\log f(y)), this is Shannon (differential) entropy:
$$
H_{\log}(F) = -\mathbb{E}_{Y\sim F}[\log f(Y)].
$$
For the CRPS,
$$
\text{CRPS}(F,y) ;=; \int_{-\infty}^{\infty} \big(F(z) - \mathbf{1}{y \le z}\big)^2 , dz,
$$
a convenient representation (Gneiting & Raftery, 2007) is
$$
\text{CRPS}(F,y)
;=;
\mathbb{E}|X - y| - \tfrac{1}{2}\mathbb{E}|X - X'|,
$$
where $X, X' \stackrel{\text{iid}}{\sim} F$.
2. CRPS entropy in general
Define the CRPS entropy:
$$
H_{\text{CRPS}}(F)
= \mathbb{E}_{Y\sim F}[\text{CRPS}(F,Y)].
$$

Plug in the representation above and let (Y \sim F) be independent of (X, X'):

$$
\begin{aligned}
H_{\text{CRPS}}(F)
&= \mathbb{E}_Y\Big[ \mathbb{E}_X|X - Y| - \tfrac{1}{2}\mathbb{E}|X - X'| \Big] \
&= \mathbb{E}|X - Y| ;-; \tfrac{1}{2}\mathbb{E}|X - X'|.
\end{aligned}
$$

But ((X,Y)) and ((X,X')) are both iid pairs from (F), so
$\mathbb{E}|X - Y| = \mathbb{E}|X - X'|$. Hence

$$
H_{\text{CRPS}}(F)
= \tfrac{1}{2},\mathbb{E}|X - X'|.
$$

So:

The CRPS entropy is half of the Gini mean difference of (F).
For any location–scale family (F_{\mu,\sigma}), it scales linearly with the scale parameter (\sigma).
3. Closed form for Gaussian and dependence on volatility
Let $X, X' \stackrel{\text{iid}}{\sim} \mathcal{N}(\mu, \sigma^2)$. Then
$$
D = X - X' \sim \mathcal{N}(0, 2\sigma^2),
$$
and for (Z \sim \mathcal{N}(0,\tau^2)),
$\mathbb{E}|Z| = \tau \sqrt{\tfrac{2}{\pi}}$.

Thus
$$
\mathbb{E}|X - X'|
= \mathbb{E}|D|
= \sqrt{2\sigma^2} ,\sqrt{\tfrac{2}{\pi}}
= \frac{2\sigma}{\sqrt{\pi}},
$$
and therefore
$$
H_{\text{CRPS}}\big(\mathcal{N}(\mu,\sigma^2)\big)
= \tfrac{1}{2}\mathbb{E}|X - X'|
= \frac{\sigma}{\sqrt{\pi}}.
$$

So:

Closed form for Gaussian CRPS entropy: $H_{\text{CRPS}} = \frac{\sigma}{\sqrt{\pi}}. $
Dependence on volatility: it is linear in the standard deviation (\sigma).
Contrast with the log-score entropy for $\mathcal{N}(\mu,\sigma^2)$:
$$
H_{\log} = \tfrac{1}{2}\log(2\pi e \sigma^2),
$$
which is logarithmic in (\sigma).

4. Implication for weighting in reconciliation
If you use the CRPS entropy as an uncertainty measure for node (h) with predictive variance (\sigma_h^2), then under Gaussian assumptions:

$$
H_{\text{CRPS},h} = \frac{\sigma_h}{\sqrt{\pi}}.
$$

So:

Any weight based on $H_{\text{CRPS},h}$ (e.g., (w_h \propto 1/H_{\text{CRPS},h})) will behave like (w_h \propto 1/\sigma_h),
Whereas a variance-based weight would be (w_h \propto 1/\sigma_h^2),
And a Shannon-entropy-based measure changes only logarithmically with (\sigma_h).
This difference in scaling is important when choosing CRPS-based weights for hierarchical time series reconciliation.