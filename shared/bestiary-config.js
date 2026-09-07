(() => {
  'use strict';

  const providerArt = {
    anthropic: {
      provider: 'Anthropic', breed: 'Cinder-Crown', modelId: 'claude-fable-5-1',
      individual: 'Vaurath, the Still Verdict', colors: ['#c58b62', '#e0c8a5', '#352821'],
      portrait: 'assets/portrait-anthropic.png'
    },
    openai: {
      provider: 'OpenAI', breed: 'Pale-Vault', modelId: 'gpt-6-astra',
      individual: 'Ilyr, the Pale Interdict', colors: ['#aebdc2', '#e2e8e6', '#485760'],
      portrait: 'assets/portrait-openai.png'
    },
    google: {
      provider: 'Google', breed: 'Opal-Storm', modelId: 'gemini-3-8-flash',
      individual: 'Serekh, the Narrow Storm', colors: ['#4d9295', '#9e8ac7', '#19282c'],
      portrait: 'assets/portrait-google.png'
    },
    'moonshot-ai': {
      provider: 'Moonshot AI', breed: 'Moon-Basalt', modelId: 'kimi-k3',
      individual: 'Nhaleth, the Tidal Vigil', colors: ['#6e76b6', '#d8dcf0', '#20233d'],
      portrait: 'assets/portrait-moonshot-ai.png'
    },
    alibaba: {
      provider: 'Alibaba', breed: 'Amethyst-Kiln', modelId: 'qwen3-8-max',
      individual: 'Qorath, the Silent Crucible', colors: ['#946b9f', '#d0a8cf', '#302036'],
      portrait: 'assets/portrait-alibaba.png'
    }
  };

  const finiteOrNull = value => value == null || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const providerKey = model => String(model?.providerId || model?.provider || '')
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const identityOrder = (a, b) => String(a.providerId).localeCompare(String(b.providerId)) || String(a.modelId).localeCompare(String(b.modelId));

  function selectProviderLeaders(records, limit = 5) {
    const eligible = records.filter(record => record && record.status === 'Current' && record.providerId && record.modelId && Number.isFinite(record.overall));
    const leaders = new Map();
    for (const record of eligible) {
      const prior = leaders.get(record.providerId);
      if (!prior || record.overall > prior.overall || (record.overall === prior.overall && identityOrder(record, prior) < 0)) leaders.set(record.providerId, record);
    }
    return [...leaders.values()].sort((a, b) => b.overall - a.overall || identityOrder(a, b)).slice(0, limit);
  }

  globalThis.BESTIARY_CONFIG = Object.freeze({
    species: 'Ancient Vault Dragon',
    selectionRule: 'current-provider-max-overall-v1',
    artTemplateVersion: 'ancient-vault-dragon-v1',
    assetManifestVersion: 'five-dragon-master-v1',
    scaleConstant: 5,
    canvas: { width: 1600, height: 900, baseline: 700, laneWidth: 312, laneCenters: [176, 488, 800, 1112, 1424] },
    masterAsset: 'assets/bestiary-world.png',
    masterSha256: '0736819bdfac4aa4a577c2f135ecaa56a50883a51714a228d65ad78542ac2266',
    providerArt,
    finiteOrNull,
    providerKey,
    selectProviderLeaders
  });
})();
