# STATUS.md - Pile of Shame Tracker

## What was built

`index.html` - a fully offline, zero-dependency, single-file web app for the
fun pile of shame, built for beginner-friendly, low-energy, honest gaming:

- **Game cards**: title, platform (PC, Steam Deck, Switch, PlayStation, Xbox,
  Mobile, Other), session estimate in minutes, and mood tags `cozy`, `story`,
  `splash`. Cards are filterable by status and mood tag.
- **Play Next shuffle**: pick tonight's energy (Low / Medium / High) and the
  weighted shuffle only suggests games that fit:
  - Low: sessions of 45 minutes or less, weighted toward `cozy` and shorter
    estimates, with a soft penalty on `story` games.
  - Medium: up to 90-minute sessions.
  - High: no limit, `story` games get a small boost.
  - Finished and honestly-quit games are never suggested; the previous
    suggestion isn't repeated while alternatives exist; if nothing fits the
    energy window, it falls back to the gentlest active picks with an
    explanatory hint.
- **Per-game session log**: minutes (validated), optional note, date.
  Per-game totals plus pile-wide stats (time played, sessions, pile size,
  finished, honestly quit) in the header.
- **Honest statuses**: Backlog -> Playing -> Finished, plus an explicit
  "Honestly Quit" action. Quitting is treated as a first-class, respectable
  outcome.
- **Goal chips**: add, complete, and remove personal goals.
- **CSV export**: sessions CSV (date, game, platform, minutes, note) and
  games CSV (title, platform, estimate, tags, status, minutes/sessions
  logged), with proper CSV escaping, downloaded via Blob.
- **All localStorage** (key: `pileOfShame.v1`), with corrupt-data fallback to
  defaults. No network calls anywhere in the app.

Supporting files:

- `tests/run-tests.mjs` - 23 Node tests covering the shuffle and totals
  logic (energy windows, finished/quit exclusion, no-repeat, seeded rng,
  fallbacks), totals math (including orphaned sessions), CSV escaping,
  localStorage round-trip, and input validation. The runner extracts the
  `<script>` from `index.html`, so the app stays a single file and the tests
  test exactly what ships.
- `package.json` - only a `test` script; no dependencies installed.
- `README.md` - run instructions, privacy notes, MIT reference, credits.
- `LICENSE` - MIT, "Copyright (c) 2026 Asdale Dynamics, LLC".

## How to run it

- Open `index.html` directly in any modern browser (works from `file://`),
  or serve the folder however you like.
- Run tests: `node tests/run-tests.mjs` (or `npm test`).

## Verification results

- `node --check` on the extracted script: passes.
- `node tests/run-tests.mjs`: **23 passed, 0 failed**
  (includes 300-seed shuffle-window sweep, no-repeat sweeps, totals edge
  cases, CSV escaping, localStorage round-trip and corrupt-storage handling).
- Cross-checks: every `getElementById` target used by the script exists in
  the HTML (27/27); exactly one `<script>` block so tests keep matching the
  shipped code.
- Git: initialized and committed locally as the existing git identity, plain
  commit message, no co-author trailers, no push, no remote.

## Known gaps

- No import of exported CSVs yet (JSON backup/restore and CSV import are the
  natural next steps).
- "Clear All Data" is a single confirmation; no undo after confirming.
- Suggestions match the Play Next log shortcut by title (duplicate titles
  could open the wrong card's log form; both still work independently).
- Tested with Node 20 as the logic runtime; browser behavior relies on
  modern-but-common APIs (localStorage, Blob, dialog-free UI). No older
  browser guarantees.
- No keyboard-shortcut layer yet for accessibility power users.
