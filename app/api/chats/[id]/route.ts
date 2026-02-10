import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await (params as Promise<{ id: string }>);
    if (!id || typeof id !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid or missing id parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, role: true, content: true, createdAt: true },
        },
      },
    });

    if (!chat) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(JSON.stringify({
      id: chat.id,
      title: chat.title,
      messages: chat.messages,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Failed to fetch chat" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
