---
layout: post
title: "An introduction to stablecoin AMMs"
date: 2026-08-21
categories: [Digital finance]
series: "DeFi Microstructure and stablecoin risks"
series_part: 1
preview_image: /assets/exploration-previews/invariant_with_slippage.png
preview_alt: "Constant-product invariant showing a swap and its price impact"
preview_fit: contain
amm_explorers: true
description: "Explore how constant-product pools, Curve StableSwap and Uniswap concentrated liquidity turn inventory into prices—and what happens when a stablecoin leaves its peg."
---

A stablecoin is meant to trade close to a reference value, or **peg**. For USDC and USDT, that reference is one US dollar. Yet a shared target does not make the two tokens interchangeable at every moment. Their market prices can diverge, and exchanging one for the other can itself move the price.

This series studies stablecoin risk through the structure of onchain markets. We start with the trading mechanism: how does a pool decide how much USDT to give someone selling USDC? The interactive examples below connect that question to liquidity, slippage and depeg risk.

## Trading against a pool

Automated market makers (**AMMs**) are a primary trading mechanism in decentralized finance (**DeFi**). Instead of matching a buyer's order with a seller's order in an order book, an AMM lets a trader exchange tokens against reserves held in a smart contract. Liquidity providers (**LPs**) supply those reserves; the contract applies a pricing rule, and swaps generate trading fees. A pool's inventory changes with every trade, so its next quote changes too. [Uniswap's protocol overview](https://developers.uniswap.org/docs/get-started/concepts/how-uniswap-works) describes this pool-based market structure.

Imagine a pool containing 1,000 USDC and 1,000 USDT. Selling USDC to it adds USDC to the pool and removes USDT. The pricing rule must determine both how much USDT the trader receives and the price offered to the next trader. That rule can be drawn as a **reserve curve**: each point is an allowed combination of the two token balances.

Throughout this post, $x$ is the USDC reserve, $y$ the USDT reserve, and prices are **USDT per USDC**. Selling USDC moves right and down along a reserve curve. Its negative slope, $-dy/dx$, gives the marginal price: the output from a very small additional sale.

## 1. Constant product: inventory moves the price

The constant-product rule, familiar from Uniswap v2, is

$$
xy=k.
$$

Ignoring fees, the product stays fixed during a swap. With initial reserves $x_0=y_0=1{,}000$, we have $k=1{,}000{,}000$. After a trader sells $\Delta x$ USDC, the remaining USDT reserve is $y_1=k/(x_0+\Delta x)$. The trader receives $y_0-y_1$; the next marginal quote is $y_1/(x_0+\Delta x)$. Fees modify this accounting in the deployed protocol; the [Uniswap v2 whitepaper](https://app.uniswap.org/whitepaper.pdf) sets out its design.

{% include amm-explorer.html kind="cpmm" number="01" title="Constant product · follow a swap" %}

**Try selling 100 USDC.** The remaining USDT reserve is 909.09, so the trader receives **90.91 USDT**. The average execution price is about **0.909091 USDT per USDC**, while the next marginal quote has already fallen to **0.826446**. The average is better than the final quote because earlier portions of the trade executed against a less imbalanced pool.

The explorer starts at the blue marker and ends at the red marker. Increase the trade size to see the reserve movement, then choose **Marginal price (bps)** to see how the next quote changes. A basis point (**bp**) is 0.01 percentage points; a price of 0.999 USDT per USDC is 10 bps below parity.

### Why this is costly for pegged assets

Relative to the initial 1:1 quote, that 100-USDC swap loses about **909 bps** in average execution price. This is **price impact**: the deterioration caused by the trade consuming finite liquidity. “Slippage” is also used more broadly for the difference between an expected quote and actual execution, including price changes while a transaction waits. Here we isolate the mechanical price impact and omit fees and gas.

For assets expected to stay near parity, such a large movement is expensive. A deeper constant-product pool would help: selling 100 into reserves of 100,000 each has the same proportional impact as selling 1 into reserves of 1,000 each. But that requires more capital. Stablecoin-oriented designs instead make a given amount of capital support more trading near the peg.

## 2. StableSwap: change the curvature near parity

A constant-sum rule, $x+y=D$, would exchange equal token units at 1:1 until one reserve ran out. Constant product avoids complete depletion at any finite trade size, but its price changes quickly. **Curve StableSwap** combines these behaviours: a nearly constant exchange rate around balanced reserves, with increasing price movement as the pool becomes severely imbalanced. Its amplification parameter $A$ controls the concentration. [Curve's explanation of StableSwap](https://docs.curve.finance/protocol/pool/understanding-stableswap/) describes this trade-off.

{% include amm-explorer.html kind="stable" number="02" title="StableSwap · change the amplification" %}

**Keep the trade at 100 USDC and increase $A$.** The output moves closer to 100 USDT and the price impact falls. Now move the slider toward 1,200 USDC. The reserve curve bends more sharply as USDT becomes scarce: near-parity execution has a finite inventory behind it. In the price view, use the legend to turn on the constant-product comparison.

For readers who want the equation, the two-token version used here is

$$
4A(x+y)+D=4AD+\frac{D^3}{4xy}.
$$

The starting balanced reserves fix $D=2{,}000$. Each trade holds $D$ constant and solves for the new $y$. This is the $n=2$ case of the invariant in the [StableSwap whitepaper](https://docs.curve.finance/assets/files/whitepaper_stableswap-fc0bb370db9fe3a91afdde8662e78206.pdf), using its $A n^n$ convention. Numerical amplification settings are not directly interchangeable across implementations with different parameter scaling.

A flatter price response does not establish that the tokens have equal value. It allocates inventory around that assumption. If traders persistently sell one token, the pool accumulates it while the other reserve falls. A low-impact exchange can therefore become increasingly one-sided before its price visibly moves far from parity.

## 3. Concentrated liquidity: choose where capital trades

Uniswap v3 takes a different approach: each LP chooses a **price interval**. Within it, the position behaves like a constant-product market maker with larger *virtual* reserves. Capital need only cover that interval. When its price reaches a boundary, the position is entirely in one token and stops providing active liquidity beyond that boundary. Multiple overlapping positions form the pool's aggregate liquidity. See the [Uniswap concentrated-liquidity guide](https://developers.uniswap.org/docs/get-started/concepts/liquidity-providers/concentrated-liquidity).

{% include amm-explorer.html kind="v3" number="03" title="Concentrated liquidity · explore a range" %}

**Compare a narrow and a wide range at the same trade size.** Both begin with exactly 1,000 USDC and 1,000 USDT. The narrower range produces less price movement, because those reserves support a smaller set of prices. Next, sell 1,200 USDC: the position runs out of USDT before filling the whole request. The explorer reports the filled and unfilled amounts rather than extending the curve beyond the position's inventory.

For a position active between $p_a$ and $p_b$, the reserve relationship is

$$
\left(x+\frac{L}{\sqrt{p_b}}\right)
\left(y+L\sqrt{p_a}\right)=L^2,
$$

where $L$ measures liquidity. The [Uniswap v3 whitepaper](https://app.uniswap.org/whitepaper-v3.pdf) derives this shifted constant-product curve. The explorer uses reciprocal bounds, $p_a=1/p_b$, so equal initial token balances correspond to a starting price of one. It uses continuous prices to explain the mechanism; deployed positions use discrete ticks.

A real pool can keep trading through other active positions after one position ends. If many LPs choose similar bounds, however, active liquidity can fall sharply near those bounds. The next trade then moves the price more. Narrow ranges improve execution inside the range while making the placement of its boundaries consequential.

### From individual positions to the pool's liquidity curve

Each position is a small constant-product market maker that operates over its chosen interval. At any price, the pool combines the liquidity of **all positions whose ranges contain that price**. Plotting that sum against price gives the pool's active-liquidity curve: the quantity $L$ changes in steps as positions enter or leave the active set. This is the liquidity distribution illustrated in Figure 3 of the [Uniswap v3 whitepaper](https://app.uniswap.org/whitepaper-v3.pdf).

{% include amm-liquidity.html %}

**Start at parity.** User A, User C and User D overlap, so their liquidity adds up to 11.5 units. Move the price marker away from the peg: User D's narrow position drops out, while other LPs cover more distant prices. Untick User A's broad position and inspect prices beyond ±60 bps to expose gaps in the remaining coverage. The colored layers show individual contributions; the dark outline is their sum.

The horizontal axis here is **price**, rather than the USDC reserve used in the preceding explorer. Height measures active $L$, rather than token inventory or dollar depth. Between successive range boundaries, the active positions trade together as a constant-product segment with their combined liquidity. Crossing a boundary changes that liquidity, creating a new segment. More overlapping $L$ near a given price means less price movement for a small additional swap there.

The [next post]({% post_url 2026-11-03-Uniswap-V3-liquidity-curve %}) examines this liquidity curve in more detail: how LP incentives shape it, why local depth differs from global imbalance, and how a polynomial decomposition summarizes its shape for stablecoin risk monitoring.

## Three ways to allocate inventory

<div class="amm-comparison" markdown="1">

| Design | Where liquidity is useful | What to watch during a dislocation |
| --- | --- | --- |
| Constant product | Across the full positive price range | Price impact rises with trade size relative to reserves |
| StableSwap | Concentrated near parity by the invariant | Reserve imbalance can build before prices move sharply |
| Concentrated liquidity | Inside price intervals selected by LPs | Active liquidity can drop at range boundaries |

</div>

The examples hold the starting token inventory constant. They demonstrate **capital efficiency near the peg**, rather than a way to eliminate the cost of an asset losing value. Real execution also depends on fees, other pools, arbitrage and liquidity withdrawals.

Arbitrage links a pool's quote to prices elsewhere: buying the relatively cheap token in one venue and selling it in another changes pool inventory. That can restore a local price discrepancy. If the asset's broader market value has fallen, the same trading instead pushes the pool toward the new price; the invariant cannot guarantee redemption or restore the peg.

This is why price alone is an incomplete view of stablecoin risk. Reserve balances, the shape of liquidity around the current price, and the location of liquidity boundaries all help explain how much selling a market can absorb. The next posts turn these mechanisms into observable onchain features. [AMMonitor]({{ '/depeg-monitor-ida.html' | relative_url }}) brings those features together with a depeg probability and a distribution forecast for USDC/USDT. A relative price identifies pressure between the tokens; it cannot establish their individual dollar values if both move together.
