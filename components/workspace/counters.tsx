"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import type { Counter, CounterMeta, Section } from "@/lib/workspace/model";
import type { Workspace } from "@/lib/workspace/use-workspace";

export const COUNTER_PRESETS = ["Sleeve rows", "Granny squares", "Pattern repeats", "Colour changes", "Stitch groups", "Rounds"];

const meta = (c: Counter): CounterMeta => {
  const { value: _value, ...rest } = c;
  void _value;
  return rest;
};

export type CounterTap = (c: Counter, sign: 1 | -1) => void;

/** Big, one-handed control for the selected counter. */
export function CounterDock({
  counters,
  selectedId,
  onSelect,
  onTap,
  onUndo,
  undoLabel,
  compact = false,
}: {
  counters: Counter[];
  selectedId: string;
  onSelect: (id: string) => void;
  onTap: CounterTap;
  onUndo: () => void;
  undoLabel: string | null;
  compact?: boolean;
}) {
  const c = counters.find((x) => x.id === selectedId) ?? counters[0];
  const [picker, setPicker] = useState(false);
  if (!c) return null;
  return (
    <div className={`flex items-stretch gap-2 ${compact ? "" : "p-1"}`} data-testid="counter-dock">
      <button
        type="button"
        onClick={() => onTap(c, -1)}
        aria-label={`Decrease ${c.name}`}
        className="grid w-14 shrink-0 place-items-center rounded-card bg-white/10 text-3xl font-light text-white active:bg-white/20"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => setPicker(true)}
        className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-card px-2 py-1 text-center hover:bg-white/5"
        aria-label={`${c.name}: ${c.value}${c.target ? ` of ${c.target}` : ""}. Switch counter`}
      >
        <span className="max-w-full truncate text-[0.7rem] font-semibold tracking-[0.14em] text-white/70 uppercase">
          {c.name} {counters.length > 1 && <span aria-hidden="true">▾</span>}
        </span>
        <span
          className="font-mono text-[2.4rem] leading-none font-semibold text-white tabular-nums [text-shadow:0_0_18px_rgb(182_255_0/0.35)] [@media(max-height:500px)]:text-[1.9rem]"
          data-testid="counter-value"
        >
          {c.value}
          {c.target ? <span className="text-lg text-white/50">/{c.target}</span> : null}
        </span>
        {c.target ? (
          <span className="mt-1.5 block h-1 w-16 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
            <span className="block h-full rounded-full bg-neon" style={{ width: `${Math.min(100, (c.value / c.target) * 100)}%` }} />
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => onTap(c, 1)}
        aria-label={`Increase ${c.name}${c.step > 1 ? ` by ${c.step}` : ""}`}
        className="grid w-[5.5rem] shrink-0 place-items-center rounded-card bg-neon text-4xl font-semibold text-midnight shadow-[0_0_24px_var(--neon-glow)] active:scale-[0.97] sm:w-28"
      >
        +{c.step > 1 ? <span className="sr-only">{c.step}</span> : null}
      </button>
      <button
        type="button"
        onClick={onUndo}
        disabled={!undoLabel}
        aria-label={undoLabel ? `Undo ${undoLabel}` : "Nothing to undo"}
        title={undoLabel ? `Undo ${undoLabel}` : "Nothing to undo"}
        className="grid w-11 shrink-0 place-items-center rounded-card text-lg text-white/80 hover:bg-white/10 disabled:opacity-25"
      >
        ↶
      </button>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Counters">
        <ul className="space-y-2">
          {counters.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                aria-pressed={x.id === c.id}
                onClick={() => {
                  onSelect(x.id);
                  setPicker(false);
                }}
                className="flex min-h-14 w-full items-center justify-between rounded-tile border border-line bg-white px-4 text-left aria-pressed:border-midnight aria-pressed:bg-selected"
              >
                <span className="font-semibold text-strong">
                  {x.name}
                  {x.is_main && <span className="ml-2 text-xs font-normal text-muted">main</span>}
                </span>
                <span className="font-mono text-lg text-strong">
                  {x.value}
                  {x.target ? <span className="text-sm text-muted">/{x.target}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

/** Full counter list for the tools panel: add, edit, reorder, reset. */
export function CounterList({
  ws,
  sections,
  selectedId,
  onSelect,
  onTap,
}: {
  ws: Workspace;
  sections: Section[];
  selectedId: string;
  onSelect: (id: string) => void;
  onTap: CounterTap;
}) {
  const counters = ws.state.counters;
  const [editing, setEditing] = useState<Counter | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const add = (label: string) => {
    const id = crypto.randomUUID();
    ws.dispatch({
      type: "counter.upsert",
      counter: { id, name: label.slice(0, 60), step: 1, target: null, rollover: false, rollover_counter_id: null, section_id: null, is_main: false, position: Math.max(0, ...counters.map((c) => c.position)) + 1 },
    });
    onSelect(id);
    setAdding(false);
    setName("");
  };

  const move = (c: Counter, dir: -1 | 1) => {
    const list = [...counters];
    const i = list.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((x, k) => x.position !== k && ws.dispatch({ type: "counter.upsert", counter: { ...meta(x), position: k } }));
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {counters.map((c, i) => {
          const linked = counters.find((x) => x.id === c.rollover_counter_id);
          const section = sections.find((s) => s.id === c.section_id);
          return (
            <li key={c.id} className={`rounded-card border p-3 ${c.id === selectedId ? "border-midnight bg-white" : "border-line bg-white/70"}`} data-testid={`counter-${c.name}`}>
              <div className="flex items-center gap-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(c.id)}>
                  <span className="block truncate font-semibold text-strong">
                    {c.name}
                    {c.is_main && <span className="ml-2 text-xs font-normal text-muted">main</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[c.step > 1 && `+${c.step} per tap`, c.target && `target ${c.target}`, c.rollover && linked && `rolls into ${linked.name}`, section && `§ ${section.title}`]
                      .filter(Boolean)
                      .join(" · ") || "Tap to use in the dock"}
                  </span>
                </button>
                <button type="button" aria-label={`Decrease ${c.name}`} onClick={() => onTap(c, -1)} className="grid size-11 place-items-center rounded-full bg-selected text-xl text-strong">
                  −
                </button>
                <span className="w-14 text-center font-mono text-xl font-semibold text-strong tabular-nums">{c.value}</span>
                <button type="button" aria-label={`Increase ${c.name}`} onClick={() => onTap(c, 1)} className="grid size-11 place-items-center rounded-full bg-midnight text-xl text-neon">
                  +
                </button>
              </div>
              {c.target ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-selected">
                  <div className="h-full rounded-full bg-cobalt" style={{ width: `${Math.min(100, (c.value / c.target) * 100)}%` }} />
                </div>
              ) : null}
              <div className="mt-2 flex gap-1 text-xs">
                <button type="button" className="min-h-9 rounded-full px-3 font-semibold text-accent hover:bg-selected" onClick={() => setEditing(c)}>
                  Edit
                </button>
                <button type="button" className="min-h-9 rounded-full px-2 text-muted hover:bg-selected disabled:opacity-30" disabled={i === 0} onClick={() => move(c, -1)} aria-label={`Move ${c.name} up`}>
                  ↑
                </button>
                <button type="button" className="min-h-9 rounded-full px-2 text-muted hover:bg-selected disabled:opacity-30" disabled={i === counters.length - 1} onClick={() => move(c, 1)} aria-label={`Move ${c.name} down`}>
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <div className="rounded-card border border-line bg-white p-3">
          <div className="flex flex-wrap gap-2">
            {COUNTER_PRESETS.filter((p) => !counters.some((c) => c.name === p)).map((p) => (
              <button key={p} type="button" className="chip" onClick={() => add(p)}>
                {p}
              </button>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) add(name.trim());
            }}
          >
            <input className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Custom name" maxLength={60} aria-label="Counter name" />
            <button type="submit" className="btn btn-ink" disabled={!name.trim()}>
              Add
            </button>
          </form>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary w-full" onClick={() => setAdding(true)}>
          ＋ Add counter
        </button>
      )}

      {editing && <CounterEditor key={editing.id} counter={editing} ws={ws} sections={sections} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CounterEditor({ counter, ws, sections, onClose }: { counter: Counter; ws: Workspace; sections: Section[]; onClose: () => void }) {
  const others = ws.state.counters.filter((c) => c.id !== counter.id);
  const [f, setF] = useState({
    name: counter.name,
    step: String(counter.step),
    target: counter.target ? String(counter.target) : "",
    rollover: counter.rollover,
    linked: counter.rollover_counter_id ?? "",
    section: counter.section_id ?? "",
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const live = ws.state.counters.find((c) => c.id === counter.id) ?? counter;
  const target = Number.parseInt(f.target, 10);

  const save = () => {
    ws.dispatch({
      type: "counter.upsert",
      counter: {
        ...meta(live),
        name: f.name.trim() || live.name,
        step: Math.max(1, Math.min(1000, Number.parseInt(f.step, 10) || 1)),
        target: target > 0 ? target : null,
        rollover: f.rollover && target > 0,
        rollover_counter_id: f.rollover && target > 0 && f.linked ? f.linked : null,
        section_id: f.section || null,
      },
    });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Edit ${live.name}`}
      footer={
        <button type="button" className="btn btn-ink w-full" onClick={save}>
          Save counter
        </button>
      }
    >
      <div className="space-y-5">
        <label className="block">
          <span className="eyebrow">Name</span>
          <input className="field mt-2" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="eyebrow">Each tap adds</span>
            <input type="number" inputMode="numeric" min={1} max={1000} className="field mt-2" value={f.step} onChange={(e) => setF({ ...f, step: e.target.value })} />
          </label>
          <label className="block">
            <span className="eyebrow">Target (optional)</span>
            <input type="number" inputMode="numeric" min={1} className="field mt-2" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="e.g. 40" />
          </label>
        </div>
        <fieldset className="rounded-tile border border-line p-3">
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-[#081638]" checked={f.rollover} disabled={!(target > 0)} onChange={(e) => setF({ ...f, rollover: e.target.checked })} />
            <span>
              Start over at 0 when it reaches the target
              <span className="block text-xs text-muted">You&rsquo;ll always see a notice when this happens.</span>
            </span>
          </label>
          {f.rollover && others.length > 0 && (
            <label className="mt-2 block">
              <span className="eyebrow">…and add one to</span>
              <select className="field mt-2" value={f.linked} onChange={(e) => setF({ ...f, linked: e.target.value })}>
                <option value="">No other counter</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </fieldset>
        {sections.length > 0 && (
          <label className="block">
            <span className="eyebrow">Instruction section (optional)</span>
            <select className="field mt-2" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
              <option value="">None</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {confirmReset ? (
            <>
              <span className="text-sm">Reset {live.name} from {live.value} to 0?</span>
              <button
                type="button"
                className="btn btn-danger !min-h-10"
                onClick={() => {
                  ws.changeCounter(live.id, "set", 0, null, `reset ${live.name}`);
                  setConfirmReset(false);
                }}
              >
                Reset
              </button>
              <button type="button" className="btn btn-secondary !min-h-10" onClick={() => setConfirmReset(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary !min-h-10" onClick={() => setConfirmReset(true)} disabled={live.value === 0}>
              Reset to 0…
            </button>
          )}
          {!live.is_main &&
            (confirmDelete ? (
              <button
                type="button"
                className="ml-auto text-sm font-semibold text-[#a3123f]"
                onClick={() => {
                  ws.dispatch({ type: "counter.delete", id: live.id });
                  onClose();
                }}
              >
                Confirm delete
              </button>
            ) : (
              <button type="button" className="ml-auto text-sm font-semibold text-[#a3123f]" onClick={() => setConfirmDelete(true)}>
                Delete counter…
              </button>
            ))}
        </div>
      </div>
    </Sheet>
  );
}
