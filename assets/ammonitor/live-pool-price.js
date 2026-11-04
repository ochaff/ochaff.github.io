const LivePoolPrice=(()=>{
 const POOL='0x3416cf6c708da44db2624d63ea0aaef7113527c6';
 let feed=null,unavailable=false,pending=false,inFlight=false,timer=null,endpoint='';
 function validate(payload,now=Date.now()){
   if(payload?.schema_version!==1||payload.chain_id!==1||payload.pool?.toLowerCase()!==POOL||payload.quote!=='USDT per USDC')throw new Error('Wrong price feed');
   const valid=p=>Number.isFinite(Date.parse(p?.timestamp))&&Date.parse(p.timestamp)<=now+60000&&Number.isFinite(p.price_ratio)&&p.price_ratio>0&&Number.isFinite(p.depeg_bps)&&Math.abs((p.price_ratio-1)*10000-p.depeg_bps)<1e-6;
   if(!valid(payload.latest)||!Array.isArray(payload.points)||payload.points.length>4500)throw new Error('Invalid price observations');
   let previous=-Infinity;
   for(const point of payload.points){const t=Date.parse(point.timestamp);if(!valid(point)||t<=previous||t>Date.parse(payload.latest.timestamp))throw new Error('Unordered price observations');previous=t;}
   return payload;
 }
 function buildSeries(payload,origin,anchor){
   if(!payload?.latest||Date.parse(payload.latest.timestamp)<=origin)return [];
   const output=[];
   for(const p of payload.points){
     const point={x:Date.parse(p.timestamp),y:p.depeg_bps};if(point.x<=origin)continue;
     const previous=output.at(-1);
     if(!previous&&point.x-origin<=90000&&Number.isFinite(anchor))output.push({x:origin,y:anchor});
     if(previous&&point.x-previous.x>90000)output.push({x:point.x-1,y:null});
     output.push(point);
   }
   const last=output.at(-1),latest={x:Date.parse(payload.latest.timestamp),y:payload.latest.depeg_bps};
   if(!last||latest.x>last.x){if(!last||latest.x-last.x>90000)output.push({x:latest.x-1,y:null});output.push(latest);}
   return output;
 }
 function series(origin,anchor){return buildSeries(feed,origin,anchor);}
 function quote(){
   const note=document.getElementById('pool-price-status');if(!note)return;
   note.title='Pool feed updates every 15 minutes, using prices 12 confirmed blocks behind the chain head. History is sampled each minute.';
   const hasNewer=feed&&Date.parse(feed.latest.timestamp)>Date.parse(result.timestamp);
   if(hasNewer){
     const latest=feed.latest,stale=Date.now()-Date.parse(latest.timestamp)>20*60000;
     document.getElementById('pool-price-value').textContent=number(latest.price_ratio,6);
     document.getElementById('pool-price-deviation').textContent=signed(latest.depeg_bps)+' bps from peg';
     note.textContent=(unavailable?'Feed unavailable · last pool price ':stale?'Stale pool price · ':'Pool price · ')+shortTime(latest.timestamp)+' UTC'+(feed.backfill_pending?' · backfilling history':'');
     note.classList.toggle('is-stale',stale||unavailable);
   }else{
     note.textContent='Model snapshot · '+shortTime(result.timestamp)+' UTC'+(pending?' · connecting pool feed':unavailable?' · pool feed unavailable':'');
     note.classList.remove('is-stale');
   }
 }
 async function refresh(){
   if(inFlight||document.hidden||!endpoint)return;
   inFlight=true;
   try{
     const response=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(10000)});
     const payload=await response.json();
     if(payload.status==='warming_up'){pending=true;unavailable=false;quote();return;}
     if(!response.ok)throw new Error('Price feed unavailable');
     const incoming=validate(payload);
     const changed=!feed||incoming.latest.block_hash!==feed.latest.block_hash||incoming.history_complete_through!==feed.history_complete_through;
     if(feed&&Date.parse(incoming.latest.timestamp)<Date.parse(feed.latest.timestamp))throw new Error('Feed moved backwards');
     feed=incoming;unavailable=incoming.status==='degraded';pending=false;quote();
     if(changed)drawPrice();
   }catch{unavailable=true;pending=false;quote();}
   finally{inFlight=false;}
 }
 async function init(){
   quote();
   try{
     const response=await fetch('dashboard_data/live_price_config.json',{signal:AbortSignal.timeout(5000)});
     if(!response.ok)return;
     const config=await response.json();if(!config.endpoint)return;
     const url=new URL(config.endpoint,location.href);
     if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('HTTPS price feed required');
     endpoint=url.href;pending=true;quote();void refresh();
     clearInterval(timer);timer=setInterval(()=>{quote();void refresh();},60000);
     document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
   }catch{unavailable=true;quote();}
 }
 return {init,series,validate,buildSeries};
})();
if(typeof module!=='undefined')module.exports=LivePoolPrice;
