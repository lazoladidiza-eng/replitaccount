export interface RawCircular {
  source: "dpsa" | "gazette";
  sourceUrl: string;
  fetchedAt: string;
  contentType: "pdf" | "html";
  bytes: Buffer;
}

export interface ScrapeResult {
  circulars: RawCircular[];
  errors: string[];
}

export interface Scraper {
  source: "dpsa" | "gazette";
  fetch(): Promise<ScrapeResult>;
}
