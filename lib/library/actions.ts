"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  BUCKET,
  FOLDER_COLORS,
  isUuid,
  PROJECT_STATUSES,
  storagePath,
  validateUpload,
  type FolderColor,
  type SourceKind,
} from "./constants";
import { findDuplicates } from "./data";
import { safeFetch } from "./safe-fetch";
import { normalizeTitle, normalizeUrl, parseHttpUrl, parseMetadata, youtubeId, type LinkMetadata } from "./url";

/**
 * Pattern Library mutations. Each action re-verifies the authorized owner
 * (never trusting the proxy or client-sent owner ids) and runs with the
 * owner's session, so RLS applies. File paths are only accepted inside the
 * owner's own storage prefix for the record being edited.
 */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

async function ctx() {
  const owner = await requireOwner();
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return { owner, supabase };
}

const text = (value: unknown, max = 5000) => {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
};
const list = (value: unknown, max = 40) =>
  Array.isArray(value)
    ? [...new Set(value.map((v) => (typeof v === "string" ? v.trim().slice(0, 60) : "")).filter(Boolean))].slice(0, max)
    : [];

/* ============================================================ folders */

export async function createFolder(input: { name: string; parentId?: string | null; color?: string | null }): Promise<Result<{ id: string }>> {
  const { supabase } = await ctx();
  const name = text(input.name, 80);
  if (!name) return fail("Give the folder a name.");
  const parent_id = input.parentId && isUuid(input.parentId) ? input.parentId : null;
  const color = FOLDER_COLORS.includes(input.color as FolderColor) ? (input.color as FolderColor) : null;
  const { data, error } = await supabase.from("folders").insert({ name, parent_id, color }).select("id").single();
  if (error) return fail(error.code === "23505" ? "A folder with that name already exists here." : "Couldn't create the folder.");
  refresh();
  return { ok: true, id: data.id };
}

export async function updateFolder(input: { id: string; name?: string; parentId?: string | null; color?: string | null }): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(input.id)) return fail("Folder not found.");
  const patch: { name?: string; parent_id?: string | null; color?: FolderColor | null } = {};
  if (input.name !== undefined) {
    const name = text(input.name, 80);
    if (!name) return fail("Give the folder a name.");
    patch.name = name;
  }
  if (input.parentId !== undefined) patch.parent_id = input.parentId && isUuid(input.parentId) ? input.parentId : null;
  if (input.color !== undefined) patch.color = FOLDER_COLORS.includes(input.color as FolderColor) ? (input.color as FolderColor) : null;
  const { error } = await supabase.from("folders").update(patch).eq("id", input.id);
  if (error) {
    if (error.code === "23505") return fail("A folder with that name already exists there.");
    if (error.code === "23514") return fail("A folder can't be moved inside itself.");
    return fail("Couldn't update the folder.");
  }
  refresh();
  return { ok: true };
}

/** Patterns and sub-folders move up to the parent (or Unsorted); nothing is deleted. */
export async function deleteFolder(id: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Folder not found.");
  const { error } = await supabase.rpc("delete_folder", { target: id });
  if (error) return fail("Couldn't delete the folder.");
  refresh();
  return { ok: true };
}

/* =========================================================== uploads */

/** Signed, single-use upload target inside the owner's own prefix. */
export async function prepareUpload(input: {
  scope: "patterns" | "projects";
  parentId: string;
  fileName: string;
  size: number;
  type: string;
  kind: "pdf" | "image" | "cover";
}): Promise<Result<{ path: string; signedUrl: string }>> {
  const { owner, supabase } = await ctx();
  if (!isUuid(input.parentId)) return fail("Invalid target.");
  const problem = validateUpload(input.kind === "pdf" ? "pdf" : "image", input.type, input.size);
  if (problem) return fail(problem);
  if (input.scope === "projects") {
    const { data } = await supabase.from("projects").select("id").eq("id", input.parentId).maybeSingle();
    if (!data) return fail("Project not found.");
  }
  const name = input.kind === "cover" ? "cover.jpg" : input.fileName;
  const path = storagePath(owner.id, input.scope, input.parentId, name, randomUUID().slice(0, 8));
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail("Couldn't start the upload.");
  return { ok: true, path, signedUrl: data.signedUrl };
}

/** Removes uploads that were never attached (e.g. a cancelled editor). */
export async function discardUploads(paths: string[]): Promise<Result> {
  const { owner, supabase } = await ctx();
  const mine = paths.filter((p) => typeof p === "string" && p.startsWith(`${owner.id}/`)).slice(0, 100);
  if (!mine.length) return { ok: true };
  const [sources, photos, patternCovers, projectCovers] = await Promise.all([
    supabase.from("pattern_sources").select("storage_path").in("storage_path", mine),
    supabase.from("project_photos").select("storage_path").in("storage_path", mine),
    supabase.from("patterns").select("cover_path").in("cover_path", mine),
    supabase.from("projects").select("cover_path").in("cover_path", mine),
  ]);
  const used = new Set([
    ...(sources.data ?? []).map((r) => r.storage_path),
    ...(photos.data ?? []).map((r) => r.storage_path),
    ...(patternCovers.data ?? []).map((r) => r.cover_path),
    ...(projectCovers.data ?? []).map((r) => r.cover_path),
  ]);
  const orphaned = mine.filter((p) => !used.has(p));
  if (orphaned.length) await supabase.storage.from(BUCKET).remove(orphaned);
  return { ok: true };
}

/* ====================================================== link previews */

export type LinkPreview = {
  url: string;
  normalized: string | null;
  kind: "website" | "video";
  metadata: LinkMetadata;
  fetched: boolean;
  duplicates: { id: string; title: string; reason: string }[];
};

/**
 * Best-effort metadata for a pasted link. If the page can't be read
 * (blocked, offline, not HTML), the link is still returned so it can be
 * saved and filled in manually. Never downloads protected content.
 */
export async function fetchLinkPreview(input: { url: string; kind?: "website" | "video"; patternId?: string }): Promise<Result<{ preview: LinkPreview }>> {
  await ctx();
  const parsed = parseHttpUrl(input.url);
  if ("error" in parsed) return fail(parsed.error);
  const url = parsed.url;
  const yt = youtubeId(url);
  const kind = input.kind ?? (yt || /vimeo\.com|tiktok\.com/i.test(url) ? "video" : "website");
  const empty: LinkMetadata = { title: null, description: null, siteName: null, author: null, imageUrl: null };

  let metadata = empty;
  let fetched = false;
  try {
    if (yt) {
      const { body } = await safeFetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${yt}`)}`,
        { accept: /^application\/json$/, maxBytes: 64_000 },
      );
      const o = JSON.parse(body.toString("utf8")) as { title?: string; author_name?: string; thumbnail_url?: string };
      metadata = { title: o.title ?? null, description: null, siteName: "YouTube", author: o.author_name ?? null, imageUrl: o.thumbnail_url ?? null };
    } else {
      const res = await safeFetch(url, { accept: /^(text\/html|application\/xhtml\+xml)$/, maxBytes: 1_500_000 });
      metadata = parseMetadata(res.body.toString("utf8"), res.url);
    }
    fetched = true;
  } catch {
    // Unreadable or blocked: keep the link, let the owner fill in details.
  }

  const normalized = normalizeUrl(url);
  const duplicates = normalized
    ? await findDuplicates({ urlNormalized: [normalized], excludePatternId: input.patternId })
    : [];
  return { ok: true, preview: { url, normalized, kind, metadata, fetched, duplicates } };
}

/** Copies a preview image into private storage as the pattern cover. */
export async function importCoverFromUrl(input: { imageUrl: string; patternId: string }): Promise<Result<{ path: string }>> {
  const { owner, supabase } = await ctx();
  if (!isUuid(input.patternId)) return fail("Invalid pattern.");
  const parsed = parseHttpUrl(input.imageUrl);
  if ("error" in parsed) return fail(parsed.error);
  try {
    const { body, contentType } = await safeFetch(parsed.url, {
      accept: /^image\/(jpeg|png|webp|gif)$/,
      maxBytes: 8 * 1024 * 1024,
    });
    const path = storagePath(owner.id, "patterns", input.patternId, "cover-import", randomUUID().slice(0, 8));
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: false });
    if (error) return fail("Couldn't save that image.");
    return { ok: true, path };
  } catch {
    return fail("That image couldn't be downloaded. Upload a cover instead.");
  }
}

export async function checkDuplicates(input: { patternId?: string; title?: string; sha256?: string[] }) {
  await ctx();
  const titleNormalized = input.title ? normalizeTitle(input.title) : undefined;
  return findDuplicates({ excludePatternId: input.patternId, titleNormalized, sha256: input.sha256 });
}

/* ========================================================== patterns */

export type SourceInput = {
  id?: string;
  kind: SourceKind;
  title?: string | null;
  url?: string | null;
  storagePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  pageCount?: number | null;
  sha256?: string | null;
  metadata?: Record<string, unknown>;
};

export type PatternInput = {
  id: string;
  isNew: boolean;
  title: string;
  craft: string;
  folderId?: string | null;
  designer?: string | null;
  sourceName?: string | null;
  description?: string | null;
  category?: string | null;
  difficulty?: number | null;
  techniques?: string[];
  materials?: string | null;
  tools?: string | null;
  sizes?: string | null;
  dimensions?: string | null;
  craftDetails?: Record<string, string>;
  tags?: string[];
  notes?: string | null;
  favorite?: boolean;
  coverPath?: string | null;
  sources: SourceInput[];
  removedSourceIds?: string[];
};

export async function savePattern(input: PatternInput): Promise<Result<{ id: string }>> {
  const { owner, supabase } = await ctx();
  if (!isUuid(input.id)) return fail("Invalid pattern.");
  const title = text(input.title, 200);
  if (!title) return fail("Give the pattern a title.");
  const prefix = `${owner.id}/patterns/${input.id}/`;
  const insidePrefix = (p: string | null | undefined) => !p || p.startsWith(prefix);
  if (!insidePrefix(input.coverPath)) return fail("Invalid cover.");

  const craftDetails: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.craftDetails ?? {})) {
    const value = text(v, 300);
    if (/^[a-z_]{1,40}$/.test(k) && value) craftDetails[k] = value;
  }
  const difficulty = Number.isInteger(input.difficulty) && input.difficulty! >= 1 && input.difficulty! <= 5 ? input.difficulty! : null;

  const row = {
    title,
    craft: text(input.craft, 30) ?? "",
    folder_id: input.folderId && isUuid(input.folderId) ? input.folderId : null,
    designer: text(input.designer, 200),
    source_name: text(input.sourceName, 200),
    description: text(input.description, 5000),
    category: text(input.category, 100),
    difficulty,
    techniques: list(input.techniques),
    materials: text(input.materials, 3000),
    tools: text(input.tools, 3000),
    sizes: text(input.sizes, 1000),
    dimensions: text(input.dimensions, 1000),
    craft_details: craftDetails,
    tags: list(input.tags),
    notes: text(input.notes, 10000),
    favorite: Boolean(input.favorite),
    cover_path: input.coverPath ?? null,
  };

  // Previous cover, to clean up if it was replaced.
  let previousCover: string | null = null;
  if (input.isNew) {
    const { error } = await supabase.from("patterns").insert({ id: input.id, ...row });
    if (error) return fail(error.code === "23503" ? "Choose a craft and an existing folder." : "Couldn't save the pattern.");
  } else {
    const existing = await supabase.from("patterns").select("cover_path").eq("id", input.id).maybeSingle();
    if (!existing.data) return fail("Pattern not found.");
    previousCover = existing.data.cover_path;
    const { error } = await supabase.from("patterns").update(row).eq("id", input.id);
    if (error) return fail("Couldn't save the pattern.");
  }

  // Sources: add new, update titles/order, remove deleted (and their files).
  const removedFiles: string[] = [];
  const removed = (input.removedSourceIds ?? []).filter(isUuid);
  if (removed.length) {
    const { data } = await supabase.from("pattern_sources").delete().in("id", removed).eq("pattern_id", input.id).select("storage_path");
    for (const r of data ?? []) if (r.storage_path) removedFiles.push(r.storage_path);
  }
  for (const [index, source] of input.sources.entries()) {
    const sort_order = index;
    if (source.id && isUuid(source.id)) {
      await supabase.from("pattern_sources").update({ title: text(source.title, 200), sort_order }).eq("id", source.id).eq("pattern_id", input.id);
      continue;
    }
    const isFile = source.kind === "pdf" || source.kind === "image";
    if (isFile && (!source.storagePath || !insidePrefix(source.storagePath))) return fail("A file couldn't be attached.");
    let url: string | null = null;
    if (!isFile) {
      const parsed = parseHttpUrl(source.url ?? "");
      if ("error" in parsed) return fail(parsed.error);
      url = parsed.url;
    }
    const { error } = await supabase.from("pattern_sources").insert({
      pattern_id: input.id,
      kind: source.kind,
      title: text(source.title, 200),
      url,
      url_normalized: url ? normalizeUrl(url) : null,
      storage_path: isFile ? source.storagePath : null,
      file_name: text(source.fileName, 255),
      mime_type: text(source.mimeType, 100),
      size_bytes: Number.isFinite(source.sizeBytes) ? source.sizeBytes : null,
      page_count: Number.isInteger(source.pageCount) ? source.pageCount : null,
      sha256: source.sha256 && /^[0-9a-f]{64}$/.test(source.sha256) ? source.sha256 : null,
      metadata: (source.metadata ?? {}) as { [key: string]: Json },
      sort_order,
    });
    if (error) return fail("A source couldn't be saved.");
  }

  if (previousCover && previousCover !== row.cover_path) removedFiles.push(previousCover);
  if (removedFiles.length) await supabase.storage.from(BUCKET).remove(removedFiles);

  refresh();
  return { ok: true, id: input.id };
}

export async function setFavorite(id: string, favorite: boolean): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Pattern not found.");
  const { error } = await supabase.from("patterns").update({ favorite }).eq("id", id);
  if (error) return fail("Couldn't update favorite.");
  refresh();
  return { ok: true };
}

export async function movePattern(id: string, folderId: string | null): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Pattern not found.");
  const { error } = await supabase.from("patterns").update({ folder_id: folderId && isUuid(folderId) ? folderId : null }).eq("id", id);
  if (error) return fail("Couldn't move the pattern.");
  refresh();
  return { ok: true };
}

export async function archivePattern(id: string, archived: boolean): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Pattern not found.");
  const { error } = await supabase.from("patterns").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) return fail("Couldn't update the pattern.");
  refresh();
  return { ok: true };
}

/**
 * Deletes a pattern and its files. If projects exist, the caller must
 * explicitly confirm deleting them too (otherwise archive instead).
 */
export async function deletePattern(id: string, opts: { deleteProjects?: boolean } = {}): Promise<Result<{ projectCount?: number }>> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Pattern not found.");
  const projects = await supabase.from("projects").select("id, cover_path").eq("pattern_id", id);
  const projectRows = projects.data ?? [];
  if (projectRows.length && !opts.deleteProjects) {
    return fail(`This pattern has ${projectRows.length} project${projectRows.length === 1 ? "" : "s"}. Archive it, or confirm deleting them too.`);
  }

  const files: string[] = [];
  if (projectRows.length) {
    const ids = projectRows.map((p) => p.id);
    const photos = await supabase.from("project_photos").select("storage_path").in("project_id", ids);
    files.push(...(photos.data ?? []).map((p) => p.storage_path));
    const { error } = await supabase.from("projects").delete().in("id", ids);
    if (error) return fail("Couldn't delete the projects.");
  }
  const [sources, pattern] = await Promise.all([
    supabase.from("pattern_sources").select("storage_path").eq("pattern_id", id),
    supabase.from("patterns").select("cover_path").eq("id", id).maybeSingle(),
  ]);
  files.push(...(sources.data ?? []).flatMap((s) => (s.storage_path ? [s.storage_path] : [])));
  if (pattern.data?.cover_path) files.push(pattern.data.cover_path);

  const { error } = await supabase.from("patterns").delete().eq("id", id);
  if (error) return fail("Couldn't delete the pattern.");
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
  refresh();
  return { ok: true };
}

/* ====================================================== instructions */

export type SectionInput = {
  id?: string;
  title: string;
  notes?: string | null;
  steps: { id?: string; body: string; rowStart?: number | null; rowEnd?: number | null; repeatCount?: number | null }[];
};

/** Replaces a pattern's structured instructions, keeping ids that survive. */
export async function saveInstructions(patternId: string, sections: SectionInput[]): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(patternId)) return fail("Pattern not found.");
  const pattern = await supabase.from("patterns").select("id").eq("id", patternId).maybeSingle();
  if (!pattern.data) return fail("Pattern not found.");

  const existing = await supabase.from("pattern_sections").select("id").eq("pattern_id", patternId);
  const keepSections = new Set(sections.map((s) => s.id).filter(isUuid));
  const dropSections = (existing.data ?? []).map((s) => s.id).filter((id) => !keepSections.has(id));
  if (dropSections.length) await supabase.from("pattern_sections").delete().in("id", dropSections);

  const posInt = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : null);
  for (const [position, section] of sections.entries()) {
    const title = text(section.title, 120);
    if (!title) return fail(`Section ${position + 1} needs a title.`);
    const payload = { title, notes: text(section.notes, 4000), position };
    let sectionId = section.id && isUuid(section.id) ? section.id : null;
    if (sectionId) {
      await supabase.from("pattern_sections").update(payload).eq("id", sectionId);
    } else {
      const { data, error } = await supabase.from("pattern_sections").insert({ pattern_id: patternId, ...payload }).select("id").single();
      if (error) return fail("Couldn't save instructions.");
      sectionId = data.id;
    }
    const existingSteps = await supabase.from("pattern_steps").select("id").eq("section_id", sectionId);
    const keepSteps = new Set(section.steps.map((s) => s.id).filter(isUuid));
    const dropSteps = (existingSteps.data ?? []).map((s) => s.id).filter((id) => !keepSteps.has(id));
    if (dropSteps.length) await supabase.from("pattern_steps").delete().in("id", dropSteps);
    for (const [stepIndex, step] of section.steps.entries()) {
      const body = text(step.body, 4000);
      if (!body) continue;
      const rowStart = posInt(step.rowStart);
      const rowEnd = posInt(step.rowEnd);
      const stepPayload = {
        body,
        position: stepIndex,
        row_start: rowStart,
        row_end: rowEnd && rowStart && rowEnd < rowStart ? rowStart : rowEnd,
        repeat_count: posInt(step.repeatCount),
      };
      if (step.id && isUuid(step.id)) await supabase.from("pattern_steps").update(stepPayload).eq("id", step.id);
      else await supabase.from("pattern_steps").insert({ section_id: sectionId, ...stepPayload });
    }
  }
  refresh();
  return { ok: true };
}

/* ========================================================== projects */

const STATUS_VALUES = PROJECT_STATUSES.map((s) => s.value) as string[];
const dateOnly = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function createProject(input: {
  patternId: string;
  name: string;
  sizeColorway?: string | null;
  status?: string;
  startedOn?: string | null;
  notes?: string | null;
}): Promise<Result<{ id: string }>> {
  const { supabase } = await ctx();
  if (!isUuid(input.patternId)) return fail("Pattern not found.");
  const name = text(input.name, 200);
  if (!name) return fail("Give the project a name.");
  const status = STATUS_VALUES.includes(input.status ?? "") ? input.status! : "planned";
  const { data, error } = await supabase
    .from("projects")
    .insert({
      pattern_id: input.patternId,
      name,
      status: status as never,
      size_colorway: text(input.sizeColorway, 200),
      started_on: dateOnly(input.startedOn) ?? (status === "in_progress" ? new Date().toISOString().slice(0, 10) : null),
      notes: text(input.notes, 10000),
      progress: status === "finished" ? 100 : 0,
      last_worked_at: status === "in_progress" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) return fail("Couldn't start the project.");
  refresh();
  return { ok: true, id: data.id };
}

export async function updateProject(input: {
  id: string;
  name?: string;
  status?: string;
  progress?: number | null;
  sizeColorway?: string | null;
  notes?: string | null;
  startedOn?: string | null;
  finishedOn?: string | null;
  coverPath?: string | null;
}): Promise<Result> {
  const { owner, supabase } = await ctx();
  if (!isUuid(input.id)) return fail("Project not found.");
  const patch: Database["public"]["Tables"]["projects"]["Update"] = {};
  if (input.name !== undefined) {
    const name = text(input.name, 200);
    if (!name) return fail("Give the project a name.");
    patch.name = name;
  }
  if (input.status !== undefined) {
    if (!STATUS_VALUES.includes(input.status)) return fail("Unknown status.");
    patch.status = input.status as NonNullable<typeof patch.status>;
    if (input.status === "finished") {
      patch.progress = 100;
      patch.finished_on = dateOnly(input.finishedOn) ?? new Date().toISOString().slice(0, 10);
    }
    if (input.status === "in_progress") patch.last_worked_at = new Date().toISOString();
  }
  if (input.progress !== undefined) {
    patch.progress = input.progress === null ? null : Math.max(0, Math.min(100, Math.round(input.progress)));
    patch.last_worked_at = new Date().toISOString();
  }
  if (input.sizeColorway !== undefined) patch.size_colorway = text(input.sizeColorway, 200);
  if (input.notes !== undefined) patch.notes = text(input.notes, 10000);
  if (input.startedOn !== undefined) patch.started_on = dateOnly(input.startedOn);
  if (input.finishedOn !== undefined && input.status !== "finished") patch.finished_on = dateOnly(input.finishedOn);
  if (input.coverPath !== undefined) {
    if (input.coverPath && !input.coverPath.startsWith(`${owner.id}/projects/${input.id}/`)) return fail("Invalid cover.");
    patch.cover_path = input.coverPath;
  }
  const { error } = await supabase.from("projects").update(patch).eq("id", input.id);
  if (error) return fail("Couldn't update the project.");
  refresh();
  return { ok: true };
}

export async function deleteProject(id: string): Promise<Result<{ patternId: string | null }>> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Project not found.");
  const project = await supabase.from("projects").select("pattern_id").eq("id", id).maybeSingle();
  if (!project.data) return fail("Project not found.");
  const photos = await supabase.from("project_photos").select("storage_path").eq("project_id", id);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return fail("Couldn't delete the project.");
  const files = (photos.data ?? []).map((p) => p.storage_path);
  if (files.length) await supabase.storage.from(BUCKET).remove(files);
  refresh();
  return { ok: true, patternId: project.data.pattern_id };
}

export async function addProjectPhoto(input: { projectId: string; path: string; fileName: string; mimeType: string; size: number }): Promise<Result> {
  const { owner, supabase } = await ctx();
  if (!isUuid(input.projectId) || !input.path.startsWith(`${owner.id}/projects/${input.projectId}/`)) return fail("Invalid photo.");
  const { error } = await supabase.from("project_photos").insert({
    project_id: input.projectId,
    storage_path: input.path,
    file_name: text(input.fileName, 255),
    mime_type: text(input.mimeType, 100),
    size_bytes: Number.isFinite(input.size) ? input.size : null,
  });
  if (error) return fail("Couldn't attach the photo.");
  const project = await supabase.from("projects").select("cover_path").eq("id", input.projectId).maybeSingle();
  if (project.data && !project.data.cover_path) await supabase.from("projects").update({ cover_path: input.path }).eq("id", input.projectId);
  refresh();
  return { ok: true };
}

export async function removeProjectPhoto(photoId: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(photoId)) return fail("Photo not found.");
  const { data } = await supabase.from("project_photos").delete().eq("id", photoId).select("storage_path, project_id").maybeSingle();
  if (!data) return fail("Photo not found.");
  await supabase.from("projects").update({ cover_path: null }).eq("id", data.project_id).eq("cover_path", data.storage_path);
  await supabase.storage.from(BUCKET).remove([data.storage_path]);
  refresh();
  return { ok: true };
}

export async function logSession(input: { projectId: string; minutes: number; note?: string | null; date?: string | null }): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(input.projectId)) return fail("Project not found.");
  const minutes = Math.round(Number(input.minutes));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) return fail("Enter between 1 and 1440 minutes.");
  const date = dateOnly(input.date);
  const start = date ? new Date(`${date}T12:00:00Z`) : new Date(Date.now() - minutes * 60_000);
  const { error } = await supabase.from("project_sessions").insert({
    project_id: input.projectId,
    active_seconds: minutes * 60,
    note: text(input.note, 1000),
    started_at: start.toISOString(),
    ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
    status: "finished",
  });
  if (error) return fail("Couldn't log the session.");
  refresh();
  return { ok: true };
}

export async function deleteSession(id: string): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(id)) return fail("Session not found.");
  await supabase.from("project_sessions").delete().eq("id", id);
  refresh();
  return { ok: true };
}

export async function setStepDone(input: { projectId: string; stepId: string; done: boolean }): Promise<Result> {
  const { supabase } = await ctx();
  if (!isUuid(input.projectId) || !isUuid(input.stepId)) return fail("Step not found.");
  const { error } = input.done
    ? await supabase.from("project_step_completions").upsert({ project_id: input.projectId, step_id: input.stepId })
    : await supabase.from("project_step_completions").delete().eq("project_id", input.projectId).eq("step_id", input.stepId);
  if (error) return fail("Couldn't update the step.");
  refresh();
  return { ok: true };
}
