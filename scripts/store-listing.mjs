// Microsoft Store listing helpers for build-store-listing.mjs, split out so
// src/lib/storeListingScripts.test.ts can check the texts without an export.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LISTINGS = join(ROOT, 'store', 'microsoft');
export const SOURCE_TAG = 'en-US';

export const LIMITS = { description: 10000, features: 20, featureChars: 200, keywords: 7, keywordChars: 40, keywordWords: 21 };

// CRLF from an editor would otherwise reach Partner Center as a trailing CR.
const lf = (text) => text.replace(/\r\n?/g, '\n');
const lines = (text) => lf(text).split('\n').map((line) => line.trim()).filter(Boolean);

export function readListings() {
  return readdirSync(LISTINGS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name: tag }) => {
      const read = (file) => readFileSync(join(LISTINGS, tag, file), 'utf8');
      return { tag, description: lf(read('description.txt')).trimEnd(), features: lines(read('features.txt')), keywords: lines(read('keywords.txt')) };
    });
}

/** What Partner Center would reject, plus translations whose feature count drifted from the source. */
export function listingsProblems(listings) {
  const source = listings.find((l) => l.tag === SOURCE_TAG);
  if (!source) return [`no ${SOURCE_TAG} source listing`];
  const problems = [];
  for (const listing of listings) {
    const check = (ok, message) => {
      if (!ok) problems.push(`${listing.tag}: ${message}`);
    };
    check(listing.description.length > 0, 'empty description');
    check(listing.description.length <= LIMITS.description, `description over ${LIMITS.description} chars`);
    check(listing.features.length === source.features.length, `${listing.features.length} features, ${SOURCE_TAG} has ${source.features.length}`);
    check(listing.features.length <= LIMITS.features, `more than ${LIMITS.features} features`);
    listing.features.forEach((f, i) => check(f.length <= LIMITS.featureChars, `feature ${i + 1} over ${LIMITS.featureChars} chars`));
    check(listing.keywords.length <= LIMITS.keywords, `more than ${LIMITS.keywords} keywords`);
    listing.keywords.forEach((k, i) => check(k.length <= LIMITS.keywordChars, `keyword ${i + 1} over ${LIMITS.keywordChars} chars`));
    check(listing.keywords.join(' ').split(/\s+/).length <= LIMITS.keywordWords, `keywords over ${LIMITS.keywordWords} words`);
  }
  return problems;
}

export function parseCsv(text) {
  const { data, errors } = Papa.parse(text.replace(/^\uFEFF/, ''), { delimiter: ',', skipEmptyLines: true });
  if (errors.length) throw new Error(`malformed CSV: ${errors[0].message} (row ${errors[0].row})`);
  return data;
}

/** Writes the listings into a Partner Center export. Every text slot of their
 *  languages is rewritten, the default column included: Partner Center fills an empty
 *  language cell from it, so a stale default would resurface everywhere. */
export function fillExport(exportCsv, listings, screenshotPath) {
  const rows = parseCsv(exportCsv);
  const column = (tag) => rows[0].indexOf(tag.toLowerCase());
  const row = (field) => {
    const found = rows.find((r) => r[0] === field);
    if (!found) throw new Error(`the export has no ${field} row`);
    return found;
  };
  const slots = (prefix, count) => Array.from({ length: count }, (_, i) => row(`${prefix}${i + 1}`));

  const source = listings.find((l) => l.tag === SOURCE_TAG);
  if (!source) throw new Error(`no ${SOURCE_TAG} listing to fill the default column from`);
  const targets = [['default', source], ...listings.map((l) => [l.tag, l])].map(([tag, listing]) => ({ tag, listing, col: column(tag) }));
  for (const { tag, col } of targets) if (col < 0) throw new Error(`the export has no ${tag} column; add the language in Partner Center first`);
  const description = row('Description');
  const features = slots('Feature', LIMITS.features);
  const keywords = slots('SearchTerm', LIMITS.keywords);

  row('DesktopScreenshot1')[column('default')] = screenshotPath;
  for (const { listing, col } of targets) {
    description[col] = listing.description;
    features.forEach((r, i) => { r[col] = listing.features[i] ?? ''; });
    keywords.forEach((r, i) => { r[col] = listing.keywords[i] ?? ''; });
  }
  return `\uFEFF${Papa.unparse(rows, { newline: '\r\n' })}\r\n`;
}
