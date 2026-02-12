import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response("Missing OPENAI_API_KEY", { status: 500 });
  }

  // Parse incoming body
  const body = (await req.json().catch(() => ({}))) as {
    messages?: ChatMessage[];
    prompt?: string;
    chatId?: string; // optional chat id to persist assistant message
  };

  const userMessages: ChatMessage[] = (body?.messages ?? []).filter(
    (m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")
  );

  const messages: ChatMessage[] = [
    { role: "system", content: "You are a helpful assistant." },
    ...userMessages,
  ];
  if (body?.prompt) messages.push({ role: "user", content: body.prompt });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Call OpenAI with streaming enabled
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!aiRes.ok || !aiRes.body) {
    const text = await aiRes.text().catch(() => "");
    return new Response(`OpenAI error: ${text || aiRes.statusText}`, { status: aiRes.status || 500 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");

  // Transform OpenAI's SSE into a simplified SSE with just { delta } chunks
  let assistantBuffer = "";

  // PII detection helpers (server-side during stream)
  type PiiSpan = { start: number; end: number; type?: string };

  const detectPIISpans = async (text: string): Promise<PiiSpan[]> => {
    if (!text) return [];
    try {
      const system =
        "You detect Personally Identifiable Information (PII) in a given text. " +
        "Return a strict JSON object with the field 'spans' as an array of spans. " +
        "Each span is { start: number, end: number, type: string }. " +
        "Offsets are 0-based, end is exclusive, and MUST match the exact characters in the input. " +
        "Detect emails, phone numbers, credit cards, SSNs, national IDs, IBANs, addresses, names if clearly personal, and other PII. " +
        "If nothing found, return {\\\"spans\\\": []}. No extra commentary.";

      const user = `Text:\n${text}`;
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return [];
      const content = data?.choices?.[0]?.message?.content ?? "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { parsed = {}; }
      const spans = Array.isArray(parsed?.spans) ? parsed.spans : [];
      const clean = spans
        .map((s: any) => ({ start: Number(s?.start ?? -1), end: Number(s?.end ?? -1), type: String(s?.type ?? "pii") }))
        .filter((s: any) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.end > s.start && s.end <= text.length);
      return clean;
    } catch {
      return [];
    }
  };

  // Absolute PII spans for assistantBuffer
  let piiSpansAbs: Array<{ start: number; end: number; type?: string }> = [];
  let detectInFlight = false;
  let lastDetectPos = 0;

  const mergeSpans = (spans: Array<{ start: number; end: number; type?: string }>) => {
    if (!spans.length) return spans;
    const sorted = [...spans].sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number; type?: string }> = [];
    for (const s of sorted) {
      const last = merged[merged.length - 1];
      if (!last || s.start > last.end) merged.push({ ...s });
      else if (s.end > last.end) last.end = s.end;
    }
    return merged;
  };

  const scheduleDetect = () => {
    if (detectInFlight) return;
    const curLen = assistantBuffer.length;
    // Only run when we have meaningful new content
    if (curLen - lastDetectPos < 120) return;
    detectInFlight = true;
    const windowStart = Math.max(0, curLen - 800);
    const windowText = assistantBuffer.slice(windowStart);
    detectPIISpans(windowText)
      .then((spans) => {
        // Map window-relative spans to absolute positions
        const mapped = spans.map((s) => ({ start: s.start + windowStart, end: s.end + windowStart, type: s.type }));
        // Keep existing spans that end before windowStart and merge with new ones
        const kept = piiSpansAbs.filter((s) => s.end <= windowStart);
        piiSpansAbs = mergeSpans([...kept, ...mapped]);
        lastDetectPos = curLen;
      })
      .finally(() => {
        detectInFlight = false;
      });
  };

  const persistAssistant = async () => {
    try {
      const id = body?.chatId;
      const text = assistantBuffer.trim();
      if (!id || !text) return;
      await prisma.message.create({
        data: { chatId: id, role: "assistant", content: text },
      });
    } catch {
      // ignore persistence errors to avoid breaking stream
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: any) => {
        const s = `data: ${JSON.stringify(obj)}\n\n`;
        controller.enqueue(encoder.encode(s));
      };

      // Optional: initial event
      send({ ready: true });

      const reader = aiRes.body!.getReader();
      let buffer = "";

      const pump = (): any =>
        reader.read().then(({ value, done }) => {
          if (done) {
            // Reader finished (connection closed) — persist accumulated content then finish
            Promise.resolve(persistAssistant()).finally(() => {
              send({ done: true });
              controller.close();
            });
            return;
          }
          buffer += decoder.decode(value, { stream: true });

          // OpenAI sends SSE as lines beginning with 'data: '
          const parts = buffer.split("\n\n");
          // Keep last partial chunk in buffer
          buffer = parts.pop() || "";

          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              
              if (!trimmed.startsWith("data:")) continue;
              const jsonPart = trimmed.slice(5).trim();
              
              if (jsonPart === "[DONE]") {
                // OpenAI signaled completion — persist and finish
                Promise.resolve(persistAssistant()).finally(() => {
                  send({ done: true });
                  controller.close();
                });
                return;
              }
              
              try {
                const parsed = JSON.parse(jsonPart);
                const delta: string = parsed?.choices?.[0]?.delta?.content ?? "";
                if (delta) {
                  const startPos = assistantBuffer.length;
                  assistantBuffer += delta;
                  const endPos = startPos + delta.length;
                  const isPII = piiSpansAbs.some((s) => endPos > s.start && startPos < s.end);
                  // Send delta with a 'pii' flag for client-side highlighting
                  send({ type: "delta", delta, pii: isPII === true });
                  // Periodically schedule background PII detection on trailing window
                  scheduleDetect();
                }
              } catch {
                // Ignore JSON parse errors for non-JSON control frames
              }
            }
          }
          return pump();
        }).catch((err) => {
          send({ error: err?.message || "stream error" });
          controller.error(err);
        });

      pump();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // CORS as needed (same-origin default in Next)
    },
  });
}
