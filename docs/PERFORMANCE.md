# LabelHub 性能优化实录

> 本文记录 LabelHub 前端的一轮完整性能优化：从建立基线、定位瓶颈，到方案取舍与实测验证。
> 所有数据来自 `npm run build`（Vite 6 生产构建）的真实产物，bundle 组成可在构建后的 `dist/stats.html`（rollup-plugin-visualizer，含 gzip/brotli）中复核。

## TL;DR

| 指标                                   | 优化前                                    | 优化后                                   | 变化                  |
| -------------------------------------- | ----------------------------------------- | ---------------------------------------- | --------------------- |
| 入口预加载 JS（entry + modulepreload） | 5 个 chunk ≈ **1689 kB**（gzip ≈ 520 kB） | 3 个 chunk ≈ **313 kB**（gzip ≈ 113 kB） | **-81%（gzip -78%）** |
| 最大单 chunk（ant-design-vue）         | **1329.81 kB**（gzip 406.55 kB）          | 已消除，按路由自然拆分                   | —                     |
| 新增 ECharts 依赖（551 kB）            | —                                         | 仅监控页按需加载，首屏零增量             | —                     |
| 审核列表渲染方式                       | 全量渲染所有条目                          | 虚拟滚动（仅渲染视口内）                 | —                     |
| 任务列表数据方式                       | 全量拉取 + 客户端过滤                     | 服务端分页 + 筛选                        | —                     |

## 0. 方法论：先测量，再优化

优化前先跑一次生产构建留存基线，避免"感觉变快了"式的自嗨：

```bash
npm run build        # 产出 dist/ 与 dist/stats.html
```

基线（优化前）关键产物：

| 产物                              | 体积       | gzip      |
| --------------------------------- | ---------- | --------- |
| antd chunk                        | 1329.81 kB | 406.55 kB |
| icons chunk                       | 136.13 kB  | 29.71 kB  |
| vue chunk（vue + router + pinia） | 107.77 kB  | 42.06 kB  |
| 入口 index                        | 69.60 kB   | 23.58 kB  |
| request chunk（axios）            | 46.09 kB   | 17.77 kB  |

问题一目了然：**登录页也要下载 1.3 MB 的完整组件库**——`main.ts` 里 `app.use(Antd)` 全量注册，且 `manualChunks` 把整个 ant-design-vue 强制打进单一 chunk 并被 modulepreload。

## 1. 组件库按需引入 + 分包策略重设计（-81%）

### 1.1 按需引入

- 移除 `app.use(Antd)` 全量注册，接入 `unplugin-vue-components` + `AntDesignVueResolver`。模板中的 `a-*` 组件在编译期解析为精确 import，未使用的组件被 tree-shaking 掉。
- antd v4 使用 CSS-in-JS，无需样式按需（`importStyle: false`），仅保留体积很小的 `reset.css`。
- `message` / `Modal.confirm` 等函数式 API 本就通过显式 `import { message } from 'ant-design-vue'` 使用，天然可摇树，无需改造。

仅这一步：antd chunk 1329.81 kB → **953.08 kB**（gzip 406.55 → 292.39 kB，-28%）。

### 1.2 放开组件库的手动分包

-28% 还不够——只要 `manualChunks` 里存在 `antd: ['ant-design-vue']`，所有用到的组件仍会聚合成一个大 chunk，登录页照样全量加载。

进一步把 antd/icons 从 `manualChunks` 中移除，让 Rollup 按路由依赖自然拆分；框架层（vue / axios / socket.io-client）保留手动分包。最终入口只预加载 3 个 chunk（entry + vue + axios）≈ 313 kB。

**取舍说明**：单一 vendor chunk 的优势是缓存稳定（业务代码改动不影响 vendor hash）；按路由拆分的优势是首屏最小化。本项目登录页是所有用户的入口，首屏收益远大于缓存粒度损失，且框架层 chunk 仍然稳定缓存——这是一个折中而非极端方案。

### 1.3 新增依赖不吃掉优化成果

后续新增的 ECharts（551 kB）只被监控页 import，而监控页是懒加载路由——构建产物中它是独立 chunk，不出现在入口的 modulepreload 列表里。**验证方式**：`grep modulepreload dist/index.html`。

## 2. 渲染层：万级列表双方案

### 2.1 服务端分页（任务列表）

原实现把全量任务拉到前端再做关键词/状态过滤 + 客户端分页，数据量增长后请求体积与内存都会线性膨胀。改造：

- 后端 `GET /api/tasks` 的 `filterList` 分支扩展 `keyword`（名称模糊）/ `status`（精确）过滤，配合已有的 `_page/_limit/_sort/_order`；**不传分页参数时保持全量返回**，对既有调用方零破坏。
- 前端任务列表切换为服务端模式：筛选/翻页触发请求，`total` 来自服务端；筛选词防抖 300ms 生效并自动回到第一页。

### 2.2 手写虚拟滚动（审核列表）

审核工作台左侧列表原先一次性渲染全部条目（无分页），千级数据时 DOM 节点数直接爆炸。没有引入现成库，而是手写了约 170 行的 `useVirtualList` composable：

- **前缀和数组**缓存每行顶部偏移，仅在源数据变化时重算一次，天然支持**变高行**（分组头 38px / 数据条目 92px 两种行高共存）；
- 滚动时**二分查找** O(log n) 定位首个可见行，配合 overscan 上下多渲染几行保证滚动平滑；
- 渲染层用 phantom 元素撑起总高度，可见行以 `transform: translateY()` 绝对定位，避免重排；
- 提供 `scrollIntoView(index)`——筛选后自动选中的条目若在视口外会滚动至可见；
- 纯逻辑与 DOM 解耦，配有 6 条单元测试（窗口计算、变高行偏移、空列表、数据变更重算、scrollIntoView 边界）。

## 3. 交互层：防抖、keep-alive 与请求层

- **防抖**：`useDebounced` composable（支持 `Ref` 与 getter 两种源），输入框保持即时回显、过滤计算依赖防抖镜像值；应用于全部 4 处搜索框，顺带修复了筛选结果变化后页码越界的隐性 bug。
- **keep-alive**：布局层按组件名白名单缓存列表页，返回列表时保留筛选与页码；数据新鲜度用 `onActivated` 重新拉取解决——状态保留与数据实时的折中。
- **请求层**（axios 封装）：
  - 相同 `url + params` 的在途 GET 自动共享同一个 Promise（键序无关、忽略 undefined 参数），消灭重复请求；传入自定义 `signal` 时跳过去重，保证取消语义只作用于发起方；
  - GET（幂等）默认自动重试 2 次，指数退避 + 随机抖动防惊群；写操作不重试；**已取消的请求绝不重试**。

## 4. 主线程卸载：Web Worker 导出

数据导出的 JSON/CSV 序列化是典型的长任务。序列化逻辑本就是纯函数，直接移入 module Worker：

- Vite 的 `new Worker(new URL(...), { type: 'module' })` 让 Worker 与主包共享同一套 TS 工具函数；
- 一个细节坑：Vue 响应式对象是 Proxy，**无法通过 structured clone 传入 Worker**（DataCloneError）。postMessage 前用 `deepToRaw` 深度还原为普通对象——比 JSON 往返序列化的开销小得多；
- Worker 构造失败或运行异常时自动退化为主线程序列化，导出功能永远可用。

## 5. 监控闭环：让优化效果长期可见

一次性优化会随迭代回退，所以补上了持续监控：

- 前端用 `web-vitals` 采集 LCP / INP / CLS / FCP / TTFB，`navigator.sendBeacon` 上报（页面卸载不丢、不阻塞主线程），仅生产环境启用；
- 服务端落库（SQLite，超过 5 万行自动修剪）并提供 p75 / rating 分布 / 按天趋势的聚合端点；
- 管理端监控看板用 `echarts/core` 按需注册渲染：各指标 p75 统计卡（按 Google 官方阈值定级）、单指标趋势折线（避免 ms 与 CLS 无量纲值混轴）、rating 堆叠分布，并附表格视图兜底；
- 为什么是 p75：Core Web Vitals 官方口径，比平均值更能反映大多数用户的真实体验，且对长尾异常值不敏感。

## 6. 验证清单

每轮改动后跑完整验证，防止"优化引入回归"：

```bash
npm run build      # tsc 类型检查 + 产物体积对比
npm test           # 34 条单元测试
npm run lint       # 0 error 门槛
grep modulepreload dist/index.html   # 确认首屏预加载集合没有膨胀
```

## 7. 后续方向

- Lighthouse 场景化跑分（登录页 / 仪表盘）纳入 CI 产物留存
- 大表格行级 `v-memo`、更多页面推广 `shallowRef`
- 虚拟滚动支持动态行高测量（ResizeObserver 实测行高回写前缀和）
- 监控数据接入告警阈值（p75 连续劣化提醒）
