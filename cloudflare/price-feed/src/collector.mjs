export const POOL='0x3416cf6c708da44db2624d63ea0aaef7113527c6';
export const USDC='0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
export const USDT='0xdac17f958d2ee523a2206206994597c13d831ec7';
export const SWAP='0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
export const DEFAULT_RPC='https://ethereum-rpc.publicnode.com';
const hex=n=>'0x'+n.toString(16);
const iso=seconds=>new Date(seconds*1000).toISOString();

export class VerificationError extends Error {}

export class RpcError extends Error {
  constructor(method,rangeLimit=false,code=null){super('Ethereum RPC '+method+' failed'+(code===null?'':' ('+code+')'));this.rangeLimit=rangeLimit;}
}
export function createRpc(url,fetcher=fetch,maxBatch=3){
  if(!Number.isInteger(maxBatch)||maxBatch<1||maxBatch>20)throw new VerificationError('Invalid RPC batch limit');
  let id=0;const blocks=new Map();
  async function batch(calls){
    if(calls.length>maxBatch){
      const values=[];
      for(let i=0;i<calls.length;i+=maxBatch)values.push(...await batch(calls.slice(i,i+maxBatch)));
      return values;
    }
    const requests=calls.map(([method,params])=>({jsonrpc:'2.0',id:++id,method,params}));
    let response;
    try{
      response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'AMMonitor/1.0 (https://ochaff.github.io)'},body:JSON.stringify(requests.length===1?requests[0]:requests),signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new RpcError(requests[0].method,false,'HTTP '+response.status);
      const raw=await response.json(),body=Array.isArray(raw)?raw:[raw];
      const entries=new Map(body.map(value=>[value.id,value]));
      return requests.map(request=>{
        const entry=entries.get(request.id);
        if(!entry||entry.error||entry.result===undefined){
          const range=/range|limit|too many|response.*size/i.test(entry?.error?.message||'');
          throw new RpcError(request.method,range,entry?.error?.code??null);
        }
        return entry.result;
      });
    }catch(error){if(error instanceof RpcError)throw error;throw new RpcError(requests[0].method);}
  }
  const call=async(method,params)=>(await batch([[method,params]]))[0];
  function remember(raw){
    if(!raw?.hash||!raw.number||!raw.timestamp)throw new RpcError('eth_getBlockByNumber');
    const block={number:Number(BigInt(raw.number)),timestamp:Number(BigInt(raw.timestamp)),hash:raw.hash};
    blocks.set(block.number,block);return block;
  }
  async function block(number){
    if(blocks.has(number))return blocks.get(number);
    return remember(await call('eth_getBlockByNumber',[typeof number==='number'?hex(number):number,false]));
  }
  async function blockMany(numbers){
    const missing=[...new Set(numbers)].filter(n=>!blocks.has(n));
    for(let i=0;i<missing.length;i+=20){
      const raw=await batch(missing.slice(i,i+20).map(n=>['eth_getBlockByNumber',[hex(n),false]]));
      raw.forEach(remember);
    }
    return new Map(numbers.map(n=>[n,blocks.get(n)]));
  }
  return {batch,call,block,blockMany};
}

export function ratioFromSqrt(value){
  const sqrt=BigInt(value);
  const ratio=(Number(sqrt)/2**96)**2; // Both verified tokens have 6 decimals.
  if(sqrt<=0n||!Number.isFinite(ratio)||ratio<=0)throw new VerificationError('Invalid pool sqrt price');
  return ratio;
}
export function slotRatio(data){
  if(!/^0x[0-9a-f]{448}$/i.test(data))throw new VerificationError('Invalid slot0 response');
  return ratioFromSqrt('0x'+data.slice(2,66));
}
export function decodeSwap(log){
  if(log.removed||log.address?.toLowerCase()!==POOL||log.topics?.[0]?.toLowerCase()!==SWAP||
     !/^0x[0-9a-f]{320}$/i.test(log.data))throw new VerificationError('Invalid pool Swap log');
  return {block:Number(BigInt(log.blockNumber)),index:Number(BigInt(log.logIndex)),
    price:ratioFromSqrt('0x'+log.data.slice(130,194))};
}
async function verifyPool(rpc){
  if(Number(BigInt(await rpc.call('eth_chainId',[])))!==1)throw new VerificationError('Expected Ethereum mainnet');
  const calls=[[POOL,'0x0dfe1681'],[POOL,'0xd21220a7'],[POOL,'0xddca3f43'],[USDC,'0x313ce567'],[USDT,'0x313ce567']];
  const [token0,token1,fee,d0,d1]=await rpc.batch(calls.map(([to,data])=>['eth_call',[{to,data},'latest']]));
  if('0x'+token0.slice(-40).toLowerCase()!==USDC||'0x'+token1.slice(-40).toLowerCase()!==USDT||
     BigInt(fee)!==100n||BigInt(d0)!==6n||BigInt(d1)!==6n)throw new VerificationError('Unexpected pool tokens, fee or decimals');
}
async function atOrBefore(rpc,head,timestamp){
  let span=Math.max(20,Math.ceil((head.timestamp-timestamp)/6)),low=Math.max(0,head.number-span),high=head.number;
  while((await rpc.block(low)).timestamp>timestamp&&low>0){span*=2;low=Math.max(0,head.number-span);}
  while(low+1<high){const mid=Math.floor((low+high)/2);if((await rpc.block(mid)).timestamp<=timestamp)low=mid;else high=mid;}
  return rpc.block(low);
}
const point=(timestamp,price)=>({timestamp:iso(timestamp),price_ratio:price,depeg_bps:(price-1)*10000});

export function minuteSamples(cursor,events,endTime){
  let price=cursor.price,index=0;const points=[];
  for(let t=(Math.floor(cursor.timestamp/60)+1)*60;t<=endTime;t+=60){
    while(index<events.length&&events[index].timestamp<=t)price=events[index++].price;
    if(price!==null)points.push(point(t,price));
  }
  while(index<events.length)price=events[index++].price;
  return {points,price};
}

export async function collect(previous,{rpc,now=Date.now(),historyHours=48,forecastOrigin=null,confirmations=12,chunk=400}={}){
  if(!Number.isInteger(historyHours)||historyHours<1||historyHours>72||!Number.isInteger(chunk)||chunk<1||chunk>400)throw new VerificationError('Invalid collector limits');
  if(!Number.isInteger(confirmations)||confirmations<0||confirmations>128)throw new VerificationError('Invalid confirmation depth');
  const origin=forecastOrigin===null?null:Date.parse(forecastOrigin)/1000;
  if(origin!==null&&(!Number.isFinite(origin)||origin>now/1000+60))throw new VerificationError('Invalid forecast origin');
  if(!previous?.metadata_verified)await verifyPool(rpc);
  else if(Number(BigInt(await rpc.call('eth_chainId',[])))!==1)throw new VerificationError('Wrong RPC chain');
  const tip=await rpc.block('latest'),head=await rpc.block(Math.max(0,tip.number-confirmations));
  if(head.timestamp>now/1000+60)throw new VerificationError('Future-dated RPC block');
  const latestRatio=slotRatio(await rpc.call('eth_call',[{to:POOL,data:'0x3850c7bd'},hex(head.number)]));
  let cursor=previous?._cursor,rebuilds=previous?.reorg_rebuilds||0,oldPoints=previous?.points||[];
  if(previous?.latest&&(previous.pool!==POOL||previous.chain_id!==1))throw new VerificationError('Mismatched persisted pool');
  if(cursor){
    if(head.number<cursor.number)throw new VerificationError('RPC is behind the saved cursor');
    if((await rpc.block(cursor.number)).hash!==cursor.hash){cursor=null;oldPoints=[];rebuilds++;}
  }
  const cutoff=Math.max(head.timestamp-historyHours*3600,origin??-Infinity);
  if(!cursor||cursor.timestamp<cutoff-300){
    const seed=await atOrBefore(rpc,head,cutoff);let price=null;
    // Some free nodes lack historical state. In that case start at the first
    // actual swap instead of inventing a price before it.
    try{price=slotRatio(await rpc.call('eth_call',[{to:POOL,data:'0x3850c7bd'},hex(seed.number)]));}catch{}
    cursor={...seed,price};oldPoints=[];
  }
  let end=Math.min(head.number,cursor.number+chunk),logs=[];
  if(end>cursor.number){
    while(true){
      try{logs=await rpc.call('eth_getLogs',[{address:POOL,topics:[SWAP],fromBlock:hex(cursor.number+1),toBlock:hex(end)}]);break;}
      catch(error){if(!error.rangeLimit||end<=cursor.number+1)throw error;end=cursor.number+Math.max(1,Math.floor((end-cursor.number)/2));}
    }
  }
  if(!Array.isArray(logs))throw new VerificationError('Invalid logs response');
  const events=logs.map(decodeSwap).sort((a,b)=>a.block-b.block||a.index-b.index);
  if(events.some(e=>e.block<=cursor.number||e.block>end)||new Set(events.map(e=>e.block+':'+e.index)).size!==events.length)throw new VerificationError('Out-of-range or duplicate logs');
  const headers=await rpc.blockMany(events.map(e=>e.block));
  events.forEach(event=>{event.timestamp=headers.get(event.block).timestamp;});
  const last=await rpc.block(end),sampled=minuteSamples(cursor,events,last.timestamp);
  // At the live edge, independently cross-check all decoded swaps against slot0.
  if(end===head.number&&sampled.price!==null&&Math.abs(sampled.price-latestRatio)>1e-10)throw new VerificationError('Swap history does not match pool slot0');
  const points=[...oldPoints,...sampled.points].filter(p=>Date.parse(p.timestamp)/1000>=cutoff);
  return {schema_version:1,chain_id:1,pool:POOL,quote:'USDT per USDC',fee_tier:100,
    sampling:'minute-end spot, carried forward only between verified swaps',retention_hours:historyHours,
    retention_basis:origin===null?'rolling_window':'forecast_origin',forecast_origin:origin===null?null:iso(origin),history_start:iso(cutoff),
    confirmation_blocks:confirmations,collected_at:new Date(now).toISOString(),last_attempt_at:new Date(now).toISOString(),
    latest:{...point(head.timestamp,latestRatio),block_number:head.number,block_hash:head.hash},
    history_complete_through:iso(last.timestamp),backfill_pending:end<head.number,reorg_rebuilds:rebuilds,
    metadata_verified:true,_cursor:{...last,price:end===head.number?latestRatio:sampled.price},points,last_error:null};
}

export function publicSnapshot(state,now=Date.now()){
  if(!state?.latest)return {schema_version:1,status:state?.last_error?'unavailable':'warming_up',pool:POOL,points:[],
    last_attempt_at:state?.last_attempt_at,last_error:state?.last_error};
  const {_cursor,_forecast,metadata_verified,...body}=state;
  return {...body,status:state.last_error?'degraded':state.backfill_pending?'backfilling':'ok',
    stale:now-Date.parse(state.latest.timestamp)>20*60000};
}
