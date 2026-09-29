# 功能说明

本文记录天琴 Lyra 0.2.0 已实现的功能、交互路径与实现位置。对标 Meta Muse（2026-09 发布的个人 AI 智能体）的核心体验，所有界面文案为简体中文，不含表情符号。

## 一、对话式智能体

### 多轮工具循环

- 发送消息后，天琴按「模型输出 → 执行工具 → 结果回喂 → 继续」的循环推进，最多 6 轮，直到给出不再调用工具的最终回答。
- 每一轮的流式文本实时替换显示；工具执行以步骤流（进行中 / 已完成 / 等待中 / 失败）展示在消息内。
- 生成期间可随时点击停止按钮中断；中断后已有的步骤与文本保留。

实现位置：`src/agent.ts` 的 `runAgent`、`src/App.tsx` 的 `send` 与 `executeTool`。

### 工具集（9 个）

| 工具 | 说明 | 是否需要审批 |
| --- | --- | --- |
| create_task | 创建任务，可挂到某个目标下 | 否 |
| create_goal | 创建长期目标 | 否 |
| propose_plan | 为目标生成 3-6 步执行计划 | 否 |
| save_memory | 沉淀长期记忆（偏好、事实、承诺） | 否 |
| create_artifact | 生成 Markdown 文档存入资料库 | 否 |
| request_open_url | 在浏览器中打开外部网页 | 是 |
| request_fetch_url | 读取网页正文作为参考 | 是 |
| request_read_file | 读取本机文本文件 | 是 |
| request_write_file | 写入本机文件 | 是 |

实现位置：`src/ai.ts` 的 `controlTools`、`src/App.tsx` 的 `executeTool`。

### 审批门（Sentinel）

- 四类外部操作默认逐条审批：天琴提出请求后对话挂起，等待你在审批条上「批准并执行」或「拒绝」；拒绝的结果会回喂给模型，它会接受结果并调整方案。
- 在设置中可按类目切换为「自动批准」；自动批准的操作不再弹确认，但每一次执行（含参数与结果）仍完整记入审计。
- 写入文件始终拒绝系统目录（Windows 的 SystemRoot / System32，macOS 的 /System、/Library、/private），单次内容上限 200 KB。

实现位置：`src/core.ts` 的 `proposeAction` / `shouldAutoApprove`、`src/App.tsx` 的 `gate` 与 `resolveApproval`、`src-tauri/src/lib.rs` 的 `guard_target`。

## 二、目标与计划

- 目标页以卡片组织：标题、为什么做（why）、状态徽标（推进中 / 已暂停 / 已达成）、任务进度条（完成数 / 总数）。
- 「让天琴制定计划」为当前目标生成 3-6 步可执行计划，每步含标题与说明；已有计划的目标可一键重新生成。
- 任务勾选在目标卡内完成；未关联目标的任务集中在页面底部的独立任务区，支持内联添加。
- 「围绕目标对话」把目标标题预填进输入框；创建、暂停、恢复、达成与删除都留有审计事件。

实现位置：`src/components/GoalsView.tsx`、`src/core.ts` 的 `createGoal` / `attachPlan` / `goalProgress`、`src/proactive.ts` 的 `generatePlan`。

## 三、想法与今日简报（主动建议）

- 想法页顶部是「今日简报」：结合目标推进、待办、记忆与兴趣关键词生成一份不超过 300 字的简报，可随时刷新。
- 「让天琴想想」基于工作台现状生成 2-4 条行动建议（JSON 宽松解析，容忍代码围栏）；每条可「采纳为任务」（自动创建任务）、「去聊聊」（预填对话）或忽略。
- 提示词模板区提供 6 条常用指令，一键带入对话。
- 兴趣关键词在设置中维护，简报与想法都会结合它们。

实现位置：`src/components/IdeasView.tsx`、`src/proactive.ts` 的 `generateSuggestions` / `generateBriefing`、`src/core.ts` 的 `addSuggestion` / `acceptSuggestion` / `setBriefing`。

## 四、记忆

- 天琴在对话中通过 save_memory 自动沉淀长期信息（每轮最多两条）；重复内容自动去重。
- 记忆页支持手动添加、置顶与逐条遗忘；置顶的记忆在每轮提示中最先注入，其余按最近优先（合计最多 12 条）。
- 沉淀、置顶与遗忘都留有审计事件。

实现位置：`src/components/MemoryView.tsx`、`src/core.ts` 的 `saveMemory` / `forgetMemory` / `toggleMemoryPin` / `memoryContext`。

## 五、资料库

- 本地文本资料与天琴生成的文档统一收纳，支持预览（最多 2 万字）、加入对话、新建文本、删除。
- 桌面端可填写本机绝对路径直接读取；单文件上限 200 KB。
- 为控制体积，仅保留最近 6 份资料的完整内容（各 2.4 万字），更早的只保留元信息。

实现位置：`src/components/FilesView.tsx`、`src/core.ts` 的 `addFile` / `removeFile`、`src/platform.ts`。

## 六、审计

- 时间线覆盖全部事件类型：任务 / 目标 / 计划 / 记忆 / 想法 / 简报 / 资料 / 网页 / 文件 / 审批 / 对话 / 设置 / 数据导入导出。
- 顶部过滤（全部 / 行动记录 / 审批 / 对话）；待审批请求固定显示在页面顶部，可跨会话集中处理。
- 记录保留事件类型、时间与目标（网页地址、文件路径），不存储接口密钥；最多保留 400 条。

实现位置：`src/components/AuditView.tsx`、`src/core.ts` 的 `recordEvent` / `pendingApprovals`、`src/format.ts` 的 `EVENT_LABEL`。

## 七、全局搜索

- Ctrl+K（macOS 为 Cmd+K）打开全局搜索，一次覆盖：会话与消息、目标（含计划步骤）、任务、记忆、资料、审计事件。
- 命中结果显示视图类型与上下文片段，点击直接跳转到对应页面（对话命中还会切换到对应会话）。

实现位置：`src/components/SearchDialog.tsx`、`src/core.ts` 的 `searchWorkspace`。

## 八、数据迁移与备份

- 首次启动自动检测旧版 Muse Pro（v0.1）数据并迁移：会话、任务、目标（转为新目标卡）、资料、审批与审计记录全部保留，旧目标备注转入「为什么做」。
- 设置中可一键导出完整 JSON 备份（不含密钥），或导入备份恢复；导入会记入审计。

实现位置：`src/core.ts` 的 `migrateState` / `exportState` / `importState`、`src/App.tsx` 的 `exportWorkspace` / `importWorkspace`。

## 九、设置

- 模型接入：三个预置服务（深度求索 / 月之暗面 / 本地 Ollama）+ 自定义地址；接口地址校验（远程必须 https，仅本机允许 http）。
- 操作权限：四类外部操作分别设置「每次询问 / 自动批准」。
- 兴趣关键词：回车添加、点按移除，用于简报与想法生成。
- 数据：导出 / 导入完整备份。
- 关于：品牌标识、版本与隐私说明。
- 接口地址、模型名称、权限与兴趣随工作台数据持久化；密钥只保存在当前会话内存中，永不落盘。

实现位置：`src/components/SettingsDialog.tsx`、`src/core.ts` 的 `updateSettings` / `setPermission`。

## 十、品牌与视觉

- 应用标识：暗夜底色上的星座线里拉琴与织女星（`brand/lyra/mark.svg`），横版组合标识 `logo.svg`；全套应用图标由 `scripts/render-icon.mjs` 渲染源图后经 `tauri icon` 生成。
- 欢迎页为 CSS 星空插画（无二进制资源）；界面沿用暖色纸感设计系统，新增目标 / 想法 / 记忆 / 搜索 / 设置等组件样式与深色主题适配。

实现位置：`src/components/LyraMark.tsx`、`src/styles.css`、`brand/lyra/`、`scripts/render-icon.mjs`。

## 兼容性说明

- 桌面端标识从 `com.musepro.app` 变更为 `com.lyra.agent`，WebView 本地存储会重置一次；网页端的旧数据通过自动迁移保留。
- 网页版功能受限：不能读写本机文件（写入会提示改用桌面版）、需要模型服务允许跨域。
