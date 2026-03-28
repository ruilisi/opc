# OPC (One Person Company) — 守护每一个独自奔跑的灵魂

> **”一个人，也可以是一支军队。”**
> 这是一款为独立创业者、自由职业者及 1–10 人精干团队量身打造的极简项目管理系统。它不只是为了管理任务，更是为了守护你最宝贵的资源：**注意力与时间**。

## 项目介绍

你每天要打开几个 SaaS 软件？Jira、Notion、Slack、Figma、Sentry……每一个都要单独登录、单独跳转，90% 的功能你根本用不到，但那 90% 的冗余却在时刻分散你的注意力。SaaS 厂商不会为你精简，他们要卖的是功能的堆砌。

**OPC** 专为独立开发者、自由职业者和 1-10 人精干团队打造，解决两个核心问题：

**① 把几十个 SaaS 聚合成一张菜单**
好的 SaaS 工具都提供完整的 API。过去，要基于 API 做深度整合，需要大量工程投入。但今天，AI Vibe Programming 让这件事的门槛大幅降低——我们可以快速把你真正需要的那 10% 功能提炼出来，以最简洁的界面呈现，按需取用，像点菜一样自然。

**② 用 AI 驱动你的数据和管理流程**
项目管理不应止步于”记录任务”。看板任务直接变成 AI Agent 的 prompt，Agent 自动领取任务、写代码、生成 plan、push 到 GitHub —— 全程无需人工介入。人负责战略与创意，AI 负责执行与运营。

**功能亮点：**
- 🤖 AI Agent 自动消费看板任务，原生支持 `claude` / `gpt` / `gemini` 标签
- 🐛 Sentry 报错直接在 OPC 内查看并删除，无需跳转
- ⚡ ACP 一键提交，commit message 由 AI 生成，比手写更详细
- 📋 截图粘贴直传七牛 CDN，文件管理零负担
- 🔗 内置七牛云、自持 OAuth，扎根国内生态，开箱即用

开源：**[github.com/ruilisi/opc](https://github.com/ruilisi/opc)**，欢迎 Star / Fork / PR。
体验：**[opc.ruilisi.com](https://opc.ruilisi.com)**

---

## 演示视频

[![OPC Demo](https://files.lingti.com/images/opc-saas.png)](https://www.bilibili.com/video/BV1ANX1BwEdP/)

- 📺 Bilibili：[www.bilibili.com/video/BV1ANX1BwEdP](https://www.bilibili.com/video/BV1ANX1BwEdP/)
- 🎬 YouTube：[www.youtube.com/watch?v=5lKisD51_gA](https://www.youtube.com/watch?v=5lKisD51_gA)

---

## 感谢金主爸爸

- <a href="https://game.lingti.com"><img src="https://files.lingti.com/images/lingti-logo-圆形不带字.png" height="24" style="vertical-align:middle;display:inline-block;" /></a> **[灵缇AI加速](https://game.lingti.com)** - PC/Mac/iOS/Android 全平台游戏加速、全球首创热点加速、AI 及学术资源定向加速

---

## 它能为你分担什么？

### 1. 像呼吸一样自然的看板管理
- **自由流转**：基于 Trello 习惯的拖拽式看板，让工作流一目了然。
- **视觉分级**：8 种封面色与彩色标签，一眼识别优先级，拒绝信息过载。

### 2. 更有温度的任务细节
- **清单与进度**：拆解复杂的任务，看着进度条一点点填满，是创业路上微小而确定的成就感。
- **附件直传**：截图直接粘贴，自动上传至七牛云 CDN，让文档管理不再是负担。
- **协作空间**：支持个人与多组织切换，无论你是独自战斗，还是带队突围，它都能陪你共同成长。

### 3. Sentry 深度集成
- 无需在多个后台间反复跳转，直接在看板内掌握项目的健康状况，把错误消灭在萌芽状态。

### 4. 实时协作 — 多人同步，零刷新

OPC 内置基于 SSE（Server-Sent Events）的实时推送，无需 WebSocket，无需额外依赖。

- **看板实时同步**：任何成员移动卡片、创建/删除任务，所有在线用户立即看到变化
- **评论实时推送**：新评论出现，任务详情对话框自动更新，无需轮询
- **连接自动恢复**：断线后浏览器原生重连，无感知

```
用户 A 拖动卡片
  └─▶ PATCH /api/tasks/{id}/move
       └─▶ emitBoardEvent(boardId, { type: "task.moved", ... })
            └─▶ SSE 推送至所有订阅 /api/boards/{boardId}/events 的客户端
                 └─▶ 用户 B / C 的看板即时更新
```

### 5. AI Task Queue — 让 AI 自动消费看板任务

OPC 的看板可以直接作为 AI Agent 的任务队列使用。为看板生成一个专属 Token，把它丢给 Claude 或任何 AI，Agent 即可完全自主地领取任务、执行、记录结果、标记完成——循环往复，无需人工介入。

**任务标签**：为任务打上 `claude` / `gpt` / `gemini` 标签，Agent 可据此自动过滤属于自己的任务。

#### 工作原理

```
你（看板 Owner）
  │
  ├─ 点击「Agent Tokens」→ 创建 Token → 复制 Agent Prompt
  │
  └─▶ 粘贴给 AI Agent（Claude / GPT / 任意支持 HTTP 的 Agent）
            │
            ├─ GET  /api/agent               ← 读取看板全貌
            ├─ PATCH /api/tasks/:id/move     ← 领取任务（移入 In Progress）
            ├─ POST  /api/tasks/:id/comments ← 记录进度
            ├─ PATCH /api/tasks/:id/checklist/:item ← 勾选子任务
            └─ PATCH /api/tasks/:id/move     ← 完成后移入 Done
```

#### 快速开始

1. 打开看板，点击右上角 **Agent Tokens**
2. 输入名称（如 `claude-agent`），点击 **Create**
3. 点击 **Copy prompt** — 完整 Prompt 已含 Token 和 API 地址
4. 粘贴给 Claude，Agent 立刻开始工作

```bash
# 验证连通性
curl https://opc.ruilisi.com/api/agent \
  -H "Authorization: Bearer opc_board_xxxxx"
```

#### Agent 执行流程

```
1. GET /api/agent  →  了解看板结构与所有任务
2. 从 Todo 列选取最高优先级任务
   优先级顺序：dueDate 最近 → points 最高 → label urgent/p0 → 列表靠前
3. PATCH /api/tasks/{id}/move → In Progress  （正式领取）
4. POST  /api/tasks/{id}/comments            （说明计划，让人类可跟进）
5. 执行任务，逐步勾选 checklist
6. PATCH /api/tasks/{id}  content 写入产出物
7. POST  /api/tasks/{id}/comments            （总结）
8. PATCH /api/tasks/{id}/move → Done
9. 回到第 1 步
```

#### API 速查

所有请求携带 `Authorization: Bearer <token>`，Token 锁定在单个看板，无法访问其他项目数据。

| 操作 | 方法 & 路径 | Body |
|------|------------|------|
| 读取看板快照 | `GET /api/agent` | — |
| 获取任务详情 | `GET /api/tasks/{id}` | — |
| 创建任务 | `POST /api/tasks` | `{columnId, title, content?}` |
| 更新任务 | `PATCH /api/tasks/{id}` | `{title?, content?, dueDate?}` |
| 移动任务 | `PATCH /api/tasks/{id}/move` | `{columnId}` |
| 添加评论 | `POST /api/tasks/{id}/comments` | `{content}` |
| 勾选清单项 | `PATCH /api/tasks/{id}/checklist/{itemId}` | `{checked: true}` |
| 添加清单项 | `POST /api/tasks/{id}/checklist` | `{text}` |

#### Agent Prompt 模板

```
You are a task execution agent with access to a project board via REST API.

Base URL: https://opc.ruilisi.com/api
Auth header: Authorization: Bearer <token>

1. Call GET /api/agent to orient yourself (columns, tasks, meta.actions)
2. Pick the highest priority task from the Todo column
3. Move it to In Progress: PATCH /api/tasks/{taskId}/move  body: {columnId}
4. Comment before starting: POST /api/tasks/{taskId}/comments  body: {content: "Starting: <plan>"}
5. Do the work; tick checklist items as you go
6. Write results into task content: PATCH /api/tasks/{taskId}  body: {content: "<output>"}
7. Add summary comment, move task to Done
8. Repeat

Rules: always comment before starting · never delete tasks · if blocked, comment why and move back to Todo
```

#### 安全

| 特性 | 说明 |
|------|------|
| 看板隔离 | Token 只能访问创建它的看板，无法触及其他项目或账号 |
| 只存哈希 | 服务器存储 SHA256 哈希，明文不落库 |
| 随时吊销 | 在「Agent Tokens」对话框删除即时失效 |
| 前缀识别 | 所有 Token 以 `opc_board_` 开头，便于日志过滤 |

---

## 快速开始

只需几分钟，搭建属于你的“数字总部”：

```bash
# 克隆并进入项目
git clone https://github.com/ruilisi/opc
cd opc

# 安装依赖
bun install

# 配置环境变量
cp .env.local.example .env.local
# 填写你的数据库、OAuth 及七牛云配置

# 初始化数据库并启动
bunx prisma migrate dev --name init
bun run dev
```

现在，访问 `http://localhost:3000`，开始你的高效之旅。

---

## 我们在寻找这样的你

- **独立开发者 / 创作者**：一个人维护多个产品，需要清晰的脑图和任务追踪。
- **AI 创业者**：深度依赖 AI 工具，希望将管理与执行自动化。
- **精干的小团队**：讨厌大公司的冗余流程，追求扁平化与极致效率。

---

## 路线图：未来的路

- [ ] **AI 深度协作**：自动拆解复杂任务，生成周报，让你更懂自己的进度。
- [ ] **时间线视图**：从全局视角把控项目的生命周期。
- [ ] **移动端优化**：随时随地捕捉灵感。
- [ ] **多语言支持**：让全球的 OPC 都能链接在一起。

---

## 加入 OPC

OPC 是一个完全开源的项目，欢迎任何人参与共建。

### 你可以这样贡献

- **提 Issue**：发现 Bug 或有新功能想法，[开一个 Issue](https://github.com/ruilisi/opc/issues)
- **提 PR**：修复问题、新增功能、改善文档，直接提交 Pull Request
- **分享使用体验**：把 OPC 介绍给有需要的朋友，或写一篇使用心得

### 本地开发

```bash
git clone https://github.com/ruilisi/opc
cd opc
bun install
cp .env.local.example .env.local
bunx prisma migrate dev --name init
bun run dev
```

技术栈：Next.js 16 · TypeScript · Tailwind v4 · Prisma 7 · PostgreSQL · shadcn/ui

---

## 结语

这个工具不是为了让你工作更多，而是为了让你能更有尊严、更从容地去创造价值。

如果你觉得它帮到了你，请给它一个 Star，或者分享给同样在路上的同路人。

**License: MIT**
