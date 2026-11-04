/* Small, dependency-free linear algebra shared by the MinT figures and tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MinTMath = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const transpose = a => a[0].map((_, j) => a.map(row => row[j]));
  const identity = n => Array.from({length:n}, (_, i) => Array.from({length:n}, (_, j) => +(i === j)));
  const multiply = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((v, x, k) => v + x * b[k][j], 0)));
  const vector = (a, x) => a.map(row => row.reduce((v, z, i) => v + z * x[i], 0));
  const diagonal = a => a.map((row, i) => row.map((_, j) => i === j ? row[i] : 0));
  const shrink = (a, alpha) => a.map((row, i) => row.map((v, j) => i === j ? v : (1 - alpha) * v));
  function cholesky(a) {
    const n = a.length, l = identity(n).map(row => row.map(() => 0));
    const tolerance = Math.max(...a.map((row, i) => row[i])) * 1e-12;
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let v = a[i][j];
      for (let k = 0; k < j; k++) v -= l[i][k] * l[j][k];
      if (i === j) {
        if (!(v > tolerance)) throw new Error('Covariance is singular or numerically ill-conditioned.');
        l[i][j] = Math.sqrt(v);
      } else l[i][j] = v / l[j][j];
    }
    return l;
  }
  function solve(a, b) {
    const l = cholesky(a), n = a.length;
    const x = b.map(row => row.slice());
    for (let c = 0; c < b[0].length; c++) {
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < i; k++) x[i][c] -= l[i][k] * x[k][c];
        x[i][c] /= l[i][i];
      }
      for (let i = n - 1; i >= 0; i--) {
        for (let k = i + 1; k < n; k++) x[i][c] -= l[k][i] * x[k][c];
        x[i][c] /= l[i][i];
      }
    }
    return x;
  }
  function reconcile(s, w) {
    const wiS = solve(w, s), stWi = transpose(wiS);
    const g = solve(multiply(stWi, s), stWi);
    return {g, p:multiply(s, g)};
  }
  const covariance = (g, w) => multiply(multiply(g, w), transpose(g));
  const risk = (g, w) => covariance(g, w).reduce((v, row, i) => v + row[i], 0);
  function sampleCovariance(rows) {
    if (rows.length < 2) throw new Error('At least two residual vectors are required.');
    const n = rows[0].length, t = rows.length;
    const mean = Array(n).fill(0);
    rows.forEach(row => row.forEach((v, j) => { mean[j] += v / t; }));
    return Array.from({length:n}, (_, i) => Array.from({length:n}, (_, j) =>
      rows.reduce((v, row) => v + (row[i] - mean[i]) * (row[j] - mean[j]), 0) / (t - 1)));
  }
  function gaussian(seed) {
    let state = seed >>> 0;
    function uniform() {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return (state + .5) / 4294967296;
    }
    return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  }
  function residuals(w, t, seed) {
    const l = cholesky(w), normal = gaussian(seed);
    return Array.from({length:t}, () => vector(l, Array.from({length:w.length}, normal)));
  }
  const threeS = [[1,1],[1,0],[0,1]];
  // Only the total/x correlation varies: |rho|<1 keeps this covariance positive definite.
  function threeCovariance(std, rho) {
    return [[std[0] ** 2, rho * std[0] * std[1], 0],
      [rho * std[0] * std[1], std[1] ** 2, 0], [0,0,std[2] ** 2]];
  }
  function binaryHierarchy(m) {
    if (m < 2 || (m & (m - 1))) throw new Error('Use a power-of-two bottom count.');
    const s = [];
    for (let size = m; size >= 1; size /= 2) {
      for (let start = 0; start < m; start += size) {
        s.push(Array.from({length:m}, (_, j) => +(j >= start && j < start + size)));
      }
    }
    return s;
  }
  function hierarchyCovariance(s) {
    // Shared latent bottom shocks plus independent node-specific forecast noise.
    // This generates a known SPD covariance, not coherent base errors.
    const m = s[0].length;
    const factors = s.map((row, i) => row.map((v, j) => v * (.45 + .1 * (j % 3)) * (i % 2 ? 1 : 1.4)));
    const w = multiply(factors, transpose(factors));
    s.forEach((row, i) => { w[i][i] += row.reduce((a, v) => a + v, 0) * (.5 + .25 * (i % 4)); });
    return w;
  }
  return {transpose, identity, multiply, vector, diagonal, shrink, cholesky, solve,
    reconcile, covariance, risk, sampleCovariance, residuals, threeS, threeCovariance,
    binaryHierarchy, hierarchyCovariance};
}));
