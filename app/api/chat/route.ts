import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY on server" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as { messages?: ChatMessage[]; prompt?: string };
    const userMessages: ChatMessage[] = (body?.messages ?? []).filter(
      (m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")
    );

    // Build message list (avoid literal type widening issues)
    const messages: ChatMessage[] = [
      { role: "system", content: "You are a helpful assistant." },
      ...userMessages,
    ];
    if (body?.prompt) {
      messages.push({ role: "user", content: body.prompt });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

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
        stream: false,
      }),
    });

    const data = await aiRes.json().catch(() => ({}));

    if (!aiRes.ok) {
      const msg = data?.error?.message || `OpenAI request failed (${aiRes.status})`;
      return NextResponse.json({ error: msg }, { status: aiRes.status });
    }

    const reply: string = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
