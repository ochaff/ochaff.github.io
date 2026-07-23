I write about my research interests in digital finance and time series analysis.

<a class="depeg-card" href="/depeg-monitor.html" id="depeg-card">
  <div class="depeg-card-left">
    <div class="depeg-card-title">USDC/USDT Depeg Monitor</div>
    <div class="depeg-card-desc">
      Random forest model trained on on-chain data from Uniswap, Curve, and AAVE.
      24-hour depeg probability with SHAP explanations. Updated nightly.
    </div>
  </div>
  <div class="depeg-card-right" id="depeg-card-right">
    <span class="depeg-card-loading">Loading…</span>
  </div>
</a>

<script>
(async () => {
  const right = document.getElementById('depeg-card-right');
  try {
    const r = await fetch('/dashboard_data/rf_results.json?v=' + Date.now());
    if (!r.ok) throw new Error();
    const d = await r.json();
    const p = d.probability;
    const pct = (p * 100).toFixed(1) + '%';
    const low  = p < 0.25, high = p >= 0.55;
    const color = low ? '#1baf7a' : high ? '#e34948' : '#eda100';
    const label = low ? 'Low risk'  : high ? 'High risk' : 'Elevated';
    const bg    = low ? '#e7f9f2'   : high ? '#fef0f0'   : '#fff8e6';
    right.innerHTML = `
      <span class="depeg-prob" style="color:${color}">${pct}</span>
      <span class="depeg-band" style="color:${color};background:${bg}">${label}</span>
      <span class="depeg-cta">Open dashboard &rarr;</span>`;
  } catch(_) {
    right.innerHTML = '<span class="depeg-cta">Open dashboard &rarr;</span>';
  }
})();
</script>
