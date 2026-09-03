---
layout: post
title: "An introduction to stablecoin AMMs"
date: 2026-08-21
categories: [Digital finance]
series: "DeFi Microstructure and stablecoin risks"
series_part: 1
description: "How automated market makers price stablecoins, why slippage matters, and how Curve and Uniswap v3 concentrate liquidity near the peg."
---

In this series of blog posts we will explore risk associated with stablecoin depegs, and how they can be mitigated. Specifically we will look into stablecoins *onchain* and show how the unique structure of **Decentralized Finance** (DeFi) influences the stability of these assets, as well as our ability to predict it. 

This first post introduces the necessary concepts, including a focused primer on stablecoins and an introduction to the central trading onject of DeFi, the **AMM**.  


## Stablecoins and depeg risks 

A stablecoin is a crypto-asset which aims to follow the price of another asset, called the **peg**. Usually the peg is chosen as a relatively stable asset such as a fiat currency (most commonly the US Dollar) or a commodity. Stablecoins bring to the blockchain a stable currency to be used as a unit of account, collateral and settlement. Their stability is thus central to the good function of DeFi and the crypto-assets ecosystem as a whole. 

The most common, and least risky, mechanism used by stablecoin issuers in order to ensure stability at peg price is **reserve backing**. It is the method used by both Tether and Circle, issuers of USDC and USDT, the main stablecoins in today's market. Each stablecoin held is issued as a claim to a real dollar, held in the issuer reserves. 



## From order books to onchain pools

Traditional exchanges organise trading through an order book: buyers and sellers state the prices at which they are willing to trade. DeFi made a different design popular. An AMM keeps reserves of two or more assets in a smart contract and quotes a price from a rule.

Liquidity providers (LPs) deposit the reserves and earn a share of trading fees. Traders swap against the pool. Each trade changes the pool's inventory, and the rule turns that new inventory into a new price. There is no market maker standing behind every quote; the market-making rule is part of the contract.

The simplest and most influential rule is the constant-product market maker (CPMM), used by early versions of Uniswap:

\[
x y = k,
\]

where \(x\) and \(y\) are the pool's reserves and \(k\) is fixed by a trade, ignoring fees. The instantaneous price of \(x\) in units of \(y\) is given by the slope of this curve, \(y/x\). When a trader adds \(x\), the pool must release \(y\) so that the product remains unchanged. The more one-sided the pool becomes, the worse the next quote becomes.

## The curve is the market

The invariant is easier to understand as a curve than as an equation. A trade moves the pool from one point on the curve to another. Near the middle, the curve is relatively flat: a small trade changes the reserves and price only a little. Near an edge, it becomes steep: the same trade changes the price much more.

<div class="interactive-placeholder" role="figure" aria-label="Placeholder for an interactive AMM invariant explorer">
  <svg viewBox="0 0 760 330" aria-hidden="true" focusable="false">
    <line class="amm-axis" x1="74" y1="276" x2="704" y2="276" />
    <line class="amm-axis" x1="74" y1="276" x2="74" y2="40" />
    <path class="amm-cpmm" d="M104 59 C126 109 185 183 301 223 C419 264 568 269 692 271" />
    <path class="amm-stableswap" d="M104 52 C124 87 169 170 239 225 C289 264 383 269 504 270 C608 271 661 271 692 271" />
    <path class="amm-v3" d="M258 271 C291 266 311 246 330 218 C352 187 377 160 417 152 C455 145 498 158 537 218 C553 244 574 264 600 271" />
    <circle class="amm-point" cx="387" cy="156" r="8" />
    <line class="amm-guide" x1="387" y1="156" x2="387" y2="276" />
    <text class="amm-label" x="92" y="36">USDT reserve</text>
    <text class="amm-label" x="597" y="310">USDC reserve</text>
    <text class="amm-label amm-cpmm-label" x="535" y="237">CPMM</text>
    <text class="amm-label amm-stableswap-label" x="482" y="126">StableSwap</text>
    <text class="amm-label amm-v3-label" x="327" y="127">v3 range</text>
  </svg>
  <strong>Interactive AMM curve explorer — placeholder</strong>
  <p>Choose a pool invariant, move the trade-size slider, and watch the reserve point move along the curve. The chart will compare the marginal price, average execution price, and price impact for a constant-product pool, a StableSwap pool, and a concentrated-liquidity position.</p>
</div>

Suppose a fee-free pool begins with 1,000 USDC and 1,000 USDT. A trader sends in 100 USDC. The constant-product rule leaves

\[
y' = \frac{1{,}000 \times 1{,}000}{1{,}100} = 909.09
\]

USDT in the pool, so the trader receives 90.91 USDT. The pool began at a 1:1 quote, but the average execution price is 0.9091 USDT per USDC—about 9.1% below it. This difference is **slippage** (or price impact, before fees): the cost created by trading against a finite inventory.

For volatile pairs, that behaviour is useful. A rapidly worsening price discourages a trader from emptying the pool of the asset that has become more valuable. For two tokens that should both be worth one dollar, however, it is expensive friction. A USDC–USDT pool is expected to handle sizeable exchanges near the peg, not to treat a small inventory imbalance like a large change in fundamental value.

## StableSwap: make the middle flatter

Curve's StableSwap invariant was designed for this setting. It combines two limiting ideas:

- **Constant sum**, \(x+y=D\), gives a nearly fixed 1:1 price while the pool is balanced, but offers no meaningful protection once one asset is almost exhausted.
- **Constant product**, \(xy=k\), always keeps a reserve on both sides, but produces more slippage near parity than stablecoin trading needs.

StableSwap interpolates between them. Its amplification parameter \(A\) makes the invariant much flatter around a balanced pool, so similarly priced assets can trade with low slippage. As the pool becomes increasingly imbalanced, the curve bends toward constant-product behaviour and the price moves sharply. The design therefore treats a modest deviation from 50:50 inventory as routine, while still making it costly to drain the pool.

This is a useful way to read a stablecoin AMM. The flat region is not a promise that the assets are equal; it is liquidity deliberately placed behind the assumption that they are *usually* close to equal. A persistent depeg pushes trading out of that region. Liquidity then thins precisely when the market most wants to use it.

## Uniswap v3: put liquidity where it is needed

Uniswap v3 takes another route. Instead of making one invariant flatter for every LP, it lets each LP choose a price interval. Within its chosen interval, a position behaves like a constant-product pool with **virtual reserves**. Outside that interval, it holds only one asset and no longer provides active two-sided liquidity.

For a stablecoin pair, an LP can concentrate capital in a narrow band around $1. A given deposit then supports more trading near the peg than it would if spread across every possible price from zero to infinity. This is why concentrated liquidity can offer very low slippage around the current price.

The trade-off is explicit. Concentrated liquidity is highly effective when the price stays in range, but the range can be left during a dislocation. The LP then becomes one-sided, stops earning swap fees until the price returns, and the aggregate liquidity curve can develop gaps or cliffs. Concentration does not remove the inventory problem; it decides where the pool will absorb it.

## What comes next

StableSwap and concentrated liquidity are two answers to the same question: how should a pool allocate scarce inventory around the prices where trades are expected? The answer shapes normal execution quality, arbitrage during a peg deviation, and the speed at which a local imbalance can turn into a wider depeg.

The next posts use onchain liquidity curves and pool balances to make those mechanisms observable. Before asking whether liquidity warned of a depeg, we need this picture in mind: every swap moves a point on a curve, and the shape of that curve determines how much price movement the market must absorb.
