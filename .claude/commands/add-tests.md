---
description: Writes missing tests for a file or store. Always adds: happy path, edge case, error case. Never snapshot tests for logic.
argument-hint: [filepath] e.g. src/store/simulationStore.ts
---

Target: $ARGUMENTS

Read the target file in full first.
Find the co-located test file: src/**/__tests__/[filename].test.ts
Read the existing tests to understand the current coverage style and naming conventions.

Run: npm run test -- --coverage $ARGUMENTS 2>&1 | tail -20
Identify which branches and functions have 0% coverage.

For each uncovered function/branch, write tests covering:
1. Happy path — normal successful execution
2. Edge case — boundary values, empty inputs, maximum inputs
3. Error case — what happens when dependencies throw or return unexpected values

RULES:
- Never mock the module under test — only mock its external dependencies (fetch, zustand stores it calls)
- Use `vi.mock('zustand')` pattern already established in the test suite — match it exactly
- No snapshot tests for business logic — only for stable, rarely-changing UI components
- Test names must describe behavior, not implementation: "returns error when budget exceeded" not "calls setBudgetError"
- Each new test file must have a describe block matching the module name

Run: npm run test -- --coverage $ARGUMENTS 2>&1 | tail -10
Target: branch coverage above 80% for stores, 70% for utilities.

Commit: "test([filename]): fill coverage gaps — [N] new tests"