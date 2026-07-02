import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { connectDB } from "@/configs/db";
import Project from "@/models/Project";
import Conversation from "@/models/Conversation";
import { buildSystemPrompt, streamChat, toolLabel } from "@/lib/assistant/chat";

/**
 * SEO Manager chatbot endpoint, scoped to one project.
 * - POST: send a message, stream the assistant's reply (NDJSON events) while
 *   running the read-only connector tool loop. Persists the thread.
 * - GET: load a conversation (or the user's most recent one) to rehydrate the
 *   panel.
 * Manager-only (super_admin / admin), mirroring the connector handlers.
 */

export const maxDuration = 60;

const MAX_MESSAGE_LEN = 2000;

function isManager(role?: string): boolean {
  return role === "super_admin" || role === "admin";
}

/** Maps stored turns to Anthropic message params (plain text content). */
function toApiMessages(
  messages: { role: "user" | "assistant"; content: string }[]
): Anthropic.MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!isManager(session.user.role))
    return new NextResponse("Forbidden", { status: 403 });

  const { projectId } = await params;
  if (!isValidObjectId(projectId))
    return new NextResponse("Invalid project", { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    conversationId?: string;
    message?: string;
  };
  const message = (body.message ?? "").trim();
  if (!message) return new NextResponse("Empty message", { status: 400 });
  if (message.length > MAX_MESSAGE_LEN)
    return new NextResponse("Message too long", { status: 400 });

  await connectDB();

  const project = await Project.findById(projectId)
    .select("name domain")
    .lean<{ name: string; domain: string } | null>();
  if (!project) return new NextResponse("Project not found", { status: 404 });

  const userId = session.user.email ?? session.user.id ?? "unknown";

  // Load the caller's own thread, or start a new one.
  let conversation =
    body.conversationId && isValidObjectId(body.conversationId)
      ? await Conversation.findOne({ _id: body.conversationId, projectId, userId })
      : null;
  if (!conversation) {
    conversation = new Conversation({ projectId, userId, messages: [] });
  }

  conversation.messages.push({
    role: "user",
    content: message,
    createdAt: new Date(),
  });
  if (!conversation.title) {
    conversation.title = message.slice(0, 60);
  }
  await conversation.save();

  const system = buildSystemPrompt({ name: project.name, domain: project.domain });
  const apiMessages = toApiMessages(conversation.messages);
  const conversationId = String(conversation._id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      send({ type: "meta", conversationId });

      let assistantText = "";
      try {
        for await (const ev of streamChat({
          projectId,
          system,
          messages: apiMessages,
        })) {
          if (ev.type === "text") {
            assistantText += ev.delta;
            send({ type: "text", delta: ev.delta });
          } else if (ev.type === "tool") {
            send({ type: "tool", label: toolLabel(ev.name) });
          } else if (ev.type === "error") {
            send({ type: "error", message: ev.message });
          } else if (ev.type === "done") {
            assistantText = ev.text;
          }
        }
      } catch {
        send({ type: "error", message: "The assistant ran into a problem." });
      }

      if (assistantText) {
        try {
          conversation.messages.push({
            role: "assistant",
            content: assistantText,
            createdAt: new Date(),
          });
          await conversation.save();
        } catch {
          // Persistence is best-effort; the client already has the reply.
        }
      }

      send({ type: "end" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!isManager(session.user.role))
    return new NextResponse("Forbidden", { status: 403 });

  const { projectId } = await params;
  if (!isValidObjectId(projectId))
    return new NextResponse("Invalid project", { status: 400 });

  await connectDB();
  const userId = session.user.email ?? session.user.id ?? "unknown";

  // ?list=1 → recent threads for the history picker.
  if (request.nextUrl.searchParams.get("list")) {
    const items = await Conversation.find({ projectId, userId })
      .sort({ updatedAt: -1 })
      .select("title updatedAt")
      .limit(30)
      .lean<{ _id: unknown; title?: string; updatedAt: Date }[]>();
    return NextResponse.json({
      conversations: items.map((c) => ({
        id: String(c._id),
        title: c.title ?? "New conversation",
        updatedAt: c.updatedAt,
      })),
    });
  }

  const conversationId = request.nextUrl.searchParams.get("conversationId");

  const query =
    conversationId && isValidObjectId(conversationId)
      ? { _id: conversationId, projectId, userId }
      : { projectId, userId };

  const conversation = await Conversation.findOne(query)
    .sort({ updatedAt: -1 })
    .lean<{
      _id: unknown;
      messages: { role: string; content: string; createdAt: Date }[];
    } | null>();

  if (!conversation) {
    return NextResponse.json({ conversationId: null, messages: [] });
  }

  return NextResponse.json({
    conversationId: String(conversation._id),
    messages: conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
}
