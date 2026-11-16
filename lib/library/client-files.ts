/**
 * Browser-side file helpers for the pattern editor and project photos.
 * Files go straight from the browser to private Supabase Storage through a
 * signed, single-use upload URL issued by the server after authorization.
 */
import { prepareUpload } from "./actions";

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Uploads with progress (fetch can't report upload progress; XHR can). */
export async function uploadFile(
  file: Blob,
  target: { scope: "patterns" | "projects"; parentId: string; kind: "pdf" | "image" | "cover"; fileName: string },
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const prepared = await prepareUpload({
    scope: target.scope,
    parentId: target.parentId,
    fileName: target.fileName,
    size: file.size,
    type: file.type || (target.kind === "pdf" ? "application/pdf" : "image/jpeg"),
    kind: target.kind,
  });
  if (!prepared.ok) throw new Error(prepared.error);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", prepared.signedUrl);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Try again.")));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.send(file);
  });
  onProgress?.(1);
  return prepared.path;
}

/** Downscales any decodable image to a JPEG cover (max 1200px). */
export async function toCoverJpeg(source: Blob | HTMLCanvasElement, max = 1200): Promise<Blob> {
  let canvas: HTMLCanvasElement;
  if (source instanceof HTMLCanvasElement) {
    canvas = source;
  } else {
    const bitmap = await createImageBitmap(source).catch(() => {
      throw new Error("This image format can't be previewed here. Try a JPEG or PNG.");
    });
    canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
  }
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height));
  const out = document.createElement("canvas");
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the cover."))), "image/jpeg", 0.85),
  );
}

/**
 * Reads page count and renders page 1 of a PDF (PDF.js, loaded on demand).
 * Fails soft: a PDF that can't be read is still uploaded and saved.
 */
/**
 * PDF.js "legacy" build: the modern build needs ES2025 Iterator helpers that
 * Safari before 18.4 lacks ("Can't find variable: Iterator"); legacy
 * bundles the polyfills. Worker and library must come from the same build.
 */
export const pdfWorkerSrc = () => new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();

export async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc();
  return pdfjs;
}

export async function inspectPdf(file: Blob): Promise<{ pageCount: number | null; firstPage: HTMLCanvasElement | null }> {
  try {
    const pdfjs = await loadPdfjs();
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const doc = await task.promise;
    const pageCount = doc.numPages;
    let firstPage: HTMLCanvasElement | null = null;
    try {
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1200 / Math.max(base.width, base.height)) });
      firstPage = document.createElement("canvas");
      firstPage.width = Math.ceil(viewport.width);
      firstPage.height = Math.ceil(viewport.height);
      await page.render({ canvas: firstPage, viewport }).promise;
    } catch {
      firstPage = null;
    }
    await task.destroy();
    return { pageCount, firstPage };
  } catch {
    return { pageCount: null, firstPage: null };
  }
}

export { formatBytes } from "./constants";
