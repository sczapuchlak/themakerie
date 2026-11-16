import assert from "node:assert/strict";
import test from "node:test";
import {
  activeSeconds,
  applyCounterChange,
  compact,
  compareProjects,
  computeInsights,
  computeProgress,
  finishSession,
  formatDuration,
  pauseAt,
  pauseSession,
  replay,
  resumeSession,
  sessionSeconds,
  startSession,
  type Counter,
  type Op,
  type Snapshot,
} from "./model.ts";

const counter = (id: string, extra: Partial<Counter> = {}): Counter => ({
  id,
  name: id,
  value: 0,
  step: 1,
  target: null,
  rollover: false,
  rollover_counter_id: null,
  section_id: null,
  is_main: false,
  position: 0,
  ...extra,
});

function snapshot(extra: Partial<Snapshot> = {}): Snapshot {
  return {
    loadedAt: "2026-11-10T00:00:00Z",
    project: {
      id: "p",
      name: "Blanket",
      status: "in_progress",
      progress: 0,
      progress_method: "manual",
      progress_target: null,
      progress_done: 0,
      unit_label: null,
      progress_counter_id: null,
      notes: null,
      size_colorway: null,
      started_on: null,
      finished_on: null,
      last_worked_at: null,
      workspace: {},
      pattern_id: null,
    },
    pattern: null,
    sources: [],
    sections: [],
    completedSteps: [],
    counters: [counter("rows", { is_main: true })],
    sessions: [],
    photos: [],
    notes: [],
    milestones: [],
    progressEvents: [],
    readerStates: [],
    bookmarks: [],
    ...extra,
  };
}

let n = 0;
const op = (o: Record<string, unknown>) => ({ opId: `op${++n}`, at: "2026-11-10T10:00:00Z", ...o }) as Op;

test("counters: add, clamp at zero, set", () => {
  let c = [counter("a")];
  c = applyCounterChange(c, "a", "add", 3).counters;
  assert.equal(c[0].value, 3);
  c = applyCounterChange(c, "a", "add", -10).counters;
  assert.equal(c[0].value, 0);
  c = applyCounterChange(c, "a", "set", 16).counters;
  assert.equal(c[0].value, 16);
});

test("counters: rollover wraps and feeds the linked counter (mirrors SQL)", () => {
  let c = [counter("round", { target: 4, rollover: true, rollover_counter_id: "squares" }), counter("squares")];
  let rolls = 0;
  for (let i = 0; i < 9; i++) {
    const r = applyCounterChange(c, "round", "add", 1);
    c = r.counters;
    rolls += r.rolls;
  }
  assert.equal(c.find((x) => x.id === "round")!.value, 1);
  assert.equal(c.find((x) => x.id === "squares")!.value, 2);
  assert.equal(rolls, 2);
});

test("timer: pause excludes paused time; survives restart via timestamps", () => {
  const t0 = new Date("2026-11-10T09:00:00Z");
  let s = startSession("s1", t0, 20, null);
  s = pauseSession(s, new Date("2026-11-10T10:00:00Z")); // 1h
  // 30 min paused, then the app is killed and reopened 3h later while still running
  s = resumeSession(s, new Date("2026-11-10T10:30:00Z"));
  assert.equal(activeSeconds(s, new Date("2026-11-10T13:30:00Z").getTime()), 4 * 3600);
  const done = finishSession(s, new Date("2026-11-10T13:30:00Z"));
  assert.equal(done.status, "finished");
  assert.equal(done.active_seconds, 4 * 3600);
  assert.equal(done.resumed_at, null);
  assert.equal(sessionSeconds({ ...done, adjusted_seconds: 3 * 3600 }), 3 * 3600);
});

test("timer: an interrupted session can end at the last activity", () => {
  const s = startSession("s1", new Date("2026-11-10T09:00:00Z"), null, null);
  const paused = pauseAt(s, new Date("2026-11-10T09:40:00Z"), new Date("2026-11-11T08:00:00Z"));
  assert.equal(paused.active_seconds, 40 * 60);
  const finished = finishSession(s, new Date("2026-11-11T08:00:00Z"), new Date("2026-11-10T09:40:00Z"));
  assert.equal(finished.active_seconds, 40 * 60);
  assert.equal(finished.ended_at, "2026-11-10T09:40:00.000Z");
});

test("progress methods", () => {
  const base = snapshot({ counters: [counter("rows", { is_main: true, value: 60 }), counter("squares", { value: 16 })] });
  assert.equal(computeProgress({ ...base, project: { ...base.project, progress: 35 } }).percent, 35);
  const units = computeProgress({ ...base, project: { ...base.project, progress_method: "units", progress_target: 40, progress_counter_id: "squares", unit_label: "granny squares" } });
  assert.deepEqual([units.percent, units.done, units.remaining, units.label], [40, 16, 24, "granny squares"]);
  const unconnected = computeProgress({ ...base, project: { ...base.project, progress_method: "units", progress_target: 40, progress_done: 10 } });
  assert.equal(unconnected.percent, 25, "counters do not drive progress unless connected");
  const rows = computeProgress({ ...base, project: { ...base.project, progress_method: "rows", progress_target: 240, progress_counter_id: "rows" } });
  assert.equal(rows.percent, 25);
  const steps = computeProgress({
    ...base,
    project: { ...base.project, progress_method: "steps" },
    sections: [{ id: "s", title: "A", notes: null, position: 0, steps: [1, 2, 3, 4].map((i) => ({ id: `st${i}`, body: "x", row_start: null, row_end: null, repeat_count: null, position: i })) }],
    completedSteps: ["st1", "st2", "gone"],
  });
  assert.equal(steps.percent, 50);
  const ms = computeProgress({
    ...base,
    project: { ...base.project, progress_method: "milestones" },
    milestones: [
      { id: "m1", title: "Front", position: 0, done_at: "2026-11-01", session_id: null },
      { id: "m2", title: "Back", position: 1, done_at: null, session_id: null },
    ],
  });
  assert.equal(ms.percent, 50);
});

test("insights: totals use corrected durations; estimate needs real pace", () => {
  const s1 = { ...finishSession(startSession("a", new Date("2026-11-01T10:00:00Z"), 0, null), new Date("2026-11-01T12:00:00Z")), progress_after: 20 };
  const s2 = { ...finishSession(startSession("b", new Date("2026-11-02T10:00:00Z"), 20, null), new Date("2026-11-02T12:00:00Z")), progress_after: 40, adjusted_seconds: 3600 };
  const ins = computeInsights({ sessions: [s1, s2], progressEvents: [] }, { percent: 40, done: null, target: null, remaining: null, label: "%" });
  assert.equal(ins.totalSeconds, 3 * 3600);
  assert.equal(ins.sessionCount, 2);
  assert.equal(ins.averageSeconds, 5400);
  // 40% in 3h -> 60% remaining ≈ 4.5h
  assert.equal(ins.estimateRemainingSeconds, 4.5 * 3600);
  const none = computeInsights({ sessions: [], progressEvents: [] }, { percent: 0, done: null, target: null, remaining: null, label: "%" });
  assert.equal(none.estimateRemainingSeconds, null);
});

test("pattern comparisons only use finished projects with tracked time", () => {
  const r = compareProjects([
    { id: "1", name: "First", status: "finished", trackedSeconds: 20 * 3600, sessions: 10 },
    { id: "2", name: "Second", status: "finished", trackedSeconds: 13 * 3600, sessions: 7 },
    { id: "3", name: "Third", status: "in_progress", trackedSeconds: 2 * 3600, sessions: 1 },
  ]);
  assert.equal(r.difference, 7 * 3600);
  assert.equal(r.fastest?.name, "Second");
  assert.equal(compareProjects([{ id: "1", name: "x", status: "finished", trackedSeconds: 0, sessions: 0 }]).difference, null);
});

test("replay applies unsynced ops on a newer base exactly once", () => {
  const base = snapshot();
  const ops = [
    op({ type: "counter.event", counterId: "rows", kind: "add", amount: 1, sessionId: null }),
    op({ type: "counter.event", counterId: "rows", kind: "add", amount: 1, sessionId: null }),
    op({ type: "step.set", stepId: "x", done: true }),
    op({ type: "project.update", patch: { notes: "Used 4mm" }, baseNotes: null }),
  ];
  const s = replay(base, ops);
  assert.equal(s.counters[0].value, 2);
  assert.deepEqual(s.completedSteps, ["x"]);
  assert.equal(s.project.notes, "Used 4mm");
  assert.equal(base.counters[0].value, 0, "base is not mutated");
});

test("compact keeps every counter event but collapses reader saves", () => {
  const rs = (page: number) => op({ type: "reader.save", state: { source_id: "pdf", page, zoom: 1, fit: "width", scroll_left: 0, scroll_top: 0, guides: [] } });
  const ev = () => op({ type: "counter.event", counterId: "rows", kind: "add", amount: 1, sessionId: null });
  const out = compact([rs(1), rs(2), ev(), ev(), rs(3), rs(4)]);
  assert.equal(out.length, 4);
  assert.equal(out.filter((o) => o.type === "counter.event").length, 2);
  assert.equal((out.at(-1) as Extract<Op, { type: "reader.save" }>).state.page, 4);
});

test("formatDuration", () => {
  assert.equal(formatDuration(4 * 3600 + 5 * 60), "4h 5m");
  assert.equal(formatDuration(59), "0m");
  assert.equal(formatDuration(3725, true), "1:02:05");
});

test("offline supply use draws on this project's reservation first", () => {
  const base = snapshot({
    supplies: [
      { id: "a1", item_id: "i1", kind: "material", family: "yarn", name: "DK", color_code: null, color_hexes: [], unit_label: "skein", measure: "count", entry_unit: "unit", reserved: 2, used: 0, planned: 4, free: 3, location: null },
    ],
  });
  const s = replay(base, [op({ type: "supply.use", allocationId: "a1", amount: 3, note: null })]);
  assert.deepEqual([s.supplies![0].reserved, s.supplies![0].used, s.supplies![0].free], [0, 3, 2]);
});
