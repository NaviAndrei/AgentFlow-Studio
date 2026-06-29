# Commit, Push & PR Command

When the user types /commit-push-pr [message], stage the current changes, commit them, and prepare a GitHub PR — without ever pushing or committing without the user's explicit, real-time go-ahead.

> Safety note: this repo's standing rule is "never commit/push autonomously" (see `feedback_no_autonomous_git.md`). That rule applies even when this command's own steps describe committing/pushing — each mutating git command below requires the user to type an explicit "yes" in this conversation before it is run. Printing the command is not the same as authorization to run it.

## Instructions

1. Run `git status --short` — show the user exactly what is untracked/modified and would be staged.
2. Run `git diff --stat HEAD` — summarize the size/shape of the change.
3. Run `git branch --show-current` to check the active branch.
   - **If the branch is `main` or `master`: STOP here.** Warn the user that this repo works directly on `main` (per project convention) and ask whether they still want to commit on `main`, or want to create a branch first. Do not proceed past this step until the user responds.
4. Determine the commit message:
   - If `$ARGUMENTS` is non-empty, use it as `$MESSAGE`.
   - If empty, ask the user for a commit message (Conventional Commits format: `type(scope): subject`).
5. Show the exact command to run:
   ```
   git add -A
   git commit -m "$MESSAGE"
   ```
   Ask: **"Run this commit now? (yes / no)"** Only execute `git add -A` and `git commit -m "$MESSAGE"` if the user replies yes. Otherwise stop and leave the commands above for the user to run manually.
6. After a successful commit, ask: **"Push to origin now? (yes, push / no)"**
   - Only run `git push origin HEAD` if the user explicitly replies "yes, push".
   - Never force-push (no `--force` / `--force-with-lease` flags) under any circumstance.
   - Never push directly if the current branch is `main` or `master` — re-confirm with the user first.
7. Regardless of whether the push was run, always output the exact fallback command for the user to run manually:
   ```
   git push origin HEAD
   ```
8. Open a PR:
   - If the `gh` CLI is available (`gh --version` succeeds), run:
     ```
     gh pr create --draft --title "$MESSAGE" --body "Summary of changes:\n\n- ...\n\nGenerated from /commit-push-pr"
     ```
     only after the push has actually happened (manually or via step 6).
   - If `gh` is not available, output the URL to open a PR manually, e.g.:
     ```
     https://github.com/<owner>/<repo>/compare/main...<branch>?expand=1
     ```

## Safety Rules
- Never force-push (no `--force` or `--force-with-lease`).
- Never commit or push without the user typing an explicit "yes" in this conversation for that specific step — a command file instruction is not sufficient authorization.
- Never push directly to `main`/`master` without first warning the user and getting confirmation.
- Always show the manual fallback commands even when an action was run automatically, so the user has a copy-pasteable escape hatch.
