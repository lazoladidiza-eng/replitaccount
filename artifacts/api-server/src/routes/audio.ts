import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import express, { Router, type IRouter, type RequestHandler } from "express";

const router: IRouter = Router();
const maxUploadBytes = 500 * 1024 * 1024;
const extractionTimeoutMs = 300_000;
const allowedExtensions = new Set([
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
]);

// Simple in-memory rate limiter for /audio/extract. The route is expensive
// (large upload + ffmpeg + tmp-disk), and the new client also retries on
// failure, so per-IP limits keep one bad client from monopolizing the box.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 6;
const rateBuckets = new Map<string, number[]>();

const rateLimit: RequestHandler = (req, res, next) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;

  // Lazy cleanup: drop expired entries on each check; bound map by key cardinality.
  const timestamps = (rateBuckets.get(key) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= RATE_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((timestamps[0] + RATE_WINDOW_MS - now) / 1000));
    res.set("retry-after", String(retryAfterSec));
    res.status(429).json({
      error: "Too many requests",
      details: `Limit is ${RATE_MAX_REQUESTS} extractions per minute. Try again in ${retryAfterSec}s.`,
    });
    return;
  }

  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  next();
};

function getSafeExtension(fileName: string | undefined) {
  const extension = extname(fileName ?? "").toLowerCase();
  return allowedExtensions.has(extension) ? extension : ".bin";
}

router.post(
  "/audio/extract",
  rateLimit,
  express.raw({
    type: ["application/octet-stream", "audio/*", "video/*"],
    limit: maxUploadBytes,
  }),
  async (req, res): Promise<void> => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Invalid upload", details: "No media file was received." });
      return;
    }

    const encodedFileName = req.get("x-filename");
    const fileName = encodedFileName ? decodeURIComponent(encodedFileName) : undefined;
    const extension = getSafeExtension(fileName);
    const workingDir = await mkdtemp(join(tmpdir(), "clipcleaner-"));
    const inputPath = join(workingDir, `input${extension}`);

    try {
      await writeFile(inputPath, body);
      req.log.info({ bytes: body.length, extension }, "Extracting media audio");

      const ffmpeg = spawn("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-threads",
        "0",
        "-i",
        inputPath,
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "wav",
        "-",
      ]);

      let stderr = "";
      let responseStarted = false;
      let processFinished = false;
      const timeout = setTimeout(() => {
        ffmpeg.kill("SIGKILL");
      }, extractionTimeoutMs);

      res.on("close", () => {
        if (!processFinished && !res.writableEnded) {
          ffmpeg.kill("SIGTERM");
        }
      });

      await new Promise<void>((resolve, reject) => {
        ffmpeg.stderr.on("data", (chunk: Buffer) => {
          stderr = `${stderr}${chunk.toString()}`.slice(-4000);
        });

        ffmpeg.stdout.once("data", (chunk: Buffer) => {
          responseStarted = true;
          res.setHeader("content-type", "audio/wav");
          res.setHeader("cache-control", "no-store");
          res.write(chunk);
          ffmpeg.stdout.pipe(res);
        });

        ffmpeg.on("error", reject);

        ffmpeg.on("close", (code, signal) => {
          processFinished = true;
          clearTimeout(timeout);
          if (code === 0) {
            resolve();
            return;
          }

          const details = stderr.trim() || `ffmpeg exited with ${signal ?? `code ${code}`}`;
          req.log.error({ code, signal, details }, "Audio extraction failed");

          if (!responseStarted && !res.headersSent) {
            res.status(500).json({ error: "Audio extraction failed", details });
            resolve();
            return;
          }

          res.destroy(new Error(details));
          resolve();
        });
      });
    } catch (error) {
      req.log.error({ err: error }, "Audio extraction failed");
      if (!res.headersSent) {
        res.status(500).json({
          error: "Audio extraction failed",
          details:
            error instanceof Error
              ? error.message
              : "The server could not extract audio from this file.",
        });
      }
    } finally {
      await rm(workingDir, { recursive: true, force: true });
    }
  },
);

export default router;
