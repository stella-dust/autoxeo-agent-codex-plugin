---
name: AutoXEO for Codex
description: A Codex-native research folio for context, official collections and local artifacts.
colors:
  cobalt: "#1859d1"
  cobalt-deep: "#1044a4"
  graphite: "#16202b"
  slate: "#5b6775"
  slate-quiet: "#788594"
  masthead-muted: "#aeb8c4"
  masthead-divider: "#44505d"
  masthead-note: "#9fb0c2"
  masthead-copy: "#b9c4cf"
  masthead-stroke: "#667482"
  paper: "#fafbfc"
  canvas: "#eef1f4"
  folio: "#e3e8ed"
  divider: "#ccd4dc"
  divider-strong: "#9da9b6"
  authorization-line: "#b9c6d7"
  success: "#13745b"
  success-bright: "#2ab489"
  warning: "#9a5a08"
  warning-local: "#9a6530"
  danger: "#ae2d36"
  danger-line: "#d8abb0"
  danger-paper: "#fff5f5"
typography:
  family: "Avenir Next, SF Pro Text, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
  headline: "clamp(32px, 4.3vw, 56px) / 1.06 / 700"
  body: "14px / 1.55 / 400"
rounded:
  mark: "9px"
  control: "10px"
  navigation: "11px"
  surface: "14px"
  emphasis: "16px"
---

# Design System: The Research Folio

## Creative North Star

The local workbench feels like a live research folio sitting beside Codex, not
a miniature SaaS application. A graphite masthead establishes local truth, a
mist-grey folio indexes the three surfaces, and one cobalt signal identifies the
next safe operation. Wide paper ledgers carry facts without turning every row
into a card.

## Structure

- `Context`, `Collections` and `Artifacts` are the complete navigation.
- The first viewport leads with the product boundary and one exact next action.
- Account, Wiki and Cloud truths use separated ledger rows.
- Official platform capabilities use a network ledger, not KPI tiles.
- Artifact preview is the only persistent overlay and preserves file identity.

## Rules

1. Cobalt is reserved for action, focus and the active path.
2. Status color always has exact text; no decorative status dots.
3. Persistent surfaces rely on line and tone. Only the next-action ledger and
   transient preview may use shadow.
4. Body text stays at 14px; metadata never drops below 11px.
5. Controls name real actions. “Continue” and generic “Process” are forbidden.
6. No six-stage workflow, vanity metrics, gradients, glass or card wall.
7. Narrow layouts preserve all truth and actions in one column without
   horizontal scrolling; coarse-pointer targets reach 44px.
