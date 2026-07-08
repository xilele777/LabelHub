# LabelHub

<div align="center">

**面向标注团队的 B 端数据标注协作平台**

覆盖「模板定义 → 任务创建 → 数据分配 → 标注执行 → AI 规则预审 → 人工审核 → 归档导出」的完整闭环

[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-003B57?logo=sqlite)](https://sqlite.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

</div>

---

## 目录

- [项目简介](#项目简介)
- [技术栈](#技术栈)
- [性能与工程亮点](#性能与工程亮点)
- [功能模块](#功能模块)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [默认账号](#默认账号)
- [更多文档](#更多文档)

## 项目简介

LabelHub 是面向标注团队的 B 端数据标注协作平台，帮助团队把标注过程**标准化、可追踪、可审核**，并通过规则化预审降低人工审核压力。

### 目标用户

| 角色       | 核心职责                           | 主要功能                                         |
| ---------- | ---------------------------------- | ------------------------------------------------ |
| **负责人** | 创建任务、分配人员、追踪进度与质量 | 模板管理、任务管理、分配、统计、监控、通知、导出 |
| **标注员** | 高效完成数据标注                   | 标注工作台、领取任务、草稿保存、提交、驳回重提   |
| **审核员** | 审核标注结果并完成闭环             | 审核工作台、AI 预审参考、通过 / 驳回、审核时间线 |

### 核心价值

- **流程闭环** — 从模板到导出全链路覆盖，减少线下表格和口头流转
- **质量前置** — 标注提交后自动触发规则预审，提前暴露缺失、异常和低质量风险
- **角色协作** — 负责人、标注员、审核员职责清晰，权限隔离
- **过程可追踪** — 数据状态、分配、锁、审核、通知和归档均有明确记录
- **轻量可落地** — Vue + Express + SQLite，适合演示、小团队和内网部署

## 技术栈

| 层级      | 技术                                                             |
| --------- | ---------------------------------------------------------------- |
| 前端框架  | Vue 3 + TypeScript                                               |
| UI 组件库 | Ant Design Vue 4（unplugin 按需引入）                            |
| 状态管理  | Pinia                                                            |
| 路由      | Vue Router 4（全路由懒加载）                                     |
| 图表      | ECharts（echarts/core 按需注册）                                 |
| 拖拽      | vue-draggable-plus                                               |
| 构建工具  | Vite 6                                                           |
| 测试      | Vitest（前端单测）+ 后端 E2E                                     |
| 前端监控  | web-vitals + sendBeacon 上报 + 可视化看板                        |
| 后端框架  | Express 4                                                        |
| 数据库    | SQLite（better-sqlite3），可切换 PostgreSQL                      |
| 缓存/扩展 | Redis（可选：缓存、分布式限流、Socket.IO adapter，缺省优雅降级） |
| 认证      | HMAC-SHA256 签名 Token（httpOnly Cookie）+ scrypt 密码哈希       |
| 实时通信  | Socket.IO（用户 / 角色 / 任务三级房间）                          |

## 性能与工程亮点

> 完整的优化过程、方案对比与实测数据见本地 [docs/DOC.md](docs/DOC.md#7-性能优化实录)（不入库）。

- **首屏体积 -81%**：组件库按需引入 + 分包策略重设计，入口预加载 JS 从 ~1.69 MB（gzip ~520 kB）降至 ~313 kB（gzip ~113 kB）
- **万级列表双方案**：任务列表服务端分页 + 审核列表手写虚拟滚动（变高行、前缀和 + 二分查找定位）
- **双重并发控制**：悲观编辑锁（自动加锁/释放、30 分钟超时兜底、423 冲突提示）+ 乐观版本锁（409 冲突返回服务端最新数据）
- **前端监控闭环**：全局错误边界 + Core Web Vitals 采集 → sendBeacon 上报 → 落库 → p75 聚合可视化
- **数据不丢失**：标注草稿防抖持久化到本地，切回时按服务端版本校验后自动恢复
- **Web Worker 导出**：JSON/CSV 序列化移出主线程，大数据量导出不卡顿，Worker 异常自动降级
- **请求层设计**：在途 GET 去重、幂等请求自动重试（指数退避 + 抖动）、取消安全
- **工程化链路**：ESLint + Prettier + husky + lint-staged + Vitest + GitHub Actions CI（lint / typecheck / test / build 四阶段）+ Docker 两阶段构建 + PM2 cluster

## 功能模块

> 各模块的字段类型、状态流转表、数据模型与完整 API 表见本地 [docs/DOC.md](docs/DOC.md)（不入库）。

### 🏠 仪表盘

按角色展示不同指标：待处理数、通过数、驳回数、通过率等。同时展示任务概览、标注进度、AI 预审风险和数据状态分布。

### 📋 模板管理

三栏拖拽式构建器（组件面板 → 画布 → 属性面板），归一化状态存储 + `shallowRef`/`markRaw` 响应式调优。支持 Input / Textarea / Radio / Checkbox / Select / Rating / Switch / Title 八种字段，支持预览、Schema 导入导出、复制 JSON。

### 📦 任务管理

任务配置（名称、类型、绑定模板、时间窗口、逾期策略），四种任务类型，按量均分 / 手动指定 / 领取三种分配方式。状态流转：草稿 → 待发布 → 进行中 → 已完成 / 已结束。列表采用服务端分页 + 防抖筛选，keep-alive 缓存筛选与页码状态。

### ✏️ 标注工作台

左侧原始数据 + 中间动态标注表单 + 右侧 AI 实时预审。草稿保存、提交、驳回重提、领取更多。**并发控制**：悲观编辑锁（进入自动加锁、切换/提交/离开自动释放、30 分钟超时兜底）+ 乐观版本锁双重保障；**草稿自动保存**：防抖写入本地，误关页面/断网后按版本校验自动恢复。

### 🔍 审核工作台

审核列表（按状态、任务、标注员、AI 预审结论、关键词筛选），**手写虚拟滚动**（变高行、前缀和 + 二分查找定位）支撑大数据量流畅浏览。原始数据 + 标注结果 + AI 预审结果三栏对比，通过 / 驳回操作（驳回必填原因），连续领取模式，**审核回避**（审核员不能审核自己提交的数据）。

### 🤖 AI 规则预审

基于规则引擎的自动预审（不依赖大模型 API），前后端双重实现：前端实时预览（独立 composable）+ 后端可信执行（防篡改）。内置 6 条规则（必填缺失、评分超限、文本过短、分类为空、其他类风险、评分偏低），结论分级 PASS / RISK / FAIL，附带质量评分、摘要、命中规则和优化建议。规则表与评分算法详见本地 [docs/DOC.md](docs/DOC.md#37-ai-预审引擎)（不入库）。

### 📈 性能监控

生产环境采集真实用户 Core Web Vitals（LCP / INP / CLS / FCP / TTFB），sendBeacon 无阻塞上报 → 服务端落库（容量自动修剪）→ 管理端可视化（各指标 p75 统计卡、按天趋势、rating 分布，附表格视图）。

### 🔔 实时通知

基于 Socket.IO 的实时推送（先落库后推送，离线可补拉）。通知类型覆盖审核通过/驳回、任务分配/提交/重提、即将逾期、负责人手动通知；房间策略分用户 / 角色 / 任务三级（订阅需服务端权限校验）。

### 📊 统计看板 · 📤 数据导出 · 👥 用户管理 · 📁 任务归档

- **统计看板**：标注员提交量排行、审核通过率仪表盘、数据状态分布、AI 预审风险分布
- **数据导出**：JSON / CSV，可按任务/状态筛选，**序列化在 Web Worker 中执行**不阻塞页面交互（Worker 异常自动降级）
- **用户管理**：用户列表、创建用户并指定角色、编辑、删除
- **任务归档**：审核通过后自动归档，所有角色可查看，负责人可取消归档

## 项目结构

```
LabelHub/
├── src/                          # 前端源码
│   ├── api/                      # API 请求封装（去重 / 重试 / 取消安全）
│   ├── components/               # 通用组件
│   ├── composables/              # 通用组合式函数
│   │   ├── useDebounced.ts       #   防抖镜像值
│   │   ├── useVirtualList.ts     #   虚拟滚动（变高行 / 前缀和 + 二分）
│   │   └── useDraftPersistence.ts#   本地草稿自动保存与版本校验恢复
│   ├── layouts/                  # 布局组件（keep-alive 白名单在此）
│   ├── pages/                    # 页面组件
│   │   ├── Dashboard/            # 仪表盘
│   │   ├── TemplateBuilder/      # 模板构建器
│   │   ├── TemplateManage/       # 模板管理
│   │   ├── TaskForm/             # 任务创建 / 编辑
│   │   ├── TaskList/             # 任务列表（服务端分页）
│   │   ├── TaskDetail/           # 任务详情
│   │   ├── AnnotationWorkbench/  # 标注工作台
│   │   │   ├── composables/      #   useEditLock / useLivePreReview
│   │   │   └── fieldHelpers.ts   #   字段纯函数
│   │   ├── ReviewWorkbench/      # 审核工作台
│   │   │   ├── components/       #   领取 / 流转 / 驳回 Modal 子组件
│   │   │   └── composables/      #   useReviewFilters / useReviewClaimPool
│   │   ├── MonitoringBoard/      # 性能监控看板（ECharts）
│   │   ├── StatisticsBoard/      # 统计看板
│   │   ├── DataExport/           # 数据导出
│   │   ├── UserManage/           # 用户管理
│   │   ├── TaskArchive/          # 任务归档
│   │   ├── NotificationManage/   # 通知管理
│   │   ├── NotificationPublish/  # 通知发布
│   │   ├── Login/                # 登录
│   │   └── Exception/            # 异常页面
│   ├── router/                   # 路由配置（懒加载 + 角色守卫）
│   ├── services/                 # 业务服务（Socket 客户端、web-vitals 采集）
│   ├── store/                    # Pinia 状态管理
│   ├── types/                    # TypeScript 类型定义（含状态机）
│   ├── utils/                    # 工具函数
│   └── workers/                  # Web Worker（导出序列化）
├── server/                       # 后端源码
│   ├── middleware/               # 中间件（auth、response、限流、安全头等）
│   ├── routes/                   # 路由（REST + crudFactory 通用 CRUD）
│   ├── services/                 # 业务服务（通知、AI 预审引擎、时效提醒）
│   ├── store/                    # 数据层（SQLite / PostgreSQL 双后端）
│   ├── constants/                # 状态机等常量
│   ├── utils/                    # 工具（logger、redis、password 等）
│   ├── index.js                  # 服务入口
│   └── seed.js                   # 数据初始化脚本
├── docs/                         # 工程文档（gitignore，不入库：DOC.md + personal/）
│   ├── DOC.md                    # 产品 / API / 数据模型 / 性能优化 / 版本日志（单一文档）
│   └── personal/                 # 面试复盘 + 简历稿
├── .github/workflows/            # CI（lint / typecheck / test / build）
├── Dockerfile                    # 两阶段构建
├── docker-compose.yml            # PostgreSQL + Redis 基础设施
├── ecosystem.config.js           # PM2 cluster 配置
└── vite.config.ts                # Vite 配置（按需引入 / 分包 / bundle 分析）
```

## 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9

### 1. 克隆项目

```bash
git clone <repo-url>
cd LabelHub
```

### 2. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd server
npm install
cd ..
```

### 3. 启动后端

```bash
cd server
npm start
```

后端服务运行在 `http://localhost:3001`。首次启动时会自动执行 `seed.js` 创建示例数据。

### 4. 启动前端

```bash
# 在项目根目录
npm run dev
```

前端开发服务器运行在 `http://localhost:3000`，自动代理 API 请求到后端。

### 5. 运行测试与构建

```bash
npm test              # 前端单元测试（Vitest）
npm run test:coverage # 覆盖率报告
npm run test:e2e      # 后端 E2E 测试
npm run build         # 生产构建（tsc 类型检查 + Vite，产出 dist/stats.html 体积分析）
```

### 6. 重置数据

如需重置到初始状态，删除数据库文件后重启：

```bash
# Windows
del server\data\labelhub.db
cd server && npm start

# macOS / Linux
rm server/data/labelhub.db
cd server && npm start
```

## 默认账号

> 首次启动 seed 后可用以下测试账号登录：

| 角色   | 用户名 | 密码  |
| ------ | ------ | ----- |
| 负责人 | `o`    | `123` |
| 标注员 | `a`    | `123` |
| 审核员 | `r`    | `123` |

所有接口统一返回 `{ code, message, data }`，并提供 `/api/docs`（Swagger）、`/api/metrics`（Prometheus）、`/api/health`（健康检查）。

## 更多文档

> 完整文档（产品 / API / 数据模型 / 性能优化实录 / 优化清单 / 版本日志）见本地 **`docs/DOC.md`**，未纳入版本控制，需在本地仓库查看。面试复盘与简历稿亦在本地 `docs/personal/`。

- [docs/DOC.md](docs/DOC.md) — 本地完整文档（不入库）
- [server/README.md](server/README.md) — 后端说明

## License

MIT
