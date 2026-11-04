const {test} = require('node:test');
const assert = require('node:assert/strict');
const M = require('../assets/hts/mint-math.js');
const close = (a,b,tol=1e-9) => {
  if (Array.isArray(a)) { assert.equal(a.length,b.length); a.forEach((v,i)=>close(v,b[i],tol)); }
  else assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
};
const subtract = (a,b) => a.map((row,i)=>row.map((v,j)=>v-b[i][j]));

test('OLS and variance weighting reproduce the noisy-total example', () => {
  const s=M.threeS, base=[19,4,3], w=M.threeCovariance([10,1,1],0);
  const ols=M.reconcile(s,M.identity(3)), wls=M.reconcile(s,w);
  close(M.vector(ols.p,base),[15,8,7]);
  close(M.vector(wls.p,base),[7+24/102,4+12/102,3+12/102]);
  close(M.risk(ols.g,w),70/3);
  close(M.risk(wls.g,w),2-2/102);
});

test('GLS agrees with the independent single-constraint projection formula', () => {
  for (const rho of [-.9,0,.85]) {
    const w=M.threeCovariance([3,2.5,1],rho), c=[1,-1,-1], wc=M.vector(w,c);
    const denominator=c.reduce((v,x,i)=>v+x*wc[i],0);
    const expected=M.identity(3).map((row,i)=>row.map((v,j)=>v-wc[i]*c[j]/denominator));
    close(M.reconcile(M.threeS,w).p,expected);
  }
});

test('GLS preserves coherence and is a projection self-adjoint in the inverse covariance metric', () => {
  for (const m of [2,4,8,16]) {
    const s=M.binaryHierarchy(m), w=M.hierarchyCovariance(s), {g,p}=M.reconcile(s,w);
    close(M.multiply(g,s),M.identity(m));
    close(M.multiply(p,p),p);
    close(M.multiply(p,s),s);
    close(M.solve(w,p),M.transpose(M.solve(w,p)));
    close(M.reconcile(s,w.map(row=>row.map(v=>17*v))).g,g);
  }
});

test('oracle covariance difference is D W D transpose for another unbiased estimator', () => {
  const s=M.binaryHierarchy(4), w=M.hierarchyCovariance(s), oracle=M.reconcile(s,w);
  for (const approximate of [M.identity(7),M.diagonal(w),M.shrink(w,.5)]) {
    const fit=M.reconcile(s,approximate), d=subtract(fit.g,oracle.g);
    close(subtract(M.covariance(fit.g,w),M.covariance(oracle.g,w)),M.covariance(d,w));
    for (const target of [[1,0,0,0],[1,1,1,1],[1,-2,3,-4]]) {
      const variance=g=>M.risk(M.multiply([target],g),w);
      assert.ok(variance(fit.g)>=variance(oracle.g)-1e-9);
    }
  }
});

test('sample covariance is centered and uses T-1', () => {
  close(M.sampleCovariance([[1,2],[2,4],[3,6]]),[[1,2],[2,4]]);
  close(M.sampleCovariance([[11,22],[12,24],[13,26]]),[[1,2],[2,4]]);
});

test('short samples are rejected rather than silently regularized; positive shrinkage is usable', () => {
  const s=M.binaryHierarchy(8), w=M.hierarchyCovariance(s);
  const sample=M.sampleCovariance(M.residuals(w,8,1204));
  assert.throws(()=>M.reconcile(s,sample),/singular|ill-conditioned/);
  close(M.shrink(sample,0),sample);
  close(M.shrink(sample,1),M.diagonal(sample));
  for (const alpha of [.05,.5,1]) {
    const fit=M.reconcile(s,M.shrink(sample,alpha));
    close(M.multiply(fit.g,s),M.identity(8));
    assert.ok(Number.isFinite(M.risk(fit.g,w)));
  }
});

test('residual generator is reproducible, prefix-consistent, and converges to the known covariance', () => {
  const w=M.threeCovariance([3,2.5,1],.85);
  close(M.residuals(w,4,37),M.residuals(w,10,37).slice(0,4));
  const estimated=M.sampleCovariance(M.residuals(w,50000,37));
  w.forEach((row,i)=>row.forEach((v,j)=>assert.ok(Math.abs(estimated[i][j]-v)<.04*Math.sqrt(w[i][i]*w[j][j]))));
});
