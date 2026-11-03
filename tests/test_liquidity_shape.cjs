const {test} = require('node:test');
const assert = require('node:assert/strict');
const {makeBins, imbalance, swap, localImpact, position, gegenbauer, basis, reconstruct, SCALE} = require('../assets/amm/liquidity-shape-math.js');
const close = (a,b,tolerance=1e-8) => assert(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} != ${b}`);

test('both swap directions match the constant-L closed form and conserve virtual reserves',()=>{
  const bins = makeBins('balanced'), L = 2*SCALE;
  for (const amount of [1,1000,50000,300000,600000]) {
    const down = swap(bins,amount), up = swap(bins,-amount);
    close(down.price,(L/(L+amount))**2);
    close(down.output,L*amount/(L+amount));
    close(up.price,(1+amount/L)**2);
    close(up.output,L*amount/(L+amount));
    close((L+amount)*(L-down.output),L*L);
    close(down.filled,amount); close(up.filled,amount);
    close(down.unfilled,0); close(up.unfilled,0);
    assert(down.price<1); assert(up.price>1);
  }
});

test('multi-range swaps integrate the correct liquidity on each side of a boundary',()=>{
  const bins = [{lower:.99,upper:.995,L:50e6},{lower:.995,upper:1,L:200e6},
    {lower:1,upper:1.005,L:100e6},{lower:1.005,upper:1.01,L:25e6}];
  const targetDown = .9925, targetUp = 1.0075;
  const qDown = 200e6*(1/Math.sqrt(.995)-1) + 50e6*(1/Math.sqrt(targetDown)-1/Math.sqrt(.995));
  const qUp = 100e6*(Math.sqrt(1.005)-1) + 25e6*(Math.sqrt(targetUp)-Math.sqrt(1.005));
  const down = swap(bins,qDown), up = swap(bins,-qUp);
  close(down.price,targetDown); close(up.price,targetUp);
  close(down.output,200e6*(1-Math.sqrt(.995))+50e6*(Math.sqrt(.995)-Math.sqrt(targetDown)));
  close(up.output,100e6*(1-1/Math.sqrt(1.005))+25e6*(1/Math.sqrt(1.005)-1/Math.sqrt(targetUp)));
});

test('window-limited swaps report unmodeled input instead of extrapolating past the window',()=>{
  for (const direction of [-1,1]) {
    const state = swap(makeBins('balanced'),direction*10e6);
    close(state.price,direction>0?.99:1.01);
    close(state.filled+state.unfilled,10e6);
    assert(state.unfilled>0);
  }
  const zero = swap(makeBins('balanced'),0);
  close(zero.price,1); close(zero.output,0); close(zero.filled,0);
});

test('profiles isolate global imbalance, nearby asymmetry, and tangent liquidity',()=>{
  const balanced=makeBins('balanced'), global=makeBins('global'), local=makeBins('local'), thin=makeBins('thin');
  const area=bins=>bins.reduce((sum,b)=>sum+(b.upper-b.lower)*b.L,0);
  for (const bins of [global,local,thin]) close(area(bins),area(balanced));
  close(imbalance(balanced),0); close(imbalance(local),0); close(imbalance(thin),0);
  assert(imbalance(global)>.5);
  for (const amount of [-50000,50000]) close(swap(global,amount).price,swap(balanced,amount).price);
  assert(swap(global,600000).price<swap(balanced,600000).price);
  assert(swap(global,-600000).price<swap(balanced,-600000).price);
  assert(swap(local,200000).price<swap(balanced,200000).price);
  assert(swap(local,-200000).price<swap(balanced,-200000).price);
  const small=1;
  close((1-swap(thin,small).price)/(1-swap(balanced,small).price),5,1e-6);
});

test('narrowing preserves initial capital and increases share only while active',()=>{
  let previousL=Infinity;
  for (const width of [5,10,30,100]) {
    const state=position(width,0);
    close(state.L*(1-1/Math.sqrt(state.upper)),100000);
    close(state.L*(1-Math.sqrt(state.lower)),100000);
    assert(state.L<previousL); previousL=state.L;
    assert(state.active); assert(state.share>0 && state.share<1);
    close(position(width,width+1).share,0);
    assert.equal(position(width,width).active,false);
  }
  assert(position(10,0).share>position(100,0).share);
});

test('peg concentration preserves total liquidity and gives slow initial impact followed by fast tails',()=>{
  const bins=makeBins('concentrated'), balanced=makeBins('balanced');
  const area=profile=>profile.reduce((sum,b)=>sum+(b.upper-b.lower)*b.L,0);
  close(area(bins),area(balanced)); close(imbalance(bins),0);
  for (const sign of [-1,1]) {
    const early=swap(bins,sign*100000), middle=swap(bins,sign*850000), late=swap(bins,sign*950000);
    assert(Math.abs(early.bps)<Math.abs(swap(balanced,sign*100000).bps)/4);
    assert(Math.abs(late.bps-middle.bps)>10*Math.abs(early.bps));
    const initialResponse=localImpact(bins,1,sign), lateResponse=localImpact(bins,late.price,sign);
    assert(lateResponse.bpsPer100k>10*initialResponse.bpsPer100k);
    close(early.unfilled,0); close(late.unfilled,0);
  }
});

test('local price response agrees with a small additional swap and chooses the next boundary interval',()=>{
  for (const name of ['balanced','global','local','thin','concentrated']) {
    const bins=makeBins(name);
    for (const sign of [-1,1]) {
      const start=swap(bins,sign*123456), end=swap(bins,sign*123457);
      close(Math.abs(end.bps-start.bps)*100000,localImpact(bins,start.price,sign).bpsPer100k,1e-5);
    }
  }
  const bins=[{lower:.99,upper:1,L:10e6},{lower:1,upper:1.01,L:20e6}];
  close(localImpact(bins,1,1).L,10e6);
  close(localImpact(bins,1,-1).L,20e6);
});

test('Gegenbauer low degrees, endpoint normalization and parity follow their definitions',()=>{
  const lambda=.4;
  for (const u of [-1,-.8,-.1,0,.2,.7,1]) {
    close(gegenbauer(0,u),1);
    close(gegenbauer(1,u),2*lambda*u);
    close(gegenbauer(2,u),2*lambda*(lambda+1)*u*u-lambda);
    close(gegenbauer(3,u),4/3*lambda*(lambda+1)*(lambda+2)*u**3-2*lambda*(lambda+1)*u);
    for (let n=1;n<=5;n++) { close(basis(n,1),1); close(basis(n,-u),(-1)**n*basis(n,u)); }
  }
});

test('all allowed coefficient corners reconstruct finite positive liquidity; truncation excludes later terms',()=>{
  for (let mask=0;mask<32;mask++) {
    const scores=Array.from({length:5},(_,i)=>mask&(1<<i)?.5:-.5);
    for (let i=0;i<=200;i++) {
      const L=reconstruct(scores,-1+i/100);
      assert(Number.isFinite(L) && L>0);
    }
  }
  close(reconstruct([0,0,0,0,0],0),SCALE);
  close(reconstruct([.2,-.4,.5,.3,-.5],.3,2),reconstruct([.2,-.4,0,0,0],.3));
  assert(reconstruct([0,-.5,0,0,0],0)>reconstruct([0,-.5,0,0,0],1));
});
