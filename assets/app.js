'use strict';

const safe = globalThis.SkillRadarSafe;
const webRouter = globalThis.SkillRadarWebRouter;
if (!safe || !webRouter) throw new Error('SkillRadar web safety/router helpers failed to load.');

const { escapeHtml: esc, escapeAttr: attr, safeGithubUrl, repoSlug, safeNumber, skillInstallCommand } = safe;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function readStoredSet(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    localStorage.removeItem(key);
    return new Set();
  }
}

let skills = [];
let registrySnapshot = null;
let cats = [];
let listMode = 'trending';
let filterCat = 'All';
let q = '';
let sort = 'score';
let installed = readStoredSet('sr-installed');
let favs = readStoredSet('sr-favs');
let designSkills = [];
let designDomains = [];
let radarData = { discoveries: [], domainRadar: {}, status: 'seed' };
let activeDesignDomain = 'ui-design';

const AGENT_INSTALL_COMMAND = 'npx skills add changchangidea-oss/SkillRadar --skill skillradar';
const CODEX_INSTALL_COMMAND = 'codex plugin marketplace add changchangidea-oss/SkillRadar --ref v0.5.0 && codex plugin add skillradar@skillradar';

function text(value) { return String(value ?? ''); }
function numeric(value, fallback = 0) { return safeNumber(value, fallback); }
function securityGrade(value) { return ['A', 'B', 'C'].includes(value) ? value : 'C'; }
function initials(name) {
  return text(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
}
function fmtN(value) {
  if (value == null) return '—';
  const number = numeric(value, 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K`;
  return String(number);
}
function sourceUrl(skill) {
  for (const candidate of [skill.githubUrl, skill.installUrl]) {
    const url = safeGithubUrl(candidate || '');
    if (url !== '#') return url;
  }
  return '';
}
function normalizeDisplaySkill(skill) {
  const score = numeric(skill.score ?? skill.signalScore, 70);
  const maintenance = numeric(skill.maintenance ?? skill.maintenanceScore, 70);
  const rising = numeric(skill.rising, Math.min(99, score));
  const growth = numeric(skill.growth, Math.min(99, Math.round(score * 0.92)));
  return {
    ...skill,
    id: text(skill.id),
    name: text(skill.name || skill.id || 'Unnamed Skill'),
    source: text(skill.source),
    category: text(skill.category || 'General'),
    tags: Array.isArray(skill.tags) ? skill.tags.map(text) : [],
    domains: Array.isArray(skill.domains) ? skill.domains.map(text) : [],
    summary: text(skill.summary),
    security: securityGrade(skill.security),
    score,
    growth,
    maintenance,
    verified: Boolean(skill.verified),
    uses: Array.isArray(skill.uses) ? skill.uses.map(text) : [],
    rising,
    official: Boolean(skill.official),
    installs: skill.installs == null ? null : numeric(skill.installs, 0),
  };
}
function save() {
  localStorage.setItem('sr-installed', JSON.stringify([...installed]));
  localStorage.setItem('sr-favs', JSON.stringify([...favs]));
}
function toast(message) {
  $('#toast').textContent = text(message);
  $('#toast').classList.add('on');
  setTimeout(() => $('#toast').classList.remove('on'), 1500);
}
async function copy(value) {
  const copyValue = text(value);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyValue);
    } else {
      const input = document.createElement('textarea');
      input.value = copyValue;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      try {
        input.select();
        if (!document.execCommand('copy')) throw new Error('Clipboard fallback failed');
      } finally {
        input.remove();
      }
    }
    toast('Copied');
  } catch {
    toast('Copy failed');
  }
}
function badge(skill) {
  const grade = securityGrade(skill.security);
  return `${skill.official ? '<span class="badge off">Official</span>' : ''}<span class="badge ${grade}">Security ${grade}</span>`;
}
function card(skill) {
  return `<article class="card" data-s="${attr(skill.id)}"><div class="ctop"><div class="ico">${esc(initials(skill.name))}</div><div><h3>${esc(skill.name)}</h3><div class="src">${esc(skill.source)}</div></div></div><div class="badges">${badge(skill)}${skill.tags.slice(0, 2).map((tag) => `<span class="badge">${esc(tag)}</span>`).join('')}</div><p>${esc(skill.summary)}</p><div class="bottom"><div class="score">${numeric(skill.score)}<small>SkillRadar</small></div><span class="rise">↑ ${numeric(skill.rising)}</span></div></article>`;
}
function bindSkills() {
  $$('[data-s]').forEach((element) => { element.onclick = () => openSkill(element.dataset.s); });
}
function bindSkillActions() {
  $$('[data-detail-skill]').forEach((button) => {
    button.onclick = () => openSkill(button.dataset.detailSkill);
  });
  $$('[data-copy-install]').forEach((button) => {
    button.onclick = () => copy(button.dataset.copyInstall);
  });
}
function bindCats() {
  $$('[data-cat]').forEach((element) => {
    element.onclick = () => {
      filterCat = element.dataset.cat;
      q = '';
      listMode = 'trending';
      show('trending');
    };
  });
}
function renderHome() {
  $('#countAll').textContent = `${skills.length}+`;
  $('#countVerified').textContent = skills.filter((skill) => skill.verified).length;
  $('#featured').innerHTML = skills.slice().sort((a, b) => b.score - a.score).slice(0, 6).map(card).join('');
  $('#rank').innerHTML = skills.slice().sort((a, b) => b.rising - a.rising).slice(0, 6).map((skill, index) => `<div class="rankrow" data-s="${attr(skill.id)}"><span>${String(index + 1).padStart(2, '0')}</span><div><b>${esc(skill.name)}</b><small>${esc(skill.source)}</small></div><span class="rise">↑ ${numeric(skill.rising)}</span><b>${numeric(skill.score)}</b></div>`).join('');
  $('#catsHome').innerHTML = cats.slice(0, 8).map((category) => `<button class="cat" data-cat="${attr(category)}"><span>${category === 'AI Agents' ? '✦' : '◫'}</span><b>${esc(category)}</b><small>${skills.filter((skill) => skill.category === category).length} indexed skills</small></button>`).join('');
  bindSkills();
  bindCats();
}
function show(view) {
  $$('.view').forEach((element) => element.classList.remove('on'));
  $$('.nav button').forEach((element) => element.classList.toggle('active', element.dataset.v === view));
  if (['trending', 'rising', 'official'].includes(view)) {
    listMode = view;
    $('#listView').classList.add('on');
    $('#listK').textContent = view.toUpperCase();
    $('#listTitle').textContent = view === 'official' ? 'Official skills' : `${view[0].toUpperCase()}${view.slice(1)} skills`;
    $('#listSub').textContent = view === 'official' ? 'Verified sources and official OpenAI plugins.' : 'Ranked by relevance, quality, safety and momentum.';
    renderList();
  } else {
    const target = $(`#${view}`);
    if (!target) return;
    target.classList.add('on');
    if (view === 'mine') renderMine();
    if (view === 'designRadar') renderDesignRadar();
  }
  scrollTo(0, 0);
}
function renderList() {
  let rows = skills.slice();
  if (listMode === 'official') rows = rows.filter((skill) => skill.official || skill.verified);
  if (filterCat !== 'All') rows = rows.filter((skill) => skill.category === filterCat);
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    rows = rows.filter((skill) => {
      const haystack = `${skill.name} ${skill.summary} ${skill.tags.join(' ')} ${skill.category}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }
  rows.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'rising' ? b.rising - a.rising : b.score - a.score);
  $('#listCount').textContent = `${rows.length} results`;
  $('#chips').innerHTML = ['All', ...cats].map((category) => `<button class="${filterCat === category ? 'active' : ''}" data-fc="${attr(category)}">${esc(category)}</button>`).join('');
  $('#list').innerHTML = rows.length ? rows.map((skill) => `<div class="row" data-s="${attr(skill.id)}"><div class="identity"><div class="ico">${esc(initials(skill.name))}</div><div><b>${esc(skill.name)}</b><small>${esc(skill.source)} · ${esc(skill.category)}</small></div></div><div class="desc">${esc(skill.summary)}</div><b>${esc(skill.security)}</b><div class="score">${numeric(skill.score)}</div></div>`).join('') : '<div class="empty">No matching skills.</div>';
  $$('[data-fc]').forEach((button) => { button.onclick = () => { filterCat = button.dataset.fc; renderList(); }; });
  bindSkills();
}
function openSkill(id) {
  const skill = skills.find((candidate) => candidate.id === id);
  if (!skill) return;
  const command = skillInstallCommand(skill);
  const url = sourceUrl(skill);
  const coordinatesGap = !command && !url ? '<div class="actionGap">Install coordinates are not verified for this curated entry yet.</div>' : '';
  $('#modal').innerHTML = `<div class="ctop"><div class="ico">${esc(initials(skill.name))}</div><div><h2 style="margin:0">${esc(skill.name)}</h2><div class="src">${esc(skill.source)}</div></div></div><div class="badges">${badge(skill)}${skill.tags.map((tag) => `<span class="badge">${esc(tag)}</span>`).join('')}</div><p style="font-size:17px;color:#565d53">${esc(skill.summary)}</p><div class="metrics"><div><b>${numeric(skill.score)}</b><small>SKILLRADAR</small></div><div><b>${numeric(skill.growth)}</b><small>GROWTH</small></div><div><b>${numeric(skill.maintenance)}</b><small>MAINTENANCE</small></div><div><b>${esc(skill.security)}</b><small>SECURITY</small></div></div><h4>BEST FOR</h4><div class="use">${skill.uses.map((use) => `<div>✓ ${esc(use)}</div>`).join('')}</div>${coordinatesGap}<div class="actions"><button class="btn" id="markI">${installed.has(skill.id) ? 'Installed ✓' : 'Mark installed'}</button><button class="ghost" id="markF">${favs.has(skill.id) ? 'Favorited ★' : 'Favorite ☆'}</button>${command ? '<button class="ghost" id="copyCmd">Copy exact install command</button>' : ''}${url ? `<a class="ghost actionLink" href="${attr(url)}" target="_blank" rel="noopener noreferrer">Inspect source ↗</a>` : ''}</div>`;
  $('#modalbg').classList.add('on');
  $('#markI').onclick = () => { installed.has(skill.id) ? installed.delete(skill.id) : installed.add(skill.id); save(); openSkill(skill.id); };
  $('#markF').onclick = () => { favs.has(skill.id) ? favs.delete(skill.id) : favs.add(skill.id); save(); openSkill(skill.id); };
  if (command) $('#copyCmd').onclick = () => copy(command);
}
function normalizeDesignSkill(skill) {
  const score = numeric(skill.signalScore, 70);
  return normalizeDisplaySkill({
    ...skill,
    category: 'Design',
    score,
    growth: Math.min(99, Math.round(score * 0.92)),
    maintenance: numeric(skill.repoStars, 0) > 1000 ? 94 : 82,
    verified: false,
    uses: Array.isArray(skill.tags) ? skill.tags.slice(0, 4) : [],
    rising: Math.min(99, score),
    official: false,
  });
}
function renderDesignHome() {
  if (!designDomains.length) return;
  $('#designHomeDomains').innerHTML = designDomains.slice(0, 6).map((domain) => `<button class="homeDomain" data-dd="${attr(domain.id)}"><span class="domainIcon">${esc(domain.icon)}</span><b>${esc(domain.name)}</b><small>${esc(domain.en)}</small></button>`).join('');
  $$('[data-dd]').forEach((button) => { button.onclick = () => { activeDesignDomain = button.dataset.dd; show('designRadar'); renderDesignRadar(); }; });
}
function renderDesignRadar() {
  if (!designDomains.length) return;
  const domain = designDomains.find((candidate) => candidate.id === activeDesignDomain) || designDomains[0];
  activeDesignDomain = domain.id;
  $('#designSkillCount').textContent = designSkills.length;
  $('#designDomainCount').textContent = designDomains.length;
  $('#radarNewCount').textContent = radarData.discoveryCount ?? (radarData.discoveries || []).length;
  $('#radarTime').textContent = radarData.generatedAt ? `Updated ${new Date(radarData.generatedAt).toLocaleString()}` : 'Seed snapshot';
  $('#domainGrid').innerHTML = designDomains.map((item) => `<button class="domainCard ${item.id === domain.id ? 'active' : ''}" data-domain="${attr(item.id)}"><span class="domainIcon">${esc(item.icon)}</span><b>${esc(item.name)}</b><small>${esc(item.en)}<br>${Array.isArray(item.seedTop20) ? item.seedTop20.length : 0} seed skills</small></button>`).join('');
  $('#domainSide').innerHTML = designDomains.map((item) => `<button class="${item.id === domain.id ? 'active' : ''}" data-domain="${attr(item.id)}"><span>${esc(item.name)}</span><small>${Array.isArray(item.seedTop20) ? item.seedTop20.length : 0}</small></button>`).join('');
  $('#domainIntro').innerHTML = `<div><div class="kicker">${esc(text(domain.en).toUpperCase())}</div><h2>${esc(domain.name)}</h2><p>${esc(domain.description)}</p></div><span class="method">Seed Rank · relevance + usage + safety</span>`;
  const byId = new Map(designSkills.map((skill) => [skill.id, skill]));
  const topRows = (domain.seedTop20 || []).map((row, index) => ({ rank: index + 1, skillId: Array.isArray(row) ? row[0] : row.skillId, seedScore: Array.isArray(row) ? row[1] : row.seedScore })).map((row) => ({ ...row, skill: byId.get(row.skillId) })).filter((row) => row.skill);
  $('#designTop20').innerHTML = topRows.map(({ rank, seedScore, skill }) => `<div class="designRankRow" data-s="${attr(skill.id)}"><div class="rankNo ${rank <= 3 ? 'top' : ''}">${String(rank).padStart(2, '0')}</div><div class="rankMeta"><b>${esc(skill.name)}</b><small>${esc(skill.source)}</small></div><div class="rankTags">${skill.tags.slice(0, 3).map((tag) => `<span class="badge">${esc(tag)}</span>`).join('')}</div><div class="installs">${fmtN(skill.installs)}<small style="display:block;color:#8a9188">installs</small></div><div class="score">${numeric(seedScore)}</div></div>`).join('');
  const candidates = (radarData.domainRadar?.[domain.id] || []).slice(0, 8);
  $('#radarCandidates').innerHTML = candidates.length ? candidates.map((candidate) => `<div class="candidate"><div><a href="${attr(safeGithubUrl(candidate.githubUrl))}" target="_blank" rel="noopener noreferrer"><b>${esc(candidate.name)}</b></a><small>${esc(candidate.source)} · ${esc(candidate.skillPath)}</small></div><span>${fmtN(candidate.repoStars)} ★</span><span class="rise">match ${numeric(candidate.matchScore)}</span></div>`).join('') : '<div class="empty" style="color:#788273;padding:24px">No new candidates for this field today; the Seed Top 20 remains the stable baseline.</div>';
  $$('[data-domain]').forEach((button) => { button.onclick = () => { activeDesignDomain = button.dataset.domain; renderDesignRadar(); }; });
  bindSkills();
}
function search(textValue) {
  q = text(textValue).trim();
  filterCat = 'All';
  listMode = 'trending';
  show('trending');
  $('#listTitle').textContent = q ? `Results for “${q}”` : 'All skills';
  $('#listQ').value = q;
  renderList();
}
function renderCapabilityGap(result) {
  if (!result.capability_gap?.detected) return '';
  return `<div class="empty" style="margin-top:12px">${esc(result.capability_gap.reason)}</div>`;
}
function route() {
  const query = $('#task').value.trim();
  if (!query) return toast('Describe a task first');
  if (!registrySnapshot) return toast('Registry is still loading');
  const result = webRouter.match(registrySnapshot, query, 3);
  const matches = result.matches || [];
  const specificity = result.specificity?.enforced ? `<div class="sourceNote">Specificity gate: ${esc((result.specificity.required_signals || []).join(', '))}</div>` : '';
  const advisory = result.advisory?.message ? `<div class="sourceNote">Security review: ${esc(result.advisory.message)}</div>` : '';
  $('#routeResults').innerHTML = `${specificity}${matches.map((skill, index) => {
    const command = skillInstallCommand(skill);
    const url = sourceUrl(skill);
    const coordinatesGap = !command && !url ? '<span class="actionGap">Install coordinates not verified</span>' : '';
    return `<div class="match"><div class="mnum">${numeric(skill.match_score)}</div><div class="matchBody"><h3>${index + 1}. ${esc(skill.name)}</h3><p>${esc(skill.summary)}</p><p class="reason">${esc(skill.reason)} · Security ${esc(skill.security)}</p><div class="routeActions"><button class="ghost" data-detail-skill="${attr(skill.id)}">View details</button>${command ? `<button class="ghost" data-copy-install="${attr(command)}">Copy install command</button>` : ''}${url ? `<a class="ghost actionLink" href="${attr(url)}" target="_blank" rel="noopener noreferrer">Inspect source ↗</a>` : ''}${coordinatesGap}</div></div><div class="score">${numeric(skill.skillradar_score)}</div></div>`;
  }).join('')}${renderCapabilityGap(result)}${advisory}` || '<div class="empty">No safe, specific match found.</div>';
  bindSkillActions();
}
function routeTask(query) {
  const task = text(query).trim();
  if (!task) return toast('Describe a task first');
  show('router');
  $('#task').value = task;
  route();
}
function renderCats() {
  $('#catCatalog').innerHTML = cats.map((category) => `<button class="cat" data-cat="${attr(category)}"><span>◫</span><b>${esc(category)}</b><small>${esc(skills.filter((skill) => skill.category === category).slice(0, 3).map((skill) => skill.name).join(' · '))}</small></button>`).join('');
  bindCats();
}
function renderMine() {
  const rows = skills.filter((skill) => installed.has(skill.id) || favs.has(skill.id));
  $('#mineList').innerHTML = rows.length ? rows.map((skill) => `<div class="row" data-s="${attr(skill.id)}"><div class="identity"><div class="ico">${esc(initials(skill.name))}</div><div><b>${esc(skill.name)}</b><small>${installed.has(skill.id) ? 'Installed' : 'Favorite'}</small></div></div><div class="desc">${esc(skill.summary)}</div><b>${esc(skill.security)}</b><div class="score">${numeric(skill.score)}</div></div>`).join('') : '<div class="empty">No local skills yet.</div>';
  bindSkills();
}
const packs = [
  ['Modern Web', ['nextjs', 'react-best-practices', 'shadcn', 'web-perf']],
  ['Supabase Safe Stack', ['supabase-postgres-best-practices', 'auth', 'nextjs', 'systematic-debugging']],
  ['Quality Gate', ['test-driven-development', 'systematic-debugging', 'code-review', 'playwright-testing']],
  ['AI Product', ['ai-sdk', 'find-skills', 'nextjs', 'frontend-design']],
];
function renderPacks() {
  $('#packGrid').innerHTML = packs.map(([name, ids]) => `<div class="pack"><h3>${esc(name)}</h3><p>Compact skill stack for one workflow.</p><div class="packskills">${ids.map((id) => skills.find((skill) => skill.id === id)).filter(Boolean).map((skill) => `<div class="packskill"><span>${esc(skill.name)}</span><b>${numeric(skill.score)}</b></div>`).join('')}</div></div>`).join('');
}
async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
async function loadData() {
  try {
    const [snapshot, manifest, domains, radar] = await Promise.all([
      fetchJson('packages/codex-plugin/data/registry.json'),
      fetchJson('data/design-skill-index.json'),
      fetchJson('data/design-domains.json'),
      fetchJson('data/radar-latest.json'),
    ]);
    if (!snapshot || ![1, 2].includes(snapshot.schemaVersion)) throw new Error('Unsupported bundled registry schema');
    registrySnapshot = snapshot;
    skills = webRouter.registrySkills(snapshot).map(normalizeDisplaySkill);
    const chunks = await Promise.all((manifest.chunks || []).map((file) => fetchJson(`data/${file}`)));
    designSkills = chunks.flat().map(normalizeDesignSkill);
    designDomains = Array.isArray(domains) ? domains : [];
    radarData = radar || radarData;
    cats = [...new Set(skills.map((skill) => skill.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    renderHome();
    renderCats();
    renderDesignHome();
    renderDesignRadar();
    renderPacks();
  } catch (error) {
    console.error('SkillRadar data unavailable', error);
    $('#featured').innerHTML = '<div class="empty">Registry data unavailable.</div>';
    $('#designHomeDomains').innerHTML = '<div class="empty">Design Radar data unavailable.</div>';
    $('#routeResults').innerHTML = '<div class="empty">Router registry unavailable.</div>';
  }
}

function closeNavigation() {
  document.body.classList.remove('nav-open');
  $('#mobileNav').setAttribute('aria-expanded', 'false');
}
function openNavigation() {
  document.body.classList.add('nav-open');
  $('#mobileNav').setAttribute('aria-expanded', 'true');
}
$$('[data-v]').forEach((button) => { button.onclick = () => { show(button.dataset.v); closeNavigation(); }; });
$('#openRouter').onclick = () => show('router');
$('#heroGo').onclick = () => routeTask($('#heroQ').value);
$('#heroQ').onkeydown = (event) => { if (event.key === 'Enter') routeTask(event.target.value); };
$('#globalSearch').onkeydown = (event) => { if (event.key === 'Enter') search(event.target.value); };
$('#listQ').oninput = (event) => { q = event.target.value; renderList(); };
$('#sort').onchange = (event) => { sort = event.target.value; renderList(); };
$('#routeBtn').onclick = route;
$('#task').onkeydown = (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') route(); };
$('#close').onclick = () => $('#modalbg').classList.remove('on');
$('#modalbg').onclick = (event) => { if (event.target.id === 'modalbg') $('#modalbg').classList.remove('on'); };
$('#clearMine').onclick = () => { installed.clear(); favs.clear(); save(); renderMine(); };
$('#copyAgentInstall').onclick = () => copy(AGENT_INSTALL_COMMAND);
$('#copyCodexInstall').onclick = () => copy(CODEX_INSTALL_COMMAND);
$('#mobileNav').onclick = openNavigation;
$('#mobileClose').onclick = closeNavigation;
$('#navBackdrop').onclick = closeNavigation;
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeNavigation();
  $('#modalbg').classList.remove('on');
});

loadData();
