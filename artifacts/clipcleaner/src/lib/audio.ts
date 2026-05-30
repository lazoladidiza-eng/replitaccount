export const SUPPORTED_EXTS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".mp3", ".wav", ".m4a", ".aac", ".ogg"];

// The server route accepts uploads up to this size. For larger files we rely
// on the browser-side ffmpeg path so the video never leaves the device.
export const SERVER_UPLOAD_LIMIT_MB = 500;

// Hard ceiling for what the browser can plausibly handle in-memory. ffmpeg.wasm
// uses a 32-bit heap and most browsers cap WASM memory near 4 GB, but the
// file is doubled (written to ffmpeg's MEMFS + decoded), so 1.5 GB is a
// conservative ceiling that avoids OOMs on typical hardware.
export const LARGE_FILE_THRESHOLD_MB = 1500;

// Public maximum surfaced to the upload UI.
export const MAX_SIZE_MB = LARGE_FILE_THRESHOLD_MB;

export type ProgressReport = {
  message: string;
  /** 0-100, optional. When present the UI shows a progress bar. */
  percent?: number;
};

export type ProgressFn = (report: ProgressReport) => void;

export const isVideo = (f: File) =>
  f.type.startsWith("video/") ||
  [".mp4", ".mov", ".avi", ".mkv", ".webm"].some(e => f.name.toLowerCase().endsWith(e));

export const canUseBrowserFFmpeg = () =>
  typeof SharedArrayBuffer !== "undefined" && (window as any).crossOriginIsolated === true;

/**
 * True when the page is loaded inside an iframe AND not cross-origin isolated.
 * This is exactly the Replit-preview shape: our headers reach our document,
 * but the parent frame doesn't grant `cross-origin-isolated` to children, so
 * `crossOriginIsolated` is always false and the in-browser ffmpeg path can't
 * activate. Opening the page in a new tab loads it as a top-level document
 * where our headers do take effect.
 */
export function isIsolationBlockedByFrame(): boolean {
  if (typeof window === "undefined") return false;
  if ((window as any).crossOriginIsolated === true) return false;
  try {
    return window.top !== window.self;
  } catch {
    // Cross-origin access to window.top throws — that itself means we're framed.
    return true;
  }
}

let ffmpegInstance: { ff: any; fetchFile: (file: File) => Promise<Uint8Array> } | null = null;
let ffmpegLoader: Promise<{ ff: any; fetchFile: (file: File) => Promise<Uint8Array> }> | null = null;

export async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoader) return ffmpegLoader;

  ffmpegLoader = new Promise((resolve, reject) => {
    const existing = (window as any).FFmpeg;
    if (existing?.createFFmpeg && existing?.fetchFile) {
      const ff = existing.createFFmpeg({
        log: false,
        corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
      });
      ff.load().then(() => {
        ffmpegInstance = { ff, fetchFile: existing.fetchFile };
        resolve(ffmpegInstance);
      }).catch(reject);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const loaded = (window as any).FFmpeg;
      if (!loaded?.createFFmpeg || !loaded?.fetchFile) {
        reject(new Error("ffmpeg loaded, but the browser API was unavailable."));
        return;
      }

      const ff = loaded.createFFmpeg({
        log: false,
        corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
      });
      ff.load().then(() => {
        ffmpegInstance = { ff, fetchFile: loaded.fetchFile };
        resolve(ffmpegInstance);
      }).catch(reject);
    };
    script.onerror = () => reject(new Error("Could not load the ffmpeg engine."));
    document.head.appendChild(script);
  });

  return ffmpegLoader;
}

async function extractInBrowser(file: File, onProgress: ProgressFn): Promise<Blob> {
  onProgress({ message: "Preparing in-browser audio extractor…" });
  const { ff, fetchFile } = await getFFmpeg();

  ff.setProgress(({ ratio }: { ratio: number }) => {
    if (typeof ratio === "number" && ratio >= 0 && ratio <= 1) {
      onProgress({
        message: "Extracting audio on this device…",
        percent: Math.round(ratio * 100),
      });
    }
  });

  onProgress({ message: "Extracting audio on this device…", percent: 0 });
  const inputName = "input" + file.name.slice(file.name.lastIndexOf("."));
  ff.FS("writeFile", inputName, await fetchFile(file));

  try {
    await ff.run(
      "-i", inputName,
      "-vn",             // strip video track
      "-acodec", "pcm_s16le",
      "-ar", "16000",    // 16kHz for ACRCloud
      "-ac", "1",        // mono
      "output.wav",
    );

    const data = ff.FS("readFile", "output.wav");
    return new Blob([data.slice().buffer], { type: "audio/wav" });
  } finally {
    try { ff.FS("unlink", inputName); } catch {}
    try { ff.FS("unlink", "output.wav"); } catch {}
    ff.setProgress(() => {});
  }
}

function uploadWithProgress(file: File, onProgress: ProgressFn): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/audio/extract");
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    xhr.responseType = "blob";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress({
          message: "Uploading to server for audio extraction…",
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };

    xhr.upload.onload = () => {
      onProgress({ message: "Server is extracting audio…" });
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as Blob);
        return;
      }
      // Try to surface the server's JSON `details` field
      let message = `Server returned HTTP ${xhr.status}`;
      try {
        const text = await (xhr.response as Blob).text();
        const parsed = JSON.parse(text);
        message = parsed.details || parsed.error || text || message;
      } catch {
        // body was not JSON — keep the status message
      }
      reject(new Error(message));
    };

    xhr.send(file);
  });
}

async function extractOnServer(file: File, onProgress: ProgressFn): Promise<Blob> {
  onProgress({ message: "Uploading to server for audio extraction…", percent: 0 });
  const blob = await uploadWithProgress(file, onProgress);
  onProgress({ message: "Audio extracted successfully…" });
  return blob;
}

/**
 * Strategy:
 *   - Files larger than the server cap MUST extract in-browser. If the
 *     browser can't (no SharedArrayBuffer / cross-origin isolation), we
 *     surface a clear error so the UI can route to the "too large" screen.
 *   - Smaller files prefer the browser path when available (no upload),
 *     and fall back to the server when it isn't.
 */
export async function convertToWav(file: File, onProgress: ProgressFn): Promise<Blob> {
  const tooBigForServer = file.size > SERVER_UPLOAD_LIMIT_MB * 1024 * 1024;

  if (canUseBrowserFFmpeg()) {
    try {
      return await extractInBrowser(file, onProgress);
    } catch (browserErr) {
      if (tooBigForServer) throw browserErr;
      // Browser path failed for a smaller file — fall through to server.
    }
  } else if (tooBigForServer) {
    throw new Error(
      "This file is too large to upload, and your browser does not support on-device audio extraction. " +
        "Please export the audio (or a smaller video) from your editor and try again.",
    );
  }

  return extractOnServer(file, onProgress);
}

export function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };

  ws(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  ws(8, "WAVE");
  ws(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ws(36, "data");
  v.setUint32(40, samples.length * 2, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return buf;
}

// Chunked Uint8Array → base64. Avoids the per-byte `binary += String.fromCharCode(...)`
// hotspot, which is O(n²) under naive string growth and ran for every snippet.
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK))));
  }
  return btoa(parts.join(""));
}

export function extractSnippet(audioBuffer: AudioBuffer, offsetSec: number, durationSec = 10): string | null {
  const sr = audioBuffer.sampleRate;
  const start = Math.floor(offsetSec * sr);
  const end = Math.min(start + Math.floor(durationSec * sr), audioBuffer.length);
  const len = end - start;

  if (len <= 0) return null;

  const channels = audioBuffer.numberOfChannels;
  const mono = new Float32Array(len);
  for (let c = 0; c < channels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < len; i++) {
      mono[i] += ch[start + i] / channels;
    }
  }

  const buf = encodeWAV(mono, sr);
  return uint8ToBase64(new Uint8Array(buf));
}
