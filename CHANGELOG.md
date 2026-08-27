# Changelog

## 0.7.0 - 2026-08-28

- Stop creating `~/Documents/AutoXEO_Workspace` during Plugin/MCP startup.
- Start the local workbench in an unconfigured, read-only state and require the
  user to choose a parent folder and explicitly confirm creation.
- Replace the visible workspace layout with Chinese directory and template
  names while retaining explicit read compatibility for existing legacy workspaces.
- Update all seven Skills, WebUI states, tests and public setup guidance to the
  same user-authorized workspace contract.

## 0.6.0 - 2026-08-22

- Add a read-only `get_started` contract and a dedicated onboarding Skill.
- Surface the exact local workspace path and a six-step activation route in the
  companion workbench. This behavior was superseded by the explicit selection
  flow in 0.7.0.
- Make local Brand Wiki creation the first useful outcome before Cloud login.
- Replace placeholder workbench identity with the official AutoXEO mark and
  favicon.
- Rewrite installation and first-run guidance around one recommended Codex
  prompt and the real account/device authorization flow.

## 0.5.0 - 2026-08-22

- Rebuild the Plugin around the current Codex session for Wiki, questions,
  analysis, retest and deliverables; remove the second dialogue-model key.
- Add secure device authorization, Cloud project binding, official collection,
  Evidence, Credit and local artifact workflows.
- Expand the bundle to six production GEO Skills and the three-surface local
  workbench.

## 0.4.0 - 2026-08-22

- Establish the public Codex-only repository and Apache-2.0 release boundary.
- Ship three GEO skills, fifteen MCP tools and the embedded operations workbench.
- Pin the production Cloud origin to `https://agent.autoxeo.com` while retaining
  an explicit local-development override.
- Add account, project, Credit, Evidence and six-node workflow states with
  fail-closed provider and billing behavior.
- Add CI, marketplace metadata, immutable release packaging and public security
  guidance.

Payment activation and the four non-DeepSeek official platform adapters remain
release gates and are not represented as available.
