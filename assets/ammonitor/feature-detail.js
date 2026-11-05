/* Global ALE explains the calibrated probability; local SHAP explains the base forest. */
let aleCharts = [], aleFeature = null, aleOpener = null;
const aleDialog = document.getElementById('feature-detail');
const aleAxisNumber = value => new Intl.NumberFormat('en-US', {
  notation: Math.abs(value) >= 10000 ? 'compact' : 'standard', maximumSignificantDigits: 4
}).format(value);

function closeFeatureDetail() { aleDialog.close(); }
aleDialog.addEventListener('close', () => {
  aleCharts.forEach(chart => chart.destroy()); aleCharts = [];
  const fallback = [...document.querySelectorAll('[data-feature-detail]')].find(
    button => button.dataset.featureDetail === aleFeature?.feature) || document.getElementById('tab-metrics');
  (aleOpener?.isConnected ? aleOpener : fallback)?.focus();
});
document.getElementById('detail-close').addEventListener('click', closeFeatureDetail);
document.getElementById('detail-range').addEventListener('change', drawFeatureDetail);
aleDialog.addEventListener('click', event => {
  const rect = aleDialog.getBoundingClientRect();
  if (event.target === aleDialog && (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom)) closeFeatureDetail();
});

function openFeatureDetail(feature, opener) {
  hideFeatureHelp();
  aleFeature = (result.feature_catalog || []).find(item => item.feature === feature);
  if (!aleFeature) return;
  aleOpener = opener;
  const definition = result.feature_dictionary?.[feature];
  document.getElementById('detail-title').textContent = aleFeature.display_name || feature;
  document.getElementById('detail-description').textContent = definition?.description || feature;
  document.getElementById('detail-current').textContent = 'Current: ' + formatFeature(aleFeature);
  document.getElementById('detail-range').value = 'central';
  aleDialog.showModal();
  requestAnimationFrame(drawFeatureDetail);
}

function drawFeatureDetail() {
  if (!aleDialog.open || !aleFeature) return;
  aleCharts.forEach(chart => chart.destroy()); aleCharts = [];
  const feature = aleFeature.feature, payload = result.ale;
  const matches = payload?.timestamp === result.timestamp;
  const row = matches ? payload?.features?.[feature] : null;
  const available = row && ['ok', 'constant'].includes(row.status);
  document.getElementById('detail-range').options[1].disabled = !row?.distribution;
  const full = document.getElementById('detail-range').value === 'full' && Boolean(row?.distribution);
  const histogram = full && row?.distribution ? row.distribution : aleFeature.histogram;
  const edges = histogram?.edges || [0, 1], counts = histogram?.counts || [];
  let min = edges[0], max = edges.at(-1);
  if (min === max) { min -= .5; max += .5; }
  const current = aleFeature.value;
  const marker = Math.max(min, Math.min(max, current));
  const beyondView = Number.isFinite(current) && (current < min || current > max);
  document.getElementById('detail-current').textContent = 'Current: ' + formatFeature(aleFeature) +
    (beyondView ? ' · marker at edge ' + (current < min ? '←' : '→') : '');
  const empty = document.getElementById('detail-empty');
  empty.hidden = Boolean(available);
  empty.textContent = feature === 'depeg_bps' ?
    'This measure defines the monitored outcome and is not a Random Forest input. ALE does not apply; its historical distribution is shown below.' :
    'ALE is available after the next successful model update.';
  document.getElementById('detail-ale-chart').hidden = !available;
  document.getElementById('detail-band-key').hidden = !available || row.ci_status === 'insufficient_bootstrap_support';
  const block = payload?.confidence?.block_hours || 168;
  document.getElementById('detail-caption-text').textContent = available ?
    'Accumulated Local Effects (ALE) averages local changes in calibrated depeg probability, centered to a historical average of zero. Positive/negative values indicate higher/lower probability, in percentage points. This is a global association, not a causal or individual effect. Red marks the current value in both plots.' :
    'The distribution shows the full available feature history, excluding the current observation. The red line marks the current value.';
  document.getElementById('detail-caption-note').textContent = available ?
    `${row.effective_bins || 0} of ${row.requested_bins} requested quantile bins · ` +
    (row.status === 'constant' ? 'No variation in historical values; ALE is zero on observed support. ' :
      row.ci_status === 'ok' ? `Approx. 95% pointwise CI: ${row.bootstrap_valid_replicates} resamples of ${block}-hour blocks, fixed model. ` :
      'Too few bootstrap resamples covered every bin; confidence bands are unavailable. ') +
    'Excludes retraining uncertainty; not prediction intervals. ' +
    (full ? 'Full observed range.' : 'Central 99% range; distribution tails are grouped at the edges.') : '';
  const definition = result.feature_dictionary?.[feature];
  const currentLine = { id: 'aleCurrent', afterDatasetsDraw(chart) {
    if (!Number.isFinite(current)) return;
    const {ctx, chartArea: area, scales: {x}} = chart, px = x.getPixelForValue(marker);
    ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(px, area.top); ctx.lineTo(px, area.bottom); ctx.stroke();
    ctx.restore();
  }};
  const xScale = () => ({type:'linear', min, max, offset:false, border:{display:false}, grid:{color:'#edf2f6',offset:false},
    ticks:{color:MUTED, maxTicksLimit:window.innerWidth < 701 ? 4 : 6, font:{size:12}, callback:aleAxisNumber}});
  const common = {responsive:true, maintainAspectRatio:false, animation:false, parsing:false,
    layout:{padding:{right:8}}, interaction:{mode:'nearest', axis:'x', intersect:false},
    plugins:{legend:{display:false}, tooltip:{backgroundColor:'#fff', titleColor:BLUE,
      bodyColor:BLUE, borderColor:LINE, borderWidth:1}}};
  const yWidth = axis => { axis.width = window.innerWidth < 701 ? 51 : 65; };
  if (available) {
    const points = key => row.x.map((x, i) => ({x, y:row[key][i] === null ? null : row[key][i] * 100}));
    const interval = row.ci_lower?.every(Number.isFinite) && row.ci_upper?.every(Number.isFinite);
    const data = [
      {label:'95% CI lower', data:points('ci_lower'), borderWidth:0, pointRadius:0, hidden:!interval},
      {label:'95% CI upper', data:points('ci_upper'), borderWidth:0, pointRadius:0, hidden:!interval,
        fill:'-1', backgroundColor:'#0544761b'},
      {label:'ALE', data:points('effect'), borderColor:BLUE, backgroundColor:BLUE,
        borderWidth:2, pointRadius:row.status === 'constant' ? 4 : 1.5, pointHitRadius:8, tension:0}
    ];
    const zeroLine = {id:'aleZero', beforeDatasetsDraw(chart) {
      const {ctx,chartArea:area,scales:{y}}=chart, py=y.getPixelForValue(0);
      ctx.save();ctx.strokeStyle='#9cafbe';ctx.setLineDash([3,4]);
      ctx.beginPath();ctx.moveTo(area.left,py);ctx.lineTo(area.right,py);ctx.stroke();ctx.restore();
    }};
    aleCharts.push(new Chart(document.getElementById('detail-ale-chart'), {type:'line',
      data:{datasets:data}, plugins:[zeroLine,currentLine], options:{...common,
        plugins:{...common.plugins, tooltip:{...common.plugins.tooltip, callbacks:{
          title:items => items.length ? aleAxisNumber(items[0].parsed.x) : '',
          label:item => item.dataset.label + ': ' + signed(item.parsed.y) + ' pp'}}},
        scales:{x:xScale(), y:{afterFit:yWidth, border:{display:false},
          grid:{color:'#edf2f6'}, title:{display:true,text:'ALE (pp)',color:MUTED,font:{size:12}},
          ticks:{color:MUTED,maxTicksLimit:5,font:{size:12},callback:v => (v>0?'+':'')+aleAxisNumber(v)}}}}}));
  }
  document.getElementById('detail-histogram-title').textContent = 'Full-history distribution · ' +
    number(aleFeature.histogram?.reference_count || payload?.reference_rows || 0,0) + ' hourly values';
  const bars = counts.map((count,i) => ({x:(edges[i]+edges[i+1])/2,y:count}));
  aleCharts.push(new Chart(document.getElementById('detail-histogram-chart'), {type:'bar',
    data:{datasets:[{data:bars,backgroundColor:'#05447666',borderRadius:1,barPercentage:.95,categoryPercentage:1}]},
    plugins:[currentLine], options:{...common,
      plugins:{...common.plugins,tooltip:{...common.plugins.tooltip,callbacks:{
        title:items => {const i=items[0]?.dataIndex;return i===undefined?'':aleAxisNumber(edges[i])+' to '+aleAxisNumber(edges[i+1]);},
        label:item => number(item.parsed.y,0)+' hours'}}},
      scales:{x:{...xScale(),title:{display:true,text:definition?.units || feature,color:MUTED,font:{size:12}}},
        y:{afterFit:yWidth,beginAtZero:true,border:{display:false},grid:{display:false},
          ticks:{color:MUTED,maxTicksLimit:3,font:{size:11},callback:aleAxisNumber}}}}}));
}
