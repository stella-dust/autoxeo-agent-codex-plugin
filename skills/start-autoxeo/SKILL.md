---
name: start-autoxeo
description: 检查 AutoXEO Codex Plugin、本地工作区、账号、Cloud 项目、Brand Wiki 与问题集状态，并引导用户打开本地工作台、登录或开始第一个 GEO 项目。用户说“开始使用 AutoXEO”“怎么安装或登录”“建立本地目录”“打开工作台”或不知道下一步时使用。
---

# 开始使用 AutoXEO

把用户带到第一个真实价值：一个由用户亲自选择位置、采用中文目录规范、
可追溯且能由当前 Codex 会话继续工作的本地 GEO 工作区。不要把入门变成长教程。

## 执行

1. 调用 `get_started`，读取安装、工作区、账号、项目、品牌知识库与问题集状态。该工具只读，不创建目录。
2. 用不超过六行概括已完成项和唯一推荐下一步。不要列出全部 MCP 工具。
3. 用户要求“开始”“打开工作台”或使用本 Skill 的默认提示时，调用
   `open_local_workbench`，把返回的本地地址作为可点击入口交给用户。打开服务本身不创建工作区。
4. 工作区为 `not_configured` 时，引导用户在工作台中选择父目录并点击“创建工作区”。不得替用户猜测默认路径，不得用文件工具在后台创建 `AutoXEO_Workspace`。
5. 用户明确要求登录时，调用 `start_account_connection`，说明需在 AutoXEO
   官网使用已有账号批准设备；批准后调用 `poll_account_connection`。
6. 推荐下一步包含 `prompt` 时，直接把该提示用于当前任务，触发对应 GEO
   Skill，而不是让用户重新猜一句话。
7. 品牌知识库可以在未登录时先完成。只有官方采集、Evidence 与 Credit
   需要 Cloud 账号和项目绑定。

## 边界

- 不要求用户配置 `DEEPSEEK_CHAT_API_KEY` 或任何 Provider Key。
- Plugin 启用、`get_started`、`open_local_workbench` 都不得创建工作区目录。
- 新工作区的业务目录使用中文；`.autoxeo` 是唯一保留的隐藏技术目录。
- 不在入门阶段准备或提交计费操作。
- 不把本地状态说成 Cloud 权威状态。
- 不创建额外教程目录、演示数据或模拟 Evidence。
