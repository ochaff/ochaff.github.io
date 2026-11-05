/* CRPS = integrated squared CDF gap. Paper twCRPS weights use ±10 bps, h=1 bp. */
const PredictionScorer=(()=>{
 const sigmoid=x=>1/(1+Math.exp(-x));
 const weight=z=>sigmoid(-10-z)+sigmoid(z-10);
 const gaussNodes=[.1834346424956498,.525532409916329,.7966664774136267,.9602898564975363];
 const gaussWeights=[.362683783378362,.313706645877887,.222381034453374,.101228536290376];
 function prepare(d,observations,plotRange=null){
  const values=observations.map(Number);if(!values.length||!values.every(Number.isFinite))throw Error('Finite realizations are required');
  const plotLow=plotRange?.low??Math.min(-25,Math.min(...values)-3,d.quantile(.02)),plotHigh=plotRange?.high??Math.max(25,Math.max(...values)+3,d.quantile(.98));
  // At ±50 bps, the tail weights differ from one by less than double precision.
  // Beyond these boundaries the GPD squared-CDF integrals are analytical.
  const low=Math.min(-50,plotLow,d.xL),high=Math.max(50,plotHigh,d.xU);
  const nodes=[low,high,plotLow,plotHigh,d.xL,d.xU,...values,...d.bodyKnots];
  for(let z=-40;z<=40;z+=.25)nodes.push(z);
  for(const [boundary,beta,sign] of [[d.xL,d.betaL,-1],[d.xU,d.betaU,1]]){
   const base=Math.max(.05,beta);for(let step=base;step<2*(high-low);step*=2)nodes.push(boundary+sign*step);
  }
  const grid=[...new Set(nodes.filter(z=>z>=low&&z<=high))].sort((a,b)=>a-b),prefix=grid.map(()=>[0,0,0,0]);
  for(let i=1;i<grid.length;i++){
   const middle=(grid[i]+grid[i-1])/2,half=(grid[i]-grid[i-1])/2,area=[0,0,0,0];
   for(let k=0;k<gaussNodes.length;k++)for(const sign of [-1,1]){
    const z=middle+sign*half*gaussNodes[k],f=d.cdf(z),s=d.survival(z),w=weight(z),factor=half*gaussWeights[k];
    area[0]+=factor*f*f;area[1]+=factor*s*s;area[2]+=factor*w*f*f;area[3]+=factor*w*s*s;
   }
   prefix[i]=prefix[i-1].map((v,k)=>v+area[k]);
  }
  const leftTail=d.cdf(low)**2*Math.max(0,d.betaL+d.xiL*(d.xL-low))/(2-d.xiL);
  const rightTail=d.survival(high)**2*Math.max(0,d.betaU+d.xiU*(high-d.xU))/(2-d.xiU);
  const index=new Map(grid.map((z,i)=>[z,i])),total=prefix.at(-1),atLow=prefix[index.get(plotLow)],atHigh=prefix[index.get(plotHigh)];
  let sum=0,weightedSum=0;
  const rows=values.map(y=>{
   const p=prefix[index.get(y)],crps=Math.max(0,leftTail+p[0]+total[1]-p[1]+rightTail),twcrps=Math.max(0,leftTail+p[2]+total[3]-p[3]+rightTail);
   sum+=crps;weightedSum+=twcrps;
   return {y,crps,twcrps,sum,weightedSum,visibleCRPS:p[0]-atLow[0]+atHigh[1]-p[1],visibleTWCRPS:p[2]-atLow[2]+atHigh[3]-p[3]};
  });
  return {rows,plotLow,plotHigh};
 }

 function markup(){return `<section class="card prediction-scorer" aria-labelledby="prediction-score-title"><div class="explainer-heading"><h3 id="prediction-score-title">Score the prediction</h3><label class="score-mode"><input type="checkbox" id="score-tail-weighted">twCRPS weighting</label></div><div class="score-overview"><div class="score-context"><p class="score-source" id="score-source">Waiting for the shaped distribution…</p><p class="score-weight-note">Two sigmoids · ±10 bps · h = 1 bp</p><small>Select a score card to switch the contribution plot.</small></div><div class="score-metrics"><button type="button" data-score-mode="crps" aria-label="Use CRPS" aria-pressed="true"><small>CRPS</small><strong><output id="score-value-crps">—</output><span> bps</span></strong></button><button type="button" data-score-mode="twcrps" aria-label="Use twCRPS" aria-pressed="false"><small>twCRPS</small><strong><output id="score-value-twcrps">—</output><span> bps</span></strong></button></div></div><div class="score-plot-switch" aria-label="Scoring plot"><button type="button" data-score-plot="cdf" aria-pressed="true">CDF</button><button type="button" data-score-plot="local" aria-pressed="false">Local error</button></div><div class="score-plots" data-mobile-view="cdf"><div class="score-plot-card" data-score-chart="cdf"><h4>Compare the CDF with the realization</h4><p>The forecast is a curve; the realization is a step from 0 to 1.</p><div class="score-chart"><canvas id="score-cdf-chart" role="img" aria-label="Forecast CDF and realization step, with the local gap highlighted"></canvas></div></div><div class="score-plot-card" data-score-chart="local"><h4>Square the gap and integrate</h4><p id="score-contribution-caption">Each deviation contributes its squared CDF gap.</p><div class="score-chart"><canvas id="score-contribution-chart" role="img" aria-label="Local squared CDF errors and optional two-sigmoid tail weights"></canvas></div></div></div><div class="score-controls"><label class="score-slider" for="score-probe"><span>Inspect local contribution <output id="score-probe-value"></output></span><input id="score-probe" type="range" min="-25" max="25" step="0.1" value="0"><small>Moves the highlighted CDF gap.</small></label><div class="score-realization-control"><label class="score-slider" for="score-realization"><span>Realization <output id="score-realization-value"></output></span><input id="score-realization" type="range" min="-25" max="25" step="0.1" value="0"></label><div class="score-realization-note"><small id="score-current-observation"></small><button type="button" class="secondary-button" id="score-latest">Latest observed</button></div></div></div><div class="score-gap-breakdown" id="score-gap-breakdown" aria-live="polite"></div><small class="score-area-note" id="score-area-note"></small></section>`}
 let root,distribution,scores,realization=NaN,probe=NaN,weighted=false,charts={},rangeLow=-25,rangeHigh=25,latest=null;
 const fmt=(x,n=3)=>Number.isFinite(x)?x.toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
 const signed=x=>(x>0?'+':'')+fmt(x,2);
 const date=x=>new Date(x).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC';
 const byId=id=>document.getElementById(id);
 function resize(){Object.values(charts).forEach(c=>c?.resize())}
 function setMode(value){weighted=value;byId('score-tail-weighted').checked=weighted;render()}
 function initialize(){
  const target=byId('prediction-score-title')?.closest('section');if(!target||target===root)return;
  Object.values(charts).forEach(c=>c?.destroy());charts={};root=target;realization=NaN;probe=NaN;weighted=byId('score-tail-weighted').checked;
  byId('score-tail-weighted').addEventListener('change',event=>setMode(event.target.checked));
  root.querySelectorAll('[data-score-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.scoreMode==='twcrps')));
  byId('score-realization').addEventListener('input',event=>{realization=Number(event.target.value);recalculate()});
  byId('score-probe').addEventListener('input',event=>{probe=Number(event.target.value);renderLocal()});
  byId('score-latest').addEventListener('click',()=>{if(latest){realization=latest.depeg_bps;recalculate()}});
  root.querySelectorAll('[data-score-plot]').forEach(button=>button.addEventListener('click',()=>{
   root.querySelector('.score-plots').dataset.mobileView=button.dataset.scorePlot;
   root.querySelectorAll('[data-score-plot]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));requestAnimationFrame(resize);
  }));
 }
 function setDistribution(d,context){
  initialize();if(!root)return;distribution=d;
  const valid=context.records.filter(r=>Number.isFinite(r.depeg_bps)&&Number.isFinite(Date.parse(r.timestamp))).slice().sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
  latest=valid.at(-1)||null;if(!Number.isFinite(realization))realization=latest?.depeg_bps??d.quantile(.5);
  const values=valid.map(r=>r.depeg_bps);rangeLow=Math.min(-25,...values,d.quantile(.02),realization)-3;rangeHigh=Math.max(25,...values,d.quantile(.98),realization)+3;
  if(!Number.isFinite(probe))probe=(realization+d.quantile(.5))/2;
  byId('score-source').textContent=`Uses the +${context.hour} h distribution from Shape. Move the realization to test any outcome.`;
  byId('score-latest').hidden=!latest;if(latest)byId('score-latest').title=`Use ${signed(latest.depeg_bps)} bps at ${date(latest.timestamp)}`;
  recalculate();
 }
 function recalculate(){scores=prepare(distribution,[realization],{low:rangeLow,high:rangeHigh});render()}
 const thresholdBands={id:'scoreThresholdBands',beforeDraw(chart){const {ctx,chartArea:a,scales:{x}}=chart;if(!a||!x)return;ctx.save();ctx.fillStyle='#DB354908';for(const [lo,hi] of [[x.min,Math.min(-10,x.max)],[Math.max(10,x.min),x.max]])if(hi>lo)ctx.fillRect(x.getPixelForValue(lo),a.top,x.getPixelForValue(hi)-x.getPixelForValue(lo),a.bottom-a.top);ctx.setLineDash([3,4]);ctx.strokeStyle='#DB354960';for(const z of [-10,10])if(z>x.min&&z<x.max){const px=x.getPixelForValue(z);ctx.beginPath();ctx.moveTo(px,a.top);ctx.lineTo(px,a.bottom);ctx.stroke()}ctx.restore()}};
 function updateChart(key,id,datasets,options,plugins=[]){if(charts[key]){charts[key].data.datasets=datasets;charts[key].options=options;charts[key].update('none')}else charts[key]=new Chart(byId(id),{type:'scatter',data:{datasets},options,plugins})}
 function baseOptions(xTitle,yTitle){return {responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:11}}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.parsed.y,4)}`}}},scales:{x:{type:'linear',min:scores.plotLow,max:scores.plotHigh,title:{display:true,text:xTitle,font:{size:12}},ticks:{maxTicksLimit:7,color:'#61798b',font:{size:11}},grid:{color:'#edf2f6'}},y:{min:0,title:{display:true,text:yTitle,font:{size:12}},ticks:{color:'#61798b',font:{size:11}},grid:{color:'#edf2f6'}}}}}
 const lineStyle={showLine:true,pointRadius:0,borderWidth:2,spanGaps:false};
 function renderLocal(){
  if(!scores)return;const row=scores.rows[0],y=row.y,lo=scores.plotLow,hi=scores.plotHigh;probe=Math.max(lo,Math.min(hi,probe));
  const xs=[...new Set([lo,hi,probe,y,-10,10,...Array.from({length:501},(_,i)=>lo+(hi-lo)*i/500)])].filter(z=>z>=lo&&z<=hi).sort((a,b)=>a-b);
  const gap=z=>z<y?distribution.cdf(z):-distribution.survival(z),square=z=>gap(z)**2;
  // Duplicate the observation's x coordinate so the integrand has a true jump.
  const contributions=weightedMode=>xs.flatMap(z=>{const w=weightedMode?weight(z):1;if(z===y)return [{x:z,y:distribution.cdf(z)**2*w},{x:z,y:distribution.survival(z)**2*w}];return [{x:z,y:square(z)*w}]});
  const cdfOptions=baseOptions('Signed depeg (bps)','CDF / observed step');cdfOptions.scales.y.max=1;
  updateChart('cdf','score-cdf-chart',[{...lineStyle,label:'Forecast CDF',data:xs.map(x=>({x,y:distribution.cdf(x)})),borderColor:'#054476'},{...lineStyle,label:'Realization step',data:[{x:lo,y:0},{x:y,y:0},{x:y,y:1},{x:hi,y:1}],borderColor:'#DB3549',borderDash:[5,3]},{...lineStyle,label:'Local CDF gap',data:[{x:probe,y:distribution.cdf(probe)},{x:probe,y:probe>=y?1:0}],borderColor:'#b18122',borderWidth:3,pointRadius:3}],cdfOptions,[thresholdBands]);
  const activeColor=weighted?'#DB3549':'#054476',localOptions=baseOptions('Signed depeg (bps)','Local squared error');localOptions.scales.y.max=1;
  localOptions.scales.weight={position:'right',min:0,max:1,title:{display:true,text:'Weight',font:{size:12}},grid:{display:false},ticks:{stepSize:.5,color:'#b18122',font:{size:11}}};
  updateChart('local','score-contribution-chart',[{...lineStyle,label:'Unweighted gap²',data:contributions(false),borderColor:'#b9c8d3',backgroundColor:'#61798b16',fill:'origin',borderWidth:1},{...lineStyle,label:weighted?'twCRPS contribution':'CRPS contribution',data:contributions(weighted),borderColor:activeColor,backgroundColor:activeColor+'28',fill:'origin'},{...lineStyle,label:weighted?'Two-sigmoid weight':'Uniform weight',data:xs.map(x=>({x,y:weighted?weight(x):1})),yAxisID:'weight',borderColor:'#b18122',borderDash:[4,3],borderWidth:1.5},{label:'Inspected contribution',data:[{x:probe,y:square(probe)*(weighted?weight(probe):1)}],pointRadius:4,pointBackgroundColor:activeColor,pointBorderColor:'#fff'}],localOptions,[thresholdBands]);
  byId('score-contribution-caption').textContent=weighted?'The two sigmoid weights suppress near-peg error and retain depeg-region error.':'The area under the squared CDF gap is the CRPS. Every deviation receives weight 1.';
  byId('score-probe').min=lo;byId('score-probe').max=hi;byId('score-probe').value=probe;byId('score-probe-value').textContent=signed(probe)+' bps';
  const f=distribution.cdf(probe),step=probe>=y?1:0,squared=square(probe),w=weighted?weight(probe):1;
  byId('score-gap-breakdown').innerHTML=[['Forecast CDF',fmt(f,3)],['Realization step',fmt(step,0)],['Squared gap',fmt(squared,4)],['Weight',fmt(w,4)],['Local contribution',fmt(squared*w,5)]].map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('');
  const visible=weighted?row.visibleTWCRPS:row.visibleCRPS,total=weighted?row.twcrps:row.crps;
  byId('score-area-note').textContent=`Area in view: ${fmt(visible,4)} bps · remaining tail area: ${fmt(Math.max(0,total-visible),4)} bps. Scores include the full GPD tails; the charts show a finite range.`;
 }

 function render(){
  if(!scores)return;const row=scores.rows[0];
  byId('score-realization').min=rangeLow;byId('score-realization').max=rangeHigh;byId('score-realization').value=realization;byId('score-realization-value').textContent=signed(realization)+' bps';
  byId('score-current-observation').textContent=latest&&Math.abs(realization-latest.depeg_bps)<1e-9?date(latest.timestamp):'Hypothetical outcome';
  byId('score-value-crps').textContent=fmt(row.crps);byId('score-value-twcrps').textContent=fmt(row.twcrps);
  root.querySelectorAll('[data-score-mode]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.scoreMode==='twcrps')===weighted)));
  renderLocal();
 }
 return {markup,setDistribution,resize,weight,prepare};
})();
