# .dev-notes/ — your personal scratch

This directory is for **local, uncommitted** iteration notes. Only this `README.md` is tracked; everything else you drop in here stays out of git.

## What goes here

- Draft PR descriptions before you open a pull request.
- Scratch notes about an experiment, a debugging session, or a design decision you're still turning over.
- Commit/PR command bundles you build up while staging a change.
- Temporary copies of logs, diffs, or fixture data you want close at hand.

## What does not

- Anything that belongs in the PR body itself → put it in the PR description after you edit the draft.
- Anything that should survive across developers → `docs/`, a DHF entry under `qms/`, or a proper committed doc.
- Secrets. `.env` files live elsewhere (and are gitignored elsewhere); don't paste credentials here.

## Convention

- **Filename:** `YYYY-MM-DD-short-slug.md` — today's date plus a 3–5 word slug describing the outcome (e.g. `2026-04-17-synoptic-quickentry-e2e-batch.md`).
- **Suggested sections:** Summary · Why · Changes · Test plan · Risks / follow-ups.
- **Lifecycle:** write it, edit it as the work evolves, paste the cleaned-up version into the PR when you open it. The file stays here as your working copy — nobody else ever sees it.

## How this directory stays "tracked but empty"

The module's `.gitignore` carries:

```
.dev-notes/*
!.dev-notes/README.md
```

That keeps the directory committed (so every fresh clone has it ready to use) while ignoring everything else inside. If you need to version a file here for real, move it out of `.dev-notes/` — or add an explicit `!` line for it.
