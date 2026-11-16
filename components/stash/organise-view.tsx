"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCollection, deleteLocation, saveCollection, saveLocation } from "@/lib/stash/actions";

type Node = { id: string; name: string; parent_id: string | null; count: number };

/** Two separate trees: where things physically are, and how you group them. */
export function OrganiseView({ locations, collections }: { locations: Node[]; collections: Node[] }) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Tree
        title="Places"
        hint="Where things physically live — a basket, a shelf, Drawer 3. Nest them: Closet › Top shelf."
        nodes={locations}
        browseKey="location"
        save={saveLocation}
        remove={deleteLocation}
        testId="places"
        extra={
          <Link href="/stash/browse?location=none" className="text-sm font-semibold text-accent hover:underline">
            Supplies without a place →
          </Link>
        }
      />
      <Tree title="Collections" hint="Your own groupings — “Blanket yarn”, “Gifts”, “Destash”. Independent of where things are." nodes={collections} browseKey="collection" save={saveCollection} remove={deleteCollection} testId="collections" />
    </div>
  );
}

function Tree({
  title,
  hint,
  nodes,
  browseKey,
  save,
  remove,
  extra,
  testId,
}: {
  title: string;
  hint: string;
  nodes: Node[];
  browseKey: string;
  save: (i: { id?: string; name: string; parentId?: string | null }) => Promise<{ ok: boolean; error?: string }>;
  remove: (id: string) => Promise<{ ok: boolean; error?: string }>;
  extra?: React.ReactNode;
  testId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Something went wrong.");
      router.refresh();
    });
  const add = (parentId: string | null) => {
    const name = window.prompt(parentId ? "Name the place inside" : `New ${title === "Places" ? "place" : "collection"}`);
    if (name?.trim()) run(() => save({ name: name.trim(), parentId }));
  };
  const children = (parent: string | null) => nodes.filter((n) => n.parent_id === parent).sort((a, b) => a.name.localeCompare(b.name));
  const render = (parent: string | null, depth: number): React.ReactNode =>
    children(parent).map((n) => (
      <li key={n.id}>
        <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 18 }}>
          <span aria-hidden="true" className="text-muted">
            {depth ? "↳" : title === "Places" ? "⌖" : "◆"}
          </span>
          <Link href={`/stash/browse?${browseKey}=${n.id}`} className="min-w-0 flex-1 truncate font-semibold text-strong hover:underline">
            {n.name}
          </Link>
          <span className="font-mono text-xs text-muted">{n.count}</span>
          <button type="button" className="min-h-9 px-1 text-xs font-semibold text-accent" onClick={() => add(n.id)} disabled={pending}>
            ＋ Inside
          </button>
          <button
            type="button"
            className="min-h-9 px-1 text-xs font-semibold text-muted"
            onClick={() => {
              const name = window.prompt("Rename", n.name);
              if (name?.trim()) run(() => save({ id: n.id, name: name.trim(), parentId: n.parent_id }));
            }}
          >
            Rename
          </button>
          <button type="button" className="min-h-9 px-1 text-xs font-semibold text-[#a3123f]" onClick={() => window.confirm(`Delete “${n.name}”? Anything in it moves up a level — nothing is deleted.`) && run(() => remove(n.id))}>
            Delete
          </button>
        </div>
        <ul>{render(n.id, depth + 1)}</ul>
      </li>
    ));
  return (
    <section className="card-plain rounded-card p-5" data-testid={testId}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display-tight text-xl text-strong">{title}</h2>
        <button type="button" className="btn btn-secondary press !min-h-9 !px-3 !text-xs" onClick={() => add(null)} data-testid={`add-${testId}`}>
          ＋ New
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {nodes.length === 0 ? <p className="mt-4 text-sm text-muted">None yet.</p> : <ul className="mt-3">{render(null, 0)}</ul>}
      {extra && <div className="mt-3">{extra}</div>}
      {error && <p className="mt-2 text-sm font-semibold text-[#a3123f]">{error}</p>}
    </section>
  );
}
