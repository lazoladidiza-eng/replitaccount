import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(HERE, "../../fixtures/circulars");
const DPSA_INDEX = "https://www.dpsa.gov.za/dpsa2g/vacancies.asp";
const MAX_TO_FETCH = Number(process.env["MAX_CIRCULARS"] ?? "2");
const USER_AGENT =
  "Mozilla/5.0 (compatible; gov-jobs-matcher/0.1; +https://github.com/lazoladidiza-eng/replitaccount)";

async function main(): Promise<void> {
  await mkdir(FIXTURES_DIR, { recursive: true });

  console.log(`Fetching index: ${DPSA_INDEX}`);
  const indexRes = await fetch(DPSA_INDEX, { headers: { "user-agent": USER_AGENT } });
  if (!indexRes.ok) {
    throw new Error(
      `Failed to load DPSA vacancies page (HTTP ${indexRes.status}). ` +
        `Either the page moved or outbound network is blocked. Drop PDFs in ${FIXTURES_DIR} manually instead.`,
    );
  }
  const html = await indexRes.text();
  const $ = cheerio.load(html);

  const pdfUrls = new Set<string>();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    if (!href.toLowerCase().endsWith(".pdf")) return;
    if (!/circular/i.test(href + " " + $(a).text())) return;
    const abs = new URL(href, DPSA_INDEX).toString();
    pdfUrls.add(abs);
  });

  if (pdfUrls.size === 0) {
    throw new Error(
      `No circular PDF links found on ${DPSA_INDEX}. The page layout may have changed. ` +
        `Drop PDFs in ${FIXTURES_DIR} manually.`,
    );
  }

  const picks = Array.from(pdfUrls).slice(0, MAX_TO_FETCH);
  console.log(`Found ${pdfUrls.size} circular PDFs, downloading ${picks.length}`);

  for (const url of picks) {
    const fileName = sanitizeFileName(url.split("/").pop() ?? "circular.pdf");
    const dest = path.join(FIXTURES_DIR, fileName);
    console.log(`  ↓ ${url} → ${path.relative(process.cwd(), dest)}`);
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    if (!res.ok) {
      console.warn(`    skipped (HTTP ${res.status})`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
  }

  console.log("done");
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
