"use client";

import { useEffect, useRef, useState } from "react";
import { sendChatStream, type ChatMessage, getChatById, createChat, addMessage } from "@/lib/chatClient";

export default function ChatArea({ selectedChatId, onChatId }: { selectedChatId?: string; onChatId?: (id: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const currentChatIdRef = useRef<string | undefined>(undefined);
  const skipNextLoadRef = useRef<boolean>(false);

  const scrollToBottom = () => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    // Auto-scroll when messages change (e.g., on load or streaming)
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const load = async () => {
      if (!selectedChatId) {
        // Start a new unsaved chat: clear local state and chatId ref
        setMessages([]);
        setInput("");
        setError(null);
        currentChatIdRef.current = undefined;
        return;
      }

      // If we just created a new chat locally and set selectedChatId from here,
      // skip the immediate reload from server to avoid wiping the optimistic UI
      if (skipNextLoadRef.current && selectedChatId === currentChatIdRef.current) {
        skipNextLoadRef.current = false;
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const chat = await getChatById(selectedChatId);
        const mapped: ChatMessage[] = chat.messages.map((m) => ({ role: m.role, content: m.content }));
        setMessages(mapped);
        currentChatIdRef.current = chat.id;
        setTimeout(scrollToBottom, 0);
      } catch (e: any) {
        setError(e?.message || "Failed to load chat");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedChatId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text } as ChatMessage];
    // Optimistically add an empty assistant message to stream into
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      // Ensure we have a chatId and persist user message
      let chatId = currentChatIdRef.current;
      if (!chatId) {
        const title = text.slice(0, 60) || "Новый чат";
        const created = await createChat(title);
        chatId = created.id;
        currentChatIdRef.current = chatId;
        onChatId?.(chatId);
        // Prevent the next useEffect(load) from refetching and clearing optimistic UI
        skipNextLoadRef.current = true;
      }
      await addMessage(chatId!, { role: "user", content: text });

      // Stream tokens into the last assistant message; backend will persist assistant on done
      await sendChatStream(nextMessages, (token: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          // Find last assistant message
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "assistant") {
              updated[i] = { ...updated[i], content: updated[i].content + token };
              break;
            }
          }
          return updated;
        });
      }, { chatId: chatId! });
    } catch (e: any) {
      setError(e?.message || "Failed to send message");
      // Remove the empty assistant bubble on error
      setMessages((prev) => prev.filter((_, idx) => idx !== prev.length - 1));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl grow flex-col p-4 min-h-0">
      <h1 className="mb-4 text-xl font-semibold">Simple Chat</h1>

      {/* Messages area */}
      <div
        ref={messagesRef}
        className="flex grow min-h-0 flex-col gap-3 overflow-auto rounded-lg border border-black/[.08] p-3 dark:border-white/[.145] bg-white dark:bg-zinc-900"
      >
        {messages.length === 0 && !loading && !error && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Начните диалог ниже…</p>
        )}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={
              m.role === "user"
                ? "self-end max-w-[85%] rounded-2xl bg-zinc-900 text-white px-4 py-2 dark:bg-zinc-200 dark:text-black"
                : "self-start max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-2 dark:bg-zinc-800"
            }
          >
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
          </div>
        ))}
        {/* Subtle streaming indicator */}
        {loading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
          <div className="self-start text-xs text-zinc-500 dark:text-zinc-400">Стрим…</div>
        )}
        {error && (
          <div className="self-center rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Напишите сообщение…"
          className="h-12 grow rounded-full border border-black/[.08] bg-white px-4 outline-none ring-0 transition focus:border-black/20 dark:border-white/[.145] dark:bg-zinc-900 dark:focus:border-white/30"
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="h-12 shrink-0 rounded-full bg-black px-5 text-white transition disabled:opacity-50 dark:bg-white dark:text-black"
        >
          Отправить
        </button>
      </div>
    </main>
  );
}
