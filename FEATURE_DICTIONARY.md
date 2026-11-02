# AMMonitor feature dictionary

Definitions follow the enabled collection and preprocessing calculations. There are 50 forest predictors plus the raw signed depeg measure (not a forest predictor).

Collection source revision: `5301eb5c5b767329a0ed08c5bed68296b00f0fcb`. Preprocessing audited at `a8422954fbfb38c482fd638a32313bf1f1365989` (`build_dataset.py`).

Model imputation is separate: causal forward fill followed by training-period medians. Histograms describe the preceding 90 days, excluding the current row. Local SHAP explains the base forest score before calibration.

## tvlUSD_100

**Uniswap TVL (1 bp pool)** — Total value locked in the USDC/USDT Uniswap v3 1 bp fee pool.

Units: USD. Formula: `poolHourData.tvlUSD`.

Hourly subgraph snapshot; the last source row is excluded by preprocessing.

Collection: [update_uniswap_metrics.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_uniswap_metrics.py). Preprocessing: `build_dataset.py::load_uniswap_metrics`.

## net_amountUSD_100

**Uniswap swap notional (1 bp pool)** — Sum of reported USD swap amounts in the hour for the USDC/USDT Uniswap v3 1 bp fee pool.

Units: USD/hour. Formula: `sum(swap.amountUSD)`.

Despite the legacy net_amountUSD name, no buy/sell sign is applied. This is swap notional, not signed net flow. The 5 bp series is forward-filled in preprocessing.

Collection: [update_uniswap_metrics.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_uniswap_metrics.py). Preprocessing: `build_dataset.py::load_uniswap_metrics`.

## net_amount0

**Uniswap net USDC flow (1 bp pool)** — Signed sum of token0 (USDC) swap deltas from the pool perspective in the hour.

Units: USDC/hour. Formula: `sum(swap.amount0)`.

Positive means USDC enters the pool; negative means it leaves. Only the 1 bp pool is included.

Collection: [update_uniswap_metrics.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_uniswap_metrics.py). Preprocessing: `build_dataset.py::load_uniswap_metrics`.

## swap_count_100

**Uniswap swaps (1 bp pool)** — Number of swaps in the hour for the USDC/USDT Uniswap v3 1 bp fee pool.

Units: swaps/hour. Formula: `count(swap events in hour)`.

Collection: [update_uniswap_metrics.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_uniswap_metrics.py). Preprocessing: `build_dataset.py::load_uniswap_metrics`.

## swap_count_500

**Uniswap swaps (5 bp pool)** — Number of swaps in the hour for the USDC/USDT Uniswap v3 5 bp fee pool.

Units: swaps/hour. Formula: `count(swap events in hour)`.

Collection: [update_uniswap_metrics.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_uniswap_metrics.py). Preprocessing: `build_dataset.py::load_uniswap_metrics`.

## net_amountUSD_500

**Uniswap swap notional (5 bp pool)** — Sum of reported USD swap amounts in the hour for the USDC/USDT Uniswap v3 5 bp fee pool.

Units: USD/hour. Formula: `sum(swap.amountUSD)`.

Despite the legacy net_amountUSD name, no buy/sell sign is applied. This is swap notional, not signed net flow. The 5 bp series is forward-filled in preprocessing.

Collection: [update_uniswap_metrics.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_uniswap_metrics.py). Preprocessing: `build_dataset.py::load_uniswap_metrics`.

## tvlUSD_500

**Uniswap TVL (5 bp pool)** — Total value locked in the USDC/USDT Uniswap v3 5 bp fee pool.

Units: USD. Formula: `poolHourData.tvlUSD`.

Hourly subgraph snapshot; the last source row is excluded by preprocessing.

Collection: [update_uniswap_metrics.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_uniswap_metrics.py). Preprocessing: `build_dataset.py::load_uniswap_metrics`.

## supplied_USD_usdt

**Aave USDT supplied** — USDT supplied balance in USD in the selected Ethereum Aave version.

Units: USD. Formula: `supplied_USD of argmax(v2 supplied_USD, v3 supplied_USD)`.

Each hour selects Aave v3 only if its supplied USD exceeds v2; otherwise selects v2. Versions are not summed. Missing selected fields are filled with zero; last row excluded.

Collection: [get_aave_hourly.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/get_aave_hourly.py). Preprocessing: `build_dataset.py::full_aave / full_aave_metrics`.

## utilisation_rate_usdt

**Aave USDT utilisation** — Borrowed-to-supplied USD balance ratio for USDT in the selected Aave version.

Units: ratio. Formula: `borrowed_USD / supplied_USD in selected version`.

Each hour selects Aave v3 only if its supplied USD exceeds v2; otherwise selects v2. Versions are not summed. Missing selected fields are filled with zero; last row excluded.

Collection: [get_aave_hourly.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/get_aave_hourly.py). Preprocessing: `build_dataset.py::full_aave / full_aave_metrics`.

## supplied_USD_usdc

**Aave USDC supplied** — USDC supplied balance in USD in the selected Ethereum Aave version.

Units: USD. Formula: `supplied_USD of argmax(v2 supplied_USD, v3 supplied_USD)`.

Each hour selects Aave v3 only if its supplied USD exceeds v2; otherwise selects v2. Versions are not summed. Missing selected fields are filled with zero; last row excluded.

Collection: [get_aave_hourly.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/get_aave_hourly.py). Preprocessing: `build_dataset.py::full_aave / full_aave_metrics`.

## utilisation_rate_usdc

**Aave USDC utilisation** — Borrowed-to-supplied USD balance ratio for USDC in the selected Aave version.

Units: ratio. Formula: `borrowed_USD / supplied_USD in selected version`.

Each hour selects Aave v3 only if its supplied USD exceeds v2; otherwise selects v2. Versions are not summed. Missing selected fields are filled with zero; last row excluded.

Collection: [get_aave_hourly.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/get_aave_hourly.py). Preprocessing: `build_dataset.py::full_aave / full_aave_metrics`.

## liquidation_USD

**Aave hourly liquidations** — Hourly sum of liquidated USD amounts across Ethereum Aave v2 and v3.

Units: USD/hour. Formula: `sum(v2 liquidation amountUSD) + sum(v3 liquidation amountUSD)`.

Includes all markets returned by each Aave deployment, not only USDC or USDT. Missing hours become zero.

Collection: [liquidations.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/liquidations.py). Preprocessing: `build_dataset.py::aave_liquidations`.

## totalValueLockedUSD

**Curve 3pool TVL** — Total value locked in the DAI/USDC/USDT Curve 3pool.

Units: USD. Formula: `totalValueLockedUSD`.

Last source row excluded.

Collection: [update_crv_3pool.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_crv_3pool.py). Preprocessing: `build_dataset.py::crv_3pool_metrics`.

## hourlyVolumeUSD

**Curve 3pool hourly volume** — Reported USD swap volume in Curve 3pool for the hour.

Units: USD/hour. Formula: `hourlyVolumeUSD`.

Last source row excluded.

Collection: [update_crv_3pool.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_crv_3pool.py). Preprocessing: `build_dataset.py::crv_3pool_metrics`.

## w_USDC

**Curve USDC weight** — Reported share of USDC in Curve 3pool, converted from percent to a fraction.

Units: ratio. Formula: `inputTokenWeights[USDC] / 100`.

Last source row excluded.

Collection: [update_crv_3pool.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_crv_3pool.py). Preprocessing: `build_dataset.py::crv_3pool_metrics`.

## w_USDT

**Curve USDT weight** — Reported share of USDT in Curve 3pool, converted from percent to a fraction.

Units: ratio. Formula: `inputTokenWeights[USDT] / 100`.

Last source row excluded.

Collection: [update_crv_3pool.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_crv_3pool.py). Preprocessing: `build_dataset.py::crv_3pool_metrics`.

## curve_entropy

**Curve 3pool balance entropy** — Shannon entropy of all three reported token weights (DAI, USDC, USDT); higher indicates a more even pool mix.

Units: nats. Formula: `−Σ w_token × ln(w_token)`.

Not normalized to 0–1: maximum is ln(3), approximately 1.099. The implementation does not specially handle zero weights, which can produce missing values.

Collection: [update_crv_3pool.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_crv_3pool.py). Preprocessing: `build_dataset.py::crv_3pool_metrics`.

## eth_price_usd

**ETH price** — Last observed Chainlink ETH/USD oracle update within the hour, held forward between updates.

Units: USD. Formula: `hourly last(oracle price_usd), forward-filled`.

Hourly sampling does not imply an oracle update every hour.

Collection: [eth_oracle.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/eth_oracle.py). Preprocessing: `build_dataset.py::eth_price_oracle`.

## btc_price_usd

**BTC price** — Last observed Chainlink BTC/USD oracle update within the hour, held forward between updates.

Units: USD. Formula: `hourly last(oracle price_usd), forward-filled`.

Hourly sampling does not imply an oracle update every hour.

Collection: [eth_oracle.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/eth_oracle.py). Preprocessing: `build_dataset.py::btc_price_oracle`.

## usd_index

**USD FX index proxy** — Geometric index of normalized foreign-currency-per-USD Chainlink FX rates, based at 100.

Units: index points. Formula: `100 × exp(0.5 ln(EUR/EUR_base) + 0.3 ln(JPY/JPY_base) + 0.2 ln(GBP/GBP_base))`.

Rates are inverted from USD-per-foreign-currency feeds and forward-filled. Base is the first complete common observation. This is a custom proxy, not official DXY.

Collection: [eth_oracle.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/eth_oracle.py). Preprocessing: `build_dataset.py::usd_index_oracle`.

## fear_greed_index

**Crypto Fear & Greed Index** — Daily Alternative.me crypto sentiment index, repeated on an hourly grid until the next daily observation.

Units: index points (0–100). Formula: `daily value → hourly resample → forward fill`.

Lower values indicate fear, higher values greed. Not independently observed each hour.

Collection: [](https://api.alternative.me/fng/). Preprocessing: `build_dataset.py::fear_greed_index`.

## Gegenbauer_0.4_deg0

**Liquidity curve coefficient (degree 0)** — Degree 0 Gegenbauer coefficient (alpha 0.4) of the hourly log-liquidity profile on a peg-centered grid.

Units: log-liquidity coefficient. Formula: `B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^(0.4)(x)`.

tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. These are basis coefficients, not USD balances or principal components.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose`.

## Gegenbauer_0.4_deg1

**Liquidity curve coefficient (degree 1)** — Degree 1 Gegenbauer coefficient (alpha 0.4) of the hourly log-liquidity profile on a peg-centered grid.

Units: log-liquidity coefficient. Formula: `B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^(0.4)(x)`.

tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. These are basis coefficients, not USD balances or principal components.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose`.

## Gegenbauer_0.4_deg2

**Liquidity curve coefficient (degree 2)** — Degree 2 Gegenbauer coefficient (alpha 0.4) of the hourly log-liquidity profile on a peg-centered grid.

Units: log-liquidity coefficient. Formula: `B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^(0.4)(x)`.

tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. These are basis coefficients, not USD balances or principal components.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose`.

## Gegenbauer_0.4_deg3

**Liquidity curve coefficient (degree 3)** — Degree 3 Gegenbauer coefficient (alpha 0.4) of the hourly log-liquidity profile on a peg-centered grid.

Units: log-liquidity coefficient. Formula: `B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^(0.4)(x)`.

tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. These are basis coefficients, not USD balances or principal components.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose`.

## Gegenbauer_0.4_deg4

**Liquidity curve coefficient (degree 4)** — Degree 4 Gegenbauer coefficient (alpha 0.4) of the hourly log-liquidity profile on a peg-centered grid.

Units: log-liquidity coefficient. Formula: `B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^(0.4)(x)`.

tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. These are basis coefficients, not USD balances or principal components.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose`.

## Gegenbauer_0.4_deg5

**Liquidity curve coefficient (degree 5)** — Degree 5 Gegenbauer coefficient (alpha 0.4) of the hourly log-liquidity profile on a peg-centered grid.

Units: log-liquidity coefficient. Formula: `B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^(0.4)(x)`.

tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. These are basis coefficients, not USD balances or principal components.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose`.

## Gegenbauer_0.4_deg6

**Liquidity curve coefficient (degree 6)** — Degree 6 Gegenbauer coefficient (alpha 0.4) of the hourly log-liquidity profile on a peg-centered grid.

Units: log-liquidity coefficient. Formula: `B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^(0.4)(x)`.

tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. These are basis coefficients, not USD balances or principal components.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose`.

## Gegenbauer_0.4_deg7

**Liquidity curve coefficient (degree 7)** — Degree 7 Gegenbauer coefficient (alpha 0.4) of the hourly log-liquidity profile on a peg-centered grid.

Units: log-liquidity coefficient. Formula: `B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^(0.4)(x)`.

tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. These are basis coefficients, not USD balances or principal components.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose`.

## E_total

**Liquidity curve total energy** — Sum of squared Gegenbauer coefficients for degrees 0, 1, 2, 3, 4, 5, 6, 7.

Units: squared coefficient units. Formula: `Σ b_j², j ∈ {0, 1, 2, 3, 4, 5, 6, 7}`.

Coefficient-energy proxy; the basis is not normalized, so this is not an integral of liquidity or a USD quantity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## E_shape

**Liquidity curve shape energy** — Sum of squared Gegenbauer coefficients for degrees 1, 2, 3, 4, 5, 6, 7.

Units: squared coefficient units. Formula: `Σ b_j², j ∈ {1, 2, 3, 4, 5, 6, 7}`.

Coefficient-energy proxy; the basis is not normalized, so this is not an integral of liquidity or a USD quantity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## E_odd

**Liquidity curve odd energy** — Sum of squared Gegenbauer coefficients for degrees 1, 3, 5, 7.

Units: squared coefficient units. Formula: `Σ b_j², j ∈ {1, 3, 5, 7}`.

Coefficient-energy proxy; the basis is not normalized, so this is not an integral of liquidity or a USD quantity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## E_even

**Liquidity curve even energy** — Sum of squared Gegenbauer coefficients for degrees 2, 4, 6.

Units: squared coefficient units. Formula: `Σ b_j², j ∈ {2, 4, 6}`.

Coefficient-energy proxy; the basis is not normalized, so this is not an integral of liquidity or a USD quantity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## odd_ratio

**Liquidity curve odd energy share** — Share of nonconstant coefficient energy assigned to the odd degree group.

Units: ratio. Formula: `E_odd / (E_shape + 1e−12)`.

Excludes the degree-zero baseline. Describes coefficient energy, not a share of USD liquidity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## even_ratio

**Liquidity curve even energy share** — Share of nonconstant coefficient energy assigned to the even degree group.

Units: ratio. Formula: `E_even / (E_shape + 1e−12)`.

Excludes the degree-zero baseline. Describes coefficient energy, not a share of USD liquidity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## odd_to_even_ratio

**Liquidity curve odd/even energy ratio** — Odd-degree energy relative to nonconstant even-degree energy; an asymmetry-versus-symmetric-shape proxy.

Units: ratio. Formula: `E_odd / (E_even + 1e−12)`.

Can be large when even-degree energy is close to zero; not a directional price prediction.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## E_low

**Liquidity curve low energy** — Sum of squared Gegenbauer coefficients for degrees 1, 2.

Units: squared coefficient units. Formula: `Σ b_j², j ∈ {1, 2}`.

Coefficient-energy proxy; the basis is not normalized, so this is not an integral of liquidity or a USD quantity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## E_mid

**Liquidity curve mid energy** — Sum of squared Gegenbauer coefficients for degrees 3, 4.

Units: squared coefficient units. Formula: `Σ b_j², j ∈ {3, 4}`.

Coefficient-energy proxy; the basis is not normalized, so this is not an integral of liquidity or a USD quantity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## E_high

**Liquidity curve high energy** — Sum of squared Gegenbauer coefficients for degrees 5, 6, 7.

Units: squared coefficient units. Formula: `Σ b_j², j ∈ {5, 6, 7}`.

Coefficient-energy proxy; the basis is not normalized, so this is not an integral of liquidity or a USD quantity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## low_ratio

**Liquidity curve low energy share** — Share of nonconstant coefficient energy assigned to the low degree group.

Units: ratio. Formula: `E_low / (E_shape + 1e−12)`.

Excludes the degree-zero baseline. Describes coefficient energy, not a share of USD liquidity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## mid_ratio

**Liquidity curve mid energy share** — Share of nonconstant coefficient energy assigned to the mid degree group.

Units: ratio. Formula: `E_mid / (E_shape + 1e−12)`.

Excludes the degree-zero baseline. Describes coefficient energy, not a share of USD liquidity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## high_ratio

**Liquidity curve high energy share** — Share of nonconstant coefficient energy assigned to the high degree group.

Units: ratio. Formula: `E_high / (E_shape + 1e−12)`.

Excludes the degree-zero baseline. Describes coefficient energy, not a share of USD liquidity.

Collection: [update_hourly_liquidity.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_hourly_liquidity.py). Preprocessing: `build_dataset.py::gegenbauer_energy_features`.

## swap_size_imbalance

**Swap-size curve imbalance** — Relative difference between cumulative token inputs needed to move the pool price down versus up over 1–50 ticks.

Units: ratio. Formula: `Σ_k(A_down_token0(k) − A_up_token1(k)) / Σ_k(A_down_token0(k) + A_up_token1(k)), k=1…50`.

Derived from active Uniswap liquidity. Positive means the summed down-move input cost is larger. Uses native six-decimal token amounts; swap fees are not included.

Collection: [swap_size_curve.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/swap_size_curve.py). Preprocessing: `build_dataset.py::add_swap_size_metrics`.

## tangent_down

**Near-peg down-move liquidity slope** — Average near-price input-cost slope proxy from the USDC required to move the price down by 1, 2 and 3 ticks.

Units: USDC/tick (proxy). Formula: `(A_down(1) + A_down(2) + A_down(3)) / (6 × 10⁶)`.

The denominator combines 1+2+3 tick distances and six-decimal token scaling. This is not an exact derivative; fees are excluded.

Collection: [swap_size_curve.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/swap_size_curve.py). Preprocessing: `build_dataset.py::add_swap_size_metrics`.

## tangent_up

**Near-peg up-move liquidity slope** — Average near-price input-cost slope proxy from the USDT required to move the price up by 1, 2 and 3 ticks.

Units: USDT/tick (proxy). Formula: `(A_up(1) + A_up(2) + A_up(3)) / (6 × 10⁶)`.

The denominator combines 1+2+3 tick distances and six-decimal token scaling. This is not an exact derivative; fees are excluded.

Collection: [swap_size_curve.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/swap_size_curve.py). Preprocessing: `build_dataset.py::add_swap_size_metrics`.

## hhi_24h_rolling_mean

**Liquidity ownership HHI (24h mean)** — Trailing mean of the sum of squared owner shares of in-range Uniswap liquidity; higher means more concentrated ownership.

Units: ratio (0–1). Formula: `mean_24rows(Σ_owner (L_owner / L_total)²)`.

Weights use liquidity L, not USD. In-range uses tickLower ≤ poolTick ≤ tickUpper. 24 available hourly rows, with partial windows allowed at the beginning.

Collection: [LP_distribution.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/LP_distribution.py). Preprocessing: `build_dataset.py::add_liq_ownership_features`.

## tick_width_24h_rolling_median

**Liquidity tick width (24h median)** — Trailing median of the liquidity-weighted mean width of in-range positions, capped at 200 ticks.

Units: ticks. Formula: `min(200, median_24rows(Σ L × (tickUpper−tickLower) / Σ L))`.

Not the median individual position width. Partial rolling windows are allowed; bounds include the upper tick.

Collection: [LP_distribution.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/LP_distribution.py). Preprocessing: `build_dataset.py::add_liq_ownership_features`.

## n_in_range_log_return

**In-range position count change** — Fractional change in the count of in-range Uniswap positions from the preceding available hourly row.

Units: fractional change. Formula: `N_t / N_previous − 1`.

Legacy name says log_return, but the code uses pct_change(), not log differences. A value of 0.1 means a 10% increase.

Collection: [LP_distribution.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/LP_distribution.py). Preprocessing: `build_dataset.py::add_liq_ownership_features`.

## weighted_mean_age_hours

**Liquidity-weighted position age** — Liquidity-weighted mean age of in-range positions, measured since each position first appears in the sampled dataset.

Units: hours. Formula: `Σ L × hours_since_first_sampled_position / Σ L`.

Sample-based age may understate true on-chain age; it does not use the original mint timestamp.

Collection: [LP_distribution.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/LP_distribution.py). Preprocessing: `build_dataset.py::add_liq_ownership_features`.

## gauge_share_3crv

**3CRV gauge inventory / TVL proxy** — Cumulative net 3CRV token transfers into the tracked gauge, divided by Curve 3pool TVL in USD.

Units: 3CRV tokens / USD. Formula: `cumsum(incoming_3CRV − outgoing_3CRV) / totalValueLockedUSD`.

Legacy share name is misleading: numerator is LP tokens, denominator is USD, and initial inventory before the sample is not included. This is not a true ownership percentage.

Collection: [update_3CRV_events.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_3CRV_events.py). Preprocessing: `build_dataset.py::add_liq_ownership_features`.

## depeg_bps

**USDC/USDT deviation from peg** — Signed deviation of the USDT-per-USDC quote from one. Negative means relative USDC weakness; positive means relative USDT weakness.

Units: basis points. Formula: `10000 × (USDT per USDC − 1)`.

From the fee-tier 100 pool square-root price, adjusted for token decimals. This is the GARCH input and monitoring label source, not a forest predictor.

Collection: [update_uniswap_metrics.py](https://github.com/MSCA-DN-Digital-Finance/stablecoin-onchain-data/blob/5301eb5c5b767329a0ed08c5bed68296b00f0fcb/update_uniswap_metrics.py). Preprocessing: `build_dataset.py::add_forecasting_target`.
