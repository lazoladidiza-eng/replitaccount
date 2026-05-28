import { dpsaScraper } from "./dpsa";
import { gazetteScraper } from "./gazette";
import type { RawCircular, Scraper } from "./types";

export const scrapers: Scraper[] = [dpsaScraper, gazetteScraper];

export async function runAllScrapers(): Promise<{
  circulars: RawCircular[];
  errors: string[];
}> {
  const results = await Promise.all(scrapers.map((s) => s.fetch()));
  return {
    circulars: results.flatMap((r) => r.circulars),
    errors: results.flatMap((r) => r.errors),
  };
}

export type { RawCircular, Scraper, ScrapeResult } from "./types";
