"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { FOLDER_COLOR_HEX, FOLDER_COLORS, type FolderColor } from "@/lib/library/constants";
import { addToKit, deleteKit, removeFromKit, saveKit } from "@/lib/stash/actions";
import { fromBase, type Measure } from "@/lib/stash/catalog";
import type { Pickable } from "@/lib/stash/data";
import { describeHolding } from "./stock-panel";
import { SupplyArt } from "./supply-art";

type KitItem = { id?: string; kit_id: string; item_id: string; quantity: number | null; holding_id: string | null; card: Pickable[number] | null | Omit<Pickable[number], "holdings"> };
type Kit = { id: string; name: string; color: string | null; notes: string | null; project_id: string | null; location_id: string | null; locationName: string | null; project: { id: string; name: string } | null; items: KitItem[] };
type Opt = { id: string; name: string; parent_id: string | null };

export function KitsView({ kits, pickable, projects, locations }: { kits: Kit[]; pickable: Pickable; projects: { id: string; name: string }[]; locations: Opt[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Kit | "new" | null>(null);
  const [adding, setAdding] = useState<Kit | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body">Project bags and kits — the same supplies, grouped where you keep them. Nothing is duplicated.</p>
        <button type="button" className="btn btn-ink press !min-h-10" onClick={() => setEditing("new")} data-testid="new-kit">
          ＋ New kit
        </button>
      </div>
      {kits.length === 0 ? (
        <p className="mt-6 rounded-card border-2 border-dashed border-line px-5 py-6 text-sm text-body">No kits yet — try a “Blanket project bag” or a “Cross-stitch travel kit”.</p>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2" data-testid="kits">
          {kits.map((k) => {
            const hex = FOLDER_COLOR_HEX[(k.color ?? "ultraviolet") as FolderColor] ?? "#ae8aff";
            return (
              <li key={k.id} id={`kit-${k.id}`} className="card-plain scroll-mt-6 overflow-hidden rounded-card">
                <div className="h-2" style={{ background: hex }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display-tight text-xl text-strong">🧺 {k.name}</h2>
                      <p className="text-sm text-muted">
                        {k.project ? (
                          <>
                            for{" "}
                            <Link href={`/projects/${k.project.id}`} className="text-accent hover:underline">
                              {k.project.name}
                            </Link>
                          </>
                        ) : (
                          "Not tied to a project"
                        )}
                        {k.locationName ? ` · ⌖ ${k.locationName}` : ""}
                      </p>
                    </div>
                    <button type="button" className="text-sm font-semibold text-accent hover:underline" onClick={() => setEditing(k)}>
                      Edit
                    </button>
                  </div>
                  {k.items.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">Empty — add supplies from your stash.</p>
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {k.items.map((it) => (
                        <li key={it.id ?? it.item_id} className="flex items-center gap-3">
                          <span className="size-10 shrink-0 overflow-hidden rounded-md">
                            {it.card?.coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={it.card.coverUrl} alt="" className="size-full object-cover" />
                            ) : (
                              <SupplyArt family={it.card?.family ?? "other"} colors={it.card?.color_hexes ?? []} />
                            )}
                          </span>
                          <Link href={`/stash/${it.item_id}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-strong hover:underline">
                            {it.card?.name ?? "Supply"}
                            {it.card?.color_code && <span className="ml-1 font-mono font-normal text-muted">#{it.card.color_code}</span>}
                          </Link>
                          {it.quantity && <span className="text-xs text-muted">{it.quantity} {it.card?.unit_label ?? ""}</span>}
                          {it.id && (
                            <button type="button" aria-label="Take out of kit" className="grid size-8 place-items-center rounded-full text-muted hover:bg-selected" disabled={pending} onClick={() => start(async () => (await removeFromKit(it.id!), router.refresh()))}>
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button type="button" className="btn btn-secondary press mt-4 !min-h-9 !px-3 !text-xs" onClick={() => setAdding(k)} data-testid="add-to-kit">
                    ＋ Add supply
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <KitSheet kit={editing === "new" ? null : editing} projects={projects} locations={locations} onClose={() => setEditing(null)} />}
      {adding && <AddToKitSheet kit={adding} pickable={pickable} onClose={() => setAdding(null)} />}
    </div>
  );
}

function KitSheet({ kit, projects, locations, onClose }: { kit: Kit | null; projects: { id: string; name: string }[]; locations: Opt[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(kit?.name ?? "");
  const [projectId, setProjectId] = useState(kit?.project_id ?? "");
  const [locationId, setLocationId] = useState(kit?.location_id ?? "");
  const [color, setColor] = useState(kit?.color ?? "pink");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Sheet
      open
      onClose={onClose}
      title={kit ? "Edit kit" : "New kit"}
      footer={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ink flex-1"
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                const r = await saveKit({ id: kit?.id, name, projectId: projectId || null, locationId: locationId || null, color });
                if (!r.ok) return setError(r.error);
                onClose();
                router.refresh();
              })
            }
            data-testid="save-kit"
          >
            Save
          </button>
          {kit && (
            <button type="button" className="min-h-11 px-3 text-sm font-semibold text-[#a3123f]" onClick={() => window.confirm("Delete this kit? The supplies stay in your stash.") && start(async () => (await deleteKit(kit.id), onClose(), router.refresh()))}>
              Delete kit
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="eyebrow">Name</span>
          <input className="field mt-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Blanket project bag" data-testid="kit-name" />
        </label>
        <label className="block">
          <span className="eyebrow">For a project</span>
          <select className="field mt-2" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">Kept in</span>
          <select className="field mt-2" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Not set</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="eyebrow">Colour</legend>
          <div className="mt-2 flex gap-2">
            {FOLDER_COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} className="size-9 rounded-full ring-2 ring-white aria-pressed:ring-midnight" style={{ background: FOLDER_COLOR_HEX[c] }} />
            ))}
          </div>
        </fieldset>
        {error && <p className="text-sm font-semibold text-[#a3123f]">{error}</p>}
      </div>
    </Sheet>
  );
}

function AddToKitSheet({ kit, pickable, onClose }: { kit: Kit; pickable: Pickable; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<Pickable[number] | null>(null);
  const [holdingId, setHoldingId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const list = useMemo(() => pickable.filter((p) => !q || (p.search_text ?? "").includes(q.toLowerCase())).slice(0, 40), [q, pickable]);
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Add to ${kit.name}`}
      footer={
        chosen ? (
          <button
            type="button"
            className="btn btn-ink w-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await addToKit({ kitId: kit.id, itemId: chosen.id!, holdingId: chosen.kind === "material" ? holdingId || null : null, quantity: qty ? Number(qty) : null });
                if (!r.ok) return setError(r.error);
                onClose();
                router.refresh();
              })
            }
            data-testid="confirm-add-to-kit"
          >
            Add
          </button>
        ) : undefined
      }
    >
      {!chosen ? (
        <>
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your stash" aria-label="Search stash" autoFocus />
          <ul className="mt-3 space-y-1">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" className="flex w-full items-center gap-3 rounded-tile p-2 text-left hover:bg-selected" onClick={() => (setChosen(p), setHoldingId(p.holdings[0]?.id ?? ""))} data-testid="kit-pick">
                  <span className="size-10 shrink-0 overflow-hidden rounded-md">
                    <SupplyArt family={p.family!} colors={p.color_hexes ?? []} />
                  </span>
                  <span className="truncate font-semibold text-strong">{p.name}</span>
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
          {chosen.kind === "material" && chosen.holdings.length > 0 && (
            <>
              <label className="block">
                <span className="eyebrow">Which stock</span>
                <select className="field mt-2" value={holdingId} onChange={(e) => setHoldingId(e.target.value)}>
                  {chosen.holdings.map((h) => (
                    <option key={h.id} value={h.id}>
                      {describeHolding(h, chosen.unit_label ?? "unit")} ({fromBase(h.quantity, h.measure as Measure, h.entry_unit, chosen.unit_label ?? "unit")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="eyebrow">How many go in the kit (optional)</span>
                <input className="field mt-2 w-28" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
              </label>
            </>
          )}
          {chosen.kind === "tool" && <p className="text-sm text-muted">The tool is linked — it stays one item in your stash.</p>}
          {error && <p className="text-sm font-semibold text-[#a3123f]">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
