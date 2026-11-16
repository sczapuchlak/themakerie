"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { receiveWant, saveWant, setWantStatus, type WantInput } from "@/lib/stash/actions";
import { FAMILIES, formatMoney, toBase, type EntryUnit } from "@/lib/stash/catalog";

type Want = {
  id: string;
  list: string;
  family: string;
  name: string;
  brand: string | null;
  color: string | null;
  size: string | null;
  needed_quantity: number | null;
  received_quantity: number;
  unit_label: string | null;
  price_cents: number | null;
  currency: string | null;
  merchant: string | null;
  url: string | null;
  priority: number;
  project_id: string | null;
  item_id: string | null;
  status: string;
  notes: string | null;
  project: { id: string; name: string } | null;
};
type Opt = { id: string; name: string; parent_id: string | null };

const PRIORITY = { 1: "Soon", 2: "Normal", 3: "Someday" } as const;

export function ShoppingList({ list, wants, projects, locations }: { list: "shopping" | "wishlist"; wants: Want[]; projects: { id: string; name: string }[]; locations: Opt[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Want | "new" | null>(null);
  const [receiving, setReceiving] = useState<Want | null>(null);
  const [pending, start] = useTransition();
  const open = wants.filter((w) => w.list === list && w.status !== "received");
  const done = wants.filter((w) => w.list === list && w.status === "received");
  const total = open.reduce((n, w) => n + (w.price_cents ?? 0) * Math.max(1, (w.needed_quantity ?? 1) - w.received_quantity), 0);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full bg-white p-1 ring-1 ring-line">
          <Link href="/stash/shopping" className="min-h-9 content-center rounded-full px-4 text-sm font-semibold aria-[current=page]:bg-midnight aria-[current=page]:text-white" aria-current={list === "shopping" ? "page" : undefined}>
            Shopping list
          </Link>
          <Link href="/stash/shopping?list=wishlist" className="min-h-9 content-center rounded-full px-4 text-sm font-semibold aria-[current=page]:bg-midnight aria-[current=page]:text-white" aria-current={list === "wishlist" ? "page" : undefined}>
            Wishlist
          </Link>
        </div>
        <p className="text-sm text-muted">{list === "shopping" ? "Supplies you need for a make." : "Things you might buy someday."}</p>
        <button type="button" className="btn btn-ink press ml-auto !min-h-10" onClick={() => setEditing("new")} data-testid="add-want">
          ＋ Add
        </button>
      </div>

      {open.length === 0 ? (
        <p className="mt-6 rounded-card border-2 border-dashed border-line px-5 py-6 text-sm text-body">
          {list === "shopping" ? "Nothing to buy. Missing materials from a project land here automatically when you reserve more than you have." : "Your wishlist is empty — add yarn you're dreaming about."}
        </p>
      ) : (
        <ul className="mt-5 space-y-2" data-testid="want-list">
          {open.map((w) => (
            <li key={w.id} className="card-plain flex flex-wrap items-center gap-3 rounded-card p-4">
              <span className={`size-2.5 shrink-0 rounded-full ${w.priority === 1 ? "bg-pink" : w.priority === 2 ? "bg-cobalt" : "bg-line-strong"}`} title={PRIORITY[w.priority as 1 | 2 | 3]} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-strong">
                  {w.name}
                  {w.status === "partial" && <span className="ml-2 rounded-full bg-[#fff1c9] px-2 py-0.5 text-xs font-semibold text-[#5c4000]">part received</span>}
                </p>
                <p className="text-sm text-muted">
                  {[w.brand, w.color, w.size, w.needed_quantity ? `${w.needed_quantity - w.received_quantity} ${w.unit_label ?? ""} still needed`.trim() : w.unit_label, w.merchant].filter(Boolean).join(" · ")}
                  {w.project && (
                    <>
                      {" · for "}
                      <Link href={`/projects/${w.project.id}`} className="text-accent hover:underline">
                        {w.project.name}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              {w.price_cents != null && <span className="font-mono text-sm text-strong">{formatMoney(w.price_cents, w.currency ?? "USD")}</span>}
              {w.url && (
                <a href={w.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent hover:underline">
                  Shop ↗
                </a>
              )}
              <div className="flex gap-1.5">
                <button type="button" className="btn btn-primary press !min-h-9 !px-3 !text-xs" onClick={() => setReceiving(w)} data-testid="receive">
                  Got it
                </button>
                <button type="button" className="btn btn-secondary press !min-h-9 !px-3 !text-xs" onClick={() => setEditing(w)}>
                  Edit
                </button>
                <button type="button" aria-label={`Remove ${w.name}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-selected" disabled={pending} onClick={() => start(async () => (await setWantStatus(w.id, "dropped"), router.refresh()))}>
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > 0 && <p className="mt-3 text-right text-sm text-muted">Estimated from prices you entered: {formatMoney(total)}</p>}

      {done.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-muted">Received ({done.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {done.map((w) => (
              <li key={w.id} className="text-muted">
                ✓ {w.name}{" "}
                {w.item_id && (
                  <Link href={`/stash/${w.item_id}`} className="text-accent hover:underline">
                    in stash
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {editing && <WantSheet list={list} want={editing === "new" ? null : editing} projects={projects} onClose={() => setEditing(null)} />}
      {receiving && <ReceiveSheet want={receiving} locations={locations} onClose={() => setReceiving(null)} />}
    </div>
  );
}

function WantSheet({ list, want, projects, onClose }: { list: "shopping" | "wishlist"; want: Want | null; projects: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<WantInput>({
    id: want?.id,
    list: (want?.list as "shopping" | "wishlist") ?? list,
    family: want?.family ?? "yarn",
    name: want?.name ?? "",
    brand: want?.brand ?? "",
    color: want?.color ?? "",
    size: want?.size ?? "",
    neededQuantity: want?.needed_quantity ?? null,
    unitLabel: want?.unit_label ?? "skein",
    priceCents: want?.price_cents ?? null,
    merchant: want?.merchant ?? "",
    url: want?.url ?? "",
    priority: want?.priority ?? 2,
    projectId: want?.project_id ?? null,
    notes: want?.notes ?? "",
  });
  const [price, setPrice] = useState(want?.price_cents != null ? String(want.price_cents / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<WantInput>) => setF((p) => ({ ...p, ...patch }));
  return (
    <Sheet
      open
      onClose={onClose}
      title={want ? "Edit" : f.list === "wishlist" ? "Add to wishlist" : "Add to shopping list"}
      footer={
        <button
          type="button"
          className="btn btn-ink w-full"
          disabled={pending || !f.name.trim()}
          onClick={() =>
            start(async () => {
              const r = await saveWant({ ...f, priceCents: price ? Math.round(Number(price) * 100) : null });
              if (!r.ok) return setError(r.error);
              onClose();
              router.refresh();
            })
          }
          data-testid="save-want"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          {(["shopping", "wishlist"] as const).map((l) => (
            <button key={l} type="button" className="chip !min-h-9" aria-pressed={f.list === l} onClick={() => set({ list: l })}>
              {l === "shopping" ? "Shopping list" : "Wishlist"}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="eyebrow">What</span>
          <input className="field mt-2" value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={200} placeholder="Stylecraft Special DK" data-testid="want-name" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="eyebrow">Kind</span>
            <select className="field mt-2" value={f.family} onChange={(e) => set({ family: e.target.value })}>
              {FAMILIES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow">Brand</span>
            <input className="field mt-2" value={f.brand ?? ""} onChange={(e) => set({ brand: e.target.value })} maxLength={120} />
          </label>
          <label className="block">
            <span className="eyebrow">Colour</span>
            <input className="field mt-2" value={f.color ?? ""} onChange={(e) => set({ color: e.target.value })} maxLength={120} placeholder="1034 Sherbet" />
          </label>
          <label className="block">
            <span className="eyebrow">Size</span>
            <input className="field mt-2" value={f.size ?? ""} onChange={(e) => set({ size: e.target.value })} maxLength={80} placeholder="4.5 mm" />
          </label>
          <label className="block">
            <span className="eyebrow">How many</span>
            <input className="field mt-2" inputMode="numeric" value={f.neededQuantity ?? ""} onChange={(e) => set({ neededQuantity: e.target.value ? Number(e.target.value) : null })} data-testid="want-qty" />
          </label>
          <label className="block">
            <span className="eyebrow">Of what</span>
            <input className="field mt-2" value={f.unitLabel ?? ""} onChange={(e) => set({ unitLabel: e.target.value })} maxLength={30} placeholder="skeins" />
          </label>
          <label className="block">
            <span className="eyebrow">Price each (optional)</span>
            <input className="field mt-2" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4.50" />
          </label>
          <label className="block">
            <span className="eyebrow">Priority</span>
            <select className="field mt-2" value={f.priority} onChange={(e) => set({ priority: Number(e.target.value) })}>
              <option value={1}>Soon</option>
              <option value={2}>Normal</option>
              <option value={3}>Someday</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="eyebrow">Shop / link</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input className="field" value={f.merchant ?? ""} onChange={(e) => set({ merchant: e.target.value })} maxLength={120} placeholder="Local yarn shop" aria-label="Merchant" />
            <input className="field" value={f.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" inputMode="url" aria-label="Link" />
          </div>
        </label>
        <label className="block">
          <span className="eyebrow">For a project (optional)</span>
          <select className="field mt-2" value={f.projectId ?? ""} onChange={(e) => set({ projectId: e.target.value || null })}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {error && <p className="text-sm font-semibold text-[#a3123f]">{error}</p>}
      </div>
    </Sheet>
  );
}

function ReceiveSheet({ want, locations, onClose }: { want: Want; locations: Opt[]; onClose: () => void }) {
  const router = useRouter();
  const [lotId] = useState(() => crypto.randomUUID());
  const remaining = want.needed_quantity ? want.needed_quantity - want.received_quantity : 1;
  const [qty, setQty] = useState(String(Math.max(1, remaining)));
  const [unit, setUnit] = useState<EntryUnit>("unit");
  const [locationId, setLocationId] = useState("");
  const [dyeLot, setDyeLot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const base = Number(qty) > 0 ? toBase(Number(qty), unit) : null;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Add to your stash"
      footer={
        <button
          type="button"
          className="btn btn-ink w-full"
          disabled={pending || !base}
          onClick={() =>
            start(async () => {
              const r = await receiveWant({ wantId: want.id, lotId, quantity: base!.quantity, measure: base!.measure, entryUnit: unit, locationId: locationId || null, dyeLot: dyeLot || null });
              if (!r.ok) return setError(r.error);
              onClose();
              router.push(`/stash/${r.itemId}`);
            })
          }
          data-testid="confirm-receive"
        >
          {pending ? "Adding…" : "Add to stash"}
        </button>
      }
    >
      <p className="font-semibold text-strong">{want.name}</p>
      <p className="text-sm text-muted">{want.item_id ? "Adds a new batch to the supply you already have." : "Creates a new supply from this list item — you can add details later."}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input className="field w-24" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="How much arrived" data-testid="receive-qty" />
        {(["unit", "g", "m", "yd"] as const).map((u) => (
          <button key={u} type="button" className="chip !min-h-9" aria-pressed={unit === u} onClick={() => setUnit(u)}>
            {u === "unit" ? want.unit_label ?? "units" : u}
          </button>
        ))}
      </div>
      {want.needed_quantity && <p className="mt-1 text-xs text-muted">{remaining} still needed — anything less keeps the rest on your list.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(want.family === "yarn" || want.family === "thread") && (
          <label className="block">
            <span className="eyebrow">Dye lot</span>
            <input className="field mt-2 font-mono" value={dyeLot} onChange={(e) => setDyeLot(e.target.value)} maxLength={60} />
          </label>
        )}
        <label className="block">
          <span className="eyebrow">Where it goes</span>
          <select className="field mt-2" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Not set</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-[#a3123f]">{error}</p>}
    </Sheet>
  );
}
