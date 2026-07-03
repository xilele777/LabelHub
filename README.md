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
- [功能模块](#功能模块)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [默认账号](#默认账号)
- [API 概览](#api-概览)

## 项目简介

LabelHub 是面向标注团队的 B 端数据标注协作平台，帮助团队把标注过程**标准化、可追踪、可审核**，并通过规则化 AI 预审降低人工审核压力。

### 目标用户

| 角色       | 核心职责                           | 主要功能                                         |
| ---------- | ---------------------------------- | ------------------------------------------------ |
| **负责人** | 创建任务、分配人员、追踪进度与质量 | 模板管理、任务管理、分配、统计、通知、导出       |
| **标注员** | 高效完成数据标注                   | 标注工作台、领取任务、草稿保存、提交、驳回重提   |
| **审核员** | 审核标注结果并完成闭环             | 审核工作台、AI 预审参考、通过 / 驳回、审核时间线 |

### 核心价值

- **流程闭环** — 从模板到导出全链路覆盖，减少线下表格和口头流转
- **质量前置** — 标注提交后自动触发规则预审，提前暴露缺失、异常和低质量风险
- **角色协作** — 负责人、标注员、审核员职责清晰，权限隔离
- **过程可追踪** — 数据状态、分配、锁、审核、通知和归档均有明确记录
- **轻量可落地** — Vue + Express + SQLite，适合演示、小团队和内网部署

## 技术栈

| 层级      | 技术                     |
| --------- | ------------------------ |
| 前端框架  | Vue 3 + TypeScript       |
| UI 组件库 | Ant Design Vue 4         |
| 状态管理  | Pinia                    |
| 路由      | Vue Router 4             |
| 图表      | ECharts                  |
| 拖拽      | vue-draggable-plus       |
| 构建工具  | Vite 6                   |
| 后端框架  | Express 4                |
| 数据库    | SQLite（better-sqlite3） |
| 认证      | JWT                      |
| 实时通信  | Socket.IO                |

## 功能模块

### 🏠 仪表盘

按角色展示不同指标：待处理数、通过数、驳回数、通过率等。同时展示任务概览、标注进度、AI 预审风险和数据状态分布。

### 📋 模板管理

- **模板构建器**：三栏拖拽式构建（组件面板 → 画布 → 属性面板）
- **支持字段类型**：Input、Textarea、Radio、Checkbox、Select、Rating、Switch、Title
- **模板操作**：创建、编辑、删除、预览、导入 / 导出 Schema、复制 JSON

### 📦 任务管理

- **任务配置**：名称、描述、类型、绑定模板、时间窗口、逾期策略
- **任务类型**：图像分类、目标检测、语义分割、文本 NER
- **分配方式**：按量均分、手动指定、领取模式
- **状态流转**：草稿 → 待发布 → 进行中 → 已完成 / 已结束

### ✏️ 标注工作台

- 左侧原始数据面板 + 右侧标注表单与 AI 预审结果
- 草稿保存、提交标注、驳回重提、领取更多
- **并发控制**：悲观锁（编辑锁）+ 乐观锁（版本号）双重保障

### 🔍 审核工作台

- 审核列表（支持按状态、任务、标注员、AI 预审结论、关键词筛选）
- 原始数据 + 标注结果 + AI 预审结果对比
- 通过 / 驳回操作（驳回必须填写原因）
- **审核回避**：审核员不能审核自己提交的数据

### 🤖 AI 规则预审

- 基于规则引擎的自动预审（不依赖大模型 API）
- 前后端双重实现：前端实时预览 + 后端可信执行
- 规则示例：必填缺失、评分超限、文本过短、分类为空、其他类风险、评分偏低
- 结论分级：PASS / RISK / FAIL，附带质量评分、摘要、命中规则和优化建议

### 🔔 实时通知

- 基于 Socket.IO 的实时推送
- 通知类型：审核通过 / 驳回、任务分配 / 提交 / 重提、即将逾期、负责人手动通知
- 房间策略：用户房间、角色房间、任务房间

### 📊 统计看板

- 标注员提交量排行、审核通过率仪表盘
- 数据状态分布、AI 预审风险分布

### 📤 数据导出

- 支持 JSON / CSV 格式
- 可按任务、状态筛选导出
- 导出字段：数据 ID、状态、原始数据、标注结果、AI 预审结果、审核结果、驳回原因等

### 👥 用户管理

- 用户列表、创建用户并指定角色、编辑信息、删除用户

### 📁 任务归档

- 审核通过后自动归档，所有角色可查看
- 负责人可取消归档，归档数据参与统计和导出

## 项目结构

```
LabelHub/
├── src/                          # 前端源码
│   ├── api/                      # API 请求封装
│   ├── components/               # 通用组件
│   ├── composables/              # 组合式函数
│   ├── layouts/                  # 布局组件
│   ├── pages/                    # 页面组件
│   │   ├── Dashboard/            # 仪表盘
│   │   ├── TemplateBuilder/      # 模板构建器
│   │   ├── TemplateManage/       # 模板管理
│   │   ├── TaskForm/             # 任务创建 / 编辑
│   │   ├── TaskList/             # 任务列表
│   │   ├── TaskDetail/           # 任务详情
│   │   ├── AnnotationWorkbench/  # 标注工作台
│   │   ├── ReviewWorkbench/      # 审核工作台
│   │   ├── StatisticsBoard/      # 统计看板
│   │   ├── DataExport/           # 数据导出
│   │   ├── UserManage/           # 用户管理
│   │   ├── TaskArchive/          # 任务归档
│   │   ├── NotificationManage/   # 通知管理
│   │   ├── NotificationPublish/  # 通知发布
│   │   ├── Login/                # 登录
│   │   └── Exception/            # 异常页面
│   ├── router/                   # 路由配置
│   ├── services/                 # 业务服务
│   ├── stores/                   # Pinia 状态管理
│   ├── types/                    # TypeScript 类型定义
│   └── utils/                    # 工具函数
├── server/                       # 后端源码
│   ├── middleware/               # 中间件（auth、response、security 等）
│   ├── routes/                   # 路由（auth、users、tasks、templates 等）
│   ├── services/                 # 业务服务（通知、AI 预审、时效提醒、分配引擎）
│   ├── store/                    # 数据库连接
│   ├── utils/                    # 工具函数
│   ├── data/                     # 示例数据（JSON 种子数据）
│   ├── test/                     # 测试脚本
│   ├── index.js                  # 服务入口
│   └── seed.js                   # 数据初始化脚本
├── package.json                  # 前端依赖
├── vite.config.ts                # Vite 配置
└── PRODUCT.md                    # 产品文档
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

### 5. 重置数据

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

| 角色   | 用户名      | 密码           |
| ------ | ----------- | -------------- |
| 负责人 | `owner`     | `owner123`     |
| 标注员 | `annotator` | `annotator123` |
| 审核员 | `reviewer`  | `reviewer123`  |

## API 概览

| 路径前缀                | 模块               |
| ----------------------- | ------------------ |
| `/api/auth`             | 登录认证、当前用户 |
| `/api/users`            | 用户管理           |
| `/api/tasks`            | 任务管理与分配     |
| `/api/templates`        | 模板管理           |
| `/api/annotation-items` | 标注数据与业务操作 |
| `/api/reviews`          | AI 预审结果        |
| `/api/notifications`    | 通知管理           |
| `/api/health`           | 健康检查           |

所有接口返回统一格式：`{ code, message, data }`

### 标注数据核心操作

| 方法  | 路径                                     | 说明                   |      权限      |
| ----- | ---------------------------------------- | ---------------------- | :------------: |
| `PUT` | `/annotation-items/:id/save-draft`       | 保存草稿               |     标注员     |
| `PUT` | `/annotation-items/:id/submit`           | 提交标注并触发 AI 预审 |     标注员     |
| `PUT` | `/annotation-items/:id/resubmit`         | 驳回后重新提交         |     标注员     |
| `PUT` | `/annotation-items/:id/approve`          | 审核通过               |     审核员     |
| `PUT` | `/annotation-items/:id/reject`           | 审核驳回               |     审核员     |
| `PUT` | `/annotation-items/:id/claim-assignment` | 领取标注项             |     标注员     |
| `PUT` | `/annotation-items/:id/claim-review`     | 领取审核项             |     审核员     |
| `PUT` | `/annotation-items/:id/claim`            | 获取编辑锁             |     标注员     |
| `PUT` | `/annotation-items/:id/release`          | 释放编辑锁             | 标注员、负责人 |
| `PUT` | `/annotation-items/:id/archive`          | 归档                   | 负责人、审核员 |
| `PUT` | `/annotation-items/:id/unarchive`        | 取消归档               |     负责人     |

## License

MIT
