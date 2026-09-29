# 天琴 Lyra

个人 AI 智能体。把目标变成计划、跟进任务、沉淀记忆、主动提出想法；涉及你设备与网络的操作先请你批准，每一步都留下审计痕迹。

前端由 React 19 与 Vite 实现，桌面端由 Tauri 2 承载，同一套前端代码同时提供网页版与桌面版。

## 下载

Windows 安装包在 [Releases](https://github.com/fangzhouxiaohai/muse-pro/releases/latest) 页面下载，推荐使用安装程序 `Lyra_0.2.0_x64-setup.exe`。详细文件说明见文末的下载安装包一节。

## 功能一览

| 能力 | 说明 |
| --- | --- |
| 对话式智能体 | 流式回复、多轮工具执行循环（最多 6 轮）、可随时停止；每一步执行实时可见 |
| 目标与计划 | 目标卡（为什么做 / 状态 / 进度）、「生成计划」拆解 3-6 步、任务勾选与独立任务区 |
| 想法 | 天琴基于目标、任务、记忆与兴趣主动生成 2-4 条行动建议，采纳即建任务或转入对话 |
| 今日简报 | 结合目标推进、待办与兴趣关键词生成简报，帮助决定今天把精力放在哪里 |
| 记忆 | 对话中自动沉淀长期信息，可置顶、手动添加、逐条遗忘；记忆注入每一轮提示 |
| 资料库 | 本地文本资料 + 天琴生成的 Markdown 文档；支持预览、加入对话、新建文本 |
| 审批与权限 | 打开网页、读取网页、读取文件、写入文件四类操作逐条批准；可在设置中按类目切换「自动批准」，切换本身也记入审计 |
| 审计 | 已执行与已计划的事件按时间线留痕，可按行动 / 审批 / 对话过滤 |
| 全局搜索 | Ctrl+K 跨对话、目标、任务、记忆、资料与审计检索，命中即跳转 |
| 数据迁移与备份 | 自动迁移旧版 Muse Pro 数据；一键导出 / 导入 JSON 完整备份 |
| 主题与响应式 | 暖色亮色主题与深色主题，覆盖桌面、平板与移动端布局 |

## 运行环境

- Node.js 20.19 及以上版本
- 桌面构建需要 Rust 工具链（rustup 安装 stable 并包含 cargo 组件）与对应平台的 Tauri 系统依赖

## 常用命令

```sh
npm install         # 安装依赖
npm run dev         # 启动开发服务器（网页版）
npm test            # 运行领域模型单元测试
npm run build       # 类型检查并构建前端产物
npm run tauri dev   # 启动桌面端开发模式
npm run tauri build # 构建当前平台的安装包
```

在 Windows 上构建 Windows 安装包，在 macOS 上构建 macOS 应用。跨平台产物分别由对应系统的构建环境生成。

Windows 构建完成后产物位于 `src-tauri/target/release`：

| 产物 | 说明 |
| --- | --- |
| lyra.exe | 免安装的可执行文件 |
| bundle/msi/Lyra_0.2.0_x64_zh-CN.msi | 简体中文 MSI 安装包 |
| bundle/msi/Lyra_0.2.0_x64_en-US.msi | 英文 MSI 安装包 |
| bundle/nsis/Lyra_0.2.0_x64-setup.exe | NSIS 安装程序，可在安装时切换语言 |

macOS 构建会生成 `.app` 与 `.dmg`，需要在 macOS 环境中执行。

## 模型接入

在工作空间的设置中填写兼容对话接口的完整地址、模型名称和密钥。

| 预置服务 | 接口地址 | 模型名称 |
| --- | --- | --- |
| 深度求索 | https://api.deepseek.com/v1/chat/completions | deepseek-chat |
| 月之暗面 | https://api.moonshot.cn/v1/chat/completions | moonshot-v1-8k |
| 本地 Ollama | http://localhost:11434/v1/chat/completions | qwen2.5:7b |

模型服务需要支持函数调用。远程接口必须使用 https，只有本机地址允许 http。网页版还需要模型服务允许浏览器跨域请求，桌面版通过 Tauri 的 http 插件发起请求，不受浏览器跨域限制。

接口密钥只保存在当前会话的内存中，刷新页面或重启应用后需要重新填写。

## 数据与权限

- 对话、目标、任务、记忆、想法、资料与审计记录保存在当前设备的本地存储中；为控制体积，最多保留 24 个会话、每个会话最近 80 条消息、最近 6 份资料各保留前 2.4 万字，记忆与想法分别保留 120 与 40 条。
- 从旧版 Muse Pro 升级时，首次启动会自动迁移既有数据（会话、任务、目标、资料、审批与审计记录全部保留）。
- 选择的文本文件不会被改写；内容只在用户发送消息或执行操作时提交给所配置的模型服务。
- 读取或写入本机文件、打开或读取外部网页，默认必须先经过审批；在设置中可按类目切换为自动批准，切换本身也会记入审计。
- 桌面端写入文件时拒绝系统目录，并限制单次内容在 200 KB 以内。
- 审计记录保留事件类型、时间和目标，不存储接口密钥。

当前版本是单设备工作台，不提供账户同步、后台自动执行与手机端原生应用。

## 目录结构

```
├── index.html
├── package.json
├── vite.config.ts
├── src                      前端源码
│   ├── main.tsx             应用入口
│   ├── App.tsx              主编排：智能体循环、审批等待、主动生成、持久化
│   ├── core.ts              领域模型：目标、任务、记忆、想法、审批、审计、迁移、搜索
│   ├── ai.ts                模型接入：流式解析、工具集、系统提示词、网页抓取
│   ├── agent.ts             多轮智能体循环（工具结果回喂）
│   ├── proactive.ts         想法、简报与计划的主动生成
│   ├── platform.ts          平台桥接：桌面端本机文件读写
│   ├── format.ts            文案与时间格式化
│   ├── styles.css           设计令牌、组件样式、响应式规则、本地字体
│   └── components           界面组件
├── src-tauri                桌面端外壳
│   ├── Cargo.toml
│   ├── tauri.conf.json      窗口、安全策略与打包配置
│   ├── capabilities         权限清单
│   ├── icons                应用图标（天琴 Lyra）
│   └── src/lib.rs           自定义命令：读取、写入、探测本机文件
├── brand/lyra               品牌素材：mark.svg、logo.svg、应用图标源图
├── scripts                  图标渲染脚本
└── docs                     功能说明文档与联系方式素材
```

## 下载安装包

Windows 安装包可以从版本发布页直接下载：[Releases](https://github.com/fangzhouxiaohai/muse-pro/releases)

| 下载文件 | 说明 |
| --- | --- |
| [Lyra_0.2.0_x64-setup.exe](https://github.com/fangzhouxiaohai/muse-pro/releases/download/v0.2.0/Lyra_0.2.0_x64-setup.exe) | 推荐。安装程序，安装时可切换简体中文与英文 |
| [Lyra_0.2.0_x64_zh-CN.msi](https://github.com/fangzhouxiaohai/muse-pro/releases/download/v0.2.0/Lyra_0.2.0_x64_zh-CN.msi) | 简体中文安装包 |
| [Lyra_0.2.0_x64_en-US.msi](https://github.com/fangzhouxiaohai/muse-pro/releases/download/v0.2.0/Lyra_0.2.0_x64_en-US.msi) | 英文安装包 |

安装包适用于 Windows x64，需要 Windows 10 1809 及以上版本与 WebView2 运行时。macOS 的 `.app` 与 `.dmg` 需要在 macOS 环境中构建。

## 联系方式

- 邮箱：24519660@qq.com
- 微信：扫描下方二维码添加

<img src="docs/assets/wechat-qr.jpg" alt="微信二维码" width="260" />

## 文档

- [功能说明](docs/FEATURES.md)
- [开发计划](docs/PLAN.md)
