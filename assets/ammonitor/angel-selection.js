let explanationModel='warning';
function initExplanations(){
 const tabs=[...document.querySelectorAll('[data-explanation]')];
 const choose=button=>{
  explanationModel=button.dataset.explanation;featurePage=0;
  tabs.forEach(b=>{b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1});
  document.getElementById('explanation-content').setAttribute('aria-labelledby',button.id);
  document.getElementById('explanation-title').textContent=explanationModel==='forecast'?'ANGEL · covariate selection':'Early warning · feature explanations';
  document.getElementById('feature-view').closest('label').hidden=explanationModel==='forecast';
  document.getElementById('angel-scope-label').hidden=explanationModel!=='forecast';
  drawFeatures();
 };
 tabs.forEach((b,i)=>{b.addEventListener('click',()=>choose(b));b.addEventListener('keydown',e=>{
  const next=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;
  if(next!==null){e.preventDefault();choose(tabs[next]);tabs[next].focus()}
 })});
 document.getElementById('angel-scope').addEventListener('change',()=>{featurePage=0;drawFeatures()});
}
function currentAngelDiagnostics(){
 const f=result.forecasting;
 return [f?.test_diagnostics,f?.replay].find(d=>d?.status==='ok'&&d.checkpoint_sha256===f?.release?.checkpoint_sha256)||null;
}
function drawAngelSelection(list){
 const f=result.forecasting,payload=f?.variable_selection;
 const global=document.getElementById('angel-scope').value==='global',diag=currentAngelDiagnostics(),summary=diag?.variable_selection;
 const valid=payload?.status==='ok'&&stamp(payload.timestamp)===stamp(f.timestamp);
 const current=new Map((valid?payload.features:[]).map(r=>[r.feature,r]));
 const rows=(global?summary?.features:valid?payload.features:[])?.slice().sort((a,b)=>global?a.rank-b.rank||a.feature.localeCompare(b.feature):b.weight-a.weight||a.feature.localeCompare(b.feature))||[];
 const replay=diag?.basis==='retrospective_daily_origins';
 document.querySelector('#angel-scope option[value=global]').textContent=replay?'Global · 7-day replay':'Global · test set';
 const panel=document.querySelector('.features-panel');panel.classList.toggle('angel-global',global);
 const header=document.getElementById('angel-selection-columns');
 header.innerHTML=global?`<span>ANGEL covariate</span><span>${replay?'Replay':'Test'} rank</span><span>Selection frequency</span><span>Avg weight when selected</span><span>Current weight</span>`:`<span>ANGEL covariate</span><span class="column-heading">Selection weight ${shapHelpButton('angel')}</span><span>Rank</span>`;
 bindFeatureHelp(header);
 document.querySelector('.feature-toolbar p').textContent=global?
  (summary?`${number(summary.windows,0)} ${replay?'daily replay origins (includes latest)':'held-out windows'} · ${time(diag.test_start)} – ${time(diag.test_end)} · Rank by mean weight over all windows (zeros included). Frequency = share of windows selected; conditional average excludes zeros.`:'Global statistics require test-set diagnostics for this checkpoint. Target history uses a separate branch.'):
  valid?`${payload.selected_covariates} / ${payload.covariates} covariates selected · ${time(payload.timestamp)} · Gates are shared across forecast hours; target history uses a separate branch.`:'Current-window ANGEL covariate weights · Target history uses a separate branch.';
 if(!rows.length){
  list.style.setProperty('--feature-rows',1);
  list.innerHTML=`<div class="diagnostic-empty"><strong>${global?'Test-set diagnostics unavailable':'Current weights unavailable'}</strong><p>${global?'This release has no matching test-set selection export. Global ranking, selection frequency and average weight when selected will appear when diagnostics are attached.':'Selection weights will appear after the next ANGEL inference run.'}</p></div>`;
  document.getElementById('feature-page-info').textContent=global?'No test-set weights':'No current weights';
  document.getElementById('features-prev').disabled=true;document.getElementById('features-next').disabled=true;return;
 }
 const size=Math.max(1,Math.min(window.innerWidth<=700?4:8,Math.floor(list.clientHeight/(window.innerWidth<=700?(global?128:80):65))));
 const pages=Math.ceil(rows.length/size);featurePage=Math.min(Math.max(0,featurePage),pages-1);
 const selected=rows.slice(featurePage*size,(featurePage+1)*size);list.style.setProperty('--feature-rows',selected.length);
 list.innerHTML=selected.map(item=>{
  const definition=result.feature_dictionary?.[item.feature],label=definition?.label||item.feature.replaceAll('_',' ');
  const name=`<div class="feature-name"><div class="feature-label"><strong>${escapeHtml(label)}</strong>${definition?`<button type="button" class="feature-help" data-feature-help="${escapeHtml(item.feature)}" aria-label="About ${escapeHtml(label)}">?</button>`:''}</div><small>${escapeHtml(item.feature)}</small></div>`;
  if(global)return `<article class="feature-row angel-feature-row">${name}<div class="angel-stat"><small>${replay?'Replay':'Test'} rank</small><strong>#${item.rank}</strong><span>Mean ${pct(item.mean_weight)}</span></div><div class="angel-stat"><small>Selection frequency</small><strong>${pct(item.selection_frequency)}</strong></div><div class="angel-stat"><small>Avg when selected</small><strong>${pct(item.avg_weight_when_selected)}</strong></div><div class="angel-stat"><small>Current weight</small><strong>${pct(current.get(item.feature)?.weight)}</strong></div></article>`;
  const value=item.weight>0&&item.weight<.0001?'<0.01%':pct(item.weight);
  return `<article class="feature-row angel-feature-row">${name}<div class="angel-weight"><div class="angel-weight-track" role="img" aria-label="Selection weight ${escapeHtml(value)}"><span style="width:${Math.max(0,Math.min(100,item.weight*100))}%"></span></div><strong>${escapeHtml(value)}</strong></div><div class="angel-rank"><strong>#${item.rank}</strong><small>${item.selected?'Selected':'Not selected'}</small></div></article>`;
 }).join('');
 document.getElementById('feature-page-info').textContent=`${featurePage*size+1}–${Math.min((featurePage+1)*size,rows.length)} of ${rows.length} covariates`;
 document.getElementById('features-prev').disabled=featurePage===0;document.getElementById('features-next').disabled=featurePage>=pages-1;bindFeatureHelp(list);
}
