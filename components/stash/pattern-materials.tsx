"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRequirement, saveRequirement } from "@/lib/stash/actions";
import { FAMILIES } from "@/lib/stash/catalog";

type Req = { id: string; kind: string; family: string; description: string; quantity_text: string | null };

/** What the pattern calls for — specifications, never owned stock. */
export function PatternMaterials({ patternId, requirements }: { patternId: string; requirements: Req[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [family, setFamily] = useState("yarn");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await saveRequirement({ patternId, kind: family === "tool" ? "tool" : "material", family, description, quantityText: qty, position: requirements.length });
      if (!r.ok) return setError(r.error);
      setDescription("");
      setQty("");
      setAdding(false);
      router.refresh();
    });
  return (
    <section className="card-plain rounded-card p-5" aria-labelledby="materials-title" data-testid="pattern-materials">
      <div className="flex items-center justify-between gap-3">
        <h2 id="materials-title" className="font-semibold text-strong">
          Materials &amp; tools
        </h2>
        {!adding && (
          <button type="button" className="text-sm font-semibold text-accent hover:underline" onClick={() => setAdding(true)} data-testid="add-requirement">
            ＋ Add
          </button>
        )}
      </div>
      {requirements.length === 0 && !adding && <p className="mt-2 text-sm text-muted">What the pattern asks for — e.g. 800 yd worsted, 5 mm needles, 6 buttons.</p>}
      <ul className="mt-2 divide-y divide-line text-sm">
        {requirements.map((r) => (
          <li key={r.id} className="flex items-center gap-2 py-2">
            <span className="w-16 shrink-0 text-xs font-semibold text-muted uppercase">{FAMILIES.find((f) => f.value === r.family)?.label.split(" ")[0]}</span>
            <span className="min-w-0 flex-1 text-strong">
              {r.description}
              {r.quantity_text && <span className="text-muted"> · {r.quantity_text}</span>}
            </span>
            <button type="button" aria-label={`Remove ${r.description}`} className="grid size-8 place-items-center rounded-full text-muted hover:bg-selected" onClick={() => start(async () => (await deleteRequirement(r.id), router.refresh()))}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {adding && (
        <div className="mt-3 space-y-2">
          <select className="field !min-h-10" value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Kind">
            {FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <input className="field !min-h-10" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Worsted weight yarn" maxLength={300} aria-label="What" data-testid="requirement-description" />
          <input className="field !min-h-10" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="800 yd" maxLength={120} aria-label="How much" />
          <div className="flex gap-2">
            <button type="button" className="btn btn-ink press !min-h-10" disabled={pending || !description.trim()} onClick={save} data-testid="save-requirement">
              Add
            </button>
            <button type="button" className="btn btn-secondary press !min-h-10" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
          {error && <p className="text-sm font-semibold text-[#a3123f]">{error}</p>}
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Suggestions only — pick the real supplies in each project.</p>
    </section>
  );
}
