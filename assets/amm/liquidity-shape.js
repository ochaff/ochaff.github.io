(() => {
  const M = globalThis.LiquidityShapeMath;
  const blue = '#2568d8', red = '#e64d62', muted = '#62708a', ink = '#10203a', paper = '#f4f7fc';
  const colors = ['#2568d8','#24836b','#bd7624','#8d67b5','#e64d62'];
  const number = (n, digits = 0) => n.toLocaleString('en-US', {maximumFractionDigits: digits, minimumFractionDigits: digits});
  const signed = (n, digits = 1) => {
    const rounded = Number(n.toFixed(digits)) || 0;
    return (rounded > 0 ? '+' : '') + number(rounded, digits);
  };
  const bps = p => (p - 1) * 10000;
  const line = (name, x, y, color, extra = {}) => ({type:'scatter', mode:'lines', name, x, y,
    line:{color,width:2.5}, ...extra});
  const marker = (x,y,name = 'After swap') => ({type:'scatter',mode:'markers',name,x:[x],y:[y],
    marker:{color:red,size:9,line:{color:paper,width:1.5}},showlegend:false,
    hovertemplate:'%{x:,.1f}<br>%{y:,.3f}<extra>'+name+'</extra>'});
  function layout(plot, xTitle, yTitle, extra = {}) {
    const narrow = plot.clientWidth < 450;
    return {autosize:true,paper_bgcolor:paper,plot_bgcolor:paper,
      font:{family:'DM Sans, system-ui, sans-serif',size:narrow?10:11,color:muted},
      margin:{l:narrow?48:62,r:12,t:16,b:92},
      xaxis:{title:{text:xTitle,standoff:10},gridcolor:'#d6e0ee',zerolinecolor:'#aabbd3',fixedrange:true},
      yaxis:{title:{text:yTitle,standoff:8},gridcolor:'#d6e0ee',zerolinecolor:'#aabbd3',fixedrange:true},
      legend:{orientation:'h',x:0,y:-.32,font:{size:10}},hovermode:'closest',
      ...extra};
  }
  const config = {responsive:true,displayModeBar:false};
  function draw(plot, traces, options) { return Plotly.react(plot,traces,options,config); }
  function readout(figure, values) {
    figure.querySelector('.shape-readout').innerHTML = values.map(([key,value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('');
  }
  function prepare(figure) {
    const plots = [...figure.querySelectorAll('.shape-plot')];
    if (!M || !globalThis.Plotly) {
      plots.forEach(plot => { plot.textContent = 'The interactive chart could not load. The equations and explanations below remain available; reload to try again.'; });
      return false;
    }
    plots.forEach(plot => plot.replaceChildren());
    return true;
  }
  function initFees(figure) {
    const plot = figure.querySelector('.shape-plot');
    const width = figure.querySelector('#fee-width'), price = figure.querySelector('#fee-price');
    function render() {
      const w = Number(width.value), p = Number(price.value), state = M.position(w,p);
      figure.querySelector('[for=fee-width] output').textContent = '+' + w + ' bps';
      figure.querySelector('[for=fee-price] output').textContent = signed(p,0) + ' bps';
      const lo = bps(state.lower), hi = bps(state.upper);
      const xs = [-110,lo,lo,hi,hi,110];
      const bg = xs.map(()=>100), own = [0,0,state.L/1e6,state.L/1e6,0,0];
      const total = 100 + (state.active ? state.L/1e6 : 0);
      const traces = [
        line('Other LPs',xs,bg,'#aabbd3',{fill:'tozeroy',fillcolor:'rgba(170,187,211,.2)',hovertemplate:'Other LPs: L = 100m<extra></extra>'}),
        line('Your position',xs,own.map((v,i)=>v+bg[i]),blue,{fill:'tonexty',fillcolor:'rgba(37,104,216,.2)',hovertemplate:'Price from peg: %{x:.2f} bps<br>Total L: %{y:.1f}m<extra></extra>'}),
        marker(p,total,'Selected price')
      ];
      draw(plot,traces,layout(plot,'Price from peg (bps) · USDT per USDC','Active L (millions)',{
        shapes:[{type:'line',xref:'x',yref:'paper',x0:p,x1:p,y0:0,y1:1,line:{color:red,width:1.5,dash:'dot'}}]
      }));
      readout(figure,[['Your position',state.active?'In range':'Out of range'],['Your liquidity L',number(state.L/1e6,1)+'m'],
        ['Share of active L',number(state.share*100,1)+'%'],['From a 100-token LP fee pot',number(100*state.share,2)+' tokens']]);
      figure.querySelector('.shape-status').textContent = state.active ?
        'Your range covers '+signed(lo,2)+' to +'+number(hi,2)+' bps. At this price your L is added to other LPs’ L, and the fee pot is shared in the same proportions.' :
        'Your position still exists, but contributes no active liquidity here. It is entirely in USDC below the lower bound, or USDT above the upper bound, and earns no swap fees while out of range.';
    }
    width.addEventListener('input',render); price.addEventListener('input',render);
    render();
  }
  function initImpact(figure) {
    const liquidityPlot = figure.querySelector('[data-chart=liquidity]'), impactPlot = figure.querySelector('[data-chart=impact]');
    const control = figure.querySelector('#impact-profile'), volume = figure.querySelector('#impact-volume'), showReference = figure.querySelector('#impact-reference');
    const sweep = figure.querySelector('#impact-sweep'), reset = figure.querySelector('#impact-reset'), direction = figure.querySelector('#impact-direction');
    const maxAmount = Number(volume.max);
    const reference = M.makeBins('balanced');
    const amounts = Array.from({length:241},(_,i)=>-maxAmount+2*maxAmount*i/240);
    function impactCurve(bins) {
      const curve = amounts.map(a=>({q:a,...M.swap(bins,a)})).filter(point=>point.unfilled<.001);
      for (const a of [-maxAmount,maxAmount]) {
        const end = M.swap(bins,a);
        if (end.unfilled>.001) curve.push({q:Math.sign(a)*end.filled,...end});
      }
      return curve.sort((a,b)=>a.q-b.q);
    }
    const referenceCurve = impactCurve(reference);
    const descriptions = {
      balanced:'A flat, symmetric reference. Liquidity at the peg and in both directions is the same.',
      global:'Most liquidity is above the peg, but the central ±25 bps are identical to the balanced reference. Small trades cannot see the distant imbalance.',
      local:'The whole-window imbalance is zero, yet liquidity is thinner just below the peg and thicker just above it. Trades discover that asymmetry as they leave the central bin.',
      thin:'The whole-window imbalance is zero, but L at the peg is five times lower than in the reference. The initial impact curve is five times steeper.',
      concentrated:'Deep liquidity keeps price movement small around parity. Once the swap reaches thinner tails, the same added input moves the price much faster: a StableSwap-like response produced here by a V3 liquidity profile.'
    };
    let cache = {};
    function render() {
      const kind = control.value, q = Number(volume.value), bins = M.makeBins(kind), state = M.swap(bins,q);
      if (!cache[kind]) cache[kind] = impactCurve(bins);
      const localL = bins.find(bin=>bin.lower<=1 && bin.upper>1).L;
      const sellingDirection = q===0 ? Number(direction.value) : Math.sign(q);
      const response = M.localImpact(bins,state.price,sellingDirection), currentL = response.L;
      figure.querySelector('[for=impact-volume] output').textContent = number(Math.abs(q))+' '+(sellingDirection>0?'USDC':'USDT')+' sold · '+signed(state.bps,2)+' bps from peg';
      figure.querySelector('.shape-local-response').textContent = 'Local tangent here: '+number(response.bpsPer100k,2)+' bps per 100,000 '+(sellingDirection>0?'USDC':'USDT')+' input · active L = '+number(currentL/1e6,1)+'m';
      const xs = bins.map(bin=>bps(bin.lower)).concat(100);
      const ys = bins.map(bin=>bin.L/1e6).concat(bins.at(-1).L/1e6);
      const liquidity = [line('Selected profile',xs,ys,blue,{line:{color:blue,width:2.5,shape:'hv'},fill:'tozeroy',fillcolor:'rgba(37,104,216,.09)',
        hovertemplate:'Price from peg: %{x:.1f} bps<br>L: %{y:.2f}m<extra></extra>'})];
      if (showReference.checked && kind!=='balanced') liquidity.push(line('Balanced reference',[-100,100],[200,200],muted,{line:{color:muted,width:1.5,dash:'dot'}}));
      liquidity.push(marker(state.bps,currentL/1e6));
      const liquidityDraw = draw(liquidityPlot,liquidity,layout(liquidityPlot,'Price from peg (bps)','Active L (millions)',{
        shapes:[{type:'line',xref:'x',yref:'paper',x0:state.bps,x1:state.bps,y0:0,y1:1,line:{color:red,width:1.5,dash:'dot'}},
          {type:'line',xref:'x',yref:'paper',x0:0,x1:0,y0:0,y1:1,line:{color:muted,width:1,dash:'dot'}}]
      }));
      const impact = [line('Actual impact',cache[kind].map(point=>point.q/1000),cache[kind].map(point=>point.bps),blue,{hovertemplate:'Filled input: %{x:.0f}k tokens<br>Final price: %{y:.2f} bps<extra></extra>'}),
        line('Tangent at peg',[-maxAmount/1000,maxAmount/1000],[-maxAmount,maxAmount].map(a=>-2*a/localL*10000),red,{line:{color:red,width:1.5,dash:'dash'}})];
      if (showReference.checked && kind!=='balanced') impact.push(line('Balanced reference',referenceCurve.map(point=>point.q/1000),referenceCurve.map(point=>point.bps),muted,{line:{color:muted,width:1.5,dash:'dot'}}));
      impact.push(marker(Math.sign(q)*state.filled/1000,state.bps));
      const impactLayout = layout(impactPlot,'Signed filled input (thousands of tokens)','Post-swap price from peg (bps)');
      // Keep the distant extrapolation of the tangent from hiding the actual curve.
      const extent = Math.max(10,...cache[kind].map(point=>Math.abs(point.bps)),...(showReference.checked?referenceCurve.map(point=>Math.abs(point.bps)):[]));
      impactLayout.yaxis.range = [-extent*1.12,extent*1.12];
      impactLayout.xaxis.range = [-maxAmount/1000,maxAmount/1000];
      const impactDraw = draw(impactPlot,impact,impactLayout);
      const quote = state.price.toFixed(6);
      readout(figure,[['Window shape imbalance I',signed(100*M.imbalance(bins),1)+'%'],['L at peg',number(localL/1e6,1)+'m'],
        ['Final USDT per USDC',quote],['Output received',number(state.output,1)+' '+(sellingDirection<0?'USDC':'USDT')]]);
      figure.querySelector('.shape-status').textContent = descriptions[kind] + ' ' + (state.unfilled>0.001 ?
        number(state.filled)+' input tokens were filled; '+number(state.unfilled)+' lie outside this modeled window and are not simulated. The impact marker stops at the filled amount.' :
        'The red point follows your swap; the dashed line extrapolates the local tangent at the starting price.');
      return Promise.all([liquidityDraw,impactDraw]);
    }
    let playing = false, frame = 0, generation = 0;
    function stop(label = 'Resume sweep') {
      playing = false;
      generation++;
      cancelAnimationFrame(frame);
      sweep.textContent = label;
      sweep.dataset.playing = 'false';
      figure.querySelector('.shape-readout').setAttribute('aria-live','polite');
    }
    function resetSweep() {
      stop('Sweep swaps');
      volume.value = '0';
      render();
    }
    sweep.addEventListener('click',()=>{
      if (playing) { stop(); return; }
      const sign = Number(direction.value), bins = M.makeBins(control.value);
      const step = Number(volume.step);
      const limit = Math.floor(Math.min(maxAmount,M.swap(bins,sign*maxAmount).filled)/step)*step;
      const current = sign*Number(volume.value);
      const startInput = sweep.textContent==='Resume sweep' && current>=0 && current<limit ? current : 0;
      const started = performance.now(), run = ++generation;
      playing = true;
      sweep.textContent = 'Pause sweep';
      sweep.dataset.playing = 'true';
      // Avoid continuous screen-reader announcements while the charts move.
      figure.querySelector('.shape-readout').setAttribute('aria-live','off');
      volume.value = String(sign*startInput);
      let lastPaint = -Infinity;
      async function advance(now) {
        if (!playing || run!==generation) return;
        if (now-lastPaint<80) { frame=requestAnimationFrame(advance); return; }
        lastPaint = now;
        const input = Math.min(limit,startInput+(now-started)*120);
        volume.value = String(sign*Math.min(limit,Math.round(input/step)*step));
        try { await render(); }
        catch { if (run===generation) stop('Sweep swaps'); return; }
        if (!playing || run!==generation) return;
        if (input>=limit) { stop('Replay sweep'); return; }
        frame = requestAnimationFrame(advance);
      }
      frame = requestAnimationFrame(advance);
    });
    reset.addEventListener('click',resetSweep);
    direction.addEventListener('change',resetSweep);
    control.addEventListener('change',resetSweep);
    volume.addEventListener('input',()=>{
      stop('Sweep swaps');
      if (Number(volume.value)!==0) direction.value = Number(volume.value)>0 ? '1' : '-1';
      render();
    });
    showReference.addEventListener('change',render);
    document.addEventListener('visibilitychange',()=>{ if (document.hidden && playing) stop(); });
    window.addEventListener('pagehide',()=>stop());
    render();
  }
  function initPolynomial(figure) {
    const plot = figure.querySelector('.shape-plot'), inputs = [...figure.querySelectorAll('[data-degree]')];
    const degree = figure.querySelector('#poly-degree'), preset = figure.querySelector('#poly-preset');
    const presets = {peak:[0,-.5,0,.15,0],tilt:[.4,-.3,0,.1,0],shoulder:[.2,-.3,-.4,.15,.2],flat:[0,0,0,0,0]};
    const xs = Array.from({length:241},(_,i)=>-100+200*i/240);
    function render() {
      const cutoff = Number(degree.value), scores = inputs.map(input=>Number(input.value));
      inputs.forEach((input,i)=>{
        input.disabled = i>=cutoff;
        figure.querySelector('[for='+input.id+'] output').textContent = i>=cutoff ? 'excluded' : signed(Number(input.value),2);
      });
      const ys = xs.map(b=>M.reconstruct(scores,b/100,cutoff)/1e6);
      const traces = [line('Reconstructed L',xs,ys,blue,{fill:'tozeroy',fillcolor:'rgba(37,104,216,.09)',
        hovertemplate:'Price from peg: %{x:.1f} bps<br>Reconstructed L: %{y:.2f}m<extra></extra>'}),
        line('Flat baseline',[-100,100],[100,100],muted,{line:{color:muted,width:1.5,dash:'dot'}})];
      draw(plot,traces,layout(plot,'Price from peg (bps) · USDT per USDC','Active L (millions)'));
      const atPeg = M.reconstruct(scores,0,cutoff), epsilon = .01;
      const slope = (M.reconstruct(scores,epsilon/100,cutoff)-M.reconstruct(scores,-epsilon/100,cutoff))/(2*epsilon);
      const bins = M.mids.map(b=>({lower:1+(b-.5)/10000,upper:1+(b+.5)/10000,L:M.reconstruct(scores,b/100,cutoff)}));
      readout(figure,[['Terms retained','0–'+cutoff],['L at peg',number(atPeg/1e6,1)+'m'],
        ['Local slope dL / d(bp)',signed(slope/1e6,2)+'m / bp'],['Window shape imbalance I',signed(100*M.imbalance(bins),1)+'%']]);
    }
    function loadPreset() {
      inputs.forEach((input,i)=>{input.value=presets[preset.value][i];});
      render();
    }
    inputs.forEach(input=>input.addEventListener('input',render));
    degree.addEventListener('change',render); preset.addEventListener('change',loadPreset);
    figure.querySelector('#poly-reset').addEventListener('click',loadPreset);
    loadPreset();
  }
  document.querySelectorAll('[data-shape]').forEach(figure=>{
    if (!prepare(figure)) return;
    ({fees:initFees,impact:initImpact,polynomial:initPolynomial})[figure.dataset.shape](figure);
  });
})();
