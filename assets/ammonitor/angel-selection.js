function drawAngelSelection(list){
 const payload=result.forecasting?.variable_selection;
 const valid=payload?.status==='ok'&&stamp(payload.timestamp)===stamp(result.forecasting.timestamp);
 const rows=valid?(payload.features||[]).slice().sort((a,b)=>b.weight-a.weight||a.feature.localeCompare(b.feature)):[];
 const caption=document.querySelector('.feature-toolbar p');
 caption.textContent=valid?`${payload.selected_covariates} / ${payload.covariates} covariates selected · ${time(payload.timestamp)} · Target history uses a separate branch.`:
   'Current-window ANGEL covariate weights · Target history uses a separate branch.';
 if(!rows.length){
   list.style.setProperty('--feature-rows',1);
   list.innerHTML='<div class="loading">Selection weights will appear after the next ANGEL inference run.</div>';
   document.getElementById('feature-page-info').textContent='No current weights';
   document.getElementById('features-prev').disabled=true;document.getElementById('features-next').disabled=true;
   return;
 }
 const size=Math.max(2,Math.min(window.innerWidth<=700?5:8,Math.floor(list.clientHeight/(window.innerWidth<=700?80:65))));
 const pages=Math.ceil(rows.length/size);featurePage=Math.min(Math.max(0,featurePage),pages-1);
 const selected=rows.slice(featurePage*size,(featurePage+1)*size);
 list.style.setProperty('--feature-rows',selected.length);
 list.innerHTML=selected.map(item=>{
   const definition=result.feature_dictionary?.[item.feature];
   const value=item.weight>0&&item.weight<.0001?'<0.01%':number(item.weight*100,2)+'%';
   return `<article class="feature-row angel-feature-row"><div class="feature-name"><div class="feature-label"><strong>${escapeHtml(definition?.label||item.feature.replaceAll('_',' '))}</strong>${definition?`<button type="button" class="feature-help" data-feature-help="${escapeHtml(item.feature)}" aria-label="About ${escapeHtml(definition.label)}">?</button>`:''}</div><small>${escapeHtml(item.feature)}</small></div><div class="angel-weight"><div class="angel-weight-track" role="img" aria-label="Selection weight ${escapeHtml(value)}"><span style="width:${Math.max(0,Math.min(100,item.weight*100))}%"></span></div><strong>${escapeHtml(value)}</strong></div><div class="angel-rank"><strong>#${item.rank}</strong><small>${item.selected?'Selected':'Not selected'}</small></div></article>`;
 }).join('');
 document.getElementById('feature-page-info').textContent=`${featurePage*size+1}–${Math.min((featurePage+1)*size,rows.length)} of ${rows.length} covariates`;
 document.getElementById('features-prev').disabled=featurePage===0;
 document.getElementById('features-next').disabled=featurePage>=pages-1;
 bindFeatureHelp(list);
}
