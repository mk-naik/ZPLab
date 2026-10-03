import { describe, it, expect } from "vitest";
import { LIMITS, fillExport, listingsProblems, parseCsv, readListings } from "../../scripts/store-listing.mjs";
import { manifestLanguages, readManifest } from "../../scripts/msix.mjs";

describe("Microsoft Store listings", () => {
  const listings = readListings();

  it("cover exactly the languages the package declares, spelled the same", () => {
    expect(listings.map((l) => l.tag).sort()).toEqual(manifestLanguages(readManifest()).sort());
  });

  it("fit Partner Center's limits and match the source's feature count", () => {
    expect(listingsProblems(listings)).toEqual([]);
  });
});

describe("fillExport", () => {
  const exportCsv = [
    "Field,ID,Type (Type),default,en-us",
    "Description,2,Text,old default,",
    "DesktopScreenshot1,100,Relative path,,",
    ...Array.from({ length: LIMITS.features }, (_, i) => `Feature${i + 1},${700 + i},Text,${i === 13 ? "stale default" : ""},${i === 13 ? "stale" : ""}`),
    ...Array.from({ length: LIMITS.keywords }, (_, i) => `SearchTerm${i + 1},${900 + i},Text,,`),
  ].join("\r\n");
  const listing = { tag: "en-US", description: 'Line one, "quoted".\n\nLine two.', features: ["A", "B"], keywords: ["k"] };
  const rows = parseCsv(fillExport(exportCsv, [listing], "out/shot.png"));
  const cell = (field: string, col: number) => rows.find((r) => r[0] === field)?.[col];

  it("round-trips multi-line, quoted text into the language column", () => {
    expect(cell("Description", 4)).toBe(listing.description);
    expect(cell("Feature2", 4)).toBe("B");
    expect(cell("SearchTerm1", 4)).toBe("k");
  });

  it("rewrites the default column from the source, which empty language cells fall back to", () => {
    expect(cell("Description", 3)).toBe(listing.description);
    expect(cell("Feature14", 3)).toBe("");
  });

  it("clears slots the listing does not fill", () => {
    expect(cell("Feature14", 4)).toBe("");
  });

  it("puts the screenshot in the default column", () => {
    expect(cell("DesktopScreenshot1", 3)).toBe("out/shot.png");
  });

  it("refuses an export without the listing's language column", () => {
    expect(() => fillExport(exportCsv, [listing, { ...listing, tag: "fr" }], "x.png")).toThrow(/fr column/);
  });
});

describe("parseCsv", () => {
  it("reports a malformed export instead of a missing row", () => {
    expect(() => parseCsv('Field,ID\n"unterminated,1')).toThrow(/malformed CSV/);
  });
});
