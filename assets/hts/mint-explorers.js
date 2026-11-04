(function () {
  'use strict';
  const M = window.MinTMath;
  const color = {blue:'#4279bb', red:'#d95968', muted:'#9aa7bb', ink:'#10203a', green:'#388878', bg:'#f4f7fc'};
  const fmt = (x, digits=3) => Math.abs(x) < .5 * 10 ** -digits ? (0).toFixed(digits) : x.toFixed(digits);
  const chartConfig = {responsive:true, displaylogo:false, scrollZoom:false,
    modeBarButtonsToRemove:['toImage','select2d','lasso2d','autoScale2d']};
  const layout = {paper_bgcolor:color.bg, plot_bgcolor:color.bg,
    font:{family:'DM Sans, system-ui, sans-serif', color:color.ink, size:11}};
  function controls(root) {
    const inputs = Object.fromEntries([...root.querySelectorAll('[data-control]')].map(el => [el.dataset.control, el]));
    return {
      inputs,
      read() {
        const values = Object.fromEntries(Object.entries(inputs).map(([key, el]) => [key, el.type === 'range' ? +el.value : el.value]));
        root.querySelectorAll('[data-value]').forEach(el => {
          const key = el.dataset.value, value = values[key];
          el.textContent = key === 't' ? value : fmt(value, 2);
        });
        return values;
      },
      set(values) { Object.entries(values).forEach(([key, value]) => { inputs[key].value = value; }); }
    };
  }
  function matrix(el, title, description, a, rows, cols) {
    const max = a ? Math.max(1, ...a.flat().map(Math.abs)) : 1;
    el.innerHTML = `<div class="mint-matrix-title"><b>${title}</b><span>${description}</span></div><table aria-label="${title}: ${description}"><thead><tr><th scope="col"></th>${cols.map(c => `<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${rows.map((name, i) => `<tr><th scope="row">${name}</th>${cols.map((_, j) => {
      if (!a) return '<td>—</td>';
      const v = a[i][j], rgb = v < 0 ? '217,89,104' : '66,121,187';
      return `<td style="background:rgba(${rgb},${.04 + .22 * Math.abs(v) / max})">${fmt(v, Math.abs(v) >= 10 ? 1 : 3)}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>`;
  }
  // Coalesce slider events and serialize Plotly updates, retaining the camera on every change.
  function scheduler(render) {
    let dirty = false, running = false;
    return async function update() {
      dirty = true;
      if (running) return;
      running = true;
      try { while (dirty) { dirty = false; await render(); } }
      finally { running = false; }
    };
  }
  function observePlots(root) {
    if (!window.ResizeObserver) return;
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.querySelectorAll('[data-plot]').forEach(el => {
        if (el.classList.contains('js-plotly-plot')) Plotly.Plots.resize(el);
      }));
    });
    root.querySelectorAll('[data-plot]').forEach(el => observer.observe(el));
  }
  function point(name, p, c, size=6) {
    return {type:'scatter3d', mode:'markers', x:[p[1]], y:[p[2]], z:[p[0]], name,
      marker:{color:c, size, line:{color:color.bg, width:1}},
      hovertemplate:`${name}<br>x=%{x:.3f}<br>y=%{y:.3f}<br>z=%{z:.3f}<extra></extra>`};
  }
  function segment(name, a, b, c, dash) {
    return {type:'scatter3d', mode:'lines', x:[a[1],b[1]], y:[a[2],b[2]], z:[a[0],b[0]],
      line:{color:c, width:4, dash:dash || 'solid'}, name, hoverinfo:'skip'};
  }
  async function projection(root) {
    const ctl = controls(root), plot = root.querySelector('[data-plot]');
    let viewRevision = 0;
    const defaults = {method:'wls', preset:'noisy', z:19, x:4, y:3, sz:10, sx:1, sy:1, rho:0, t:24, alpha:.5};
    const presets = {
      noisy:{z:19,x:4,y:3,sz:10,sx:1,sy:1,rho:0},
      correlated:{z:12,x:4,y:3,sz:3,sx:2.5,sy:1,rho:.85},
      equal:{z:12,x:4,y:3,sz:2,sx:2,sy:2,rho:0}
    };
    const update = scheduler(async () => {
      const v = ctl.read(), base = [v.z,v.x,v.y], trueW = M.threeCovariance([v.sz,v.sx,v.sy], v.rho);
      const sample = M.sampleCovariance(M.residuals(trueW, v.t, 37));
      const weights = {ols:M.identity(3), wls:M.diagonal(trueW), gls:trueW, sample,
        shrink:M.shrink(sample, v.alpha)};
      const w = weights[v.method];
      const ols = M.vector(M.reconcile(M.threeS, M.identity(3)).p, base);
      let fit, landed, error;
      try { fit = M.reconcile(M.threeS, w); landed = M.vector(fit.p, base); }
      catch (err) { error = err.message; }
      const names = {ols:'I',wls:'diag(Wtrue)',gls:'Wtrue',sample:'Ŵsample',shrink:'Ŵα'};
      matrix(root.querySelector('[data-matrix=w]'), names[v.method], 'Covariance used', w, ['z','x','y'], ['z','x','y']);
      matrix(root.querySelector('[data-matrix=g]'), 'G · 2 × 3', 'Estimate bottoms', fit?.g, ['x','y'], ['z','x','y']);
      matrix(root.querySelector('[data-matrix=p]'), 'P = SG · 3 × 3', 'Project all nodes', fit?.p, ['z','x','y'], ['z','x','y']);
      const readout = root.querySelector('[data-output=landing]'), status = root.querySelector('[data-output=status]');
      const gap = base[0] - base[1] - base[2];
      if (landed) {
        const bottomRisk = M.risk(fit.g, trueW), baseRisk = trueW[1][1] + trueW[2][2];
        readout.innerHTML = `Gŷ = <strong>(x, y) = (${fmt(landed[1])}, ${fmt(landed[2])})</strong><br>SGŷ: z = ${fmt(landed[0])} = x + y · base mismatch ${fmt(gap,2)}`;
        status.textContent = `Expected bottom MSE: ${fmt(bottomRisk)} (base: ${fmt(baseRisk)}). This is an average over future errors under the true model, not the error of the point shown. ${v.method === 'shrink' ? `α = ${fmt(v.alpha,2)}; α = 1 gives sample-variance WLS.` : ''}`;
      } else {
        readout.textContent = 'No selected projection: the covariance cannot be inverted. The grey OLS reference is still shown.';
        status.textContent = `${error} T = ${v.t} gives sample rank at most ${Math.min(3, v.t-1)} of 3. Increase T or use positive shrinkage.`;
      }
      const points = [base, ols, ...(landed ? [landed] : [])];
      const lo = Math.min(-1, ...points.flatMap(p => [p[1]-1,p[2]-1]));
      const hi = Math.max(12, ...points.flatMap(p => [p[1]+1,p[2]+1]));
      const grid = Array.from({length:9}, (_, i) => lo + (hi-lo)*i/8);
      const data = [
        {type:'surface', x:grid,y:grid,z:grid.map(y => grid.map(x => x+y)),
          colorscale:[[0,'#c4d6ee'],[1,'#c4d6ee']], opacity:.26, showscale:false,
          name:'Coherent plane z = x + y', hoverinfo:'skip',
          contours:{x:{show:true,color:'#a7bedb',width:1},y:{show:true,color:'#a7bedb',width:1}}},
        segment('OLS path',base,ols,color.muted,'dash'), point('OLS reference',ols,color.muted,4),
        ...(landed ? [segment('Selected path',base,landed,color.blue),point('Selected projection',landed,color.blue,7)] : []),
        point('Base forecast',base,color.red,7)
      ];
      const axis = title => ({title:{text:title,font:{size:11}}, range:[lo,hi], showbackground:false,
        gridcolor:'#d6e0ee', zerolinecolor:'#a7bedb', tickfont:{size:10}, nticks:5});
      await Plotly.react(plot, data, {...layout, margin:{l:0,r:0,t:0,b:0}, showlegend:false,
        uirevision:viewRevision, scene:{xaxis:axis('Bottom x'),yaxis:axis('Bottom y'),
          zaxis:{...axis('Total z'),range:[Math.min(2*lo,...points.map(p=>p[0]-1)),Math.max(2*hi,...points.map(p=>p[0]+1))]},
          aspectmode:'cube',camera:{eye:{x:1.6,y:-1.7,z:1.1}}, bgcolor:color.bg}}, chartConfig);
    });
    root.addEventListener('input', () => { update(); });
    ctl.inputs.preset.addEventListener('change', () => { ctl.set(presets[ctl.inputs.preset.value]); update(); });
    root.querySelector('[data-action=reset]').addEventListener('click', () => { viewRevision++; ctl.set(defaults); update(); });
    await update(); observePlots(root);
  }
  async function regime(root) {
    const ctl = controls(root), riskPlot = root.querySelector('[data-plot=risk]'), correlationPlot = root.querySelector('[data-plot=correlation]');
    let seed = 1204, cache;
    const update = scheduler(async () => {
      const v = ctl.read(), m = +v.m, n = 2*m-1;
      const key = `${m}/${v.t}/${seed}`;
      if (cache?.key !== key) {
        const s = M.binaryHierarchy(m), trueW = M.hierarchyCovariance(s);
        cache = {key,s,trueW,sample:M.sampleCovariance(M.residuals(trueW,v.t,seed))};
      }
      const {s,trueW,sample} = cache, shrunk = M.shrink(sample,v.alpha);
      const baseRisk = trueW.slice(n-m).reduce((sum,row,i) => sum+row[n-m+i],0);
      const models = [
        {name:'Oracle GLS',w:trueW,c:color.green}, {name:'OLS',w:M.identity(n),c:color.muted},
        {name:'WLS',w:M.diagonal(sample),c:'#899ebd'}, {name:'Sample MinT',w:sample,c:'#bfa4c9'},
        {name:'Shrunk MinT',w:shrunk,c:color.blue}
      ];
      models.forEach(model => {
        try { model.risk = M.risk(M.reconcile(s,model.w).g,trueW) / baseRisk; }
        catch (_) { model.risk = null; }
      });
      root.querySelector('[data-output=stats]').innerHTML = `<span>N / T = <b>${fmt(n/v.t,2)}</b></span><span>Sample rank ≤ <b>${Math.min(n,v.t-1)} / ${n}</b></span><span>Shrinkage α = <b>${fmt(v.alpha,2)}</b></span>`;
      root.querySelector('[data-output=risk]').textContent = models.map(model => `${model.name}: ${model.risk === null ? 'unavailable' : fmt(model.risk)}`).join(' · ');
      const singular = models.filter(model => model.risk === null);
      root.querySelector('[data-output=status]').textContent = singular.length ?
        `${singular.map(model=>model.name).join(' and ')} unavailable: covariance is singular or ill-conditioned. Positive shrinkage toward a positive diagonal restores invertibility. No pseudoinverse or hidden ridge is used here.` :
        '1 = the unreconciled bottom forecasts. Lower is better. Change T, then draw another sample: a single sample can favor different estimates; the oracle is the known-covariance lower bound.';
      const correlations = shrunk.map((row,i) => row.map((z,j) => z / Math.sqrt(shrunk[i][i]*shrunk[j][j])));
      const labels = Array.from({length:n},(_,i) => i === 0 ? 'Total' : i >= n-m ? `b${i-(n-m)+1}` : `A${i}`);
      const maxRisk = Math.max(1.15,...models.map(model=>(model.risk || 0)*1.25));
      await Promise.all([
        Plotly.react(correlationPlot,[{type:'heatmap',z:correlations,x:labels,y:labels,zmin:-1,zmax:1,
          colorscale:[[0,color.red],[.5,'#f4f7fc'],[1,color.blue]],showscale:false,
          hovertemplate:'%{y} / %{x}<br>Correlation %{z:.3f}<extra></extra>'}],
        {...layout,margin:{l:38,r:4,t:16,b:35},xaxis:{showticklabels:n<20,tickfont:{size:9},fixedrange:true},
          yaxis:{autorange:'reversed',showticklabels:n<20,tickfont:{size:9},fixedrange:true}}, chartConfig),
        Plotly.react(riskPlot,[{type:'bar',orientation:'h',y:models.map(model=>model.name),x:models.map(model=>model.risk),
          marker:{color:models.map(model=>model.c)},text:models.map(model=>model.risk === null ? '' : fmt(model.risk)),
          textposition:'outside',cliponaxis:false,hovertemplate:'%{y}<br>Relative bottom MSE %{x:.3f}<extra></extra>'}],
        {...layout,margin:{l:94,r:40,t:16,b:35},showlegend:false,
          xaxis:{range:[0,maxRisk],gridcolor:'#d6e0ee',zeroline:false,fixedrange:true},
          yaxis:{autorange:'reversed',fixedrange:true},
          shapes:[{type:'line',xref:'x',yref:'paper',x0:1,x1:1,y0:0,y1:1,line:{color:color.red,width:1.5,dash:'dot'}}],
          annotations:models.filter(model=>model.risk === null).map(model=>({x:.05,y:model.name,xref:'x',yref:'y',text:'unavailable',showarrow:false,xanchor:'left',font:{color:color.red,size:10}}))}, chartConfig)
      ]);
    });
    root.addEventListener('input', () => { update(); });
    root.querySelector('[data-action=resample]').addEventListener('click', () => { seed++; update(); });
    await update(); observePlots(root);
  }
  async function init(root, render) {
    if (!M || !window.Plotly) {
      root.querySelectorAll('[data-plot]').forEach(el => { el.innerHTML = '<p class="mint-load-error">The chart library could not load. Reload with a network connection to explore this figure.</p>'; });
      return;
    }
    try { await render(root); }
    catch (error) { root.querySelector('[data-output=status]').textContent = `Unable to draw this figure: ${error.message}`; }
  }
  document.querySelectorAll('[data-mint-projection]').forEach(root => init(root,projection));
  document.querySelectorAll('[data-mint-regime]').forEach(root => init(root,regime));
}());
