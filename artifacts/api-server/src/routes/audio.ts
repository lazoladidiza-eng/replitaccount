import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import express, { Router, type IRouter } from "express";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
const maxUploadBytes = 500 * 1024 * 1024;
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

function getSafeExtension(fileName: string | undefined) {
  const extension = extname(fileName ?? "").toLowerCase();
  return allowedExtensions.has(extension) ? extension : ".bin";
}

router.post(
  "/audio/extract",
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
    const outputPath = join(workingDir, "output.wav");

    try {
      await writeFile(inputPath, body);
      req.log.info({ bytes: body.length, extension }, "Extracting media audio");

      await execFileAsync(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          inputPath,
          "-vn",
          "-acodec",
          "pcm_s16le",
          "-ar",
          "16000",
          "-ac",
          "1",
          outputPath,
        ],
        { timeout: 300_000, maxBuffer: 2 * 1024 * 1024 },
      );

      const wav = await readFile(outputPath);
      res.setHeader("content-type", "audio/wav");
      res.setHeader("cache-control", "no-store");
      res.send(wav);
    } catch (error) {
      req.log.error({ err: error }, "Audio extraction failed");
      res.status(500).json({
        error: "Audio extraction failed",
        details:
          error instanceof Error
            ? error.message
            : "The server could not extract audio from this file.",
      });
    } finally {
      await rm(workingDir, { recursive: true, force: true });
    }
  },
);

export default router;