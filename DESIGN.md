---
name: AutoXEO Agent for Codex
description: A precise, evidence-led GEO operations workbench inside Codex.
colors:
  signal-violet: "#6b3fe7"
  signal-violet-deep: "#5030bb"
  instrument-ink: "#172022"
  muted-ink: "#607074"
  quiet-ink: "#56666a"
  paper: "#fbfcfc"
  field: "#f3f5f6"
  divider: "#d7dfe1"
  success: "#157a5b"
  warning: "#9a5a08"
  danger: "#b62e31"
typography:
  headline:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(22px, 2.1vw, 28px)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.065em"
rounded:
  sm: "7px"
  md: "11px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-violet}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 13px"
  button-primary-hover:
    backgroundColor: "{colors.signal-violet-deep}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.md}"
---

# Design System: AutoXEO Agent for Codex

## Overview

**Creative North Star: "The Evidence Instrument"**

The workbench behaves like a precise operating instrument, not a marketing
dashboard. Cool neutral surfaces make long sessions quiet; one signal violet
marks the current path, safe action and focus. Exact state, Evidence and cost
remain visually ahead of decoration.

**Key Characteristics:**

- Compact but readable operational density.
- Hairline-separated lists before walls of cards.
- Semantic colors communicate state only.
- The next safe action is always visually explicit.

## Colors

The palette is neutral and low-noise, with one rare signal color and three
strict semantic state colors.

**The One Signal Rule.** Violet is reserved for action, selection, progress and
focus; it is not ambient decoration.

**The Truth Color Rule.** Success, warning and danger appear only when the
underlying state warrants them.

## Typography

System UI fonts keep mixed Chinese and English crisp inside Codex. The compact
type ramp creates density through weight and spacing rather than miniature text;
monospace is reserved for paths, IDs and measurements.

**The Operational Hierarchy Rule.** One page headline leads, section titles
organize, body text explains, and uppercase labels only identify compact groups.

## Layout

A 46px truth bar sits above a 242px project rail and a fluid work canvas. The
optional 342px inspector appears only when detail is requested. Main content is
bounded at 1120px. Below 820px the rail and inspector become dismissible layers;
below 520px task state, action cost and workflow rows reflow vertically without
horizontal scrolling. Coarse pointers receive 44px hit targets.

## Elevation & Depth

The system is flat by default. Dividers and tonal surfaces establish most
hierarchy; restrained ambient shadow is limited to transient inspectors and the
primary next-action surface.

**The Flat-at-Rest Rule.** Persistent content does not float merely to look
important.

## Shapes

Controls use gently compact corners; larger task surfaces use a slightly broader
corner. Pills are reserved for small state labels. Hairline dividers carry more
of the structure than enclosing borders.

## Components

### Buttons

Primary actions use signal violet with white text; secondary actions use paper,
ink and a stronger neutral border. Hover deepens the action color and
focus-visible always carries a two-pixel signal outline.

### Status labels

Status labels pair an icon, explicit text and a softly tinted semantic surface.
Color never replaces the written state.

### Navigation

The active item uses a white surface, ink and a subtle structural shadow.
Navigation collapses into a 44px menu trigger on narrow screens.

### Next-action surface

The signature surface binds state, explanation, Credit impact and the single
safe action into one responsive unit.

## Do's and Don'ts

### Do:

- **Do** lead with verified state, next action and cost or impact.
- **Do** preserve keyboard focus, reduced motion and 44px coarse-pointer targets.
- **Do** keep complete loading, empty, offline, partial, success and error copy.

### Don't:

- **Don't** create a generic card wall or vanity-metric dashboard.
- **Don't** use gradients, glass effects or violet as decorative atmosphere.
- **Don't** imply provider availability, Evidence or billing outcomes that the
  backend did not prove.
