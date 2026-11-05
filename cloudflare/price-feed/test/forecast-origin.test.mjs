import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadForecastOrigin,trimToForecast,DEFAULT_FORECAST_URL} from '../src/forecast-origin.mjs';

const now=Date.parse('2026-11-05T12:00:00Z'),origin='2026-11-05T01:00:00.000Z';
const payload={status:'ok',model:'ANGEL',quote:'USDT per USDC',timestamp:'2026-11-05 01:00:00+00:00'};

test('published origin is verified and conditional fetches are shared by backfill alarms',async()=>{
  let calls=0;
  const fetcher=async(_url,options)=>{
    calls++;
    if(calls===1)return Response.json(payload,{headers:{ETag:'"forecast-1"'}});
    assert.equal(options.headers['If-None-Match'],'"forecast-1"');
    return new Response(null,{status:304});
  };
  const first=await loadForecastOrigin(null,{fetcher,now});assert.equal(first.origin,origin);
  const state={_forecast:first,forecast_origin:origin};
  assert.deepEqual(await loadForecastOrigin(state,{fetcher,now:now+5000}),first);
  const refreshed=await loadForecastOrigin(state,{fetcher,now:now+15*60000});
  assert.equal(calls,2);assert.equal(refreshed.checked_at,now+15*60000);
  assert.equal(refreshed.origin,origin);assert.equal(first.url,DEFAULT_FORECAST_URL);
});

test('invalid, future and regressing forecast origins are rejected before RPC work',async()=>{
  for(const p of [{...payload,timestamp:'broken'},{...payload,timestamp:'2026-11-06T01:00:00Z'},
    {...payload,timestamp:'2026-11-05T01:00:00'},{...payload,model:'Other'},{...payload,status:'unavailable'}]){
    await assert.rejects(loadForecastOrigin(null,{fetcher:async()=>Response.json(p),now}));
  }
  await assert.rejects(loadForecastOrigin({forecast_origin:origin},{fetcher:async()=>Response.json({...payload,timestamp:'2026-11-04T01:00:00Z'}),now}));
});

test('retention also has a finite safety window when the model stops updating',()=>{
  const point=timestamp=>({timestamp,price_ratio:1,depeg_bps:0});
  const state={points:[point('2026-11-01T00:00:00Z'),point('2026-11-05T01:00:00Z')],_cursor:{number:123}};
  assert.deepEqual(trimToForecast(state,origin,48,now).points,[state.points[1]]);
  assert.deepEqual(trimToForecast(state,'2026-11-01T00:00:00Z',48,now).points,[state.points[1]]);
  assert.deepEqual(trimToForecast(state,undefined,48,now).points,[]);
  assert.equal(trimToForecast(state,origin,48,now)._cursor.number,123);
});
