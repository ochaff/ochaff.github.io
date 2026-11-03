/* L(p) is the sum of the liquidity of positions whose ranges contain p. */
(() => {
  const positions = [
    {name:'User A', lower:-100, upper:100, L:1.5, color:'#91a5b6', fill:'rgba(145,165,182,.35)'},
    {name:'User B', lower:-60, upper:-10, L:2, color:'#054476', fill:'rgba(5,68,118,.35)'},
    {name:'User C', lower:-25, upper:15, L:4, color:'#DB3549', fill:'rgba(219,53,73,.35)'},
    {name:'User D', lower:-8, upper:8, L:6, color:'#1b8b7e', fill:'rgba(27,139,126,.35)'},
    {name:'User E', lower:15, upper:60, L:3, color:'#bf8b2e', fill:'rgba(191,139,46,.35)'}
  ];
  const inRange = (position, bps) => bps >= position.lower && bps < position.upper;
  const liquidityAt = (included, bps) => included.reduce((sum, position) => sum + (inRange(position,bps) ? position.L : 0),0);
  const boundaries = [...new Set([-110,110,...positions.flatMap(p => [p.lower,p.upper])])].sort((a,b) => a-b);
  const binStarts = Array.from({length:220},(_,i) => i-110);
  if (typeof module !== 'undefined') module.exports = {positions, inRange, liquidityAt, boundaries, binStarts};
  if (typeof document === 'undefined') return;
  const figure = document.querySelector('[data-liquidity-explorer]');
  if (!figure) return;
  const plot = figure.querySelector('.amm-plot');
  if (!window.Plotly) { plot.textContent = 'The chart could not load. Overlapping positions add their L; near parity this example has 11.5 liquidity units.'; return; }
  plot.replaceChildren();
  const list = figure.querySelector('.liquidity-positions');
  positions.forEach((p,index) => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" value="${index}" checked aria-label="Include ${p.name}'s position"><i style="background:${p.color}" aria-hidden="true"></i><span><strong>${p.name} · L = ${p.L}</strong><small>${p.lower} to ${p.upper} bps</small></span>`;
    list.append(label);
  });
  const slider = figure.querySelector('#liquidity-price');
  const priceWindow = figure.querySelector('#liquidity-window');
  function render() {
    const bps = Number(slider.value), price = 1 + bps / 10000;
    const included = [...list.querySelectorAll('input:checked')].map(input => positions[Number(input.value)]);
    const active = included.filter(p => inRange(p,bps)), total = liquidityAt(included,bps);
    const number = n => n.toLocaleString('en-US',{maximumFractionDigits:1});
    figure.querySelector('output').textContent = price.toFixed(6) + ' · ' + (bps > 0 ? '+' : '') + bps + ' bps';
    const data = [];
    included.forEach(p => {
      data.push({type:'bar',name:p.name,x:binStarts.map(b => b+.5),
        y:binStarts.map(b => inRange(p,b) ? p.L : 0),width:.88,
        marker:{color:p.fill,line:{color:p.color,width:.35}},showlegend:false,
        customdata:binStarts.map(b => [(1+b/10000).toFixed(6),(1+(b+1)/10000).toFixed(6)]),
        hovertemplate:p.name+'<br>1 bp bin: %{customdata[0]}–%{customdata[1]}<br>Contribution L: %{y}<extra></extra>'});
    });
    data.push({type:'scatter',name:'Aggregate L',x:boundaries,y:boundaries.map(b => liquidityAt(included,b)),mode:'lines',
      line:{color:'#17384f',width:2.5,shape:'hv'},showlegend:false,
      hovertemplate:'Boundary: %{x:+.0f} bps<br>Total active L: %{y}<extra></extra>'});
    data.push({type:'scatter',x:[bps],y:[total],mode:'markers',marker:{color:'#DB3549',size:9,line:{color:'#fff',width:1.5}},
      showlegend:false,hovertemplate:'Selected price: '+price.toFixed(6)+'<br>Total active L: '+number(total)+'<extra></extra>'});
    const small = figure.clientWidth < 500;
    const windowBps = Number(priceWindow.value);
    Plotly.react(plot,data,{autosize:true,barmode:'stack',uirevision:'liquidity-positions-'+windowBps,paper_bgcolor:'#fff',plot_bgcolor:'#fff',
      font:{family:'DM Sans, system-ui, sans-serif',color:'#61798b',size:small?10:11},
      margin:{t:12,b:55,l:small?44:60,r:12},hovermode:'closest',
      xaxis:{title:{text:'Price from peg (bps) · USDT per USDC',standoff:12},range:[-windowBps,windowBps],dtick:windowBps>30?50:10,
        gridcolor:'#edf2f6',zerolinecolor:'#dce6ed',fixedrange:true},
      yaxis:{title:{text:'Active liquidity L',standoff:8},range:[0,13.5],dtick:3,gridcolor:'#edf2f6',zerolinecolor:'#dce6ed',fixedrange:true},
      shapes:[{type:'line',xref:'x',yref:'paper',x0:bps,x1:bps,y0:0,y1:1,line:{color:'#DB3549',width:1.5,dash:'dot'}}]
    },{responsive:true,displayModeBar:false});
    figure.querySelector('.amm-readout').innerHTML = [['Price (USDT / USDC)',price.toFixed(6)],
      ['Active positions',active.length+' / '+included.length],['Total active L',number(total)+' units']]
      .map(([label,value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
    figure.querySelector('.liquidity-active-names').textContent = active.length ?
      'At this price: '+active.map(p => p.name+' ('+p.L+')').join(' + ')+' = '+number(total)+' liquidity units.' :
      'No selected position covers this price. Active liquidity is zero here.';
  }
  list.addEventListener('change',render);
  slider.addEventListener('input',render);
  priceWindow.addEventListener('change',render);
  render();
})();
