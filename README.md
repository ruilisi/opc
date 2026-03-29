# OPC (One Person Company) — 守护每一个独自奔跑的灵魂

> **"一个人，也可以是一支军队。"**
> 为独立创业者、自由职业者及 1–10 人精干团队打造的极简项目管理系统。不只是管理任务，更是守护你最宝贵的资源：**注意力与时间**。

**开源**：[github.com/ruilisi/opc](https://github.com/ruilisi/opc) · **体验**：[opc.ruilisi.com](https://opc.ruilisi.com)

---

## 演示视频

[![OPC Demo](https://files.lingti.com/images/opc-saas.png)](https://www.bilibili.com/video/BV1ANX1BwEdP/)

- 📺 Bilibili：[www.bilibili.com/video/BV1ANX1BwEdP](https://www.bilibili.com/video/BV1ANX1BwEdP/)
- 🎬 YouTube：[www.youtube.com/watch?v=5lKisD51_gA](https://www.youtube.com/watch?v=5lKisD51_gA)

---

## 感谢金主爸爸

- <a href="https://game.lingti.com"><img src="https://files.lingti.com/images/lingti-logo-圆形不带字.png" height="24" style="vertical-align:middle;display:inline-block;" /></a> **[灵缇AI加速](https://game.lingti.com)** — PC/Mac/iOS/Android 全平台游戏加速、全球首创热点加速、AI 及学术资源定向加速

---

## 功能全览

| 模块 | 核心能力 |
|------|----------|
| 看板 | 拖拽卡片、列管理、标签/成员/截止日期过滤、实时多人同步 |
| 任务 | 富文本内容、清单、附件、评论、标签、成员分配、截止日期、复制任务 |
| AI Agent | Token 鉴权、Agent API、自动领取/执行/完成任务循环 |
| 组织 | 多组织切换、角色权限（owner/admin/member/viewer）、邀请链接 |
| 文件库 | 文件夹树、上传/预览/重命名/移动/删除、标签过滤、直传七牛无大小限制 |
| Sentry | 多项目配置、在看板内查看并解决错误、无需跳转 |
| 实时协作 | SSE 推送看板变化和文件库变化，多用户零刷新同步 |
| 设置 | 七牛云存储配置、API Tokens、Sentry 配置 |
| 认证 | Lingti OAuth 单点登录、JWT Cookie、Bearer Token |

---

## 功能详解

### 1. 看板 (Kanban Board)

基于拖拽的看板是 OPC 的核心工作区。

- **多列管理**：自由创建、重命名、删除列；拖拽列本身可重新排序
- **卡片拖拽**：跨列移动任务，排序立即持久化
- **丰富过滤**：按标签、成员、截止日期（逾期/今天/即将/无）多维过滤，一键清除
- **实时同步**：基于 SSE，任何成员的操作立刻同步到所有在线用户，无需刷新

```
看板 URL：/boards/:boardId
```

### 2. 任务详情

点击任意卡片进入任务详情对话框，支持：

- **富文本内容**：Markdown 编辑器，支持代码块、图片粘贴直传
- **清单 (Checklist)**：可添加多个子任务，单独勾选，进度实时展示
- **附件**：截图粘贴或文件选择，自动上传至七牛云 CDN
- **评论**：支持 Markdown，可删除评论
- **标签 (Labels)**：彩色标签系统，在看板过滤中联动
- **成员分配**：将任务指派给看板成员
- **截止日期**：日期选择器，逾期高亮
- **任务复制**：一键复制任务到同一看板任意列
- **删除任务**：从详情对话框直接删除

### 3. AI Task Queue — AI 自动消费看板

为看板生成专属 Token，粘贴给 AI Agent，Agent 即可完全自主地领取→执行→记录→完成任务，循环往复。

**支持标签**：为任务打上 `claude` / `gpt` / `gemini`，Agent 可据此过滤属于自己的任务。

#### 工作流程

```
1. GET  /api/agent                           ← 读取看板全貌（列、任务、元信息）
2. PATCH /api/tasks/:id/move                 ← 领取任务（移入 In Progress）
3. POST  /api/tasks/:id/comments             ← 记录计划
4. PATCH /api/tasks/:id/checklist/:itemId    ← 逐步勾选子任务
5. PATCH /api/tasks/:id                      ← 写入产出物
6. POST  /api/tasks/:id/comments             ← 总结
7. PATCH /api/tasks/:id/move                 ← 完成（移入 Done）
8. 回到第 1 步
```

#### 快速开始

1. 打开看板 → 右上角 **Agent Tokens** → 创建 Token
2. 点击 **Copy prompt** — 完整 Prompt 含 Token 和 API 地址
3. 粘贴给 Claude / GPT / 任意 Agent，立刻开始工作

```bash
# 验证连通性
curl https://opc.ruilisi.com/api/agent \
  -H "Authorization: Bearer opc_board_xxxxx"
```

#### Agent API 速查

所有请求携带 `Authorization: Bearer opc_board_xxxxx`，Token 锁定在单个看板。

| 操作 | 方法 & 路径 | Body |
|------|------------|------|
| 读取看板快照 | `GET /api/agent` | — |
| 获取任务详情 | `GET /api/tasks/:id` | — |
| 创建任务 | `POST /api/tasks` | `{ columnId, title, content? }` |
| 更新任务 | `PATCH /api/tasks/:id` | `{ title?, content?, dueDate? }` |
| 移动任务 | `PATCH /api/tasks/:id/move` | `{ columnId }` |
| 添加评论 | `POST /api/tasks/:id/comments` | `{ content }` |
| 勾选清单项 | `PATCH /api/tasks/:id/checklist/:itemId` | `{ checked: true }` |
| 添加清单项 | `POST /api/tasks/:id/checklist` | `{ text }` |

#### 安全设计

| 特性 | 说明 |
|------|------|
| 看板隔离 | Token 只能访问创建它的看板 |
| 只存哈希 | 服务器存储 SHA256 哈希，明文不落库 |
| 随时吊销 | 在「Agent Tokens」对话框删除即时失效 |
| 前缀识别 | 所有 Token 以 `opc_board_` 开头，便于日志过滤 |

### 4. 组织 (Organizations)

- **多组织切换**：左上角工作区选择器，在个人看板与多个组织间自由切换
- **角色权限**：`owner > admin > member > viewer` 四级权限，控制成员对文件库、看板的操作能力
- **成员管理**：在组织设置中查看、移除成员
- **邀请链接**：生成含过期时间（1小时/1天/7天/30天）和最大使用次数的邀请链接，一键分享

### 5. 文件库 (Org File Library)

组织级别的共享文件管理系统，支持任意格式文件。

- **文件夹树**：左侧折叠式文件夹树，支持创建、重命名、删除文件夹（删除时文件移至根目录）
- **直传七牛**：浏览器直接上传至七牛云 CDN，绕过服务器，**无文件大小限制**
- **文件操作**：右键菜单支持重命名、移动到文件夹、添加/移除标签、复制链接、下载、删除
- **文件预览**：内置预览模态框，支持图片、PDF（iframe）、视频、音频、代码/文本；其他格式提供下载
- **标签系统**：管理员创建彩色标签，成员为文件打标签；顶栏过滤器按标签筛选文件
- **搜索与排序**：实时搜索（300ms 防抖），按名称/大小/日期排序，支持升/降序
- **实时同步**：SSE 推送，文件上传/重命名/移动/删除/标签变化即时同步给所有在线成员

```
文件库 URL：/orgs/:orgId/files
```

### 6. Sentry 集成

无需离开 OPC，在看板内直接管理项目错误。

- **多项目配置**：在设置中添加多个 Sentry 配置（organization slug + auth token），关联不同项目
- **错误列表**：按项目查看 Sentry Issues，支持分页
- **一键解决**：直接在 OPC 内删除/解决 Sentry Issue，无需跳转到 Sentry 后台

```
Sentry 视图 URL：/orgs/:orgId/sentry
```

### 7. 实时协作 (SSE Realtime)

OPC 内置两个独立的实时通道，基于 Server-Sent Events（无需 WebSocket，无外部依赖，单进程零配置）。

#### 看板实时同步

订阅 `GET /api/boards/:boardId/events`，推送事件：

| 事件 | 触发时机 |
|------|----------|
| `task.moved` | 任务被拖拽或移动 |
| `task.updated` | 任务内容/标题/日期更新 |
| `task.created` | 新任务创建 |
| `task.deleted` | 任务删除 |
| `comment.added` | 新评论 |

#### 文件库实时同步

订阅 `GET /api/orgs/:orgId/file-events`，推送 12 种事件：

`file.uploaded` · `file.renamed` · `file.moved` · `file.deleted` · `file.tag_added` · `file.tag_removed` · `folder.created` · `folder.renamed` · `folder.deleted` · `tag.created` · `tag.updated` · `tag.deleted`

### 8. 七牛云存储

- 在 **Settings → Qiniu Storage** 中配置 AccessKey、SecretKey、Bucket、Domain、上传路径前缀
- 支持任务附件（图片粘贴直传）和文件库两套上传场景
- 文件库采用**客户端直传**（上传 Token 由服务器签发），服务器零带宽消耗，无文件大小限制
- 文件 MD5 去重：相同内容不重复存储

### 9. 认证与安全

- **Lingti OAuth**：统一登录，支持自部署 Lingti Server
- **JWT Cookie**：`opc_session` HttpOnly Cookie，服务端签发/验证
- **Bearer Token**：API Tokens 支持（`opc_board_` 前缀），用于 Agent 和 CLI 集成
- **中间件鉴权**：所有 API 路由通过 `proxy.ts` 统一校验，注入 `x-user-id`

### 10. 本地文件系统浏览 (Base Folder)

在看板设置中配置一个服务器本地路径作为「Base Folder」，供 AI Agent 读取代码目录结构，方便 Agent 理解项目文件组织。

---

## 快速开始

### 环境要求

- Node.js 20+ / Bun 1.x
- PostgreSQL 15+

### 安装

```bash
git clone https://github.com/ruilisi/opc
cd opc
bun install
```

### 配置

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/opc"

# JWT 签名密钥（任意随机字符串）
JWT_SECRET="your-secret-key"

# Lingti OAuth（自部署或使用 game.lingti.com）
LINGTI_OAUTH_CLIENT_ID="your-client-id"
LINGTI_OAUTH_CLIENT_SECRET="your-client-secret"
LINGTI_OAUTH_REDIRECT_URI="http://localhost:3000/oauth/callback"

# 七牛云（可选，也可在 Settings 页面配置）
QINIU_ACCESS_KEY=""
QINIU_SECRET_KEY=""
QINIU_BUCKET=""
QINIU_DOMAIN=""
QINIU_FOLDER=""
```

### 启动

```bash
# 初始化数据库
bunx prisma migrate dev --name init

# 启动开发服务器
bun run dev
```

访问 `http://localhost:3000`。

### 生产部署

```bash
bun run build
bun run start
```

OPC 是无状态 Next.js 应用，可部署至任何支持 Node.js 的平台（Vercel、Railway、自托管 Docker 等）。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 组件库 | shadcn/ui (base-ui) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| 数据库 | PostgreSQL |
| 认证 | jose (JWT) + Lingti OAuth |
| 实时 | Server-Sent Events（内置，零依赖） |
| 拖拽 | @hello-pangea/dnd |
| Markdown 编辑器 | @uiw/react-md-editor |
| 文件存储 | 七牛云 SDK |
| 包管理 | Bun |

---

## 项目结构

```
src/
├── app/
│   ├── api/                    # API 路由
│   │   ├── agent/              # AI Agent API
│   │   ├── boards/             # 看板、列、标签、成员、Token、SSE
│   │   ├── tasks/              # 任务、清单、附件、评论、标签、成员
│   │   ├── orgs/               # 组织、成员、邀请、文件库、Sentry、SSE
│   │   ├── settings/           # 七牛、Sentry 配置
│   │   └── upload/             # 通用上传
│   ├── boards/                 # 看板页面
│   ├── orgs/[orgId]/
│   │   ├── files/              # 文件库页面
│   │   └── sentry/             # Sentry 视图
│   └── settings/               # 设置页面
├── components/
│   ├── board/                  # 看板组件（KanbanBoard, KanbanColumn, TaskDetailDialog…）
│   ├── files/                  # 文件库组件（FolderTree, FileIcon, FilePreviewModal…）
│   ├── shared/                 # 通用组件（AppShell, UserAvatar…）
│   └── ui/                     # shadcn/ui 基础组件
├── lib/
│   ├── auth.ts                 # JWT 工具
│   ├── hooks/                  # useBoardSubscription, useOrgFileSubscription
│   ├── i18n.tsx                # 中/英双语
│   ├── prisma.ts               # Prisma 单例
│   ├── qiniu.ts                # 七牛上传/删除
│   ├── realtime.ts             # SSE pub/sub（EventEmitter）
│   └── session.ts              # Cookie 会话
├── proxy.ts                    # 路由鉴权中间件
└── types/                      # 共享 TypeScript 类型
```

---

## 贡献

OPC 完全开源，欢迎任何形式的贡献。

- **提 Issue**：[github.com/ruilisi/opc/issues](https://github.com/ruilisi/opc/issues)
- **提 PR**：Fork → 新建分支 → 修改 → PR
- **分享**：把 OPC 介绍给有需要的朋友

---

## 路线图

- [ ] AI 自动拆解复杂任务，生成周报
- [ ] 时间线 (Gantt) 视图
- [ ] 移动端优化
- [ ] 多语言扩展

---

## 结语

这个工具不是为了让你工作更多，而是为了让你能更有尊严、更从容地去创造价值。

如果它帮到了你，请给它一个 Star，或者分享给同样在路上的同路人。

**License: MIT**
