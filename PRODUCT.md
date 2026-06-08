# LabelHub 产品文档

## 1. 产品概述

**LabelHub** 是一款面向标注团队的 B 端数据标注协作平台，覆盖从模板定义、任务创建、标注执行、AI 预审、人工审核到数据导出的全流程，帮助团队高效完成数据标注工作。

### 1.1 核心价值

- **流程闭环**：模板 → 任务 → 标注 → AI 预审 → 人工审核 → 导出，端到端覆盖
- **AI 赋能**：提交即自动触发 AI 规则引擎预审，降低人工审核成本
- **角色协同**：负责人、标注员、审核员三种角色分工明确，权限隔离
- **实时协作**：WebSocket 实时通知，时效预警，并发冲突保护

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + TypeScript |
| UI 组件 | Ant Design Vue |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| 图表 | ECharts |
| 拖拽 | vue-draggable-plus |
| 构建工具 | Vite |
| 后端框架 | Express |
| 数据库 | SQLite（better-sqlite3） |
| 认证 | JWT |
| 实时通信 | Socket.IO |

---

## 2. 角色与权限

系统定义三种角色，各角色拥有不同的功能访问权限：

| 功能模块 | 负责人（Owner） | 标注员（Annotator） | 审核员（Reviewer） |
|----------|:---:|:---:|:---:|
| 仪表盘 | ✓ | ✓ | ✓ |
| 任务管理（创建/编辑/删除） | ✓ | — | — |
| 模板管理（创建/编辑/删除） | ✓ | — | — |
| 标注工作台 | — | ✓ | — |
| 审核工作台 | — | — | ✓ |
| 数据导出 | ✓ | — | ✓ |
| 统计看板 | ✓ | — | ✓ |
| 用户管理 | ✓ | — | — |
| 通知发布 | ✓ | — | — |
| 任务归档 | ✓ | ✓ | ✓ |

### 2.1 回避原则

审核员不能审核自己提交的标注数据，确保审核客观性。

---

## 3. 功能模块

### 3.1 登录与认证

- JWT 令牌认证，登录后获取 Token 存储于前端
- 路由守卫（AuthGuard）按角色控制页面访问
- 已登录用户访问 `/login` 时自动重定向到角色默认页

### 3.2 仪表盘（Dashboard）

按角色展示个性化概览信息：

| 指标 | 负责人 | 标注员 | 审核员 |
|------|--------|--------|--------|
| 待处理 | 待标注 + 待审核 | 待标注数 | 待审核数 |
| 已通过 | 审核通过数 | 审核通过数 | 审核通过数 |
| 已驳回 | 驳回数 | 驳回数 | 驳回数 |
| 审核通过率 | 全局通过率 | 个人通过率 | 审核通过率 |

其他模块：
- **标注进度**：进度条 + 各状态标签计数
- **任务概览**：总任务/进行中/已完成统计 + 任务列表
- **AI 预审风险**：风险/不通过数、AI 预审总数、风险率
- **数据状态分布**：全量数据按状态分类统计

### 3.3 模板管理

#### 3.3.1 模板列表

展示所有标注模板，支持查看、编辑、删除。

#### 3.3.2 模板构建器（Template Builder）

可视化拖拽式模板构建器，三栏布局：

- **组件面板**：从字段类型列表拖拽到画布
- **画布**：实时预览模板布局，支持拖拽排序
- **属性面板**：配置选中字段的详细属性

支持的字段类型：

| 类型 | 说明 | 特有属性 |
|------|------|----------|
| 单行输入（Input） | 短文本输入 | maxLength, minLength |
| 多行文本（Textarea） | 长文本输入 | maxLength, minLength, autoSize |
| 单选（Radio） | 单选按钮组 | options, direction |
| 多选（Checkbox） | 复选框组 | options, direction, maxCheck |
| 下拉选择（Select） | 下拉菜单 | options, multiple, searchable |
| 评分（Rating） | 星级评分 | maxScore, allowHalf |
| 开关（Switch） | 是/否切换 | checkedChildren, unCheckedChildren |
| 说明块（Title） | 纯展示说明文字 | content, level |

通用属性：fieldKey、label、required、placeholder、description、defaultValue

模板操作：
- 预览模板（完整表单渲染）
- 导出/导入 Schema JSON
- 复制 JSON 到剪贴板
- 保存到服务器

### 3.4 任务管理

#### 3.4.1 任务列表

展示所有任务，支持按状态筛选，可进行发布、归档等操作。

#### 3.4.2 创建/编辑任务

任务表单包含以下字段：

**基本信息**
- 任务名称、描述、类型、负责人、绑定模板、任务说明

**任务类型**
- 图像分类（image_classification）
- 目标检测（object_detection）
- 语义分割（semantic_segmentation）
- 文本 NER（text_ner）

**标注时效配置**
- 计划开始时间 / 截止时间
- 提前预警（默认 24 小时）
- 逾期策略：仅预警提醒 / 逾期禁止提交 / 负责人手动结束

**审核时效配置**
- 审核开始时间 / 审核截止时间
- 提前预警（默认 24 小时）
- 逾期策略：同上

#### 3.4.3 任务状态流转

```
草稿 → 待发布 → 进行中 → 已完成 / 已结束
```

| 当前状态 | 可流转至 |
|----------|----------|
| 草稿 | 待发布、进行中 |
| 待发布 | 草稿、进行中 |
| 进行中 | 已完成、已结束 |
| 已完成 | —（终态） |
| 已结束 | —（终态） |

#### 3.4.4 任务分配

- **按量均分**（even_split）：指定每人分配数量，系统自动均分
- **手动指定**（manual）：逐条指定标注员

#### 3.4.5 任务详情

展示任务的完整信息，包括分配统计（总数/已分配/未分配/按标注员统计/按状态统计）。

### 3.5 标注工作台

标注员的核心工作界面，三栏布局：

| 区域 | 内容 |
|------|------|
| 左侧 | 原始数据面板（RawDataPanel） |
| 右侧 | 标注表单 / AI 预审结果（可切换） |
| 底部 | 导航（上一条/下一条）+ 操作（保存草稿/提交/领取更多） |

#### 标注操作

- **保存草稿**：标注数据保存为草稿，可继续编辑
- **提交标注**：提交后自动触发 AI 预审，状态流转至 `pending_review`
- **重新提交**：驳回后可修改并重新提交，同样触发 AI 预审
- **领取标注**：手动从任务池领取未分配的标注项

#### 并发控制

- **悲观锁**：标注员编辑时自动加锁（30 分钟超时），其他人不可同时编辑
- **乐观锁**：提交时校验版本号，冲突时提示用户选择处理方式

#### AI 预审结果展示

提交后右侧自动展示 AI 预审面板，与标注表单可一键切换。字段警告支持点击跳转到对应表单字段；优化建议支持一键采纳。

### 3.6 审核工作台

审核员的核心工作界面，三栏布局：

| 区域 | 内容 |
|------|------|
| 左侧 | 审核列表（按条件筛选） |
| 中间 | 审核内容面板（原始数据 + 标注结果 + AI 预审） |
| 右侧 | 审核操作面板（通过/驳回 + 审核时间线） |

#### 筛选条件

- 审核状态（AI 预审中 / 待人工审核 / 审核通过 / 审核驳回）
- 所属任务
- 标注员
- AI 预审结论（通过 / 风险 / 不通过）
- 关键词（文件名/描述/ID）

#### 审核操作

- **通过**：状态变为 `reviewed`，自动归档，通知标注员
- **驳回**：必须填写驳回原因，状态变为 `rejected`，通知标注员
- **领取审核**：手动从未分配的审核池领取待审项

#### 审核时间线（Audit Timeline）

展示标注项的完整操作历史，包括：
- 每次状态流转（from → to）
- 操作人（标注员 / 审核员 / AI 系统 / 系统自动）
- 操作类型（提交 / 保存草稿 / AI 预审开始 / AI 预审完成 / 分配审核员 / 通过 / 驳回 / 重新提交 / 归档）
- 操作原因/备注

### 3.7 AI 预审引擎

#### 3.7.1 架构

纯规则驱动的预审引擎，不依赖大模型 API，前后端双重实现：
- **前端**：标注员实时预览预审结果，可采纳建议
- **后端**：提交时服务端执行，防止篡改，结果持久化

#### 3.7.2 预审规则

| 规则 ID | 名称 | 严重程度 | 适用字段类型 | 触发条件 |
|---------|------|----------|-------------|----------|
| R001 | 必填字段缺失 | error | 所有非 TITLE | required=true 且值为空 |
| R002 | 评分超出范围 | error | RATING | 值 < 0 或 > maxScore |
| R003 | 文本长度过短 | warning | INPUT / TEXTAREA | 非空文本长度 < minLength（默认 2） |
| R004 | 分类字段为空 | error | RADIO / SELECT / CHECKBOX | 非必填但值为空 |
| R005 | "其他"类别风险 | warning | RADIO / SELECT | 选中 value="other" |
| R006 | 评分偏低风险 | warning | RATING | 0 < 值 < 2 |

#### 3.7.3 评分算法

- 基础分 100 分
- error 扣 30 分，warning 扣 15 分，info 扣 5 分
- 最低 0 分

#### 3.7.4 预审状态判定

| 预审状态 | 判定条件 |
|----------|----------|
| FAIL（不通过） | score < 60 或最高严重程度为 error |
| RISK（风险） | score < 80 或最高严重程度为 warning |
| PASS（通过） | 其余情况 |

#### 3.7.5 预审结果面板

AI 预审面板包含以下区域：
1. **质量评分仪表盘**：0-100 分可视化，颜色随分数变化（优良 ≥80 / 一般 ≥60 / 较差 <60）
2. **预审摘要**：自然语言描述预审结论
3. **快速统计**：严重/警告/提示问题计数
4. **命中规则列表**：展示触发的预审规则及说明
5. **字段级警告**：定位到具体字段的警告信息，支持点击跳转到表单
6. **优化建议**：展示建议值和原因，支持一键采纳
7. **元信息**：模型版本、预审时间

### 3.8 数据状态流转

标注数据项的完整状态生命周期：

```
pending → draft → submitted → ai_reviewing → ai_reviewed → pending_review → reviewed
                  ↑                                                           ↓
                  └────────────── rejected ←──────────────────────────────────┘
```

| 状态 | 说明 | 可流转至 |
|------|------|----------|
| pending | 待标注 | draft, submitted |
| draft | 草稿 | submitted, pending |
| submitted | 已提交 | pending_review, ai_reviewing |
| ai_reviewing | AI 预审中 | ai_reviewed |
| ai_reviewed | AI 已预审 | pending_review |
| pending_review | 待人工审核 | reviewed, rejected |
| reviewed | 审核通过（终态） | — |
| rejected | 审核驳回 | submitted（重新提交） |

**提交时的原子操作**：submitted → ai_reviewing → ai_reviewed → pending_review 在服务端一步完成，标注员无需等待中间态。

### 3.9 数据导出

#### 导出配置

- **选择任务**：可选全部或指定任务
- **导出范围**：全部数据 / 仅审核通过 / 仅驳回数据
- **导出格式**：JSON / CSV

#### 导出字段

导出文件包含：数据 ID、任务 ID、状态、原始数据、标注结果、AI 预审结果（状态/评分）、人工审核结果（通过/驳回/审核人/驳回原因）等字段。

#### 数据预览

导出前可预览数据表格，展示摘要信息，完整数据需下载导出文件。

### 3.10 统计看板

#### 数据卡片

顶部展示关键指标统计卡片。

#### 图表

| 图表 | 说明 |
|------|------|
| 标注员提交量排行 | 按标注员统计提交数量的柱状图 |
| 审核通过率仪表盘 | 整体审核通过率的仪表盘图 |
| 数据状态分布 | 各状态数据量的饼图/柱状图 |
| AI 预审风险分布 | AI 预审通过/风险/不通过的分布图 |

### 3.11 用户管理

- 查看所有用户列表
- 创建新用户（指定用户名、角色、密码）
- 编辑用户信息
- 删除用户

### 3.12 通知系统

#### 3.12.1 实时通知（WebSocket）

基于 Socket.IO 的实时推送，房间策略：

| 房间类型 | 命名规则 | 用途 |
|----------|----------|------|
| 用户房间 | user:username:{username} | 向指定用户推送 |
| 角色房间 | role:{role} | 向角色广播 |
| 任务房间 | task:{taskId} | 向任务相关人员推送 |

#### 3.12.2 通知类型

| 通知类型 | 触发时机 | 接收人 | 优先级 |
|----------|----------|--------|--------|
| 审核通过（review_approved） | 审核员通过 | 标注员 | medium |
| 审核驳回（review_rejected） | 审核员驳回 | 标注员 | high |
| AI 预审完成（ai_review_complete） | AI 预审执行完毕 | 审核员 | low |
| 任务分配（task_assigned） | 负责人分配任务 | 标注员 | high |
| 标注已提交（task_submitted） | 标注员提交 | 审核员 | low |
| 标注已重新提交（task_resubmitted） | 标注员重新提交 | 审核员 | medium |
| 任务即将逾期（task_due_soon） | 时效预警服务检测 | 相关人员 | high |
| 负责人通知（owner_message） | 负责人手动发布 | 指定接收人 | medium |

#### 3.12.3 通知铃铛

顶部导航栏的通知铃铛组件，展示未读通知列表，支持：
- 实时接收新通知
- 标记单条已读 / 全部已读
- 查看通知详情
- 按角色过滤可见通知类型

#### 3.12.4 通知发布

负责人可手动发布通知，配置项：
- 通知标题、内容
- 优先级（高/中/低）
- 按角色发送 / 按人员发送（取并集，重复人员只发一次）

#### 3.12.5 时效预警服务

后端定时扫描（默认每 5 分钟），自动检测：
- 标注阶段即将逾期：在截止前 N 小时通知相关标注员
- 审核阶段即将逾期：在截止前 N 小时通知相关审核员
- 逾期自动释放：逾期策略为"禁止提交"时，自动释放标注员/审核员分配，数据回池

### 3.13 任务归档

- 展示已归档的标注数据
- 所有角色均可查看归档数据
- 审核通过时自动归档
- 负责人可手动取消归档

---

## 4. API 接口

### 4.1 接口概览

| 路径前缀 | 模块 |
|----------|------|
| /api/auth | 认证（登录、当前用户、用户列表） |
| /api/users | 用户管理 CRUD |
| /api/tasks | 任务管理 CRUD + 分配 |
| /api/templates | 模板管理 CRUD |
| /api/annotation-items | 标注数据 CRUD + 业务操作 |
| /api/reviews | 预审结果查询 |
| /api/notifications | 通知管理 |
| /api/health | 健康检查 |

### 4.2 核心业务接口

#### 标注数据操作

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| PUT | /annotation-items/:id/save-draft | 保存草稿 | 标注员 |
| PUT | /annotation-items/:id/submit | 提交标注（自动 AI 预审） | 标注员 |
| PUT | /annotation-items/:id/resubmit | 驳回后重新提交（自动 AI 预审） | 标注员 |
| PUT | /annotation-items/:id/approve | 审核通过（自动归档） | 审核员 |
| PUT | /annotation-items/:id/reject | 审核驳回（必填原因） | 审核员 |
| PUT | /annotation-items/:id/claim-assignment | 标注员领取标注项 | 标注员 |
| PUT | /annotation-items/:id/claim-review | 审核员领取审核项 | 审核员 |
| PUT | /annotation-items/:id/claim | 认领编辑锁 | 标注员 |
| PUT | /annotation-items/:id/release | 释放编辑锁 | 标注员/负责人 |
| POST | /annotation-items/:id/ai-review | 手动触发 AI 预审 | 负责人 |
| POST | /annotation-items/batch-import | 批量导入标注数据 | 负责人 |
| PUT | /annotation-items/:id/archive | 归档 | 负责人/审核员 |
| PUT | /annotation-items/:id/unarchive | 取消归档 | 负责人 |
| GET | /annotation-items/available | 获取可领取标注项 | 标注员 |
| GET | /annotation-items/review-available | 获取可领取审核项 | 审核员 |

#### 任务分配

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /tasks/:id/assign | 执行任务分配 | 负责人 |
| POST | /tasks/:id/assign/clear | 清除分配 | 负责人 |
| GET | /tasks/:id/assign/stats | 分配统计 | 负责人 |
| GET | /assignments/annotators | 获取标注员列表 | 负责人 |

---

## 5. 数据模型

### 5.1 核心实体关系

```
User ──┬── Owner: 创建 Task / Template
       ├── Annotator: 标注 AnnotationItem
       └── Reviewer: 审核 AnnotationItem

Template ──── 1:N ──── TemplateField
    │
    └──── 1:N ──── Task ──── 1:N ──── AnnotationItem ──── 1:N ──── Review (AI预审结果)
                                      └── 1:N ──── AuditHistoryRecord
```

### 5.2 关键数据结构

#### AnnotationItem

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| taskId | string | 所属任务 |
| rawData | object | 原始待标注数据 |
| status | DataItemStatus | 当前状态 |
| annotationData | object \| null | 标注结果 |
| annotator | string \| null | 标注员 |
| reviewer | string \| null | 审核员 |
| submittedAt | string \| null | 提交时间 |
| reviewedAt | string \| null | 审核时间 |
| rejectReason | string \| null | 驳回原因 |
| auditHistory | AuditHistoryRecord[] | 操作历史 |
| version | number | 乐观锁版本号 |
| lockedBy | string \| null | 悲观锁持有者 |
| lockedAt | string \| null | 锁获取时间 |
| archived | boolean | 是否归档 |

#### AIReviewResult

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 预审结果 ID |
| dataItemId | string | 关联数据项 |
| taskId | string | 关联任务 |
| templateId | string | 关联模板 |
| reviewStatus | ReviewStatus | 预审状态（pass/risk/fail） |
| score | number | 质量评分 0-100 |
| summary | string | 自然语言摘要 |
| matchedRules | MatchedRule[] | 命中规则列表 |
| fieldWarnings | FieldWarning[] | 字段级警告列表 |
| suggestions | ReviewSuggestion[] | 修改建议列表 |
| reviewedAt | string | 预审时间 |
| modelVersion | string | 模型版本 |

---

## 6. 非功能性特性

### 6.1 并发控制

- **悲观锁**：标注员编辑时自动加锁，30 分钟超时，防止多人同时编辑同一条数据
- **乐观锁**：提交时校验 version 字段，冲突时返回 409 + 服务端最新数据
- **自动锁清理**：每 60 秒清理过期锁
- **登出释放**：用户登出时自动释放所有持有的锁

### 6.2 时效管理

- 标注/审核各阶段独立配置开始时间、截止时间
- 提前预警：截止前 N 小时自动通知相关人员
- 逾期策略：仅提醒 / 禁止提交（自动释放分配） / 手动结束
- 后台定时扫描：每 5 分钟检测一次时效状态

### 6.3 数据安全

- JWT 认证，所有接口需携带 Token
- RBAC 权限控制，按角色限制操作
- AI 预审在服务端执行，防止前端篡改
- 状态机校验，前后端双重验证状态流转合法性
