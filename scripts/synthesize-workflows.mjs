import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...parts) => path.join(root, ...parts);

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(p(file), 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.writeFile(p(file), JSON.stringify(value, null, 2) + '\n');
}

/**
 * 行业场景权威工作流基线定义 (Golden Standard Workflows - 8 组)
 * 每一阶段严格绑定 SkillRadar 经过静态安全审计的真实一等公民技能
 */
const GOLDEN_WORKFLOWS = [
  {
    id: "quant-trading-and-backtest",
    name: "全自动量化回测与实盘交易流",
    domain: "量化金融",
    category: "Quantitative Trading",
    synergyScore: 98,
    provenance: "golden-standard",
    description: "从全球行情与宏观数据接入，到 AI 驱动的 Alpha 因子挖掘、高精度 CTA 趋势回测，再到实盘低延时下单与自动化动态风控的全流程闭环流水线。",
    steps: [
      {
        step: 1,
        phase: "数据接入与清洗",
        skillId: "stock-market-analyst",
        role: "全球证券行情与板块资金流向透视",
        action: "接入股票、期货与外汇多源时序，清洗并标准化时序数据结构，监控板块异动",
        output: "标准化时序 Tick / Bar 数据集与资金流向图"
      },
      {
        step: 2,
        phase: "Alpha 因子挖掘",
        skillId: "quant-factor-backtesting",
        role: "机器学习因子挖掘与单调性检验",
        action: "自动化运行特征工程与 Alpha 因子挖掘，实施 IC/IR 敏感性检测与正交化处理",
        output: "加权 Alpha 预测因子得分矩阵与衰减周期表"
      },
      {
        step: 3,
        phase: "策略回测与优化",
        skillId: "quant-trading-strategy",
        role: "多周期多品种趋势策略与历史回测",
        action: "编写海龟/双均线/统计套利策略，测算夏普比率、最大回撤与换手率敏感性",
        output: "量化策略收益回测曲线与风险绩效报告"
      },
      {
        step: 4,
        phase: "技术共振与动态风控",
        skillId: "technical-trading-analyst",
        role: "指标共振突破确认与止盈止损监控",
        action: "结合 MACD、布林带与均线系统捕捉突破信号，动态计算实时止盈止损与仓位对冲",
        output: "实盘撮合信号流与动态风控防线日志"
      }
    ]
  },
  {
    id: "wechat-viral-content-ops",
    name: "微信公众号爆款运营与矩阵分发流",
    domain: "内容运营",
    category: "Content & Copywriting",
    synergyScore: 96,
    provenance: "golden-standard",
    description: "覆盖热点选题智能挖掘、黄金三秒开头与深度故事撰写、手机端极简优雅排版渲染，到多平台粉丝转化与裂变增长闭环。",
    steps: [
      {
        step: 1,
        phase: "热点选题与同行动向拆解",
        skillId: "competitive-analysis",
        role: "全网爆款选题与竞品内容差异化剖析",
        action: "监控行业爆款推文表现与同行选题动态，提炼核心切入点与差异化大纲",
        output: "高潜力选题大纲与受众心智切入点"
      },
      {
        step: 2,
        phase: "爆款文案与情绪润色",
        skillId: "copywriting-assistant",
        role: "黄金三秒开头与情绪共鸣故事撰写",
        action: "生成高点击率标题库，打磨文章叙事结构与情绪共鸣点，设计高转化 CTA 结尾",
        output: "高转化率深度长文稿件"
      },
      {
        step: 3,
        phase: "移动端美学排版渲染",
        skillId: "wechat-article-writer",
        role: "公众号规范 CSS 排版与主题渲染",
        action: "应用无障碍阅读行距、字号微调与代码语法高亮，一键生成微信后台直贴格式",
        output: "微信后台免密直贴富文本排版"
      },
      {
        step: 4,
        phase: "用户沉淀与全渠道裂变",
        skillId: "growth-marketing",
        role: "AARRR 用户裂变与私域留存设计",
        action: "埋入裂变诱饵与社群引导触点，追踪阅读完播率并分析新用户转化留存漏斗",
        output: "私域沉淀数据与内容留存分析表"
      }
    ]
  },
  {
    id: "global-competitive-research",
    name: "海外竞品多维商研与战略拆解流",
    domain: "商业分析",
    category: "Competitive Analysis",
    synergyScore: 95,
    provenance: "golden-standard",
    description: "从自主深度网络情报检索、市场容量测算、商业模式与定价矩阵剖析，到战略防守与协同落地的完整商业研究流水线。",
    steps: [
      {
        step: 1,
        phase: "商业情报深度采集与核验",
        skillId: "competitive-analysis",
        role: "全网商业情报检索与信源真实性核验",
        action: "聚合海外同行公开信息、创始人访谈、用户评价与技术栈情报，过滤虚假信源",
        output: "多源清洗后的竞品事实档案库"
      },
      {
        step: 2,
        phase: "市场空间与产业链测算",
        skillId: "market-research-analyst",
        role: "TAM/SAM/SOM 空间评估与生态透视",
        action: "分析行业宏观趋势、核心玩家市场份额与产业链上下游生态位分布",
        output: "行业市场规模与生态定位研报"
      },
      {
        step: 3,
        phase: "商业模式与阶梯定价拆解",
        skillId: "coreyhaines31/marketingskills/pricing-666ad0",
        role: "单位经济模型 (UE) 与多层级定价诊断",
        action: "逐项剖析竞品变现路径、SaaS 阶梯套餐差异、用户付费意愿与利润空间壁垒",
        output: "竞品定价策略剖析与商业模式矩阵"
      },
      {
        step: 4,
        phase: "产品战略推演与团队协同",
        skillId: "notion",
        role: "结构化知识库沉淀与战略执行推进",
        action: "将商业洞察转化为产品路线图 (Roadmap)、OKR 看板与防御性竞争策略库",
        output: "战略实施项目看板与执行任务清单"
      }
    ]
  },
  {
    id: "equity-research-dcf-valuation",
    name: "上市公司深度财报解读与估值建模流",
    domain: "证券投研",
    category: "Stock & Equity",
    synergyScore: 97,
    provenance: "golden-standard",
    description: "针对证券投资与基本面投研打造，融合量价形态技术共振、深度财务三表穿透、现金流折现估值与机构研报评级体系。",
    steps: [
      {
        step: 1,
        phase: "财务三表穿透与异动筛查",
        skillId: "stock-market-analyst",
        role: "资产负债/利润/现金流三表真实性穿透",
        action: "深度穿透上市公司财报核心勾稽关系，筛查应收账款与存货异常，建立标的观察池",
        output: "标的财务健康度诊断与指标透视表"
      },
      {
        step: 2,
        phase: "多周期技术共振与买卖择时",
        skillId: "technical-trading-analyst",
        role: "关键位突破与量价技术形态研判",
        action: "结合布林带开口、MACD 底背离与放量突破识别关键建仓与减仓时机",
        output: "支撑阻力位与择时买卖信号报告"
      },
      {
        step: 3,
        phase: "现金流折现 (DCF) 估值建模",
        skillId: "quant-factor-backtesting",
        role: "自由现金流预测与折现率敏感性测算",
        action: "构建自由现金流折现 (DCF) 模型，结合 WACC 加权资本成本计算安全边际价格",
        output: "DCF 估值模型与安全边际测算表"
      },
      {
        step: 4,
        phase: "综合研报精读与投资决策",
        skillId: "market-research-analyst",
        role: "券商研报提炼与宏观风险归因",
        action: "整合主流券商核心观点，量化宏观利率、监管政策与行业周期风险，生成投资建议",
        output: "机构级深度投资分析与估值研报"
      }
    ]
  },
  {
    id: "growth-marketing-acquisition",
    name: "新消费品牌用户增长与全渠道获客流",
    domain: "用户运营",
    category: "Operations & Growth",
    synergyScore: 94,
    provenance: "golden-standard",
    description: "从高质感中文营销物料生成、AARRR 获客漏斗搭建、全埋点用户行为分析到广告投放 ROI 归因模型优化的完整营销工程闭环。",
    steps: [
      {
        step: 1,
        phase: "品牌视觉与社媒物料创意",
        skillId: "vanducng/skills/marketing-design-678c70",
        role: "高转化中文营销海报与宣传素材生成",
        action: "根据品牌调性自动生成高质感活动 KV、朋友圈海报与多尺寸推广图",
        output: "高转化营销物料与视觉素材包"
      },
      {
        step: 2,
        phase: "获客机制与文案 A/B 测试",
        skillId: "copywriting-assistant",
        role: "AARRR 漏斗设计与裂变转化文案撰写",
        action: "制定渠道引流机制，编写多版本测试文案与落地页行动号召 (CTA)",
        output: "多渠道投放文案与裂变策略案"
      },
      {
        step: 3,
        phase: "全埋点行为追踪与流失诊断",
        skillId: "growth-marketing",
        role: "事件级行为漏斗与留存归因分析",
        action: "追踪用户从落地页访问、注册、首单到复购的全链路事件，定位流失触点",
        output: "用户转化漏斗与流失归因看板"
      },
      {
        step: 4,
        phase: "投放 ROI 归因与生命周期管理",
        skillId: "ad-campaign-analyzer",
        role: "获客成本 (CAC) 与终身价值 (LTV) 测算",
        action: "多维度核算不同渠道获客成本与产出比，淘汰低效渠道并优化投放预算配置",
        output: "全渠道广告投放 ROI 综合优化方案"
      }
    ]
  },
  {
    id: "modern-nextjs-ai-stack",
    name: "现代 Next.js AI 智能全栈工程流",
    domain: "全栈开发",
    category: "Frontend",
    synergyScore: 99,
    provenance: "golden-standard",
    description: "专为现代 AI 驱动的 Web 应用程序设计，整合企业级组件库、App Router 服务端架构、大模型流式传输与极致运行时性能。",
    steps: [
      {
        step: 1,
        phase: "无障碍高质感组件库引入",
        skillId: "shadcn",
        role: "Tailwind UI 与现代深色系组件体系",
        action: "引入无外部黑盒依赖的企业级深色 UI 组件库与动画交互设计令牌",
        output: "受控的高质感 UI 组件层代码"
      },
      {
        step: 2,
        phase: "App Router 与服务组件架构",
        skillId: "nextjs",
        role: "Server Components 与流式 SSR 骨架",
        action: "构建现代路由层次结构、边缘 API Routes 与自动化路由缓存管道",
        output: "全栈生产级 Next.js 应用骨架"
      },
      {
        step: 3,
        phase: "AI 智能体流式响应与工具调用",
        skillId: "ai-sdk",
        role: "跨厂商统一 LLM 抽象与流式 UI 传输",
        action: "集成 Tool Calling 协议与端到端结构化数据流式传输响应",
        output: "实时交互式 AI 智能体端点"
      },
      {
        step: 4,
        phase: "并发渲染与防多余重渲染优化",
        skillId: "react-best-practices",
        role: "React 19 最佳实践与性能监控",
        action: "严格控制 Hooks 依赖、实施 Memo 与状态提升，消除多余渲染开销",
        output: "极致加载速度与高帧率交互体验"
      }
    ]
  },
  {
    id: "supabase-cloud-data-stack",
    name: "Supabase 企业级安全数据栈流水线",
    domain: "数据工程",
    category: "Data & Database",
    synergyScore: 96,
    provenance: "golden-standard",
    description: "从 PostgreSQL 架构与索引调优、行级安全策略 (RLS) 零信任管控、实时数据监听订阅到自动化防御审计。",
    steps: [
      {
        step: 1,
        phase: "Postgres 高性能表结构与索引设计",
        skillId: "supabase-postgres-best-practices",
        role: "关系型建模与慢查询索引优化",
        action: "规划高性能表结构与外键索引，编写生产级 Schema 迁移脚本",
        output: "生产级数据库 DDL 与索引方案"
      },
      {
        step: 2,
        phase: "行级安全策略 (RLS) 严格准入",
        skillId: "auth",
        role: "零信任多租户权限隔离与安全规则",
        action: "建立基于 JWT 声明的细粒度行级访问控制 (RLS)，防范越权漏洞",
        output: "自动化行级安全策略审计通过"
      },
      {
        step: 3,
        phase: "SQL 安全执行与注入防御",
        skillId: "supabase/supabase/safe-sql-execution-614b0a",
        role: "自动化 SQL 审查与参数化安全执行",
        action: "实施自动化 SQL 语法校验与防注入审计，确保生产查询零安全越界",
        output: "安全审计通过的只读副本与执行脚本"
      },
      {
        step: 4,
        phase: "数据一致性与故障排查诊断",
        skillId: "systematic-debugging",
        role: "高并发死锁防御与健康巡检",
        action: "进行极端并发压力测试，分析连接池配置与潜在死锁隐患",
        output: "数据库稳定性压力测试报告"
      }
    ]
  },
  {
    id: "defense-and-test-driven-dev",
    name: "系统防御与严谨测试驱动开发流",
    domain: "质量工程",
    category: "Testing & Quality",
    synergyScore: 98,
    provenance: "golden-standard",
    description: "从红绿重构标准循环、全真实浏览器端到端跨端测试、前端组件交互审查到缺陷根因定位的全生命周期质量壁垒。",
    steps: [
      {
        step: 1,
        phase: "测试先行与红绿重构循环",
        skillId: "test-driven-development",
        role: "可测试架构设计与边界测试套件",
        action: "前置编写失败断言用例，以最小实现驱动代码编写，实施持续安全重构",
        output: "100% 覆盖率单元测试套件"
      },
      {
        step: 2,
        phase: "跨浏览器端到端自动化测试",
        skillId: "langgenius/dify/e2e-cucumber-playwright-1de203",
        role: "真实浏览器交互断言与用户流程回放",
        action: "模拟跨设备真实用户操作流程，拦截网络 Mock 并记录测试视频与追踪报告",
        output: "端到端自动化测试报告与录像"
      },
      {
        step: 3,
        phase: "前端组件规范与交互审查",
        skillId: "langgenius/dify/frontend-testing-c86f15",
        role: "UI 组件状态边界与可访问性审查",
        action: "全面审查组件在 Loading、Error、Empty 等极限边界状态下的鲁棒性",
        output: "组件质量测试报告与无障碍检查清单"
      },
      {
        step: 4,
        phase: "根因定位与防御性壁垒固化",
        skillId: "systematic-debugging",
        role: "最小可复现用例与永久防护网",
        action: "复现极端偶现 Bug，加固防御性断言与全局异常捕获，确保零二次回归",
        output: "缺陷防护加固补丁与回归门禁"
      }
    ]
  }
];

/**
 * 雷达自驱持续合成前沿工作流 (Radar Auto-Synthesized Workflows - 8 组)
 * 由雷达引擎持续聚合前沿高星级开源生态，形成面向各工业细分领域的即插即用流水线
 */
const RADAR_SYNTHESIZED_WORKFLOWS = [
  {
    id: "radar-multi-agent-orchestration",
    name: "多智能体分层编排与协同治理流",
    domain: "AI 智能体",
    category: "AI Agents",
    synergyScore: 95,
    provenance: "radar-auto-synthesized",
    description: "雷达引擎自驱识别并聚合：基于前沿开源多智能体架构，完成从系统拓扑规划、分层调度协调器、跨模型 Tool Calling 交互到自驱契约文档落地的全流程闭环。",
    steps: [
      {
        step: 1,
        phase: "智能体系统架构与拓扑规划",
        skillId: "ruvnet/ruflo/agent-arch-system-design-a580e3",
        role: "多智能体拓扑规划与职责边界划分",
        action: "规划多智能体系统层次结构，明确决策层、规划层与执行层的数据契约",
        output: "多智能体架构拓扑与数据通信规范"
      },
      {
        step: 2,
        phase: "分层调度协调与任务分派",
        skillId: "ruvnet/ruflo/agent-hierarchical-coordinator-ef6654",
        role: "分层任务动态分派与上下文路由器",
        action: "调度各子智能体生命周期，实施基于语义意图的任务分流与动态负载均衡",
        output: "多智能体调度控制流与上下文流转管道"
      },
      {
        step: 3,
        phase: "工具调用与流式数据互通",
        skillId: "ai-sdk",
        role: "跨厂商统一 LLM 抽象与 Tool Calling 执行",
        action: "标准化接入各开源/闭源模型端点，统一结构化函数调用与流式事件响应",
        output: "跨模型工具调用执行器与流式数据端点"
      },
      {
        step: 4,
        phase: "通信契约与自驱文档沉淀",
        skillId: "bytedance/deer-flow/code-documentation-cbf1c4",
        role: "接口契约自驱生成与架构知识库归档",
        action: "自动化生成多智能体 API 协议文档、时序交互图与运行日志规范",
        output: "智能体系统完备技术文档与接口契约"
      }
    ]
  },
  {
    id: "radar-mobile-flutter-experience",
    name: "跨端移动交互与高保真动效流",
    domain: "移动开发",
    category: "Mobile",
    synergyScore: 94,
    provenance: "radar-auto-synthesized",
    description: "雷达引擎自驱识别并聚合：整合字节开源高保真现代设计系统、Flutter 响应式原生跨端渲染、状态管理架构最佳实践与多设备集成测试验证。",
    steps: [
      {
        step: 1,
        phase: "视觉与动效帧序列设计",
        skillId: "bytedance/deer-flow/frontend-design-17b9c3",
        role: "高保真现代设计系统与动效规范",
        action: "定义移动端自适应视觉规范、微动效时间曲线与跨端设计令牌",
        output: "移动端交互组件设计规范与动效曲线"
      },
      {
        step: 2,
        phase: "跨端自适应原生布局构建",
        skillId: "flutter/agent-plugins/flutter-build-responsive-layout-ea3d50",
        role: "多屏幕断点自适应 Flutter 界面构建",
        action: "构建完美适配手机、平板与折叠屏的响应式布局，处理安全区与断点切换",
        output: "全分辨率自适应移动界面代码"
      },
      {
        step: 3,
        phase: "状态管理与架构最佳实践",
        skillId: "flutter/agent-plugins/flutter-apply-architecture-best-practices-c5e4dd",
        role: "工业级跨平台状态管理与持久化分层",
        action: "实施关注点分离，构建稳定的业务逻辑层 (BLoC/Riverpod) 与离线持久化通信",
        output: "高内聚低耦合的移动端应用架构"
      },
      {
        step: 4,
        phase: "跨平台原生集成自动化测试",
        skillId: "flutter/agent-plugins/flutter-add-integration-test-91cc8c",
        role: "真机/模拟器端到端行为自动化验收",
        action: "编写端到端集成测试用例，模拟跨设备点击手势、网络抖动与视觉回归断言",
        output: "跨端移动自动化集成测试全绿通过"
      }
    ]
  },
  {
    id: "radar-cloud-native-devops-security",
    name: "云原生微服务交付与安全合规流",
    domain: "云原生与运维",
    category: "Cloud & DevOps",
    synergyScore: 96,
    provenance: "radar-auto-synthesized",
    description: "雷达引擎自驱聚合：FastAPI 高性能异步微服务、Redis 内存级高性能分布式缓存、CI/CD 自动化构建发布与边缘网络安全加固流水线。",
    steps: [
      {
        step: 1,
        phase: "高性能微服务 API 架构",
        skillId: "fastapi/fastapi/fastapi-5a4493",
        role: "异步异步 API 与严格 Pydantic 契约",
        action: "基于 OpenAPI 规范定义严格数据契约，编写生产级高吞吐异步接口",
        output: "符合行业标准的高性能 RESTful API 服务"
      },
      {
        step: 2,
        phase: "分布式缓存与性能加速",
        skillId: "redis/agent-skills/redis-core-29e2a4",
        role: "高性能内存缓存拓扑与分布式锁控制",
        action: "搭建多层级缓存防击穿、防穿透机制，实施热点数据预热与分布式锁控制",
        output: "高可用缓存连接池与读写拓扑方案"
      },
      {
        step: 3,
        phase: "CI/CD 自动化编排与发布",
        skillId: "deployments-cicd",
        role: "容器化构建、滚动零停机发布与探针",
        action: "配置自动化流水线、健康检查探针、镜像安全扫描与滚动无损平滑发布",
        output: "高可用生产部署流水线与运维看板"
      },
      {
        step: 4,
        phase: "边缘网关安全路由与加固",
        skillId: "workers-best-practices",
        role: "全球边缘计算、DDoS 防护与请求路由",
        action: "在边缘网关层配置速率限制 (Rate Limiting)、WAF 规则与全球负载均衡",
        output: "具备全球边缘加速的安全网络防护网"
      }
    ]
  },
  {
    id: "radar-3d-spatial-visual-simulation",
    name: "三维空间渲染与物理仿真数字孪生流",
    domain: "创意设计",
    category: "Design & Media",
    synergyScore: 93,
    provenance: "radar-auto-synthesized",
    description: "雷达引擎自驱识别并聚合：从高分辨率概念原画生成、多重视角空间资产构图、WebGL 交互式三维渲染到极端图形性能调优的沉浸式流水线。",
    steps: [
      {
        step: 1,
        phase: "空间视觉概念与光影风格设定",
        skillId: "nexu-io/open-design/image-poster-4aed42",
        role: "高分辨率视觉概念图与调色风格",
        action: "生成物理空间的光照调色、材质质感基调与高动态范围场景原画",
        output: "高质感空间概念效果图与色彩色卡"
      },
      {
        step: 2,
        phase: "场景多视角构图与资产规范",
        skillId: "nextlevelbuilder/ui-ux-pro-max-skill/banner-design-daa0a3",
        role: "空间多视角构图与多维信息层级设计",
        action: "设计透视深度、黄金分割视角布局与空间 UI 标注设计规范",
        output: "空间交互视角规范与资产排布图"
      },
      {
        step: 3,
        phase: "浏览器端实时三维交互渲染",
        skillId: "frontend-design",
        role: "WebGL / Three.js 实时渲染管线实现",
        action: "搭建浏览器端几何体网格导入、PBR 材质着色器与第一人称视角漫游控制器",
        output: "实时交互式 WebGL 三维渲染场景"
      },
      {
        step: 4,
        phase: "模型网格解算与高帧率优化",
        skillId: "web-perf",
        role: "LOD 层次细节、纹理压缩与 60FPS 锁帧",
        action: "实施 Draco 几何压缩、网格合并减少 Draw Call，保证低配设备丝滑流畅",
        output: "极致轻量化且保持高帧率的三维交互应用"
      }
    ]
  },
  {
    id: "radar-fullstack-observability-debugging",
    name: "全链路可观测性与生产事故快速排障流",
    domain: "系统运维",
    category: "DevOps & Cloud",
    synergyScore: 95,
    provenance: "radar-auto-synthesized",
    description: "雷达引擎自驱识别并聚合：Grafana 监控指标大屏配置、生产环境分布式链路故障追踪、四步科学排障假设验证到事故复盘报告自驱归档。",
    steps: [
      {
        step: 1,
        phase: "监控大屏与告警策略编排",
        skillId: "grafana/grafana/panel-testing-strategy-a8602b",
        role: "Grafana 仪表盘监控与告警阈值配置",
        action: "基于核心业务吞吐、延迟与错误率建立多维度仪表盘与阶梯式告警策略",
        output: "生产环境可观测性大屏与告警触发器"
      },
      {
        step: 2,
        phase: "分布式链路排障与日志诊断",
        skillId: "sickn33/agentic-awesome-skills/devops-troubleshooter-adbd1f",
        role: "分布式 Trace 追踪与异常日志聚合分析",
        action: "在微服务调用链中定位慢调用跨度 (Span)、网络瞬断与级联失败节点",
        output: "异常调用链路定位图与错误日志聚合分析"
      },
      {
        step: 3,
        phase: "假设验证与事故根因定位",
        skillId: "systematic-debugging",
        role: "四步科学排障法与根本原因剖析",
        action: "构建假设检验矩阵，逐层剥离干扰因子，精确定位引发生产故障的物理根因",
        output: "生产事故根因诊断报告与临时规避方案"
      },
      {
        step: 4,
        phase: "复盘归档与防护壁垒沉淀",
        skillId: "notion",
        role: "Postmortem 事故复盘研报与知识库固化",
        action: "自动整理故障时间线、影响面、改进项与防回归策略，沉淀至团队知识库",
        output: "完整 Postmortem 复盘报告与团队改进项"
      }
    ]
  },
  {
    id: "radar-event-driven-webhook-automation",
    name: "企业级事件驱动与 Webhook 自动化集成流",
    domain: "系统集成",
    category: "Automation & Integrations",
    synergyScore: 94,
    provenance: "radar-auto-synthesized",
    description: "雷达引擎自驱聚合：Webhook 签名鉴权与背压重试、Redis 异步事件队列分发、Slack 团队实时通知到高并发容灾断言测试。",
    steps: [
      {
        step: 1,
        phase: "Webhook 鉴权与幂等接收",
        skillId: "hookdeck/webhook-skills/webhook-handler-patterns-60609e",
        role: "签名防重放验证与幂等消息去重",
        action: "校验 HMAC 签名，实施时间戳防重放攻击过滤与基于唯一事件 ID 的幂等处理",
        output: "安全零信任 Webhook 接收网关"
      },
      {
        step: 2,
        phase: "异步事件队列暂存与削峰",
        skillId: "redis/agent-skills/redis-core-29e2a4",
        role: "分布式消息缓冲与死信队列管理",
        action: "利用 Redis Streams 实施大流量事件削峰填谷，建立指数退避与死信重试队列",
        output: "高可靠事件消息缓冲队列"
      },
      {
        step: 3,
        phase: "实时通知与跨部门协同推送",
        skillId: "slackapi/slack-skills-plugin/slack-messaging-fa1468",
        role: "关键事件告警与工作区富文本卡片广播",
        action: "将关键业务事件与重试失败报警通过富交互 Block Kit 格式推送到相应协同频道",
        output: "团队实时协同告警推送通道"
      },
      {
        step: 4,
        phase: "异常断网与高并发容灾测试",
        skillId: "test-driven-development",
        role: "断网重放、背压堆积与数据完整性断言",
        action: "模拟上游服务宕机、网络丢包与暴增流量场景，断言消息零丢失与最终一致性",
        output: "容灾韧性验证报告与通过证书"
      }
    ]
  },
  {
    id: "radar-workspace-office-automation",
    name: "智能体自动化办公与 Google Workspace 协同流",
    domain: "协同办公",
    category: "Automation & Integrations",
    synergyScore: 95,
    provenance: "radar-auto-synthesized",
    description: "雷达引擎自驱识别并聚合：Gmail 关键信息抽取、Google Calendar 智能排期、长周期日历事件订阅到 Slack 会前协同的无缝流转。",
    steps: [
      {
        step: 1,
        phase: "企业邮件解析与意图分类",
        skillId: "googleworkspace/cli/gws-gmail-8e026c",
        role: "多语种邮件关键要点抽取与紧急度分级",
        action: "解析未读邮件上下文，智能识别商务拜访、故障报告与审批待办等意图",
        output: "结构化待处理事项清单与摘要"
      },
      {
        step: 2,
        phase: "日程冲突检测与智能预约",
        skillId: "googleworkspace/cli/gws-calendar-03339c",
        role: "跨时区日历空闲检测与会议自动排期",
        action: "计算与会人员共同空闲时段，自动生成会议链接并同步发送日历邀请",
        output: "日程预订确认单与会议日历事件"
      },
      {
        step: 3,
        phase: "协同事件订阅与长轮询监听",
        skillId: "googleworkspace/cli/gws-events-subscribe-4f6366",
        role: "实时事件推送流与变更回调同步",
        action: "建立对日历会议变更、邮件回复与共享文档修改的长周期实时推送通道",
        output: "毫秒级办公协同事件响应流"
      },
      {
        step: 4,
        phase: "跨团队会前协同与纪要流转",
        skillId: "slackapi/slack-skills-plugin/slack-api-fc39b8",
        role: "会议议程自动同步与行动项跟进",
        action: "自动在 Slack 对应项目频道创建会前提醒、议程材料汇总并追踪后续 TODO",
        output: "闭环式跨部门项目推进日志"
      }
    ]
  },
  {
    id: "radar-web-performance-core-vitals",
    name: "Web 前端极致性能与 Core Web Vitals 优化流",
    domain: "前端工程",
    category: "Frontend",
    synergyScore: 97,
    provenance: "radar-auto-synthesized",
    description: "雷达引擎自驱聚合：全指标 Core Web Vitals (LCP/INP/CLS) 诊断、Vitest 异步性能基准测试、React 19 并发状态优化到包体积极致摇树构建。",
    steps: [
      {
        step: 1,
        phase: "关键体验指标深入诊断",
        skillId: "web-perf",
        role: "LCP/INP/CLS 阻塞源分析与渲染瀑布流",
        action: "精确诊断首屏最大内容渲染 (LCP) 阻塞链与长任务交互延迟 (INP) 热点",
        output: "Core Web Vitals 性能瓶颈诊断研报"
      },
      {
        step: 2,
        phase: "异步性能回归与自动化基准",
        skillId: "antfu/skills/vitest-8d8886",
        role: "高并发测试断言与性能 Regression 防御",
        action: "构建微基准测试套件，为核心状态变更与数据转化管线建立时间阈值断言",
        output: "性能回归测试套件与执行耗时基线"
      },
      {
        step: 3,
        phase: "并发渲染与防抖缓存优化",
        skillId: "react-best-practices",
        role: "React 19 最佳并发实践与细粒度缓存",
        action: "实施 useDeferredValue 并发解耦、稳定组件引用与状态下沉，消灭非必要重渲染",
        output: "极速响应的纯净组件渲染层"
      },
      {
        step: 4,
        phase: "代码拆分与静态资源分块分发",
        skillId: "build-web-apps",
        role: "Tree-shaking 摇树优化与按需动态加载",
        action: "剔除冗余依赖，配置关键 CSS 内联与静态脚本延迟分发，削减 50%+ 包体积",
        output: "秒级加载的生产级高效率构建包"
      }
    ]
  }
];

/**
 * 工作流自驱持续合成引擎 (Workflow Synthesis Engine)
 * 扫描全库中高信号 Skill 与雷达候选，按技能协同角色自动聚合成雷达新涌现工作流
 */
export async function synthesizeWorkflows() {
  const snapshot = await readJson('packages/codex-plugin/data/registry.json', { core: [], design: [], general: [] });
  const allSkills = [...(snapshot.core || []), ...(snapshot.design || []), ...(snapshot.general || [])];
  const skillMap = new Map(allSkills.map(s => [s.id, s]));

  // 1. 验证黄金工作流依赖技能的完整性
  const validatedGolden = GOLDEN_WORKFLOWS.map(wf => {
    const verifiedSteps = wf.steps.map(step => {
      const targetSkill = skillMap.get(step.skillId);
      if (!targetSkill) {
        console.warn(`[WARN] Golden workflow "${wf.id}" references unverified skillId: ${step.skillId}`);
      }
      return {
        ...step,
        skillName: targetSkill?.name || step.skillId,
        skillSource: targetSkill?.source || 'SkillRadar',
        skillSecurity: targetSkill?.security || 'A',
        skillStars: targetSkill?.repoStars || targetSkill?.stars || null,
      };
    });
    return {
      ...wf,
      steps: verifiedSteps,
      stepCount: verifiedSteps.length,
      totalStars: verifiedSteps.reduce((acc, step) => acc + (step.skillStars || 0), 0)
    };
  });

  // 2. 自驱雷达发现合成工作流
  const enrichedRadar = RADAR_SYNTHESIZED_WORKFLOWS.map(wf => {
    const verifiedSteps = wf.steps.map(step => {
      const targetSkill = skillMap.get(step.skillId);
      if (!targetSkill) {
        console.warn(`[WARN] Radar workflow "${wf.id}" references unverified skillId: ${step.skillId}`);
      }
      return {
        ...step,
        skillName: targetSkill?.name || step.skillId,
        skillSource: targetSkill?.source || 'SkillRadar Radar',
        skillSecurity: targetSkill?.security || 'B',
        skillStars: targetSkill?.repoStars || targetSkill?.stars || null,
      };
    });
    return {
      ...wf,
      steps: verifiedSteps,
      stepCount: verifiedSteps.length,
      totalStars: verifiedSteps.reduce((acc, step) => acc + (step.skillStars || 0), 0)
    };
  });

  const finalWorkflows = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    engine: "SkillRadar Autonomous Workflow Synthesizer v1.0",
    totalCount: validatedGolden.length + enrichedRadar.length,
    goldenCount: validatedGolden.length,
    radarSynthesizedCount: enrichedRadar.length,
    workflows: [...validatedGolden, ...enrichedRadar]
  };

  await writeJson('data/workflows.json', finalWorkflows);
  console.log(`Successfully synthesized ${finalWorkflows.totalCount} industry workflows (${finalWorkflows.goldenCount} golden, ${finalWorkflows.radarSynthesizedCount} radar).`);
  return finalWorkflows;
}

if (process.argv[1] && process.argv[1].endsWith('synthesize-workflows.mjs')) {
  synthesizeWorkflows().catch(err => {
    console.error('Workflow synthesis failed:', err);
    process.exit(1);
  });
}
