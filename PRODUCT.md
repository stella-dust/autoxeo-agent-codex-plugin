# Product record

## Positioning

AutoXEO Agent for Codex is a public Codex Plugin that turns a user's project
workspace and AutoXEO Cloud account into an auditable China GEO operating loop:
Brand Wiki, reproducible questions, official-provider collection, Evidence,
analysis and durable reports.

## Operating context

- Primary user: a Chinese brand or agency GEO operator already working in
  Codex.
- Primary job: understand the next safe action, run it with an explicit budget,
  and retain the evidence and receipt needed to reproduce or audit the result.
- Frequency: repeated daily research and scheduled monitoring, with occasional
  account/project setup.
- Environment: a local project workspace plus a private AutoXEO Cloud account.

## Evidence on hand

The inherited v0.3.3 implementation has a local loopback workbench, local MCP,
three GEO Skills, Cloud device login, account/project binding, question-set
freeze, capture preflight/start/status, Evidence-aware reporting and release
packaging. AXI-007 must re-verify all of these in the new public repository.

## Product principles

1. Show the authoritative state and the next safe action, never generic
   “processing”.
2. Provider credentials never enter Codex or the Plugin.
3. External and billed actions use prepare, confirm, commit and receipt.
4. Local artifacts remain useful offline; Cloud facts never become local
   guesses.
5. Fixture output is test evidence only and never `observed` provider Evidence.
6. Payment and unavailable Provider APIs remain honest configuration gates.

## Explicit assumptions for AXI-007

The owner has fixed Codex as the only host for this release, DeepSeek as the
only real Provider test slice, `agent.autoxeo.com` as the Cloud/Admin origin,
and visual quality/consistency as release requirements. These assumptions are
approved for implementation on 2026-08-22.
