(function (global) {
  'use strict';

  const STOP = new Set('the a an and or for to of in on with from by is are be as this that use using build create make develop development app application modern include includes including need needs want please skill skills best top recommend recommended'.split(' '));
  const PHRASES = {
    'next.js': ['nextjs'],
    'app router': ['app-router'],
    'server components': ['server-components', 'rsc'],
    'shadcn/ui': ['shadcn'],
    'ai sdk': ['ai-sdk'],
    'tool calling': ['tool-calling', 'function-calling'],
    'function calling': ['function-calling', 'tool-calling'],
    'design system': ['design-system'],
    'cloudflare workers': ['cloudflare-workers', 'workers'],
    'react native': ['react-native'],
    'environment variables': ['environment-variables', 'env-vars'],
    'env vars': ['environment-variables', 'env-vars'],
    'ci/cd': ['ci-cd'],
    'end to end': ['e2e'],
  };
  const ZH_FACETS = [
    ['用户体验', ['ux', 'research', 'usability']], ['工业设计', ['industrial-design', 'industrial', 'product', 'cad']], ['产品设计', ['product', 'industrial']], ['3d打印', ['3d-printing', 'fabrication', '3d']],
    ['建筑可视化', ['architecture', 'rendering']], ['室内空间', ['interior', 'spatial']], ['空间渲染', ['spatial', 'rendering']], ['建筑', ['architecture']], ['室内', ['interior', 'spatial']], ['景观', ['landscape', 'environment', 'spatial']],
    ['界面', ['ui', 'interface', 'layout']], ['视觉', ['visual', 'graphic', 'typography']], ['海报', ['poster', 'graphic', 'typography', 'layout']], ['品牌', ['brand', 'campaign']],
    ['视频', ['video', 'motion', 'editing']], ['剪辑', ['video', 'editing']], ['动效', ['motion', 'animation', 'video']], ['分镜', ['storyboard', 'video', 'film']],
    ['服装', ['fashion', 'campaign']], ['时尚', ['fashion', 'brand']], ['交互', ['interaction', 'ux', 'ui']], ['数媒', ['digital-media', 'creative-coding']], ['影视', ['film', 'video', 'editing', 'vfx']],
    ['工艺', ['craft', 'fabrication']], ['民间艺术', ['illustration', 'hand-drawn', 'collage', 'pattern', 'craft']], ['纹样', ['pattern', 'illustration', 'vector']],
  ];
  const SPECIFICITY_SIGNALS = new Set(['playwright', 'mcp', 'rag', 'embeddings', 'orchestration', 'fastapi', 'node', 'graphql', 'redis', 'sqlite', 'vitest', 'docker', 'kubernetes', 'vulnerability', 'secrets', 'permissions', 'reactnative', 'expo', 'swiftui', 'android', 'kotlin', 'flutter', 'slack', 'gmail', 'calendar', 'webhook', 'documentation', 'github', 'notion', 'figma', 'cron', 'cdn', 'environmentvariables', 'envvars']);

  function canon(value) {
    return String(value).toLowerCase()
      .replace(/next\.js/g, 'nextjs')
      .replace(/node\.?js/g, 'node')
      .replace(/shadcn\/ui/g, 'shadcn')
      .replace(/tool[- ]calling/g, 'tool-calling')
      .replace(/function[- ]calling/g, 'function-calling')
      .replace(/server[- ]components/g, 'server-components')
      .replace(/app[- ]router/g, 'app-router')
      .replace(/design[- ]system/g, 'design-system')
      .replace(/vulnerabilities/g, 'vulnerability')
      .replace(/^secret$/, 'secrets')
      .replace(/^permission$/, 'permissions')
      .replace(/^(redis|sqlite|graphql|fastapi|vitest|flutter|swiftui|kubernetes|playwright|github|notion|figma|slack|gmail|calendar|mcp|node)-(backed|based|powered)$/, '$1')
      .replace(/[^a-z0-9+#.-]+/g, '')
      .trim();
  }

  function querySignals(text) {
    const raw = String(text).toLowerCase();
    const concepts = [];
    const consumed = new Set();
    for (const [phrase, aliases] of Object.entries(PHRASES)) {
      if (!raw.includes(phrase)) continue;
      const terms = [canon(phrase), ...aliases.map(canon)].filter(Boolean);
      concepts.push({ label: phrase, terms: [...new Set(terms)], weight: 3, kind: 'phrase' });
      for (const word of phrase.split(/[^a-z0-9+#.-]+/).map(canon).filter(Boolean)) consumed.add(word);
    }
    const rawTokens = raw.replace(/next\.js/g, 'nextjs').replace(/shadcn\/ui/g, 'shadcn').split(/[^a-z0-9+#.-]+/).map(canon).filter(Boolean);
    for (const token of rawTokens) {
      if (!token || STOP.has(token) || token.length < 2 || consumed.has(token)) continue;
      if (concepts.some((concept) => concept.terms.includes(token))) continue;
      concepts.push({ label: token, terms: [token], weight: token.length > 7 ? 1.5 : 1.15, kind: 'token' });
    }
    const facets = new Map();
    for (const [needle, terms] of ZH_FACETS) {
      if (!raw.includes(needle)) continue;
      for (const rawTerm of terms) {
        const term = canon(rawTerm);
        if (term && !facets.has(term)) facets.set(term, needle);
      }
    }
    for (const [term, needle] of facets) concepts.push({ label: `${needle}:${term}`, terms: [term], weight: 2.25, kind: 'zh-facet' });
    return concepts;
  }

  function normalizeCore(skill) {
    return { ...skill, tags: skill.tags || [], domains: skill.domains || [], uses: skill.uses || [], security: skill.security || 'B', score: skill.score ?? skill.signalScore ?? 70, maintenance: skill.maintenance ?? skill.maintenanceScore ?? 70 };
  }

  function normalizeDiscovered(skill, fallbackCategory) {
    return {
      id: skill.id,
      name: skill.name,
      source: skill.source,
      category: skill.category || fallbackCategory,
      tags: skill.tags || [],
      summary: skill.summary,
      security: skill.security || 'B',
      score: skill.signalScore ?? skill.score ?? 70,
      maintenance: skill.maintenanceScore ?? skill.maintenance ?? 70,
      installs: skill.installs || 0,
      installUrl: skill.installUrl,
      skillsUrl: skill.skillsUrl,
      discovery: skill.discovery || 'radar',
      domains: skill.domains || [],
      uses: skill.uses || [],
      verified: Boolean(skill.verified),
      official: Boolean(skill.official),
      growth: skill.growth,
      rising: skill.rising,
    };
  }

  function dedupeAndGate(skills) {
    const seen = new Set();
    return skills
      .filter((skill) => !['D', 'Blocked'].includes(skill.security))
      .filter((skill) => {
        const key = `${String(skill.source || '').toLowerCase()}::${String(skill.name || skill.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function registrySkills(snapshot) {
    if (!snapshot || ![1, 2].includes(snapshot.schemaVersion) || !Array.isArray(snapshot.core) || !Array.isArray(snapshot.design)) return [];
    const general = Array.isArray(snapshot.general) ? snapshot.general : [];
    return dedupeAndGate([
      ...snapshot.core.map(normalizeCore),
      ...snapshot.design.map((skill) => normalizeDiscovered(skill, 'Design')),
      ...general.map((skill) => normalizeDiscovered(skill, 'General')),
    ]);
  }

  function fieldText(skill) {
    return {
      identity: `${skill.id || ''} ${skill.name || ''}`.toLowerCase(),
      tags: `${(skill.tags || []).join(' ')} ${(skill.uses || []).join(' ')}`.toLowerCase(),
      domains: `${(skill.domains || []).join(' ')} ${skill.category || ''}`.toLowerCase(),
      summary: String(skill.summary || '').toLowerCase(),
      source: String(skill.source || '').toLowerCase(),
    };
  }

  function fieldContains(text, term) {
    const normalized = String(text).toLowerCase()
      .replace(/next\.js/g, 'nextjs')
      .replace(/node\.?js/g, 'node')
      .replace(/shadcn\/ui/g, 'shadcn')
      .replace(/tool[ -]calling/g, 'tool-calling')
      .replace(/function[ -]calling/g, 'function-calling')
      .replace(/app[ -]router/g, 'app-router')
      .replace(/design[ -]system/g, 'design-system')
      .replace(/vulnerabilities/g, 'vulnerability');
    const set = new Set(normalized.split(/[^a-z0-9+#.]+/).map(canon).filter(Boolean));
    return set.has(term) || (term.length >= 5 && normalized.includes(term));
  }

  function scoreSkill(skill, query) {
    const signals = querySignals(query);
    const fields = fieldText(skill);
    const totalWeight = Math.max(1, signals.reduce((sum, signal) => sum + signal.weight, 0));
    let matchedWeight = 0;
    let evidence = 0;
    const matched = [];
    const matchedSignalWeights = {};
    const fieldHits = { identity: 0, tags: 0, domains: 0, summary: 0, source: 0 };
    for (const signal of signals) {
      let best = 0;
      let bestField = null;
      let bestTerm = null;
      for (const term of signal.terms) {
        for (const [field, text] of Object.entries(fields)) {
          if (!fieldContains(text, term)) continue;
          const weight = field === 'identity' ? 4.5 : field === 'tags' ? 3.7 : field === 'domains' ? 2.8 : field === 'summary' ? 2.1 : 0.7;
          if (weight > best) {
            best = weight;
            bestField = field;
            bestTerm = term;
          }
        }
      }
      if (!bestField) continue;
      const label = signal.label || bestTerm;
      matchedWeight += signal.weight;
      evidence += signal.weight * best;
      fieldHits[bestField] += 1;
      matched.push(label);
      matchedSignalWeights[label] = Math.max(Number(matchedSignalWeights[label] || 0), Number(signal.weight || 0));
    }
    const coverage = matchedWeight / totalWeight;
    const skillradar = skill.score || 70;
    const securityBonus = skill.security === 'A' ? 4 : skill.security === 'B' ? 2 : skill.security === 'C' ? 0 : -100;
    const freshness = Math.max(0, Math.min(100, skill.maintenance ?? 70)) * 0.04;
    const coverageScore = coverage * 55;
    const evidenceScore = Math.min(22, evidence * 1.45);
    const qualityPrior = skillradar * 0.15;
    const matchScore = Math.max(0, Math.min(100, Math.round(coverageScore + evidenceScore + qualityPrior + securityBonus + freshness)));
    const uniqueMatched = [...new Set(matched)];
    return {
      ...skill,
      match_score: matchScore,
      skillradar_score: skillradar,
      specialty_hits: fieldHits.identity + fieldHits.tags,
      match_details: {
        ranking_version: '2.1',
        matched_signals: uniqueMatched.slice(0, 12),
        matched_signal_weights: matchedSignalWeights,
        coverage: Number(coverage.toFixed(2)),
        field_hits: fieldHits,
        quality_prior: Number(qualityPrior.toFixed(1)),
        security_bonus: securityBonus,
        freshness_bonus: Number(freshness.toFixed(1)),
        project_context_signals: [],
        project_context_coverage: 0,
        project_context_bonus: 0,
      },
      reason: uniqueMatched.length
        ? `Matched task signals: ${uniqueMatched.slice(0, 8).join(', ')}; coverage ${Math.round(coverage * 100)}%; security ${skill.security}; SkillRadar score ${skillradar}.`
        : `No strong lexical task signal; security ${skill.security}; SkillRadar score ${skillradar}.`,
    };
  }

  function featureSet(skill) {
    return new Set([...(skill.tags || []), ...(skill.domains || []), skill.category || ''].map(canon).filter(Boolean));
  }

  function similarity(a, b) {
    const x = featureSet(a);
    const y = featureSet(b);
    if (!x.size || !y.size) return 0;
    let hits = 0;
    for (const token of x) if (y.has(token)) hits += 1;
    return hits / (x.size + y.size - hits);
  }

  function taskSignalWeights(skill) {
    return skill.match_details?.matched_signal_weights || {};
  }

  function requestedSpecificitySignals(query) {
    return [...new Set(querySignals(query).map((signal) => canon(signal.label)).filter((signal) => SPECIFICITY_SIGNALS.has(signal)))];
  }

  function enforceSpecificity(ranked, required = []) {
    if (!required.length) return ranked;
    const wanted = new Set(required);
    return ranked.filter((skill) => (skill.match_details?.matched_signals || []).some((signal) => wanted.has(canon(signal))));
  }

  function diversify(ranked, limit = 3) {
    if (!ranked.length) return [];
    const selected = [ranked[0]];
    const pool = ranked.slice(1).filter((skill) => skill.match_score >= Math.max(20, ranked[0].match_score - 28));
    const covered = new Set(Object.keys(taskSignalWeights(ranked[0])));
    while (selected.length < limit && pool.length) {
      let bestIndex = 0;
      let bestScore = -Infinity;
      for (let index = 0; index < pool.length; index += 1) {
        const candidate = pool[index];
        const weights = taskSignalWeights(candidate);
        let uncoveredWeight = 0;
        for (const [label, weight] of Object.entries(weights)) if (!covered.has(label)) uncoveredWeight += Number(weight) || 0;
        const complementBonus = Math.min(22, uncoveredWeight * 4);
        const maxSimilarity = Math.max(...selected.map((skill) => similarity(candidate, skill)));
        const sameSource = selected.some((skill) => skill.source === candidate.source) ? 1 : 0;
        const adjusted = candidate.match_score + complementBonus - maxSimilarity * 6 - sameSource * 0.5;
        if (adjusted > bestScore) {
          bestScore = adjusted;
          bestIndex = index;
        }
      }
      const chosen = pool.splice(bestIndex, 1)[0];
      selected.push(chosen);
      for (const label of Object.keys(taskSignalWeights(chosen))) covered.add(label);
    }
    return selected.slice(0, limit);
  }

  function capabilityGap(matches, limit = 3, required = []) {
    const returned = matches.length;
    const reason = required.length
      ? `Fewer than ${limit} candidates had explicit evidence for the requested named technology/service signals (${required.join(', ')}); unrelated generic candidates were not backfilled.`
      : `Fewer than ${limit} candidates met the strong-match floor; weak candidates were not backfilled.`;
    return returned < limit
      ? { detected: true, requested: limit, returned, missing: limit - returned, reason }
      : { detected: false, requested: limit, returned, missing: 0 };
  }

  function safetyAdvisory(matches) {
    const top = matches[0];
    if (!top || top.security !== 'C') return null;
    const alternative = matches.slice(1).find((skill) => ['A', 'B'].includes(skill.security) && top.match_score - skill.match_score <= 5);
    if (!alternative) return { level: 'review', message: 'Top match is security grade C. Review its SKILL.md and scripts before installation or execution.' };
    return {
      level: 'review',
      message: `Top match is security grade C. Prefer the nearby ${alternative.security}-grade alternative when task coverage is comparable.`,
      alternative: { id: alternative.id, name: alternative.name, match_score: alternative.match_score, skillradar_score: alternative.skillradar_score, security: alternative.security, source: alternative.source },
    };
  }

  function match(snapshot, query, limit = 3) {
    const registry = registrySkills(snapshot);
    const ranked = registry
      .map((skill) => scoreSkill(skill, query))
      .sort((a, b) => b.match_score - a.match_score || b.specialty_hits - a.specialty_hits || b.skillradar_score - a.skillradar_score);
    const required = requestedSpecificitySignals(query);
    const relevant = enforceSpecificity(ranked, required);
    const matches = diversify(relevant, limit);
    return {
      source: 'skillradar-registry',
      registry: {
        mode: 'browser-bundled',
        schemaVersion: snapshot?.schemaVersion,
        generatedAt: snapshot?.generatedAt,
        totalCount: snapshot?.totalCount,
        coreCount: snapshot?.coreCount,
        designCount: snapshot?.designCount,
        generalCount: snapshot?.generalCount || 0,
        contentHash: snapshot?.contentHash,
        source: snapshot?.source,
      },
      context: { mode: 'task-only', signals: [], evidence: [] },
      ranking: {
        version: '2.1',
        strategy: 'task-first field-weighted evidence + coverage + quality/security/freshness prior + complementary task-facet coverage rerank; named technologies/services require explicit per-candidate evidence; weak candidates are not backfilled',
      },
      specificity: { enforced: required.length > 0, required_signals: required, eligible_candidates: relevant.length, filtered_candidates: ranked.length - relevant.length },
      matches,
      capability_gap: capabilityGap(matches, limit, required),
      advisory: safetyAdvisory(matches),
    };
  }

  global.SkillRadarWebRouter = Object.freeze({ canon, querySignals, registrySkills, scoreSkill, requestedSpecificitySignals, match });
})(globalThis);
