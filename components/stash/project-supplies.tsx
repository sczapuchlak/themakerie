"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { NumberedHeading } from "@/components/editorial/foil";
import { Sheet } from "@/components/ui/sheet";
import { addAllocation, removeAllocation, reserveSupply, returnLeftover, saveWant, updateAllocation, recordSupplyUse } from "@/lib/stash/actions";
import { familyLabel, fromBase, toBase, type EntryUnit, type Measure } from "@/lib/stash/catalog";
import type { Pickable, ProjectSupplies } from "@/lib/stash/data";
import { describeHolding } from "./stock-panel";
import { SupplyArt } from "./supply-art";

const uid = () => crypto.randomUUID();
type Alloc = ProjectSupplies["allocations"][number];
type Req = ProjectSupplies["requirements"][number];

const amountText = (q: number, measure: string | null, unitLabel: string, entry = "g") => (measure ? fromBase(q, measure as Measure, measure === "length" ? "m" : entry, unitLabel) : String(q));

function AmountField({ measure, value, setValue, unit, setUnit }: { measure: string; value: string; setValue: (v: string) => void; unit: EntryUnit; setUnit: (u: EntryUnit) => void }) {
  const units: EntryUnit[] = measure === "mass" ? ["g", "oz"] : measure === "length" ? ["m", "yd"] : [];
  return (
    <div className="flex items-center gap-2">
      <input className="field w-28" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Amount" data-testid="supply-amount" />
      {units.map((u) => (
        <button key={u} type="button" className="chip !min-h-9" aria-pressed={unit === u} onClick={() => setUnit(u)}>
          {u}
        </button>
      ))}
    </div>
  );
}

export function ProjectSuppliesSection({ n, projectId, projectName, supplies, pickable }: { n: number; projectId: string; projectName: string; supplies: ProjectSupplies; pickable: Pickable }) {
  const router = useRouter();
  const [picker, setPicker] = useState<{ requirement: Req | null } | null>(null);
  const [action, setAction] = useState<null | { type: "reserve" | "use" | "release" | "leftover"; a: Alloc }>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { allocations, requirements, wants, kits } = supplies;
  const active = allocations.filter((a) => a.status !== "returned");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? "Something went wrong.");
      after?.();
      router.refresh();
    });

  return (
    <section aria-labelledby="supplies" data-testid="project-supplies">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <NumberedHeading n={n} id="supplies" size="sm">
          Supplies
        </NumberedHeading>
        <button type="button" className="btn btn-secondary press !min-h-10" onClick={() => setPicker({ requirement: null })} data-testid="add-from-stash">
          ＋ From stash
        </button>
      </div>

      {requirements.length > 0 && (
        <div className="mt-4 rounded-card bg-selected p-4" data-testid="pattern-calls-for">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">The pattern calls for</p>
          <ul className="mt-2 space-y-2">
            {requirements.map((r) => {
              const linked = active.filter((a) => a.requirement_id === r.id);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-strong">{r.description}</span>
                    {r.quantity_text && <span className="text-muted"> · {r.quantity_text}</span>}
                    {linked.length > 0 && <span className="ml-2 rounded-full bg-[#e6ffb3] px-2 py-0.5 text-xs font-semibold text-[#2b4a00]">✓ {linked.map((l) => l.item?.name).join(", ")}</span>}
                  </span>
                  {linked.length === 0 && (
                    <>
                      <button type="button" className="text-sm font-semibold text-accent hover:underline" onClick={() => setPicker({ requirement: r })}>
                        Pick from stash
                      </button>
                      <button
                        type="button"
                        className="text-sm font-semibold text-accent hover:underline"
                        disabled={pending}
                        onClick={() => run(() => saveWant({ list: "shopping", family: r.family, name: r.description, notes: r.quantity_text, projectId }))}
                      >
                        Add to shopping list
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Suggestions from the pattern — not the same as what you own or have set aside.</p>
        </div>
      )}

      {active.length === 0 ? (
        <p className="mt-4 rounded-card border-2 border-dashed border-line px-5 py-4 text-sm text-body">
          Nothing linked yet. Pick the actual yarn, floss or tools you&rsquo;re using from your stash — reserving keeps other projects from claiming them.
        </p>
      ) : (
        <ul className="mt-4 space-y-2" data-testid="supply-list">
          {active.map((a) => {
            const unit = a.item?.unit_label ?? "unit";
            const material = a.kind === "material";
            return (
              <li key={a.id} className="card-plain flex flex-wrap items-center gap-3 rounded-card p-3">
                <Link href={`/stash/${a.item_id}`} className="size-14 shrink-0 overflow-hidden rounded-tile">
                  {a.item?.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.item.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <SupplyArt family={a.item?.family ?? "other"} colors={a.item?.color_hexes ?? []} />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/stash/${a.item_id}`} className="block truncate font-semibold text-strong hover:underline">
                    {a.item?.name}
                    {a.item?.color_code && <span className="ml-1.5 font-mono text-sm font-normal text-muted">#{a.item.color_code}</span>}
                  </Link>
                  <p className="text-sm text-muted">
                    {material ? (
                      <>
                        {a.planned_quantity ? `plan ${amountText(a.planned_quantity, a.measure, unit)} · ` : ""}
                        <span className={a.reserved_quantity ? "font-semibold text-[#8a1466]" : ""}>{amountText(a.reserved_quantity, a.measure, unit)} reserved</span>
                        {a.used_quantity > 0 && <> · {amountText(a.used_quantity, a.measure, unit)} used</>}
                      </>
                    ) : (
                      <span className="font-semibold text-[#0d5f80]">Tool · in use for this project</span>
                    )}
                    {a.item?.locationNames[0] && <> · ⌖ {a.item.locationNames[0]}</>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {material && a.holding_id ? (
                    <>
                      <button type="button" className="btn btn-ink press !min-h-9 !px-3 !text-xs" onClick={() => setAction({ type: "use", a })} data-testid="record-used">
                        Record used
                      </button>
                      <button type="button" className="btn btn-secondary press !min-h-9 !px-3 !text-xs" onClick={() => setAction({ type: "reserve", a })}>
                        Reserve
                      </button>
                      {a.reserved_quantity > 0 && (
                        <button type="button" className="btn btn-secondary press !min-h-9 !px-3 !text-xs" onClick={() => setAction({ type: "release", a })} data-testid="release">
                          Release
                        </button>
                      )}
                      {a.used_quantity > 0 && (
                        <button type="button" className="btn btn-secondary press !min-h-9 !px-3 !text-xs" onClick={() => setAction({ type: "leftover", a })}>
                          Leftover
                        </button>
                      )}
                    </>
                  ) : !material ? (
                    <button type="button" className="btn btn-secondary press !min-h-9 !px-3 !text-xs" disabled={pending} onClick={() => run(() => updateAllocation(a.id, { status: "returned" }))}>
                      Done with it
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove ${a.item?.name} from project`}
                    className="grid size-9 place-items-center rounded-full text-muted hover:bg-selected"
                    disabled={pending}
                    onClick={() => window.confirm(a.reserved_quantity ? "Remove and release its reservation?" : "Remove from this project?") && run(() => removeAllocation(a.id))}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(wants.length > 0 || kits.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {wants.length > 0 && (
            <Link href="/stash/shopping" className="font-semibold text-accent hover:underline">
              🛒 {wants.filter((w) => w.status !== "received").length} to buy for this project
            </Link>
          )}
          {kits.map((k) => (
            <Link key={k.id} href={`/stash/kits#kit-${k.id}`} className="font-semibold text-accent hover:underline">
              🧺 {k.name}
            </Link>
          ))}
        </div>
      )}
      {error && !action && !picker && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[#a3123f]">
          {error}
        </p>
      )}

      {picker && <StashPicker projectId={projectId} projectName={projectName} requirement={picker.requirement} pickable={pickable} onClose={() => setPicker(null)} />}
      {action && <AllocationSheet action={action} pending={pending} error={error} onClose={() => (setAction(null), setError(null))} run={run} />}
    </section>
  );
}

function AllocationSheet({ action, pending, error, onClose, run }: { action: { type: "reserve" | "use" | "release" | "leftover"; a: Alloc }; pending: boolean; error: string | null; onClose: () => void; run: (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => void }) {
  const { a, type } = action;
  const measure = a.measure ?? "count";
  const unitLabel = a.item?.unit_label ?? "unit";
  const [value, setValue] = useState(type === "release" ? amountPlain(a.reserved_quantity, measure) : "");
  // Leftovers of skein-counted yarn are usually weighed, so start in grams.
  const [unit, setUnit] = useState<EntryUnit>(measure === "mass" || (type === "leftover" && measure === "count") ? "g" : measure === "length" ? "m" : "unit");
  const [leftMeasure, setLeftMeasure] = useState<"mass" | "length" | "count">(measure === "count" ? "mass" : (measure as "mass" | "length"));
  const [known, setKnown] = useState(true);
  const [note, setNote] = useState("");
  const [opId] = useState(uid);
  const base = Number(value) > 0 ? toBase(Number(value), unit).quantity : 0;
  const free = a.holding ? a.holding.quantity - a.holding.reserved : 0;
  const titles = { reserve: "Reserve more", use: "Record what you used", release: "Release unused", leftover: "Return a leftover" };

  const submit = () => {
    if (type === "reserve") return run(() => reserveSupply({ opId, allocationId: a.id, delta: base }), onClose);
    if (type === "release") return run(() => reserveSupply({ opId, allocationId: a.id, delta: -base }), onClose);
    if (type === "use") return run(() => recordSupplyUse({ opId, allocationId: a.id, amount: base, note }), onClose);
    const lb = known ? toBase(Number(value), leftMeasure === "count" ? "unit" : unit).quantity : 1;
    return run(() => returnLeftover({ opId, allocationId: a.id, measure: known ? leftMeasure : "count", amount: lb, amountKnown: known, note }), onClose);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={titles[type]}
      footer={
        <button type="button" className="btn btn-ink w-full" disabled={pending || (type !== "leftover" && !base) || (type === "leftover" && known && !(Number(value) > 0))} onClick={submit} data-testid="confirm-supply-action">
          {pending ? "Saving…" : titles[type]}
        </button>
      }
    >
      <p className="font-semibold text-strong">{a.item?.name}</p>
      {a.holding && <p className="text-sm text-muted">From {describeHolding(a.holding, unitLabel)} · {fromBase(free, measure as Measure, a.holding.entry_unit, unitLabel)} free</p>}
      <div className="mt-4">
        {type === "leftover" ? (
          <>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" className="size-5 accent-[#081638]" checked={!known} onChange={(e) => setKnown(!e.target.checked)} />I don&rsquo;t know how much is left
            </label>
            {known && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  {(["mass", "length", "count"] as const).map((m) => (
                    <button key={m} type="button" className="chip !min-h-9" aria-pressed={leftMeasure === m} onClick={() => (setLeftMeasure(m), setUnit(m === "mass" ? "g" : m === "length" ? "m" : "unit"))}>
                      {m === "mass" ? "Weight" : m === "length" ? "Length" : `Whole ${unitLabel}s`}
                    </button>
                  ))}
                </div>
                <AmountField measure={leftMeasure} value={value} setValue={setValue} unit={unit} setUnit={setUnit} />
              </div>
            )}
          </>
        ) : (
          <AmountField measure={measure} value={value} setValue={setValue} unit={unit} setUnit={setUnit} />
        )}
      </div>
      {type === "use" && (
        <>
          <label className="mt-4 block">
            <span className="eyebrow">Note (optional)</span>
            <input className="field mt-2" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Body and sleeves" />
          </label>
          <p className="mt-3 text-xs text-muted">Uses this project&rsquo;s reservation first. Another project&rsquo;s reserved stock is never touched.</p>
        </>
      )}
      {type === "reserve" && <p className="mt-3 text-xs text-muted">Reserving sets stock aside for this project — nothing is used up until you record it.</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#a3123f]">
          {error}
        </p>
      )}
    </Sheet>
  );
}

const amountPlain = (q: number, measure: string) => (measure === "mass" ? String(q / 10) : measure === "length" ? String(q / 100) : String(q));

/** Search the stash and link an item (and optionally reserve now). */
function StashPicker({ projectId, projectName, requirement, pickable, onClose }: { projectId: string; projectName: string; requirement: Req | null; pickable: Pickable; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<Pickable[number] | null>(null);
  const [holdingId, setHoldingId] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<EntryUnit>("unit");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return pickable
      .filter((p) => (requirement && !term ? p.family === requirement.family || requirement.family === "other" : true))
      .filter((p) => !term || (p.search_text ?? "").includes(term))
      .slice(0, 40);
  }, [q, pickable, requirement]);
  const h = chosen?.holdings.find((x) => x.id === holdingId);
  const base = Number(value) > 0 ? toBase(Number(value), unit).quantity : 0;
  const free = h ? h.quantity - h.reserved : 0;

  const add = () =>
    start(async () => {
      if (!chosen) return;
      setError(null);
      const a = await addAllocation({ projectId, itemId: chosen.id!, holdingId: chosen.kind === "tool" ? null : holdingId || null, plannedQuantity: base || null, requirementId: requirement?.id ?? null });
      if (!a.ok) return setError(a.error);
      if (chosen.kind === "material" && base > 0) {
        const reserve = Math.min(base, free);
        if (reserve > 0) {
          const r = await reserveSupply({ opId: uid(), allocationId: a.id, delta: reserve });
          if (!r.ok) return setError(r.error);
        }
        if (base > free && h) {
          await saveWant({
            list: "shopping",
            family: chosen.family!,
            name: chosen.name!,
            brand: chosen.brand,
            color: [chosen.color_code ? `#${chosen.color_code}` : null, chosen.color_name].filter(Boolean).join(" ") || null,
            neededQuantity: h.measure === "count" ? base - free : null,
            unitLabel: h.measure === "count" ? chosen.unit_label : fromBase(base - free, h.measure as Measure, h.entry_unit),
            projectId,
            itemId: chosen.id,
            notes: `Short for ${projectName}`,
          });
        }
      }
      onClose();
      router.refresh();
    });

  return (
    <Sheet
      open
      onClose={onClose}
      title={requirement ? `For: ${requirement.description}` : "Add from your stash"}
      footer={
        chosen ? (
          <div className="space-y-2">
            {chosen.kind === "material" && h && base > free && (
              <p className="text-sm text-[#5c4000]">
                Only {fromBase(free, h.measure as Measure, h.entry_unit, chosen.unit_label ?? "unit")} is free — that will be reserved and the rest added to your shopping list.
              </p>
            )}
            <button type="button" className="btn btn-ink w-full" disabled={pending || (chosen.kind === "material" && !holdingId)} onClick={add} data-testid="confirm-pick">
              {pending ? "Adding…" : chosen.kind === "tool" ? "Use this tool" : base ? "Add & reserve" : "Add to project"}
            </button>
          </div>
        ) : undefined
      }
    >
      {!chosen ? (
        <>
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search colour, code, brand…" aria-label="Search stash" autoFocus data-testid="picker-search" />
          <ul className="mt-3 space-y-1.5">
            {list.length === 0 && (
              <li className="text-sm text-muted">
                Nothing matching.{" "}
                <Link href="/stash/new" className="font-semibold text-accent underline">
                  Add a supply
                </Link>
              </li>
            )}
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setChosen(p);
                    const first = p.holdings.find((x) => x.quantity - x.reserved > 0) ?? p.holdings[0];
                    setHoldingId(first?.id ?? "");
                    setUnit(first?.measure === "mass" ? "g" : first?.measure === "length" ? "m" : "unit");
                  }}
                  className="flex w-full items-center gap-3 rounded-tile p-2 text-left hover:bg-selected"
                  data-testid="picker-item"
                >
                  <span className="size-11 shrink-0 overflow-hidden rounded-md">
                    {p.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <SupplyArt family={p.family!} colors={p.color_hexes ?? []} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-strong">{p.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[familyLabel(p.family!), p.brand, p.color_code ? `#${p.color_code}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="space-y-4">
          <button type="button" className="text-sm font-semibold text-accent" onClick={() => setChosen(null)}>
            ← Choose something else
          </button>
          <p className="font-semibold text-strong">{chosen.name}</p>
          {chosen.kind === "material" ? (
            <>
              <label className="block">
                <span className="eyebrow">From</span>
                <select className="field mt-2" value={holdingId} onChange={(e) => setHoldingId(e.target.value)}>
                  {chosen.holdings.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.lot?.dye_lot ? `Lot ${x.lot.dye_lot}: ` : ""}
                      {describeHolding(x, chosen.unit_label ?? "unit")} — {fromBase(x.quantity - x.reserved, x.measure as Measure, x.entry_unit, chosen.unit_label ?? "unit")} free
                      {x.locationName ? ` · ${x.locationName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {h && h.measure !== "piece" && (
                <div>
                  <span className="eyebrow">How much will you use? (optional — reserves it)</span>
                  <div className="mt-2">
                    <AmountField measure={h.measure} value={value} setValue={setValue} unit={unit} setUnit={setUnit} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">Tools are linked to the project and never used up.</p>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-[#a3123f]">
              {error}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
