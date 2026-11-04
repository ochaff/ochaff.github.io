import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {validate,buildSeries}=require('../../../assets/ammonitor/live-pool-price.js');
const POOL='0x3416cf6c708da44db2624d63ea0aaef7113527c6';
const origin=Date.parse('2026-11-04T08:00:00Z');
const p=(minutes,bps)=>({timestamp:new Date(origin+minutes*60000).toISOString(),price_ratio:1+bps/10000,depeg_bps:bps});
const feed=()=>({schema_version:1,chain_id:1,pool:POOL,quote:'USDT per USDC',points:[p(1,1),p(2,2)],latest:p(3,3)});

test('browser accepts a consistent pool feed and rejects wrong pools, units and future data',()=>{
  assert.equal(validate(feed(),origin+180000).pool,POOL);
  for(const altered of [{...feed(),chain_id:2},{...feed(),pool:'other'},
    {...feed(),quote:'USDC per USDT'},{...feed(),latest:{...p(3,3),price_ratio:2}},
    {...feed(),points:[p(2,2),p(1,1)]},{...feed(),latest:p(10,3)}]){
    assert.throws(()=>validate(altered,origin+180000));
  }
});

test('intraday observations extend the original forecast anchor without rebasing it',()=>{
  const points=buildSeries(feed(),origin,7);
  assert.deepEqual(points.map(p=>p.y),[7,1,2,3]);
  assert.equal(points[0].x,origin);
  assert.deepEqual(buildSeries(feed(),origin+3600000,7),[]);
});

test('partial backfills and missing intervals are shown as gaps, never interpolated',()=>{
  const partial={...feed(),points:[p(30,1),p(34,2)],latest:p(120,3)};
  const points=buildSeries(partial,origin,7);
  assert.equal(points[0].x,origin+30*60000);
  assert.equal(points.filter(p=>p.y===null).length,2);
  assert.equal(points.at(-1).y,3);
});
