---
layout: post
title: "Reading the Uniswap v3 liquidity curve"
date: 2026-11-03
categories: [Digital finance]
series: "DeFi Microstructure and stablecoin risks"
series_part: 2
preview_image: /assets/exploration-previews/owner_zones.png
preview_alt: "Active liquidity by pool tick, stacked by liquidity-provider owner"
preview_fit: contain
v3_liquidity_explorers: true
description: "How LP incentives shape USDC/USDT liquidity, why local depth differs from global imbalance, and how five Gegenbauer scores summarize the curve."
---

Two USDC/USDT pools can quote exactly the same price and respond very differently to the next trade. One may absorb selling with little movement; another may sit a small swap away from a sharp price decline. The difference lies in **where liquidity is available**.

In the [previous post]({% post_url 2026-01-29-Stablecoin_onchain_insights %}), we followed a swap through an automated market maker. We now focus on the **USDT/USDC pair on Uniswap v3** and treat its liquidity curve as an observable object: the aggregate result of LP decisions, a map of trading capacity, and a source of information about stablecoin risk.

Throughout, $p$ means **USDT per USDC**. Parity is $p=1$; a falling $p$ means USDC weakens relative to USDT. Selling USDC into the pool pushes $p$ down; selling USDT pushes it up. One basis point (**bp**) is a price change of $0.0001$ from parity. The first three interactive examples use synthetic positions and profiles to isolate the mechanisms. The final explorer uses recorded daily pool snapshots.

## The pool's curve is the sum of its users' positions

An LP in v3 chooses a lower price, an upper price and a liquidity amount $L_i$. The position contributes to trading inside that interval. At a given price, the pool combines the liquidity of every active position:

$$
L(p)=\sum_i L_i\,\mathbf{1}\{p\in[p_{a,i},p_{b,i})\}.
$$

Plot price horizontally and $L(p)$ vertically. Each position is a rectangle over its chosen interval; overlapping rectangles add up. Range boundaries make the aggregate curve step up or down. Its height is **active liquidity**, not the pool's USDC balance, USDT balance or total value locked. The [Uniswap v3 whitepaper](https://app.uniswap.org/whitepaper-v3.pdf) describes how these positions aggregate into a piecewise market maker.

This gives a useful distinction. The price tells us **where the pool currently trades**. The liquidity curve tells us **what trading capacity surrounds that price**. Positions away from the current price are inactive now, but become relevant if a swap moves the price into their range.

### Why LPs concentrate: coverage versus sharpness

For a small swap segment executed at price $p$, the share of the LP fee allocation earned by position $i$ is

$$
\text{fee share}_i(p)=\frac{L_i\,\mathbf{1}\{p\in[p_{a,i},p_{b,i})\}}{L(p)}.
$$

If a swap crosses several ranges, apply this rule to each segment and its active set. Fees are collected in the input token: for example, a 0.01% swap fee on 1 million USDC generates 100 USDC of gross fees. Any protocol allocation is removed before distributing the LP portion; see [Uniswap's fee overview](https://developers.uniswap.org/docs/get-started/concepts/fees). The key mechanism is that **fees reward liquidity in range**. A position outside its interval earns no swap fees, even though its capital remains in the pool. [Uniswap's concentrated-liquidity guide](https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/concentrated-liquidity) explains this active/inactive distinction.

For the **same starting capital**, narrowing a range around the current price generally buys more $L$. Against unchanged competing positions, that increases the LP's effective share of active liquidity and its share of fees while in range. It also reduces the set of prices at which the position can earn them.

{% include v3-fee-explorer.html %}

**Try narrowing the upper bound from +100 to +10 bps while keeping the price at parity.** Your capital stays fixed, but your active share rises. Now move the price to +20 bps: the narrow position stops earning fees, while the wider position would still participate.

LP strategies must balance **coverage**—remaining in range as prices move—and **sharpness**—concentrating enough capital to obtain a meaningful fee share. The optimal balance also depends on trading volume, competing LPs, gas, rebalancing and the cost of accumulating a weakening token. More fee share does not automatically mean more profit. This is the strategic problem studied in [Fan et al., *Strategic Liquidity Provision in Uniswap v3*](https://arxiv.org/abs/2106.12033).

## An endogenous, dynamic and reactive curve

Unlike a pricing rule imposed uniformly on every LP, the shape of $L(p)$ emerges from participants choosing where they are willing to hold inventory and make markets. It is **endogenous**: incentives and beliefs help create the object we observe.

It is also dynamic. LPs add positions, remove them and relocate their ranges as prices, volatility and expected fee income change. Swaps move the current-price marker through the existing profile and change position inventories. Adding or removing positions changes the profile itself. These are different movements, and both matter.

Consider concern about USDC. A position extending below the current price is willing to absorb additional USDC as $p$ falls. An LP who fears a persistent USDC decline may reduce that exposure, pull its lower bound closer, or withdraw. Thin liquidity below the peg can therefore be **consistent with reluctance to accumulate USDC**. Reversing the quote reverses the direction: above-parity prices correspond to USDT weakening relative to USDC.

That is an interpretation, not an identification result. An asymmetric curve may also reflect inventory targets, stale positions, hedging or range-order strategies. Its shape reveals the market-making capacity actually offered, even when the motives behind it remain uncertain. A relative USDC/USDT price also cannot tell us whether both tokens have lost dollar value together.

## Global imbalance misses the neighborhood of the price

One natural summary compares liquidity above and below the peg. For a symmetric price window $[1-h,1+h]$, define

$$
\begin{aligned}
A_-&=\int_{1-h}^{1}L(p)\,dp,\\[4pt]
A_+&=\int_{1}^{1+h}L(p)\,dp,\\[4pt]
I&=\frac{A_+-A_-}{A_++A_-}.
\end{aligned}
$$

Here $I>0$ means more area under the liquidity curve above parity. This is a **window-specific shape imbalance**, not a token-reserve imbalance or a dollar inventory ratio. The window and quote convention must accompany the number.

The summary is useful, but it discards location. Liquidity 80 bps from the peg contributes to $I$, even if the next trade only moves the price by 2 bps. Conversely, equal areas can hide a thin center, a nearby cliff, or opposite skews in the center and tails.

### From the liquidity profile to a swap-impact curve

Let $x$ denote USDC inventory and $y$ USDT inventory. Within a constant-$L$ segment, v3's square-root-price relationships give

$$
dx=-\frac{L(p)}{2p^{3/2}}\,dp,
\qquad
dy=\frac{L(p)}{2\sqrt p}\,dp.
$$

For a USDC sale that takes the price from $p_0$ down to $p_1$, the net input reaching the trading curve is

$$
q_{\mathrm{USDC}}=\int_{p_1}^{p_0}\frac{L(p)}{2p^{3/2}}\,dp.
$$

For a USDT sale moving the price up, the corresponding input is $q_{\mathrm{USDT}}=\int_{p_0}^{p_1}L(p)/(2\sqrt p)\,dp$. These integrals accumulate the liquidity **along the actual trading path**. The explorer evaluates them segment by segment, using the square-root-price equations from the [v3 model](https://app.uniswap.org/whitepaper-v3.pdf).

For an infinitesimal USDC sale at $p_0$, the initial response is

$$
\left.\frac{dp}{dq_{\mathrm{USDC}}}\right|_{0}
=-\frac{2p_0^{3/2}}{L(p_0)}.
$$

This is the **tangent to the swap-impact curve**. Its slope depends on local liquidity at the current price. The slope of $L(p)$ itself is a different quantity: it describes how liquidity changes as the trade moves away, and therefore how the impact curve bends. In the exact stepwise profile, nearby range boundaries play that role; a smoothed profile lets us summarize it with a derivative.

{% include v3-impact-explorer.html %}

Start with **Global imbalance · balanced near peg**. The whole-window imbalance is strongly positive, but the central ±25 bps match the balanced reference. Small swaps have the same impact. Increase the signed input: selling USDC eventually reaches thinner liquidity below the peg, while selling USDT reaches deeper liquidity above it. The price paths then diverge from the reference.

Next choose **Globally balanced · local asymmetry**. Opposing shapes in the center and tails cancel in $I$. Yet trades below and above the peg encounter different depths. Finally choose **Globally balanced · thin at peg**: its zero-input tangent is five times steeper than the reference, despite the same zero imbalance.

To see how that response changes during a trade, choose a **Sweep direction** and press **Sweep swaps**. Input increases at a constant 120,000 tokens per second; the price marker speeds up where liquidity thins. Pause to inspect a point, resume, or reset to parity. Each frame evaluates a larger swap from the same initial pool state, rather than executing a sequence of independent trades. The local-tangent readout reports the instantaneous price sensitivity at the marker.

Now select **Concentrated at peg · thin tails** and sweep again. Most liquidity lies near parity, so the price barely moves through the deep center. Once the swap reaches the tails, equal additions of input produce rapidly increasing price movement. This resembles the flat central response and sharper off-peg impact of [StableSwap](https://docs.curve.finance/protocol/pool/understanding-stableswap/), while still using V3's piecewise liquidity and swap equations here. The profile has the same integrated $L$ as the other examples: the difference comes from where it is placed.

The dashed tangent describes a sufficiently small trade. The blue curve describes a finite one. Its vertical coordinate is the **post-swap marginal price**, not the average execution price paid over the whole trade. The red marker moves with the volume slider on both charts, linking a path through $L(p)$ to its resulting price.

Price, global imbalance and local depth answer different questions. None can be recovered from the others in general.

## Compressing the curve with Gegenbauer polynomials

An entire liquidity profile is informative, but inconvenient to track as hundreds of separate bins. We want a compact description that preserves broad tilt, central concentration and nearby shape changes.

Map a peg-centered window to $u\in[-1,1]$:

$$
u=\frac{p-1}{h}.
$$

Then transform liquidity to reduce its dynamic range, for example $g(u)=\log(1+L(u)/L_{\mathrm{ref}})$, where the positive reference scale is fixed. Approximate that transformed curve with a short expansion:

$$
\begin{aligned}
g(u)&\approx a_0+\sum_{n=1}^{N}a_nB_n(u),\\[6pt]
B_n(u)&=\frac{C_n^{(\lambda)}(u)}{C_n^{(\lambda)}(1)}.
\end{aligned}
$$

The $C_n^{(\lambda)}$ are **Gegenbauer polynomials**. For $\lambda>0$, they are orthogonal on $[-1,1]$ under the weight $w(u)=(1-u^2)^{\lambda-1/2}$. The [NIST definitions](https://dlmf.nist.gov/18.3) and [recurrence relations](https://dlmf.nist.gov/18.9) specify the family. Endpoint normalization here makes the controls easier to compare; it does not make the basis orthonormal.

Given observed bins $u_j$, coefficients can be estimated by weighted least squares:

$$
\widehat{\mathbf a}
=\operatorname*{arg\,min}_{\mathbf a}
\sum_j w_j\left[g(u_j)-\sum_{n=0}^{N}a_nB_n(u_j)\right]^2.
$$

Weights may combine quadrature widths with the Gegenbauer weight. That weight is singular at the endpoints when $\lambda<1/2$, so an implementation must handle endpoints explicitly, for example with an interior grid. The window, transformation, normalization and weighting are part of the definition of a score. They must stay fixed when comparing scores through time.

### What do the first five scores describe?

Odd-degree basis functions reverse sign around the peg; even-degree functions are symmetric. This separates directional structure from symmetric concentration in the **transformed curve**.

| Degree | Broad interpretation |
| --- | --- |
| 0 | Baseline level of transformed liquidity |
| 1 | Broad left–right tilt |
| 2 | Center versus wings |
| 3 | An asymmetric bend beyond a simple tilt |
| 4 | More detailed symmetric shoulders and concentration |
| 5 | Finer asymmetric structure |

These are basis descriptions, not isolated economic factors. Several coefficients can contribute to the local slope. After the inverse transform, coefficients interact nonlinearly in the liquidity curve. An odd score is therefore neither the same quantity as $I$ nor a standalone prediction of a depeg.

{% include v3-polynomial-explorer.html %}

**Start with the flat baseline and change only $a_1$.** The reconstructed curve tilts. Reset, then lower $a_2$: liquidity shifts toward the center relative to the wings. Add $a_3$ or $a_5$ to create asymmetric bends that a broad tilt alone cannot express. The readouts show how liquidity at parity, its local slope and the window imbalance respond.

Use the degree selector to retain only the first one, two or three degrees. Higher-degree controls are excluded until you raise the cutoff again. In this demonstration $a_0=3$ is fixed and the five scores are bounded, so the inverse transform

$$
\widehat L(u)=L_{\mathrm{ref}}\left[\exp\!\left(a_0+\sum_{n=1}^{N}a_nB_n(u)\right)-1\right]
$$

stays positive. A fit to arbitrary real data needs its own nonnegativity checks. The smooth reconstruction also loses fine tick-level boundaries and gaps; exact execution should use the original liquidity profile.

Our [onchain collection code](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/main/update_hourly_liquidity.py) applies polynomial decomposition to liquidity profiles. The controls above teach the basis mechanism with explicitly scaled, endpoint-normalized scores; they are not the numerical coefficients displayed by a production model with different preprocessing. Orthogonal basis functions also do not imply that fitted scores are statistically independent.

## What the curve adds to depeg monitoring

The liquidity curve is the outcome of many choices about where to make a market and which inventory to accept. Its shape can react to changing conditions before a large price move, or change in response to a move already under way.

For USDC/USDT, that gives us several complementary observations: the price's distance from parity; the balance of liquidity across a specified window; the depth and concentration around the peg; the local slope and nearby cliffs around the **current** price; and the price impact of trades of relevant sizes in either direction. A peg-centered polynomial summary helps track the whole shape, while a current-price view tells us what the next swap encounters when the pool has already moved away from parity.

These features describe both **offered capacity** and possible changes in LP willingness to bear risk. They can inform a depeg forecast, but predictive value must be established out of sample: a liquidity withdrawal can precede stress, accompany it or follow it. A snapshot also cannot guarantee that LPs will keep their positions in place during a shock.

The central idea is that **price and imbalance leave information on the table**. The endogenous liquidity curve contains a much richer description of the market's condition. Compressing that shape into a few interpretable scores makes it possible to carry more of that information into risk monitoring, including [AMMonitor]({{ '/depeg-monitor-ida.html' | relative_url }}), while retaining the original profile for local-depth and execution analysis.

## A real example: daily USDC/USDT liquidity

The final explorer replaces the illustrative profiles with **1,768 daily snapshots from 1 January 2022 to 3 November 2026**, taken from the [dated onchain dataset release](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/releases/tag/data-2026-11-03). Each date selects the actual **00:00 UTC** observation. The two panels always refer to the same date and Ethereum block.

The liquidity curve follows the [AMMonitor]({{ '/depeg-monitor-ida.html' | relative_url }}) display: stacked USDC and USDT token-value bars across price bins, with a peg line and an active-bin marker. These bars are a different representation from raw $L(p)$. The accompanying coefficient bars summarize that day's **log active-liquidity profile** using the endpoint-normalized Gegenbauer basis above, with $\lambda=0.4$ and degrees 0–5 fitted jointly. The displayed scores are degrees 1–5; the baseline is omitted. This is a descriptive fit, with no time centering, rather than the monitor's model-feature preprocessing.

{% include v3-daily-history.html %}

**11 March 2023** marks the [USDC depeg following the collapse of Silicon Valley Bank](https://www.federalreserve.gov/econres/notes/feds-notes/in-the-shadow-of-bank-run-lessons-from-the-silicon-valley-bank-failure-and-its-impact-on-stablecoins-20251217.html). Around this date, the curve decomposition captures a change in directional asymmetry: the degree-1 score, an odd-degree component, shifts from positive to negative, alongside the market's shift in preference from USDC toward USDT.

In the next post, we will see how these liquidity-shape signals can be turned into an early-warning model for stablecoin depegs.
