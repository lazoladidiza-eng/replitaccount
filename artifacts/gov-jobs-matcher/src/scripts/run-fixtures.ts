import path from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseCv } from "../parser/cv";
import { parseCircular } from "../parser/posts";
import { prefilter } from "../matcher/prefilter";
import { scoreMatch } from "../matcher/score";
import { renderCvReport, type ScoredPost } from "../digest/report";
import type { CvProfile, ParsedPost } from "../lib/schemas";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const CVS_DIR = path.join(ROOT, "fixtures/cvs");
const CIRCULARS_DIR = path.join(ROOT, "fixtures/circulars");
const OUT_DIR = path.join(ROOT, "out");
const TOP_N = Number(process.env["TOP_N"] ?? "5");
const SUPPORTED_CV_EXT = new Set([".pdf", ".docx", ".txt", ".md"]);
const SUPPORTED_CIRCULAR_EXT = new Set([".pdf", ".txt", ".md"]);

async function listFiles(dir: string, allowed: Set<string>): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => allowed.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(dir, f))
    .sort();
}

interface LoadedCircular {
  filename: string;
  posts: ParsedPost[];
}

interface LoadedCv {
  filename: string;
  profile: CvProfile;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  const cvFiles = await listFiles(CVS_DIR, SUPPORTED_CV_EXT);
  const circularFiles = await listFiles(CIRCULARS_DIR, SUPPORTED_CIRCULAR_EXT);

  if (cvFiles.length === 0) {
    throw new Error(`No CVs found. Drop PDF/DOCX files into ${CVS_DIR}`);
  }
  if (circularFiles.length === 0) {
    throw new Error(
      `No circulars found. Drop PDFs into ${CIRCULARS_DIR} or run \`pnpm run fetch:sample-circulars\``,
    );
  }

  console.log(`Parsing ${cvFiles.length} CVs and ${circularFiles.length} circulars`);

  const cvs: LoadedCv[] = [];
  for (const file of cvFiles) {
    console.log(`  CV: ${path.basename(file)}`);
    const bytes = await readFile(file);
    try {
      const profile = await parseCv({ filename: path.basename(file), bytes });
      cvs.push({ filename: path.basename(file), profile });
    } catch (err) {
      console.warn(`    failed: ${describeError(err)}`);
    }
  }

  const circulars: LoadedCircular[] = [];
  for (const file of circularFiles) {
    console.log(`  Circular: ${path.basename(file)}`);
    const bytes = await readFile(file);
    try {
      const parsed = await parseCircular({ filename: path.basename(file), bytes });
      console.log(`    → ${parsed.posts.length} posts`);
      circulars.push({ filename: parsed.filename, posts: parsed.posts });
    } catch (err) {
      console.warn(`    failed: ${describeError(err)}`);
    }
  }

  const allPosts: { post: ParsedPost; sourceFile: string }[] = circulars.flatMap((c) =>
    c.posts.map((post) => ({ post, sourceFile: c.filename })),
  );

  if (allPosts.length === 0) {
    throw new Error("No posts were parsed from any circular. Cannot score.");
  }

  for (const { filename: cvFilename, profile } of cvs) {
    console.log(`\nScoring ${cvFilename} against ${allPosts.length} posts`);
    const survivors: { post: ParsedPost; sourceFile: string }[] = [];
    let filteredOut = 0;
    for (const entry of allPosts) {
      const decision = prefilter(entry.post, profile);
      if (!decision.pass) {
        filteredOut += 1;
        continue;
      }
      survivors.push(entry);
    }
    console.log(`  ${survivors.length} survivors after prefilter (${filteredOut} filtered)`);

    const scored: ScoredPost[] = [];
    for (const entry of survivors) {
      try {
        const match = await scoreMatch(entry.post, profile);
        scored.push({ post: entry.post, match, sourceFile: entry.sourceFile });
      } catch (err) {
        console.warn(`    score failed for "${entry.post.post}": ${describeError(err)}`);
      }
    }

    scored.sort((a, b) => b.match.score - a.match.score);
    const top = scored.slice(0, TOP_N);

    const markdown = renderCvReport({
      cvFilename,
      cv: profile,
      topMatches: top,
      totalCandidates: allPosts.length,
      filteredOut,
    });

    const outFile = path.join(OUT_DIR, `${path.parse(cvFilename).name}.md`);
    await writeFile(outFile, markdown);
    console.log(`  wrote ${path.relative(process.cwd(), outFile)}`);
    if (top.length) {
      console.log(`  top match: ${top[0]!.post.post} (score ${top[0]!.match.score})`);
    }
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
