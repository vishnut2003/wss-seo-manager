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

/**
 * A file to hand to the model alongside the prompt. `image` reads pictures,
 * `document` reads PDFs — both fetched by URL (e.g. a public Blob URL). Plain
 * text should be inlined into the prompt string by the caller instead.
 */
export interface SummaryAttachment {
  kind: "image" | "document";
  url: string;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "document"; source: { type: "url"; url: string } };

export async function summarize(
  prompt: string,
  {
    maxTokens = 1024,
    attachments = [],
  }: { maxTokens?: number; attachments?: SummaryAttachment[] } = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY environment variable");
  }

  const attachmentBlocks: ContentBlock[] = attachments.map((a) => ({
    type: a.kind,
    source: { type: "url", url: a.url },
  }));
  // Attachments first, then the instruction text — Anthropic reads content in order.
  const content: ContentBlock[] = [
    ...attachmentBlocks,
    { type: "text", text: prompt },
  ];

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
      messages: [{ role: "user", content }],
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
