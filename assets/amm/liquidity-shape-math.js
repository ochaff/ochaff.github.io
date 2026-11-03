/* Continuous-price teaching models. Token quantities are human-readable units. */
(() => {
  const SCALE = 100e6;
  const BOUND = 100;
  const mids = Array.from({length: 200}, (_, i) => i - BOUND + 0.5);
  const localTilt = b => Math.abs(b) < 1 ? 0 : 1.3 * (b / 10) * Math.exp(-0.5 * (b / 10) ** 2);
  const tailOffset = mids.filter(b => b > 0).reduce((s, b) => s + localTilt(b), 0) / 70;
  const pegPeak = b => 0.12 + 6 * Math.exp(-0.5 * (b / 12) ** 2);
  // Match the other profiles' integrated L, redistributing it toward parity.
  const pegNormalization = 400 / mids.reduce((sum,b) => sum + pegPeak(b), 0);
  const profiles = {
    balanced: b => 2,
    global: b => 2 + (b >= 25 ? 1.4 : b <= -25 ? -1.4 : 0),
    local: b => 2 + localTilt(b) - (Math.abs(b) >= 30 ? Math.sign(b) * tailOffset : 0),
    thin: b => Math.abs(b) < 10 ? 0.4 : (400 - 20 * 0.4) / 180,
    concentrated: b => pegNormalization * pegPeak(b)
  };
  function makeBins(name) {
    return mids.map(b => ({lower: 1 + (b - 0.5) / 10000,
      upper: 1 + (b + 0.5) / 10000, L: SCALE * profiles[name](b)}));
  }
  function imbalance(bins) {
    let left = 0, right = 0;
    for (const bin of bins) {
      left += bin.L * Math.max(0, Math.min(1, bin.upper) - bin.lower);
      right += bin.L * Math.max(0, bin.upper - Math.max(1, bin.lower));
    }
    return (right - left) / (right + left);
  }
  // A positive input sells USDC and lowers p; a negative input sells USDT.
  // Traverse each constant-L interval exactly using the v3 sqrt-price equations.
  function swap(bins, signedInput) {
    let price = 1, remaining = Math.abs(signedInput), output = 0, filled = 0;
    const downward = signedInput >= 0;
    const path = downward ? [...bins].reverse() : bins;
    for (const bin of path) {
      if (remaining <= 1e-9) break;
      if (downward ? bin.lower >= price : bin.upper <= price) continue;
      const target = downward ? bin.lower : bin.upper;
      const s = Math.sqrt(price), end = Math.sqrt(target);
      if (bin.L <= 0) { price = target; continue; }
      const capacity = bin.L * (downward ? 1 / end - 1 / s : end - s);
      const used = Math.min(remaining, capacity);
      const next = downward ? 1 / (1 / s + used / bin.L) : s + used / bin.L;
      output += bin.L * (downward ? s - next : 1 / s - 1 / next);
      price = next * next;
      filled += used;
      remaining -= used;
    }
    return {price, filled, output, unfilled: remaining, bps: (price - 1) * 10000};
  }
  function position(halfWidth, bps) {
    const upper = 1 + halfWidth / 10000, lower = 1 / upper;
    // Fixed initial capital: 100,000 USDC + 100,000 USDT at parity.
    const L = 100000 / (1 - 1 / Math.sqrt(upper));
    const price = 1 + bps / 10000;
    const active = price >= lower && price < upper;
    return {upper, lower, L, active, share: active ? L / (SCALE + L) : 0};
  }
  function localImpact(bins, price, direction) {
    // At a boundary, use the liquidity that the next input token encounters.
    const bin = direction > 0 ? bins.find(b => b.lower < price && b.upper >= price) :
      bins.find(b => b.lower <= price && b.upper > price);
    const L = (bin || (direction > 0 ? bins[0] : bins.at(-1))).L;
    return {L, bpsPer100k: 2 * price ** (direction > 0 ? 1.5 : 0.5) / L * 1e9};
  }
  function gegenbauer(n, u, lambda = 0.4) {
    if (n === 0) return 1;
    let previous = 1, current = 2 * lambda * u;
    for (let k = 2; k <= n; k++) {
      const next = (2 * (k + lambda - 1) * u * current - (k + 2 * lambda - 2) * previous) / k;
      previous = current;
      current = next;
    }
    return current;
  }
  const basis = (n, u) => gegenbauer(n, u) / gegenbauer(n, 1);
  const baseline = 3;
  const reference = SCALE / Math.expm1(baseline);
  function reconstruct(scores, u, degree = 5) {
    const g = baseline + scores.slice(0, degree).reduce((sum, score, i) => sum + score * basis(i + 1, u), 0);
    return reference * Math.expm1(g);
  }
  const api = {SCALE, BOUND, mids, profiles, makeBins, imbalance, swap, localImpact, position, gegenbauer, basis, reconstruct, baseline, reference};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.LiquidityShapeMath = api;
})();
