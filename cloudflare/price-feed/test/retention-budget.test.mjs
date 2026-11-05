import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collect,POOL} from '../src/collector.mjs';

const word=n=>BigInt(n).toString(16).padStart(64,'0');
const slot='0x'+word(2n**96n)+word(0).repeat(6);

test('a month of quarter-hour collections stays bounded and rolls history at each forecast origin',async t=>{
  const base=Date.parse('2026-10-01T00:00:00Z')/1000;
  let head=0,reads=0,maxBytes=0,maxPoints=0;
  const block=number=>({number,timestamp:base+number*12,hash:'block-'+number});
  const rpc={
    async call(method,params){
      if(method==='eth_chainId')return '0x1';
      if(method==='eth_call')return slot;
      if(method==='eth_getLogs'){
        assert.equal(Number(BigInt(params[0].fromBlock)),head-74);
        reads++;return [];
      }
      throw new Error(method);
    },
    async block(number){return block(number==='latest'?head:number);},
    async blockMany(){return new Map();}
  };
  let state={pool:POOL,chain_id:1,metadata_verified:true,_cursor:{...block(0),price:1},points:[]};
  for(let interval=1;interval<=31*96;interval++){
    head=interval*75;
    const now=(base+interval*900)*1000;
    const origin=new Date((base+Math.floor((interval-1)/96)*86400)*1000).toISOString();
    state=await collect(state,{rpc,now,forecastOrigin:origin,confirmations:0});
    assert.equal(state.backfill_pending,false);
    assert(state.points.every(p=>Date.parse(p.timestamp)>=Date.parse(origin)));
    maxPoints=Math.max(maxPoints,state.points.length);
    maxBytes=Math.max(maxBytes,Buffer.byteLength(JSON.stringify(state)));
  }
  assert.equal(reads,2976); // One new block range per scheduled collection.
  assert(maxPoints<=1441);assert(maxBytes<250000);
  t.diagnostic(`31-day simulation: ${reads} collections, at most ${maxPoints} retained minute prices, ${maxBytes} snapshot bytes.`);
});
