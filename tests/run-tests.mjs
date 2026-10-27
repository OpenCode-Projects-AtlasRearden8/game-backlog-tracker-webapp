import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dirname = fileURLToPath(new URL("..", import.meta.url));
const html = readFileSync(dirname + "index.html", "utf8");
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error("Could not extract <script> from index.html");
const scriptText = match[1];

function makeFakeLocalStorage() {
  let store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    _store: store
  };
}

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log("ok   - " + name);
  } catch (e) {
    fail++;
    failures.push({ name, error: e });
    console.error("FAIL - " + name + ": " + (e && e.message ? e.message : e));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || "assertEq") + " expected=" + JSON.stringify(expected) + " actual=" + JSON.stringify(actual));
  }
}
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

test("script contains no accidental browser-only top-level throws in Node", () => {
  eval(scriptText);
  assert(globalThis.__APP_API__, "__APP_API__ should be exported");
});

eval(scriptText);
const app = globalThis.__APP_API__;

function game(id, status, estimate, tags, platform, title) {
  return {
    id,
    title: title || "Game " + id,
    platform: platform || "PC",
    sessionEstimate: estimate,
    tags: tags || [],
    status
  };
}

test("makeRng is seeded and deterministic", () => {
  const a = app.makeRng(1337);
  const b = app.makeRng(1337);
  for (let i = 0; i < 10; i++) {
    assertEq(a(), b(), "seeded rng sequence mismatch");
  }
  const c = app.makeRng(1338);
  assert(c() !== a(), "different seeds should produce different values");
});

test("makeRng unseeded stays in [0,1) for 300 draws", () => {
  const rng = app.makeRng();
  for (let i = 0; i < 300; i++) {
    const v = rng();
    assert(v >= 0 && v < 1, "rng out of range: " + v);
  }
});

test("eligibleForEnergy filters by status and estimate (low=45, medium=90, high=unlimited)", () => {
  assert(!app.eligibleForEnergy(game("g1", "finished", 30, []), "low"), "finished must never appear");
  assert(!app.eligibleForEnergy(game("g2", "quit", 30, []), "low"), "quit must never appear");
  assert(app.eligibleForEnergy(game("g3", "backlog", 30, []), "low"), "30min backlog ok for low");
  assert(app.eligibleForEnergy(game("g4", "playing", 45, []), "low"), "45min is within low");
  assert(!app.eligibleForEnergy(game("g5", "backlog", 46, []), "low"), "46min exceeds low");
  assert(app.eligibleForEnergy(game("g6", "backlog", 90, []), "medium"), "90min ok for medium");
  assert(!app.eligibleForEnergy(game("g7", "backlog", 91, []), "medium"), "91min exceeds medium");
  assert(app.eligibleForEnergy(game("g8", "backlog", 400, []), "high"), "high energy = any length");
});

test("pickNextGame never suggests finished/quit games", () => {
  const games = [
    game("a", "finished", 20, ["cozy"]),
    game("b", "quit", 20, ["cozy"]),
    game("c", "playing", 30, ["cozy"])
  ];
  for (let seed = 1; seed <= 50; seed++) {
    const res = app.pickNextGame(games, "high", null, app.makeRng(seed * 7919));
    assert(res, "should return a suggestion");
    assertEq(res.game.status, "playing", "picked a finished/quit game with seed " + seed);
  }
});

test("low-energy shuffle only suggests games fitting the 45-min window", () => {
  const games = [
    game("short1", "backlog", 25, ["cozy"]),
    game("short2", "playing", 40, ["splash"]),
    game("short3", "backlog", 45, ["cozy", "story"]),
    game("long1", "backlog", 120, ["story"]),
    game("long2", "backlog", 300, ["story"])
  ];
  for (let seed = 1; seed <= 300; seed++) {
    const res = app.pickNextGame(games, "low", null, app.makeRng(seed));
    assert(res, "should return a suggestion");
    assert(app.eligibleForEnergy(res.game, "low"), "picked over-limit game with seed " + seed + ": " + res.game.id);
  }
});

test("high-energy shuffle can suggest long games", () => {
  const games = [game("longonly", "backlog", 400, ["story"])];
  const res = app.pickNextGame(games, "high", null, app.makeRng(7));
  assertEq(res.game.id, "longonly", "long game should be reachable at high energy");
  const lowRes = app.pickNextGame(games, "low", null, app.makeRng(7));
  assertEq(lowRes.game.id, "longonly", "fallback should broaden the pool rather than return nothing");
});

test("low-energy falls back with a hint when nothing fits", () => {
  const games = [game("only", "backlog", 200, ["story"])];
  const res = app.pickNextGame(games, "low", null, app.makeRng(11));
  assertEq(res.game.id, "only");
  assert(res.reason && res.reason.length > 0, "fallback should carry a hint for the player");
});

test("pickNextGame avoids repeating the last suggestion when alternatives exist", () => {
  const games = [
    game("a", "backlog", 30, ["cozy"]),
    game("b", "backlog", 30, ["cozy"]),
    game("c", "backlog", 30, ["cozy"])
  ];
  for (let seed = 1; seed <= 100; seed++) {
    const res = app.pickNextGame(games, "low", "a", app.makeRng(seed));
    assert(res.game.id !== "a", "repeated last suggestion with seed " + seed);
  }
});

test("pickNextGame can repeat the last suggestion if it is the only option", () => {
  const games = [game("solo", "backlog", 30, ["cozy"]), game("gone", "finished", 10)];
  const res = app.pickNextGame(games, "low", "solo", app.makeRng(5));
  assertEq(res.game.id, "solo", "single candidate must still be returned");
});

test("pickNextGame returns null with no active games", () => {
  const games = [game("a", "finished", 20), game("b", "quit", 20)];
  assertEq(app.pickNextGame(games, "low", null, app.makeRng(3)), null, "should return null");
  assertEq(app.pickNextGame([], "high", null, app.makeRng(3)), null, "empty pile returns null");
});

test("pickNextGame duplicates-safe when alternatives filter matters", () => {
  const games = [game("a", "backlog", 30), game("b", "backlog", 30)];
  for (let seed = 1; seed <= 20; seed++) {
    const res = app.pickNextGame(games, "high", "a", app.makeRng(seed * 13));
    assertEq(res.game.id, "b", "only alternative should be picked");
  }
});

test("computeTotals sums minutes and counts sessions", () => {
  const sessions = [
    { id: "s1", gameId: "g1", date: "2026-01-01", minutes: 45, note: "" },
    { id: "s2", gameId: "g1", date: "2026-01-02", minutes: 30, note: "" },
    { id: "s3", gameId: "g2", date: "2026-01-03", minutes: 90, note: "" }
  ];
  const totals = app.computeTotals(sessions);
  assertEq(totals.totalMinutes, 165);
  assertEq(totals.sessionCount, 3);
  assertEq(totals.perGame.g1.minutes, 75);
  assertEq(totals.perGame.g1.count, 2);
  assertEq(totals.perGame.g2.minutes, 90);
  assertEq(totals.perGame.g2.count, 1);
});

test("computeTotals with empty sessions is zeroed and safe", () => {
  const totals = app.computeTotals([]);
  assertEq(totals.totalMinutes, 0);
  assertEq(totals.sessionCount, 0);
  assertEq(Object.keys(totals.perGame).length, 0);
});

test("computeTotals maps per-game totals against the games list", () => {
  const sessions = [
    { id: "s1", gameId: "g1", date: "2026-01-01", minutes: 60 },
    { id: "s2", gameId: "g2", date: "2026-01-02", minutes: 15 }
  ];
  const games = [game("g1", "playing", 30), game("g2", "finished", 30), game("g3", "backlog", 30)];
  const totals = app.computeTotals(sessions, games);
  assertEq(totals.gamesPlayed.g1, 60);
  assertEq(totals.gamesPlayed.g2, 15);
  assert(totals.gamesPlayed.g3 === undefined, "unplayed game must not appear in gamesPlayed");
});

test("computeTotals survives sessions for deleted games", () => {
  const sessions = [{ id: "s1", gameId: "ghost", date: "2026-01-01", minutes: 10 }];
  const totals = app.computeTotals(sessions, []);
  assertEq(totals.totalMinutes, 10, "orphan session minutes still count");
  assertEq(totals.gamesPlayed.ghost, undefined);
});

test("csvEscape wraps values with commas, quotes and newlines", () => {
  assertEq(app.csvEscape("plain"), "plain");
  assertEq(app.csvEscape("a,b"), '"a,b"');
  assertEq(app.csvEscape('say "hi"'), '"say ""hi"""');
  assertEq(app.csvEscape("line\nbreak"), '"line\nbreak"');
  assertEq(app.csvEscape(null), "");
  assertEq(app.csvEscape(45), "45");
});

test("toCsv builds a full CSV body with CRLF rows", () => {
  const csv = app.toCsv(["date", "game"], [["2026-01-01", "Fancy, Game"], ["2026-01-02", "Quiet"]]);
  const lines = csv.split("\r\n");
  assertEq(lines[0], "date,game");
  assertEq(lines[1], "2026-01-01,\"Fancy, Game\"");
  assertEq(lines[2], "2026-01-02,Quiet");
  assert(csv.endsWith("\r\n"), "trailing newline expected");
});

test("saveState and loadState round-trip through localStorage", () => {
  globalThis.localStorage = makeFakeLocalStorage();
  const st = app.defaultState();
  st.games = [game("g1", "backlog", 30, ["cozy"], "PC", "Test Title")];
  st.sessions = [{ id: "s1", gameId: "g1", date: "2026-01-01", minutes: 42 }];
  st.goals = [{ id: "goal1", text: "Finish one game", done: false }];
  st.energy = "low";
  st.nextId = 5;
  assert(app.saveState(st), "save should succeed with localStorage");
  const loaded = app.loadState();
  assert(loaded, "load should succeed");
  assert(deepEq(loaded, st), "round-tripped state should be identical");
  assertEq(loaded.games[0].title, "Test Title");
  assertEq(loaded.sessions[0].minutes, 42);
});

test("saveState/loadState handle missing or corrupt storage gracefully", () => {
  delete globalThis.localStorage;
  assertEq(app.saveState({ games: [] }), false, "save without localStorage returns false");
  assertEq(app.loadState(), null, "load without localStorage returns null");
  globalThis.localStorage = makeFakeLocalStorage();
  globalThis.localStorage.setItem("pileOfShame.v1", "{not json");
  assertEq(app.loadState(), null, "corrupt JSON returns null");
});

test("defaultState shape is sane", () => {
  const st = app.defaultState();
  assert(deepEq(st, { games: [], sessions: [], goals: [], energy: "medium", nextId: 1 }));
});

test("parseCsvNumber validates minute inputs", () => {
  assertEq(app.parseCsvNumber("45"), 45);
  assertEq(app.parseCsvNumber("0"), null);
  assertEq(app.parseCsvNumber("-5"), null);
  assertEq(app.parseCsvNumber("abc"), null);
});

test("shuffle is varied across seeds (no single-game lockout)", () => {
  const games = [
    game("a", "backlog", 30, ["cozy"]),
    game("b", "backlog", 30, ["cozy"]),
    game("c", "backlog", 30, ["splash"])
  ];
  const seen = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    seen.add(app.pickNextGame(games, "low", null, app.makeRng(seed)).game.id);
  }
  assertEq(seen.size, 3, "all candidates should appear across seeds, seen=" + [...seen]);
});

console.log("");
console.log("Tests: " + pass + " passed, " + fail + " failed");
process.exit(fail > 0 ? 1 : 0);
