"""Audited definitions for the features enabled in the AMMonitor workflow.

Descriptions follow the calculations, including legacy names that do not
accurately describe their values. Adding an unknown model feature fails export
so a changed dataset cannot silently publish a misleading tooltip.
"""
from __future__ import annotations

import re
import hashlib
from pathlib import Path

PREPROCESSING_SOURCE_HASH = hashlib.sha256(Path(__file__).with_name("build_dataset.py").read_bytes()).hexdigest()

COLLECTION_COMMIT = '5301eb5c5b767329a0ed08c5bed68296b00f0fcb'
PREPROCESSING_COMMIT = 'a8422954fbfb38c482fd638a32313bf1f1365989'
COLLECTION_BASE = ('https://github.com/MSCA-DN-Digital-Finance/'
                   f'stablecoin-onchain-data/blob/{COLLECTION_COMMIT}/')


def feature_dictionary(names):
    definitions = {}

    def add(name, label, description, units, formula, collector, preprocessing, notes=''):
        definitions[name] = {
            'label': label, 'description': description, 'units': units,
            'formula': formula, 'notes': notes,
            'collection_source': COLLECTION_BASE + collector,
            'preprocessing_source': 'build_dataset.py',
            'preprocessing_revision': PREPROCESSING_COMMIT,
            'preprocessing_function': preprocessing,
        }

    for tier, fee in [(100, '1 bp'), (500, '5 bp')]:
        common = f'USDC/USDT Uniswap v3 {fee} fee pool.'
        add(f'tvlUSD_{tier}', f'Uniswap TVL ({fee} pool)',
            f'Total value locked in the {common}', 'USD',
            'poolHourData.tvlUSD', 'update_uniswap_metrics.py', 'load_uniswap_metrics',
            'Hourly subgraph snapshot; the last source row is excluded by preprocessing.')
        add(f'swap_count_{tier}', f'Uniswap swaps ({fee} pool)',
            f'Number of swaps in the hour for the {common}', 'swaps/hour',
            'count(swap events in hour)', 'update_uniswap_metrics.py', 'load_uniswap_metrics')
        add(f'net_amountUSD_{tier}', f'Uniswap swap notional ({fee} pool)',
            f'Sum of reported USD swap amounts in the hour for the {common}', 'USD/hour',
            'sum(swap.amountUSD)', 'update_uniswap_metrics.py', 'load_uniswap_metrics',
            'Despite the legacy net_amountUSD name, no buy/sell sign is applied. '
            'This is swap notional, not signed net flow. The 5 bp series is forward-filled in preprocessing.')
    add('net_amount0', 'Uniswap net USDC flow (1 bp pool)',
        'Signed sum of token0 (USDC) swap deltas from the pool perspective in the hour.',
        'USDC/hour', 'sum(swap.amount0)', 'update_uniswap_metrics.py', 'load_uniswap_metrics',
        'Positive means USDC enters the pool; negative means it leaves. Only the 1 bp pool is included.')
    add('depeg_bps', 'USDC/USDT deviation from peg',
        'Signed deviation of the USDT-per-USDC quote from one. Negative means relative USDC weakness; '
        'positive means relative USDT weakness.', 'basis points',
        '10000 × (USDT per USDC − 1)', 'update_uniswap_metrics.py', 'add_forecasting_target',
        'From the fee-tier 100 pool square-root price, adjusted for token decimals. '
        'This is the GARCH input and monitoring label source, not a forest predictor.')
    for coin in ['usdt', 'usdc']:
        token = coin.upper()
        note = ('Each hour selects Aave v3 only if its supplied USD exceeds v2; otherwise selects v2. '
                'Versions are not summed. Missing selected fields are filled with zero; last row excluded.')
        add(f'supplied_USD_{coin}', f'Aave {token} supplied',
            f'{token} supplied balance in USD in the selected Ethereum Aave version.', 'USD',
            'supplied_USD of argmax(v2 supplied_USD, v3 supplied_USD)',
            'get_aave_hourly.py', 'full_aave / full_aave_metrics', note)
        add(f'utilisation_rate_{coin}', f'Aave {token} utilisation',
            f'Borrowed-to-supplied USD balance ratio for {token} in the selected Aave version.',
            'ratio', 'borrowed_USD / supplied_USD in selected version',
            'get_aave_hourly.py', 'full_aave / full_aave_metrics', note)
    add('liquidation_USD', 'Aave hourly liquidations',
        'Hourly sum of liquidated USD amounts across Ethereum Aave v2 and v3.', 'USD/hour',
        'sum(v2 liquidation amountUSD) + sum(v3 liquidation amountUSD)',
        'liquidations.py', 'aave_liquidations',
        'Includes all markets returned by each Aave deployment, not only USDC or USDT. Missing hours become zero.')
    for name, label, description, unit in [
        ('totalValueLockedUSD', 'Curve 3pool TVL', 'Total value locked in the DAI/USDC/USDT Curve 3pool.', 'USD'),
        ('hourlyVolumeUSD', 'Curve 3pool hourly volume', 'Reported USD swap volume in Curve 3pool for the hour.', 'USD/hour'),
        ('w_USDC', 'Curve USDC weight', 'Reported share of USDC in Curve 3pool, converted from percent to a fraction.', 'ratio'),
        ('w_USDT', 'Curve USDT weight', 'Reported share of USDT in Curve 3pool, converted from percent to a fraction.', 'ratio'),
    ]:
        add(name, label, description, unit,
            f'inputTokenWeights[{name[2:]}] / 100' if name.startswith('w_') else name,
            'update_crv_3pool.py', 'crv_3pool_metrics', 'Last source row excluded.')
    add('curve_entropy', 'Curve 3pool balance entropy',
        'Shannon entropy of all three reported token weights (DAI, USDC, USDT); higher indicates a more even pool mix.',
        'nats', '−Σ w_token × ln(w_token)', 'update_crv_3pool.py', 'crv_3pool_metrics',
        'Not normalized to 0–1: maximum is ln(3), approximately 1.099. '
        'The implementation does not specially handle zero weights, which can produce missing values.')
    for coin in ['eth', 'btc']:
        add(f'{coin}_price_usd', f'{coin.upper()} price',
            f'Last observed Chainlink {coin.upper()}/USD oracle update within the hour, held forward between updates.',
            'USD', 'hourly last(oracle price_usd), forward-filled',
            'eth_oracle.py', f'{coin}_price_oracle', 'Hourly sampling does not imply an oracle update every hour.')
    add('usd_index', 'USD FX index proxy',
        'Geometric index of normalized foreign-currency-per-USD Chainlink FX rates, based at 100.',
        'index points', '100 × exp(0.5 ln(EUR/EUR_base) + 0.3 ln(JPY/JPY_base) + 0.2 ln(GBP/GBP_base))',
        'eth_oracle.py', 'usd_index_oracle',
        'Rates are inverted from USD-per-foreign-currency feeds and forward-filled. '
        'Base is the first complete common observation. This is a custom proxy, not official DXY.')
    add('fear_greed_index', 'Crypto Fear & Greed Index',
        'Daily Alternative.me crypto sentiment index, repeated on an hourly grid until the next daily observation.',
        'index points (0–100)', 'daily value → hourly resample → forward fill',
        'https://api.alternative.me/fng/', 'fear_greed_index',
        'Lower values indicate fear, higher values greed. Not independently observed each hour.')
    definitions['fear_greed_index']['collection_source'] = 'https://api.alternative.me/fng/'

    # Gegenbauer names depend on the alpha used to build a dataset.
    for name in names:
        match = re.fullmatch(r'Gegenbauer_([0-9.]+)_deg([0-7])', name)
        if not match:
            continue
        alpha, degree = match.groups()
        add(name, f'Liquidity curve coefficient (degree {degree})',
            f'Degree {degree} Gegenbauer coefficient (alpha {alpha}) of the hourly log-liquidity profile on a peg-centered grid.',
            'log-liquidity coefficient',
            f'B = log1p(L) Φ (ΦᵀΦ + 1e−10 I)⁻¹; Φ_j = C_j^({alpha})(x)',
            'update_hourly_liquidity.py', 'preprocess_liq_curve / decomp_logL_curve / orthopoly_decompose',
            'tickLower/50 is clipped to [−1,1]; liquidity is summed by clipped tick and empty cells are zero. '
            'The fit uses an equally spaced grid across the resulting columns, degrees 0–7, and no time centering. '
            'These are basis coefficients, not USD balances or principal components.')
    for name, definition in definitions.items():
        if name.startswith('Gegenbauer_0.1_deg'):
            definition['preprocessing_revision'] = None
            definition['preprocessing_sha256'] = PREPROCESSING_SOURCE_HASH
            definition['formula'] = 'B = (log1p(L) − training mean curve) W Φ (Φᵀ W Φ + 1e−10 I)⁻¹'
            definition['notes'] = ('Weighted least squares on the equally spaced peg-centered grid, degrees 0–7, '
                                   'with a weighted-normalized basis and trapezoidal Gegenbauer weights. '
                                   'The mean curve is fitted only through the RF feature-fitting cutoff and held fixed. '
                                   'These are basis coefficients, not USD balances or principal components.')
    energy = {'total': list(range(8)), 'shape': list(range(1, 8)), 'odd': [1, 3, 5, 7],
              'even': [2, 4, 6], 'low': [1, 2], 'mid': [3, 4], 'high': [5, 6, 7]}
    for group, degrees in energy.items():
        add('E_' + group, f'Liquidity curve {group} energy',
            f'Sum of squared Gegenbauer coefficients for degrees {", ".join(map(str, degrees))}.',
            'squared coefficient units', f'Σ b_j², j ∈ {{{", ".join(map(str, degrees))}}}',
            'update_hourly_liquidity.py', 'gegenbauer_energy_features',
            'Coefficient-energy proxy; the basis is not normalized, so this is not an integral of liquidity or a USD quantity.')
    for group in ['odd', 'even', 'low', 'mid', 'high']:
        add(group + '_ratio', f'Liquidity curve {group} energy share',
            f'Share of nonconstant coefficient energy assigned to the {group} degree group.',
            'ratio', f'E_{group} / (E_shape + 1e−12)',
            'update_hourly_liquidity.py', 'gegenbauer_energy_features',
            'Excludes the degree-zero baseline. Describes coefficient energy, not a share of USD liquidity.')
    add('odd_to_even_ratio', 'Liquidity curve odd/even energy ratio',
        'Odd-degree energy relative to nonconstant even-degree energy; an asymmetry-versus-symmetric-shape proxy.',
        'ratio', 'E_odd / (E_even + 1e−12)', 'update_hourly_liquidity.py', 'gegenbauer_energy_features',
        'Can be large when even-degree energy is close to zero; not a directional price prediction.')
    add('swap_size_imbalance', 'Swap-size curve imbalance',
        'Relative difference between cumulative token inputs needed to move the pool price down versus up over 1–50 ticks.',
        'ratio', 'Σ_k(A_down_token0(k) − A_up_token1(k)) / Σ_k(A_down_token0(k) + A_up_token1(k)), k=1…50',
        'swap_size_curve.py', 'add_swap_size_metrics',
        'Derived from active Uniswap liquidity. Positive means the summed down-move input cost is larger. '
        'Uses native six-decimal token amounts; swap fees are not included.')
    for direction, token in [('down', 'USDC'), ('up', 'USDT')]:
        add('tangent_' + direction, f'Near-peg {direction}-move liquidity slope',
            f'Average near-price input-cost slope proxy from the {token} required to move the price {direction} by 1, 2 and 3 ticks.',
            f'{token}/tick (proxy)', f'(A_{direction}(1) + A_{direction}(2) + A_{direction}(3)) / (6 × 10⁶)',
            'swap_size_curve.py', 'add_swap_size_metrics',
            'The denominator combines 1+2+3 tick distances and six-decimal token scaling. '
            'This is not an exact derivative; fees are excluded.')
    add('hhi_24h_rolling_mean', 'Liquidity ownership HHI (24h mean)',
        'Trailing mean of the sum of squared owner shares of in-range Uniswap liquidity; higher means more concentrated ownership.',
        'ratio (0–1)', 'mean_24rows(Σ_owner (L_owner / L_total)²)',
        'LP_distribution.py', 'add_liq_ownership_features',
        'Weights use liquidity L, not USD. In-range uses tickLower ≤ poolTick ≤ tickUpper. '
        '24 available hourly rows, with partial windows allowed at the beginning.')
    add('tick_width_24h_rolling_median', 'Liquidity tick width (24h median)',
        'Trailing median of the liquidity-weighted mean width of in-range positions, capped at 200 ticks.',
        'ticks', 'min(200, median_24rows(Σ L × (tickUpper−tickLower) / Σ L))',
        'LP_distribution.py', 'add_liq_ownership_features',
        'Not the median individual position width. Partial rolling windows are allowed; bounds include the upper tick.')
    add('n_in_range_log_return', 'In-range position count change',
        'Fractional change in the count of in-range Uniswap positions from the preceding available hourly row.',
        'fractional change', 'N_t / N_previous − 1',
        'LP_distribution.py', 'add_liq_ownership_features',
        'Legacy name says log_return, but the code uses pct_change(), not log differences. '
        'A value of 0.1 means a 10% increase.')
    add('weighted_mean_age_hours', 'Liquidity-weighted position age',
        'Liquidity-weighted mean age of in-range positions, measured since each position first appears in the sampled dataset.',
        'hours', 'Σ L × hours_since_first_sampled_position / Σ L',
        'LP_distribution.py', 'add_liq_ownership_features',
        'Sample-based age may understate true on-chain age; it does not use the original mint timestamp.')
    add('gauge_share_3crv', '3CRV gauge inventory / TVL proxy',
        'Cumulative net 3CRV token transfers into the tracked gauge, divided by Curve 3pool TVL in USD.',
        '3CRV tokens / USD', 'cumsum(incoming_3CRV − outgoing_3CRV) / totalValueLockedUSD',
        'update_3CRV_events.py', 'add_liq_ownership_features',
        'Legacy share name is misleading: numerator is LP tokens, denominator is USD, and initial inventory '
        'before the sample is not included. This is not a true ownership percentage.')
    if any(name.startswith('Gegenbauer_0.1_deg') for name in names):
        for name, definition in definitions.items():
            if name.startswith('E_'):
                definition['notes'] = ('Coefficient-energy proxy from the weighted-normalized basis; '
                                       'not an integrated liquidity value or USD quantity.')
    unknown = set(names) - definitions.keys()
    if unknown:
        raise ValueError(f'Feature dictionary missing audited definitions: {sorted(unknown)}')
    return {name: dict(feature=name, **definitions[name]) for name in names}


def dictionary_document(definitions):
    """Human-readable companion to the embedded dashboard dictionary."""
    lines = ['# AMMonitor feature dictionary', '',
             'Definitions follow the enabled collection and preprocessing calculations. '
             'There are 50 forest predictors plus the raw signed depeg measure (not a forest predictor).', '',
             f'Collection source revision: `{COLLECTION_COMMIT}`. '
             f'Preprocessing audited at `{PREPROCESSING_COMMIT}` (`build_dataset.py`).', '',
             'Model imputation is separate: causal forward fill followed by training-period medians. '
             'Histograms describe the full available history, excluding the current row. '
             'Local SHAP explains the base forest score before calibration.', '']
    for name, item in definitions.items():
        lines.extend([f'## {name}', '', f'**{item["label"]}** — {item["description"]}', '',
                      f'Units: {item["units"]}. Formula: `{item["formula"]}`.', ''])
        if item['notes']:
            lines.extend([item['notes'], ''])
        lines.extend([
                      f'Collection: [{item["collection_source"].split("/")[-1]}]({item["collection_source"]}). '
                      f'Preprocessing: `build_dataset.py::{item["preprocessing_function"]}`.', ''])
    return '\n'.join(lines)
