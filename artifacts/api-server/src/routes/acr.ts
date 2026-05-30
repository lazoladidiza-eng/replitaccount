import { createHmac } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  GetAcrStatusResponse,
  IdentifyAudioWindowBody,
  IdentifyAudioWindowResponse,
  ListReplacementTracksResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const replacementTracks = [
  {
    id: "summer-breeze",
    title: "Summer Breeze",
    artist: "Chill Wave",
    mood: "Upbeat",
    duration: "3:24",
    bestFor: "Lifestyle vlogs, travel montages, and warm intros",
  },
  {
    id: "urban-drive",
    title: "Urban Drive",
    artist: "Metro Beats",
    mood: "Energetic",
    duration: "2:58",
    bestFor: "Fast edits, city clips, and creator recaps",
  },
  {
    id: "soft-morning",
    title: "Soft Morning",
    artist: "Ambient Lab",
    mood: "Calm",
    duration: "4:12",
    bestFor: "Tutorials, study content, and reflective scenes",
  },
  {
    id: "epic-horizon",
    title: "Epic Horizon",
    artist: "Cinematic Co",
    mood: "Dramatic",
    duration: "3:45",
    bestFor: "Reveals, launches, and documentary-style moments",
  },
  {
    id: "late-night-groove",
    title: "Late Night Groove",
    artist: "Jazz Factory",
    mood: "Smooth",
    duration: "3:10",
    bestFor: "Talking-head edits, outros, and lower-third beds",
  },
];

function getAcrConfig() {
  const host =
    process.env.ACR_HOST ??
    process.env.ACRCLOUD_HOST ??
    "identify-eu-west-1.acrcloud.com";
  const accessKey =
    process.env.ACR_ACCESS_KEY ?? process.env.ACRCLOUD_ACCESS_KEY;
  const accessSecret =
    process.env.ACR_ACCESS_SECRET ?? process.env.ACRCLOUD_ACCESS_SECRET;

  return {
    host,
    accessKey,
    accessSecret,
    configured: Boolean(host && accessKey && accessSecret),
  };
}

function signRequest(signatureSource: string, secret: string) {
  return createHmac("sha1", secret).update(signatureSource).digest("base64");
}

router.get("/acr/status", (_req, res) => {
  const config = getAcrConfig();
  const data = GetAcrStatusResponse.parse({
    configured: config.configured,
    host: config.host,
    message: config.configured
      ? "ACRCloud is configured and ready for live scans."
      : "ACRCloud credentials are not configured yet. Add ACR_ACCESS_KEY and ACR_ACCESS_SECRET as environment secrets to enable live scans.",
  });

  res.json(data);
});

router.post("/acr/identify", async (req, res): Promise<void> => {
  const parsed = IdentifyAudioWindowBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid identify body");
    res.status(400).json({ error: "Invalid scan request", details: parsed.error.message });
    return;
  }

  const config = getAcrConfig();
  if (!config.configured || !config.accessKey || !config.accessSecret) {
    res.status(503).json({
      error: "ACRCloud is not configured",
      details:
        "Add ACR_ACCESS_KEY and ACR_ACCESS_SECRET as environment secrets before running live scans.",
    });
    return;
  }

  const sample = Buffer.from(parsed.data.sampleBase64, "base64");
  if (sample.length === 0) {
    res.status(400).json({ error: "Invalid scan request", details: "Sample audio is empty." });
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureSource = [
    "POST",
    "/v1/identify",
    config.accessKey,
    "audio",
    "1",
    timestamp,
  ].join("\n");

  const formData = new FormData();
  formData.append("sample", new Blob([sample], { type: "audio/wav" }), "sample.wav");
  formData.append("access_key", config.accessKey);
  formData.append("data_type", "audio");
  formData.append("signature_version", "1");
  formData.append("signature", signRequest(signatureSource, config.accessSecret));
  formData.append("timestamp", timestamp);

  try {
    const response = await fetch(`https://${config.host}/v1/identify`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      req.log.warn({ status: response.status }, "ACRCloud HTTP error");
      res.status(503).json({
        error: "ACRCloud request failed",
        details: `ACRCloud returned HTTP ${response.status}.`,
      });
      return;
    }

    type AcrTrack = {
      title?: string;
      artists?: Array<{ name?: string }>;
      album?: { name?: string };
      label?: string;
      score?: number;
      acrid?: string;
    };
    type AcrResponse = {
      status?: { code?: number; msg?: string };
      metadata?: { music?: AcrTrack[] };
    };
    const result = (await response.json()) as AcrResponse;
    const track = result?.metadata?.music?.[0];
    const data = IdentifyAudioWindowResponse.parse({
      windowIndex: parsed.data.windowIndex,
      offsetSeconds: parsed.data.offsetSeconds,
      durationSeconds: parsed.data.durationSeconds,
      matched: Boolean(result?.status?.code === 0 && track),
      statusCode: Number(result?.status?.code ?? -1),
      statusMessage: String(result?.status?.msg ?? "Unknown response"),
      title: track?.title,
      artist: track?.artists?.[0]?.name,
      album: track?.album?.name,
      label: track?.label,
      score: track?.score,
      acrId: track?.acrid,
    });

    res.json(data);
  } catch (error) {
    req.log.error({ err: error }, "ACRCloud request failed");
    res.status(503).json({
      error: "ACRCloud request failed",
      details: error instanceof Error ? error.message : "Unknown network error",
    });
  }
});

router.get("/replacement-tracks", (_req, res) => {
  res.json(ListReplacementTracksResponse.parse(replacementTracks));
});

export default router;