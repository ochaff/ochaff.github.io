(() => {
  const figure = document.querySelector('[data-v3-history]');
  if (!figure) return;
  const curve = figure.querySelector('[data-history-chart=curve]'), scores = figure.querySelector('[data-history-chart=scores]');
  const period = figure.querySelector('#history-period'), date = figure.querySelector('#history-date'), slider = figure.querySelector('#history-day');
  const previous = figure.querySelector('#history-prev'), next = figure.querySelector('#history-next'), play = figure.querySelector('#history-play');
  const speed = figure.querySelector('#history-speed'), fixed = figure.querySelector('#history-fixed-scale');
  const readout = figure.querySelector('.shape-readout'), status = figure.querySelector('[data-history-status]');
  const paper = '#f4f7fc', ink = '#17384f', muted = '#62708a';
  const number = (n,digits=0) => n.toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits});
  let data, days = [], index = 0, playing = false, timer = 0, generation = 0, loading = false;
  let fixedTop = 1, scoreRange = [-1,1];
  function stop(label = 'Play days') {
    playing = false; generation++;
    clearTimeout(timer);
    play.textContent = label;
    play.dataset.playing = 'false';
    readout.setAttribute('aria-live','polite');
  }
  function chartLayout(plot,yTitle) {
    return {autosize:true,paper_bgcolor:paper,plot_bgcolor:paper,
      font:{family:'DM Sans, system-ui, sans-serif',size:plot.clientWidth<400?10:11,color:ink},
      margin:{l:58,r:14,t:44,b:54},barmode:'stack',bargap:0,
      xaxis:{title:{text:'USDT per USDC',standoff:10},tickformat:'.4f',gridcolor:'#d6e0ee',fixedrange:true},
      yaxis:{title:{text:yTitle,standoff:8},tickformat:'~s',gridcolor:'#d6e0ee',fixedrange:true},
      legend:{orientation:'h',x:.5,xanchor:'center',y:1.02,yanchor:'bottom',traceorder:'normal',font:{size:10}},
      hovermode:'x unified'};
  }
  async function render() {
    const day = days[index];
    if (!day) return;
    slider.value = index; date.value = day.date;
    figure.querySelector('[for=history-day] output').textContent = day.date+' · '+(index+1)+' / '+days.length;
    previous.disabled = index===0; next.disabled = index===days.length-1;
    const combined = day.usdc.map((n,i)=>n+day.usdt[i]);
    const top = fixed.checked ? fixedTop : Math.max(1,...combined)*1.08;
    const active = day.active_bin===null ? null : data.prices[day.active_bin];
    const traces = [
      {type:'bar',x:data.prices,y:day.usdc,width:data.bar_width,name:'USDC',marker:{color:'#054476'},hovertemplate:'Price: %{x:.6f}<br>USDC: $%{y:,.0f}<extra></extra>'},
      {type:'bar',x:data.prices,y:day.usdt,width:data.bar_width,name:'USDT',marker:{color:'#DB3549'},hovertemplate:'Price: %{x:.6f}<br>USDT: $%{y:,.0f}<extra></extra>'},
      {type:'scatter',x:[1,1],y:[0,top],mode:'lines',name:'Peg',line:{color:ink,width:1.3},showlegend:false,hoverinfo:'skip'},
      {type:'scatter',x:active===null?[]:[active,active],y:active===null?[]:[0,top],mode:'lines',name:'Active bin',line:{color:'#8094a3',width:1.3,dash:'dash'},hoverinfo:'skip'}
    ];
    const liquidityLayout = chartLayout(curve,'Liquidity ($ at par)');
    liquidityLayout.yaxis.range = [0,top];
    liquidityLayout.xaxis.range = [data.prices[0]-data.bar_width,data.prices.at(-1)+data.bar_width];
    if (active===null) liquidityLayout.annotations = [{xref:'paper',yref:'paper',x:.02,y:.98,xanchor:'left',yanchor:'top',showarrow:false,
      text:'Active price '+(day.pool_tick<data.tick_lowers[0]?'below':'above')+' displayed window',font:{color:muted,size:10},bgcolor:paper}];
    const coefficientLayout = chartLayout(scores,'Log-liquidity coefficient');
    coefficientLayout.xaxis = {title:{text:'Gegenbauer degree',standoff:10},type:'category',fixedrange:true};
    coefficientLayout.yaxis = {title:{text:'Coefficient',standoff:8},range:scoreRange,gridcolor:'#d6e0ee',zeroline:true,zerolinecolor:'#8094a3',zerolinewidth:1.2,fixedrange:true};
    coefficientLayout.showlegend = false;
    coefficientLayout.hovermode = 'closest';
    coefficientLayout.bargap = .35;
    const bar = {type:'bar',x:['1','2','3','4','5'],y:day.scores.slice(1),marker:{color:'#054476'},
      text:day.scores.slice(1).map(n=>number(n,2)),textposition:'outside',cliponaxis:false,
      hovertemplate:'Degree %{x}<br>Coefficient: %{y:.6f}<extra></extra>'};
    curve.setAttribute('aria-label','USDC and USDT liquidity distribution on '+day.date+', 00:00 UTC');
    scores.setAttribute('aria-label','Gegenbauer degree 1 through 5 coefficients on '+day.date+', 00:00 UTC');
    const sum = values=>values.reduce((a,b)=>a+b,0);
    readout.innerHTML = [['Snapshot (UTC)',day.date+' · 00:00'],['Pool price · tick estimate',day.tick_price.toFixed(6)],
      ['USDC in displayed bins','$'+number(sum(day.usdc))],['USDT in displayed bins','$'+number(sum(day.usdt))]]
      .map(([key,value])=>`<div><dt>${key}</dt><dd>${value}</dd></div>`).join('');
    status.textContent = 'Block '+number(day.block)+' · pool tick '+day.pool_tick+'. '+(active===null ?
      'The active price is outside this peg-centered window; no dashed marker is drawn. The bars still describe positions inside the displayed bins.' :
      'The solid line marks parity; the dashed line marks the active price bin.')+' Scores use this same snapshot’s raw active liquidity L, rather than the dollar bars.';
    const config = {responsive:true,displayModeBar:false};
    return Promise.all([Plotly.react(curve,traces,liquidityLayout,config),Plotly.react(scores,[bar],coefficientLayout,config)]);
  }
  function selectPeriod() {
    stop();
    const last = data.days.at(-1).date;
    const cutoff = new Date(last+'T00:00:00Z'); cutoff.setUTCDate(cutoff.getUTCDate()-89);
    const recentStart = cutoff.toISOString().slice(0,10);
    days = data.days.filter(day=>period.value==='all' || (period.value==='stress' ?
      day.date>='2023-03-01' && day.date<='2023-03-31' : day.date>=recentStart));
    if (!days.length) { period.value='all'; days=data.days; }
    date.min = days[0].date; date.max = days.at(-1).date;
    slider.max = days.length-1;
    index = period.value==='stress' ? Math.max(0,days.findIndex(day=>day.date==='2023-03-10')) : 0;
    fixedTop = Math.max(1,...days.map(day=>Math.max(...day.usdc.map((n,i)=>n+day.usdt[i]))))*1.08;
    const values = days.flatMap(day=>day.scores.slice(1)), low=Math.min(0,...values), high=Math.max(0,...values);
    const padding = Math.max(1,(high-low)*.2);
    scoreRange = [low-padding,high+padding];
    render();
  }
  function moveTo(nextIndex) {
    stop(); index=Math.max(0,Math.min(days.length-1,nextIndex)); render();
  }
  play.addEventListener('click',()=>{
    if (playing) { stop(); return; }
    if (index===days.length-1) index=0;
    playing=true; play.textContent='Pause days'; play.dataset.playing='true';
    readout.setAttribute('aria-live','off');
    const run=++generation;
    async function advance() {
      if (!playing || run!==generation) return;
      try { await render(); } catch { if (run===generation) stop(); return; }
      if (!playing || run!==generation) return;
      if (index===days.length-1) { stop('Replay days'); return; }
      timer=setTimeout(()=>{index++; advance();},Number(speed.value));
    }
    advance();
  });
  slider.addEventListener('input',()=>moveTo(Number(slider.value)));
  previous.addEventListener('click',()=>moveTo(index-1)); next.addEventListener('click',()=>moveTo(index+1));
  date.addEventListener('change',()=>{
    if (!date.value) { date.value=days[index].date; return; }
    const found=days.findIndex(day=>day.date>=date.value); moveTo(found<0?days.length-1:found);
  });
  period.addEventListener('change',selectPeriod); fixed.addEventListener('change',render);
  speed.addEventListener('change',()=>{ if (playing) stop(); });
  document.addEventListener('visibilitychange',()=>{if (document.hidden && playing) stop();});
  window.addEventListener('pagehide',()=>stop());
  async function load() {
    if (loading) return; loading=true;
    try {
      if (!window.Plotly) throw new Error('Plotting library unavailable');
      const response = await fetch(figure.dataset.historyUrl);
      if (!response.ok) throw new Error('Historical data unavailable');
      data = await response.json();
      if (data.schema_version!==1 || !data.days?.length) throw new Error('Unexpected history schema');
      figure.querySelectorAll('button,input,select').forEach(input=>input.disabled=false);
      figure.querySelector('[data-history-summary]').textContent = number(data.days.length)+' real daily snapshots · '+data.days[0].date+' to '+data.days.at(-1).date+' · 00:00 UTC · release '+data.source.release_tag;
      selectPeriod();
    } catch {
      figure.querySelector('[data-history-summary]').textContent='Historical charts could not load. Reload to retry, or download the linked daily extract below.';
      [curve,scores].forEach(plot=>{plot.textContent='Historical chart unavailable.';});
    }
  }
  if ('IntersectionObserver' in window) {
    const observer=new IntersectionObserver(entries=>{
      if (entries.some(entry=>entry.isIntersecting)) {observer.disconnect();load();}
    },{rootMargin:'600px'});
    observer.observe(figure);
  } else load();
})();
