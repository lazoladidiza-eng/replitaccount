export const SUPPORTED_EXTS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".mp3", ".wav", ".m4a", ".aac", ".ogg"];
export const MAX_SIZE_MB = 500;

export const isVideo = (f: File) => 
  f.type.startsWith("video/") || 
  [".mp4", ".mov", ".avi", ".mkv", ".webm"].some(e => f.name.toLowerCase().endsWith(e));

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

export async function convertToWav(file: File, onProgress: (msg: string) => void): Promise<Blob> {
  onProgress("Uploading media for server-side audio extraction...");
  try {
    const response = await fetch("/api/audio/extract", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-filename": encodeURIComponent(file.name),
      },
      body: file,
    });

    if (!response.ok) {
      const text = await response.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed.details || parsed.error || text;
      } catch {
        // not JSON — keep raw text
      }
      throw new Error(message || `Server returned HTTP ${response.status}`);
    }

    onProgress("Audio extracted successfully...");
    return await response.blob();
  } catch (serverError) {
    if (typeof SharedArrayBuffer === "undefined" || !(window as any).crossOriginIsolated) {
      throw serverError instanceof Error
        ? serverError
        : new Error("Server-side audio extraction failed.");
    }
  }

  onProgress("Loading browser ffmpeg engine...");
  const { ff, fetchFile } = await getFFmpeg();

  onProgress("Converting to WAV in browser...");
  const inputName = "input" + file.name.slice(file.name.lastIndexOf("."));
  ff.FS("writeFile", inputName, await fetchFile(file));
  
  await ff.run(
    "-i", inputName,
    "-vn",             // strip video track
    "-acodec", "pcm_s16le",
    "-ar", "16000",    // 16kHz for ACRCloud
    "-ac", "1",        // mono
    "output.wav"
  );
  
  const data = ff.FS("readFile", "output.wav");
  
  try { ff.FS("unlink", inputName); } catch {}
  try { ff.FS("unlink", "output.wav"); } catch {}
  
  return new Blob([data.slice().buffer], { type: "audio/wav" });
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

export function extractSnippet(audioBuffer: AudioBuffer, offsetSec: number, durationSec = 10): string | null {
  const sr = audioBuffer.sampleRate;
  const start = Math.floor(offsetSec * sr);
  const end = Math.min(start + Math.floor(durationSec * sr), audioBuffer.length);
  const len = end - start;
  
  if (len <= 0) return null;
  
  const mono = new Float32Array(len);
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    const ch = audioBuffer.getChannelData(c);
    for (let i = 0; i < len; i++) {
      mono[i] += ch[start + i] / audioBuffer.numberOfChannels;
    }
  }
  
  const buf = encodeWAV(mono, sr);
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
