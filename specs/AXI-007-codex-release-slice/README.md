# AXI-007 — Public Codex Plugin release

Status: `approved`
Date: 2026-08-22

## Outcome

A user installs AutoXEO from a public GitHub release, connects an existing
AutoXEO account, binds a Cloud project, manages local artifacts, freezes a
question set, confirms a DeepSeek collection budget and receives authoritative
Evidence and a Credit receipt without any Provider key entering Codex.

## Acceptance

- manifest and package validate as a Codex Plugin;
- typecheck, lint, tests, build and MCP/WebUI smoke checks pass;
- install, upgrade, restart recovery and uninstall are documented;
- loopback security and path-grant tests pass;
- loading, empty, offline, partial, permission, success and error UI states are
  keyboard accessible at desktop and mobile widths;
- the package contains no credential, private Cloud/Admin source or unsupported
  availability claim;
- immutable archive, checksum, SBOM and provenance are published.

Payment and the four Provider APIs beyond DeepSeek are visible only as honest
configuration/eligibility gates and are not release blockers.
