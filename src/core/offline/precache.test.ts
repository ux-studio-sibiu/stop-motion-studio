import { describe, expect, it } from "vitest";
import { pageKey, planPrecache, urlForFile } from "./precache";

describe("urlForFile", () => {
  it("serves pages at their clean names", () => {
    expect(urlForFile("index.html")).toBe("/");
    expect(urlForFile("studio.html")).toBe("/studio");
    expect(urlForFile("design.html")).toBe("/design");
    expect(urlForFile("docs/index.html")).toBe("/docs/");
  });

  it("serves everything else at its path", () => {
    expect(urlForFile("_next/static/chunks/0abc.js")).toBe("/_next/static/chunks/0abc.js");
    expect(urlForFile("studio.txt")).toBe("/studio.txt");
    expect(urlForFile("fonts\\nunito\\nunito-latin.woff2")).toBe("/fonts/nunito/nunito-latin.woff2");
  });
});

describe("planPrecache", () => {
  const files = [
    "index.html", "studio.html", "design.html", "studio.txt", "studio/__next._tree.txt",
    "_next/static/chunks/b.js", "_next/static/chunks/a.css", "_next/static/chunks/b.js.map",
    "fonts/nunito/nunito-latin.woff2", "favicon.ico", "manifest.webmanifest",
    "sounds/bsb-0128.ogg", "sounds/bsb-0095.ogg",
    "steps/index.html", "steps/steps.css", "demos/demos.zip", "404.html", "_not-found.html", "_not-found/__next._tree.txt", "sw.js",
  ];

  it("keeps the pages, the code and the assets in the shell, sorted", () => {
    expect(planPrecache(files).shell).toEqual([
      "/", "/_next/static/chunks/a.css", "/_next/static/chunks/b.js", "/design", "/favicon.ico",
      "/fonts/nunito/nunito-latin.woff2", "/manifest.webmanifest", "/studio", "/studio.txt", "/studio/__next._tree.txt",
    ]);
  });

  it("puts the sound effects in their own list, for later", () => {
    expect(planPrecache(files).sounds).toEqual(["/sounds/bsb-0095.ogg", "/sounds/bsb-0128.ogg"]);
  });

  it("leaves out the build notes, the demo animations, source maps, not-found pages and the worker", () => {
    const all = [...planPrecache(files).shell, ...planPrecache(files).sounds];
    expect(all.some((url) => url.startsWith("/steps/") || url.startsWith("/demos/") || url.endsWith(".map") || url.includes("not-found") || url === "/404" || url === "/sw.js")).toBe(false);
  });
});

describe("pageKey", () => {
  it("answers every form of a page's address with its clean name", () => {
    expect(pageKey("/")).toBe("/");
    expect(pageKey("/index.html")).toBe("/");
    expect(pageKey("/studio")).toBe("/studio");
    expect(pageKey("/studio/")).toBe("/studio");
    expect(pageKey("/studio.html")).toBe("/studio");
  });
});
