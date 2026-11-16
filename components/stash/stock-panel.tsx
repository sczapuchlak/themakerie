"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { addAllocation, addHolding, addLot, archiveItem, changeStock, deleteHolding, deleteItem, reserveSupply, saveWant, setItemFavorite, updateLot } from "@/lib/stash/actions";
import { fromBase, plural, toBase, type EntryUnit, type Measure } from "@/lib/stash/catalog";

type Holding = {
  id: string;
  measure: string;
  quantity: number;
  reserved: number;
  condition: string;
  amount_known: boolean;
  entry_unit: string;
  width_mm: number | null;
  height_mm: number | null;
  label: string | null;
};
type Lot = { id: string; dye_lot: string | null; location_id: string | null; locationName: string | null; purchased_on: string | null; source: string | null; holdings: Holding[] };
type Opt = { id: string; name: string; parent_id: string | null };
type Project = { id: string; name: string; status: string };

const uid = () => crypto.randomUUID();
const ErrorLine = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="mt-3 text-sm font-semibold text-[#a3123f]">
      {text}
    </p>
  ) : null;

/** One holding in words — exact where known, honest where not. */
export function describeHolding(h: Holding, unitLabel: string) {
  if (h.measure === "piece") {
    const dims = h.width_mm && h.height_mm ? `${fmtDim(h.width_mm, h.entry_unit)} × ${fmtDim(h.height_mm, h.entry_unit)}` : "size not recorded";
    return `${h.label ? `${h.label} · ` : ""}${dims}`;
  }
  if (h.measure === "count") {
    if (h.condition === "partial") return h.amount_known ? plural(h.quantity, `partial ${unitLabel}`) : `${plural(h.quantity, `partly used ${unitLabel}`)} (amount unknown)`;
    return plural(h.quantity, unitLabel);
  }
  const text = fromBase(h.quantity, h.measure as Measure, h.entry_unit);
  return h.condition === "partial" ? `${text} leftover` : text;
}
const fmtDim = (mm: number, unit: string) => (unit === "in" ? `${Math.round((mm / 25.4) * 10) / 10} in` : `${Math.round(mm / 10 * 10) / 10} cm`);

/** Amount input in the holding's own unit family. */
function useAmount(measure: string, entryUnit: string) {
  const units: EntryUnit[] = measure === "mass" ? ["g", "oz"] : measure === "length" ? ["m", "yd", "cm"] : ["unit"];
  const [unit, setUnit] = useState<EntryUnit>(units.includes(entryUnit as EntryUnit) ? (entryUnit as EntryUnit) : units[0]);
  const [value, setValue] = useState("");
  const base = () => (Number(value) > 0 ? toBase(Number(value), unit).quantity : 0);
  const field = (label: string) => (
    <div className="flex items-center gap-2">
      <input className="field w-28" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-label={label} data-testid="amount" />
      {units.length > 1 ? (
        units.map((u) => (
          <button key={u} type="button" className="chip !min-h-9" aria-pressed={unit === u} onClick={() => setUnit(u)}>
            {u}
          </button>
        ))
      ) : null}
    </div>
  );
  return { base, field, value, setValue };
}

export function StockPanel({
  itemId,
  kind,
  family,
  unitLabel,
  lots,
  locations,
  projects,
}: {
  itemId: string;
  kind: string;
  family: string;
  unitLabel: string;
  lots: Lot[];
  locations: Opt[];
  projects: Project[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | { type: "adjust"; h: Holding } | { type: "use"; h: Holding } | { type: "lot" } | { type: "leftover"; lot: Lot } | { type: "reserve" }>(null);
  const holdingsAll = lots.flatMap((l) => l.holdings.map((h) => ({ ...h, lot: l })));
  const close = () => {
    setSheet(null);
    setError(null);
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      close();
      router.refresh();
    });

  return (
    <section aria-labelledby="stock-title" data-testid="stock-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="stock-title" className="font-display-tight text-[clamp(1.4rem,2.6vw,1.75rem)]">
          {kind === "tool" ? "Owned" : "Stock by batch"}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ink press !min-h-10" onClick={() => setSheet({ type: "lot" })} data-testid="add-more">
            ＋ Add more
          </button>
          {projects.length > 0 && (
            <button type="button" className="btn btn-secondary press !min-h-10" onClick={() => setSheet({ type: "reserve" })} data-testid="reserve-for-project">
              {kind === "tool" ? "Use in a project" : "Reserve for a project"}
            </button>
          )}
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {lots.map((lot, i) => (
          <li key={lot.id} className="card-plain rounded-card p-4" data-testid="lot">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-semibold text-strong">
                {lot.dye_lot ? (
                  <>
                    Dye lot <span className="font-mono">{lot.dye_lot}</span>
                  </>
                ) : (
                  `Batch ${i + 1}`
                )}
              </span>
              <label className="flex items-center gap-1.5 text-sm text-muted">
                ⌖
                <select
                  className="rounded-full border border-line bg-white px-2 py-1 text-sm text-strong"
                  value={lot.location_id ?? ""}
                  onChange={(e) => run(() => updateLot(lot.id, { locationId: e.target.value || null }))}
                  aria-label="Where it lives"
                >
                  <option value="">No place set</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {pathOf(locations, l.id)}
                    </option>
                  ))}
                </select>
              </label>
              {lot.source && <span className="text-sm text-muted">from {lot.source}</span>}
              {kind !== "tool" && family !== "fabric" && (
                <button type="button" className="ml-auto text-sm font-semibold text-accent hover:underline" onClick={() => setSheet({ type: "leftover", lot })}>
                  ＋ Leftover
                </button>
              )}
            </div>
            <ul className="mt-3 divide-y divide-line">
              {lot.holdings.length === 0 && <li className="py-2 text-sm text-muted">Nothing in this batch.</li>}
              {lot.holdings.map((h) => {
                const available = h.quantity - h.reserved;
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 py-2.5" data-testid="holding">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-strong">{describeHolding(h, unitLabel)}</span>
                      {h.reserved > 0 && (
                        <span className="text-sm text-[#8a1466]">
                          {h.measure === "piece" ? "reserved" : `${fromBase(h.reserved, h.measure as Measure, h.entry_unit, unitLabel)} reserved · ${fromBase(available, h.measure as Measure, h.entry_unit, unitLabel)} free`}
                        </span>
                      )}
                    </span>
                    {h.measure !== "piece" && (h.amount_known || h.measure === "count") && (
                      <span className="flex gap-1">
                        <button type="button" className="press grid size-10 place-items-center rounded-full bg-selected text-lg text-strong" aria-label="Use or remove some" onClick={() => setSheet({ type: "use", h })}>
                          −
                        </button>
                        <button type="button" className="press grid size-10 place-items-center rounded-full bg-midnight text-lg text-neon" aria-label="Add some" onClick={() => setSheet({ type: "adjust", h })}>
                          +
                        </button>
                      </span>
                    )}
                    {h.reserved === 0 && (
                      <button
                        type="button"
                        className="min-h-10 px-1 text-xs font-semibold text-muted hover:text-[#a3123f]"
                        onClick={() => window.confirm("Remove this from your stash? It stays in the history.") && run(() => deleteHolding(h.id))}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <ErrorLine text={sheet ? null : error} />

      {sheet?.type === "adjust" && <AdjustSheet h={sheet.h} unitLabel={unitLabel} pending={pending} error={error} onClose={close} onSave={(delta, note) => run(() => changeStock({ opId: uid(), holdingId: sheet.h.id, kind: "add", delta, note }))} mode="add" />}
      {sheet?.type === "use" && (
        <AdjustSheet h={sheet.h} unitLabel={unitLabel} pending={pending} error={error} onClose={close} onSave={(delta, note) => run(() => changeStock({ opId: uid(), holdingId: sheet.h.id, kind: "remove", delta: -delta, note }))} mode="use" />
      )}
      {sheet?.type === "lot" && <NewLotSheet itemId={itemId} family={family} kind={kind} unitLabel={unitLabel} locations={locations} pending={pending} error={error} onClose={close} run={run} />}
      {sheet?.type === "leftover" && <LeftoverSheet lot={sheet.lot} itemId={itemId} pending={pending} error={error} onClose={close} run={run} />}
      {sheet?.type === "reserve" && <ReserveSheet itemId={itemId} kind={kind} unitLabel={unitLabel} holdings={holdingsAll} projects={projects} onClose={close} />}
    </section>
  );
}

function AdjustSheet({ h, unitLabel, mode, pending, error, onClose, onSave }: { h: Holding; unitLabel: string; mode: "add" | "use"; pending: boolean; error: string | null; onClose: () => void; onSave: (delta: number, note: string) => void }) {
  const amt = useAmount(h.measure, h.entry_unit);
  const [note, setNote] = useState("");
  const free = h.quantity - h.reserved;
  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === "add" ? "Add to this" : "Record used or removed"}
      footer={
        <button type="button" className="btn btn-ink w-full" disabled={pending || !amt.base()} onClick={() => onSave(amt.base(), note)} data-testid="save-amount">
          {pending ? "Saving…" : mode === "add" ? "Add" : "Record"}
        </button>
      }
    >
      <p className="text-body">
        <strong className="text-strong">{describeHolding(h, unitLabel)}</strong>
        {mode === "use" && h.reserved > 0 && <span className="block text-sm text-muted">{fromBase(free, h.measure as Measure, h.entry_unit, unitLabel)} isn&rsquo;t reserved — reserved stock stays with its project.</span>}
      </p>
      <div className="mt-4">{amt.field("Amount")}</div>
      <label className="mt-4 block">
        <span className="eyebrow">Note (optional)</span>
        <input className="field mt-2" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={mode === "add" ? "Found another skein" : "Swatching / gave to a friend"} />
      </label>
      <p className="mt-3 text-xs text-muted">Every change is kept in this supply&rsquo;s history.</p>
      <ErrorLine text={error} />
    </Sheet>
  );
}

function NewLotSheet({ itemId, family, kind, unitLabel, locations, pending, error, onClose, run }: { itemId: string; family: string; kind: string; unitLabel: string; locations: Opt[]; pending: boolean; error: string | null; onClose: () => void; run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void }) {
  const [lotId] = useState(uid);
  const [count, setCount] = useState("1");
  const [dyeLot, setDyeLot] = useState("");
  const [locationId, setLocationId] = useState("");
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const fabric = family === "fabric";
  return (
    <Sheet
      open
      onClose={onClose}
      title={kind === "tool" ? "Add more" : "Add a new batch"}
      footer={
        <button
          type="button"
          className="btn btn-ink w-full"
          disabled={pending}
          onClick={() =>
            run(() =>
              addLot(itemId, {
                id: lotId,
                dyeLot: dyeLot || null,
                locationId: locationId || null,
                purchasedOn: new Date().toISOString().slice(0, 10),
                holdings: fabric
                  ? [{ measure: "piece", quantity: 1, condition: "full", amountKnown: true, entryUnit: "cm", widthMm: w ? Math.round(Number(w) * 10) : null, heightMm: h ? Math.round(Number(h) * 10) : null }]
                  : [{ measure: "count", quantity: Math.max(1, Number.parseInt(count, 10) || 1), condition: "full", amountKnown: true, entryUnit: "unit" }],
              }),
            )
          }
          data-testid="save-lot"
        >
          {pending ? "Adding…" : "Add to stash"}
        </button>
      }
    >
      {fabric ? (
        <div className="flex items-center gap-2">
          <input className="field w-24" inputMode="decimal" placeholder="Width" value={w} onChange={(e) => setW(e.target.value)} aria-label="Width (cm)" />×
          <input className="field w-24" inputMode="decimal" placeholder="Height" value={h} onChange={(e) => setH(e.target.value)} aria-label="Height (cm)" />
          <span className="text-muted">cm</span>
        </div>
      ) : (
        <label className="flex items-center gap-2">
          <input className="field w-24" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} aria-label="How many" data-testid="lot-count" />
          <span className="text-strong">{unitLabel}s</span>
        </label>
      )}
      {(family === "yarn" || family === "thread") && (
        <label className="mt-4 block">
          <span className="eyebrow">Dye lot / batch</span>
          <input className="field mt-2 font-mono" value={dyeLot} onChange={(e) => setDyeLot(e.target.value)} maxLength={60} data-testid="lot-dye" />
          <span className="mt-1 block text-xs text-muted">Different dye lots are kept as separate batches so colours don&rsquo;t get mixed up.</span>
        </label>
      )}
      <label className="mt-4 block">
        <span className="eyebrow">Where it lives</span>
        <select className="field mt-2" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Not set</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {pathOf(locations, l.id)}
            </option>
          ))}
        </select>
      </label>
      <ErrorLine text={error} />
    </Sheet>
  );
}

function LeftoverSheet({ lot, itemId, pending, error, onClose, run }: { lot: Lot; itemId: string; pending: boolean; error: string | null; onClose: () => void; run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void }) {
  const [holdingId] = useState(uid);
  const [known, setKnown] = useState(true);
  const amt = useAmount("mass", "g");
  const [unitFamily, setUnitFamily] = useState<"mass" | "length">("mass");
  const lenAmt = useAmount("length", "m");
  const active = unitFamily === "mass" ? amt : lenAmt;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Add a leftover or partial"
      footer={
        <button
          type="button"
          className="btn btn-ink w-full"
          disabled={pending || (known && !active.base())}
          onClick={() =>
            run(() =>
              addHolding(
                lot.id,
                itemId,
                known
                  ? { id: holdingId, measure: unitFamily, quantity: active.base(), condition: "partial", amountKnown: true, entryUnit: unitFamily === "mass" ? "g" : "m" }
                  : { id: holdingId, measure: "count", quantity: 1, condition: "partial", amountKnown: false, entryUnit: "unit" },
              ),
            )
          }
        >
          Add
        </button>
      }
    >
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5 accent-[#081638]" checked={!known} onChange={(e) => setKnown(!e.target.checked)} />I don&rsquo;t know how much is left
      </label>
      {known && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <button type="button" className="chip !min-h-9" aria-pressed={unitFamily === "mass"} onClick={() => setUnitFamily("mass")}>
              By weight
            </button>
            <button type="button" className="chip !min-h-9" aria-pressed={unitFamily === "length"} onClick={() => setUnitFamily("length")}>
              By length
            </button>
          </div>
          {active.field("Leftover amount")}
        </div>
      )}
      <ErrorLine text={error} />
    </Sheet>
  );
}

/** Reserve stock (or link a tool) for a project; never over-reserve silently. */
function ReserveSheet({ itemId, kind, unitLabel, holdings, projects, onClose }: { itemId: string; kind: string; unitLabel: string; holdings: (Holding & { lot: Lot })[]; projects: Project[]; onClose: () => void }) {
  const router = useRouter();
  const usable = holdings.filter((h) => h.measure !== "piece" || h.reserved === 0);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [holdingId, setHoldingId] = useState(usable.find((h) => h.quantity - h.reserved > 0)?.id ?? usable[0]?.id ?? "");
  const h = usable.find((x) => x.id === holdingId);
  const amt = useAmount(h?.measure ?? "count", h?.entry_unit ?? "unit");
  const [error, setError] = useState<string | null>(null);
  const [shortage, setShortage] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const free = h ? h.quantity - h.reserved : 0;

  const reserve = (qty: number) =>
    start(async () => {
      setError(null);
      const a = await addAllocation({ projectId, itemId, holdingId: kind === "tool" ? null : holdingId, plannedQuantity: kind === "tool" ? null : amt.base() || qty });
      if (!a.ok) return setError(a.error);
      if (kind !== "tool" && qty > 0) {
        const r = await reserveSupply({ opId: uid(), allocationId: a.id, delta: qty });
        if (!r.ok) return setError(r.error);
      }
      onClose();
      router.refresh();
    });

  const submit = () => {
    if (kind === "tool") return reserve(0);
    const want = h?.measure === "piece" ? 1 : amt.base();
    if (!want) return setError("Enter how much to set aside.");
    if (want > free) return setShortage(want - free);
    reserve(want);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={kind === "tool" ? "Use in a project" : "Reserve for a project"}
      footer={
        shortage !== null && h ? (
          <div className="space-y-2">
            <p className="text-sm text-body">
              Only <strong>{fromBase(free, h.measure as Measure, h.entry_unit, unitLabel)}</strong> is free. Reserve that and put the missing{" "}
              <strong>{fromBase(shortage, h.measure as Measure, h.entry_unit, unitLabel)}</strong> on the shopping list?
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ink"
                disabled={pending || free <= 0}
                onClick={() =>
                  start(async () => {
                    await saveWant({ list: "shopping", family: "other", name: `More for ${projects.find((p) => p.id === projectId)?.name ?? "project"}`, neededQuantity: h.measure === "count" ? shortage : null, unitLabel: h.measure === "count" ? unitLabel : fromBase(shortage, h.measure as Measure, h.entry_unit), projectId, itemId });
                    reserve(free);
                  })
                }
                data-testid="reserve-and-shop"
              >
                Reserve {fromBase(free, h.measure as Measure, h.entry_unit, unitLabel)} + add to list
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShortage(null)}>
                Change amount
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ink w-full" disabled={pending || !projectId} onClick={submit} data-testid="confirm-reserve">
            {pending ? "Saving…" : kind === "tool" ? "Assign to project" : "Reserve"}
          </button>
        )
      }
    >
      <label className="block">
        <span className="eyebrow">Project</span>
        <select className="field mt-2" value={projectId} onChange={(e) => setProjectId(e.target.value)} data-testid="reserve-project">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {kind !== "tool" && (
        <>
          <label className="mt-4 block">
            <span className="eyebrow">From</span>
            <select className="field mt-2" value={holdingId} onChange={(e) => (setHoldingId(e.target.value), setShortage(null))}>
              {usable.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.lot.dye_lot ? `Lot ${x.lot.dye_lot}: ` : ""}
                  {describeHolding(x, unitLabel)} ({fromBase(x.quantity - x.reserved, x.measure as Measure, x.entry_unit, unitLabel)} free)
                </option>
              ))}
            </select>
          </label>
          {h?.measure !== "piece" && <div className="mt-4">{amt.field("Amount to reserve")}</div>}
          <p className="mt-3 text-xs text-muted">Reserving sets stock aside; nothing is used up until you record it.</p>
        </>
      )}
      {kind === "tool" && <p className="mt-3 text-sm text-muted">Tools are linked to the project and never used up.</p>}
      <ErrorLine text={error} />
    </Sheet>
  );
}

function pathOf(rows: Opt[], id: string) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const parts: string[] = [];
  let cur = byId.get(id);
  for (let i = 0; cur && i < 20; i++) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return parts.join(" › ");
}

export function ItemFavorite({ id, favorite }: { id: string; favorite: boolean }) {
  const [on, setOn] = useState(favorite);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Remove from favourites" : "Add to favourites"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOn(!on);
          const r = await setItemFavorite(id, !on);
          if (!r.ok) setOn(on);
        })
      }
      className="press grid size-11 place-items-center rounded-full bg-white text-xl shadow ring-1 ring-line"
      data-testid="item-favorite"
    >
      <span className={`pop ${on ? "text-[#c01f97]" : "text-muted"}`} data-on={on}>
        {on ? "★" : "☆"}
      </span>
    </button>
  );
}

export function ItemManage({ id, archived, usedByProjects }: { id: string; archived: boolean; usedByProjects: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <span className="eyebrow mr-1">Manage</span>
      <button type="button" className="min-h-11 font-semibold text-strong hover:underline" disabled={pending} onClick={() => start(async () => (await archiveItem(id, !archived), router.refresh()))}>
        {archived ? "Restore from archive" : "Archive"}
      </button>
      <button
        type="button"
        className="min-h-11 font-semibold text-[#a3123f] hover:underline"
        disabled={pending}
        onClick={() => {
          if (usedByProjects) return setError("Projects use this supply — archive it instead to keep their history.");
          if (!window.confirm("Delete this supply and its history? This can't be undone.")) return;
          start(async () => {
            const r = await deleteItem(id);
            if (!r.ok) return setError(r.error);
            router.push("/stash");
          });
        }}
      >
        Delete…
      </button>
      <ErrorLine text={error} />
    </div>
  );
}
