# LabelHub Backend Server

数据标注平台的 Node.js 后端服务，使用 **SQLite** 作为持久化存储。

## 技术栈

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** SQLite (via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- **Auth:** JWT (Base64 编码令牌)

## 快速开始

```bash
cd server
npm install
npm start
```

服务默认运行在 `http://localhost:3001`。

首次启动时，如果数据库为空，会自动执行 `seed.js` 填充示例数据。

## 数据库

使用 SQLite 数据库文件 `data/labelhub.db`，由 `better-sqlite3` 驱动：

- **WAL 模式** — 提升并发读性能
- **外键约束** — 保证数据引用完整性
- **预编译语句** — 高性能查询
- **事务支持** — 种子数据等批量操作原子性

### 数据表

| 表名 | 说明 |
|------|------|
| `users` | 用户（owner / annotator / reviewer） |
| `templates` | 标注模板（含字段 schema） |
| `tasks` | 标注任务 |
| `annotation_items` | 标注数据项（原始数据 + 标注结果） |
| `reviews` | AI 审核结果 |

### 重置数据

删除 `data/labelhub.db` 文件后重启服务即可重新 seed：

```bash
del data\labelhub.db
npm start
```

或手动运行：

```bash
node seed.js
```

## API 接口

所有接口返回统一格式：`{ code, message, data }`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户信息 |
| GET/POST | `/api/users` | 用户 CRUD |
| GET/POST | `/api/tasks` | 任务 CRUD |
| GET/POST | `/api/templates` | 模板 CRUD |
| GET/POST | `/api/annotation-items` | 标注数据 CRUD |
| GET/POST | `/api/reviews` | 审核结果 CRUD |
| GET | `/api/health` | 健康检查 |

### CRUD 查询参数

列表接口支持以下查询参数：

- `?field=value` — 按字段值筛选
- `?_sort=createdAt&_order=desc` — 排序
- `?_page=1&_limit=10` — 分页

### 标注数据特殊操作

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/annotation-items/save-draft/:id` | 保存草稿 |
| POST | `/api/annotation-items/submit/:id` | 提交标注 |
| POST | `/api/annotation-items/approve/:id` | 审核通过 |
| POST | `/api/annotation-items/reject/:id` | 审核驳回 |
| POST | `/api/annotation-items/resubmit/:id` | 重新提交 |
| GET | `/api/reviews/by-item/:dataItemId` | 按数据项查审核 |
| GET | `/api/reviews/by-task/:taskId` | 按任务查审核 |
