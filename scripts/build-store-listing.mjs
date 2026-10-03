// Fills a Partner Center listing export with the texts in store/microsoft/ and
// writes an import folder: listings.csv plus the screenshot it names. The
// export is the template so field IDs and columns stay Partner Center's.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillExport, listingsProblems, readListings } from './store-listing.mjs';

const SCREENSHOT = fileURLToPath(new URL('../docs/screenshot-light.png', import.meta.url));

const [exportPath, outDir] = process.argv.slice(2);
if (!exportPath || !outDir) {
  console.error('usage: pnpm store:listing <partner-center-export.csv> <out-dir>');
  process.exit(1);
}

const listings = readListings();
const problems = listingsProblems(listings);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const out = resolve(outDir);
// Partner Center's folder import takes exactly one .csv.
const strayCsv = existsSync(out) ? readdirSync(out).filter((f) => f.endsWith('.csv') && f !== 'listings.csv') : [];
if (strayCsv.length) {
  console.error(`${out} already holds ${strayCsv.join(', ')}; use an empty folder`);
  process.exit(1);
}
// Import paths start with the imported folder's own name.
const screenshot = `${basename(out)}/${basename(SCREENSHOT)}`;
const csv = fillExport(readFileSync(exportPath, 'utf8'), listings, screenshot);

mkdirSync(out, { recursive: true });
copyFileSync(SCREENSHOT, join(out, basename(SCREENSHOT)));
writeFileSync(join(out, 'listings.csv'), csv);
console.log(`Import the folder ${out} in Partner Center (Store listings > Import listings > Import folder).`);
