const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root=path.join(__dirname,'..');
const sandbox={};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'assets/ammonitor/angel-explainer.js'),'utf8')+'\nthis.math=AngelDistribution;',sandbox);
const f=JSON.parse(fs.readFileSync(path.join(root,'dashboard_data/angel_forecast.json'),'utf8'));
const c=f.distribution_explorer;
for(let h=0;h<c.hourly_parameters.length;h++){
 const params=c.hourly_parameters[h],d=sandbox.math.evaluate(c,params),row=f.hourly[h];
 for(const [p,key] of [[.01,'lower_1pct_bps'],[.5,'median_bps'],[.99,'upper_1pct_bps']]){
  assert.ok(Math.abs(d.quantile(p)-row[key])<3e-4,`${key} at hour ${h+1}: browser math matches released runtime`);
 }
 for(let i=0;i<d.points.length;i++){
  assert.ok(Number.isFinite(d.points[i].y)&&d.points[i].y>0);
  if(i)assert.ok(d.points[i].x>=d.points[i-1].x,'no quantile crossing');
 }
 for(const p of [.00001,.01,.1,.5,.9,.99,.99999]){
  const x=d.quantile(p);assert.ok(Math.abs(d.cdf(x)-p)<1e-10,'CDF inverts the quantile spline and GPD tails');
  assert.ok(Math.abs(d.cdf(x)+d.survival(x)-1)<1e-12);
 }
 const shifted=params.slice();shifted[0]+=5;
 assert.ok(Math.abs(sandbox.math.evaluate(c,shifted).quantile(.99)-d.quantile(.99)-5)<1e-8);
 const wider=params.slice();wider[1]*=2;
 const w=sandbox.math.evaluate(c,wider);
 assert.ok(Math.abs((w.quantile(.99)-w.quantile(.01))/(d.quantile(.99)-d.quantile(.01))-2)<1e-5);
 const left=params.slice();left[left.length-2]+=1;
 assert.ok(sandbox.math.evaluate(c,left).quantile(.001)<d.quantile(.001));
 assert.ok(Math.abs(sandbox.math.evaluate(c,left).quantile(.99)-d.quantile(.99))<1e-8,'lower shape cannot change upper tail');
}
console.log('Distribution controls match all 24 runtime forecasts; monotonicity, location, scale and tail independence verified.');

// The walkthrough uses an actual sparsemax projection, including exact zeros.
vm.runInContext(fs.readFileSync(path.join(root,'assets/ammonitor/angel-architecture-visuals.js'),'utf8')+'\nthis.selectionMath=AngelArchitectureVisuals;',sandbox);
for(const logits of [[2.4,1.8,.6,-.4,-1],[0,0,0],[10,-2,-3],[1.1,1.6,.8]]){
 const w=Array.from(sandbox.selectionMath.sparsemax(logits));
 assert.ok(w.every(x=>x>=0));assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-12);
 const shifted=Array.from(sandbox.selectionMath.sparsemax(logits.map(x=>x+10)));
 w.forEach((x,i)=>assert.ok(Math.abs(x-shifted[i])<1e-12,'sparsemax is invariant to an additive score shift'));
}
const weights=Array.from(sandbox.selectionMath.sparsemax([2.4,1.8,.6,-.4,-1]));
assert.ok(weights.slice(2).every(x=>x===0),'excluded variables have exact zero weights');
assert.ok(sandbox.selectionMath.sparsemax([2.4,1.8,.6,-.4,-1].map(x=>x/4)).filter(x=>x>0).length>weights.filter(x=>x>0).length);
console.log('Visual sparsemax walkthrough: unit mass, nonnegativity, exact zeros and temperature effects verified.');
