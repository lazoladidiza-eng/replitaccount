import type { Scraper, ScrapeResult } from "./types";

export const dpsaScraper: Scraper = {
  source: "dpsa",
  async fetch(): Promise<ScrapeResult> {
    // TODO: list weekly Public Service Vacancy Circular PDFs from
    // https://www.dpsa.gov.za/vacancies.php, dedupe against already-fetched
    // URLs (persisted in circularsTable), download new PDFs.
    return { circulars: [], errors: [] };
  },
};
