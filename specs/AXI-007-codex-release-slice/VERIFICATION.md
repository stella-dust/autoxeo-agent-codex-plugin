# AXI-007 verification

Date: 2026-08-22

## Passed locally

- `npm ci`
- `npm run check`: 7 test files, 14 tests and the production WebUI build.
- `npm run validate`: 3 skills.
- `npm run smoke:mcp`: 15 tools.
- `npm run smoke:webui`: six workflow nodes.
- Official Codex Plugin validator: passed through an isolated PyYAML runtime.
- Desktop and 390px UI review: no horizontal overflow or browser console error.

## External gates

- Public GitHub CI and immutable `v0.4.0` prerelease must pass.
- Clean Codex install, restart, OAuth and one public Cloud task must pass against
  the restored `agent.autoxeo.com` deployment.
- Payment and four non-DeepSeek provider adapters remain unavailable.
