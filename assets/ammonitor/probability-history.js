let probabilityHistoryChart;
function drawProbabilityHistory(){
 const canvas=document.getElementById('probability-history-chart');if(!canvas)return;
 probabilityHistoryChart?.destroy();
 const hourly=result.hourly_prediction_history?.basis==='retrospective_current_model';
 const history=hourly?result.hourly_prediction_history:result.prediction_history,records=history?.records||[];
 const isCurrent=r=>hourly?stamp(r.timestamp)===stamp(result.timestamp):r.id===history.current_id;
 const colors={Low:BLUE,Elevated:'#b18122',High:RED,Critical:'#9b2436'};
 document.getElementById('probability-history-note').textContent=records.length?
   (hourly?'Hourly scores · current model · UTC':'Saved runs · UTC · model versions may differ'):'History will accumulate after model updates';
 const end=stamp(result.timestamp),start=end-168*3600000;
 probabilityHistoryChart=new Chart(canvas,{type:'scatter',data:{datasets:[{
   data:records.map(r=>({x:stamp(r.timestamp),y:r.probability,record:r})),
   pointBackgroundColor:records.map(r=>colors[r.risk_level]||BLUE),
   pointBorderColor:records.map(r=>isCurrent(r)?'#17384f':'#fff'),
   pointBorderWidth:records.map(r=>isCurrent(r)?1:.5),
   clip:false,pointRadius:records.map(r=>isCurrent(r)?2.5:1.5),pointHitRadius:0
 }]},options:{responsive:true,maintainAspectRatio:false,animation:false,parsing:false,events:[],layout:{padding:{right:6,top:5}},
   plugins:{legend:{display:false},tooltip:{enabled:false}},
   scales:{x:{type:'linear',min:start,max:end,border:{display:false},grid:{display:false},
     ticks:{color:MUTED,maxTicksLimit:3,font:{size:8},callback:v=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}},
     y:{min:0,max:1,border:{display:false},grid:{color:'#edf2f6'},ticks:{stepSize:.5,color:MUTED,font:{size:8},callback:v=>(v*100)+'%'}}}}});
}
