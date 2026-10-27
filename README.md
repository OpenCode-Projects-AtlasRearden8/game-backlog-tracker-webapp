# Pile of Shame Tracker

An offline, zero-dependency web app for the fun pile of shame - the games you
bought and love and keep not playing. Built for beginners, tired evenings, and
honest bookkeeping. Part of the fun-extras lineup from **Asdale Dynamics, LLC**
(sitting nicely beside the PC Gaming Comfort Guide and the FFXIV tools).

**One file. No installs. No accounts. No servers.** Just open `index.html` in
any modern browser, even straight from the file system.

## What it does

- **Game cards** with platform, session estimate (minutes), and mood tags:
  - `cozy` - relaxing, low-stakes
  - `story` - narrative-heavy, wants real attention
  - `splash` - quick, splashy pick-up-and-play bursts
- **Play Next shuffle** that respects your evening: pick your energy level
  (Low / Medium / High) and it only suggests games that actually fit.
  - Low energy: games with a session estimate of 45 minutes or less, with a
    strong bias toward cozy games and shorter sessions.
  - Medium: up to 90-minute sessions fit.
  - High: anything goes, with a gentle nudge toward story-heavy picks.
  - It never suggests games you already finished or honestly quit, and it
    avoids repeating the same suggestion twice in a row.
- **Per-game session log** with minutes and optional notes. Totals are shown
  per game and for the whole pile.
- **Finish-or-quit honest statuses**: Backlog, Playing, Finished, and Quit.
  Quitting a game on purpose is a win here, and the header counter treats it
  that way.
- **Goal chips**: small personal goals ("finish one cozy game this month")
  you can check off and remove.
- **CSV export**: download your sessions log and your games list as proper
  CSV files, straight from the browser.
- **All localStorage**: everything stays on your device. No network calls are
  made by the app, ever.

## How to run it

1. Download or clone this folder.
2. Double-click `index.html` (or open it in your browser of choice).
3. That's it. Works fully offline from `file://`.

## How to run the tests

The app's core logic (the shuffle, the energy windows, the totals math, CSV
formatting, and localStorage round-trips) lives in the same single file and is
tested with plain Node, no dependencies:

```
npm test
```

or equivalently:

```
node tests/run-tests.mjs
```

The test runner extracts the `<script>` block from `index.html` and exercises
it directly, so the app stays a single file and the tests always check the
exact code you ship.

## Privacy

- All data is stored in your browser's localStorage on your own device.
- Clearing the pile ("Clear All Data") wipes it permanently - export CSVs
  first if you want a backup.
- No secrets, no API keys, no personal data are embedded in the files.

## License

MIT - see [LICENSE](LICENSE).

Copyright (c) 2026 Asdale Dynamics, LLC
