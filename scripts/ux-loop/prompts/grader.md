You grade tester answers about a phone market app against what was true.

Inputs:

- Tester answers: {answers}. Each file name says the build and the glossary
  variant (`bare` = tickers and groups only, `explained` = also the app's
  symbols).
- Ground truth per build: {truths}. JSON from fibenchi's API taken right after
  that build's capture. `rows` is sorted by |sigma|; `sigma` is the asset's
  move divided by its own typical daily move, the same number the app shows as
  σ. `1wk`/`2wk`/`1mo` are % moves from daily closes. `phases` says which
  exchanges were open. `portfolio_index` is the watchlist's equal-weight index.
- What each screen rendered, as text, per build: {texts}. Use these to tell a
  tester error (the screen showed it right and the tester misread it) from a
  screen error (the screen itself was wrong or missing it).
- The glossaries the testers got: {glossaries}.

You may read the screenshots in {screens} to look at a specific element a
tester was confused by. Do not read them all.

Build the reference picture first, in your own words, at most ten bullets:
breadth (how many up and down among assets trading now, and over the whole
list), the largest |σ| moves and whether each is unusual, which exchanges were
open, any cluster (a sector, a theme, crypto, a region) moving together, and
the largest 1wk/1mo moves. A move is "unusual" at |σ| >= 2.

Then grade each tester on these, 0 to 2 points each, 20 total:

1. Breadth: did they say whether the market was broadly up or down, right?
2. Open vs closed: did they know which prices were live and which were a close?
3. Top σ movers: did they name at least three of the five largest |σ|?
4. Unusual vs big: did they separate a big-% move on a volatile asset (crypto,
   small caps) from a genuinely unusual one?
5. Clusters: did they spot the sector or theme moves that are really there?
6. Longer windows: did they use the 1wk/2wk/1mo information correctly?
7. Backdrop: did they read the indexes, yields or dollar where shown?
8. No false claims: 2 for none, 1 for one minor, 0 for any material one.
9. Next checks: are they the checks the data actually calls for?
10. Self-awareness: does their stated confidence match how right they were?

Your report, as your final reply, has:

- The reference picture.
- A table: tester, build, variant, score per criterion, total.
- Right / wrong / missed per tester, three short lists, each item with the
  number from the truth.
- Variant comparison: what the `explained` glossary changed, by criterion.
- Build comparison: what the other build changed, by criterion.
- UX findings. Each one names a screen and an element (quote its text or
  describe its place), what testers did with it, the evidence (which testers,
  and the truth), and a concrete change. Rank by how many testers it hurt and
  how much. Mark whether a finding is a screen error or a reading problem.
  Skip findings that only one tester hit unless the error was material.

Start the reply with the total score per tester, one per line, then the
report as markdown. Subagents can't write report files, so the parent saves it
to `{report}`.
