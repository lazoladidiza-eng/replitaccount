import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Cross-origin isolation is required for SharedArrayBuffer, which the
// in-browser audio extractor (ffmpeg.wasm) depends on. Setting these
// headers on the SPA shell is what lets the browser path activate in
// production; without them, requests fall back to the server upload
// path that has a 500 MB ceiling.
const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Resource-Policy": "same-origin",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const here = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(here, "dist/public");
const indexFile = join(publicDir, "index.html");

async function readIndex() {
  try {
    return await readFile(indexFile);
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  for (const [name, value] of Object.entries(ISOLATION_HEADERS)) {
    res.setHeader(name, value);
  }

  const url = (req.url ?? "/").split("?")[0];
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD" });
    res.end("Method Not Allowed");
    return;
  }

  let pathname = decodeURIComponent(url);
  if (pathname.endsWith("/")) pathname += "index.html";

  const candidate = resolve(publicDir, "." + pathname);
  if (!candidate.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(candidate);
    const ext = extname(candidate).toLowerCase();
    res.setHeader("content-type", MIME[ext] ?? "application/octet-stream");
    res.setHeader(
      "cache-control",
      ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    );
    res.writeHead(200);
    res.end(data);
    return;
  } catch {
    // SPA fallback — any unknown path returns the shell so client-side routing can pick it up.
    const shell = await readIndex();
    if (!shell) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "no-cache");
    res.writeHead(200);
    res.end(shell);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`ClipCleaner serving ${publicDir} on port ${port}`);
});
