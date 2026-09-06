(() => {
  'use strict';

  const current = window.BESTIARY_DATA;
  const history = window.BESTIARY_HISTORY || [];
  const app = document.querySelector('#app');
  if (!current?.models?.length) throw new Error('Frontier data did not load');

  const dimensions = [
    ['overall', 'Overall'], ['reasoning', 'Reasoning'], ['coding', 'Coding'],
    ['agentic', 'Agentic'], ['multimodal', 'Multimodal'], ['knowledge', 'Knowledge'],
    ['multilingual', 'Multilingual'], ['instruction', 'Instruction'], ['math', 'Math']
  ];
  const positions = [13.5, 38.5, 63.5, 87.5];
  const portraitAssets = ['portrait-anthropic.png', 'portrait-openai.png', 'portrait-google.png', 'portrait-xai.png'];
  const state = { dimension: 'overall', selected: 0, detailOpen: false, compareA: null, compareB: null, awaitingCompare: false };
  let detailTrigger = null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const valueFor = (model, dimension = state.dimension) => dimension === 'overall' ? model.overall : model.categories?.[dimension];
  const labelFor = key => dimensions.find(([id]) => id === key)?.[1] || key;
  const displayScore = value => value == null ? 'Not reported' : Number(value).toFixed(1);
  const exactScore = value => value == null ? 'Not reported' : Number(value).toFixed(2);
  const money = value => value == null ? 'Not listed' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  const humanDate = value => {
    if (!value) return 'Not listed';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
    return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
  };

  function ranksFor(dimension = state.dimension) {
    const reported = current.models
      .map((model, index) => ({ index, value: valueFor(model, dimension) }))
      .filter(item => item.value != null)
      .sort((a, b) => b.value - a.value);
    const ranks = new Map();
    reported.forEach((item, order) => {
      const previous = reported[order - 1];
      ranks.set(item.index, previous && previous.value === item.value ? ranks.get(previous.index) : order + 1);
    });
    return ranks;
  }

  function scoreBar(value, color, compact = false) {
    const missing = value == null;
    return `<span class="score-bar${missing ? ' missing' : ''}${compact ? ' compact' : ''}" aria-hidden="true"><i style="${missing ? '' : `width:${Math.max(0, Math.min(100, value))}%;background:${color}`} "></i></span>`;
  }

  function selectionButton(model, index) {
    return `<button class="creature" data-model="${index}" style="--x:${positions[index]}%;--c:${model.colors[0]}" aria-pressed="false">
      <span class="creature-label">
        <span class="rank" data-rank-for="${index}"></span>
        <span class="identity"><strong>${esc(model.name)}</strong><small>${esc(model.title)}</small></span>
        <span class="score"><b data-score-for="${index}"></b><small data-status-for="${index}"></small></span>
      </span>
    </button>`;
  }

  function rosterButton(model, index) {
    return `<button class="roster-button" data-roster="${index}" aria-pressed="false" style="--c:${model.colors[0]}">
      <span>${esc(model.provider)}</span><strong>${esc(model.name)}</strong>
    </button>`;
  }

  app.innerHTML = `
    <header class="site-header">
      <div class="brand">
        <p class="kicker">AI MODEL CAPABILITY SNAPSHOTS</p>
        <h1>FRONTIER <em>BESTIARY</em></h1>
      </div>
      <div class="provenance" aria-label="Snapshot provenance">
        <span>Source updated <strong>${esc(current.sourceUpdated || 'Not listed')}</strong></span>
        <span>Snapshot captured <strong>${esc(humanDate(current.date))}</strong></span>
      </div>
      <div class="premise">
        <p>Compare four AI models by capability. Select a creature to inspect its scores and evidence.</p>
        <p class="qualification">One featured model per provider—not the whole market.</p>
        <div class="header-links">
          <a href="${esc(current.methodologyUrl)}" target="_blank" rel="noreferrer">How scoring works <span aria-hidden="true">↗</span></a>
          <details><summary>About this selection</summary><p>For each of Anthropic, OpenAI, Google, and xAI, the data pipeline selects the current model with the highest reported overall score in the source. Creature anatomy and size are illustrative, not measurements.</p></details>
        </div>
      </div>
    </header>

    <section class="explorer" aria-labelledby="selector-heading">
      <div class="trait-control">
        <div><p class="eyebrow">Capability</p><h2 id="selector-heading">Choose what to compare</h2></div>
        <div class="trait-buttons" role="group" aria-label="Capability to compare">
          ${dimensions.map(([id, label]) => `<button data-dimension="${id}" aria-pressed="false">${label}</button>`).join('')}
        </div>
        <label class="trait-select">Capability to compare
          <select id="mobile-dimension">${dimensions.map(([id, label]) => `<option value="${id}">${label}</option>`).join('')}</select>
        </label>
      </div>

      <div class="arena" id="model-selector" aria-label="Select a model">
        <img class="world-art" src="assets/bestiary-world.png" alt="Four illustrated apex creatures representing the selected models: a siege hexapod, armored constrictor, blade-armed biped, and shellbreaker">
        <div class="arena-shade" aria-hidden="true"></div>
        ${current.models.map(selectionButton).join('')}
      </div>

      <div class="mobile-stage" style="--portrait:0;--c:${current.models[0].colors[0]}">
        <div class="mobile-portrait" role="img" aria-label="" data-mobile-art></div>
        <button class="stage-arrow previous" data-step="-1" aria-label="Previous model">‹</button>
        <button class="stage-arrow next" data-step="1" aria-label="Next model">›</button>
        <span class="stage-count" data-stage-count></span>
      </div>

      <div class="roster" role="group" aria-label="Model roster">${current.models.map(rosterButton).join('')}</div>

      <section class="selection-summary" aria-labelledby="selected-name" aria-live="polite">
        <div class="selection-heading"><div><p class="eyebrow" data-selected-provider></p><h2 id="selected-name" data-selected-name></h2><p class="creature-title" data-selected-title></p></div><span class="evidence-badge" data-selected-confidence></span></div>
        <div class="selected-score"><span data-selected-dimension></span><strong data-selected-score></strong><span data-selected-rank></span></div>
        <div data-selected-bar></div>
        <p class="score-note" data-score-note></p>
        <div class="selection-actions">
          <button class="primary" data-inspect>Inspect scores &amp; evidence</button>
          <button data-compare>Compare with another</button>
        </div>
        <p class="compare-prompt" data-compare-prompt hidden></p>
      </section>
    </section>

    <section class="history-note" aria-labelledby="history-heading">
      <div><p class="eyebrow">History</p><h2 id="history-heading" data-history-heading></h2></div>
      <div data-history-body></div>
    </section>

    <section class="detail-panel" data-detail hidden aria-labelledby="detail-title">
      <div class="section-heading"><div><p class="eyebrow">Evidence record</p><h2 id="detail-title" data-detail-name></h2><p data-detail-creature></p></div><button class="icon-button" data-close-detail aria-label="Close evidence details">×</button></div>
      <div class="detail-body" data-detail-body></div>
    </section>

    <section class="compare-panel" data-compare-panel hidden aria-labelledby="compare-title">
      <div class="section-heading"><div><p class="eyebrow">Side-by-side</p><h2 id="compare-title">Model comparison</h2></div><button class="icon-button" data-close-compare aria-label="Close comparison">×</button></div>
      <div data-compare-body></div>
    </section>

    <div class="sr-only" aria-live="polite" aria-atomic="true" data-announcer></div>
    <footer>Scores, evidence classifications, metadata, and prices are reproduced from <a href="${esc(current.source)}" target="_blank" rel="noreferrer">BenchLM <span aria-hidden="true">↗</span></a>. Creature identities are illustrative.</footer>`;

  const nodes = {
    traitButtons: [...document.querySelectorAll('[data-dimension]')],
    mobileDimension: document.querySelector('#mobile-dimension'),
    creatures: [...document.querySelectorAll('[data-model]')],
    roster: [...document.querySelectorAll('[data-roster]')],
    mobileStage: document.querySelector('.mobile-stage'), mobileArt: document.querySelector('[data-mobile-art]'),
    stageCount: document.querySelector('[data-stage-count]'), announcer: document.querySelector('[data-announcer]'),
    detail: document.querySelector('[data-detail]'), comparePanel: document.querySelector('[data-compare-panel]')
  };

  function selectModel(index, announce = true) {
    if (state.awaitingCompare && state.compareA !== index) {
      state.compareB = index;
      state.awaitingCompare = false;
      state.selected = index;
      renderSelection();
      openComparison();
      return;
    }
    state.selected = index;
    renderSelection();
    if (state.detailOpen) renderDetail();
    if (announce) nodes.announcer.textContent = `${current.models[index].name} selected.`;
  }

  function setDimension(dimension, announce = true) {
    state.dimension = dimension;
    renderSelection();
    renderHistory();
    if (state.detailOpen) renderDetail();
    if (state.compareA != null && state.compareB != null) renderComparison();
    if (announce) nodes.announcer.textContent = `${labelFor(dimension)} selected. ${current.models[state.selected].name}: ${displayScore(valueFor(current.models[state.selected]))}.`;
  }

  function renderHistory() {
    const heading = document.querySelector('[data-history-heading]');
    const body = document.querySelector('[data-history-body]');
    const count = history.length;
    heading.textContent = `${count} snapshot${count === 1 ? '' : 's'} recorded`;
    if (count < 2) {
      body.innerHTML = `<p>History begins ${esc(humanDate(history[0]?.date || current.date))}. There is no earlier snapshot to compare yet.</p>`;
      return;
    }
    const previous = history.at(-2), latest = history.at(-1);
    const changes = current.models.map(model => {
      const before = previous.models?.find(item => item.provider === model.provider);
      const after = latest.models?.find(item => item.provider === model.provider);
      if (!before || !after) return `<li><strong>${esc(model.provider)}</strong><span>Lineup record added or removed.</span></li>`;
      if (before.slug !== after.slug) return `<li><strong>${esc(model.provider)}</strong><span>Lineup changed: ${esc(before.name)} → ${esc(after.name)}</span></li>`;
      if (before.methodology !== after.methodology) return `<li><strong>${esc(model.provider)}</strong><span>Methodology changed; score movement is not compared.</span></li>`;
      const oldValue = state.dimension === 'overall' ? before.overall : before.categories?.[state.dimension];
      const newValue = state.dimension === 'overall' ? after.overall : after.categories?.[state.dimension];
      if (oldValue == null && newValue == null) return `<li><strong>${esc(model.provider)}</strong><span>No ${esc(labelFor(state.dimension).toLowerCase())} result reported in either snapshot.</span></li>`;
      if (oldValue == null || newValue == null) return `<li><strong>${esc(model.provider)}</strong><span>${oldValue == null ? 'New measurement reported' : 'Measurement no longer reported'}.</span></li>`;
      const delta = newValue - oldValue;
      const change = Math.abs(delta) < .005 ? 'No reported score change' : `Reported score ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}`;
      return `<li><strong>${esc(model.provider)}</strong><span>${change}.</span></li>`;
    }).join('');
    body.innerHTML = `<p>Latest change in ${esc(labelFor(state.dimension))}: ${esc(humanDate(previous.date))} → ${esc(humanDate(latest.date))}. Score movement is a source observation, not proof of real-world improvement.</p><ul class="history-changes">${changes}</ul>`;
  }

  function renderSelection() {
    const model = current.models[state.selected];
    const value = valueFor(model);
    const ranks = ranksFor();
    const rank = ranks.get(state.selected);
    nodes.traitButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dimension === state.dimension)));
    nodes.mobileDimension.value = state.dimension;
    nodes.creatures.forEach((button, index) => {
      const item = current.models[index];
      const itemValue = valueFor(item);
      button.setAttribute('aria-pressed', String(index === state.selected));
      button.querySelector(`[data-score-for="${index}"]`).textContent = itemValue == null ? '—' : Number(itemValue).toFixed(1);
      button.querySelector(`[data-status-for="${index}"]`).textContent = itemValue == null ? 'Not reported' : item.confidence === 'estimated' ? 'Estimated' : labelFor(state.dimension);
      const itemRank = ranks.get(index);
      button.querySelector(`[data-rank-for="${index}"]`).textContent = itemRank ? `#${itemRank}` : '—';
      button.setAttribute('aria-label', `${item.name}, ${displayScore(itemValue)} for ${labelFor(state.dimension)}${itemRank ? `, rank ${itemRank} among reported models` : ''}`);
    });
    nodes.roster.forEach((button, index) => button.setAttribute('aria-pressed', String(index === state.selected)));
    nodes.mobileStage.style.setProperty('--portrait-url', `url('assets/${portraitAssets[state.selected]}')`);
    nodes.mobileStage.style.setProperty('--c', model.colors[0]);
    nodes.mobileArt.setAttribute('aria-label', `${model.title}, the illustrated identity for ${model.name}`);
    nodes.stageCount.textContent = `${state.selected + 1} of ${current.models.length}`;
    document.querySelector('[data-selected-provider]').textContent = model.provider;
    document.querySelector('[data-selected-name]').textContent = model.name;
    document.querySelector('[data-selected-title]').textContent = `${model.title} · ${model.species}`;
    const badge = document.querySelector('[data-selected-confidence]');
    badge.textContent = model.confidence === 'estimated' ? 'Estimated evidence' : 'Supported evidence';
    badge.classList.toggle('estimated', model.confidence === 'estimated');
    document.querySelector('[data-selected-dimension]').textContent = labelFor(state.dimension);
    document.querySelector('[data-selected-score]').textContent = displayScore(value);
    document.querySelector('[data-selected-rank]').textContent = rank ? `Rank #${rank} among ${ranks.size} reported` : 'Not ranked — no result reported';
    document.querySelector('[data-selected-bar]').innerHTML = scoreBar(value, model.colors[0]);
    document.querySelector('[data-score-note]').textContent = value == null
      ? `The source reports no ${labelFor(state.dimension).toLowerCase()} result for this model. No numeric magnitude is implied.`
      : `${labelFor(state.dimension)} is shown on the source's 0–100 scale. ${model.confidence === 'estimated' ? 'The source classifies this model’s evidence as estimated.' : 'Source precision is available in the evidence record.'}`;
    const prompt = document.querySelector('[data-compare-prompt]');
    prompt.hidden = !state.awaitingCompare;
    prompt.textContent = state.awaitingCompare ? `Choose a second model to compare with ${current.models[state.compareA].name}.` : '';
  }

  function detailRows(model) {
    const ordered = [state.dimension, ...dimensions.map(([key]) => key).filter(key => key !== state.dimension)];
    return [...new Set(ordered)].map(key => {
      const value = valueFor(model, key);
      return `<div class="stat-row${value == null ? ' unknown' : ''}"><span>${esc(labelFor(key))}${key === state.dimension ? ' <em>Selected</em>' : ''}</span>${scoreBar(value, model.colors[0], true)}<strong>${esc(exactScore(value))}</strong></div>`;
    }).join('');
  }

  function renderDetail() {
    const model = current.models[state.selected];
    document.querySelector('[data-detail-name]').textContent = model.name;
    document.querySelector('[data-detail-creature]').textContent = `${model.title} · ${model.species}`;
    document.querySelector('[data-detail-body]').innerHTML = `<div class="stats" aria-label="Reported capability scores">${detailRows(model)}</div>
      <dl class="facts">
        <div><dt>Evidence classification</dt><dd>${esc(model.confidence)}</dd></div>
        <div><dt>Source families</dt><dd>${esc(model.sourceFamilies ?? 'Not listed')}</dd></div>
        <div><dt>Context window</dt><dd>${esc(model.context || 'Not listed')}</dd></div>
        <div><dt>Input / 1M tokens</dt><dd>${esc(money(model.inputPrice))}</dd></div>
        <div><dt>Output / 1M tokens</dt><dd>${esc(money(model.outputPrice))}</dd></div>
        <div><dt>Model released</dt><dd>${esc(humanDate(model.releaseDate))}</dd></div>
        <div><dt>Methodology version</dt><dd>${esc(model.methodology || 'Not listed')}</dd></div>
      </dl>
      <a class="record-link" href="${esc(model.sourceUrl)}" target="_blank" rel="noreferrer">Open this model’s evidence record <span aria-hidden="true">↗</span></a>
      <p class="anatomy-note">Creature anatomy is metaphor. Reported scores and explicit missing states are the quantitative record.</p>`;
  }

  function openDetail(event) {
    detailTrigger = event?.currentTarget || document.activeElement;
    state.detailOpen = true;
    renderDetail();
    nodes.detail.hidden = false;
    nodes.detail.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    document.querySelector('[data-close-detail]').focus({ preventScroll: true });
  }

  function closeDetail() {
    state.detailOpen = false;
    nodes.detail.hidden = true;
    if (detailTrigger?.isConnected) detailTrigger.focus();
  }

  function compareRow(label, a, b, format = value => esc(value ?? 'Not listed')) {
    return `<div class="compare-row"><strong>${esc(label)}</strong><span>${format(a)}</span><span>${format(b)}</span></div>`;
  }

  function renderComparison() {
    if (state.compareA == null || state.compareB == null) return;
    const a = current.models[state.compareA], b = current.models[state.compareB];
    const categories = [state.dimension, ...dimensions.map(([key]) => key).filter(key => key !== state.dimension && (valueFor(a, key) != null || valueFor(b, key) != null))];
    document.querySelector('[data-compare-body]').innerHTML = `<div class="compare-grid">
      <div class="compare-row compare-head"><strong>Field</strong><span style="--c:${a.colors[0]}"><b>${esc(a.name)}</b><button data-replace="a">Replace</button></span><span style="--c:${b.colors[0]}"><b>${esc(b.name)}</b><button data-replace="b">Replace</button></span></div>
      ${[...new Set(categories)].map(key => compareRow(`${labelFor(key)}${key === state.dimension ? ' · selected' : ''}`, valueFor(a, key), valueFor(b, key), score => score == null ? '<em>Not reported</em>' : `${Number(score).toFixed(1)}${a.confidence === 'estimated' || b.confidence === 'estimated' ? '' : ''}`)).join('')}
      ${compareRow('Evidence', a.confidence, b.confidence)}
      ${compareRow('Context', a.context, b.context)}
      ${compareRow('Input / 1M tokens', a.inputPrice, b.inputPrice, money)}
      ${compareRow('Output / 1M tokens', a.outputPrice, b.outputPrice, money)}
      ${compareRow('Evidence record', `<a href="${esc(a.sourceUrl)}" target="_blank" rel="noreferrer">Open source ↗</a>`, `<a href="${esc(b.sourceUrl)}" target="_blank" rel="noreferrer">Open source ↗</a>`, value => value)}
    </div><p class="anatomy-note">Scores use the same snapshot and selected capability. Missing results are not treated as losses. Prices are source-listed amounts.</p>`;
    document.querySelectorAll('[data-replace]').forEach(button => button.addEventListener('click', () => {
      state.awaitingCompare = true;
      state.compareA = button.dataset.replace === 'a' ? state.compareB : state.compareA;
      state.compareB = null;
      nodes.comparePanel.hidden = true;
      renderSelection();
      document.querySelector('#model-selector').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
  }

  function openComparison() {
    renderComparison();
    nodes.comparePanel.hidden = false;
    nodes.comparePanel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    document.querySelector('[data-close-compare]').focus({ preventScroll: true });
  }

  nodes.traitButtons.forEach(button => button.addEventListener('click', () => setDimension(button.dataset.dimension)));
  nodes.mobileDimension.addEventListener('change', event => setDimension(event.target.value));
  nodes.creatures.forEach(button => {
    button.addEventListener('click', () => selectModel(Number(button.dataset.model)));
    button.addEventListener('mouseenter', () => button.classList.add('hovered'));
    button.addEventListener('mouseleave', () => button.classList.remove('hovered'));
  });
  nodes.roster.forEach(button => button.addEventListener('click', () => selectModel(Number(button.dataset.roster))));
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => selectModel((state.selected + Number(button.dataset.step) + current.models.length) % current.models.length)));
  document.querySelector('[data-inspect]').addEventListener('click', openDetail);
  document.querySelector('[data-close-detail]').addEventListener('click', closeDetail);
  document.querySelector('[data-compare]').addEventListener('click', event => {
    state.compareA = state.selected; state.compareB = null; state.awaitingCompare = true;
    renderSelection();
    nodes.announcer.textContent = `Choose a second model to compare with ${current.models[state.compareA].name}.`;
    event.currentTarget.blur();
  });
  document.querySelector('[data-close-compare]').addEventListener('click', () => { nodes.comparePanel.hidden = true; document.querySelector('[data-compare]').focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!nodes.detail.hidden) closeDetail();
      else if (!nodes.comparePanel.hidden) { nodes.comparePanel.hidden = true; document.querySelector('[data-compare]').focus(); }
      return;
    }
    const editable = event.target.matches('input, textarea, select, [contenteditable="true"]');
    if (!editable && /^[1-4]$/.test(event.key)) {
      selectModel(Number(event.key) - 1);
      nodes.roster[Number(event.key) - 1].focus();
    }
  });

  renderSelection();
  renderHistory();
})();
