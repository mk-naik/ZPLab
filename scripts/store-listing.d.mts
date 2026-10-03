// Types for the node-only listing helpers, so the test can import them under the app tsconfig.
export interface Listing {
  tag: string;
  description: string;
  features: string[];
  keywords: string[];
}
export declare const SOURCE_TAG: 'en-US';
export declare const LIMITS: Record<'description' | 'features' | 'featureChars' | 'keywords' | 'keywordChars' | 'keywordWords', number>;
export declare function readListings(): Listing[];
export declare function listingsProblems(listings: Listing[]): string[];
export declare function parseCsv(text: string): string[][];
export declare function fillExport(exportCsv: string, listings: Listing[], screenshotPath: string): string;
