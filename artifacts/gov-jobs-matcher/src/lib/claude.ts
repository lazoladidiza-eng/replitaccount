import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod/v4";

export const DEFAULT_MODEL = "claude-sonnet-4-6";

let cachedClient: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required. Set it in your environment before running the pipeline.",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export interface ExtractOptions<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  model?: string;
  maxTokens?: number;
}

export async function extractJson<T>(opts: ExtractOptions<T>): Promise<T> {
  const client = getClaudeClient();
  const response = await client.messages.create({
    model: opts.model ?? DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((b) => b.text)
    .join("");

  const json = extractJsonBlock(text);
  return opts.schema.parse(json);
}

function extractJsonBlock(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const trimmed = candidate.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in model output: ${text.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}
