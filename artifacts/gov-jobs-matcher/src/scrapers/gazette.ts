import type { Scraper, ScrapeResult } from "./types";

export const gazetteScraper: Scraper = {
  source: "gazette",
  async fetch(): Promise<ScrapeResult> {
    // TODO: scrape SA Public Service Gazette listings. Source is more
    // fragmented (mix of HTML and PDF) so this will need a per-issue
    // index walker + content fetcher.
    return { circulars: [], errors: [] };
  },
};
