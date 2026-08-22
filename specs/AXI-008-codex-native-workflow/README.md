# AXI-008: Codex-native GEO workflow

Status: `approved`
Date: 2026-08-22
Owner approval: this implementation is authorized by the product owner in the
current development request.

## Decision

AutoXEO for Codex is not a smaller copy of the historical Desktop product.
Codex is the reasoning runtime. Skills instruct the current Codex session to
research questions, maintain a workspace Brand Wiki, interpret deterministic
collection data, compare retests and author deliverables. The Plugin never
calls a second chat model and has no `DEEPSEEK_CHAT_API_KEY`.

Cloud is used only where a shared authority or external execution is required:
AutoXEO account and project context, official-provider collection, Evidence,
Job state and Credit receipts. Provider credentials remain server-side.

## Product shape

- Conversation is the primary UI. Every workflow starts from a Skill.
- The local workbench is a companion surface for account connection, project
  binding, official collection status and workspace artifacts. It is not a
  six-node workflow or a second SaaS dashboard.
- Brand Wiki source, question drafts, analysis notebooks and reports are local,
  versionable workspace artifacts. A frozen question set and collection result
  become Cloud records only through an explicit prepare/confirm operation.
- Deterministic scripts validate schemas and calculate facts. Codex interprets
  those facts and writes recommendations. Scripts never embed an LLM call.

## Required Skills

1. `manage-brand-wiki`
2. `research-geo-questions`
3. `run-official-monitoring`
4. `analyze-geo-baseline`
5. `compare-geo-retest`
6. `produce-geo-deliverables`

The methodology uses the 宜人到家 materials only as a pattern source: evidence
tiers, reproducible question sets, metric provenance, baseline/retest parity,
and layered deliverables. No customer name, result or source data ships in the
public Plugin.

## Acceptance

- package contains no chat-provider key or chat-provider client;
- six Skills validate and include deterministic, no-LLM helper scripts where
  applicable;
- account connection reaches the production Cloud device authorization flow;
- local workbench exposes exactly Context, Collections and Artifacts;
- frozen question preparation and official collection remain explicit,
  idempotent Cloud operations;
- desktop and narrow viewport UI, keyboard, reduced motion and security smoke
  checks pass;
- public archive, checksum and SBOM are reproducible.

