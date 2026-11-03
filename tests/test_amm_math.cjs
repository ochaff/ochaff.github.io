const {test} = require('node:test');
const assert = require('node:assert/strict');
const {stableY, rangeParameters, curve, marginal, trade} = require('../assets/amm/explorers.js');
const {positions, inRange, liquidityAt, boundaries, binStarts} = require('../assets/amm/liquidity-positions.js');
const close = (a,b,tolerance=1e-8) => assert(Math.abs(a-b) <= tolerance * Math.max(1,Math.abs(b)), `${a} != ${b}`);

test('1 bp bars preserve position coverage and aggregate liquidity', () => {
  assert.equal(binStarts.length,220);
  for (let i=1;i<binStarts.length;i++) assert.equal(binStarts[i]-binStarts[i-1],1);
  for (const p of positions) {
    const activeBins=binStarts.filter(b=>inRange(p,b));
    assert.equal(activeBins.length,p.upper-p.lower);
    close(activeBins.length*p.L,(p.upper-p.lower)*p.L);
  }
  for (const b of binStarts) close(liquidityAt(positions,b),liquidityAt(positions,b+.5));
});

test('overlapping positions add active L at parity and expose gaps when removed', () => {
  close(liquidityAt(positions,0),11.5);
  assert.deepEqual(positions.filter(p=>inRange(p,0)).map(p=>p.name),['User A','User C','User D']);
  const withoutBroad=positions.filter(p=>p.name!=='User A');
  close(liquidityAt(positions,75),1.5);
  close(liquidityAt(withoutBroad,75),0);
  close(liquidityAt([],0),0);
  close(liquidityAt(positions,15),4.5); // User C leaves as User E enters.
});

test('liquidity is constant between every range boundary with exact endpoint rules', () => {
  for (const p of positions) {
    assert(inRange(p,p.lower)); assert(!inRange(p,p.upper));
  }
  for (let i=0;i<boundaries.length-1;i++) {
    const left=boundaries[i],right=boundaries[i+1];
    close(liquidityAt(positions,left),liquidityAt(positions,(left+right)/2));
    close(liquidityAt(positions,left),liquidityAt(positions,right-1e-7));
  }
});

test('constant-product worked example and reserve conservation', () => {
  const s = trade('cpmm',100);
  close(s.received,1000/11);
  close(s.average,10/11);
  close(s.price,100/121);
  close(s.impactBps,10000/11);
  close(s.x*s.y,1000000);
});

test('StableSwap solves the invariant and its slope is the marginal quote', () => {
  for (const A of [1,10,100,1000]) {
    close(stableY(1000,A),1000);
    close(marginal('stable',1000,A),1);
    for (const x of [450,1000,1100,1800,2200,2300]) {
      const y=stableY(x,A), ann=4*A;
      close(ann*(x+y)+2000,ann*2000+2000**3/(4*x*y));
      close(-((stableY(x+.001,A)-stableY(x-.001,A))/.002),marginal('stable',x,A),1e-6);
      assert(y>0);
    }
  }
  assert(trade('stable',100,1000).impactBps<trade('stable',100,10).impactBps);
  assert(trade('stable',100,10).impactBps<trade('cpmm',100).impactBps);
});

test('concentrated position uses equal real reserves and stops at its lower bound', () => {
  for (const bps of [10,50,100,500]) {
    const {L,upper,lower,capacity} = rangeParameters(bps);
    close(curve('v3',1000,bps),1000);
    close(marginal('v3',1000,bps),1);
    const s = trade('v3',100,bps);
    close((s.x+L/Math.sqrt(upper))*(s.y+L*Math.sqrt(lower)),L*L);
    close(-(curve('v3',s.x+.001,bps)-curve('v3',s.x-.001,bps))/.002,s.price,1e-5);
    const boundary = trade('v3',1200,bps);
    close(boundary.filled,capacity);
    close(boundary.unfilled,1200-capacity);
    close(boundary.y,0);
    close(boundary.price,lower);
    close(boundary.received,1000);
  }
  assert(trade('v3',100,10).impactBps<trade('v3',100,500).impactBps);
});

test('zero-sized trades and every slider value stay finite and nonnegative', () => {
  for (const kind of ['cpmm','stable','v3']) {
    close(trade(kind,0,100).average,1);
    for (let amount=0;amount<=1200;amount+=10) {
      const s=trade(kind,amount,100);
      for (const key of ['received','average','price','impactBps','filled','unfilled']) {
        assert(Number.isFinite(s[key]));assert(s[key]>=-1e-7);
      }
      assert(s.received<=1000+1e-7);
    }
  }
});
