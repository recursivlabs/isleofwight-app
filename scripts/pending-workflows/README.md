# (resolved 2026-07-30 — the workflow is live at .github/workflows/controller-gate.yml)

# Pending workflows — staged here because the agent token lacks `workflow` scope

`controller-gate.yml` is complete and dry-run verified. It cannot be pushed to
`.github/workflows/` from this session: GitHub rejects it with

    refusing to allow an OAuth App to create or update workflow
    .github/workflows/controller-gate.yml without `workflow` scope

It is staged here rather than left uncommitted, because an unpushed file exists
on exactly one disk — the failure mode §8 records for #199's ten remote-less
directories, and the reason `controller-r5` was tagged.

## To make it live (one human step, then one command)

```bash
gh auth refresh -h github.com -s workflow      # grants the scope, interactive
git mv scripts/pending-workflows/controller-gate.yml .github/workflows/
git commit -m "ci: gate the controller on every edit" && git push
```

Then verify BOTH halves, because a green run proves only that the gate ran:

```bash
gh run list --workflow=controller-gate.yml --limit 1 --json conclusion,headSha
```

…and read the run's "Negative control" step, which corrupts a copy of the
controller in-run and requires the gate to reject it. If that step ever passes,
the gate is not gating.

## The LOCAL half is live now — this file is only the CI half

`scripts/hooks/pre-commit` enforces the same gate at commit time and needs **no** OAuth scope. It is
installed in this clone (`git config core.hooksPath scripts/hooks`; undo with `git config --unset
core.hooksPath`) and blocks any commit touching the controller or its entry docs while the gate fails.

Both directions were proven, not asserted: with `PA`'s `N` corrupted 2→9 the hook exits **1** and
prints the six failures; restored, it exits **0**. That is strictly *earlier* than CI — a broken
controller never reaches a commit, let alone a push. **A fresh clone does not inherit it**, which is
exactly why the CI half still matters.

## Known limit, stated rather than discovered later

Check `[8]` verifies cross-repo citation anchors against `recursivlabs/recursiv`,
which is private and unreachable with the default `GITHUB_TOKEN`, so it **skips**
in CI and the workflow raises a warning annotation saying so. Set an
`ENGINE_REPO_TOKEN` secret to cover anchors in CI too. Until then, CI green means
checks 1–7 and 9–12 — not 8.
