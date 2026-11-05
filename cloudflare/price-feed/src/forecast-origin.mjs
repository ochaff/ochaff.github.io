import {VerificationError} from './collector.mjs';

export const DEFAULT_FORECAST_URL='https://ochaff.github.io/dashboard_data/angel_forecast.json';
const REFRESH_MS=15*60000;

// Only the collector reads the published model. Browser requests cannot choose
// a retention boundary or start a historical RPC backfill.
export async function loadForecastOrigin(previous,{url=DEFAULT_FORECAST_URL,fetcher=fetch,now=Date.now()}={}){
  const saved=previous?._forecast;
  if(saved?.url===url&&now>=saved.checked_at&&now-saved.checked_at<REFRESH_MS)return saved;
  let response;
  try{
    response=await fetcher(url,{headers:saved?.url===url&&saved.etag?{'If-None-Match':saved.etag}:{},signal:AbortSignal.timeout(10000)});
  }catch{throw new VerificationError('Published forecast unavailable');}
  if(response.status===304&&saved?.url===url)return {...saved,checked_at:now};
  if(!response.ok)throw new VerificationError('Published forecast unavailable');
  let payload;
  try{payload=await response.json();}catch{throw new VerificationError('Invalid published forecast');}
  const timestamp=typeof payload?.timestamp==='string'?payload.timestamp.replace(' ','T'):'';
  const origin=Date.parse(timestamp);
  if(payload?.status!=='ok'||payload.model!=='ANGEL'||payload.quote!=='USDT per USDC'||
     !/(Z|[+-]\d{2}:\d{2})$/.test(timestamp)||!Number.isFinite(origin)||origin>now+60000)
    throw new VerificationError('Invalid published forecast origin');
  if(previous?.forecast_origin&&origin<Date.parse(previous.forecast_origin))throw new VerificationError('Published forecast moved backwards');
  return {url,origin:new Date(origin).toISOString(),checked_at:now,etag:response.headers.get('ETag')};
}

export function trimToForecast(snapshot,origin,historyHours,now=Date.now()){
  if(!Number.isInteger(historyHours)||historyHours<1||historyHours>72)throw new VerificationError('Invalid collector limits');
  const cutoff=Math.max(Date.parse(origin),now-historyHours*3600000);
  return {...snapshot,retention_basis:'forecast_origin',forecast_origin:origin||null,
    history_start:Number.isFinite(cutoff)?new Date(cutoff).toISOString():null,
    _cursor:Number.isFinite(cutoff)?snapshot?._cursor:null,
    // Until an origin is verified, retain the latest quote but no old history.
    points:(snapshot?.points||[]).filter(p=>Date.parse(p.timestamp)>=cutoff)};
}
