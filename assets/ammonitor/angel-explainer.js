const ANGEL_PARTS={
 inputs:{title:'1 · Two complementary histories',text:'Price history takes the target branch. Each on-chain or market variable takes the covariate branch. Both use only observations available in the trailing input window.'},
 revin:{title:'2 · Normalize the window',text:'Each series has its own level and units. RevIN puts the patterns on comparable scales, then restores location and scale to price units after forecasting.'},
 tcn:{title:'3 · See further back with dilation',text:'Follow the highlighted connections from the current output back through two causal convolutions. Increase the dilation to reach further into the past without reading future observations.'},
 tokens:{title:'4 · A whole sequence becomes one token',text:'A learned linear layer projects a variable’s entire normalized history into one embedding token. Its variable identity is then added, so the model can tell the tokens apart.'},
 selector:{title:'5 · Sparsemax can close a gate completely',text:'The target context helps score every covariate. Adjust the temperature to see which tokens enter. The example compares softmax’s positive weights with sparsemax’s exact zeros.'},
 fusion:{title:'6 · Each hour looks at different variables',text:'Read the matrix across a forecast hour to see which covariate tokens it attends to. Select a row to inspect its mixture, or switch the attention activation to compare sparsity.'},
 head:{title:'7 · One output vector per forecast hour',text:'Every fused horizon token passes through the same learned output network. Each hour gets its own location, scale, spline scores and two tail scores.'},
 distribution:{title:'8 · A flexible center with separate tails',text:'The spline models the central outcomes. Two GPD tails extend the rare lower and upper outcomes, joining smoothly to the body. Select a piece to see its role.'}
};
function angelArchitectureMarkup(){
 const node=(id,title,sub)=>`<button type="button" class="architecture-node" data-angel-part="${id}" aria-pressed="${id==='inputs'}" aria-controls="architecture-detail"><span>${title}</span><small>${sub}</small></button>`;
 return `<section class="card angel-architecture"><div class="explainer-heading"><div><p class="eyebrow">Inside the forecasting model</p><h3>ANGEL architecture</h3><p>Attentive Neural GatEd eLbo · select any stage to explore how it works.</p></div><span class="architecture-badge">Two branches → one distribution</span></div><div class="architecture-layout"><div class="architecture-flow" aria-label="Interactive ANGEL architecture">${node('inputs','Historical inputs','Target price + covariates')}<span class="flow-arrow" aria-hidden="true">↓</span>${node('revin','RevIN','Normalize each window')}<span class="flow-arrow" aria-hidden="true">↓</span><div class="architecture-branches"><div>${node('tcn','Causal TCN','Target → horizon tokens')}<span class="flow-arrow" aria-hidden="true">↓ target context ↘</span></div><div>${node('tokens','Variate tokens','One trajectory per variable')}<span class="flow-arrow" aria-hidden="true">↓</span>${node('selector','Sparse selector','GRN + temperature + sparsemax')}</div></div><span class="flow-arrow" aria-hidden="true">↘ &nbsp; merge &nbsp; ↙</span>${node('fusion','Cross-attention fusion','Horizon ← selected covariates')}<span class="flow-arrow" aria-hidden="true">↓</span>${node('head','Horizon output head','Location · scale · spline · tails')}<span class="flow-arrow" aria-hidden="true">↓</span>${node('distribution','Predictive distribution','Quantile spline + GPD tails')}</div><div class="architecture-detail" id="architecture-detail" aria-live="polite"></div></div></section>`;
}

function distributionShapeMarkup(){
 return `<section class="card distribution-explorer"><div class="explainer-heading"><div><h3>Shape the prediction</h3><p id="distribution-source">Loading distribution parameters…</p></div><button type="button" id="distribution-reset" class="secondary-button">Reset parameters</button></div><div class="distribution-toolbar"><label id="distribution-hour-label">Forecast hour <select id="distribution-hour" aria-label="Distribution forecast hour"></select></label><label>Controls <select id="distribution-control-group" aria-label="Distribution parameter group"><option value="location">Location & scale</option><option value="spline">Spline shape</option><option value="tails">GPD tails</option></select></label></div><div class="output-vector" id="distribution-vector" aria-label="Model output parameter vector"></div><div class="distribution-layout"><div id="distribution-controls" class="distribution-controls"></div><div class="distribution-plot"><div class="distribution-chart"><canvas id="distribution-chart" role="img" aria-label="Predictive density with spline body and GPD tails"></canvas></div><div id="distribution-summary" class="distribution-summary" aria-live="polite"></div></div></div><p class="distribution-note-detail">Edit a local scenario, then select Score to inspect its CRPS or twCRPS.</p></section>`;
}
let probabilityView='shape';
function probabilityMarkup(){
 return panel('distribution',`<nav class="probability-tabs" role="tablist" aria-label="Probability distribution views"><button id="probability-tab-shape" role="tab" data-probability="shape" aria-controls="probability-shape" aria-selected="true" tabindex="0">Shape</button><button id="probability-tab-score" role="tab" data-probability="score" aria-controls="probability-score" aria-selected="false" tabindex="-1">Score</button></nav><section class="probability-panel" id="probability-shape" role="tabpanel" aria-labelledby="probability-tab-shape">${distributionShapeMarkup()}</section><section class="probability-panel" id="probability-score" role="tabpanel" aria-labelledby="probability-tab-score" hidden>${PredictionScorer.markup()}</section>`,'probability-layout');
}
function resizeProbability(){if(probabilityView==='shape')distributionChart?.resize();else PredictionScorer.resize()}
function initProbabilityTabs(){
 const tabs=[...document.querySelectorAll('[data-probability]')];
 const select=button=>{probabilityView=button.dataset.probability;tabs.forEach(b=>{b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1});document.querySelectorAll('.probability-panel').forEach(p=>p.hidden=p.id!=='probability-'+probabilityView);requestAnimationFrame(resizeProbability)};
 tabs.forEach((button,i)=>{button.addEventListener('click',()=>select(button));button.addEventListener('keydown',event=>{const next=event.key==='ArrowRight'?(i+1)%tabs.length:event.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;if(next!==null){event.preventDefault();select(tabs[next]);tabs[next].focus()}})});
}
function initArchitectureDialog(){
 document.body.insertAdjacentHTML('beforeend',`<dialog id="angel-architecture-dialog" class="ale-dialog architecture-modal" aria-labelledby="angel-architecture-title"><div class="architecture-modal-content"><div class="architecture-modal-heading"><div><h2 id="angel-architecture-title">ANGEL architecture</h2><p>Select a stage to explore how the model works.</p></div><button type="button" id="architecture-close" class="ale-close" aria-label="Close ANGEL architecture">×</button></div><label class="architecture-stage-label">Stage <select id="architecture-stage" aria-label="Architecture stage">${Object.entries(ANGEL_PARTS).map(([id,part])=>`<option value="${id}">${part.title}</option>`).join('')}</select></label>${angelArchitectureMarkup()}</div></dialog>`);
 const dialog=document.getElementById('angel-architecture-dialog'),opener=document.getElementById('angel-architecture-open');
 opener.addEventListener('click',()=>dialog.showModal());document.getElementById('architecture-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>opener.focus());
 dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close()});
 document.getElementById('architecture-stage').addEventListener('change',event=>renderArchitectureDetail(event.target.value));
}
const AngelDistribution={
 softplus:x=>Math.max(0,x)+Math.log1p(Math.exp(-Math.abs(x))),
 interp(u,values,p){let i=0;while(i<u.length-2&&u[i+1]<p)i++;const w=(p-u[i])/(u[i+1]-u[i]);return values[i]*(1-w)+values[i+1]*w},
 evaluate(config,params){
  const eps=config.epsilon||1e-6,u=config.u,weights=params.slice(2,-2).map(x=>this.softplus(x)+eps);
  let Q=config.I.map(row=>row.reduce((s,x,k)=>s+x*weights[k],0));
  let q=config.M.map(row=>Math.max(eps,row.reduce((s,x,k)=>s+x*weights[k],0)));
  const center=this.interp(u,Q,.5);Q=Q.map(x=>x-center);
  const mu=Q.reduce((s,x,j)=>s+x*config.integration_weights[j],0),variance=Q.reduce((s,x,j)=>s+x*x*config.integration_weights[j],0)-mu*mu;
  const denom=config.normalization==='robust'?Math.max(eps,this.interp(u,Q,.75)-this.interp(u,Q,.25)):Math.sqrt(Math.max(0,variance)+eps);
  const alpha=(params[1]+eps)/denom;Q=Q.map(x=>params[0]+alpha*x);q=q.map(x=>alpha*x);
  const low=config.u_low,high=config.u_high,xL=this.interp(u,Q,low),xU=this.interp(u,Q,high),betaL=Math.max(eps,low*this.interp(u,q,low)),betaU=Math.max(eps,(1-high)*this.interp(u,q,high));
  const xi=x=>config.xi_min+(config.xi_max-config.xi_min)/(1+Math.exp(-x));const xiL=xi(params.at(-2)),xiU=xi(params.at(-1));
  const tail=(r,b,x)=>Math.abs(x)<1e-6?-b*Math.log(r):b*Math.expm1(-x*Math.log(r))/x;
  const quantile=p=>p<low?xL-tail(p/low,betaL,xiL):p>high?xU+tail((1-p)/(1-high),betaU,xiU):this.interp(u,Q,p);
  const derivative=p=>p<low?betaL/low*Math.pow(p/low,-xiL-1):p>high?betaU/(1-high)*Math.pow((1-p)/(1-high),-xiU-1):this.interp(u,q,p);
  const logSurvival=(excess,beta,shape)=>{
   if(Math.abs(shape)<1e-6)return -excess/beta;
   const t=1+shape*excess/beta;return t<=0?-Infinity:-Math.log1p(shape*excess/beta)/shape;
  };
  const bodyCDF=x=>{let lo=0,hi=Q.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(Q[mid]<=x)lo=mid;else hi=mid}return u[lo]+(u[hi]-u[lo])*(x-Q[lo])/(Q[hi]-Q[lo])};
  const cdf=x=>x<xL?low*Math.exp(logSurvival(xL-x,betaL,xiL)):x>xU?-Math.expm1(Math.log1p(-high)+logSurvival(x-xU,betaU,xiU)):bodyCDF(x);
  const survival=x=>x>xU?(1-high)*Math.exp(logSurvival(x-xU,betaU,xiU)):1-cdf(x);
  // Denser plotting grid; display truncates only the outermost 0.1% per tail.
  const grid=[...new Set([...u.filter(p=>p>=.001&&p<=.999),...Array.from({length:601},(_,i)=>.001+.998*i/600),low,high])].sort((a,b)=>a-b);
  return {points:grid.map(p=>({x:quantile(p),y:1/Math.max(eps,derivative(p)),p})),quantile,cdf,survival,xiL,xiU,betaL,betaU,xL,xU,bodyKnots:Q.filter(x=>x>=xL&&x<=xU)};
 }
};
let distributionConfig,distributionParameters,distributionChart;
function renderArchitectureDetail(id){
 const part=ANGEL_PARTS[id],root=document.getElementById('architecture-detail');
 root.innerHTML=`<p class="eyebrow">Architecture detail</p><h4>${part.title}</h4><p class="architecture-intro">${part.text}</p>${AngelArchitectureVisuals.render(id)}`;
 AngelArchitectureVisuals.bind(root.querySelector('.architecture-visual'),id);
 document.querySelectorAll('[data-angel-part]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.angelPart===id)));
 document.getElementById('architecture-stage').value=id;
}
async function initAngelExplorer(){
 initArchitectureDialog();initProbabilityTabs();
 document.querySelectorAll('[data-angel-part]').forEach(b=>b.addEventListener('click',()=>renderArchitectureDetail(b.dataset.angelPart)));renderArchitectureDetail('inputs');
 document.getElementById('distribution-control-group').addEventListener('change',updateDistributionControlGroup);
 try{
  const actual=result.forecasting?.distribution_explorer;
  if(actual?.status==='ok')distributionConfig=actual;
  else{const response=await fetch('assets/ammonitor/angel-distribution-example.json');if(!response.ok)throw Error('Example unavailable');distributionConfig=await response.json()}
  const current=distributionConfig.status==='ok',hour=document.getElementById('distribution-hour');
  document.getElementById('distribution-source').textContent=current?`Model output at ${time(result.forecasting.timestamp)} · edits are a local scenario.`:'Illustrative output vector using the released spline basis. Live parameters appear after the next inference run.';
  hour.innerHTML=distributionConfig.hourly_parameters.map((_,i)=>`<option value="${i}" ${i===distributionConfig.hourly_parameters.length-1?'selected':''}>+${i+1} h</option>`).join('');document.getElementById('distribution-hour-label').hidden=!current;
  const reset=()=>{distributionParameters=distributionConfig.hourly_parameters[Number(hour.value)].slice();renderDistributionControls();drawDistribution()};hour.addEventListener('change',reset);document.getElementById('distribution-reset').addEventListener('click',reset);reset();
 }catch(error){document.getElementById('distribution-source').textContent='Distribution explorer unavailable. Please reload to try again.';console.error(error)}
}
function renderDistributionControls(){
 const k=distributionParameters.length-4;
 const controls=[['Location b (bps)','Shifts the entire distribution.',0,Math.min(-20,distributionParameters[0]-20),Math.max(20,distributionParameters[0]+20),.1],['Scale s (bps)','Widens or narrows the body and matched tails.',1,.05,Math.max(12,distributionParameters[1]*3),.05],...Array.from({length:k},(_,i)=>[`Spline score a${i}`,`Softplus sets positive coefficient ${i}; changes body shape.`,i+2,Math.min(-6,distributionParameters[i+2]-2),Math.max(6,distributionParameters[i+2]+2),.05]),['GPD shape ξ↓','Lower-tail shape; the vector shows its raw score.',k+2,distributionConfig.xi_min+.0001,distributionConfig.xi_max-.0001,.001],['GPD shape ξ↑','Upper-tail shape; the vector shows its raw score.',k+3,distributionConfig.xi_min+.0001,distributionConfig.xi_max-.0001,.001]];
 document.getElementById('distribution-controls').innerHTML=controls.map(([label,help,i,min,max,step])=>{const tail=i>=k+2,value=tail?distributionConfig.xi_min+(distributionConfig.xi_max-distributionConfig.xi_min)/(1+Math.exp(-distributionParameters[i])):distributionParameters[i];return `<label class="distribution-control" data-control-group="${i<2?'location':tail?'tails':'spline'}" for="dist-param-${i}" title="${help}"><span>${label}<output id="dist-value-${i}">${number(value,tail?3:2)}</output></span><input id="dist-param-${i}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-dist-param="${i}"><small>${help}</small></label>`}).join('');
 updateDistributionControlGroup();
 document.querySelectorAll('[data-dist-param]').forEach(input=>input.addEventListener('input',()=>{const i=Number(input.dataset.distParam),value=Number(input.value),tail=i>=distributionParameters.length-2;distributionParameters[i]=tail?Math.log((value-distributionConfig.xi_min)/(distributionConfig.xi_max-value)):value;document.getElementById('dist-value-'+i).textContent=number(value,tail?3:2);drawDistribution()}));
}
function updateDistributionControlGroup(){
 const group=document.getElementById('distribution-control-group').value,container=document.getElementById('distribution-controls');
 container.classList.toggle('spline-control-group',group==='spline');container.querySelectorAll('[data-control-group]').forEach(el=>el.hidden=el.dataset.controlGroup!==group);
}
function drawDistribution(){
 const d=AngelDistribution.evaluate(distributionConfig,distributionParameters),c=distributionConfig,points=d.points;
 const lower=d.quantile(.01),upper=d.quantile(.99),median=d.quantile(.5);
 PredictionScorer.setDistribution(d,{records:result.price_history||[],hour:Number(document.getElementById('distribution-hour').value)+1});
 document.getElementById('distribution-vector').innerHTML=`<span>Per-hour output →</span><code>[b=${number(distributionParameters[0])}, s=${number(distributionParameters[1])}, a=[${distributionParameters.slice(2,-2).map(v=>number(v,2)).join(', ')}], raw ξ↓=${number(distributionParameters.at(-2))}, raw ξ↑=${number(distributionParameters.at(-1))}] → ξ↓=${number(d.xiL,3)}, ξ↑=${number(d.xiU,3)}</code>`;
 document.getElementById('distribution-summary').innerHTML=[['1% quantile',signed(lower)+' bps'],['Median',signed(median)+' bps'],['99% quantile',signed(upper)+' bps'],['ξ↓ / ξ↑',number(d.xiL,3)+' / '+number(d.xiU,3)]].map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('');
 const sets=[['Lower GPD tail',points.filter(p=>p.p<=c.u_low),'#b18122'],['Spline body',points.filter(p=>p.p>=c.u_low&&p.p<=c.u_high),BLUE],['Upper GPD tail',points.filter(p=>p.p>=c.u_high),RED]].map(([label,data,color])=>({label,data,borderColor:color,backgroundColor:color+'16',fill:'origin',pointRadius:0,borderWidth:2,showLine:true}));
 if(distributionChart){distributionChart.data.datasets=sets;distributionChart.update('none');return}
 distributionChart=new Chart(document.getElementById('distribution-chart'),{type:'scatter',data:{datasets:sets},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10}}},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${number(ctx.parsed.x,3)} bps · density ${number(ctx.parsed.y,4)}`}}},scales:{x:{type:'linear',title:{display:true,text:'Signed depeg (bps) · USDT per USDC'},grid:{color:'#edf2f6'},ticks:{color:MUTED,maxTicksLimit:7}},y:{beginAtZero:true,title:{display:true,text:'Density (1 / bps)'},grid:{color:'#edf2f6'},ticks:{color:MUTED,maxTicksLimit:5}}}}});
}
