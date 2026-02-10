import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Simple history endpoint that returns an array of strings for now
export async function GET() {
  try {
    // Return list of chat summaries ordered by newest first
    const chats = await prisma.chat.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(chats);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load chats" }, { status: 500 });
  }
}

// Placeholder POST to "save" a new chat (stub 200)
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json().catch(() => null)) as
      | { title?: string; messages?: Array<{ role: string; content: string }> }
      | null;
    const title = (payload?.title || "Новый чат").trim() || "Новый чат";

    const chat = await prisma.chat.create({
      data: {
        title,
        ...(payload?.messages && Array.isArray(payload.messages) && payload.messages.length > 0
          ? {
              messages: {
                create: payload.messages.map((m) => ({
                  role: m.role === "assistant" ? "assistant" : "user",
                  content: m.content,
                })),
              },
            }
          : {}),
      },
      select: { id: true, title: true },
    });

    return NextResponse.json({ ok: true, id: chat.id, title: chat.title });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create chat" }, { status: 500 });
  }
}
