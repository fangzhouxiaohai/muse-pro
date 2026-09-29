# 天琴 Lyra 开发计划

> 本文是本次重做的开发计划：对标 2026 年 9 月国际上最火的 "Muse"——Meta 发布的个人 AI 智能体
> Muse（2026-09-08 官宣，[官方公告](https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent)），
> 在本仓库现有「个人 AI 工作台」基础上完成一次以智能体体验为核心的全面重做，并新增若干合理功能。

## 一、调研结论

**对标对象：Meta Muse**（muse.ai）。它不是聊天机器人，而是「替你做事」的个人智能体：

| # | Meta Muse 的能力 | 官方描述 |
| --- | --- | --- |
| 1 | 把长期目标变成行动计划并持续跟进 | goal into action plan，track goals over time |
| 2 | 主动推进：关闭应用后仍继续工作，有变化或需要批准时回来找你 | proactively helps, works even after you close the app |
| 3 | 像和人聊天一样交互（文字/语音） | conversation-like interaction |
| 4 | 五个标签页：主对话 / 兴趣订阅流 / 想法(Ideas) / 目标 / 文件 | Yahoo Tech 上手评测 |
| 5 | 记忆：记住重要信息，可对单条信息「遗忘」 | memory with forget |
| 6 | Sentinel 监督代理：任何外发动作未经批准无法触网，敏感动作先请示 | separate supervising agent |
| 7 | 完整审计轨迹：做过什么、计划做什么全有记录 | complete audit trail |
| 8 | 粒度化应用连接权限（只读 vs 可发送） | granular app connections |
| 9 | 凭据隔离：看不到密码与支付方式；一次性虚拟卡 | Muse Secure VM + Stripe Link |
| 10 | 不用对话数据投广告、可选择退出训练 | privacy commitments |

参考来源：Meta 官方公告、[ai.meta.com/muse](https://ai.meta.com/muse/)、Yahoo Tech 上手评测（五标签页结构）、Digital Trends 报道。

**说明**：museapp.com（空间画布应用）已改名 Allume，不再是「最火的 Muse」，不作为对标对象。

## 二、复刻映射（Meta Muse → 天琴 Lyra）

本产品是**本地优先的单设备智能体**，无法也无需复刻云端 VM，映射关系如下：

| Meta Muse | 天琴 Lyra 实现 | 备注 |
| --- | --- | --- |
| 对话式智能体 | 对话视图：流式回复、多轮工具执行循环、可随时停止 | 引擎升级为多轮 agent loop |
| 目标 → 计划 → 持续跟进 | 目标页：目标卡（为何要做/状态/进度环）+「生成计划」+ 关联任务清单 | 计划由模型生成，落为目标卡内的计划步骤 |
| 主动推进与建议 | 想法页：智能体基于目标、记忆、近况生成「想法」卡片，采纳即建任务或转入对话 | 本地版在打开时生成，不做后台进程 |
| 兴趣订阅流 | 今日简报：兴趣关键词 + 工作台近况 → 生成一份简报 | 想法页顶部 |
| Ideas 提示示例 | 想法页内置提示词模板，一键带入对话 | |
| 文件/媒体标签 | 资料库：本地文本资料 + 模型生成文档（工件） | |
| 记忆与遗忘 | 记忆页：对话中自动沉淀（save_memory 工具）+ 手动添加 + 置顶 + 逐条遗忘 | 记忆注入每轮系统提示 |
| Sentinel 审批 | 审批流升级：四类操作（打开网页/读取网页/读取文件/写入文件）每类可设「每次询问 / 自动批准」，全程留痕 | 对应粒度化权限 |
| 完整审计轨迹 | 审计页时间线，覆盖已执行与已计划（想法、待审批）事件 | 新增事件类型 |
| Muse Secure VM | 本地优先存储、密钥仅存内存不落盘、写入拒绝系统目录、200 KB 上限 | README 说明差异 |
| 一次性虚拟卡、表单填写、WhatsApp/iOS/Android | 不实现 | 单设备本地版的合理边界 |

## 三、命名与品牌

**产品名：天琴 Lyra**

- Muse 是希腊神话中掌管灵感的女神；里拉琴（Lyra）是缪斯的乐器，也是夜空中的天琴座（织女星所在）。
- 「从前缪斯拨动琴弦给人灵感；现在天琴为你做事。」——既承接 Muse 的语义，又不是它的音译，避开同名产品。
- 中文名「天琴」，国际名「Lyra」，副标语「你的私人 AI 智能体」。

**LOGO**（`brand/lyra/`）：

- 图形：深夜蓝渐变圆角方形底上一把星座线风格的里拉琴——双弧臂 + 四根弦，琴顶一颗四芒星（织女星），缀三颗小星；金色线条，呼应「暗夜里的指引」。
- 交付物：`mark.svg`（应用图标）、`logo.svg`（横版组合）、应用内 `LyraMark` React 组件；
  Tauri 全套图标由 `tauri icon` 从 1024px 渲染图重新生成。
- 版本升级 0.1.0 → 0.2.0，`productName` 改为 `Lyra`，安装包名变为 `Lyra_0.2.0_x64-*`。

## 四、技术设计

### 4.1 领域模型（`src/core.ts` 重写，保持纯函数可测）

```ts
Task        { id, goalId?, title, note, done, createdAt }
Goal        { id, title, why, status: active|paused|achieved, plan: {title, detail}[], planUpdatedAt?, createdAt }
Memory      { id, content, pinned, source: 对话沉淀|手动添加, createdAt }
Suggestion  { id, title, detail, status: new|accepted|dismissed, createdAt }   // 想法
Briefing    { content, generatedAt, interests: string[] }                      // 今日简报
Permissions { open_url|fetch_url|read_file|write_file: 'ask'|'auto' }          // 粒度权限
Settings    { endpoint, model, permissions, interests }                        // 密钥永不落盘
WorkspaceState { version: 2, sessions, activeSessionId, goals, tasks, memories,
                 suggestions, briefing, files, approvals, audit, settings }
```

- 审计新增事件：`goal_plan_created / memory_saved / memory_forgotten / artifact_created /
  suggestion_created / suggestion_accepted / suggestion_dismissed / briefing_generated /
  settings_updated / data_imported / data_exported`。
- `migrate()`：把 v0.1（`muse-pro-workspace-v2`）数据迁入新模型（任务/目标/会话/资料/审批/审计全保留）。
- `searchWorkspace()`：跨会话、目标、任务、记忆、资料、审计的统一搜索（Ctrl+K）。
- `exportState()/importState()`：JSON 全量备份与恢复。

### 4.2 智能体引擎（`src/ai.ts` 重写 + `src/proactive.ts` 新增）

- **多轮 agent loop**（最多 6 轮）：模型输出 → 执行工具 → 结果以 tool 消息回喂 → 继续，直到给出最终回答。
- 工具集（9 个）：`create_task`、`create_goal`、`propose_plan`、`save_memory`、`create_artifact`、
  `request_fetch_url`、`request_open_url`、`request_read_file`、`request_write_file`。
- **审批门内联**：外部操作经 `requestApproval()` 返回 Promise；权限为 auto 时直接放行（仍记录审计），
  为 ask 时挂起等待用户在审批条上批准/拒绝，拒绝结果同样回喂给模型。
- **proactive.ts**：`generateSuggestions()`（想法）与 `generateBriefing()`（简报）——把工作台上下文
  喂给模型，要求返回 JSON，宽松解析（容忍代码围栏），逐条落库。

### 4.3 界面与信息架构

侧栏导航：**对话 / 目标 / 想法 / 记忆 / 资料库 / 审计**（对应 Muse 五标签 + 记忆扩展），
其下保留多会话列表。新增：

- `GoalsView`：目标卡（状态徽标、进度环、计划步骤、关联任务勾选、生成计划/暂停/达成/删除、围绕目标发起对话）。
- `IdeasView`：今日简报卡 + 想法卡片流（采纳为任务 / 转入对话 / 搁置）+ 提示词模板。
- `MemoryView`：记忆列表（来源、时间、置顶、遗忘）+ 手动添加。
- `SearchDialog`：Ctrl+K 全局搜索，命中即跳转。
- `SettingsDialog` 扩展：模型接入、权限矩阵、兴趣关键词、数据导出/导入、关于（LOGO 与版本）。
- `ChatView`：欢迎页改为品牌星空插画（去二进制 hero 图），角色名「天琴」，步骤流展示工具执行。

视觉沿用现有暖色纸感设计系统（CSS 令牌、无 UI 库），为其扩展目标卡/记忆/想法/搜索对话框等组件样式。

### 4.4 桌面壳与工程

- `tauri.conf.json`：productName=Lyra、identifier=com.lyra.agent、窗口标题、描述、0.2.0。
  （identifier 变更会使 WebView 本地存储重置一次，旧数据由网页端 localStorage 迁移路径兜底，README 说明。）
- `Cargo.toml` 包名改为 `lyra`，同步 `main.rs` 的库引用；`package.json` 改名升版。
- 图标：SVG → 1024 PNG（`@resvg/resvg-js`）→ `tauri icon` 全量重生成。

## 五、实施阶段

| 阶段 | 内容 | 交付物 |
| --- | --- | --- |
| P0 | 品牌与计划 | 本文档、`brand/lyra/*`、全套图标 |
| P1 | 领域模型 | `core.ts`、`format.ts`、`core.test.ts`（含迁移/搜索/导出测试） |
| P2 | 智能体引擎 | `ai.ts`（多轮循环）、`proactive.ts` |
| P3 | 界面 | `App.tsx`、`components/*`、`styles.css` |
| P4 | 配置与验证 | `index.html`、`tauri.conf.json`、`Cargo.toml`、`package.json`；vitest + vite build 全绿 |
| P5 | 桌面打包 | `npm run tauri build` 产出 NSIS/MSI 并核对 |
| P6 | 文档与发布 | README、FEATURES 重写；git 提交并推送 |

## 六、验收标准

1. `npm test` 全部通过（含新增：计划、记忆、想法、权限、迁移、搜索、导出用例）。
2. `npm run build` 类型检查与构建通过。
3. `npm run tauri build` 产出 `Lyra_0.2.0_x64-setup.exe` 与双语 MSI。
4. 复刻要点逐条落地（第二节映射表），新增功能可用（搜索/导出/迁移/模板）。
5. 安全性质保持：密钥不落盘、外部操作必经审批或明确设置自动、全程审计、系统目录写入拒绝。
