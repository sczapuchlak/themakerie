import { cookies } from "next/headers";
import Link from "next/link";
import { Numeral } from "@/components/editorial/foil";
import { notFound } from "next/navigation";
import { getCollection, getCrafts, getFolders, folderPath, type Scope } from "@/lib/library/data";
import { parseLibraryQuery, toSearchParams } from "@/lib/library/query";
import { CollectionToolbar, VIEW_COOKIE } from "./collection-toolbar";
import { FolderButton } from "./folder-dialog";
import { FolderGlyph } from "./library-landing";
import { PatternGallery, PatternList } from "./pattern-grid";

/** All Patterns, Unsorted, or a folder — one shared browsing experience. */
export async function CollectionView({
  scope,
  searchParams,
}: {
  scope: Scope;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const query = parseLibraryQuery(params, cookieStore.get(VIEW_COOKIE)?.value);
  const [folders, crafts, collection] = await Promise.all([getFolders(), getCrafts(), getCollection(scope, query)]);

  const folder = scope.kind === "folder" ? folders.find((f) => f.id === scope.id) : null;
  if (scope.kind === "folder" && !folder) notFound();
  const trail = folder ? folderPath(folders, folder.id) : [];
  const children = folders.filter((f) => (folder ? f.parent_id === folder.id : false));
  const title = folder ? folder.name : scope.kind === "unsorted" ? "Unsorted" : "All Patterns";
  const craftMap = new Map(crafts.map((c) => [c.slug, c.name]));
  const addHref = folder ? `/patterns/new?folder=${folder.id}` : "/patterns/new";

  return (
    <div className="gutter mx-auto w-full max-w-[80rem]">
      <nav aria-label="Breadcrumb" className="mt-4 md:mt-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
          <li>
            <Link href="/patterns" className="font-semibold text-accent hover:underline">
              Pattern Library
            </Link>
          </li>
          {trail.slice(0, -1).map((f) => (
            <li key={f.id} className="flex items-center gap-1">
              <span aria-hidden="true">/</span>
              <Link href={`/patterns/folders/${f.id}`} className="font-semibold text-accent hover:underline">
                {f.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <header className={`tone-midnight surface-midnight relative isolate mt-3 overflow-hidden rounded-panel ${folder ? "" : "holo-border"}`}>
        <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-7">
          <div className="flex min-w-0 items-end gap-4">
            <Numeral n={collection.total} tone="midnight" className="text-[3rem] sm:text-[3.6rem]" />
            <div className="min-w-0 pb-1">
              <p className="eyebrow">{collection.total === 1 ? "pattern" : "patterns"}</p>
              <h1 className="flex items-center gap-2.5 font-display-tight text-[clamp(1.9rem,4.4vw,2.8rem)] leading-tight text-white [overflow-wrap:anywhere]">
                {folder && <FolderGlyph color={folder.color} />}
                {title}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {folder && (
              <>
                <FolderButton folders={folders} defaultParentId={folder.id} label="＋ Sub-folder" className="btn btn-secondary press !min-h-10" />
                <FolderButton folders={folders} folder={folder} label="Folder settings" className="btn btn-secondary press !min-h-10" />
              </>
            )}
            <Link href={addHref} className="btn btn-primary press !min-h-10">
              ＋ Add pattern
            </Link>
          </div>
        </div>
      </header>

      {children.length > 0 && (
        <ul className="no-scrollbar -mx-[var(--gutter)] mt-4 flex gap-2 overflow-x-auto px-[var(--gutter)]">
          {children.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link href={`/patterns/folders/${c.id}`} className="chip">
                <FolderGlyph color={c.color} /> {c.name}
                <span className="font-mono text-xs opacity-60">{c.pattern_count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CollectionToolbar query={query} total={collection.total} shown={collection.rows.length} crafts={crafts} tags={collection.tags} />

      {collection.rows.length === 0 ? (
        <EmptyCollection filtered={query.q !== "" || toSearchParams({ ...query, view: "gallery", sort: "added", q: "" }) !== ""} addHref={addHref} />
      ) : query.view === "list" ? (
        <PatternList rows={collection.rows} crafts={craftMap} />
      ) : (
        <PatternGallery rows={collection.rows} crafts={craftMap} />
      )}

      {collection.hasMore && (
        <div className="mt-8 flex justify-center">
          <Link href={toSearchParams({ ...query, page: query.page + 1 }) || "?"} scroll={false} className="btn btn-secondary">
            Show more
          </Link>
        </div>
      )}
    </div>
  );
}

function EmptyCollection({ filtered, addHref }: { filtered: boolean; addHref: string }) {
  return (
    <div className="surface-panel mt-6 flex flex-col items-start gap-3 rounded-card p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-strong">{filtered ? "No patterns match." : "Nothing here yet."}</p>
        <p className="text-sm text-muted">
          {filtered ? "Try a different search, or reset the filters." : "Add a PDF, a link, some photos — or write it down yourself."}
        </p>
      </div>
      {!filtered && (
        <Link href={addHref} className="btn btn-ink">
          ＋ Add pattern
        </Link>
      )}
    </div>
  );
}
