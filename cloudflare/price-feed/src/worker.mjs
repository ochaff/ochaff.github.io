import {collect,createRpc,DEFAULT_RPC,publicSnapshot,RpcError,VerificationError} from './collector.mjs';

export class PriceCollector {
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.collecting=null;
    ctx.blockConcurrencyWhile(async()=>{this.snapshot=await ctx.storage.get('snapshot')||null;});
  }
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/collect'&&request.method==='POST'){await this.update();return Response.json({ok:true});}
    if(path!=='/snapshot'||request.method!=='GET')return new Response('Not found',{status:404});
    // A single initial alarm warms the shared cache; visitors never perform
    // RPC queries or independently reconstruct their own historical series.
    if(!this.snapshot&&!this.collecting&&!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(Date.now()+1000);
    return Response.json(publicSnapshot(this.snapshot),{status:this.snapshot?.latest?200:503});
  }
  async update(){
    if(this.collecting)return this.collecting;
    this.collecting=this.run();
    try{return await this.collecting;}finally{this.collecting=null;}
  }
  async run(){
    try{
      this.snapshot=await collect(this.snapshot,{rpc:createRpc(this.env.RPC_URL||DEFAULT_RPC,fetch,Number(this.env.RPC_BATCH_SIZE||3)),
        historyHours:Number(this.env.HISTORY_HOURS||48),confirmations:Number(this.env.CONFIRMATIONS||12),chunk:Number(this.env.BLOCK_CHUNK||400)});
      await this.ctx.storage.put('snapshot',this.snapshot);
      if(this.snapshot.backfill_pending)await this.ctx.storage.setAlarm(Date.now()+5000);
    }catch(error){
      this.snapshot={...this.snapshot,last_attempt_at:new Date().toISOString(),last_error:(error instanceof RpcError||error instanceof VerificationError)?error.message:'Pool data verification failed'};
      await this.ctx.storage.put('snapshot',this.snapshot);
      // Back off for one collection interval rather than hammering a public
      // provider during an outage or rate limit.
      await this.ctx.storage.setAlarm(Date.now()+15*60000);
      console.warn('Price collection failed; preserving the previous snapshot and retrying.');
    }
  }
  async alarm(){await this.update();}
}

function collector(env){return env.PRICES.get(env.PRICES.idFromName('ethereum-usdc-usdt-v3-100'));}
export default {
  async scheduled(_event,env,ctx){ctx.waitUntil(collector(env).fetch('https://collector/collect',{method:'POST'}));},
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','X-Content-Type-Options':'nosniff'};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='GET'||!['/v1/prices','/health'].includes(path))return new Response('Not found',{status:404,headers});
    const key=new Request(new URL('/v1/prices',request.url).toString());
    if(path==='/v1/prices'){
      const cached=await caches.default.match(key);if(cached)return cached;
    }
    const result=await collector(env).fetch('https://collector/snapshot');
    const data=await result.json();
    const body=path==='/health'?{status:data.status,stale:data.stale,collected_at:data.collected_at,
      price_timestamp:data.latest?.timestamp,history_complete_through:data.history_complete_through,
      last_attempt_at:data.last_attempt_at,last_error:data.last_error}:data;
    const response=Response.json(body,{status:result.status,headers:{...headers,'Cache-Control':result.ok?'public, max-age=20':'no-store'}});
    if(result.ok&&path==='/v1/prices')ctx.waitUntil(caches.default.put(key,response.clone()));
    return response;
  }
};
