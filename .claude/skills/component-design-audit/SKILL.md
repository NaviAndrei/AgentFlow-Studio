---
name: component-design-audit
description: >
  This skill should be used to audit UI components against AgentFlow
  Studio's component conventions. Activates when the user says "does this
  follow our patterns", "UI review", "check the component design", or
  "does this match COMPONENTS.md".
allowed-tools:
  - Read
  - Grep
---

## Procedure

1. Read `COMPONENTS.md` fully to load the current conventions (PanelRail
   usage, panel registry, z-index hierarchy, state ownership rules).
2. Identify the modified/target component(s) — use Grep to locate the
   file(s) if not already known.
3. For each component, check:
   - **Directory placement**: is the file in the directory COMPONENTS.md
     prescribes for its category (panel, node, modal, shared, etc.)?
   - **PanelRail usage**: if it's a panel, does it register through
     PanelRail rather than being mounted ad hoc?
   - **z-index hierarchy**: does any inline/Tailwind z-index value conflict
     with or duplicate the documented hierarchy in COMPONENTS.md?
   - **Panel registry**: is the panel added to the panel registry (not
     hardcoded inline JSX in a parent component)?
   - **Panel state ownership**: is panel open/visibility state stored in
     `uiStore` (or the relevant domain store per COMPONENTS.md), not local
     `useState`?
   - **No inline styles**: no `style={{ ... }}` — uses Tailwind classes or
     CSS Modules instead.
   - **Props interface**: does the component define an explicit
     `interface XProps { ... }` (or equivalent type) rather than untyped
     props?
4. Do not modify any files — this is a read-only audit.

## Output Format

Report findings as a severity table, one row per finding:

| Severity | Component | Issue | COMPONENTS.md Reference |
|----------|-----------|-------|--------------------------|
| High/Medium/Low | `path/to/Component.tsx` | Specific deviation found | Section/rule violated |

If no violations are found for a check, omit it from the table rather than
listing a "pass" row. End with a one-line summary of overall compliance.
