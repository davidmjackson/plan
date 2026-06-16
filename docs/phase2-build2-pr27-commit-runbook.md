# phase2-build2 PR #27 follow-up: commit the post-review comment fix

**For**: Claude Code (Fable), run in `/var/www/plan`.
**Status**: Director-approved. This is a comment-only and docs-only follow-up to phase2-build2. No PROPOSE gate (no feature code, no model/selector/store/schema change).
**Goal**: Fold an already-made, comment-only correction into the open PR #27, re-run the gates, then hand back to the director for merge.

---

## What is already done (do NOT re-edit)

Two edits were made directly to the working tree during the review session. They are on disk and uncommitted. Your job is to verify them, commit, push, and re-run the gates. Do not regenerate or reshape them.

1. **`public/js/dep-selectors.js`** (comment-only). The `connectorsToDraw` JSDoc still described the OLD Brief 8 convention ("place the arrowhead at the dependent end"). phase2-build2 consciously reversed that: the head now sits at the depended-on (blocker) story. The comment was corrected to "depended-on (blocker) end (phase2-build2, reversed from Brief 8's dependent-end convention)" so the read-only selector's documentation matches the shipped view in `connectors.js`.
2. **`docs/build-log.md`** (docs). A one-line **Post-review note** was added inside the 2026-06-16 phase2-build2 entry, recording this comment fix and that it rides in PR #27.

**Why this is allowed even though Brief 8 / phase2-build2 marked `dep-selectors.js` READ ONLY**: the R1 ruling protects selector LOGIC, the model, and the schema. A JSDoc comment is none of those. The correction was found during the build-state review and signed off by the director. It changes no behaviour.

---

## The commands, with the reason for each

Run these in order. Stop and report if any step does not match its expected result.

```bash
cd /var/www/plan
```

### 1. Confirm you are on the PR #27 branch

```bash
git branch --show-current
```

**Expect**: `feat-phase2-build2-connector-arrowhead`.
**Why**: PR #27 tracks this branch. Committing anywhere else would not fold into the open PR. If you are on `main` or a different branch, stop and report rather than guessing.

### 2. Confirm ONLY the two intended files are dirty, and the diffs are comment/doc only

```bash
git status
git diff public/js/dep-selectors.js
git diff docs/build-log.md
```

**Expect**: exactly two modified files. The `dep-selectors.js` diff is a JSDoc comment change inside the `connectorsToDraw` block (no code lines, no `export`, no logic). The `build-log.md` diff is one added bullet.
**Why**: this is the source-grounding guard. If `git status` shows any third file, or the `dep-selectors.js` diff touches anything other than the comment, **stop and report**. Do not commit unexpected changes, and do not "while we're here" tidy anything else (RoE).

### 3. Stage and commit the two files

```bash
git add public/js/dep-selectors.js docs/build-log.md
git commit -m "docs: connectorsToDraw JSDoc to head-at-blocker; log post-review note"
```

**Why**: one focused commit keeps the build-log's per-commit history honest and easy to read. Staging the two files by name (not `git add -A`) prevents anything stray being swept in.

### 4. Re-run the gates so the green claim covers this commit

```bash
npm test
npm run typecheck
```

**Expect**: `npm test` runs the theme-drift gate first, then the suite, 185 tests green. `typecheck` (`tsc --noEmit`) clean.
**Why**: the build-state box asserts "185 green / typecheck clean / drift ok" from BEFORE this touch. A comment change cannot break any of them, but re-running makes the claim literally true for the new commit rather than inherited. If anything goes red, stop and report; do not push.

### 5. Push to update PR #27

```bash
git push
```

**Why**: `origin == local` on this branch, so a plain push updates the open PR #27 with the new commit. No force, no new branch.

---

## Director gate (NOT for Claude Code to run unprompted)

The merge is the director's call after sign-off. Documented here only so the full path is on the record:

```bash
# After the director approves, merge with a MERGE COMMIT (not squash/rebase)
gh pr merge 27 --merge
```

**Why `--merge`, not squash**: the build-log references builds by per-merge SHA. Squashing would collapse those references. This convention holds for the whole project.

**After merge**: update the SHA in `docs/build-state-after-phase2-build2.md` (the line that currently reads `main` still at `3c36755`) to the new merge SHA, per the handoff's own instruction.

---

## Definition of done

- The two files are committed in one focused commit on `feat-phase2-build2-connector-arrowhead`.
- `npm test` (185 green, drift first) and `npm run typecheck` pass on the new commit.
- `git push` has updated PR #27.
- The merge and the build-state SHA update are left for the director, flagged above.
- No other file was touched. No logic, model, selector, store, or schema change.
