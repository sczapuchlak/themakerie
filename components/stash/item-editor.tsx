"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { uploadFile } from "@/lib/library/client-files";
import { IMAGE_TYPES, validateUpload } from "@/lib/library/constants";
import { addCategory, findSimilarItems, saveItem, saveLocation, type HoldingInput } from "@/lib/stash/actions";
import { CATEGORIES, FAMILIES, SPEC_FIELDS, toBase, UNIT_LABELS, type Family } from "@/lib/stash/catalog";
import { SupplyArt } from "./supply-art";

type Opt = { id: string; name: string; parent_id: string | null };
export type EditorOptions = {
  locations: Opt[];
  collections: Opt[];
  categories: { family: string; name: string }[];
};
export type ItemEditorInitial = {
  id: string;
  isNew: boolean;
  family: Family | null;
  category: string;
  name: string;
  brand: string;
  productLine: string;
  colorCode: string;
  colorName: string;
  colorHexes: string[];
  specs: Record<string, string>;
  unitLabel: string;
  unitMass: string;
  unitMassUnit: "g" | "oz";
  unitLength: string;
  unitLengthUnit: "m" | "yd";
  lowStock: string;
  collectionId: string;
  tags: string;
  favorite: boolean;
  notes: string;
  photos: { id: string; url: string | null }[];
};

type PartialRow = { key: string; known: boolean; amount: string; unit: "g" | "oz" | "m" | "yd" };
type PieceRow = { key: string; w: string; h: string; label: string };

const key = () => Math.random().toString(36).slice(2, 9);
const pathOf = (rows: Opt[], id: string) => {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const parts: string[] = [];
  let cur = byId.get(id);
  for (let i = 0; cur && i < 20; i++) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return parts.join(" › ");
};

export function ItemEditor({ initial, options }: { initial: ItemEditorInitial; options: EditorOptions }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dupes, setDupes] = useState<{ id: string; name: string; brand: string | null; color_code: string | null }[]>([]);
  const [newPhotos, setNewPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [locations, setLocations] = useState(options.locations);
  const [customCats, setCustomCats] = useState(options.categories);

  // Stock (new items only)
  const [fullCount, setFullCount] = useState("1");
  const [partials, setPartials] = useState<PartialRow[]>([]);
  const [totalOnly, setTotalOnly] = useState<{ amount: string; unit: "g" | "oz" | "m" | "yd" } | null>(null);
  const [pieces, setPieces] = useState<PieceRow[]>([{ key: key(), w: "", h: "", label: "" }]);
  const [pieceUnit, setPieceUnit] = useState<"cm" | "in">("cm");
  const [dyeLot, setDyeLot] = useState("");
  const [locationId, setLocationId] = useState("");
  const [purchasedOn, setPurchasedOn] = useState("");
  const [source, setSource] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof ItemEditorInitial>(k: K, v: ItemEditorInitial[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };
  const family = f.family;

  /* ---------- 1. choose a kind ---------- */
  if (!family) {
    return (
      <div className="mt-6">
        <p className="text-body">What are you adding?</p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FAMILIES.map((fam) => (
            <li key={fam.value}>
              <button
                type="button"
                onClick={() => setF((p) => ({ ...p, family: fam.value, category: CATEGORIES[fam.value][0], unitLabel: UNIT_LABELS[fam.value][0] }))}
                className="card-plain lift press block w-full overflow-hidden rounded-card text-left"
                data-testid={`family-${fam.value}`}
              >
                <span className="block aspect-[16/10]">
                  <SupplyArt family={fam.value} colors={fam.value === "fabric" ? ["#efe7d7"] : ["#f477d3", "#ae8aff", "#48d7f5"]} />
                </span>
                <span className="block p-3">
                  <span className="block font-semibold text-strong">{fam.label}</span>
                  <span className="block text-xs text-muted">{fam.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const fields = SPEC_FIELDS[family];
  const essentials = fields.filter((x) => !x.advanced);
  const advanced = fields.filter((x) => x.advanced);
  const categories = [...CATEGORIES[family], ...customCats.filter((c) => c.family === family).map((c) => c.name)];
  const hasColorCode = family === "yarn" || family === "thread";
  const isTool = family === "tool";
  const isFabric = family === "fabric";

  const checkDupes = async () => {
    if (!f.name.trim() && !f.colorCode.trim()) return;
    const found = await findSimilarItems({ excludeId: f.id, name: f.name, brand: f.brand, colorCode: f.colorCode, colorName: f.colorName });
    setDupes(found);
  };

  const holdingsForSave = (): HoldingInput[] => {
    if (isFabric) {
      const k = pieceUnit === "in" ? 25.4 : 10;
      return pieces
        .filter((p) => p.w || p.h || p.label)
        .map((p) => ({
          measure: "piece",
          quantity: 1,
          condition: "full",
          amountKnown: true,
          entryUnit: pieceUnit,
          widthMm: p.w ? Math.round(Number(p.w) * k) : null,
          heightMm: p.h ? Math.round(Number(p.h) * k) : null,
          label: p.label || null,
        }));
    }
    const out: HoldingInput[] = [];
    if (totalOnly && Number(totalOnly.amount) > 0) {
      const b = toBase(Number(totalOnly.amount), totalOnly.unit);
      out.push({ measure: b.measure, quantity: b.quantity, condition: "full", amountKnown: true, entryUnit: totalOnly.unit });
    } else {
      const n = Math.max(0, Number.parseInt(fullCount, 10) || 0);
      if (n) out.push({ measure: "count", quantity: n, condition: "full", amountKnown: true, entryUnit: "unit" });
    }
    for (const p of partials) {
      if (p.known && Number(p.amount) > 0) {
        const b = toBase(Number(p.amount), p.unit);
        out.push({ measure: b.measure, quantity: b.quantity, condition: "partial", amountKnown: true, entryUnit: p.unit });
      } else if (!p.known) {
        out.push({ measure: "count", quantity: 1, condition: "partial", amountKnown: false, entryUnit: "unit" });
      }
    }
    return out;
  };

  const save = async () => {
    setError(null);
    if (!f.name.trim()) return setError("Give it a name.");
    setSaving(true);
    try {
      const uploaded: { path: string; fileName: string; mimeType: string; size: number }[] = [];
      for (const p of newPhotos) {
        const path = await uploadFile(p.file, { scope: "stash", parentId: f.id, kind: "image", fileName: p.file.name });
        uploaded.push({ path, fileName: p.file.name, mimeType: p.file.type, size: p.file.size });
      }
      const mass = Number(f.unitMass);
      const length = Number(f.unitLength);
      const r = await saveItem({
        id: f.id,
        isNew: f.isNew,
        family,
        category: f.category,
        name: f.name,
        brand: f.brand,
        productLine: f.productLine,
        colorCode: f.colorCode,
        colorName: f.colorName,
        colorHexes: f.colorHexes,
        specs: f.specs,
        unitLabel: f.unitLabel,
        unitMassDg: mass > 0 ? toBase(mass, f.unitMassUnit).quantity : null,
        unitLengthCm: length > 0 ? toBase(length, f.unitLengthUnit).quantity : null,
        lowStockThreshold: f.lowStock ? Number(f.lowStock) : null,
        collectionId: f.collectionId || null,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
        favorite: f.favorite,
        notes: f.notes,
        photos: uploaded,
        removedPhotoIds: removedPhotos,
        lot: f.isNew
          ? {
              dyeLot: dyeLot || null,
              locationId: locationId || null,
              purchasedOn: purchasedOn || null,
              source: source || null,
              priceCents: price ? Math.round(Number(price) * 100) : null,
              holdings: holdingsForSave(),
            }
          : null,
      });
      if (!r.ok) {
        setError(r.error);
        setSaving(false);
        return;
      }
      setDirty(false);
      router.push(`/stash/${f.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      setSaving(false);
    }
  };

  const fam = FAMILIES.find((x) => x.value === family)!;

  return (
    <form
      className="mt-6 grid items-start gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_18rem]"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="min-w-0 space-y-6">
        {/* Essentials */}
        <section className="card-plain space-y-4 rounded-card p-5" aria-labelledby="essentials">
          <div className="flex items-center justify-between gap-3">
            <h2 id="essentials" className="font-semibold text-strong">
              {fam.label}
            </h2>
            {f.isNew && (
              <button type="button" className="text-sm font-semibold text-accent hover:underline" onClick={() => setF((p) => ({ ...p, family: null }))}>
                Change kind
              </button>
            )}
          </div>
          <label className="block">
            <span className="eyebrow">Name *</span>
            <input
              className="field mt-2"
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              onBlur={() => void checkDupes()}
              maxLength={200}
              required
              placeholder={isTool ? "4.0 mm circular needle" : family === "thread" ? "Cornflower blue" : family === "fabric" ? "14 ct Aida, antique white" : "Special DK"}
              data-testid="item-name"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">Category</span>
              <select
                className="field mt-2"
                value={f.category}
                onChange={async (e) => {
                  if (e.target.value === "__new") {
                    const name = window.prompt("New category name");
                    if (name?.trim()) {
                      await addCategory(family, name.trim());
                      setCustomCats((c) => [...c, { family, name: name.trim() }]);
                      set("category", name.trim());
                    }
                    return;
                  }
                  set("category", e.target.value);
                }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__new">＋ New category…</option>
              </select>
            </label>
            <label className="block">
              <span className="eyebrow">Brand</span>
              <input className="field mt-2" value={f.brand} onChange={(e) => set("brand", e.target.value)} onBlur={() => void checkDupes()} maxLength={120} placeholder={family === "thread" ? "DMC" : "Stylecraft"} />
            </label>
          </div>

          {!isTool && (
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <label className="block">
                <span className="eyebrow">Colour name</span>
                <input className="field mt-2" value={f.colorName} onChange={(e) => set("colorName", e.target.value)} maxLength={120} placeholder="Sherbet" />
              </label>
              {hasColorCode && (
                <label className="block">
                  <span className="eyebrow">Colour code</span>
                  <input
                    className="field mt-2 font-mono"
                    value={f.colorCode}
                    onChange={(e) => set("colorCode", e.target.value)}
                    onBlur={() => void checkDupes()}
                    maxLength={40}
                    placeholder="0310"
                    inputMode="text"
                    autoCapitalize="characters"
                    data-testid="item-code"
                  />
                </label>
              )}
            </div>
          )}

          {!isTool && (
            <div>
              <span className="eyebrow">Swatch{family === "yarn" ? "es (add several for variegated)" : ""}</span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {f.colorHexes.map((h, i) => (
                  <span key={`${h}${i}`} className="flex items-center gap-1 rounded-full bg-selected py-1 pr-2 pl-1">
                    <input
                      type="color"
                      value={h}
                      aria-label={`Swatch ${i + 1}`}
                      onChange={(e) => set("colorHexes", f.colorHexes.map((x, j) => (j === i ? e.target.value : x)))}
                      className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    />
                    <button type="button" aria-label="Remove swatch" className="text-muted" onClick={() => set("colorHexes", f.colorHexes.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </span>
                ))}
                {f.colorHexes.length < 8 && (
                  <button type="button" className="chip !min-h-10" onClick={() => set("colorHexes", [...f.colorHexes, f.colorHexes.at(-1) ?? "#ae8aff"])} data-testid="add-swatch">
                    ＋ Swatch
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">Your swatch is a browsing aid; the manufacturer&rsquo;s code stays the true identifier.</p>
            </div>
          )}

          {essentials.map((sf) => (
            <label key={sf.key} className="block">
              <span className="eyebrow">{sf.label}</span>
              {sf.options ? (
                <select className="field mt-2" value={f.specs[sf.key] ?? ""} onChange={(e) => set("specs", { ...f.specs, [sf.key]: e.target.value })}>
                  <option value="">—</option>
                  {sf.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input className="field mt-2" value={f.specs[sf.key] ?? ""} onChange={(e) => set("specs", { ...f.specs, [sf.key]: e.target.value })} placeholder={sf.placeholder} maxLength={200} data-testid={`spec-${sf.key}`} />
              )}
            </label>
          ))}

          {dupes.length > 0 && (
            <div role="status" className="rounded-tile bg-[#fff6dc] px-4 py-3 text-sm text-[#5c4000]">
              <p className="font-semibold">You may already have this:</p>
              <ul className="mt-1 list-disc pl-5">
                {dupes.map((d) => (
                  <li key={d.id}>
                    <Link href={`/stash/${d.id}`} target="_blank" className="font-semibold underline">
                      {d.name}
                      {d.color_code ? ` #${d.color_code}` : ""}
                    </Link>
                    {d.brand ? ` · ${d.brand}` : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-1">A different dye lot of the same colour? Add it as a new batch on the existing item instead.</p>
            </div>
          )}
        </section>

        {/* Stock — new items only */}
        {f.isNew && (
          <section className="card-plain space-y-4 rounded-card p-5" aria-labelledby="stock">
            <h2 id="stock" className="font-semibold text-strong">
              {isTool ? "How many do you own?" : isFabric ? "Pieces you have" : "How much do you have?"}
            </h2>
            {isFabric ? (
              <>
                <div className="flex gap-2">
                  {(["cm", "in"] as const).map((u) => (
                    <button key={u} type="button" className="chip !min-h-9" aria-pressed={pieceUnit === u} onClick={() => setPieceUnit(u)}>
                      {u}
                    </button>
                  ))}
                </div>
                <ul className="space-y-2">
                  {pieces.map((p, i) => (
                    <li key={p.key} className="flex flex-wrap items-center gap-2">
                      <input className="field w-24" inputMode="decimal" placeholder="Width" aria-label={`Piece ${i + 1} width`} value={p.w} onChange={(e) => setPieces(pieces.map((x) => (x.key === p.key ? { ...x, w: e.target.value } : x)))} />
                      <span aria-hidden="true">×</span>
                      <input className="field w-24" inputMode="decimal" placeholder="Height" aria-label={`Piece ${i + 1} height`} value={p.h} onChange={(e) => setPieces(pieces.map((x) => (x.key === p.key ? { ...x, h: e.target.value } : x)))} />
                      <span className="text-sm text-muted">{pieceUnit}</span>
                      <input className="field min-w-0 flex-1 basis-32" placeholder="Label (optional)" value={p.label} onChange={(e) => setPieces(pieces.map((x) => (x.key === p.key ? { ...x, label: e.target.value } : x)))} />
                      {pieces.length > 1 && (
                        <button type="button" aria-label="Remove piece" className="grid size-10 place-items-center rounded-full text-muted hover:bg-selected" onClick={() => setPieces(pieces.filter((x) => x.key !== p.key))}>
                          ×
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <button type="button" className="chip" onClick={() => setPieces([...pieces, { key: key(), w: "", h: "", label: "" }])}>
                  ＋ Another piece or offcut
                </button>
              </>
            ) : totalOnly ? (
              <div className="flex flex-wrap items-center gap-2">
                <input className="field w-32" inputMode="decimal" value={totalOnly.amount} onChange={(e) => setTotalOnly({ ...totalOnly, amount: e.target.value })} aria-label="Total amount" data-testid="total-amount" />
                {(["g", "oz", "m", "yd"] as const).map((u) => (
                  <button key={u} type="button" className="chip !min-h-9" aria-pressed={totalOnly.unit === u} onClick={() => setTotalOnly({ ...totalOnly, unit: u })}>
                    {u}
                  </button>
                ))}
                <button type="button" className="ml-auto text-sm font-semibold text-accent" onClick={() => setTotalOnly(null)}>
                  Count {f.unitLabel}s instead
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input className="field w-24" inputMode="numeric" value={fullCount} onChange={(e) => setFullCount(e.target.value)} aria-label="How many" data-testid="full-count" />
                <select className="field !w-auto" value={f.unitLabel} onChange={(e) => set("unitLabel", e.target.value)} aria-label="Unit">
                  {UNIT_LABELS[family].map((u) => (
                    <option key={u} value={u}>
                      {isTool ? u : `full ${u}${u.endsWith("s") ? "" : "s"}`}
                    </option>
                  ))}
                </select>
                {!isTool && (
                  <button type="button" className="ml-auto text-sm font-semibold text-accent" onClick={() => setTotalOnly({ amount: "", unit: family === "yarn" ? "yd" : "m" })} data-testid="total-only">
                    I only know the total length/weight
                  </button>
                )}
              </div>
            )}

            {!isTool && !isFabric && (
              <div className="space-y-2">
                {partials.map((p, i) => (
                  <div key={p.key} className="flex flex-wrap items-center gap-2 rounded-tile bg-selected p-2">
                    <span className="text-sm font-semibold text-strong">Partial {i + 1}:</span>
                    <label className="flex min-h-9 items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-[#081638]" checked={!p.known} onChange={(e) => setPartials(partials.map((x) => (x.key === p.key ? { ...x, known: !e.target.checked } : x)))} />
                      amount unknown
                    </label>
                    {p.known && (
                      <>
                        <input className="field w-24 !min-h-9" inputMode="decimal" value={p.amount} onChange={(e) => setPartials(partials.map((x) => (x.key === p.key ? { ...x, amount: e.target.value } : x)))} aria-label={`Partial ${i + 1} amount`} data-testid={`partial-${i}`} />
                        <select className="field !min-h-9 !w-auto" value={p.unit} onChange={(e) => setPartials(partials.map((x) => (x.key === p.key ? { ...x, unit: e.target.value as PartialRow["unit"] } : x)))} aria-label="Unit">
                          {(["g", "oz", "m", "yd"] as const).map((u) => (
                            <option key={u}>{u}</option>
                          ))}
                        </select>
                      </>
                    )}
                    <button type="button" aria-label="Remove partial" className="ml-auto grid size-9 place-items-center rounded-full text-muted hover:bg-white" onClick={() => setPartials(partials.filter((x) => x.key !== p.key))}>
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="chip" onClick={() => setPartials([...partials, { key: key(), known: true, amount: "", unit: "g" }])} data-testid="add-partial">
                  ＋ A partly used {f.unitLabel}
                </button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {(family === "yarn" || family === "thread") && (
                <label className="block">
                  <span className="eyebrow">Dye lot / batch</span>
                  <input className="field mt-2 font-mono" value={dyeLot} onChange={(e) => setDyeLot(e.target.value)} maxLength={60} placeholder="A123" data-testid="dye-lot" />
                </label>
              )}
              <label className="block">
                <span className="eyebrow">Where it lives</span>
                <select
                  className="field mt-2"
                  value={locationId}
                  onChange={async (e) => {
                    if (e.target.value === "__new") {
                      const name = window.prompt("Name this place (e.g. Closet, top shelf)");
                      if (name?.trim()) {
                        const r = await saveLocation({ name: name.trim() });
                        if (r.ok) {
                          setLocations((l) => [...l, { id: r.id, name: name.trim(), parent_id: null }]);
                          setLocationId(r.id);
                        }
                      }
                      return;
                    }
                    setLocationId(e.target.value);
                  }}
                  data-testid="location-select"
                >
                  <option value="">Not set</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {pathOf(locations, l.id)}
                    </option>
                  ))}
                  <option value="__new">＋ New place…</option>
                </select>
              </label>
            </div>
          </section>
        )}

        {/* More details */}
        <section className="card-plain rounded-card p-5">
          <button type="button" className="flex w-full items-center justify-between text-left font-semibold text-strong" aria-expanded={more} onClick={() => setMore(!more)}>
            More details <span aria-hidden="true">{more ? "−" : "＋"}</span>
          </button>
          {more && (
            <div className="mt-4 space-y-4">
              {(family === "yarn" || family === "thread") && (
                <div>
                  <span className="eyebrow">Each {f.unitLabel} is</span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input className="field w-24" inputMode="decimal" value={f.unitMass} onChange={(e) => set("unitMass", e.target.value)} aria-label="Weight per unit" placeholder="100" />
                    <select className="field !w-auto" value={f.unitMassUnit} onChange={(e) => set("unitMassUnit", e.target.value as "g" | "oz")} aria-label="Weight unit">
                      <option>g</option>
                      <option>oz</option>
                    </select>
                    <span className="text-muted">and</span>
                    <input className="field w-24" inputMode="decimal" value={f.unitLength} onChange={(e) => set("unitLength", e.target.value)} aria-label="Length per unit" placeholder="295" data-testid="unit-length" />
                    <select className="field !w-auto" value={f.unitLengthUnit} onChange={(e) => set("unitLengthUnit", e.target.value as "m" | "yd")} aria-label="Length unit">
                      <option>m</option>
                      <option>yd</option>
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-muted">Used for totals only — partial and unknown amounts are never guessed.</p>
                </div>
              )}
              <label className="block">
                <span className="eyebrow">Product line</span>
                <input className="field mt-2" value={f.productLine} onChange={(e) => set("productLine", e.target.value)} maxLength={120} />
              </label>
              {advanced.map((sf) => (
                <label key={sf.key} className="block">
                  <span className="eyebrow">{sf.label}</span>
                  <input className="field mt-2" value={f.specs[sf.key] ?? ""} onChange={(e) => set("specs", { ...f.specs, [sf.key]: e.target.value })} placeholder={sf.placeholder} maxLength={200} />
                </label>
              ))}
              {f.isNew && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="eyebrow">Bought on</span>
                    <input type="date" className="field mt-2" value={purchasedOn} onChange={(e) => setPurchasedOn(e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="eyebrow">From</span>
                    <input className="field mt-2" value={source} onChange={(e) => setSource(e.target.value)} maxLength={200} placeholder="Local yarn shop" />
                  </label>
                  <label className="block">
                    <span className="eyebrow">Price paid (optional)</span>
                    <input className="field mt-2" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="12.50" />
                  </label>
                </div>
              )}
              {!isTool && (
                <label className="block">
                  <span className="eyebrow">Warn me when available falls to</span>
                  <input className="field mt-2 w-32" inputMode="numeric" value={f.lowStock} onChange={(e) => set("lowStock", e.target.value)} placeholder="1" />
                </label>
              )}
              <label className="block">
                <span className="eyebrow">Tags</span>
                <input className="field mt-2" value={f.tags} onChange={(e) => set("tags", e.target.value)} placeholder="gift, cozy, destash" />
              </label>
              <label className="block">
                <span className="eyebrow">Notes</span>
                <textarea className="field mt-2 min-h-24" value={f.notes} onChange={(e) => set("notes", e.target.value)} maxLength={10000} />
              </label>
            </div>
          )}
        </section>
      </div>

      {/* Photo & organisation */}
      <aside className="space-y-4">
        <section className="card-plain rounded-card p-4">
          <div className="aspect-[4/5] overflow-hidden rounded-tile">
            {newPhotos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={newPhotos[0].preview} alt="" className="size-full object-cover" />
            ) : f.photos.filter((p) => !removedPhotos.includes(p.id))[0]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.photos.filter((p) => !removedPhotos.includes(p.id))[0].url!} alt="" className="size-full object-cover" />
            ) : (
              <SupplyArt family={family} colors={f.colorHexes} />
            )}
          </div>
          <label className="btn btn-secondary press mt-3 w-full cursor-pointer">
            📷 {newPhotos.length || f.photos.length ? "Add photos" : "Photo"}
            <input
              type="file"
              accept={IMAGE_TYPES.join(",")}
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                const ok = files.filter((file) => {
                  const p = validateUpload("image", file.type, file.size);
                  if (p) setError(`${file.name}: ${p}`);
                  return !p;
                });
                setNewPhotos([...newPhotos, ...ok.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
                setDirty(true);
                e.target.value = "";
              }}
              data-testid="item-photo-input"
            />
          </label>
          {(f.photos.length > 0 || newPhotos.length > 0) && (
            <ul className="mt-3 grid grid-cols-4 gap-1.5">
              {f.photos
                .filter((p) => !removedPhotos.includes(p.id))
                .map((p) => (
                  <li key={p.id} className="relative aspect-square overflow-hidden rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.url && <img src={p.url} alt="" className="size-full object-cover" />}
                    <button type="button" aria-label="Remove photo" className="absolute top-0.5 right-0.5 grid size-6 place-items-center rounded-full bg-white/90 text-xs" onClick={() => (setRemovedPhotos([...removedPhotos, p.id]), setDirty(true))}>
                      ×
                    </button>
                  </li>
                ))}
              {newPhotos.map((p, i) => (
                <li key={p.preview} className="relative aspect-square overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className="size-full object-cover" />
                  <button type="button" aria-label="Remove photo" className="absolute top-0.5 right-0.5 grid size-6 place-items-center rounded-full bg-white/90 text-xs" onClick={() => setNewPhotos(newPhotos.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card-plain space-y-3 rounded-card p-4">
          {options.collections.length > 0 && (
            <label className="block">
              <span className="eyebrow">Collection</span>
              <select className="field mt-2" value={f.collectionId} onChange={(e) => set("collectionId", e.target.value)}>
                <option value="">None</option>
                {options.collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {pathOf(options.collections, c.id)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5 accent-[#081638]" checked={f.favorite} onChange={(e) => set("favorite", e.target.checked)} />
            <span className="font-semibold text-strong">★ Favourite</span>
          </label>
        </section>
      </aside>

      <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-height)+env(safe-area-inset-bottom))] z-30 border-t border-line bg-paper/95 px-[max(var(--gutter),env(safe-area-inset-left))] py-3 backdrop-blur md:bottom-0 md:left-(--sidebar-w)">
        <div className="mx-auto flex max-w-[80rem] flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-ink press" disabled={saving} data-testid="save-item">
            {saving ? "Saving…" : f.isNew ? "Add to stash" : "Save changes"}
          </button>
          <button type="button" className="btn btn-secondary press" onClick={() => (!dirty || window.confirm("Discard your changes?")) && router.back()}>
            Cancel
          </button>
          {error && (
            <p role="alert" className="text-sm font-semibold text-[#a3123f]">
              {error}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
