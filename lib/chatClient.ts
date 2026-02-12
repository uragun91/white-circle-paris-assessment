export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatSummary = {
  id: string;
  title: string;
};

export async function sendChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`);
  }
  return data?.reply ?? "";
}

// Streaming chat via SSE (POST streaming)
export async function sendChatStream(
  messages: ChatMessage[],
  onToken: (token: string, isPII?: boolean) => void,
  options?: { signal?: AbortSignal; chatId?: string }
): Promise<void> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ messages, chatId: options?.chatId }),
    signal: options?.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Stream request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    console.log('Buffer:', buffer);

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";


    for (const part of parts) {
      const lines = part.split("\n");
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) { 
            continue;
        }
        
        const jsonPart = trimmed.slice(5).trim();

        if (!jsonPart) {
            continue
        };

        try {
          const obj = JSON.parse(jsonPart);
          if (obj?.delta) { 
            onToken(obj.delta as string, !!obj?.pii);
          }
          if (obj?.done) return;
        } catch (e) {
          // ignore
        }
      }
    }
  }
}

export async function getChatHistory(): Promise<ChatSummary[]> {
  const res = await fetch("/api/chats", { method: "GET" });
  if (!res.ok) throw new Error(`Failed to load history: ${res.status}`);
  const data = (await res.json().catch(() => [])) as unknown;
  if (!Array.isArray(data)) return [];
  return data as ChatSummary[];
}

export async function saveChat(payload: {
  title: string;
  messages?: ChatMessage[];
}): Promise<{ ok: boolean; id: string; received: any }> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to save chat: ${res.status}`);
  // Backward compatible shape but now returns { ok, id, title }
  return (await res.json()) as any;
}

export async function getChatById(id: string): Promise<{
  id: string;
  title: string;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: string }>;
}> {
  const res = await fetch(`/api/chats/${encodeURIComponent(id)}`, { method: "GET" });
  if (!res.ok) throw new Error(`Failed to load chat: ${res.status}`);
  const data = await res.json();
  // Normalize createdAt to ISO strings
  data.messages = (data.messages || []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date(m.createdAt).toISOString(),
  }));
  return data;
}

export async function createChat(title: string, initial?: ChatMessage[]): Promise<{ id: string; title: string }> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, messages: initial }),
  });
  if (!res.ok) throw new Error(`Failed to create chat: ${res.status}`);
  return (await res.json()) as { ok: boolean; id: string; title: string };
}

export async function addMessage(
  chatId: string,
  message: ChatMessage
): Promise<{ ok: boolean; message: { id: string } }> {
  const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (!res.ok) throw new Error(`Failed to add message: ${res.status}`);
  return (await res.json()) as any;
}

