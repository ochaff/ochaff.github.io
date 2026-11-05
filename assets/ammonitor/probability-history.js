let probabilityHistoryChart;
function drawProbabilityHistory(expanded=false){
 const canvas=document.getElementById(expanded?'history-detail-chart':'probability-history-chart');if(!canvas)return;
 if(expanded)probabilityHistoryDetailChart?.destroy();else probabilityHistoryChart?.destroy();
 const hourly=result.hourly_prediction_history?.basis==='retrospective_current_model';
 const history=hourly?result.hourly_prediction_history:result.prediction_history,records=history?.records||[];
 const isCurrent=r=>hourly?stamp(r.timestamp)===stamp(result.timestamp):r.id===history.current_id;
 const colors={Low:BLUE,Elevated:'#b18122',High:RED,Critical:'#9b2436'};
 document.getElementById('probability-history-note').textContent=records.length?
   (hourly?'Hourly scores · current model · UTC':'Saved runs · UTC · model versions may differ'):'History will accumulate after model updates';
 if(expanded)document.getElementById('history-detail-caption').textContent=hourly?
   'Retrospective hourly scores using the current calibrated model; these are not predictions issued by historical model versions. Risk bands: Low <10%, Elevated 10% to <20%, High 20% to <50%, Critical ≥50%.':
   'Saved predictions from dashboard runs. Model versions may differ; missing hours are not interpolated.';
 const end=stamp(result.timestamp),start=end-168*3600000;
 const chart=new Chart(canvas,{type:'scatter',data:{datasets:[{
   data:records.map(r=>({x:stamp(r.timestamp),y:r.probability,record:r})),
   pointBackgroundColor:records.map(r=>colors[r.risk_level]||BLUE),
   pointBorderColor:records.map(r=>isCurrent(r)?'#17384f':'#fff'),
   pointBorderWidth:records.map(r=>isCurrent(r)?1:.5),
   clip:false,pointRadius:records.map(r=>isCurrent(r)?(expanded?4:2.5):(expanded?2.5:1.5)),pointHitRadius:0
 }]},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,events:[],layout:{padding:{right:6,top:5}},
   plugins:{legend:{display:false},tooltip:{enabled:false}},
   scales:{x:{type:'linear',min:start,max:end,border:{display:false},grid:{display:false},
     ticks:{color:MUTED,maxTicksLimit:expanded?7:3,font:{size:expanded?12:10},callback:v=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}},
     y:{min:0,max:1,border:{display:false},grid:{color:'#edf2f6'},ticks:{stepSize:expanded?.1:.5,color:MUTED,font:{size:expanded?12:10},callback:v=>(v*100)+'%'}}}}});
 if(expanded)probabilityHistoryDetailChart=chart;else probabilityHistoryChart=chart;
}

let probabilityHistoryDetailChart;
const riskHistoryDialog=document.getElementById('risk-history-detail');
function openProbabilityHistory(){
 riskHistoryDialog.showModal();
 requestAnimationFrame(()=>{if(riskHistoryDialog.open)drawProbabilityHistory(true)});
}
document.getElementById('history-detail-close').addEventListener('click',()=>riskHistoryDialog.close());
riskHistoryDialog.addEventListener('close',()=>{
 probabilityHistoryDetailChart?.destroy();probabilityHistoryDetailChart=null;
 document.getElementById('history-open')?.focus();
});
riskHistoryDialog.addEventListener('click',event=>{
 const rect=riskHistoryDialog.getBoundingClientRect();
 if(event.target===riskHistoryDialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))riskHistoryDialog.close();
});
