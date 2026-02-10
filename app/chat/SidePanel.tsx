"use client";

import { useEffect, useState } from "react";
import { getChatHistory, type ChatSummary } from "@/lib/chatClient";

export default function SidePanel({ onSelect, refreshTick }: { onSelect: (id?: string) => void; refreshTick?: number }) {
  const [items, setItems] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getChatHistory();
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Reload history when parent signals that chats changed (e.g., a new chat was created)
  useEffect(() => {
    if (typeof refreshTick !== "number") return;
    load();
  }, [refreshTick]);

  return (
    <aside className="flex h-full min-h-0 w-72 flex-col border-r border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">История чатов</h2>
        <button
          onClick={() => onSelect(undefined)}
          className="h-7 w-7 rounded-md border border-black/[.08] text-lg leading-6 text-zinc-700 transition hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-200 dark:hover:bg-[#1a1a1a]"
          title="Новый чат"
          aria-label="Новый чат"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && (
          <p className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">Загрузка…</p>
        )}
        {error && (
          <p className="px-4 py-2 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">Нет сохраненных чатов</p>
        )}
        <ul className="space-y-1 px-2 pb-3">
          {items.map((c, i) => (
            <li key={`${c.id}-${i}`} className="">
              <button
                className="w-full truncate rounded-md px-3 py-2 text-left text-sm text-zinc-800 hover:bg-black/[.04] dark:text-zinc-200 dark:hover:bg-[#1a1a1a]"
                title={c.title}
                onClick={() => onSelect(c.id)}
              >
                {c.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
