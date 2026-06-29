---
name: inspector-panel
description: >
  This skill should be used when adding a new Inspector panel, editing
  panel components, or when the user says "add inspector for X",
  "add a panel", "new inspector section". Follows AgentFlow COMPONENTS.md
  PanelRail/Inspector/TraceLog conventions.
allowed-tools:
  - Read
  - Edit
---

## Procedure

1. Read COMPONENTS.md before touching any panel code — check z-index rules
   and the PanelRail layout contract.
2. Read an existing Inspector panel component as reference pattern.
3. New panels always go inside PanelRail — never render floating outside it.
4. Follow the z-index hierarchy exactly as defined in COMPONENTS.md.
5. Inspector sections use the project accordion/section component — no raw divs.
6. Connect panel display to Zustand: use `useSelectedNode()` selector pattern.
7. Panel components are read-only views — mutations go through store actions only.
8. Add the panel to the PanelRail registry, not directly into JSX.

## Verification

Open the app, select a node — confirm panel renders, updates on selection change,
and does not cause re-renders in unrelated components.
