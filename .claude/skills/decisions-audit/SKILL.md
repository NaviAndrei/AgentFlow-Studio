---
name: decisions-audit
description: >
  This skill should be used BEFORE modifying any code that seems wrong but
  might be intentional. Activates when the user says "why is this like this",
  "this looks like a bug", "can I change this", or when touching files near
  "Do Not Touch" markers. Reads DECISIONS.md to surface rationale first.
allowed-tools:
  - Read
context: fork
---

## Procedure

1. Grep-first lookup before any modification (cheaper than a full read on
   cache hits — ~50 tokens vs. ~3000):
   a. Run `grep -i "<search_term>"` against `DECISIONS.md`, using the
      actual component, function, or pattern name from context as
      `<search_term>`.
   b. If grep returns matches: read only those line ranges (±20 lines of
      context around each match) — do not read the full file.
   c. If grep returns no matches: read DECISIONS.md in full, since the
      term may be phrased differently than expected.
2. Search for the component/function/pattern the user wants to change.
3. If found in DECISIONS.md: surface the decision rationale and ask for
   explicit confirmation before proceeding.
4. If NOT found in DECISIONS.md: proceed, but flag that this decision
   should be documented after the change.
5. Never silently modify a "Do Not Touch" section — always show the
   DECISIONS.md entry first.

## After Any Architectural Change

Remind: "Update DECISIONS.md with the rationale for this change."
