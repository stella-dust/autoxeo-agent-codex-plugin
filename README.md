# AutoXEO Agent for Codex

公开的 Codex Plugin，用于运行可复测的中国 GEO 工作流。它包含七个
Codex-native Skills、本地 stdio MCP、仅回环地址可见的 companion workbench、
Brand Wiki 与 Artifact 协议，以及 AutoXEO Cloud 采集适配器。

问题生产、Brand Wiki、分析、复测和交付物都由当前 Codex 会话完成；插件
不会调用第二个对话模型，也不需要 `DEEPSEEK_CHAT_API_KEY`。Cloud 仅负责
账号/项目上下文、官方平台 API 采集、Evidence、Job 与 Credit Receipt。

首个真实 Provider 切片是 DeepSeek 官方 API。豆包、千问、腾讯元宝和
Kimi 会显示真实的 `configuration_required` / `eligibility_required`
状态，在官方 API 与账号完成验证前不会伪装为可用。

## 三分钟开始

### 1. 安装公开发行包

从 GitHub Release 下载 `autoxeo-codex-plugin-marketplace-<version>.tar.gz` 与 `SHA256SUMS`，先校验再解压：

```bash
shasum -a 256 -c SHA256SUMS
tar -xzf autoxeo-codex-plugin-marketplace-<version>.tar.gz
codex plugin marketplace add /absolute/path/to/autoxeo-codex-plugin-<version>
codex plugin add autoxeo-agent@autoxeo
```

安装或升级后新建一个 Codex task，然后只需说：

> 开始使用 AutoXEO：检查工作区状态并打开本地工作台。

### 2. 获得第一个本地成果

Plugin 会自动建立 `~/Documents/AutoXEO_Workspace`，无需先创建项目目录。
工作台会显示六步启动路线和唯一推荐下一步；首次使用会先引导当前 Codex
会话把你授权的品牌资料整理成可追溯 Brand Wiki。这一步不需要登录、Credit
或任何模型 Key。

### 3. 在正式采集前连接账号

当 Brand Wiki 就绪后，工作台会发起 AutoXEO 官网设备授权。使用你已有的
`agent.autoxeo.com` 账号批准设备，再选择组织、Cloud 项目和本任务 Credit
上限。Provider Key 只由管理员在 Cloud 后台配置，不进入 Plugin、Codex、
本地工作区或报告。

### 4. 完成真实 GEO 路线

在 Codex 中继续使用对应 Skill：Brand Wiki → 可复测问题集 → 官方 API
采集 → 基线分析 → 同题复测 → 交付物。工作台只保留三类伴随视图：
Context 显示账号与启动路线，Collections 显示官方采集与 Evidence 真相，
Artifacts 索引本地可审计产物。

发行包默认只连接 `https://agent.autoxeo.com`。不要在 Plugin 环境、Skill
或项目报告中写入 Provider Key；真实采集凭据只配置在 AutoXEO Cloud。

## 开发环境联调

运行时不提供 Mock 采集。未连接 Cloud 时本地 Workspace、Brand Wiki、问题/分析模板和产物预览仍可用；
采集、Credit 与权威状态失败关闭。本地开发 Cloud 时才覆盖生产默认 origin：

```bash
export AUTOXEO_CLOUD_BASE_URL=http://127.0.0.1:3000
# 可选；未设置时使用 ~/Documents/AutoXEO_Workspace
export AUTOXEO_WORKSPACE_ROOT=/absolute/path/to/AutoXEO_Workspace
```

随后通过 `start_account_connection` 或 WebUI `Context` 页面连接官网已有 AutoXEO 账号。不要把 Cloud
origin 以外的凭据写入环境、仓库、Skill、报告或诊断日志。

登录后先用 `get_account_overview` 读取可见组织与项目，再调用 `bind_cloud_project`（或在 WebUI 的
`Context` 中选择）把本地 Workspace 绑定到一个 Cloud 项目，并显式设置本任务 Credit 上限。
未绑定、问题集未冻结、余额不足或平台能力不可用时，正式采集均失败关闭且不会预留 Credit。

## 开发与验证

```bash
npm ci
npm run check
npm run validate
npm run smoke:mcp
npm run smoke:webui
```

本地预览：

```bash
npm run preview:webui
```

从 Codex 调用 `open_local_workbench` 也会启动相同 WebUI；MCP 和界面共享项目状态与领域命令。

## 仓库与发布边界

- 本仓库公开，Apache-2.0 授权；AutoXEO 名称与商标不随代码授权。
- Cloud 与 Admin 是独立私有仓库和独立发布物。
- 运行时没有假采集；fixture 只用于自动测试，不能生成 `observed` Evidence。
- 支付与四个待接入平台必须显示为尚未配置，不能宣传为已上线。

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要在公开 Issue 中附带
Token、Evidence 原文、客户文件或诊断日志。
