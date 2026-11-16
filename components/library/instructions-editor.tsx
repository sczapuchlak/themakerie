"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { saveInstructions, type SectionInput } from "@/lib/library/actions";

type StepDraft = { key: string; id?: string; body: string; rowStart: string; rowEnd: string; repeatCount: string };
type SectionDraft = { key: string; id?: string; title: string; notes: string; steps: StepDraft[] };

export type InstructionsInitial = {
  id: string;
  title: string | null;
  notes: string | null;
  steps: { id: string; body: string; row_start: number | null; row_end: number | null; repeat_count: number | null }[];
}[];

let seq = 0;
const key = () => `k${++seq}`;
const num = (v: number | null) => (v ? String(v) : "");
const toInt = (v: string) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const blankStep = (): StepDraft => ({ key: key(), body: "", rowStart: "", rowEnd: "", repeatCount: "" });
const blankSection = (n: number): SectionDraft => ({ key: key(), title: n === 0 ? "Instructions" : `Section ${n + 1}`, notes: "", steps: [blankStep()] });

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const iconBtn = "grid size-10 place-items-center rounded-full text-muted hover:bg-selected disabled:opacity-30";

export function InstructionsEditor({ patternId, initial }: { patternId: string; initial: InstructionsInitial }) {
  const router = useRouter();
  const [sections, setSections] = useState<SectionDraft[]>(() =>
    initial.length
      ? initial.map((s) => ({
          key: key(),
          id: s.id,
          title: s.title ?? "",
          notes: s.notes ?? "",
          steps: s.steps.map((st) => ({ key: key(), id: st.id, body: st.body, rowStart: num(st.row_start), rowEnd: num(st.row_end), repeatCount: num(st.repeat_count) })),
        }))
      : [blankSection(0)],
  );
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = (fn: (s: SectionDraft[]) => SectionDraft[]) => {
    setSections(fn);
    setDirty(true);
  };
  const editSection = (i: number, patch: Partial<SectionDraft>) => edit((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const editStep = (i: number, k: number, patch: Partial<StepDraft>) =>
    edit((all) => all.map((s, j) => (j === i ? { ...s, steps: s.steps.map((st, l) => (l === k ? { ...st, ...patch } : st)) } : s)));

  const save = () =>
    start(async () => {
      setError(null);
      const payload: SectionInput[] = sections.map((s) => ({
        id: s.id,
        title: s.title,
        notes: s.notes,
        steps: s.steps
          .filter((st) => st.body.trim())
          .map((st) => ({ id: st.id, body: st.body, rowStart: toInt(st.rowStart), rowEnd: toInt(st.rowEnd), repeatCount: toInt(st.repeatCount) })),
      }));
      const r = await saveInstructions(patternId, payload);
      if (!r.ok) return setError(r.error);
      setDirty(false);
      router.push(`/patterns/${patternId}#instructions`);
    });

  return (
    <div className="mt-6 space-y-4 pb-28">
      {sections.map((s, i) => (
        <section key={s.key} className="surface-panel rounded-card p-5 sm:p-6" aria-label={s.title || `Section ${i + 1}`}>
          <div className="flex items-start gap-2">
            <label className="min-w-0 flex-1">
              <span className="eyebrow">Section {i + 1}</span>
              <input className="field mt-2 font-semibold" value={s.title} maxLength={120} onChange={(e) => editSection(i, { title: e.target.value })} placeholder="Yoke, Body, Sleeves…" />
            </label>
            <div className="mt-7 flex shrink-0">
              <button type="button" className={iconBtn} aria-label="Move section up" disabled={i === 0} onClick={() => edit((all) => move(all, i, i - 1))}>
                ↑
              </button>
              <button type="button" className={iconBtn} aria-label="Move section down" disabled={i === sections.length - 1} onClick={() => edit((all) => move(all, i, i + 1))}>
                ↓
              </button>
              <button type="button" className={`${iconBtn} hover:text-[#a3123f]`} aria-label="Delete section" onClick={() => edit((all) => all.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          </div>
          <label className="mt-4 block">
            <span className="eyebrow">Section notes (optional)</span>
            <textarea className="field mt-2 min-h-16" value={s.notes} maxLength={4000} onChange={(e) => editSection(i, { notes: e.target.value })} />
          </label>

          <ol className="mt-5 space-y-3">
            {s.steps.map((st, k) => (
              <li key={st.key} className="rounded-tile border border-line bg-white/70 p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-3 w-6 shrink-0 font-mono text-sm text-muted">{k + 1}.</span>
                  <textarea
                    className="field min-h-16 flex-1"
                    aria-label={`Step ${k + 1}`}
                    value={st.body}
                    maxLength={4000}
                    placeholder="Copy the step exactly as the pattern writes it."
                    onChange={(e) => editStep(i, k, { body: e.target.value })}
                  />
                  <div className="flex shrink-0 flex-col">
                    <button type="button" className={iconBtn} aria-label="Move step up" disabled={k === 0} onClick={() => editSection(i, { steps: move(s.steps, k, k - 1) })}>
                      ↑
                    </button>
                    <button type="button" className={iconBtn} aria-label="Move step down" disabled={k === s.steps.length - 1} onClick={() => editSection(i, { steps: move(s.steps, k, k + 1) })}>
                      ↓
                    </button>
                    <button type="button" className={`${iconBtn} hover:text-[#a3123f]`} aria-label="Delete step" onClick={() => editSection(i, { steps: s.steps.filter((_, l) => l !== k) })}>
                      ×
                    </button>
                  </div>
                </div>
                <div className="mt-2 ml-8 grid max-w-sm grid-cols-3 gap-2">
                  {(
                    [
                      ["rowStart", "Row from"],
                      ["rowEnd", "Row to"],
                      ["repeatCount", "Repeat ×"],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field}>
                      <span className="text-xs font-semibold text-muted">{label}</span>
                      <input type="number" inputMode="numeric" min={1} className="field mt-1 !min-h-10" value={st[field]} onChange={(e) => editStep(i, k, { [field]: e.target.value })} />
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-secondary mt-3 !min-h-10" onClick={() => editSection(i, { steps: [...s.steps, blankStep()] })}>
            ＋ Add step
          </button>
        </section>
      ))}

      <button type="button" className="btn btn-secondary" onClick={() => edit((all) => [...all, blankSection(all.length)])}>
        ＋ Add section
      </button>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:sticky md:bottom-4">
        <div className="gutter mx-auto flex max-w-[56rem] flex-wrap items-center gap-3 rounded-card border border-line bg-white/95 p-3 shadow-lg backdrop-blur">
          <button type="button" className="btn btn-ink" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save instructions"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.push(`/patterns/${patternId}`)}>
            Cancel
          </button>
          {error ? (
            <p role="alert" className="text-sm font-semibold text-[#a3123f]">
              {error}
            </p>
          ) : (
            dirty && <p className="text-sm text-muted">Unsaved changes</p>
          )}
        </div>
      </div>
    </div>
  );
}
