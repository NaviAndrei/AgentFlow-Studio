---
name: decisions-audit
description: >
  This skill should be used BEFORE modifying any code that seems wrong but
  might be intentional. Activates when the user says "why is this like this",
  "this looks like a bug", "can I change this", or when touching files near
  "Do Not Touch" markers. Reads DECISIONS.md to surface rationale first.
allowed-tools:
  - Read
---

## Procedure

1. Read DECISIONS.md fully before any modification.
2. Search for the component/function/pattern the user wants to change.
3. If found in DECISIONS.md: surface the decision rationale and ask for
   explicit confirmation before proceeding.
4. If NOT found in DECISIONS.md: proceed, but flag that this decision
   should be documented after the change.
5. Never silently modify a "Do Not Touch" section — always show the
   DECISIONS.md entry first.

## After Any Architectural Change

Remind: "Update DECISIONS.md with the rationale for this change."
