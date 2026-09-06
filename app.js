(() => {
  'use strict';
  const current = window.BESTIARY_DATA;
  const history = window.BESTIARY_HISTORY || [];
  const config = window.BESTIARY_CONFIG;
  const app = document.querySelector('#app');
  if (!current?.models?.length || !config) throw new Error('Frontier data or configuration did not load');

  const dimensions = [['overall', 'Overall'], ['reasoning', 'Reasoning'], ['coding', 'Coding'], ['agentic', 'Agentic'], ['multimodal', 'Multimodal'], ['knowledge', 'Knowledge'], ['multilingual', 'Multilingual'], ['instruction', 'Instruction'], ['math', 'Math']];
  const state = { dimension: 'overall', selected: 0, detailOpen: false, compareA: null, compareB: null, awaitingCompare: false, throughputPlaying: false };
  let detailTrigger = null;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const valueFor = (model, dimension = state.dimension) => dimension === 'overall' ? model.overall : model.categories?.[dimension];
  const labelFor = key => dimensions.find(([id]) => id === key)?.[1] || key;
  const exact = value => value == null ? 'Unknown' : Number(value).toFixed(2);
  const money = value => value == null ? 'Unknown — source does not list a price' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD per 1M tokens`;
  const evidenceLabel = status => status === 'supported' ? 'Supported evidence' : status === 'estimated' ? 'Estimated evidence' : 'Evidence status unknown';
  const humanDate = value => {
    if (!value) return 'Unknown';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
    return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
  };
  const ranksFor = dimension => {
    const reported = current.models.map((model, index) => ({ index, value: valueFor(model, dimension) })).filter(item => item.value != null).sort((a, b) => b.value - a.value || a.index - b.index);
    const ranks = new Map();
    reported.forEach((item, order) => ranks.set(item.index, order && item.value === reported[order - 1].value ? ranks.get(reported[order - 1].index) : order + 1));
    return ranks;
  };
  const scoreBar = (value, color) => `<span class="score-bar${value == null ? ' missing' : ''}" aria-hidden="true"><i style="${value == null ? '' : `width:${Math.max(0, Math.min(100, value))}%;background:${color}`} "></i></span>`;
  const artLabel = model => model.artStatus === 'approved' ? `${model.breed} breed · ${model.individual}` : `${model.breed} · Lineage artwork pending`;

  function specimenButton(model, index) {
    const x = config.canvas.laneCenters[index] / config.canvas.width * 100;
    return `<button class="creature${model.artStatus === 'pending' ? ' pending-art' : ''}" data-model="${index}" style="--x:${x}%;--c:${model.colors[0]}" aria-pressed="false">
      <span class="pending-label">${model.artStatus === 'pending' ? 'Artwork pending' : ''}</span>
      <span class="creature-label"><span class="provider">${esc(model.provider)}</span><strong>${esc(model.name)}</strong><span class="overall">Overall <b>${exact(model.overall)}</b></span></span>
    </button>`;
  }

  app.innerHTML = `
    <header class="site-header">
      <div class="brand"><p class="kicker">AI MODEL CAPABILITY SNAPSHOTS</p><h1>FRONTIER <em>BESTIARY</em></h1></div>
      <div class="provenance"><span>Source updated <strong>${esc(current.sourceUpdated || 'Unknown')}</strong></span><span>Captured <strong>${esc(humanDate(current.capturedAt || current.date))}</strong></span></div>
      <div class="premise"><p>Five provider leaders. One shared Ancient Vault Dragon anatomy. Exact Overall controls the modest body-size comparison.</p><p class="qualification">${esc(current.scope)}</p><div class="header-links"><a href="${esc(current.methodologyUrl)}" target="_blank" rel="noreferrer">Scoring methodology ↗</a><details><summary>Selection and scale</summary><p>All Current source rows with valid Overall are grouped by provider. Each provider’s maximum is ranked globally and the first five are shown. Exact ties use provider ID, then model ID. The single approved painting encodes body height approximately—not pixel-perfectly—as 5 × Overall; exact numbers remain authoritative. Body area and volume encode nothing.</p></details></div></div>
    </header>

    <section class="explorer" aria-labelledby="lineup-heading">
      <div class="lineup-heading"><div><p class="eyebrow">Shared species comparison</p><h2 id="lineup-heading">Ancient Vault Dragons</h2></div><p>Color, horns, and scales identify provider breed only.</p></div>
      <div id="model-selector" class="model-selector" tabindex="-1">
        <div class="mobile-identity"><span data-mobile-provider></span><strong data-mobile-name></strong><b data-mobile-overall></b></div>
        <label class="model-select">Choose a model<select id="mobile-model">${current.models.map((model, index) => `<option value="${index}">${esc(model.provider)} — ${esc(model.name)}</option>`).join('')}</select></label>
        <div class="arena" aria-label="Select one of five provider-leading models"><img class="world-art" src="${esc(config.masterAsset)}" alt="Five ancient dragons of one species standing at a common scale and camera angle"><div class="arena-shade" aria-hidden="true"></div>${current.models.map(specimenButton).join('')}</div>
        <div class="mobile-stage"><img data-mobile-art alt=""><span class="art-pending" data-art-pending hidden>Lineage artwork pending</span><button class="stage-arrow previous" data-step="-1" aria-label="Previous model">‹</button><button class="stage-arrow next" data-step="1" aria-label="Next model">›</button><span class="stage-count" data-stage-count></span></div>
      </div>

      <details class="reading-legend"><summary>How to read the dragons</summary><ul><li><strong>Body height ∝ Overall.</strong> Same anatomy, camera, pose family, and common baseline. The painting is a measured approximate encoding.</li><li><strong>Provider identity:</strong> color, horn surface, and scale texture only.</li><li><strong>Unencoded:</strong> reliability, task cost, and open-weight status are unavailable fields—not low values.</li></ul></details>

      <div class="trait-control"><div><p class="eyebrow">Evidence comparison</p><h2>Choose a reported capability</h2></div><div class="trait-buttons" role="group" aria-label="Capability to compare">${dimensions.map(([id, label]) => `<button data-dimension="${id}" aria-pressed="false">${label}</button>`).join('')}</div><label class="trait-select">Capability<select id="mobile-dimension">${dimensions.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select></label></div>
      <div class="capability-strip" data-capability-strip aria-label="Selected capability values; painting size and order stay fixed"></div>

      <section class="selection-summary" aria-labelledby="selected-name" aria-live="polite">
        <div class="selection-heading"><div><p class="eyebrow" data-selected-provider></p><h2 id="selected-name" data-selected-name></h2><p class="creature-title" data-selected-title></p></div><span class="evidence-badge" data-selected-evidence></span></div>
        <div class="persistent-overall"><span>Overall · persistent body-size measure</span><strong data-selected-overall></strong></div>
        <div class="selected-score"><span data-selected-dimension></span><strong data-selected-score></strong><span data-selected-rank></span></div><div data-selected-bar></div><p class="score-note" data-score-note></p>
        <div class="selection-actions"><button class="primary" data-inspect>Inspect scores &amp; evidence</button><button data-compare>Compare with another</button></div><p class="compare-prompt" data-compare-prompt hidden></p>
      </section>

      <details class="size-comparison"><summary>Compare sizes</summary><p>One common-scale crop of the approved master. Scroll this panel locally on narrow screens.</p><div class="size-scroll"><img src="${esc(config.masterAsset)}" alt="All five Ancient Vault Dragons shown together at the common painted scale"><ol>${current.models.map(model => `<li><strong>${esc(model.name)}</strong><span>${exact(model.overall)}</span></li>`).join('')}</ol></div></details>
    </section>

    <section class="history-note" aria-labelledby="history-heading"><div><p class="eyebrow">History</p><h2 id="history-heading" data-history-heading></h2></div><div data-history-body></div></section>
    <section class="detail-panel" data-detail hidden aria-labelledby="detail-title"><div class="section-heading"><div><p class="eyebrow">Evidence record</p><h2 id="detail-title" data-detail-name></h2><p data-detail-creature></p></div><button class="icon-button" data-close-detail aria-label="Close evidence details">×</button></div><div class="detail-body" data-detail-body></div></section>
    <section class="compare-panel" data-compare-panel hidden aria-labelledby="compare-title"><div class="section-heading"><div><p class="eyebrow">Side-by-side</p><h2 id="compare-title">Model comparison</h2></div><button class="icon-button" data-close-compare aria-label="Close comparison">×</button></div><div data-compare-body></div></section>
    <div class="sr-only" aria-live="polite" aria-atomic="true" data-announcer></div>
    <footer>Scores, evidence classifications, throughput, metadata, and token prices are reproduced from <a href="${esc(current.source)}" target="_blank" rel="noreferrer">BenchLM ↗</a>. The shared dragon species and breed identities are illustrative.</footer>`;

  const nodes = {
    traitButtons: [...document.querySelectorAll('[data-dimension]')], mobileDimension: document.querySelector('#mobile-dimension'), mobileModel: document.querySelector('#mobile-model'),
    creatures: [...document.querySelectorAll('[data-model]')], mobileArt: document.querySelector('[data-mobile-art]'), stageCount: document.querySelector('[data-stage-count]'),
    detail: document.querySelector('[data-detail]'), comparePanel: document.querySelector('[data-compare-panel]'), announcer: document.querySelector('[data-announcer]')
  };

  function renderSelection() {
    const model = current.models[state.selected];
    const value = valueFor(model); const ranks = ranksFor(state.dimension); const rank = ranks.get(state.selected);
    nodes.traitButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dimension === state.dimension)));
    nodes.mobileDimension.value = state.dimension; nodes.mobileModel.value = String(state.selected);
    nodes.creatures.forEach((button, index) => { button.setAttribute('aria-pressed', String(index === state.selected)); button.setAttribute('aria-label', `${current.models[index].provider}, ${current.models[index].name}, Overall ${exact(current.models[index].overall)}`); });
    document.querySelector('[data-mobile-provider]').textContent = model.provider;
    document.querySelector('[data-mobile-name]').textContent = model.name;
    document.querySelector('[data-mobile-overall]').textContent = `Overall ${exact(model.overall)}`;
    nodes.mobileArt.hidden = !model.portraitAsset; nodes.mobileArt.src = model.portraitAsset || ''; nodes.mobileArt.alt = model.portraitAsset ? `${artLabel(model)}, shown in the common-scale portrait viewport` : '';
    document.querySelector('[data-art-pending]').hidden = Boolean(model.portraitAsset); nodes.stageCount.textContent = `${state.selected + 1} of ${current.models.length}`;
    document.querySelector('[data-selected-provider]').textContent = model.provider;
    document.querySelector('[data-selected-name]').textContent = model.name;
    document.querySelector('[data-selected-title]').textContent = `${artLabel(model)} · ${model.species}`;
    const badge = document.querySelector('[data-selected-evidence]'); badge.textContent = evidenceLabel(model.evidenceStatus); badge.dataset.status = model.evidenceStatus;
    document.querySelector('[data-selected-overall]').textContent = exact(model.overall);
    document.querySelector('[data-selected-dimension]').textContent = state.dimension === 'overall' ? 'Overall (selected capability)' : labelFor(state.dimension);
    document.querySelector('[data-selected-score]').textContent = exact(value);
    document.querySelector('[data-selected-rank]').textContent = rank ? `Rank #${rank} among ${ranks.size} reported results in this lineup` : 'Not ranked — result unknown';
    document.querySelector('[data-selected-bar]').innerHTML = scoreBar(value, model.colors[0]);
    document.querySelector('[data-score-note]').textContent = value == null ? `Unknown — the source does not report ${labelFor(state.dimension).toLowerCase()} for this model. No magnitude is implied.` : `${labelFor(state.dimension)} uses the source’s 0–100 scale. Changing capability never changes the painted body size or lane order.`;
    const stripRanks = ranksFor(state.dimension);
    document.querySelector('[data-capability-strip]').innerHTML = current.models.map((item, index) => `<button data-strip-model="${index}" aria-pressed="${index === state.selected}" style="--c:${item.colors[0]}"><span>${esc(item.provider)}</span><strong>${esc(item.name)}</strong><b>${exact(valueFor(item))}</b><small>${stripRanks.has(index) ? `#${stripRanks.get(index)} among reported` : 'Unknown'}</small></button>`).join('');
    document.querySelectorAll('[data-strip-model]').forEach(button => button.addEventListener('click', () => selectModel(Number(button.dataset.stripModel))));
    const prompt = document.querySelector('[data-compare-prompt]'); prompt.hidden = !state.awaitingCompare; prompt.textContent = state.awaitingCompare ? `Choose a second model to compare with ${current.models[state.compareA].name}.` : '';
  }

  function selectModel(index, announce = true) {
    if (state.awaitingCompare && state.compareA !== index) { state.compareB = index; state.awaitingCompare = false; state.selected = index; renderSelection(); openComparison(); return; }
    state.selected = Math.max(0, Math.min(current.models.length - 1, index)); renderSelection(); if (state.detailOpen) renderDetail(); if (announce) nodes.announcer.textContent = `${current.models[state.selected].name} selected. Overall ${exact(current.models[state.selected].overall)}.`;
  }
  function setDimension(dimension) { state.dimension = dimension; renderSelection(); renderHistory(); if (state.detailOpen) renderDetail(); if (state.compareA != null && state.compareB != null) renderComparison(); nodes.announcer.textContent = `${labelFor(dimension)} selected. Painting size and order remain fixed.`; }

  function statRows(model) { return dimensions.map(([key, label]) => { const value = valueFor(model, key); return `<div class="stat-row${value == null ? ' unknown' : ''}"><span>${esc(label)}${key === state.dimension ? ' <em>Selected</em>' : ''}</span>${scoreBar(value, model.colors[0])}<strong>${exact(value)}</strong></div>`; }).join(''); }
  function renderDetail() {
    const model = current.models[state.selected]; const speed = model.speed;
    document.querySelector('[data-detail-name]').textContent = model.name; document.querySelector('[data-detail-creature]').textContent = `${artLabel(model)} · ${model.species}`;
    document.querySelector('[data-detail-body]').innerHTML = `<div class="stats" aria-label="Reported capability scores">${statRows(model)}</div><div><dl class="facts">
      <div><dt>Evidence classification</dt><dd>${esc(evidenceLabel(model.evidenceStatus))}</dd></div><div><dt>Source families</dt><dd>${model.sourceFamilies == null ? 'Unknown' : esc(model.sourceFamilies)}</dd></div>
      <div><dt>Source-listed throughput</dt><dd>${speed == null ? 'Unknown — source does not list throughput' : `${esc(speed)} ${esc(model.speedUnit)}`}</dd></div><div><dt>Context window</dt><dd>${esc(model.context || 'Unknown')}</dd></div>
      <div><dt>Input price</dt><dd>${esc(money(model.inputPrice))}</dd></div><div><dt>Output price</dt><dd>${esc(money(model.outputPrice))}</dd></div>
      <div><dt>Reliability</dt><dd>Unknown — field unavailable</dd></div><div><dt>Task cost per encounter</dt><dd>Unknown — no task size defined</dd></div><div><dt>Open-weight status</dt><dd>Unknown — unencoded</dd></div><div><dt>Methodology</dt><dd>${esc(model.methodology || 'Unknown')}</dd></div></dl>
      <div class="throughput"><h3>Observe throughput</h3>${speed == null ? '<p>Unavailable: no source-listed throughput.</p>' : `<p>Token-throughput metaphor only; not task-completion speed.</p><div class="motion-track"><i style="--duration:${(327 / speed * 1.2).toFixed(2)}s"></i></div><button data-throughput aria-pressed="false">Play demonstration</button>`}</div>
      <a class="record-link" href="${esc(model.sourceUrl)}" target="_blank" rel="noreferrer">Open this model’s evidence record ↗</a></div><p class="anatomy-note">The fixed painting encodes Overall only. Evidence confidence is not reliability; token price is not encounter energy; no open-weight status is inferred.</p>`;
    document.querySelector('[data-throughput]')?.addEventListener('click', event => { state.throughputPlaying = !state.throughputPlaying; const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; event.currentTarget.setAttribute('aria-pressed', String(state.throughputPlaying && !reduced)); event.currentTarget.textContent = state.throughputPlaying && !reduced ? 'Pause demonstration' : 'Play demonstration'; event.currentTarget.closest('.throughput').classList.toggle('playing', state.throughputPlaying && !reduced); if (reduced) nodes.announcer.textContent = 'Motion is disabled by reduced-motion preference.'; });
  }
  function openDetail(event) { detailTrigger = event?.currentTarget || document.activeElement; state.detailOpen = true; renderDetail(); nodes.detail.hidden = false; nodes.detail.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); document.querySelector('[data-close-detail]').focus({ preventScroll: true }); }
  function closeDetail() { state.detailOpen = false; nodes.detail.hidden = true; if (detailTrigger?.isConnected) detailTrigger.focus(); }

  function renderComparison() {
    if (state.compareA == null || state.compareB == null) return;
    const a = current.models[state.compareA], b = current.models[state.compareB];
    const rows = [...dimensions, ['speed', 'Throughput'], ['inputPrice', 'Input price'], ['outputPrice', 'Output price']].map(([key, label]) => {
      const av = key === 'speed' ? (a.speed == null ? 'Unknown' : `${a.speed} ${a.speedUnit}`) : key.includes('Price') ? money(a[key]) : exact(valueFor(a, key));
      const bv = key === 'speed' ? (b.speed == null ? 'Unknown' : `${b.speed} ${b.speedUnit}`) : key.includes('Price') ? money(b[key]) : exact(valueFor(b, key));
      return `<tr><th scope="row">${esc(label)}${key === state.dimension ? ' · selected' : ''}</th><td>${esc(av)}</td><td>${esc(bv)}</td></tr>`;
    }).join('');
    document.querySelector('[data-compare-body]').innerHTML = `<div class="pair-art"><figure>${a.portraitAsset ? `<img src="${esc(a.portraitAsset)}" alt="">` : '<span>Artwork pending</span>'}<figcaption>${esc(a.name)} · Overall ${exact(a.overall)}</figcaption></figure><figure>${b.portraitAsset ? `<img src="${esc(b.portraitAsset)}" alt="">` : '<span>Artwork pending</span>'}<figcaption>${esc(b.name)} · Overall ${exact(b.overall)}</figcaption></figure></div><div class="table-scroll"><table><caption>Source facts and reported scores</caption><thead><tr><th scope="col">Field</th><th scope="col">${esc(a.name)}<button data-replace="a">Replace</button></th><th scope="col">${esc(b.name)}<button data-replace="b">Replace</button></th></tr></thead><tbody>${rows}<tr><th scope="row">Evidence</th><td>${esc(evidenceLabel(a.evidenceStatus))}</td><td>${esc(evidenceLabel(b.evidenceStatus))}</td></tr></tbody></table></div><p class="anatomy-note">Portraits retain one common crop size, baseline, and pixels-per-anatomical-unit. Missing facts are not losses.</p>`;
    document.querySelectorAll('[data-replace]').forEach(button => button.addEventListener('click', () => { state.awaitingCompare = true; state.compareA = button.dataset.replace === 'a' ? state.compareB : state.compareA; state.compareB = null; nodes.comparePanel.hidden = true; renderSelection(); document.querySelector('#model-selector').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); document.querySelector('#mobile-model').focus({ preventScroll: true }); }));
  }
  function openComparison() { renderComparison(); nodes.comparePanel.hidden = false; nodes.comparePanel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); document.querySelector('[data-close-compare]').focus({ preventScroll: true }); }

  function renderHistory() {
    const heading = document.querySelector('[data-history-heading]'), body = document.querySelector('[data-history-body]'); heading.textContent = `${history.length} snapshot${history.length === 1 ? '' : 's'} recorded`;
    if (history.length < 2) { body.innerHTML = `<p>History begins ${esc(humanDate(history[0]?.capturedAt || history[0]?.date || current.date))}. No earlier snapshot is available.</p>`; return; }
    const before = history.at(-2), after = history.at(-1); const providers = [...new Set([...(before.models || []).map(model => model.providerId || model.provider), ...(after.models || []).map(model => model.providerId || model.provider)])];
    const changes = providers.map(provider => { const oldModel = before.models?.find(model => (model.providerId || model.provider) === provider), newModel = after.models?.find(model => (model.providerId || model.provider) === provider); const name = newModel?.provider || oldModel?.provider || provider; if (!oldModel) return `<li><strong>${esc(name)}</strong><span>Entered the five-provider lineup.</span></li>`; if (!newModel) return `<li><strong>${esc(name)}</strong><span>Exited the five-provider lineup.</span></li>`; if ((oldModel.modelId || oldModel.slug) !== (newModel.modelId || newModel.slug)) return `<li><strong>${esc(name)}</strong><span>New model: ${esc(oldModel.name)} → ${esc(newModel.name)}.</span></li>`; if (oldModel.methodology !== newModel.methodology) return `<li><strong>${esc(name)}</strong><span>Methodology changed; not comparable.</span></li>`; const oldValue = valueFor(oldModel), newValue = valueFor(newModel); if (oldValue == null || newValue == null) return `<li><strong>${esc(name)}</strong><span>${oldValue == null && newValue == null ? 'Unknown in both snapshots' : oldValue == null ? 'New measurement reported' : 'Measurement no longer reported'}.</span></li>`; const delta = newValue - oldValue; return `<li><strong>${esc(name)}</strong><span>${Math.abs(delta) < .005 ? 'No reported score change' : `Reported score ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}`}.</span></li>`; }).join('');
    body.innerHTML = `<p>Latest source snapshot change: ${esc(humanDate(before.capturedAt || before.date))} → ${esc(humanDate(after.capturedAt || after.date))}. A score revision is not automatically a model evolution.</p><ul class="history-changes">${changes}</ul>`;
  }

  nodes.traitButtons.forEach(button => button.addEventListener('click', () => setDimension(button.dataset.dimension)));
  nodes.mobileDimension.addEventListener('change', event => setDimension(event.target.value)); nodes.mobileModel.addEventListener('change', event => selectModel(Number(event.target.value)));
  nodes.creatures.forEach(button => button.addEventListener('click', () => selectModel(Number(button.dataset.model))));
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => selectModel((state.selected + Number(button.dataset.step) + current.models.length) % current.models.length)));
  document.querySelector('[data-inspect]').addEventListener('click', openDetail); document.querySelector('[data-close-detail]').addEventListener('click', closeDetail);
  document.querySelector('[data-compare]').addEventListener('click', () => { state.compareA = state.selected; state.compareB = null; state.awaitingCompare = true; renderSelection(); nodes.announcer.textContent = `Choose a second model to compare with ${current.models[state.compareA].name}.`; nodes.mobileModel.focus(); });
  document.querySelector('[data-close-compare]').addEventListener('click', () => { nodes.comparePanel.hidden = true; document.querySelector('[data-compare]').focus(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (!nodes.detail.hidden) closeDetail(); else if (!nodes.comparePanel.hidden) { nodes.comparePanel.hidden = true; document.querySelector('[data-compare]').focus(); } return; } const editable = event.target.matches('input, textarea, select, [contenteditable="true"]'); const index = Number(event.key) - 1; if (!editable && Number.isInteger(index) && index >= 0 && index < current.models.length) { selectModel(index); (nodes.creatures[index].offsetParent ? nodes.creatures[index] : nodes.mobileModel).focus(); } });
  renderSelection(); renderHistory();
})();
