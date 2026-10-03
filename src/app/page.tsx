"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { role: "user" | "model"; text: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history: Message[] = [...messages, { role: "user", text }];
    setMessages([...history, { role: "model", text: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(error);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "model", text: reply }]);
      }
    } catch (err) {
      setMessages([...history, { role: "model", text: `Error: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4">
      {messages.length > 0 && (
        <div className="flex justify-end pt-3">
          <button
            onClick={() => setMessages([])}
            disabled={loading}
            className="text-sm opacity-60 hover:opacity-100 disabled:opacity-30"
          >
            New chat
          </button>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <p className="mt-24 text-center opacity-50">Ask me anything to get started.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 leading-relaxed ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-black/5 dark:bg-white/10"
              }`}
            >
              {m.text || <span className="animate-pulse opacity-50">Thinking…</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-black/10 py-4 dark:border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          autoFocus
          className="flex-1 rounded-xl border border-black/15 bg-transparent px-4 py-2.5 outline-none focus:border-blue-500 dark:border-white/20"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-xl bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </main>
  );
}
