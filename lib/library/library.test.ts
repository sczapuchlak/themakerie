import assert from "node:assert/strict";
import { test } from "node:test";
import { storagePath, validateUpload } from "./constants.ts";
import { activeFilterCount, escapeLike, parseLibraryQuery, toSearchParams } from "./query.ts";
import { isPrivateAddress, normalizeTitle, normalizeUrl, parseHttpUrl, parseMetadata, youtubeId } from "./url.ts";

test("normalizeUrl strips tracking, www, trailing slashes and sorts params", () => {
  assert.equal(
    normalizeUrl("https://www.Example.com/patterns/cardigan/?utm_source=x&b=2&a=1#notes"),
    "example.com/patterns/cardigan?a=1&b=2",
  );
  assert.equal(normalizeUrl("http://example.com/x"), normalizeUrl("https://example.com/x/"));
  assert.equal(normalizeUrl("ftp://example.com"), null);
  assert.equal(normalizeUrl("not a url"), null);
});

test("YouTube links normalize to one form", () => {
  assert.equal(youtubeId("https://youtu.be/abc123"), "abc123");
  assert.equal(youtubeId("https://m.youtube.com/watch?v=abc123&t=30"), "abc123");
  assert.equal(youtubeId("https://www.youtube.com/shorts/abc123"), "abc123");
  assert.equal(normalizeUrl("https://youtu.be/abc123"), normalizeUrl("https://www.youtube.com/watch?v=abc123&si=z"));
});

test("parseHttpUrl accepts bare domains and rejects unsafe schemes", () => {
  assert.deepEqual(parseHttpUrl("ravelry.com/patterns/x"), { url: "https://ravelry.com/patterns/x" });
  assert.ok("error" in parseHttpUrl("javascript:alert(1)"));
  assert.ok("error" in parseHttpUrl("https://user:pass@example.com"));
  assert.ok("error" in parseHttpUrl("http://localhost:3000"));
  assert.ok("error" in parseHttpUrl(""));
});

test("isPrivateAddress blocks internal targets", () => {
  for (const ip of ["127.0.0.1", "10.2.3.4", "172.20.0.1", "192.168.1.5", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
});

test("parseMetadata reads Open Graph with fallbacks and never invents values", () => {
  const html = `<html><head><title>Fallback &amp; Title</title>
    <meta property="og:title" content="Comfiest Cardigan">
    <meta name="description" content="A cozy &quot;everyday&quot; cardigan.">
    <meta property="og:site_name" content="Yarn Studio">
    <meta property="og:image" content="/img/cover.jpg">
    <meta property="og:image" content="/img/second.jpg">
  </head></html>`;
  const meta = parseMetadata(html, "https://yarn.example/p/cardigan");
  assert.equal(meta.title, "Comfiest Cardigan");
  assert.equal(meta.description, 'A cozy "everyday" cardigan.');
  assert.equal(meta.siteName, "Yarn Studio");
  assert.equal(meta.author, null);
  assert.equal(meta.imageUrl, "https://yarn.example/img/cover.jpg");

  const bare = parseMetadata("<title>Only a title</title>", "https://x.example");
  assert.deepEqual(bare, { title: "Only a title", description: null, siteName: null, author: null, imageUrl: null });
  assert.equal(parseMetadata("", "https://x.example").title, null);
  assert.equal(parseMetadata('<meta property="og:image" content="javascript:x">', "https://x.example").imageUrl, null);
});

test("normalizeTitle ignores case and punctuation", () => {
  assert.equal(normalizeTitle("Everyday Ribbed Beanie!"), normalizeTitle("everyday  ribbed—beanie"));
});

test("library query parsing validates and defaults every field", () => {
  const q = parseLibraryQuery(
    { q: "  beanie ", craft: "knitting", difficulty: "9", tag: "Gift", favorites: "1", activity: "none", sort: "bogus", page: "3" },
    "list",
  );
  assert.equal(q.q, "beanie");
  assert.equal(q.craft, "knitting");
  assert.equal(q.difficulty, null);
  assert.equal(q.tag, "gift");
  assert.equal(q.favorites, true);
  assert.equal(q.activity, "none");
  assert.equal(q.sort, "added");
  assert.equal(q.view, "list");
  assert.equal(q.page, 3);
  assert.equal(activeFilterCount(q), 4);
  assert.equal(parseLibraryQuery({ craft: "Robert'); drop" }).craft, null);
  assert.equal(parseLibraryQuery({ view: "gallery" }, "list").view, "gallery", "URL beats saved view");
});

test("toSearchParams round-trips and omits defaults", () => {
  const q = parseLibraryQuery({ q: "hat", craft: "crochet", sort: "title", favorites: "1" });
  assert.equal(toSearchParams(q), "?q=hat&craft=crochet&favorites=1&sort=title");
  assert.deepEqual(parseLibraryQuery(Object.fromEntries(new URLSearchParams(toSearchParams(q)))), q);
  assert.equal(toSearchParams(parseLibraryQuery({})), "");
});

test("escapeLike neutralizes wildcards", () => {
  assert.equal(escapeLike("50%_off\\"), "50\\%\\_off\\\\");
});

test("upload validation and storage paths", () => {
  assert.equal(validateUpload("pdf", "application/pdf", 1024), null);
  assert.match(validateUpload("pdf", "image/png", 10) ?? "", /PDF/);
  assert.match(validateUpload("pdf", "application/pdf", 200 * 1024 * 1024) ?? "", /100 MB/);
  assert.equal(validateUpload("image", "image/heic", 5_000_000), null);
  assert.match(validateUpload("image", "image/png", 0) ?? "", /empty/);
  const path = storagePath("owner", "patterns", "p1", "../../Évêque pattern (final).pdf", "u1");
  assert.equal(path, "owner/patterns/p1/u1-Eveque-pattern-final-.pdf");
  assert.ok(!path.includes(".."));
  assert.equal(storagePath("o", "projects", "p", "....", "u"), "o/projects/p/u-file");
});
