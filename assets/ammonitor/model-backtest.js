let modelBacktestChart;
function initModelBacktest(){
 document.body.insertAdjacentHTML('beforeend',`<dialog id="model-backtest" class="ale-dialog backtest-dialog" aria-labelledby="backtest-title"><div class="backtest-content"><div class="ale-heading"><div><h2 id="backtest-title">Model backtest</h2><p id="backtest-period"></p></div><button type="button" id="backtest-close" class="ale-close" aria-label="Close model backtest">×</button></div><div class="backtest-toolbar"><label>Model <select id="backtest-model"><option value="angel">ANGEL forecasting</option><option value="rf">Early warning · Random Forest</option></select></label><label id="backtest-origin-label">Origin <select id="backtest-origin"></select></label><label id="backtest-horizon-label">Horizon <select id="backtest-horizon"><option value="all">All 24 hours</option>${Array.from({length:24},(_,i)=>`<option value="${i+1}">+${i+1} h</option>`).join('')}</select></label></div><div id="backtest-metrics" class="backtest-metrics" aria-live="polite"></div><div class="backtest-stage"><canvas id="backtest-chart" role="img" aria-label="Historical model predictions compared with observed outcomes"></canvas><div id="backtest-empty" class="diagnostic-empty" hidden></div></div><p id="backtest-caption" class="backtest-caption"></p></div></dialog>`);
 const dialog=document.getElementById('model-backtest');
 document.getElementById('backtest-open').addEventListener('click',()=>{dialog.showModal();requestAnimationFrame(drawModelBacktest)});
 document.getElementById('backtest-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{modelBacktestChart?.destroy();modelBacktestChart=null;document.getElementById('backtest-open').focus()});
 dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close()});
 ['backtest-model','backtest-horizon','backtest-origin'].forEach(id=>document.getElementById(id).addEventListener('change',drawModelBacktest));
}
function drawModelBacktest(){
 modelBacktestChart?.destroy();modelBacktestChart=null;
 const angel=document.getElementById('backtest-model').value==='angel',diag=currentAngelDiagnostics();
 const replay=diag?.basis==='retrospective_daily_origins',rf=result.backtest;
 const originSelect=document.getElementById('backtest-origin');
 const allRows=angel?(diag?.backtest||[]).flatMap(h=>(h.records||[]).map(r=>({...r,hour:h.hour}))):rf?.records||[];
 const origins=angel?[...new Set(allRows.map(r=>r.origin))].sort():[];
 const signature=origins.join('|');
 if(originSelect.dataset.signature!==signature){originSelect.innerHTML='<option value="all">All scored origins</option>'+origins.map(o=>`<option value="${escapeHtml(o)}">${time(o)}</option>`).join('');originSelect.dataset.signature=signature}
 document.getElementById('backtest-origin-label').hidden=!angel||!origins.length;document.getElementById('backtest-horizon-label').hidden=!angel;
 const horizon=document.getElementById('backtest-horizon').value;
 const rows=allRows.filter(r=>!angel||((horizon==='all'||r.hour===Number(horizon))&&(originSelect.value==='all'||r.origin===originSelect.value))).sort((a,b)=>stamp(a.timestamp)-stamp(b.timestamp));
 const first=angel?diag?.test_start:rf?.test_start||result.monitoring?.split_periods?.test?.start,last=angel?diag?.test_end:rf?.test_end||result.monitoring?.split_periods?.test?.end;
 document.getElementById('backtest-period').textContent=first&&last?`${replay?'Replay origins':'Test period'} · ${time(first)} – ${time(last)}`:'Awaiting historical model outputs';
 const metrics=[];
 if(angel&&rows.length){
  const mean=fn=>rows.reduce((sum,r)=>sum+fn(r),0)/rows.length;
  metrics.push(['Scored outcomes',number(rows.length,0)],['Median MAE',number(mean(r=>Math.abs(r.observed_bps-r.median_bps)),3)+' bps'],['1–99% coverage',pct(mean(r=>+(r.observed_bps>=r.lower_1pct_bps&&r.observed_bps<=r.upper_1pct_bps)))],['Below / above interval',pct(mean(r=>+(r.observed_bps<r.lower_1pct_bps)))+' / '+pct(mean(r=>+(r.observed_bps>r.upper_1pct_bps)))]);
 }else if(!angel)metrics.push(['Test AUC',number(rf?.auc??result.auc,3)],['Test Brier score',number(rf?.brier_score??result.brier_score,4)],['Scored outcomes',number(rf?.samples,0)]);
 document.getElementById('backtest-metrics').innerHTML=metrics.map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('');
 const empty=document.getElementById('backtest-empty'),canvas=document.getElementById('backtest-chart');empty.hidden=rows.length>0;canvas.hidden=!rows.length;
 empty.innerHTML=angel?'<strong>ANGEL backtest unavailable</strong><p>Historical forecasts and observed outcomes for this checkpoint will appear after the replay runs.</p>':'<strong>Timeline awaits the next monitoring run</strong><p>The AUC and Brier score above come from the current held-out evaluation. Historical test scores will be exported on the next training run.</p>';
 document.getElementById('backtest-caption').textContent=angel?(replay?'Retrospective replay of the current frozen checkpoint, with one origin every 24 hours. Each origin uses only its trailing input window. The latest origin also contributes selection weights; forecasts without observed outcomes are excluded from scoring. This is not an out-of-sample evaluation of historical model versions.':'Held-out forecasts from the matching checkpoint. Only matched observed outcomes are scored.')+' Coverage target: 98%. Statistics describe the selected rows; forecast hours within a day are dependent.': 'Held-out, chronologically subsequent test outcomes: a ±15 bps breach at any point in the following 24 hours. AUC measures ranking; Brier score measures probability error. No model is fitted by opening this view.';
 if(!rows.length)return;
 const base={showLine:true,pointRadius:0,borderWidth:1.6,spanGaps:false};
 const series=(key,color,label,extra={})=>({...base,label,borderColor:color,data:rows.map(r=>({x:stamp(r.timestamp),y:r[key],origin:r.origin,hour:r.hour})),...extra});
 const datasets=angel?[series('observed_bps',BLUE,'Observed'),series('lower_1pct_bps','#05447655','1% quantile'),series('upper_1pct_bps','#05447655','99% quantile',{fill:'-1',backgroundColor:'#05447616'}),series('median_bps',RED,'Forecast median',{borderDash:[5,3]})]:[series('probability',BLUE,'Predicted breach probability'),series('outcome',RED,'Observed breach outcome',{showLine:false,pointRadius:2})];
 modelBacktestChart=new Chart(canvas,{type:'scatter',data:{datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10}}},tooltip:{callbacks:{title:items=>time(items[0].parsed.x),afterLabel:ctx=>ctx.raw.origin?`Origin ${time(ctx.raw.origin)} · +${ctx.raw.hour} h`:''}}},scales:{x:{type:'linear',min:stamp(rows[0].timestamp),max:Math.max(stamp(rows.at(-1).timestamp),stamp(rows[0].timestamp)+3600000),ticks:{maxTicksLimit:7,color:MUTED,font:{size:10},callback:v=>shortTime(v)},grid:{color:'#edf2f6'}},y:{min:angel?undefined:0,max:angel?undefined:1,title:{display:true,text:angel?'Signed depeg (bps)':'Breach probability / outcome'},ticks:{color:MUTED,callback:v=>angel?v:(v*100)+'%'},grid:{color:'#edf2f6'}}}}});
}
