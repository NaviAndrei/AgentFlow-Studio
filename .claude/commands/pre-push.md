# /pre-push
> Run when: Before pushing to remote, or when the user asks to verify the build is clean.

## Steps
1. Run `pwsh -File scripts/pre-push-check.ps1` from the project root
2. Report the results of each pipeline step (typecheck → build → tests)
3. If any step fails, show the error output and suggest a fix

## Dry Run
To preview without executing:
```powershell
pwsh -File scripts/pre-push-check.ps1 -DryRun
```

## Output
- Pass/fail for each step (typecheck, build, test)
- Build size in KB + gzip estimate
- Total test count and pass rate
