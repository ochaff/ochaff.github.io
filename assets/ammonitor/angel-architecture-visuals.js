/* Schematic, interactive teaching diagrams; values are illustrative, not attention diagnostics. */
const AngelArchitectureVisuals=(()=>{
 const blue='#054476',red='#DB3549',gold='#b18122',muted='#61798b';
 const names=['Liquidity','Volume','Volatility','Macro','Pool age'];
 const state={dilation:2,variable:0,temperature:1,attentionRow:0,attentionActivation:'sparsemax',headHour:0,distributionPart:'body'};
 const softmax=values=>{const max=Math.max(...values),exp=values.map(v=>Math.exp(v-max)),sum=exp.reduce((a,b)=>a+b,0);return exp.map(v=>v/sum)};
 function sparsemax(values){
  const sorted=values.slice().sort((a,b)=>b-a);let sum=0,k=0,threshold=0;
  sorted.forEach((v,i)=>{sum+=v;if(1+(i+1)*v>sum){k=i+1;threshold=(sum-1)/k}});
  return values.map(v=>Math.max(0,v-threshold));
 }
 const gates=()=>sparsemax([2.4,1.8,.6,-.4,-1].map(v=>v/state.temperature));
 const text=(x,y,value,cls='',extra='')=>`<text x="${x}" y="${y}" class="${cls}" ${extra}>${value}</text>`;
 const line=(x1,y1,x2,y2,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extra}/>`;
 const box=(x,y,w,h,label,sub='',color=blue)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${color}0c" stroke="${color}50"/>${text(x+w/2,y+h/2+(sub?-3:4),label,'av-label','text-anchor="middle"')}${sub?text(x+w/2,y+h/2+14,sub,'av-small','text-anchor="middle"'):''}`;
 const svg=(label,content,height=260)=>`<svg class="architecture-svg" viewBox="0 0 480 ${height}" role="img" aria-label="${label}"><defs><marker id="av-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${muted}"/></marker></defs>${content}</svg>`;
 const arrow=(x1,y1,x2,y2)=>line(x1,y1,x2,y2,`stroke="${muted}" stroke-width="1.4" marker-end="url(#av-arrow)"`);
 const pill=(label,cls='')=>`<span class="av-pill ${cls}">${label}</span>`;
 const buttons=(key,values,chosen)=>`<div class="av-button-group">${values.map(([value,label])=>`<button type="button" data-av-control="${key}" data-av-value="${value}" aria-pressed="${String(chosen)===String(value)}">${label}</button>`).join('')}</div>`;
 const spark=(values,x,y,w,h,color=blue)=>{const lo=Math.min(...values),span=Math.max(...values)-lo||1;return `<polyline points="${values.map((v,i)=>`${x+i*w/(values.length-1)},${y+h-(v-lo)/span*h}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`};
 function inputs(){
  const rows=['Target price',...names.slice(0,3)];let content=text(160,21,'Older observations','av-small')+text(435,21,'Now','av-small','text-anchor="end"');
  rows.forEach((label,r)=>{const y=36+r*38;content+=text(0,y+16,label,'av-label');for(let i=0;i<12;i++)content+=`<rect x="${133+i*25}" y="${y}" width="20" height="27" rx="3" fill="${r?blue:red}" opacity="${.12+((i*7+r*3)%11)/14}"/>`});
  content+=arrow(258,196,153,231)+arrow(290,196,391,231)+box(40,236,210,44,'Target branch','Causal TCN',red)+box(272,236,200,44,'Covariate branch','One token per variable');
  return svg('Past observations split into the target-price branch and the covariate branch',content,290);
 }
 function revin(){
  let content=text(116,20,'Different units & levels','av-label','text-anchor="middle"')+text(366,20,'Comparable window patterns','av-label','text-anchor="middle"');
  [[2,3,2,5,4,7,6,5],[8,6,7,5,6,4,5,7],[1,1.4,1.1,1.7,1.5,1.3,1.8,1.6]].forEach((v,i)=>{const y=40+i*58;content+=`<rect x="15" y="${y}" width="190" height="45" rx="5" fill="#fff"/>`+spark(v,25,y+8,168,28,[red,blue,gold][i])+arrow(214,y+23,258,y+23)+line(278,y+23,458,y+23,'stroke="#bccdd9" stroke-dasharray="4 3"')+spark(v,280,y+8,170,28,[red,blue,gold][i])});
  content+=box(26,231,175,46,'Normalize each window')+arrow(212,254,257,254)+box(268,231,190,46,'Restore forecast units','Location & scale after the head');
  return svg('Three input series are normalized independently and forecasts are restored to price units',content,290);
 }
 function tcn(){
  const d=state.dilation,x=i=>69+i*24,y=[63,139,215],now=16;
  let content='';
  for(let j=0;j<3;j++)for(let k=0;k<3;k++)content+=line(x(now-(j+k)*d),y[0],x(now-j*d),y[1],`stroke="${blue}" stroke-opacity=".25" stroke-width="1.5"`);
  for(let j=0;j<3;j++)content+=line(x(now-j*d),y[1],x(now),y[2],`stroke="${red}" stroke-width="2"`);
  y.forEach((yy,level)=>{content+=text(0,yy-17,['Input','Conv 1','Conv 2'][level],'av-small');for(let i=0;i<=now;i++){const active=level===0?(now-i)%d===0&&(now-i)<=4*d:level===1?(now-i)%d===0&&(now-i)<=2*d:i===now;content+=`<circle cx="${x(i)}" cy="${yy}" r="${active?5:2.4}" fill="${active?(level===2?red:blue):'#dce6ed'}"/>`}});
  [0,4,8,12,16].forEach(i=>content+=text(x(i),91,i===16?'now':`−${16-i} h`,'av-tiny','text-anchor="middle"'));
  content+=text(239,20,`Connections skip ${d-1} intermediate ${d===2?'hour':'hours'} · dilation ${d}`,'av-label','text-anchor="middle"');
  content+=text(267,250,`Earliest connected input: −${4*d} h · no future observations.`,'av-small','text-anchor="middle"');
  return svg(`Two causal convolutions with dilation ${d}. Each node reads three earlier or current positions; no future observations are used.`,content,265)+`<div class="av-footpath">${pill('Last-step features')}${pill('Temporal mean')}<span>→</span>${pill('24 horizon tokens','av-accent')}</div><p class="av-caption">Each block adds a residual skip and normalization after its two convolutions. Dilation doubles: 1 → 2 → 4 → 8 → 16. Only current and earlier positions are connected.</p>`;
 }
 function tokens(){
  const trajectories=[[2,3,2,4,3,6,4,7,5,6,8,7],[7,2,5,2,8,3,4,8,2,5,4,7],[1,1,2,1,4,2,2,6,3,4,8,5]],v=state.variable;
  let content=text(87,25,`${names[v]} history`,'av-label','text-anchor="middle"')+text(87,44,'Whole lookback window','av-small','text-anchor="middle"')+`<rect x="8" y="60" width="158" height="90" rx="7" fill="#fff" stroke="#dce6ed"/>`+spark(trajectories[v],19,77,136,55);
  content+=text(85,170,'Time-normalized sequence','av-small','text-anchor="middle"')+arrow(176,105,203,105)+box(214,57,106,97,'Linear layer','Learned projection')+arrow(328,105,355,105);
  for(let i=0;i<8;i++)content+=`<rect x="${367+(i%4)*25}" y="${79+Math.floor(i/4)*27}" width="20" height="22" rx="3" fill="${blue}" opacity="${.2+((i+v*3)%7)*.1}"/>`;
  content+=text(414,58,'Embedding token','av-label','text-anchor="middle"')+text(414,156,'D learned values','av-small','text-anchor="middle"');
  content+=box(78,214,185,44,'Variable identity embedding')+text(292,243,'+','av-plus')+box(329,214,140,44,'Trajectory token')+text(245,289,'One token summarizes one variable’s entire sequence.','av-small','text-anchor="middle"');
  return svg('The complete history of one variable passes through a learned linear layer into one embedding token, then its variable identity is added',content,305);
 }
 function selector(){
  const weights=gates(),dense=softmax([2.4,1.8,.6,-.4,-1].map(v=>v/state.temperature));
  return `<div class="av-selector-context">${pill('Target-horizon context','av-accent')}<span>↓</span>${pill('GRN scores each variable')}<span>↓ temperature</span></div><div class="av-weight-table"><div class="av-weight-head"><span>Covariate</span><span>Softmax</span><span>Sparsemax</span></div>${names.map((name,i)=>`<div class="av-weight-row"><span>${name}</span><div class="av-demo-bar av-soft"><i style="width:${dense[i]*100}%"></i><small>${(dense[i]*100).toFixed(1)}%</small></div><div class="av-demo-bar ${weights[i]<=1e-8?'av-exact-zero':''}"><i style="width:${weights[i]*100}%"></i><strong>${weights[i]<=1e-8?'0% · excluded':(weights[i]*100).toFixed(1)+'%'}</strong></div></div>`).join('')}</div><div class="av-footpath">${pill(`${weights.filter(w=>w>1e-8).length} of ${weights.length} tokens selected`,'av-accent')}${pill('Weights total 100%')}</div><p class="av-caption">Softmax leaves every variable positive. Sparsemax can assign exactly zero: those tokens are weighted to zero and masked out of cross-attention.</p>`;
 }
 function attention(){
  const gate=gates(),selected=gate.map((w,i)=>w>1e-8?i:-1).filter(i=>i>=0),hours=[1,6,12,24],logits=[[2.2,.9,1.4,0,.5],[1.1,1.6,.8,.8,0],[.6,2,1.4,.9,.2],[1.6,1.4,.8,.4,1.2]];
  const rows=logits.map(row=>{const values=selected.map(i=>row[i]),w=state.attentionActivation==='sparsemax'?sparsemax(values):softmax(values);return row.map((_,i)=>selected.includes(i)?w[selected.indexOf(i)]:null)});
  const selectedRow=rows[state.attentionRow];
  return `<div class="av-matrix-axis">Keys / values · covariate tokens →</div><table class="av-attention-matrix" aria-label="Illustrative cross-attention weights: rows are forecast hours, columns are covariates"><thead><tr><th class="av-matrix-corner" scope="col">Query ↓</th>${names.map((n,i)=>`<th class="av-matrix-column ${gate[i]<=1e-8?'av-muted':''}" scope="col">${n}<small>${gate[i]<=1e-8?'masked':'selected'}</small></th>`).join('')}</tr></thead><tbody>${rows.map((row,r)=>`<tr><th scope="row"><button type="button" class="av-matrix-query" data-av-control="attentionRow" data-av-value="${r}" aria-pressed="${state.attentionRow===r}" aria-label="Inspect attention at hour ${hours[r]}">+${hours[r]} h</button></th>${row.map((w,c)=>`<td class="av-matrix-cell ${w===null?'av-masked':w===0?'av-cell-zero':''} ${state.attentionRow===r?'av-active-row':''}" style="${w>0?`background:rgba(5,68,118,${.1+.85*w});color:${w>.45?'#fff':blue}`:''}" aria-label="Hour ${hours[r]}, ${names[c]}: ${w===null?'masked out':(w*100).toFixed(0)+' percent'}">${w===null?'—':w===0?'0%':(w*100).toFixed(0)+'%'}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="av-matrix-legend"><span><i class="av-legend-selected"></i>More attention</span><span><i class="av-cell-zero"></i>Exact zero</span><span><i class="av-masked"></i>Selector mask</span></div><div class="av-attention-readout"><strong>Hour +${hours[state.attentionRow]} reads</strong><div class="av-footpath">${selectedRow.map((w,i)=>w>0?pill(`${names[i]} · ${(w*100).toFixed(0)}%`):'').join('')}<span>→</span>${pill('Fused horizon token','av-accent')}</div></div><p class="av-caption">The selector mask is shared across rows. Each hour has its own attention weights. A selected variable can still receive exactly zero attention when sparsemax is used.</p>`;
 }
 function head(){
  const hours=[1,6,12,24];let content=text(78,20,'Fused horizon tokens','av-label','text-anchor="middle"');
  hours.forEach((h,i)=>{content+=box(15,40+i*45,127,33,`Hour +${h}`,'',i===state.headHour?red:blue)+line(147,56+i*45,204,119,`stroke="${i===state.headHour?red:'#bccdd9'}" stroke-width="${i===state.headHour?2:1}"`)});
  content+=box(213,76,115,84,'Shared output','neural network')+arrow(338,118,371,118)+box(380,92,87,54,`+${hours[state.headHour]} h`,'vector',red);
  content+=text(240,253,'A separate parameter vector for every forecast hour.','av-small','text-anchor="middle"');
  return svg('Each forecast-hour token uses the same output network to produce its own distribution parameters',content,268)+`<div class="av-parameter-groups">${[['Location','Moves the center'],['Positive scale','Sets the spread'],['Spline scores','Shape the body'],['Two tail scores','Set lower / upper extremes']].map(([label,caption])=>`<div><strong>${label}</strong><span>${caption}</span></div>`).join('')}</div>`;
 }
 function distribution(){
  const focus=state.distributionPart;let content=line(20,202,464,202,'stroke="#c3d2dd"')+text(21,222,'Lower outcomes','av-small')+text(464,222,'Higher outcomes','av-small','text-anchor="end"');
  const pieces=[['lower','M 25 198 C 77 198 113 194 144 176',gold],['body','M 144 176 C 180 154 196 48 238 46 C 280 45 300 147 338 176',blue],['upper','M 338 176 C 375 194 416 198 461 198',red]];
  pieces.forEach(([id,path,color])=>content+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="${focus===id?5:2}" opacity="${focus===id?1:.4}"/>`);
  [144,338].forEach(x=>content+=line(x,40,x,203,'stroke="#bccdd9" stroke-dasharray="4 4"'));
  content+=text(88,25,'Lower GPD','av-label','text-anchor="middle"')+text(240,25,'Spline body','av-label','text-anchor="middle"')+text(402,25,'Upper GPD','av-label','text-anchor="middle"')+text(145,249,'Smooth join','av-small','text-anchor="middle"')+text(339,249,'Smooth join','av-small','text-anchor="middle"');
  const captions={lower:'The lower GPD extends rare adverse outcomes for USDC. Its shape controls how far the left tail reaches.',body:'Positive spline coefficients shape the central distribution while preserving ordered quantiles. Location shifts it; scale widens it.',upper:'The upper GPD extends rare adverse outcomes for USDT. Its shape can change independently of the lower tail.'};
  return svg('Central spline distribution joined smoothly to independent lower and upper GPD tails',content,270)+`<p class="av-insight">${captions[focus]}</p><p class="av-caption">Explore the actual hourly model output in Probability distribution → Shape.</p>`;
 }
 function controls(id){
  if(id==='tcn')return `<div class="av-control-label">Inspect a dilated block</div>${buttons('dilation',[[1,'Dilation 1'],[2,'Dilation 2'],[4,'Dilation 4']],state.dilation)}`;
  if(id==='tokens')return buttons('variable',[[0,'Liquidity'],[1,'Volume'],[2,'Volatility']],state.variable);
  if(id==='selector')return `<label class="av-temperature" for="architecture-temperature"><span>Selector temperature <output id="av-temperature-value">${state.temperature.toFixed(2)}</output></span><input id="architecture-temperature" type="range" min="0.5" max="4" step="0.05" value="${state.temperature}"><small>Lower → more concentrated · higher → more variables can enter</small></label>`;
  if(id==='fusion')return `<div class="av-control-label">Attention activation</div>${buttons('attentionActivation',[['sparsemax','Sparsemax'],['softmax','Softmax']],state.attentionActivation)}`;
  if(id==='head')return buttons('headHour',[[0,'+1 h'],[1,'+6 h'],[2,'+12 h'],[3,'+24 h']],state.headHour);
  if(id==='distribution')return buttons('distributionPart',[['lower','Lower tail'],['body','Spline body'],['upper','Upper tail']],state.distributionPart);
  return '';
 }
 const scenes={inputs,revin,tcn,tokens,selector,fusion:attention,head,distribution};
 function render(id){return `<div class="architecture-visual"><div class="av-example-label">Illustrative walkthrough</div>${controls(id)}<div data-architecture-scene>${scenes[id]()}</div></div>`}
 function bind(root,id){
  root.addEventListener('click',event=>{
   const button=event.target.closest('[data-av-control]');if(!button||!root.contains(button))return;
   const key=button.dataset.avControl;state[key]=['dilation','variable','attentionRow','headHour'].includes(key)?Number(button.dataset.avValue):button.dataset.avValue;
   root.querySelector('[data-architecture-scene]').innerHTML=scenes[id]();
   root.querySelectorAll(`[data-av-control="${key}"]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.avValue===String(state[key]))));
   if(key==='attentionRow')root.querySelector(`[data-av-control="attentionRow"][data-av-value="${state.attentionRow}"]`).focus({preventScroll:true});
  });
  root.querySelector('#architecture-temperature')?.addEventListener('input',event=>{
   state.temperature=Number(event.target.value);root.querySelector('#av-temperature-value').textContent=state.temperature.toFixed(2);root.querySelector('[data-architecture-scene]').innerHTML=selector();
  });
 }
 return {render,bind,sparsemax};
})();
