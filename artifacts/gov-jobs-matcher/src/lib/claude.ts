// Anthropic SDK wrapper. Stubbed until @anthropic-ai/sdk is added in the
// matcher/parser phases. Default model: claude-sonnet-4-6.

export interface ClaudeConfig {
  apiKey: string;
  model: string;
}

export function getClaudeConfig(): ClaudeConfig | null {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-6",
  };
}
