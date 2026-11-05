const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/ammonitor/prediction-scorer.js'),'utf8')+'\nthis.scoring=PredictionScorer;',context);
const {weight,prepare}=context.scoring;
assert.ok(Math.abs(weight(0)-2/(1+Math.exp(10)))<1e-14);
assert.ok(Math.abs(weight(10)-(.5+1/(1+Math.exp(20))))<1e-14);
for(const z of [0,1,5,10,12,40]){
 assert.ok(weight(z)>0&&weight(z)<=1);
 assert.ok(Math.abs(weight(z)-weight(-z))<1e-14,'two-sided sigmoid weights are symmetric');
}
const uniform={xL:-1,xU:1,xiL:0,xiU:0,betaL:0,betaU:0,bodyKnots:[-1,1],
 quantile:p=>2*p-1,cdf:z=>Math.max(0,Math.min(1,(z+1)/2)),survival:z=>Math.max(0,Math.min(1,(1-z)/2))};
const observations=[-2,0,.5,2];
const result=prepare(uniform,observations);
observations.forEach((y,i)=>{
 const expected=Math.abs(y)>=1?Math.abs(y)-1/3:y*y/2+1/6;
 assert.ok(Math.abs(result.rows[i].crps-expected)<1e-10,'CDF area equals analytical uniform-distribution CRPS');
 assert.ok(result.rows[i].twcrps>=0&&result.rows[i].twcrps<=result.rows[i].crps);
 assert.ok(Math.abs(result.rows[i].sum-result.rows.slice(0,i+1).reduce((s,r)=>s+r.crps,0))<1e-12);
});
// Independent scipy.integrate.quad references for a uniform body spliced to
// lower xi=.3 / upper xi=.5 GPD tails (scale .25; splice probabilities .1/.9).
const tailSF=(excess,xi)=>Math.pow(1+xi*excess/.25,-1/xi);
const spliced={xL:-1,xU:1,xiL:.3,xiU:.5,betaL:.25,betaU:.25,bodyKnots:[-1,1],
 quantile:p=>p<.1?-1-.25/.3*(Math.pow(p/.1,-.3)-1):p>.9?1+.25/.5*(Math.pow((1-p)/.1,-.5)-1):-1+(p-.1)*2.5,
 cdf:z=>z< -1?.1*tailSF(-1-z,.3):z>1?1-.1*tailSF(z-1,.5):.1+(z+1)*.4,
 survival:z=>z>1?.1*tailSF(z-1,.5):z< -1?1-.1*tailSF(-1-z,.3):.9-(z+1)*.4};
const reference=[[-12,11.538521634926072,2.1267488699917028],[0,.20980392156862743,.000021081810840318747],[4,3.5240896358543417,.002406923857163904],[15,14.513252197430695,5.004611067046565]];
const scored=prepare(spliced,reference.map(r=>r[0]));
reference.forEach(([,crps,twcrps],i)=>{
 assert.ok(Math.abs(scored.rows[i].crps-crps)<1e-8,'CRPS includes the full GPD tails');
 assert.ok(Math.abs(scored.rows[i].twcrps-twcrps)<1e-8,'twCRPS matches independent two-sigmoid CDF integration');
});
const narrow=prepare(spliced,[0],{low:-2,high:2}),wide=prepare(spliced,[0],{low:-100,high:100});
assert.ok(Math.abs(narrow.rows[0].crps-wide.rows[0].crps)<1e-8,'plot bounds do not change the full CRPS');
assert.ok(Math.abs(narrow.rows[0].twcrps-wide.rows[0].twcrps)<1e-8,'plot bounds do not change the full twCRPS');
assert.ok(narrow.rows[0].visibleCRPS<narrow.rows[0].crps,'clipped plot area remains distinct from full-tail scores');
assert.throws(()=>prepare(uniform,[NaN]),/Finite/);
console.log('CRPS analytical uniform cases, full GPD-tail integrals, paper twCRPS weights, and cumulative scores verified.');
