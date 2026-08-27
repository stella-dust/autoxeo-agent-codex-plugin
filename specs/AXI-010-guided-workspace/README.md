# AXI-010: Guided Codex workspace

Status: `superseded by AXI-011`
Date: 2026-08-22
Owner approval: the product owner requested a clear real-user path from Plugin
installation through local workspace creation, account login, workbench launch
and the first useful GEO workflow in the current development request.

> 2026-08-28 correction: automatic workspace creation in this specification is
> no longer valid. AXI-011 requires the user to select a location in the local
> workbench and explicitly confirm creation of a Chinese-layout workspace.

## First value

The first value is not a tour completion. It is a real local AutoXEO workspace
whose Brand Wiki can be created by the current Codex session, with Cloud login
and project binding visibly available for official collection.

## Journey

1. Install the signed public Plugin release and start a new Codex task.
2. Ask to start AutoXEO. Codex calls `get_started` and then
   `open_local_workbench`.
3. Superseded: see AXI-011 for the user-authorized location picker and explicit
   create action.
4. The local workbench shows one activation route: Plugin, workspace, Brand
   Wiki, account, Cloud project and frozen question set. Completed, current and
   optional states are explicit.
5. Account connection uses the existing AutoXEO device authorization flow.
   Provider credentials never enter the Plugin or Codex.
6. Codex uses the six GEO Skills for Wiki, questions, official collection,
   analysis, retest and deliverables. The workbench remains a companion surface
   for context, collection truth and artifacts.

## Product changes

- add a concise `start-autoxeo` Skill for “开始使用 / 怎么登录 / 打开工作台”
  requests;
- add a read-only `get_started` MCP tool and matching local setup API;
- add an activation route and copyable Codex prompts to `Context` without
  adding a fourth navigation surface;
- show how and where the local directory was created;
- use the official AutoXEO slash mark in the workbench and favicon;
- rewrite public installation and first-run documentation around the real
  journey rather than developer terminology.

## Acceptance

- a first-time user can identify installation, workspace, login, binding and
  first-Skill steps without knowing MCP tool names;
- installation and workbench entry use one recommended prompt;
- superseded by AXI-011: workspace creation is explicit, user-authorized and tested;
- `get_started` has no write, billing or open-world side effect;
- login and project binding retain existing secure device authorization and
  Cloud authority;
- first-use UI is optional, truthful and does not block local Brand Wiki work;
- desktop and narrow workbench views, keyboard focus, empty/error states,
  official Plugin validation and both smoke suites pass;
- the marketplace artifact is reproducible and can be installed into a fresh
  Codex task.
