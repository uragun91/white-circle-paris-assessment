import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await (params as Promise<{ id: string }>);
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing chat id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as
      | { role?: string; content?: string }
      | null;
    const role = body?.role === "assistant" ? "assistant" : "user";
    const content = (body?.content || "").toString();
    if (!content) {
      return new Response(JSON.stringify({ error: "Content is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ensure chat exists
    const chat = await prisma.chat.findUnique({ where: { id }, select: { id: true } });
    if (!chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const msg = await prisma.message.create({
      data: { chatId: id, role, content },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return new Response(JSON.stringify({ ok: true, message: msg }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Failed to add message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
