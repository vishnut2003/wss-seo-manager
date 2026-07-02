import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, runTool } from "./tools";

/**
 * The SEO Manager chatbot's tool-use loop. Runs Claude with the read-only
 * connector tools, streaming text back to the caller and executing tool calls
 * server-side between turns. Server-only.
 */

const MODEL = process.env.CLAUDE_CHAT_MODEL || "claude-sonnet-5";
const MAX_TURNS = 6; // safety cap on tool round-trips per user message
const MAX_TOKENS = 2048;

export interface ProjectContext {
  name: string;
  domain: string;
}

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

/** Friendly labels for the tool-status line shown in the UI. */
const TOOL_LABELS: Record<string, string> = {
  get_project_overview: "Reviewing project performance…",
  get_search_console_detail: "Checking Google Search Console…",
  get_analytics_detail: "Checking Google Analytics…",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? "Fetching data…";
}

export function buildSystemPrompt(project: ProjectContext): string {
  return [
    `You are the SEO Manager for the project "${project.name}" (${project.domain}), a friendly, sharp SEO analyst embedded in the WSS SEO Manager dashboard.`,
    ``,
    `You can pull LIVE data for THIS project using your tools, which read from the project's connected Google Search Console and Google Analytics accounts. Use them whenever a question could be answered with real numbers — do not guess or rely on memory.`,
    ``,
    `Guidelines:`,
    `- Ground every claim in tool data. Call get_project_overview first for broad "how are we doing" questions; use the detail tools for specific keyword/traffic/window questions.`,
    `- If a tool reports a status other than "ok" (e.g. "not-connected", "no-property", or "reconnect"), tell the user plainly that the connector needs attention and which one — never invent numbers.`,
    `- Cite concrete figures and month-over-month movement. Round sensibly (e.g. CTR as a %, avg position to one decimal).`,
    `- Be concise and scannable: a short headline, then tight bullets. This is a busy account manager reading on a dashboard.`,
    `- You are READ-ONLY. You can analyze and recommend, but you cannot change settings, budgets, or campaigns. If asked to make a change, explain what you'd recommend and that it must be done manually.`,
    `- Stay scoped to this project. Format replies in GitHub-flavored Markdown.`,
  ].join("\n");
}

/**
 * Streams a full assistant turn (including any tool round-trips) as a sequence
 * of events. Yields text deltas as they arrive, a `tool` event when a tool is
 * invoked, and a final `done` event with the complete assistant text (for
 * persistence). Throws only on unrecoverable setup errors.
 */
export async function* streamChat({
  projectId,
  system,
  messages,
}: {
  projectId: string;
  system: string;
  messages: Anthropic.MessageParam[];
}): AsyncGenerator<ChatEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    yield { type: "error", message: "Assistant is not configured." };
    return;
  }

  const client = new Anthropic({ apiKey });
  const convo: Anthropic.MessageParam[] = [...messages];
  let fullText = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools: TOOLS,
      messages: convo,
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text;
        yield { type: "text", delta: event.delta.text };
      } else if (
        event.type === "content_block_start" &&
        event.content_block.type === "tool_use"
      ) {
        yield { type: "tool", name: event.content_block.name };
      }
    }

    const final = await stream.finalMessage();

    if (final.stop_reason !== "tool_use") {
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type === "tool_use") {
        const result = await runTool(
          projectId,
          block.name,
          (block.input ?? {}) as Record<string, unknown>
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    convo.push({ role: "assistant", content: final.content });
    convo.push({ role: "user", content: toolResults });
  }

  yield { type: "done", text: fullText.trim() };
}
