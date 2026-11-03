/* Fee-free two-token examples; all prices are USDT per USDC. */
(() => {
  const reserve = 1000, D = 2 * reserve;
  function stableY(x, A) {
    // Two-coin whitepaper convention: Ann = A*n^n = 4A, D fixed.
    const ann = 4 * A, b = x + D / ann - D, c = D ** 3 / (4 * ann * x);
    const root = Math.sqrt(b * b + 4 * c);
    return b >= 0 ? 2 * c / (root + b) : (root - b) / 2;
  }
  function rangeParameters(bps) {
    const upper = 1 + bps / 10000, lower = 1 / upper;
    const L = reserve / (1 - 1 / Math.sqrt(upper));
    return {upper, lower, L, capacity:L * (1 / Math.sqrt(lower) - 1)};
  }
  function curve(kind, x, parameter) {
    if (kind === 'stable') return stableY(x, parameter);
    if (kind === 'v3') {
      const {L, upper, lower} = rangeParameters(parameter);
      return Math.max(0, L * L / (x + L / Math.sqrt(upper)) - L * Math.sqrt(lower));
    }
    return reserve * reserve / x;
  }
  function marginal(kind, x, parameter) {
    if (kind === 'v3') {
      const {L, upper} = rangeParameters(parameter);
      return (L / (x + L / Math.sqrt(upper))) ** 2;
    }
    const y = curve(kind, x, parameter);
    if (kind === 'stable') {
      const ann = 4 * parameter, c = D ** 3 / 4;
      return (ann + c / (x * x * y)) / (ann + c / (x * y * y));
    }
    return y / x;
  }
  function trade(kind, requested, parameter) {
    const capacity = kind === 'v3' ? rangeParameters(parameter).capacity : Infinity;
    const filled = Math.min(requested, capacity), x = reserve + filled;
    const y = curve(kind, x, parameter), received = reserve - y;
    const average = filled > 0 ? received / filled : 1;
    return {x, y, filled, unfilled:Math.max(0, requested - filled), received,
      average, impactBps:(1 - average) * 10000, price:marginal(kind, x, parameter), capacity};
  }
  if (typeof module !== 'undefined') module.exports = {stableY, rangeParameters, curve, marginal, trade};
  if (typeof document === 'undefined') return;

  const blue = '#054476', red = '#DB3549', muted = '#61798b';
  const num = (n, digits=2) => n.toLocaleString('en-US', {minimumFractionDigits:digits, maximumFractionDigits:digits});
  document.querySelectorAll('[data-amm]').forEach(figure => {
    const kind = figure.dataset.amm, plot = figure.querySelector('.amm-plot');
    if (!window.Plotly) { plot.textContent = 'The interactive chart could not load. The equations and worked example below remain available.'; return; }
    plot.replaceChildren();
    const slider = figure.querySelector('[data-control=trade]');
    const parameterControl = figure.querySelector('[data-control=parameter]');
    const view = figure.querySelector('[data-control=view]');
    const names = {cpmm:'Constant product', stable:'StableSwap', v3:'Concentrated position'};
    function render() {
      const parameter = Number(parameterControl?.value || 100);
      const amount = Number(slider.value), state = trade(kind, amount, parameter);
      figure.querySelector('output').textContent = num(amount, 0) + ' USDC';
      const priceView = view.value === 'price';
      plot.setAttribute('aria-label', names[kind] + (priceView ? ' marginal price versus USDC sold' : ' USDT reserves versus USDC reserves'));
      const maxX = kind === 'v3' ? reserve + state.capacity : 2300;
      const minX = kind === 'v3' ? 0 : kind === 'stable' ? 10 : 450;
      const xs = Array.from({length:241}, (_, i) => minX + (maxX - minX) * i / 240);
      const maxTrade = Math.min(1200, state.capacity);
      const amounts = Array.from({length:241}, (_, i) => maxTrade * i / 240);
      const hover = priceView ? 'USDC sold: %{x:,.1f}<br>Price from peg: %{y:,.2f} bps<extra>%{fullData.name}</extra>' :
        'USDC reserve: %{x:,.2f}<br>USDT reserve: %{y:,.2f}<extra>%{fullData.name}</extra>';
      const line = (name, x, y, color, dash) => ({type:'scatter',mode:'lines',name,x,y,
        line:{color,width:2.5,dash:dash || 'solid'},hovertemplate:hover});
      const data = [line(names[kind], priceView ? amounts : xs,
        priceView ? amounts.map(dx => (marginal(kind, reserve + dx, parameter) - 1) * 10000) : xs.map(x => curve(kind,x,parameter)), blue)];
      if (kind !== 'cpmm') {
        const reference = line('Constant product · same starting reserves', priceView ? amounts : xs,
          priceView ? amounts.map(dx => (marginal('cpmm',reserve + dx) - 1) * 10000) : xs.map(x => x > 0 ? curve('cpmm',x) : null), '#a4b5c2', 'dot');
        // Keep the near-peg price scale readable; readers can toggle comparison.
        if (priceView) reference.visible = 'legendonly';
        data.push(reference);
      } else if (!priceView) data.push(line('Constant sum · 1:1 reference', [0,2000],[2000,0],'#a4b5c2','dot'));
      data.push({type:'scatter',mode:'markers',name:'Before swap',x:[priceView?0:reserve],y:[priceView?0:reserve],
        marker:{color:blue,size:9,symbol:'circle-open',line:{width:2}},hovertemplate:hover});
      data.push({type:'scatter',mode:'markers',name:'After swap',x:[priceView?state.filled:state.x],
        y:[priceView?(state.price-1)*10000:state.y],marker:{color:red,size:11,line:{color:'#fff',width:1.5}},hovertemplate:hover});
      const annotations = [];
      if (kind === 'v3') {
        const endX = priceView ? state.capacity : maxX;
        const endY = priceView ? (rangeParameters(parameter).lower-1)*10000 : 0;
        const w = priceView ? 12 : 25, h = priceView ? Math.max(1,Math.abs(endY)*.07) : 60;
        const bx = [endX-w,endX,endX,endX-w], by = [endY+h,endY+h,endY-h,endY-h];
        if (!priceView) {
          const startY = curve(kind,0,parameter);
          bx.push(null,w,0,0,w);by.push(null,startY+h,startY+h,startY-h,startY-h);
        }
        data.push({type:'scatter',mode:'lines',name:'Range boundary',x:bx,y:by,
          line:{color:blue,width:2},showlegend:false,hovertemplate:'Position ends here<extra></extra>'});
        annotations.push({x:endX,y:endY,text:'Range ends',showarrow:false,xanchor:'right',yanchor:'bottom',
          xshift:-8,yshift:12,font:{size:10,color:blue},bgcolor:'rgba(255,255,255,.85)'});
      }
      const small = figure.clientWidth < 500;
      Plotly.react(plot, data, {autosize:true,uirevision:kind+'-'+view.value,paper_bgcolor:'#fff',plot_bgcolor:'#fff',annotations,
        font:{family:'DM Sans, system-ui, sans-serif',color:muted,size:small?10:11},
        margin:{t:8,b:small?98:80,l:small?49:67,r:12},
        legend:{orientation:'h',x:0,y:small?-.28:-.22,font:{size:small?9:10}},
        xaxis:{title:{text:priceView?'USDC sold into pool':'USDC in pool',standoff:12},
          range:priceView?[0,1200]:[kind==='v3'?-80:0,2300],gridcolor:'#edf2f6',zeroline:false,nticks:small?4:6,fixedrange:true},
        yaxis:{title:{text:priceView?'Marginal price from peg (bps)':'USDT in pool',standoff:10},
          ...(!priceView?{range:[kind==='v3'?-180:0,2300]}:{}),gridcolor:'#edf2f6',zerolinecolor:'#c8d6e0',tickformat:priceView?',.1f':',.0f',nticks:5,fixedrange:true},
        showlegend:true,hovermode:'closest'}, {responsive:true,displayModeBar:false});
      const metrics = [['USDT received',num(state.received)],['Average price',num(state.average,6)],
        ['Price impact',num(Math.max(0,state.impactBps),2)+' bps'],['Next marginal price',num(state.price,6)]];
      figure.querySelector('.amm-readout').innerHTML = metrics.map(([name,value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('');
      figure.dataset.boundary = String(state.unfilled > 1e-7);
      figure.querySelector('.amm-status').textContent = kind === 'v3' ?
        (state.unfilled > 1e-7 ? `Range boundary reached: only ${num(state.filled)} USDC can be sold into this position; ${num(state.unfilled)} USDC remains unfilled. It now holds only USDC. Other positions would be needed to continue.` :
          `Active range: ${num(rangeParameters(parameter).lower,6)}–${num(rangeParameters(parameter).upper,6)} USDT per USDC. This position can absorb ${num(state.capacity)} USDC before reaching its lower boundary.`) :
        'Average and marginal prices are USDT per USDC. Price impact is measured against the initial 1:1 quote.';
    }
    figure.querySelectorAll('input').forEach(control => control.addEventListener('input', render));
    figure.querySelectorAll('select').forEach(control => control.addEventListener('change', render));
    render();
  });
})();
