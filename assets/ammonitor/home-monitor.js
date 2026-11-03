(() => {
  const card = document.querySelector('[data-monitor-src]');
  if (!card) return;
  const meta = document.getElementById('home-risk-meta');
  fetch(card.dataset.monitorSrc + '?v=' + Date.now())
    .then(response => { if (!response.ok) throw new Error('Data unavailable'); return response.json(); })
    .then(data => {
      const p = data.probability;
      if (data.calibrated !== true || !Number.isFinite(p) || p < 0 || p > 1) {
        meta.textContent = 'Calibrated model output unavailable';
        return;
      }
      const band = p < .1 ? 'Low' : p < .2 ? 'Elevated' : p < .5 ? 'High' : 'Critical';
      card.dataset.risk = band.toLowerCase();
      document.getElementById('home-risk-value').textContent = (p * 100).toFixed(1) + '%';
      document.getElementById('home-risk-band').textContent = band + ' risk';
      const token = data.forecasting?.risk_direction || 'Awaiting forecast';
      const target = document.getElementById('home-risk-token');
      target.textContent = token;
      if (['USDC', 'USDT'].includes(token)) {
        const image = document.createElement('img');
        image.src = card.dataset.assetBase + token.toLowerCase() + '-logo.png';
        image.alt = ''; image.width = 21; image.height = 21;
        target.prepend(image);
      }
      const observed = new Date(String(data.timestamp || '').replace(' ', 'T'));
      meta.textContent = 'Latest observation: ' + (Number.isFinite(observed.getTime()) ?
        observed.toLocaleString('en-GB', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'UTC'}) + ' UTC' :
        'time unavailable') + ' · Token at risk: larger 1% forecast VaR';
    })
    .catch(() => { meta.textContent = 'Live data temporarily unavailable · open the dashboard for details'; });
})();
