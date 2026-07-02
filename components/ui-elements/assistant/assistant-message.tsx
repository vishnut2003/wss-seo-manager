"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Utility classes that style raw markdown output without a typography plugin. */
const PROSE =
  "text-sm leading-relaxed [&_p]:my-2 first:[&_p]:mt-0 last:[&_p]:mb-0 " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_li]:my-0.5 [&_strong]:font-semibold [&_strong]:text-foreground " +
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold " +
  "[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold " +
  "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold " +
  "[&_code]:rounded [&_code]:bg-purple-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.8em] " +
  "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-purple-100 [&_th]:py-1 [&_th]:text-left " +
  "[&_td]:border-b [&_td]:border-purple-50 [&_td]:py-1";

export function AssistantMessage({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-purple-900 text-white shadow-sm shadow-primary/30">
          <Sparkles className="size-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-purple-100 bg-white text-foreground shadow-sm shadow-purple-900/5"
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        ) : (
          <div className={PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
