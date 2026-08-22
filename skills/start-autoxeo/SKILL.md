---
name: start-autoxeo
description: 检查 AutoXEO Codex Plugin、本地工作区、账号、Cloud 项目、Brand Wiki 与问题集状态，并引导用户打开本地工作台、登录或开始第一个 GEO 项目。用户说“开始使用 AutoXEO”“怎么安装或登录”“建立本地目录”“打开工作台”或不知道下一步时使用。
---

# 开始使用 AutoXEO

把用户带到第一个真实价值：一个已经建立、可追溯且能由当前 Codex
会话继续工作的本地 GEO 工作区。不要把入门变成长教程。

## 执行

1. 调用 `get_started`，读取安装、工作区、账号、项目、Brand Wiki 与问题集状态。
2. 用不超过六行概括已完成项和唯一推荐下一步。不要列出全部 MCP 工具。
3. 用户要求“开始”“打开工作台”或使用本 Skill 的默认提示时，调用
   `open_local_workbench`，把返回的本地地址作为可点击入口交给用户。
4. 用户明确要求登录时，调用 `start_account_connection`，说明需在 AutoXEO
   官网使用已有账号批准设备；批准后调用 `poll_account_connection`。
5. 推荐下一步包含 `prompt` 时，直接把该提示用于当前任务，触发对应 GEO
   Skill，而不是让用户重新猜一句话。
6. Brand Wiki 可以在未登录时先完成。只有官方采集、Evidence 与 Credit
   需要 Cloud 账号和项目绑定。

## 边界

- 不要求用户配置 `DEEPSEEK_CHAT_API_KEY` 或任何 Provider Key。
- 不在入门阶段准备或提交计费操作。
- 不把本地状态说成 Cloud 权威状态。
- 不创建额外教程目录、演示数据或模拟 Evidence。
