"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  History,
  Loader2,
  Sparkles,
  SquarePen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AssistantMessage, type ChatMessage } from "./assistant-message";

const SUGGESTIONS = [
  "How is organic search doing this month?",
  "What are my top search queries?",
  "Which pages get the most traffic?",
];

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export function AssistantPanel({
  projectId,
  projectName,
  open,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadedRef = useRef(false);
  const conversationId = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const endpoint = `/api/projects/${projectId}/assistant`;

  // Load the caller's most recent thread the first time the panel opens.
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) return;
        const data = (await res.json()) as {
          conversationId: string | null;
          messages: ChatMessage[];
        };
        conversationId.current = data.conversationId;
        if (data.messages.length) setMessages(data.messages);
      } catch {
        // Non-fatal: start with an empty thread.
      }
    })();
  }, [open, endpoint]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText, toolStatus]);

  const newChat = useCallback(() => {
    if (busy) return;
    conversationId.current = null;
    setMessages([]);
    setStreamText("");
    setToolStatus(null);
    setInput("");
  }, [busy]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${endpoint}?list=1`);
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: ConversationSummary[] };
      setHistory(data.conversations);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [endpoint]);

  const openConversation = useCallback(
    async (id: string) => {
      if (busy) return;
      setHistoryOpen(false);
      try {
        const res = await fetch(
          `${endpoint}?conversationId=${encodeURIComponent(id)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          conversationId: string | null;
          messages: ChatMessage[];
        };
        conversationId.current = data.conversationId;
        setMessages(data.messages);
        setStreamText("");
        setToolStatus(null);
      } catch {
        // Non-fatal.
      }
    },
    [busy, endpoint]
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;

      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setInput("");
      setBusy(true);
      setStreamText("");
      setToolStatus(null);

      let assembled = "";
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conversationId.current,
            message,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(await res.text().catch(() => "Request failed"));
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as {
              type: string;
              delta?: string;
              label?: string;
              message?: string;
              conversationId?: string;
            };
            if (ev.type === "meta" && ev.conversationId) {
              conversationId.current = ev.conversationId;
            } else if (ev.type === "text" && ev.delta) {
              assembled += ev.delta;
              setToolStatus(null);
              setStreamText(assembled);
            } else if (ev.type === "tool" && ev.label) {
              setToolStatus(ev.label);
            } else if (ev.type === "error") {
              assembled +=
                (assembled ? "\n\n" : "") +
                (ev.message ?? "Something went wrong.");
              setStreamText(assembled);
            }
          }
        }
      } catch {
        assembled =
          assembled ||
          "Sorry — I couldn't reach the assistant. Please try again.";
      } finally {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assembled || "(no response)" },
        ]);
        setStreamText("");
        setToolStatus(null);
        setBusy(false);
      }
    },
    [busy, endpoint]
  );

  const showEmptyState = messages.length === 0 && !busy;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 bg-linear-to-br from-primary to-purple-900 p-4 pr-12 text-white">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium">SEO Manager</p>
          <p className="truncate text-xs text-white/80">{projectName}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={newChat}
            disabled={busy}
            aria-label="New chat"
            title="New chat"
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <SquarePen className="size-4" />
          </Button>
          <Popover
            open={historyOpen}
            onOpenChange={(o) => {
              setHistoryOpen(o);
              if (o) loadHistory();
            }}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                aria-label="Conversation history"
                title="History"
                className="text-white hover:bg-white/15 hover:text-white"
              >
                <History className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-1.5">
              <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Recent conversations
              </p>
              <div className="max-h-72 overflow-y-auto">
                {historyLoading ? (
                  <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading…
                  </div>
                ) : history.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    No past conversations yet.
                  </p>
                ) : (
                  history.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openConversation(c.id)}
                      className={cn(
                        "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-purple-50",
                        c.id === conversationId.current && "bg-purple-50"
                      )}
                    >
                      <span className="line-clamp-1 text-sm text-foreground">
                        {c.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(c.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="flex flex-col gap-4 py-4">
          {showEmptyState && (
            <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
              <p className="text-sm font-medium text-foreground">
                Hi! I&apos;m your SEO Manager for {projectName}.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask me about search performance, traffic, top queries or pages —
                I&apos;ll pull live data from your connected sources.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-xl border border-purple-100 bg-white px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-purple-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <AssistantMessage key={i} role={m.role} content={m.content} />
          ))}

          {streamText && (
            <AssistantMessage role="assistant" content={streamText} />
          )}

          {busy && !streamText && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>{toolStatus ?? "Thinking…"}</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-purple-100 p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="relative"
        >
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about this project…"
            rows={1}
            disabled={busy}
            className="max-h-32 resize-none rounded-2xl border-purple-100 pr-11"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={busy || !input.trim()}
            className={cn(
              "absolute right-2 bottom-2 rounded-full",
              "bg-linear-to-br from-primary to-purple-900 shadow-sm shadow-primary/30"
            )}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
        <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
          <Sparkles className="size-3" />
          Read-only · answers from live connector data
        </p>
      </div>
    </div>
  );
}
