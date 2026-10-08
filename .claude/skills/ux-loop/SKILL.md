---
name: ux-loop
description: Check whether the app's screens answer "what's going on in the market right now?". Captures every screen of one or more builds from Expo web with live data, has fresh opus testers read only the screenshots and a glossary, then grades their answers against fibenchi's API at the same moment and turns the gaps into UX findings tied to screen elements. Use after a UI change to the Pulse, Board or group screens, or when asked for a UX test, tester feedback or the UX loop.
---

# UX loop

Testers must not be briefed by the session that built the screens, because it
knows what the screens are meant to say. Run this from a session that did not
write the UI under test, and never add design intent to the glossary or the
prompts.

## 1. Prepare

```bash
RUN=<scratchpad>/ux-run-$(date +%Y%m%d-%H%M)
scripts/ux-loop/prepare.sh "$RUN" new=<ref-under-test> [old=<ref-to-compare>]
```

The first build gets 3 bare + 3 explained testers, each further build 3 bare
testers. A ref can be a local branch, a commit or `origin/<branch>`. It takes
about 7 minutes per build: Metro start, a 40 s wait for quotes, then one
screen per group. Needs `.env.local` in the main checkout and Python
playwright, Pillow and PyYAML.

`build_brief.py` fails when fibenchi tracks a ticker that `glossary.yaml`
doesn't describe. Add the ticker in plain words (what the owner would say, not
the feed's truncated name) and rerun it.

## 2. Testers

Spawn one `general-purpose` agent per `$RUN/prompts/<label>-<variant>-<n>.md`,
all in one message, **model opus**, each with this prompt and nothing else:

> Read `<prompt path>` and follow it exactly. It is your whole task. Do not
> read any other file than the ones it names.

Wait for all of them. Each writes `$RUN/answers/<name>.md`.

## 3. Grade

One more `general-purpose` agent, model opus, same one-line prompt pointing
at `$RUN/prompts/grader.md`. It writes `$RUN/report.md`.

## 4. Report

Read `report.md`. Send the UX findings to whoever is building the screens,
and keep the scores per tester so the next run can be compared. Cost is in
the agents' completion notices (`total_tokens`); sum them.

## What the parts are

| File                                        | Job                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `scripts/ux-loop/serve.sh`                  | Throwaway worktree of a ref, served on Expo web                          |
| `scripts/ux-loop/overlay/sparkline.web.tsx` | SVG sparkline for web, since Skia doesn't load there                     |
| `scripts/ux-loop/capture.py`                | Pulse, Board and every group, full height, sliced into phone-height PNGs |
| `scripts/ux-loop/ground_truth.py`           | Price, day %, σ (as fibenchi resolves it), RSI, 1wk/2wk/1mo per symbol   |
| `scripts/ux-loop/glossary.yaml`             | What the owner knows (`owner`) and what the app's symbols mean (`ui`)    |
| `scripts/ux-loop/prompts/`                  | Tester and grader templates                                              |

Asset detail screens are not captured: their charts are Skia and render blank
on web.
