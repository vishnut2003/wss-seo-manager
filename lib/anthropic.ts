/**
 * Minimal Anthropic Messages API client (native fetch). Server-only.
 * Used to turn structured connector metrics into a human-readable digest.
 */

const MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5";
const ANTHROPIC_VERSION = "2023-06-01";

interface MessagesResponse {
  content?: { type: string; text?: string }[];
}

export async function summarize(
  prompt: string,
  { maxTokens = 1024 }: { maxTokens?: number } = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable");
  }

  const res = await fetch(MESSAGES_ENDPOINT, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status})`);
  }

  const data = (await res.json()) as MessagesResponse;
  const text = data.content
    ?.map((block) => block.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Anthropic API returned an empty response");
  }
  return text;
}
