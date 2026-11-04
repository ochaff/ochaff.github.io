import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PriceCollector} from '../src/worker.mjs';
import {POOL} from '../src/collector.mjs';

function context(snapshot){
  const stored=new Map(snapshot?[['snapshot',snapshot]]:[]);let alarm=null;
  const ctx={storage:{get:async key=>stored.get(key),put:async(key,value)=>stored.set(key,value),
    getAlarm:async()=>alarm,setAlarm:async value=>{alarm=value;}},
    blockConcurrencyWhile(fn){ctx.ready=fn();}};
  return ctx;
}

test('visitor reads warm the shared cache once without doing RPC work',async()=>{
  const ctx=context();const collector=new PriceCollector(ctx,{});await ctx.ready;
  let calls=0;const original=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw new Error();};
  try{
    const first=await collector.fetch(new Request('https://internal/snapshot'));
    const alarm=await ctx.storage.getAlarm();
    const second=await collector.fetch(new Request('https://internal/snapshot'));
    assert.equal(first.status,503);assert.equal(second.status,503);assert.equal(calls,0);
    assert.equal(await ctx.storage.getAlarm(),alarm);
  }finally{globalThis.fetch=original;}
});

test('overlapping triggers share one RPC attempt and failures preserve the last good data',async()=>{
  const snapshot={schema_version:1,pool:POOL,chain_id:1,metadata_verified:true,
    latest:{timestamp:new Date().toISOString(),price_ratio:1,depeg_bps:0},points:[],_cursor:{number:1,hash:'old',timestamp:1,price:1}};
  const ctx=context(snapshot);const collector=new PriceCollector(ctx,{});await ctx.ready;
  let calls=0;const original=globalThis.fetch;
  globalThis.fetch=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,1));return Response.json([{id:1,result:'0x2'}]);};
  try{
    await Promise.all([collector.update(),collector.update()]);
    assert.equal(calls,1);assert.equal(collector.snapshot.latest,snapshot.latest);
    assert.equal(collector.snapshot._cursor.number,1);
    assert.equal((await ctx.storage.get('snapshot')).last_error,'Wrong RPC chain');
    assert(await ctx.storage.getAlarm()>Date.now());
    const response=await collector.fetch(new Request('https://internal/snapshot'));
    assert.equal((await response.json()).status,'degraded');assert.equal(calls,1);
  }finally{globalThis.fetch=original;}
});
