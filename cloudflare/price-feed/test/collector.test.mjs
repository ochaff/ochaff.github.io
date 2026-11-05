import {test} from 'node:test';
import assert from 'node:assert/strict';
import {keccak_256} from '@noble/hashes/sha3.js';
import {POOL,USDC,USDT,SWAP,ratioFromSqrt,decodeSwap,minuteSamples,collect,publicSnapshot,createRpc,RpcError} from '../src/collector.mjs';
const hex=n=>'0x'+n.toString(16),word=n=>BigInt(n).toString(16).padStart(64,'0');
const sqrt=ratio=>BigInt(Math.round(Math.sqrt(ratio)*2**96));
const slot=ratio=>'0x'+word(sqrt(ratio))+word(0).repeat(6);
const close=(a,b)=>assert(Math.abs(a-b)<1e-10);

test('Swap topic is the Keccak-256 hash of the canonical ABI signature',()=>{
  const actual='0x'+Buffer.from(keccak_256(new TextEncoder().encode('Swap(address,address,int256,int256,uint160,uint128,int24)'))).toString('hex');
  assert.equal(SWAP,actual);
});

function fixture(){
  const base=1700000000;
  const headers=n=>({number:n,timestamp:base+n*12,hash:'hash-'+n});
  const log={address:POOL,topics:[SWAP],blockNumber:hex(12),logIndex:'0x2',data:'0x'+word(1)+word(2)+word(sqrt(1.001))+word(3)+word(0)};
  const rpc={async call(method,params){
    if(method==='eth_chainId')return '0x1';
    if(method==='eth_call')return slot(Number.parseInt(params[1],16)>=12?1.001:1);
    if(method==='eth_getLogs')return [log].filter(l=>Number(BigInt(l.blockNumber))>=Number(BigInt(params[0].fromBlock))&&Number(BigInt(l.blockNumber))<=Number(BigInt(params[0].toBlock)));
    throw new Error(method);
  },async batch(){return ['0x'+word(BigInt(USDC)),'0x'+word(BigInt(USDT)),hex(100),hex(6),hex(6)];},
  async block(n){return headers(n==='latest'?30:n);},async blockMany(ns){return new Map(ns.map(n=>[n,headers(n)]));}};
  const previous={pool:POOL,chain_id:1,metadata_verified:true,_cursor:{...headers(10),price:1},points:[]};
  return {rpc,previous,base,headers,log};
}

test('sqrt conversion and Swap ABI decode preserve USDT/USDC direction',()=>{
  close(ratioFromSqrt(2n**96n),1);
  const {log}=fixture();const decoded=decodeSwap(log);close(decoded.price,1.001);assert.equal(decoded.block,12);
  assert.throws(()=>decodeSwap({...log,address:USDC}));assert.throws(()=>decodeSwap({...log,removed:true}));
});

test('minute closes use the last swap and carry state only over known history',()=>{
  const out=minuteSamples({timestamp:0,price:1},[{timestamp:12,price:.999},{timestamp:59,price:1.001},{timestamp:61,price:1.002}],125);
  assert.deepEqual(out.points.map(p=>p.price_ratio),[1.001,1.002]);close(out.price,1.002);
  const missing=minuteSamples({timestamp:0,price:null},[{timestamp:65,price:1.}],180);
  assert.deepEqual(missing.points.map(p=>p.timestamp),['1970-01-01T00:02:00.000Z','1970-01-01T00:03:00.000Z']);
});

test('incremental collection verifies log history against slot0 and is idempotent',async()=>{
  const {rpc,previous,base}=fixture();
  const next=await collect(previous,{rpc,now:(base+1000)*1000,confirmations:0});
  assert.equal(next._cursor.number,30);assert.equal(next.backfill_pending,false);close(next.latest.price_ratio,1.001);
  const again=await collect(next,{rpc,now:(base+1001)*1000,confirmations:0});
  assert.deepEqual(again.points,next.points);assert(!('_cursor' in publicSnapshot(next)));
  assert.equal(publicSnapshot(next,(base+2000)*1000).stale,true);
  assert.equal(publicSnapshot(next,(base+360+19*60)*1000).stale,false);
  assert.equal(publicSnapshot(next,(base+360+21*60)*1000).stale,true);
});

test('forecast origin prunes retained history without resetting the incremental cursor',async()=>{
  const {rpc,previous,base}=fixture(),origin=new Date((base+180)*1000).toISOString();
  previous.points=[{timestamp:new Date((base+60)*1000).toISOString(),price_ratio:1,depeg_bps:0}];
  const logs=[],call=rpc.call;
  rpc.call=async(method,params)=>{if(method==='eth_getLogs')logs.push(params[0]);return call(method,params);};
  const next=await collect(previous,{rpc,forecastOrigin:origin,now:(base+1000)*1000,confirmations:0});
  assert.equal(next.forecast_origin,origin);assert.equal(next.retention_basis,'forecast_origin');
  assert.equal(next.history_start,origin);assert(next.points.length>0);
  assert(next.points.every(p=>Date.parse(p.timestamp)>=Date.parse(origin)));
  assert.equal(logs[0].fromBlock,hex(11)); // No daily replay of already collected blocks.
});

test('cold starts backfill only from the forecast origin, including confirmed-head lag',async()=>{
  const {rpc,base}=fixture();
  for(const offset of [180,370]){
    const origin=new Date((base+offset)*1000).toISOString(),queries=[],call=rpc.call;
    const cold={...rpc,call:async(method,params)=>{if(method==='eth_getLogs')queries.push(params[0]);return call(method,params);}};
    const next=await collect(null,{rpc:cold,forecastOrigin:origin,now:(base+1000)*1000,confirmations:0});
    assert(Number(BigInt(queries[0].fromBlock))>=15);
    assert(next.points.every(p=>Date.parse(p.timestamp)>=Date.parse(origin)));
    assert.equal(next.backfill_pending,false);
  }
});

test('an initial provider failure can recover without treating diagnostics as a saved pool',async()=>{
  const {rpc,base}=fixture();
  const next=await collect({last_error:'RPC unavailable',last_attempt_at:new Date().toISOString()},
    {rpc,now:(base+1000)*1000,confirmations:0});
  assert.equal(next.pool,POOL);assert.equal(next.last_error,null);assert.equal(next.backfill_pending,false);
  close(next.latest.price_ratio,1.001);
});

test('wrong chain, missing swaps, duplicate logs and provider lag never advance the cursor',async()=>{
  for(const issue of ['chain','price','duplicate','lag']){
    const {rpc,previous,base,log,headers}=fixture();const call=rpc.call;
    rpc.call=async(method,params)=>issue==='chain'&&method==='eth_chainId'?'0x2':issue==='duplicate'&&method==='eth_getLogs'?[log,log]:issue==='price'&&method==='eth_getLogs'?[]:call(method,params);
    if(issue==='lag')rpc.block=async n=>headers(n==='latest'?5:n);
    await assert.rejects(collect(previous,{rpc,now:(base+1000)*1000,confirmations:0}));
    assert.equal(previous._cursor.number,10);
  }
});

test('RPC log-range limits reduce the chunk without skipping any blocks',async()=>{
  const {rpc,previous,base}=fixture();const call=rpc.call;const queried=[];
  rpc.call=async(method,params)=>{
    if(method==='eth_getLogs'){
      const [filter]=params,from=Number(BigInt(filter.fromBlock)),to=Number(BigInt(filter.toBlock));queried.push([from,to]);
      if(to-from+1>5)throw new RpcError(method,true);
    }
    return call(method,params);
  };
  const next=await collect(previous,{rpc,now:(base+1000)*1000,confirmations:0});
  assert.equal(next._cursor.number,15);assert.equal(next.backfill_pending,true);
  assert(queried.every(([from])=>from===11));
});

test('RPC batches match response IDs instead of response order and hide provider secrets',async()=>{
  const rpc=createRpc('https://example.test/private-token',async(_url,options)=>{
    const requests=JSON.parse(options.body);
    return {ok:true,json:async()=>requests.map(r=>({id:r.id,result:r.method})).reverse()};
  });
  assert.deepEqual(await rpc.batch([['a',[]],['b',[]]]),['a','b']);
  const bad=createRpc('https://example.test/private-token',async()=>{throw new Error('private-token');});
  await assert.rejects(bad.call('a',[]),error=>!error.message.includes('private-token'));
});

test('RPC respects public-provider batch limits and uses a single envelope for one call',async()=>{
  const sizes=[];
  const rpc=createRpc('https://example.test',async(_url,options)=>{
    const body=JSON.parse(options.body),requests=Array.isArray(body)?body:[body];
    sizes.push(requests.length);assert.ok(requests.length<=3);
    const entries=requests.map(r=>({id:r.id,result:r.method}));
    return {ok:true,json:async()=>Array.isArray(body)?entries.reverse():entries[0]};
  });
  assert.deepEqual(await rpc.batch(['a','b','c','d','e','f','g'].map(m=>[m,[]])),['a','b','c','d','e','f','g']);
  assert.deepEqual(sizes,[3,3,1]);
});
