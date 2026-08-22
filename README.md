# AutoXEO Agent for Codex

公开的 Codex Plugin，用于运行可复测的中国 GEO 工作流。它包含三个 GEO
Skills、本地 stdio MCP、仅回环地址可见的工作台、项目 Artifact 索引和
AutoXEO Cloud 适配器。Cloud、Admin、供应商密钥、客户数据和 Credit
权威账本不在本仓库。

首个真实 Provider 切片是 DeepSeek 官方 API。豆包、千问、腾讯元宝和
Kimi 会显示真实的 `configuration_required` / `eligibility_required`
状态，在官方 API 与账号完成验证前不会伪装为可用。

## GitHub Release 本地安装

从 GitHub Release 下载 `autoxeo-codex-plugin-marketplace-<version>.tar.gz` 与 `SHA256SUMS`，先校验再解压：

```bash
shasum -a 256 -c SHA256SUMS
tar -xzf autoxeo-codex-plugin-marketplace-<version>.tar.gz
codex plugin marketplace add /absolute/path/to/autoxeo-codex-plugin-<version>
codex plugin add autoxeo-agent@autoxeo
```

安装或升级后新建 Codex task。发行包默认只连接
`https://agent.autoxeo.com`。不要在 Plugin 环境、Skill 或项目报告中写入
Provider Key；真实采集凭据只配置在 AutoXEO Cloud。

## 开发环境联调

运行时不提供 Mock 采集。未连接 Cloud 时本地 Workspace、知识 Wiki、六节点模板和产物预览仍可用；
采集、Credit 与权威状态失败关闭。本地开发 Cloud 时才覆盖生产默认 origin：

```bash
export AUTOXEO_CLOUD_BASE_URL=http://127.0.0.1:3000
# 可选；未设置时使用 ~/Documents/AutoXEO_Workspace
export AUTOXEO_WORKSPACE_ROOT=/absolute/path/to/AutoXEO_Workspace
```

随后通过 `start_account_connection` 或 WebUI“账号与云服务”连接官网已有 AutoXEO 账号。不要把 Cloud
origin 以外的凭据写入环境、仓库、Skill、报告或诊断日志。

登录后先用 `get_account_overview` 读取可见组织与项目，再调用 `bind_cloud_project`（或在 WebUI 的
“当前工作区绑定”中选择）把本地 Workspace 绑定到一个 Cloud 项目，并显式设置本任务 Credit 上限。
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
