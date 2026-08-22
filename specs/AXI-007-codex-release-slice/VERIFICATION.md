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
- `npm audit --omit=dev`: no known vulnerability; CI now blocks high or critical
  production advisories.

## External gates

- Public GitHub CI, immutable `v0.4.0` prerelease and clean Codex installation
  pass. A fresh Codex task must still accept the installed plugin after restart.
- OAuth and one public Cloud task must pass against the restored
  `agent.autoxeo.com` deployment.
- Payment and four non-DeepSeek provider adapters remain unavailable.
