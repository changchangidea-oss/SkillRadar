"use strict";

const safe = globalThis.SkillRadarSafe;
const webRouter = globalThis.SkillRadarWebRouter;
if (!safe || !webRouter) throw new Error("SkillRadar web safety/router helpers failed to load.");

const { escapeHtml: esc, escapeAttr: attr, safeGithubUrl, repoSlug, safeNumber, skillInstallCommand } = safe;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const CAT_ZH = {
  "Frontend": "前端开发",
  "Database": "数据库",
  "Debugging": "系统调试",
  "Testing": "测试验证",
  "Automation": "自动化",
  "Coding": "编程基础",
  "Product": "产品设计",
  "Documentation": "技术文档",
  "Cloud & DevOps": "云原生与运维",
  "Security": "安全审计",
  "AI Agents": "AI 智能体",
  "Design & Media": "设计与多媒体",
  "Automation & Integrations": "自动化与集成",
  "Mobile": "移动端开发",
  "Backend & API": "后端与 API",
  "Testing & Quality": "测试与质量保证",
  "Data & Database": "数据与数据库",
  "Docs & Research": "文档与研究",
  "DevOps & Cloud": "DevOps 与云服务",
  "Design": "设计体系",
  "Operations & Growth": "运营与用户增长",
  "Competitive Analysis": "竞品分析与商研",
  "Content & Copywriting": "公众号写作与文案",
  "Stock & Equity": "证券炒股与投研",
  "Quantitative Trading": "量化交易与金融工程"
};

const CAT_ICONS = {
  "Operations & Growth": "📈",
  "Competitive Analysis": "🔍",
  "Content & Copywriting": "✍️",
  "Stock & Equity": "📊",
  "Quantitative Trading": "⚡",
  "AI Agents": "✦",
  "Frontend": "💻",
  "Backend & API": "⚙️",
  "Mobile": "📱",
  "Design & Media": "🎨",
  "Design": "🎨",
  "Database": "🗄",
  "Data & Database": "🗄",
  "Security": "🛡",
  "Testing": "🧪",
  "Testing & Quality": "🧪",
  "Cloud & DevOps": "☁️",
  "DevOps & Cloud": "☁️",
  "Automation": "⚡",
  "Automation & Integrations": "⚡",
  "Docs & Research": "📚",
  "Documentation": "📚",
  "Product": "🎯",
  "Coding": "💻",
  "Debugging": "🔍"
};

function catLabel(category) {
  return CAT_ZH[category] || category;
}
function catIcon(category) {
  return CAT_ICONS[category] || "◫";
}

function readStoredSet(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    localStorage.removeItem(key);
    return new Set();
  }
}

let skills = [];
let registrySnapshot = null;
let cats = [];
let listMode = "trending";
let filterCat = "All";
let q = "";
let sort = "score";
let installed = readStoredSet("sr-installed");
let favs = readStoredSet("sr-favs");
let designSkills = [];
let designDomains = [];
let radarData = { discoveries: [], domainRadar: {}, status: "seed" };
let activeDesignDomain = "all";
let activeDesignSort = "installs";

const AGENT_INSTALL_COMMAND = "npx skills add changchangidea-oss/SkillRadar --skill skillradar";
const CODEX_INSTALL_COMMAND = "codex plugin marketplace add changchangidea-oss/SkillRadar --ref v0.5.0 && codex plugin add skillradar@skillradar";

function text(value) { return String(value ?? ""); }
function numeric(value, fallback = 0) { return safeNumber(value, fallback); }
function securityGrade(value) { return ["A", "B", "C"].includes(value) ? value : "C"; }
function initials(name) {
  return text(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}
function fmtN(value) {
  if (value == null) return "—";
  const number = numeric(value, 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}K`;
  return String(number);
}
function sourceUrl(skill) {
  for (const candidate of [skill.githubUrl, skill.installUrl]) {
    const url = safeGithubUrl(candidate || "");
    if (url !== "#") return url;
  }
  return "";
}

const FEATURE_MAP = {
  "vnpy-cta-strategy": [
    { icon: "⚡", text: "CTA 趋势与多周期网格量化策略" },
    { icon: "📊", text: "实盘极速接入 (CTP/股票/加密货币)" },
    { icon: "📈", text: "高精度 Tick / Bar 级历史行情回测" },
    { icon: "🛡️", text: "动态实时风控与仓位自动化监控" }
  ],
  "qlib-quant-strategy": [
    { icon: "🤖", text: "AI 机器学习模型集成与自动训练" },
    { icon: "📊", text: "Alpha 因子自动化挖掘与评分" },
    { icon: "⚙️", text: "向量化超高速回测与收益风险评估" },
    { icon: "📡", text: "全市场历史与实时行情特征管线" }
  ],
  "openbb-equity-research": [
    { icon: "📊", text: "上市公司财报深度解读与 DCF 估值" },
    { icon: "🔍", text: "宏观基本面与产业链量化透视" },
    { icon: "📈", text: "机构级多指标多资产对比走势图" },
    { icon: "📡", text: "全球股票/外汇/大宗商品数据接入" }
  ],
  "stock-market-analyst": [
    { icon: "📊", text: "实时技术指标与 K 线形态识别" },
    { icon: "📑", text: "证券研报精读与投资核心观点提炼" },
    { icon: "📉", text: "行业板块轮动与主力资金流向监控" },
    { icon: "🎯", text: "基本面多维度估值模型与风险量化" }
  ],
  "technical-trading-analyst": [
    { icon: "📈", text: "MACD/KDJ/布林带多周期指标共振" },
    { icon: "⚡", text: "关键支撑/阻力位突破信号捕捉" },
    { icon: "📊", text: "量价关系异常与主力建仓异动识别" },
    { icon: "🛡️", text: "动态止盈止损线计算与仓位配比" }
  ],
  "quant-trading-strategy": [
    { icon: "⚡", text: "海龟/双均线/统计套利策略编写" },
    { icon: "📊", text: "多周期夏普比率与最大回撤测算" },
    { icon: "📈", text: "全品种历史数据回放与压力测试" },
    { icon: "🛡️", text: "多账户资金管理与自动对冲风控" }
  ],
  "quant-factor-backtesting": [
    { icon: "📊", text: "多因子 IC/IR 分析与单调性检验" },
    { icon: "⚙️", text: "因子正交化与行业风格中性化处理" },
    { icon: "📈", text: "多头分层回测与换手率敏感性分析" },
    { icon: "📑", text: "因子衰减期与绩效归因报告生成" }
  ],
  "wechat-article-writer": [
    { icon: "✍️", text: "微信公众号爆款排版与样式渲染" },
    { icon: "🎨", text: "优雅代码语法高亮与精美 CSS 主题" },
    { icon: "📱", text: "手机移动端排版适配与字号间距优化" },
    { icon: "🚀", text: "微信后台一键秒级复制与图片免密上传" }
  ],
  "copywriting-assistant": [
    { icon: "🎯", text: "爆款标题生成与 CTR 诱惑力诊断" },
    { icon: "📝", text: "黄金三秒开头与情绪共鸣故事撰写" },
    { icon: "💡", text: "多平台风格迁移 (微信/小红书/知乎)" },
    { icon: "📈", text: "转化型 CTA 结尾引导与文案润色" }
  ],
  "gpt-researcher-competitive-analysis": [
    { icon: "🔍", text: "全网自主深度商研与竞品信息聚合" },
    { icon: "📊", text: "SWOT 态势与商业模式矩阵图谱" },
    { icon: "📑", text: "结构化竞品对比分析研报自动导出" },
    { icon: "🛡️", text: "多信源交叉核验与真实性可靠度过滤" }
  ],
  "competitive-analysis": [
    { icon: "🔍", text: "竞品全功能矩阵拆解与特性差异分析" },
    { icon: "📊", text: "商业盈利模式与阶梯定价策略剖析" },
    { icon: "📈", text: "用户心智份额与市场定位雷达图" },
    { icon: "🎯", text: "攻防壁垒诊断与差异化竞争策略" }
  ],
  "market-research-analyst": [
    { icon: "📊", text: "行业市场空间 (TAM/SAM/SOM) 测算" },
    { icon: "🔍", text: "产业链上下游生态与核心玩家透视" },
    { icon: "📑", text: "深度行业调研与增长趋势前瞻研报" },
    { icon: "⚡", text: "政策监管变化与前沿技术驱动力剖析" }
  ],
  "posthog-growth-analytics": [
    { icon: "📈", text: "全埋点事件追踪与漏斗转化流失分析" },
    { icon: "🎯", text: "A/B 实验分流与特性标志 (Feature Flags)" },
    { icon: "👥", text: "多维度用户分群画像与生命周期洞察" },
    { icon: "⚡", text: "渠道获客 ROI 与关键触点归因模型" }
  ],
  "growth-marketing": [
    { icon: "📈", text: "AARRR 用户增长模型与裂变机制搭建" },
    { icon: "🎯", text: "付费广告投放优化与渠道转化率诊断" },
    { icon: "💬", text: "高转化文案 A/B 测试与营销自动化" },
    { icon: "📊", text: "用户全生命周期价值 (LTV) 与留存提升" }
  ],
  "nextjs": [
    { icon: "⚡", text: "App Router 与 React Server Components" },
    { icon: "🌐", text: "全自动路由缓存与流式数据传输 (Streaming)" },
    { icon: "🛠️", text: "SEO 友好型服务端渲染与 API Routes" },
    { icon: "🚀", text: "生产环境边缘部署与极致加载性能" }
  ],
  "shadcn": [
    { icon: "🎨", text: "无障碍 (a11y) 设计系统与 Tailwind UI" },
    { icon: "🧩", text: "40+ 极简高质感深色/浅色企业级组件" },
    { icon: "⚙️", text: "源码完全受控引入，零不可控黑盒依赖" },
    { icon: "✨", text: "高度灵活的主题变量与动画微交互" }
  ],
  "ai-sdk": [
    { icon: "🤖", text: "统一 LLM 智能体抽象与跨厂商调用" },
    { icon: "⚡", text: "端到端文本与 UI 实时流式响应传输" },
    { icon: "🛠️", text: "严格结构化 JSON 输出与精准 Tool Calling" },
    { icon: "🔌", text: "无缝对接 Next.js 及主流前端渲染框架" }
  ],
  "supabase-postgres-best-practices": [
    { icon: "🗄️", text: "PostgreSQL 高性能表结构与索引调优" },
    { icon: "🛡️", text: "行级安全策略 (RLS) 与细粒度权限管控" },
    { icon: "⚡", text: "数据库变更实时监听 (Realtime) 与订阅" },
    { icon: "🔒", text: "全自动化迁移与数据库生产级安全审计" }
  ],
  "systematic-debugging": [
    { icon: "🔍", text: "系统性根因诊断与科学假设验证链条" },
    { icon: "🧪", text: "最小缺陷复现环境与可执行测试用例构建" },
    { icon: "📊", text: "复杂调用链路剖析与性能瓶颈精准定位" },
    { icon: "🛡️", text: "防御性代码重构与自动化回归壁垒加固" }
  ],
  "test-driven-development": [
    { icon: "🔴", text: "红绿重构 (Red-Green-Refactor) 标准严谨循环" },
    { icon: "🧪", text: "高内聚低耦合模块可测性前置架构设计" },
    { icon: "🎯", text: "复杂业务逻辑与极端边界用例 100% 覆盖" },
    { icon: "⚡", text: "持续集成自动化断言与快速回归防线" }
  ],
  "marketing-design": [
    { icon: "🎨", text: "新消费品牌全套视觉识别与 VI 体系规范" },
    { icon: "📢", text: "中文营销推广海报与活动物料创意生成" },
    { icon: "✨", text: "高级感排版构图与前沿品牌色彩搭配" },
    { icon: "📐", text: "多平台尺寸跨终端自适应物料一键导出" }
  ],
  "frontend-design": [
    { icon: "💻", text: "高保真现代 Web 交互界面与设计还原" },
    { icon: "🎨", text: "极简暗黑与响应式微动效排版美学" },
    { icon: "📱", text: "移动端与桌面端自适应流畅视觉体验" },
    { icon: "✨", text: "无障碍标准与设计令牌 (Tokens) 体系" }
  ],
  "react-best-practices": [
    { icon: "⚛️", text: "React 19 / 并发模式与高性能渲染优化" },
    { icon: "⚡", text: "防多余重渲染、Memo 与 Hooks 最佳实践" },
    { icon: "🧩", text: "清晰可维护的组件复合与状态提升架构" },
    { icon: "🧪", text: "严格模式与现代化状态机工程规范" }
  ],
  "playwright-testing": [
    { icon: "🧪", text: "真实浏览器跨平台端到端 (E2E) 自动化测试" },
    { icon: "⚡", text: "网络拦截、Mock 数据与并行高速执行" },
    { icon: "📸", text: "像素级视觉比对 (Visual Regression Testing)" },
    { icon: "📹", text: "测试录制回放与自动化跟踪报告生成" }
  ],
  "code-review": [
    { icon: "🔍", text: "代码规范与潜在逻辑缺陷双轴深度审查" },
    { icon: "🛡️", text: "安全漏洞、SQL 注入与数据泄露隐患拦截" },
    { icon: "⚙️", text: "模块设计、扩展性与技术债务改善建议" },
    { icon: "📑", text: "结构化 PR 审查建议与可直接应用的 Diff" }
  ]
};

function getSkillFeatures(skill) {
  if (FEATURE_MAP[skill.id]) return FEATURE_MAP[skill.id];
  const list = [];
  if (Array.isArray(skill.uses) && skill.uses.length >= 2) {
    const icons = ["⚡", "📊", "🎯", "🛡️"];
    skill.uses.slice(0, 4).forEach((use, i) => {
      list.push({ icon: icons[i % icons.length], text: use });
    });
  }
  if (list.length < 3) {
    const iconPool = {
      "Frontend": ["💻", "🎨", "⚡", "📱"],
      "Database": ["🗄️", "⚡", "🔒", "📊"],
      "Data & Database": ["🗄️", "⚡", "🔒", "📊"],
      "Security": ["🛡️", "🔒", "🔍", "⚡"],
      "Automation": ["⚡", "🤖", "⚙️", "📈"],
      "Automation & Integrations": ["⚡", "🤖", "⚙️", "📈"],
      "AI Agents": ["✦", "🤖", "🧠", "⚡"],
      "Design": ["🎨", "📐", "✨", "📱"],
      "Design & Media": ["🎨", "🎬", "✨", "📐"],
      "Testing": ["🧪", "🛡️", "🎯", "⚡"],
      "Testing & Quality": ["🧪", "🛡️", "🎯", "⚡"],
      "Backend & API": ["⚙️", "🌐", "⚡", "🔒"],
      "Operations & Growth": ["📈", "🎯", "👥", "⚡"],
      "Competitive Analysis": ["🔍", "📊", "📑", "🎯"],
      "Content & Copywriting": ["✍️", "🎨", "📱", "🚀"],
      "Stock & Equity": ["📊", "📈", "🔍", "📡"],
      "Quantitative Trading": ["⚡", "📊", "📈", "🛡️"]
    };
    const catIcons = iconPool[skill.category] || ["⚡", "📊", "🎯", "🛡️"];
    const sentences = text(skill.summary).split(/[，。；;,.]/).map((s) => s.trim()).filter((s) => s.length >= 4 && s.length <= 26);
    for (let i = 0; i < sentences.length && list.length < 4; i++) {
      list.push({ icon: catIcons[list.length % catIcons.length], text: sentences[i] });
    }
    if (list.length < 3 && Array.isArray(skill.tags)) {
      skill.tags.forEach((tag) => {
        if (list.length < 4 && !list.some((item) => item.text.includes(tag))) {
          list.push({ icon: catIcons[list.length % catIcons.length], text: `支持 ${tag} 核心技术与工作流` });
        }
      });
    }
  }
  if (list.length === 0) {
    list.push({ icon: "⚡", text: "标准化 Agent 任务执行能力" });
    list.push({ icon: "🛡️", text: "经静态安全审计与合规门禁" });
    list.push({ icon: "🎯", text: "提供专属性上下文与工具扩展" });
  }
  return list.slice(0, 4);
}

function renderFeatureMatrix(skill) {
  const feats = getSkillFeatures(skill);
  return `<div class="featList">${feats.map((f) => `<div class="featItem"><span class="featIcon">${esc(f.icon)}</span><span class="featText">${esc(f.text)}</span></div>`).join("")}</div>`;
}

function normalizeDisplaySkill(skill) {
  const score = numeric(skill.score ?? skill.signalScore, 70);
  const maintenance = numeric(skill.maintenance ?? skill.maintenanceScore, 70);
  const rising = numeric(skill.rising, Math.min(99, score));
  const growth = numeric(skill.growth, Math.min(99, Math.round(score * 0.92)));
  return {
    ...skill,
    id: text(skill.id),
    name: text(skill.name || skill.id || "Unnamed Skill"),
    source: text(skill.source),
    category: text(skill.category || "General"),
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
    repoStars: skill.repoStars ? numeric(skill.repoStars, 0) : (skill.stars ? numeric(skill.stars, 0) : null)
  };
}

function save() {
  localStorage.setItem("sr-installed", JSON.stringify([...installed]));
  localStorage.setItem("sr-favs", JSON.stringify([...favs]));
  localStorage.setItem("sr-workflows", JSON.stringify([...savedWorkflows]));
}

function toast(message) {
  $("#toast").textContent = text(message);
  $("#toast").classList.add("on");
  setTimeout(() => $("#toast").classList.remove("on"), 1500);
}

async function copy(value) {
  const copyValue = text(value);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyValue);
    } else {
      const input = document.createElement("textarea");
      input.value = copyValue;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      try {
        input.select();
        if (!document.execCommand('copy')) throw new Error("Clipboard fallback failed");
      } finally {
        input.remove();
      }
    }
    toast("已复制到剪贴板");
  } catch {
    toast("复制失败");
  }
}

function badge(skill) {
  const grade = securityGrade(skill.security);
  return `${skill.official ? '<span class="badge off">官方</span>' : ""}<span class="badge ${grade}">安全等级 ${grade}</span>`;
}

function card(skill) {
  const starBadge = skill.repoStars ? `<span class="badge badgeStar">★ ${fmtN(skill.repoStars)}</span>` : "";
  const command = skillInstallCommand(skill);
  const url = sourceUrl(skill);
  const handle = skill.source.includes("/") ? `@${skill.source}` : `@${skill.source || "skillradar"}`;
  const grade = securityGrade(skill.security);
  const installsText = skill.installs ? `🔥 ${fmtN(skill.installs)}` : "";

  return `<article class="card case-card xCard" data-s="${attr(skill.id)}">
    <div class="case-card__media">
      <div class="case-card__media-top">
        <span class="case-card__domain">${esc(catLabel(skill.category))}</span>
        <div class="case-card__badges">
          <span class="badge ${grade}">${grade}级</span>
          ${installsText ? `<span class="case-card__heat" title="公开真实安装量">${installsText}</span>` : starBadge}
        </div>
      </div>
      <div class="case-card__monogram">
        <span>${esc(initials(skill.name))}</span>
      </div>
    </div>
    
    <div class="case-card__body">
      <div class="card-title-row">
        <h3 class="cardTitle">${esc(skill.name)}</h3>
        ${skill.verified ? '<span class="verifiedBadge" title="已通过安全审计">✓</span>' : ""}
      </div>
      <div class="cardHandle">${esc(handle)}</div>
      
      <p class="cardSummary case-card__desc">${esc(skill.summary)}</p>
      
      <div class="card-tags">
        ${skill.tags.slice(0, 3).map((tag) => `<span class="property-pill">✦ ${esc(tag)}</span>`).join("")}
      </div>
      
      <div class="bottom cardActions case-card__foot">
        <div class="cardScoreGroup">
          <span class="card-colors">
            <span class="card-color-dot ${grade === 'A' ? 'dot-green' : 'dot-blue'}"></span>
            <span class="scoreVal">${numeric(skill.score)}分</span>
          </span>
          <span class="rise">↑ ${numeric(skill.rising)}</span>
        </div>
        <div class="cardBtnGroup">
          ${command ? `<button class="quickCopyBtn" data-copy-install="${attr(command)}" title="一键复制安装命令">⚡ 安装</button>` : ""}
          ${url ? `<a class="quickSourceBtn" href="${attr(url)}" target="_blank" rel="noopener noreferrer" title="查看源码 Inspect source">源码 ↗</a>` : ""}
          <button class="ghost cardDetailBtn" data-detail-skill="${attr(skill.id)}">详情</button>
        </div>
      </div>
    </div>
  </article>`;
}

function bindSkills() {
  $$("[data-s]").forEach((element) => {
    element.onclick = (e) => {
      if (e.target.closest("button") || e.target.closest("a")) return;
      openSkill(element.dataset.s);
    };
  });
}

function bindSkillActions() {
  $$("[data-detail-skill]").forEach((button) => {
    button.onclick = (e) => {
      e.stopPropagation();
      openSkill(button.dataset.detailSkill);
    };
  });
  $$("[data-copy-install]").forEach((button) => {
    button.onclick = (e) => {
      e.stopPropagation();
      copy(button.dataset.copyInstall);
    };
  });
  $$(".quickSourceBtn").forEach((link) => {
    link.onclick = (e) => {
      e.stopPropagation();
    };
  });
}

function bindCats() {
  $$("[data-cat]").forEach((element) => {
    element.onclick = () => {
      filterCat = element.dataset.cat;
      q = "";
      listMode = "trending";
      show("trending");
    };
  });
}

let homeTab = "all";

function filterSkillsByTab(tab) {
  if (tab === "quant") {
    return skills.filter((s) => ["Quantitative Trading", "Stock & Equity"].includes(s.category));
  }
  if (tab === "content") {
    return skills.filter((s) => ["Content & Copywriting", "Operations & Growth"].includes(s.category));
  }
  if (tab === "analysis") {
    return skills.filter((s) => ["Competitive Analysis", "Docs & Research"].includes(s.category));
  }
  if (tab === "dev") {
    return skills.filter((s) => ["Frontend", "Backend & API", "Database", "Data & Database", "AI Agents", "Testing", "Testing & Quality"].includes(s.category));
  }
  if (tab === "design") {
    return skills.filter((s) => ["Design", "Design & Media"].includes(s.category));
  }
  return skills;
}

function renderFeatured() {
  const candidates = filterSkillsByTab(homeTab);
  const featured = candidates.slice().sort((a, b) => b.score - a.score).slice(0, 6);
  $("#featured").innerHTML = featured.length ? featured.map(card).join("") : '<div class="empty">暂无匹配技能。</div>';
  bindSkills();
  bindSkillActions();
}

function bindFeaturedTabs() {
  $$("[data-tab]").forEach((btn) => {
    btn.onclick = () => {
      $$("[data-tab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      homeTab = btn.dataset.tab;
      renderFeatured();
    };
  });
}

const SMART_SUGGESTIONS = [
  { icon: "⚡", query: "编写多因子量化选股与历史收益回测策略", tag: "量化回测" },
  { icon: "📊", query: "解读上市公司最新财报并进行 DCF 估值建模", tag: "证券投研" },
  { icon: "✍️", query: "微信公众号爆款推文选题、排版与样式润色", tag: "公众号排版" },
  { icon: "🔍", query: "拆解海外竞品商业模式、SWOT 态势与功能矩阵", tag: "竞品商研" },
  { icon: "📈", query: "制定新消费品牌用户增长策略与广告投放优化", tag: "用户增长" },
  { icon: "💻", query: "构建 Next.js App Router AI 仪表盘并集成 shadcn 组件库", tag: "全栈开发" },
  { icon: "⚡", query: "为 Node API 增加 Redis 缓存与性能调优", tag: "后端优化" },
  { icon: "🎨", query: "为新消费品牌设计一张中文活动海报与品牌视觉", tag: "视觉设计" },
  { icon: "🧪", query: "使用 Playwright 编写企业级端到端跨浏览器自动化测试", tag: "自动化测试" }
];

function setupSmartSuggestions() {
  const input = $("#heroQ");
  const dropdown = $("#heroSuggestDropdown");
  if (!input || !dropdown) return;

  function renderSuggestions(val) {
    const term = (val || "").trim().toLowerCase();
    const matches = term
      ? SMART_SUGGESTIONS.filter((item) => item.query.toLowerCase().includes(term) || item.tag.toLowerCase().includes(term))
      : SMART_SUGGESTIONS.slice(0, 5);

    if (!matches.length) {
      dropdown.style.display = "none";
      return;
    }

    dropdown.innerHTML = matches.map((item) => `<div class="suggestItem" data-suggest="${attr(item.query)}"><span class="suggestIcon">${esc(item.icon)}</span><span class="suggestText">${esc(item.query)}</span><span class="suggestTag">${esc(item.tag)}</span></div>`).join("");
    dropdown.style.display = "flex";

    $$("[data-suggest]").forEach((elem) => {
      elem.onmousedown = (e) => {
        e.preventDefault();
        input.value = elem.dataset.suggest;
        dropdown.style.display = "none";
        routeTask(elem.dataset.suggest);
      };
    });
  }

  function getItems() { return $$(".suggestItem", dropdown); }
  function getActiveIndex() {
    const items = getItems();
    return items.findIndex((item) => item.classList.contains("kbd-active"));
  }
  function setActive(index) {
    getItems().forEach((item, i) => item.classList.toggle("kbd-active", i === index));
  }

  input.addEventListener("focus", () => renderSuggestions(input.value));
  input.addEventListener("input", () => { renderSuggestions(input.value); setActive(-1); });
  input.addEventListener("blur", () => {
    setTimeout(() => { dropdown.style.display = "none"; }, 200);
  });
  input.addEventListener("keydown", (e) => {
    if (dropdown.style.display === "none") return;
    const items = getItems();
    if (!items.length) return;
    const current = getActiveIndex();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(current + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(current - 1, 0));
    } else if (e.key === "Enter") {
      const activeItem = items[current];
      if (activeItem) {
        e.preventDefault();
        input.value = activeItem.dataset.suggest;
        dropdown.style.display = "none";
        routeTask(input.value);
      }
    } else if (e.key === "Escape") {
      dropdown.style.display = "none";
    }
  });
}

function bindReeooDashboard() {
  $$("[data-dashboard-tab]").forEach((elem) => {
    elem.onclick = () => {
      const tab = elem.dataset.dashboardTab;
      homeTab = tab;
      $$("[data-tab]").forEach((b) => {
        b.classList.toggle("active", b.dataset.tab === tab);
      });
      renderFeatured();
      const featuredSec = $("#featured");
      if (featuredSec) {
        featuredSec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
  });
}

function renderHome() {
  $("#countAll").textContent = `${skills.length}+`;
  $("#countVerified").textContent = skills.filter((skill) => skill.verified).length;
  renderFeatured();
  bindFeaturedTabs();
  setupSmartSuggestions();
  bindReeooDashboard();
  const rankEl = $("#rank");
  if (rankEl) {
    rankEl.innerHTML = skills.slice().sort((a, b) => b.rising - a.rising).slice(0, 6).map((skill, index) => `<div class="rankrow" data-s="${attr(skill.id)}"><span>${String(index + 1).padStart(2, "0")}</span><div><b>${esc(skill.name)}</b><small>${esc(skill.source)} · ${esc(catLabel(skill.category))}</small></div><span class="rise">↑ ${numeric(skill.rising)}</span><b>${numeric(skill.score)}</b></div>`).join("");
  }
  const catsHomeEl = $("#catsHome");
  if (catsHomeEl) {
    catsHomeEl.innerHTML = cats.slice(0, 12).map((category) => `<button class="cat" data-cat="${attr(category)}"><span>${esc(catIcon(category))}</span><b>${esc(catLabel(category))}</b><small>${skills.filter((skill) => skill.category === category).length} 个已收录技能</small></button>`).join("");
    bindCats();
  }
  bindSkills();
  bindSkillActions();
}

function show(view) {
  $$(".view").forEach((element) => element.classList.remove("on"));
  $$(".nav button").forEach((element) => element.classList.toggle("active", element.dataset.v === view));
  if (["trending", "rising", "official"].includes(view)) {
    listMode = view;
    $("#listView").classList.add("on");
    $("#listK").textContent = view === "official" ? "官方认证" : view === "rising" ? "新晋飙升" : "热门趋势";
    $("#listTitle").textContent = view === "official" ? "官方认证技能" : view === "rising" ? "新晋飙升技能" : "热门趋势技能";
    $("#listSub").textContent = view === "official" ? "已验证来源与官方插件。" : "根据任务相关性、质量、安全评级与发展势头排序。";
    renderList();
  } else {
    const target = $(`#${view}`);
    if (!target) return;
    target.classList.add("on");
    if (view === "mine") renderMine();
    if (view === "designRadar") renderDesignRadar();
  }
  scrollTo(0, 0);
}

function renderList() {
  let rows = skills.slice();
  if (listMode === "official") rows = rows.filter((skill) => skill.official || skill.verified);
  if (filterCat !== "All") rows = rows.filter((skill) => skill.category === filterCat);
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    rows = rows.filter((skill) => {
      const haystack = `${skill.name} ${skill.summary} ${skill.tags.join(" ")} ${skill.category} ${catLabel(skill.category)}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }
  rows.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "rising" ? b.rising - a.rising : b.score - a.score);
  $("#listCount").textContent = `${rows.length} 个技能`;
  $("#chips").innerHTML = ["All", ...cats].map((category) => `<button class="${filterCat === category ? "active" : ""}" data-fc="${attr(category)}">${esc(category === "All" ? "全部" : catLabel(category))}</button>`).join("");
  $("#list").innerHTML = rows.length ? rows.map((skill) => {
    const starText = skill.repoStars ? ` · ★ ${fmtN(skill.repoStars)}` : "";
    return `<div class="row" data-s="${attr(skill.id)}"><div class="identity"><div class="ico">${esc(initials(skill.name))}</div><div><b>${esc(skill.name)}</b><small>${esc(skill.source)} · ${esc(catLabel(skill.category))}${starText}</small></div></div><div class="desc">${esc(skill.summary)}</div><b>${esc(skill.security)}</b><div class="score">${numeric(skill.score)}</div></div>`;
  }).join("") : '<div class="empty">未找到匹配技能。</div>';
  $$("[data-fc]").forEach((button) => { button.onclick = () => { filterCat = button.dataset.fc; renderList(); }; });
  bindSkills();
}

function openSkill(id) {
  // Search both regular skills and design skills
  const skill = skills.find((candidate) => candidate.id === id) || designSkills.find((candidate) => candidate.id === id);
  if (!skill) return;
  const isDesign = !skills.find((candidate) => candidate.id === id);
  const command = isDesign ? null : skillInstallCommand(skill);
  const url = sourceUrl(skill);
  const coordinatesGap = !command && !url && !isDesign ? '<div class="actionGap">Install coordinates are not verified for this curated entry yet.</div>' : "";
  const starBadge = skill.repoStars ? `<span class="badge badgeStar">★ ${fmtN(skill.repoStars)} Stars</span>` : "";
  const growthOrStars = skill.repoStars ? `<div><b>${fmtN(skill.repoStars)}</b><small>GitHub 收藏 Stars</small></div>` : `<div><b>${numeric(skill.growth)}</b><small>成长指数</small></div>`;
  const handle = skill.source && skill.source.includes("/") ? `@${skill.source}` : `@${skill.source || "skillradar"}`;

  $("#modal").innerHTML = `<div class="cardHeader" style="margin-bottom:14px">
    <div class="cardAvatar" style="width:52px;height:52px;font-size:18px">${esc(initials(skill.name))}</div>
    <div class="cardAuthor">
      <div class="cardAuthorRow">
        <h2 style="margin:0;font-size:22px;color:#ffffff">${esc(skill.name)}</h2>
        ${skill.verified ? '<span class="verifiedBadge" title="已通过安全审计">✓</span>' : ""}
        <span class="cardCategory">${esc(isDesign ? "设计体系" : catLabel(skill.category))}</span>
      </div>
      <div class="cardHandle" style="font-size:14px">${esc(handle)}${skill.repoStars ? ` · ★ ${fmtN(skill.repoStars)} Stars` : ""}</div>
    </div>
  </div>
  
  <div class="badges">${badge(skill)}${starBadge}${(skill.tags || []).map((tag) => `<span class="badge">${esc(tag)}</span>`).join("")}</div>
  
  <p style="font-size:15px;line-height:1.6;color:#c9d1d9;margin:16px 0">${esc(skill.summary)}</p>
  
  <div class="featureMatrixSection" style="margin:20px 0">
    <div class="featureMatrixTitle" style="font-size:12px;margin-bottom:10px">⚡ 核心功能与能力矩阵</div>
    ${renderFeatureMatrix(skill)}
  </div>
  
  <div class="metrics">
    <div><b>${numeric(skill.score)}</b><small>SKILLRADAR 评分</small></div>
    ${growthOrStars}
    <div><b>${numeric(skill.maintenance)}</b><small>维护活跃度</small></div>
    <div><b>${esc(skill.security)}</b><small>安全评级</small></div>
  </div>
  
  <div class="featureMatrixTitle" style="font-size:12px;margin-bottom:8px">最适用场景</div>
  <div class="use">${(skill.uses || skill.tags || []).length ? (skill.uses || skill.tags || []).slice(0,4).map((use) => `<div>✓ ${esc(use)}</div>`).join("") : "<div>✓ 通用设计工作流</div>"}</div>
  
  ${coordinatesGap}
  
  <div class="actions">
    ${!isDesign ? `<button class="btn" id="markI">${installed.has(skill.id) ? "已安装 ✓" : "标记已安装"}</button>` : ""}
    <button class="ghost" id="markF">${favs.has(skill.id) ? "已收藏 ★" : "收藏 ☆"}</button>
    ${command ? '<button class="btn" id="copyCmd">复制精确安装命令</button>' : ""}
    ${url ? `<a class="ghost actionLink" href="${attr(url)}" target="_blank" rel="noopener noreferrer">查看源码 Inspect source ↗</a>` : ""}
  </div>`;

  $("#modalbg").classList.add("on");
  if (!isDesign) {
    $("#markI").onclick = () => { installed.has(skill.id) ? installed.delete(skill.id) : installed.add(skill.id); save(); openSkill(skill.id); };
  }
  $("#markF").onclick = () => { favs.has(skill.id) ? favs.delete(skill.id) : favs.add(skill.id); save(); openSkill(skill.id); };
  if (command) $("#copyCmd").onclick = () => copy(command);
}

function normalizeDesignSkill(skill) {
  const score = numeric(skill.signalScore, 70);
  return normalizeDisplaySkill({
    ...skill,
    category: "Design",
    score,
    growth: Math.min(99, Math.round(score * 0.92)),
    maintenance: numeric(skill.repoStars, 0) > 1000 ? 94 : 82,
    verified: false,
    uses: Array.isArray(skill.tags) ? skill.tags.slice(0, 4) : [],
    rising: Math.min(99, score),
    official: false
  });
}

const designDomainFocusMap = {
  "ui-design": {
    pillars: ["界面视觉规范", "组件系统 (Design System)", "动效与微交互", "无障碍 (A11y)"],
    keywords: ["ui", "design-system", "layout", "typography", "interaction", "figma", "accessibility", "web"]
  },
  "visual-communication": {
    pillars: ["品牌视觉体系", "字体排印与版式", "矢量插画与图示", "色彩理论与信息可视化"],
    keywords: ["visual", "brand", "typography", "layout", "editorial", "vector", "illustration", "color"]
  },
  "operations-design": {
    pillars: ["营销活动主图", "电商物料与大促", "社交媒体视觉", "转化率视觉引导"],
    keywords: ["operations", "brand", "campaign", "product", "visual", "photo", "video", "motion", "ecommerce"]
  },
  "video-design": {
    pillars: ["代码化视频合成", "复杂关键帧动效", "分镜故事板推演", "剪辑调色与特效"],
    keywords: ["video", "motion", "editing", "film", "storyboard", "vfx", "typography", "audio"]
  },
  "industrial-design": {
    pillars: ["3D 参数化建模", "3D 打印原型制造", "CAD 结构工程推演", "工业产品造型渲染"],
    keywords: ["industrial", "product", "3d", "cad", "parametric", "fabrication", "rendering", "3d-printing"]
  },
  "environmental-design": {
    pillars: ["室内空间规划", "物理材质光影渲染", "景观环境制图", "大尺度空间导视"],
    keywords: ["interior", "environment", "landscape", "spatial", "architecture", "lighting", "3d", "rendering"]
  },
  "fashion-design": {
    pillars: ["时尚企划视觉", "调色板与材质情绪板", "商业大片质感摄影", "潮流趋势分析"],
    keywords: ["fashion", "color", "photo", "brand", "campaign", "visual", "art-direction", "illustration"]
  },
  "experience-design": {
    pillars: ["用户旅程与服务设计", "可用性摩擦排查", "高保真交互原型", "移动端人机工效"],
    keywords: ["ux", "product", "research", "interaction", "prototype", "usability", "service-design", "mobile", "accessibility"]
  },
  "digital-media-film": {
    pillars: ["创意编程交互", "GSAP/Three.js 场景合成", "动态影视后期", "生成式数字艺术"],
    keywords: ["digital-media", "video", "film", "3d", "creative-coding", "motion", "interaction", "vfx", "generative-art"]
  },
  "arts-crafts": {
    pillars: ["传统工艺纹样", "数字制造与参数工艺", "矢量图标工艺", "3D 打印形态"],
    keywords: ["craft", "fabrication", "vector", "illustration", "3d-printing", "parametric", "color", "pattern"]
  },
  "folk-art": {
    pillars: ["手绘肌理艺术", "传统色彩搭配", "拼贴插画排版", "民间艺术数字化再现"],
    keywords: ["illustration", "hand-drawn", "collage", "color", "vector", "pattern", "visual", "craft"]
  },
  "architecture-design": {
    pillars: ["建筑形体参数化", "真实环境光影渲染", "宏观地图空间制图", "场地规划推演"],
    keywords: ["architecture", "spatial", "3d", "rendering", "diagram", "map", "environment", "lighting", "interior"]
  }
};

const designSkillFocusMap = {
  "anthropics/skills/frontend-design": "🎨 界面视觉方向 · 质感打磨 · 生产级前端规范与组件",
  "vercel-labs/agent-skills/web-design-guidelines": "📐 间距栅格系统 · 字体层级 · 无障碍 A11y 严格合规",
  "remotion-dev/skills/remotion-best-practices": "🎬 React 代码化视频 · 复杂帧动画 · 视频自动化渲染流水线",
  "leonxlnx/taste-skill/high-end-visual-design": "✨ 高端奢感视觉品味 · 电影级空间节奏 · 艺术指导",
  "pbakaus/impeccable/impeccable": "🔍 全界面视觉打磨 · 生产级工匠细节 · 专家走查评审",
  "pbakaus/impeccable/polish": "💎 视觉终审打磨 · 层级与留白微调 · 界面精细润色",
  "pbakaus/impeccable/critique": "📋 结构化设计走查 · 严谨可用性评审 · 实操改进建议",
  "pbakaus/impeccable/audit": "🛡️ 全界面可用性排查 · 交互一致性审查 · 生产质量审计",
  "pbakaus/impeccable/animate": "⚡ 交互动效编排 · 动态视觉引导 · 流畅微交互体验",
  "pbakaus/impeccable/colorize": "🎨 品牌色彩层级 · 调色板对比度强化 · 色彩情绪传达",
  "pbakaus/impeccable/bolder": "💥 视觉张力提升 · 强冲击力排版 · 个性化视觉表达",
  "pbakaus/impeccable/typeset": "🔤 字体排印规范 · 行高字距微调 · 文本舒适阅读感",
  "pbakaus/impeccable/distill": "🧹 视觉去噪提纯 · 强化核心信息层级 · 极简重构",
  "pbakaus/impeccable/arrange": "📐 构图栅格规划 · 空间留白编排 · 视觉元素平衡",
  "pbakaus/impeccable/adapt": "📱 响应式多端自适应 · 移动端视口适配 · 动态断点",
  "pbakaus/impeccable/delight": "✨ 情感化设计细节 · 趣味微交互反馈 · 用户愉悦感",
  "pbakaus/impeccable/quieter": "🌿 柔和安静构图 · 降低视觉杂音 · 沉浸呼吸感",
  "pbakaus/impeccable/layout": "📐 严谨栅格布局 · 响应式容器规则 · 空间对齐",
  "nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max": "📱 复杂系统界面 · 全栈 UI/UX 范式 · 完整设计系统",
  "sleekdotdesign/agent-skills/sleek-design-mobile-apps": "📱 移动端优先设计 · iOS/Android 交互规范 · App 原型",
  "mitsuhiko/agent-stuff/openscad": "⚙️ OpenSCAD 实体建模 · 3D 参数化打印 · 数字工程制造",
  "meshy-dev/meshy-3d-agent/meshy-3d-printing": "🖨️ 3D 打印切片优化 · 实体模型修复 · 几何网格成型",
  "roble3/cc-blender-skill/blender-rendering": "🏛️ Blender 空间渲染 · 物理光影材质 · 逼真视觉管线",
  "roble3/cc-blender-skill/blender-export": "📦 3D 模型资产导出 · 格式转换 · 生产级模型管线",
  "curiositech/some_claude_skills/interior-design-expert": "🛋️ 室内空间规划 · 软装搭配风格 · 材质情绪方案",
  "curiositech/some_claude_skills/large-scale-map-visualization": "🗺️ 宏观地图可视化 · 地理信息制图 · 空间图表表达",
  "curiositech/some_claude_skills/fancy-yard-landscaper": "🌳 庭院景观规划 · 植物环境造景 · 户外空间布局",
  "curiositech/some_claude_skills/diagramming-expert": "📊 架构图示与信息图 · 逻辑流可视化 · 结构关系图",
  "curiositech/some_claude_skills/typography-expert": "🔤 专家级排版系统 · 字体配对准则 · 国际化版面编排",
  "curiositech/some_claude_skills/color-theory-palette-harmony-expert": "🎨 色彩理论调和 · 对比度与明度配比 · 情绪配色卡",
  "curiositech/some_claude_skills/photo-composition-critic": "📷 摄影构图评审 · 光影明暗分析 · 视觉视觉焦点引导",
  "curiositech/some_claude_skills/mobile-ux-optimizer": "📱 移动端触控热区 · 交互阻力消除 · 移动表单体验",
  "curiositech/some_claude_skills/ux-friction-analyzer": "🔍 用户体验摩擦力诊断 · 留存流失漏斗 · 行为路径审计",
  "curiositech/some_claude_skills/human-centered-design-fundamentals": "👥 以用户为中心设计 · 需求洞察研究 · 可用性验证",
  "curiositech/some_claude_skills/native-app-designer": "📱 原生移动应用规范 · 平台特有控件 · 手势交互",
  "curiositech/some_claude_skills/design-accessibility-auditor": "♿ WCAG 2.1 无障碍审计 · 色盲模式友好 · 读屏兼容",
  "curiositech/some_claude_skills/hand-drawn-infographic-creator": "✏️ 手绘风格信息图 · 亲和力叙事图示 · 概念白板化",
  "curiositech/some_claude_skills/collage-layout-expert": "✂️ 拼贴艺术排版 · 复古现代混搭 · 视觉张力版面",
  "tryopendata/skills/svg-design": "📐 SVG 矢量代码生成 · 响应式图标系统 · 轻量矢量图形",
  "heroygt/skills/svg-icon-maker": "✨ 矢量图标制作 · 统一笔画规范 · 像素级网格对齐",
  "narumiruna/skills/svg-illustration": "🎨 矢量手绘插画 · 平面几何风格 · 品牌插画库",
  "figma/mcp-server-guide/figma-generate-design": "⚡ Figma 设计稿自动生成 · 组件库引用 · 规范编排",
  "figma/mcp-server-guide/implement-design": "💻 Figma 标注精确落地 · 设计稿像素级还原 · 代码生成",
  "figma/mcp-server-guide/create-design-system-rules": "📏 设计系统 Token 制定 · 样式变量同步 · 团队规范",
  "figma/mcp-server-guide/figma-design-to-code": "💻 Figma 转生产级前端组件 · Tailwind/CSS 变量映射",
  "calesthio/generative-media-skills/product-ad-production": "📢 商业广告物料生成 · 营销海报策划 · 品牌广告视觉",
  "calesthio/generative-media-skills/ecommerce-product-imagery": "🛍️ 电商主图场景烘托 · 白底图转商业大片 · 卖点提炼",
  "calesthio/generative-media-skills/motion-graphics-direction": "🎞️ 动态视觉导演 · 品牌动画分镜 · 商业动效脚本",
  "calesthio/generative-media-skills/fashion-campaign-production": "👗 时尚大片企划 · 视觉调性定位 · 造型美学指导",
  "calesthio/generative-media-skills/editing-montage": "🎬 蒙太奇剪辑逻辑 · 叙事节奏控制 · 镜头衔接过渡",
  "calesthio/generative-media-skills/storyboard-previsualization": "📑 视频故事板推演 · 镜头机位标注 · 动态预演",
  "calesthio/generative-media-skills/vfx-compositing": "✨ 视觉特效合成 · 绿幕通道处理 · 粒子光影融合",
  "calesthio/generative-media-skills/title-kinetic-typography": "🔤 动态字幕片头 · 动力学字体动效 · 节奏卡点",
  "calesthio/generative-media-skills/cinematic-shot-direction": "🎥 电影级运镜指导 · 构图景深景别 · 情绪氛围",
  "calesthio/generative-media-skills/color-grading-finishing": "🎨 视频专业调色 · LUT 风格预设 · 画面影调微调",
  "calesthio/generative-media-skills/explainer-video-production": "💡 讲解类产品视频 · 商业逻辑可视化 · 动效说明",
  "calesthio/generative-media-skills/procedural-canvas-animation": "🌀 Canvas 过程式生成动效 · 复杂数学曲线 · 交互式渲染",
  "calesthio/generative-media-skills/gsap-animation-composition": "⚡ GSAP 时间轴控制 · 丝滑滚动触发动效 · 网页交互",
  "calesthio/generative-media-skills/threejs-scene-composition": "🌐 Three.js 网页 3D 场景 · 粒子光影交互 · WebGL 渲染",
  "calesthio/generative-media-skills/3d-asset-production": "🧱 3D 游戏/网页资产制作 · 减面轻量化 · 贴图烘焙",
  "calesthio/generative-media-skills/neural-reality-capture": "📷 神经辐射场 (NeRF) 实景建模 · 空间三维重建",
  "calesthio/generative-media-skills/lighting-direction": "💡 空间与摄影布光指导 · 三点照明系统 · 真实光影渲染",
  "calesthio/generative-media-skills/production-design-direction": "🎬 美术置景概念设定 · 场景材质统一 · 视觉世界观",
  "monumentalsystems/atlas-agent-teams/blender": "🧱 Blender 智能协作管线 · 场景脚本化建模 · 材质绑定",
  "lovstudio/skills/lovstudio-png2svg": "🖼️ 位图转精细矢量 SVG · 矢量轮廓提取 · 路径平滑优化",
  "remotion-dev/skills/remotion-create": "🛠️ Remotion 项目脚手架 · 视频组件结构初始化 · 依赖配置",
  "remotion-dev/skills/remotion-render": "🚀 视频服务端高并发离线渲染 · 多线程切片 · MP4 快速输出",
  "remotion-dev/skills/remotion-markup": "📐 Remotion 视频布局标记 · 响应式视口排版 · 图层层级",
  "remotion-dev/skills/remotion-interactivity": "🎮 互动式视频控件 · 用户输入响应 · 动态分支剧情",
  "remotion-dev/skills/remotion-captions": "💬 智能字幕时间轴对齐 · 动态弹幕排版 · 多语种字幕",
  "remotion-dev/skills/remotion-multimedia": "🎵 视频音频混音对齐 · 视频转场特效 · 多媒体素材编排",
  "ibelick/ui-skills/baseline-ui": "✨ 现代极简 UI 微交互组件 · 丝滑动画效果 · React 动效库",
  "abhsin/designskills/ux-specification": "📑 严谨交互原型说明文档 · 异常分支状态 · 研发交接规范"
};

function getDesignSkillFocus(skill, domain) {
  if (skill && designSkillFocusMap[skill.id]) return designSkillFocusMap[skill.id];
  const summary = text(skill?.summary);
  if (summary) {
    const clean = summary.replace(/^[^a-zA-Z0-9\u4e00-\u9fa5]+/, "").slice(0, 48);
    return `🎯 侧重点：${clean}`;
  }
  const tags = (skill?.tags || []).slice(0, 3).join(" · ");
  return `🎯 侧重点：${tags}`;
}

function renderDesignHome() {
  const el = $("#designHomeDomains");
  if (!el || !designDomains.length) return;
  el.innerHTML = designDomains.slice(0, 6).map((domain) => {
    const count = Array.isArray(domain.seedTop20) ? domain.seedTop20.length : 0;
    return `<button class="homeDomain" data-dd="${attr(domain.id)}"><span class="domainIcon">${esc(domain.icon)}</span><b>${esc(domain.name)}</b><small>${esc(domain.en)} · ${count} 个技能</small></button>`;
  }).join("");
  $$("[data-dd]").forEach((button) => { button.onclick = () => { activeDesignDomain = button.dataset.dd; show("designRadar"); renderDesignRadar(); }; });
}

function renderDesignRadar() {
  if (!designDomains.length) return;
  const isAll = activeDesignDomain === "all";
  let domain = null;
  if (!isAll) {
    domain = designDomains.find((candidate) => candidate.id === activeDesignDomain);
    if (!domain) {
      domain = designDomains[0];
      activeDesignDomain = domain.id;
    }
  }

  // Safe updates for legacy counts if elements exist
  const skillCountEl = $("#designSkillCount");
  if (skillCountEl) skillCountEl.textContent = designSkills.length;
  const domainCountEl = $("#designDomainCount");
  if (domainCountEl) domainCountEl.textContent = designDomains.length;
  const radarNewCountEl = $("#radarNewCount");
  if (radarNewCountEl) radarNewCountEl.textContent = radarData.discoveryCount ?? (radarData.discoveries || []).length;
  const radarTimeEl = $("#radarTime");
  if (radarTimeEl) radarTimeEl.textContent = radarData.generatedAt ? `更新于 ${new Date(radarData.generatedAt).toLocaleString("zh-CN")}` : "安装量权威榜单";

  // Top horizontal filter bar: "全部设计" + 12 categories
  const filterBar = $("#designDomainFilterBar");
  if (filterBar) {
    const allCount = designSkills.length;
    const isAllActive = isAll ? "active" : "";
    const allPill = `<button class="domainPill ${isAllActive}" data-domain="all"><span class="domainIcon">🔥</span><span>全部设计</span><small class="pillCount">${allCount}</small></button>`;
    const domainPills = designDomains.map((item) => {
      const count = Array.isArray(item.seedTop20) ? item.seedTop20.length : 0;
      const isActive = !isAll && item.id === activeDesignDomain;
      return `<button class="domainPill ${isActive ? "active" : ""}" data-domain="${attr(item.id)}"><span class="domainIcon">${esc(item.icon)}</span><span>${esc(item.name)}</span><small class="pillCount">${count}</small></button>`;
    }).join("");
    filterBar.innerHTML = allPill + domainPills;
  }

  // Guard legacy domainGrid / domainSide
  const gridEl = $("#domainGrid");
  if (gridEl) gridEl.innerHTML = "";
  const sideEl = $("#domainSide");
  if (sideEl) sideEl.innerHTML = "";

  const byId = new Map(designSkills.map((skill) => [skill.id, skill]));
  let topRows = [];

  if (isAll) {
    const seenSkillIds = new Set();
    designDomains.forEach((d) => {
      (d.seedTop20 || []).forEach((row) => {
        const skillId = Array.isArray(row) ? row[0] : row.skillId;
        const seedScore = Array.isArray(row) ? row[1] : row.seedScore;
        if (!seenSkillIds.has(skillId) && byId.has(skillId)) {
          seenSkillIds.add(skillId);
          topRows.push({
            skillId,
            seedScore,
            skill: byId.get(skillId),
            domain: d
          });
        }
      });
    });
    designSkills.forEach((s) => {
      if (!seenSkillIds.has(s.id)) {
        seenSkillIds.add(s.id);
        topRows.push({
          skillId: s.id,
          seedScore: s.score || 70,
          skill: s,
          domain: null
        });
      }
    });
  } else {
    topRows = (domain.seedTop20 || [])
      .map((row, index) => ({
        rank: index + 1,
        skillId: Array.isArray(row) ? row[0] : row.skillId,
        seedScore: Array.isArray(row) ? row[1] : row.seedScore,
      }))
      .map((row) => ({ ...row, skill: byId.get(row.skillId), domain }))
      .filter((row) => row.skill);
  }

  // Sort according to activeDesignSort
  if (activeDesignSort === "score") {
    topRows.sort((a, b) => (b.seedScore || 0) - (a.seedScore || 0) || (b.skill.installs || 0) - (a.skill.installs || 0));
  } else if (activeDesignSort === "rising") {
    topRows.sort((a, b) => (b.skill.signalScore || 0) - (a.skill.signalScore || 0) || (b.skill.installs || 0) - (a.skill.installs || 0));
  } else {
    // default: "installs"
    topRows.sort((a, b) => (b.skill.installs || 0) - (a.skill.installs || 0) || (b.seedScore || 0) - (a.seedScore || 0));
  }

  // Break 20 limit: if "all", show up to 50 top design skills
  if (isAll && topRows.length > 50) {
    topRows = topRows.slice(0, 50);
  }
  topRows.forEach((r, idx) => { r.rank = idx + 1; });

  const maxInstalls = Math.max(...topRows.map((r) => r.skill.installs || 0), 1000);

  let kickerText = "";
  let titleText = "";
  let descText = "";
  let statBadge = "";
  let pillars = [];
  let domainTagsSet = new Set();

  if (isAll) {
    kickerText = "ALL DESIGN DOMAINS · 12 CATEGORIES";
    titleText = "全部设计门类 · 真实安装量全景榜单";
    descText = "全景聚合 12 大设计专业领域的高信号技能栈，突破传统限制精选 Top 50，严格按公开安装量倒序排列。突出核心关键词与功能侧重点。";
    statBadge = `${topRows.length} 个精选技能（全景 Top 50）`;
    pillars = ["UI 与产品界面", "视觉与品牌传达", "体验与交互架构", "3D 工业空间渲染", "动效与音频体验", "设计工程与设计系统"];
  } else {
    const domainMeta = designDomainFocusMap[domain.id] || { pillars: [], keywords: [] };
    domainTagsSet = new Set((domainMeta.keywords.length ? domainMeta.keywords : domain.tags || []).map((t) => t.toLowerCase()));
    kickerText = esc(text(domain.en).toUpperCase());
    titleText = esc(domain.name);
    descText = esc(domain.description);
    statBadge = `${topRows.length} 个精选技能（突破20限制）`;
    pillars = domainMeta.pillars;
  }

  // Render Domain Intro with Functional Focus Banner & Toolbar
  const introEl = $("#domainIntro");
  if (introEl) {
    introEl.innerHTML = `
      <div class="domainHeaderMain">
        <div class="domainHeaderTitle">
          <div>
            <div class="kicker">${kickerText}</div>
            <h2>${titleText}</h2>
            <p>${descText}</p>
          </div>
          <div class="domainStatsPill">
            <b>${topRows.length}</b>
            <span>${statBadge}</span>
          </div>
        </div>
        <div class="domainFocusBanner">
          <div class="focusBannerLabel">🎯 领域核心功能侧重点：</div>
          <div class="focusPillList">
            ${pillars.map((p) => `<span class="focusPill">✦ ${esc(p)}</span>`).join("")}
          </div>
        </div>
        <div class="designToolbar">
          <div class="designSortTabs">
            <button class="sortTab ${activeDesignSort === "installs" ? "active" : ""}" data-dsort="installs">🔥 按安装量排序 (${topRows.length})</button>
            <button class="sortTab ${activeDesignSort === "score" ? "active" : ""}" data-dsort="score">★ 按综合评分</button>
            <button class="sortTab ${activeDesignSort === "rising" ? "active" : ""}" data-dsort="rising">↗ 飙升指数</button>
          </div>
          <button class="ghost copyDomainAllBtn" id="copyDomainAllBtn">⚡ 复制当前列表安装命令</button>
        </div>
      </div>
    `;
  }

  // Render Rows
  const rankEl = $("#designTop20");
  if (rankEl) {
    rankEl.innerHTML = topRows.map(({ rank, seedScore, skill, domain: skillDomain }) => {
      const isTop3 = rank <= 3;
      let rankBadge = String(rank).padStart(2, "0");
      let rankClass = isTop3 ? "top" : "";
      if (rank === 1) rankBadge = "01 🏆";
      else if (rank === 2) rankBadge = "02 🥈";
      else if (rank === 3) rankBadge = "03 🥉";

      const focusText = getDesignSkillFocus(skill, skillDomain || domain);
      const tags = Array.isArray(skill.tags) ? skill.tags : [];
      const command = skillInstallCommand(skill);
      const url = safeGithubUrl(skill.installUrl || skill.skillsUrl || "");
      const installVal = numeric(skill.installs, 0);
      const installPct = Math.max(3, Math.min(100, Math.round((installVal / maxInstalls) * 100)));

      // Highlight matching keywords with distinct badge
      const tagsHtml = tags.slice(0, 5).map((tag) => {
        const isDomainKeyword = domainTagsSet.has(tag.toLowerCase());
        if (isDomainKeyword) {
          return `<span class="badge tagHighlight">✦ ${esc(tag)}</span>`;
        }
        return `<span class="badge tagNormal">${esc(tag)}</span>`;
      }).join("");

      return `
        <div class="designRankRow" data-s="${attr(skill.id)}">
          <div class="rankNo ${rankClass}"><span class="num">${rankBadge}</span></div>
          <div class="rankMeta">
            <div class="rankNameRow">
              <b>${esc(skill.name)}</b>
              <span class="skillHandle">@${esc(skill.source)}</span>
              <span class="secBadge sec${esc(skill.security || "B")}">${esc(skill.security || "B")}</span>
            </div>
            <div class="skillFocus"><span class="focusTag">🎯 核心侧重</span><span class="focusText">${esc(focusText)}</span></div>
            <div class="rankTags">${tagsHtml}</div>
          </div>
          <div class="installs">
            <div class="installMetric">
              <span class="installCount">🔥 ${fmtN(installVal)}</span>
              <small>安装量</small>
            </div>
            <div class="installMeter"><div class="meterFill" style="width:${installPct}%"></div></div>
          </div>
          <div class="score">
            <div class="scoreVal">${numeric(seedScore)}</div>
            <small>评分</small>
          </div>
          <div class="rankActions">
            ${command ? `<button class="ghost miniBtn copySkillMini" data-copy-install="${attr(command)}" title="复制安装命令" onclick="event.stopPropagation()">⚡ 复制</button>` : ""}
            ${url !== "#" ? `<a href="${attr(url)}" target="_blank" rel="noopener noreferrer" class="ghost miniBtn" title="Inspect source" onclick="event.stopPropagation()">源码 ↗</a>` : ""}
          </div>
        </div>
      `;
    }).join("");
  }

  // Bind domain buttons (filter bar)
  $$("[data-domain]").forEach((button) => {
    button.onclick = () => {
      activeDesignDomain = button.dataset.domain;
      renderDesignRadar();
      button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    };
  });

  // Bind sort buttons
  $$("[data-dsort]").forEach((button) => {
    button.onclick = () => {
      activeDesignSort = button.dataset.dsort;
      renderDesignRadar();
    };
  });

  // Bind copy all commands in list
  const copyAllBtn = $("#copyDomainAllBtn");
  if (copyAllBtn) {
    copyAllBtn.onclick = () => {
      const commands = topRows.map((r) => skillInstallCommand(r.skill)).filter(Boolean);
      if (!commands.length) return toast("当前列表暂无可复制的安装命令");
      const combined = commands.join(" && ");
      copy(combined);
    };
  }

  // Bind single copy buttons
  $$(".copySkillMini").forEach((button) => {
    button.onclick = (e) => {
      e.stopPropagation();
      const cmd = button.getAttribute("data-copy-install");
      if (!cmd) return;
      copy(cmd);
    };
  });

  // Candidates
  let candidates = [];
  if (isAll) {
    candidates = (radarData.discoveries || []).slice(0, 8);
  } else {
    candidates = (radarData.domainRadar?.[domain.id] || []).slice(0, 8);
  }
  const candEl = $("#radarCandidates");
  if (candEl) {
    candEl.innerHTML = candidates.length ? candidates.map((candidate) => `<div class="candidate"><div><a href="${attr(safeGithubUrl(candidate.githubUrl))}" target="_blank" rel="noopener noreferrer"><b>${esc(candidate.name)}</b></a><small>${esc(candidate.source)} · ${esc(candidate.skillPath)}</small></div><span>${fmtN(candidate.repoStars)} ★</span><span class="rise">匹配度 ${numeric(candidate.matchScore)}</span></div>`).join("") : '<div class="empty" style="color:#71767b;padding:24px">该领域今日暂无新候选；精选技能库保持稳定。</div>';
  }

  bindSkills();
}

function search(textValue) {
  q = text(textValue).trim();
  filterCat = "All";
  listMode = "trending";
  show("trending");
  $("#listTitle").textContent = q ? `“${q}” 的搜索结果` : "全部技能";
  $("#listQ").value = q;
  renderList();
}

function renderCapabilityGap(result) {
  if (!result.capability_gap?.detected) return "";
  return `<div class="empty" style="margin-top:12px">${esc(result.capability_gap.reason)}</div>`;
}

function route() {
  const query = $("#task").value.trim();
  if (!query) return toast("请先输入任务描述");
  if (!registrySnapshot) return toast("注册表正在加载中");
  const result = webRouter.match(registrySnapshot, query, 3);
  const matches = result.matches || [];
  const specificity = result.specificity?.enforced ? `<div class="sourceNote">专属性门禁：已锁定信号 [${esc((result.specificity.required_signals || []).join(", "))}]</div>` : "";
  const advisory = result.advisory?.message ? `<div class="sourceNote">安全审查提示：${esc(result.advisory.message)}</div>` : "";
  $("#routeResults").innerHTML = `${specificity}${matches.map((skill, index) => {
    const command = skillInstallCommand(skill);
    const url = sourceUrl(skill);
    const starNote = skill.repoStars ? ` · ★ ${fmtN(skill.repoStars)} Stars` : "";
    const coordinatesGap = !command && !url ? '<div class="actionGap">Install coordinates are not verified for this curated entry yet.</div>' : "";
    return `<div class="match" data-s="${attr(skill.id)}">
      <div class="mnum">${numeric(skill.match_score)}</div>
      <div class="matchBody">
        <div class="matchHeader">
          <h3>${index + 1}. ${esc(skill.name)}</h3>
          <span class="matchCategory">${esc(catLabel(skill.category))}</span>
        </div>
        <p class="matchSummary">${esc(skill.summary)}</p>
        <div class="featureMatrixSection">
          <div class="featureMatrixTitle">核心功能与特性</div>
          ${renderFeatureMatrix(skill)}
        </div>
        <p class="reason">${esc(skill.reason)} · 安全等级 ${esc(skill.security)}${starNote}</p>
        <div class="routeActions">
          <button class="ghost" data-detail-skill="${attr(skill.id)}">查看详情</button>
          ${command ? `<button class="btn" data-copy-install="${attr(command)}">复制安装命令</button>` : ""}
          ${url ? `<a class="ghost actionLink" href="${attr(url)}" target="_blank" rel="noopener noreferrer">查看源码 Inspect source ↗</a>` : ""}
          ${coordinatesGap}
        </div>
      </div>
      <div class="score">${numeric(skill.skillradar_score)}</div>
    </div>`;
  }).join("")}${renderCapabilityGap(result)}${advisory}` || '<div class="empty">未找到符合专属性与安全要求的技能。</div>';
  bindSkillActions();
}

function routeTask(query) {
  const task = text(query).trim();
  if (!task) return toast("请先输入任务描述");
  show("router");
  $("#task").value = task;
  route();
}

function renderCats() {
  const el = $("#catCatalog");
  if (!el) return;
  el.innerHTML = cats.map((category) => `<button class="cat" data-cat="${attr(category)}"><span>${esc(catIcon(category))}</span><b>${esc(catLabel(category))}</b><small>${esc(skills.filter((skill) => skill.category === category).slice(0, 3).map((skill) => skill.name).join(" · "))}</small></button>`).join("");
  bindCats();
}

function renderMine() {
  const rows = skills.filter((skill) => installed.has(skill.id) || favs.has(skill.id));
  const myWfs = (workflowsData.workflows || []).filter((w) => savedWorkflows.has(w.id));

  let wfSection = "";
  if (myWfs.length > 0) {
    wfSection = `<div style="margin-bottom:24px"><div class="head"><h2>我收藏的行业工作流 (${myWfs.length})</h2></div><div class="workflowGrid">${myWfs.map((wf) => {
      const stepsCount = (wf.steps || []).length;
      return `<article class="workflowCard" style="padding:18px"><div class="workflowHead"><div class="workflowMetaRow"><span class="workflowDomain">${esc(wf.domain)}</span><span class="workflowSynergy">协同度 ${numeric(wf.synergyScore)}%</span></div><h3 class="workflowTitle" style="font-size:18px">${esc(wf.name)}</h3><p class="workflowDesc" style="font-size:13px">${esc(wf.description)}</p></div><div class="workflowFoot" style="margin-top:10px;padding-top:10px"><span style="font-size:12px;color:var(--muted)">包含 ${stepsCount} 个执行阶段</span><div class="workflowBtnGroup"><button class="bundleInstallBtn" data-bundle-install="${attr(wf.id)}">⚡ 打包安装</button><button class="exportConfigBtn" data-export-config="${attr(wf.id)}">📥 导出配置</button></div></div></article>`;
    }).join("")}</div></div>`;
  }

  $("#mineList").innerHTML = `${wfSection}${rows.length ? rows.map((skill) => `<div class="row" data-s="${attr(skill.id)}"><div class="identity"><div class="ico">${esc(initials(skill.name))}</div><div><b>${esc(skill.name)}</b><small>${installed.has(skill.id) ? "已标记安装" : "已收藏"}</small></div></div><div class="desc">${esc(skill.summary)}</div><b>${esc(skill.security)}</b><div class="score">${numeric(skill.score)}</div></div>`).join("") : (myWfs.length ? "" : '<div class="mineEmpty"><div class="mineEmptyIcon">◎</div><div class="mineEmptyTitle">工作区暂无内容</div><p class="mineEmptyHint">在技能详情中点击「标记已安装」或「收藏」即可保存到这里，数据存储于本地浏览器。</p></div>')}`;
  bindSkills();
  bindWorkflowActions();
}

let workflowsData = { totalCount: 0, workflows: [] };
let activeWorkflowFilter = "all";
let savedWorkflows = readStoredSet("sr-workflows");

async function copyWorkflowInstall(workflowId) {
  const wfs = workflowsData.workflows || [];
  const wf = wfs.find((w) => w.id === workflowId);
  if (!wf) return toast("未找到该工作流");

  const commands = [];
  for (const step of wf.steps) {
    const targetSkill = skills.find((sk) => sk.id === step.skillId);
    if (targetSkill) {
      const cmd = skillInstallCommand(targetSkill);
      if (cmd && !commands.includes(cmd)) {
        commands.push(cmd);
      }
    }
  }

  if (!commands.length) {
    commands.push(AGENT_INSTALL_COMMAND);
  }

  const compositeCommand = commands.join(" && ");
  await copy(compositeCommand);
  toast(`已打包复制 ${commands.length} 个技能复合安装命令！`);
}

function exportWorkflowConfig(workflowId) {
  const wfs = workflowsData.workflows || [];
  const wf = wfs.find((w) => w.id === workflowId);
  if (!wf) return toast("未找到该工作流配置");

  const exportData = {
    $schema: "https://skillradar.dev/schema/workflow-v1.json",
    id: wf.id,
    name: wf.name,
    domain: wf.domain,
    category: wf.category,
    synergyScore: wf.synergyScore,
    provenance: wf.provenance,
    description: wf.description,
    exportedAt: new Date().toISOString(),
    generator: "SkillRadar Workflow Engine v0.5.0",
    pipeline: wf.steps.map((s) => {
      const targetSkill = skills.find((sk) => sk.id === s.skillId);
      return {
        step: s.step,
        phase: s.phase,
        skillId: s.skillId,
        skillName: s.skillName,
        skillSource: s.skillSource,
        installCommand: targetSkill ? (skillInstallCommand(targetSkill) || `npx skills add changchangidea-oss/SkillRadar --skill ${s.skillId}`) : `npx skills add changchangidea-oss/SkillRadar --skill ${s.skillId}`,
        action: s.action,
        outputContract: s.output
      };
    })
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `skillradar-${wf.id}-workflow.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  toast(`已导出 ${wf.name} 配置文件`);
}

function toggleSaveWorkflow(workflowId) {
  if (savedWorkflows.has(workflowId)) {
    savedWorkflows.delete(workflowId);
    toast("已从我的工作流移除");
  } else {
    savedWorkflows.add(workflowId);
    toast("已保存到我的工作流");
  }
  save();
  renderWorkflows();
}

function bindWorkflowActions() {
  $$("[data-wf-tab]").forEach((btn) => {
    btn.onclick = () => {
      activeWorkflowFilter = btn.dataset.wfTab;
      renderWorkflows();
    };
  });
  $$("[data-bundle-install]").forEach((btn) => {
    btn.onclick = () => copyWorkflowInstall(btn.dataset.bundleInstall);
  });
  $$("[data-export-config]").forEach((btn) => {
    btn.onclick = () => exportWorkflowConfig(btn.dataset.exportConfig);
  });
  $$("[data-save-workflow]").forEach((btn) => {
    btn.onclick = () => toggleSaveWorkflow(btn.dataset.saveWorkflow);
  });
}

function renderWorkflows() {
  const container = $("#packGrid");
  if (!container) return;

  const wfs = workflowsData.workflows || [];
  let filtered = wfs;
  if (activeWorkflowFilter === "quant") {
    filtered = wfs.filter((w) => ["Quantitative Trading", "Stock & Equity"].includes(w.category));
  } else if (activeWorkflowFilter === "content") {
    filtered = wfs.filter((w) => ["Content & Copywriting", "Operations & Growth"].includes(w.category));
  } else if (activeWorkflowFilter === "business") {
    filtered = wfs.filter((w) => ["Competitive Analysis", "Docs & Research", "Automation & Integrations"].includes(w.category));
  } else if (activeWorkflowFilter === "dev") {
    filtered = wfs.filter((w) => ["Frontend", "Data & Database", "Testing & Quality", "Mobile", "Cloud & DevOps", "Design & Media", "AI Agents", "DevOps & Cloud"].includes(w.category));
  } else if (activeWorkflowFilter === "radar") {
    filtered = wfs.filter((w) => w.provenance === "radar-auto-synthesized");
  }

  const avgSynergy = wfs.length ? (wfs.reduce((acc, w) => acc + (w.synergyScore || 95), 0) / wfs.length).toFixed(1) : "96.0";
  const quantCount = wfs.filter((w) => ["Quantitative Trading", "Stock & Equity"].includes(w.category)).length;
  const contentCount = wfs.filter((w) => ["Content & Copywriting", "Operations & Growth"].includes(w.category)).length;
  const businessCount = wfs.filter((w) => ["Competitive Analysis", "Docs & Research", "Automation & Integrations"].includes(w.category)).length;
  const devCount = wfs.filter((w) => ["Frontend", "Data & Database", "Testing & Quality", "Mobile", "Cloud & DevOps", "Design & Media", "AI Agents", "DevOps & Cloud"].includes(w.category)).length;
  const radarCount = wfs.filter((w) => w.provenance === "radar-auto-synthesized").length;

  const tabsHtml = `
    <div class="workflowHero">
      <div class="workflowHeroInfo">
        <div class="kicker" style="color:var(--accent-blue)">● 行业工业级流水线</div>
        <h2>端到端智能场景工作流</h2>
        <p>基于真实业务场景编排的多阶段执行链条。整合从数据接入、模型挖掘、策略回测到动态风控的完整闭环，支持一键打包复合安装命令与智能体配置文件导出。</p>
      </div>
      <div class="workflowStats">
        <div class="workflowStat"><b>${wfs.length}</b><small>已收录流水线</small></div>
        <div class="workflowStat"><b style="color:var(--accent-green)">${avgSynergy}%</b><small>平均协同指数</small></div>
        <div class="workflowStat"><b style="color:var(--accent-blue)">24h</b><small>雷达自驱聚合</small></div>
      </div>
    </div>
    <div class="workflowFilterTabs">
      <button class="wfTab ${activeWorkflowFilter === "all" ? "active" : ""}" data-wf-tab="all">全部流水线 (${wfs.length})</button>
      <button class="wfTab ${activeWorkflowFilter === "quant" ? "active" : ""}" data-wf-tab="quant">⚡ 量化与投研 (${quantCount})</button>
      <button class="wfTab ${activeWorkflowFilter === "content" ? "active" : ""}" data-wf-tab="content">✍️ 内容与运营 (${contentCount})</button>
      <button class="wfTab ${activeWorkflowFilter === "business" ? "active" : ""}" data-wf-tab="business">🔍 商业与办公 (${businessCount})</button>
      <button class="wfTab ${activeWorkflowFilter === "dev" ? "active" : ""}" data-wf-tab="dev">💻 全栈与系统 (${devCount})</button>
      <button class="wfTab ${activeWorkflowFilter === "radar" ? "active" : ""}" data-wf-tab="radar">📡 雷达持续合成 (${radarCount})</button>
    </div>
  `;

  const cardsHtml = filtered.map((wf) => {
    const isSaved = savedWorkflows.has(wf.id);
    const isRadar = wf.provenance === "radar-auto-synthesized";
    const provenanceBadge = isRadar
      ? '<span class="workflowRadarTag">📡 雷达自驱持续合成</span>'
      : '<span class="workflowDomain">🏆 行业黄金流水线</span>';

    const stepsHtml = (wf.steps || []).map((step) => {
      return `<div class="stepNode">
        <div class="stepHeader">
          <span class="stepNum">${step.step}</span>
          <span class="stepPhase">${esc(step.phase)}</span>
        </div>
        <div class="stepSkillTag">
          <span>⚡ ${esc(step.skillName)}</span>
          <small>${esc(step.skillSource)}</small>
        </div>
        <p class="stepAction">${esc(step.action)}</p>
        <div class="stepOutput">📦 产物: ${esc(step.output)}</div>
      </div>`;
    }).join("");

    return `<article class="workflowCard" data-wf-id="${attr(wf.id)}">
      <div class="workflowHead">
        <div>
          <div class="workflowMetaRow">
            ${provenanceBadge}
            <span class="workflowDomain">${esc(wf.domain)}</span>
            <span class="workflowSynergy">协同度 ${numeric(wf.synergyScore)}%</span>
            ${wf.totalStars ? `<span class="badge badgeStar">★ ${fmtN(wf.totalStars)} Stars</span>` : ""}
          </div>
          <h3 class="workflowTitle">${esc(wf.name)}</h3>
          <p class="workflowDesc">${esc(wf.description)}</p>
        </div>
      </div>
      
      <div class="pipelineChain">
        ${stepsHtml}
      </div>

      <div class="workflowFoot">
        <div class="workflowSummaryStats">
          <span><b>${(wf.steps || []).length}</b> 个执行阶段</span>
          <span>·</span>
          <span><b>100%</b> 静态安全审计</span>
        </div>
        <div class="workflowBtnGroup">
          <button class="bundleInstallBtn" data-bundle-install="${attr(wf.id)}" title="一键复制全部技能复合安装命令">
            ⚡ 一键打包安装
          </button>
          <button class="exportConfigBtn" data-export-config="${attr(wf.id)}" title="导出标准智能体工作流配置文件">
            📥 导出配置 JSON
          </button>
          <button class="saveWorkflowBtn" data-save-workflow="${attr(wf.id)}" title="收藏并保存到工作区">
            ${isSaved ? "已保存 ★" : "⭐ 收藏工作流"}
          </button>
        </div>
      </div>
    </article>`;
  }).join("");

  container.innerHTML = `${tabsHtml}<div class="workflowGrid">${cardsHtml || '<div class="empty">未找到匹配的工作流。</div>'}</div>`;
  bindWorkflowActions();
}

function renderPacks() {
  renderWorkflows();
}

function renderDataFreshnessBanner(status) {
  const el = $("#dataFreshness");
  if (!el) return;

  if (!status || !status.lastRunAt) {
    el.style.display = "none";
    return;
  }

  const lastRun = new Date(status.lastRunAt);
  const now = new Date();
  const ageMs = now - lastRun;
  const ageDays = Math.floor(ageMs / 86400000);
  const ageHours = Math.floor(ageMs / 3600000);

  // Format relative time
  let ageLabel;
  if (ageDays === 0) ageLabel = ageHours <= 1 ? "刚刚更新" : `${ageHours} 小时前`;
  else if (ageDays === 1) ageLabel = "昨天";
  else ageLabel = `${ageDays} 天前`;

  // Format absolute date (Beijing time)
  const dateStr = lastRun.toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

  const isStale = ageDays > 2;

  if (isStale) {
    el.className = "dataFreshnessBanner stale";
    el.innerHTML = `<span class="freshnessIcon">⚠</span><span>数据可能未及时更新 · 最后更新 <b>${ageLabel}</b>（${dateStr}，北京时间）· 每日自动刷新，如长期滞后请检查 <a href="https://github.com/changchangidea-oss/SkillRadar/actions" target="_blank" rel="noopener">GitHub Actions</a> 是否正常运行</span>`;
  } else {
    el.className = "dataFreshnessBanner fresh";
    el.innerHTML = `<span class="freshnessIcon">●</span><span>数据已是最新 · <b>${ageLabel}</b>更新（${dateStr}，北京时间）· 每日 10:20 北京时间自动刷新</span><button class="freshnessClose" onclick="this.parentElement.style.display='none'" title="关闭">×</button>`;
    // Auto-hide the "fresh" banner after 6 seconds
    setTimeout(() => { el.style.display = "none"; }, 6000);
  }

  el.style.display = "flex";
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function loadData() {
  try {
    const [snapshot, manifest, domains, radar, workflows, updateStatus] = await Promise.all([
      fetchJson("packages/codex-plugin/data/registry.json"),
      fetchJson("data/design-skill-index.json"),
      fetchJson("data/design-domains.json"),
      fetchJson("data/radar-latest.json"),
      fetchJson("data/workflows.json").catch(() => null),
      fetchJson("data/update-status.json").catch(() => null)
    ]);
    if (!snapshot || ![1, 2].includes(snapshot.schemaVersion)) throw new Error("Unsupported bundled registry schema");
    registrySnapshot = snapshot;
    skills = webRouter.registrySkills(snapshot).map(normalizeDisplaySkill);
    const chunks = await Promise.all((manifest.chunks || []).map((file) => fetchJson(`data/${file}`)));
    designSkills = chunks.flat().map(normalizeDesignSkill);
    designDomains = Array.isArray(domains) ? domains : [];
    radarData = radar || radarData;
    workflowsData = workflows || { totalCount: 0, workflows: [] };
    cats = [...new Set(skills.map((skill) => skill.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    renderHome();
    renderCats();
    renderDesignHome();
    renderDesignRadar();
    renderPacks();
    renderDataFreshnessBanner(updateStatus);
    const initialTask = new URLSearchParams(window.location.search).get('task');
    if (initialTask) routeTask(initialTask);
  } catch (error) {
    console.error("SkillRadar data unavailable", error);
    const featuredEl = $("#featured");
    if (featuredEl) featuredEl.innerHTML = '<div class="empty">注册表数据暂不可用，请刷新重试。</div>';
    const routeEl = $("#routeResults");
    if (routeEl) routeEl.innerHTML = '<div class="empty">路由器注册表暂不可用。</div>';
  } finally {
    const loader = $("#appLoader");
    if (loader) {
      loader.classList.add("hidden");
      setTimeout(() => { loader.style.display = "none"; }, 450);
    }
  }
}

function closeNavigation() {
  document.body.classList.remove("nav-open");
  $("#mobileNav").setAttribute("aria-expanded", "false");
}
function openNavigation() {
  document.body.classList.add("nav-open");
  $("#mobileNav").setAttribute("aria-expanded", "true");
}

function addChineseGuideLinks() {
  const topLink = document.createElement("a");
  topLink.id = "zhGuide";
  topLink.className = "ghost actionLink zhGuideLink";
  topLink.href = "guide.zh-CN.html";
  topLink.lang = "zh-CN";
  topLink.textContent = '中文说明';
  $(".top").insertBefore(topLink, $("#openRouter"));

  const navLink = document.createElement("a");
  navLink.id = "zhGuideNav";
  navLink.href = "guide.zh-CN.html";
  navLink.lang = "zh-CN";
  navLink.textContent = "↗ 使用指南";
  $(".sideFoot").insertBefore(navLink, $(".sideFoot").firstChild);
}

addChineseGuideLinks();
$$("[data-v]").forEach((button) => { button.onclick = () => { show(button.dataset.v); closeNavigation(); }; });
$("#openRouter").onclick = () => show("router");
$('#heroGo').onclick = () => routeTask($("#heroQ").value);
$("#heroQ").onkeydown = (event) => { if (event.key === "Enter") routeTask(event.target.value); };
$("#globalSearch").onkeydown = (event) => { if (event.key === "Enter") search(event.target.value); };
$("#listQ").oninput = (event) => { q = event.target.value; renderList(); };
$("#sort").onchange = (event) => { sort = event.target.value; renderList(); };
$("#routeBtn").onclick = route;
$("#task").onkeydown = (event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") route(); };
$("#close").onclick = () => $("#modalbg").classList.remove("on");
$("#modalbg").onclick = (event) => { if (event.target.id === "modalbg") $("#modalbg").classList.remove("on"); };
$("#clearMine").onclick = () => { installed.clear(); favs.clear(); save(); renderMine(); };
$("#copyAgentInstall").onclick = () => copy(AGENT_INSTALL_COMMAND);
$("#copyCodexInstall").onclick = () => copy(CODEX_INSTALL_COMMAND);
$("#mobileNav").onclick = openNavigation;
$("#mobileClose").onclick = closeNavigation;
$("#navBackdrop").onclick = closeNavigation;
$$("[data-quick-task]").forEach((btn) => {
  btn.onclick = () => routeTask(btn.dataset.quickTask);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeNavigation();
  $("#modalbg").classList.remove("on");
});

loadData();
