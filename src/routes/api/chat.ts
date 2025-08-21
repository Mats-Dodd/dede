import { createServerFileRoute } from "@tanstack/react-start/server"
import { streamText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/db/connection"
import { chats, messages } from "@/db/schema"
import { eq } from "drizzle-orm"

const chatRequestSchema = z.object({
  userMessageId: z.number(),
  aiMessageId: z.number(),
  chatId: z.string(),
  content: z.string(),
})

async function handleChatRequest(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 })
    }

    const body = await request.json()
    const { userMessageId, aiMessageId, chatId, content } =
      chatRequestSchema.parse(body)

    const currentChatId = parseInt(chatId)

    // Verify user owns the chat
    const chat = await db
      .select()
      .from(chats)
      .where(eq(chats.id, currentChatId))
      .limit(1)

    if (!chat[0] || chat[0].userId !== session.user.id) {
      return new Response("Chat not found or access denied", { status: 403 })
    }

    const now = new Date()

    // Insert the user message directly to database
    await db.insert(messages).values({
      id: userMessageId,
      chatId: currentChatId,
      role: "user",
      content: content,
      createdAt: now,
    })

    // Insert the AI message placeholder directly to database
    await db.insert(messages).values({
      id: aiMessageId,
      chatId: currentChatId,
      role: "assistant",
      content: "", // Start with empty content
      createdAt: new Date(now.getTime() + 1), // Slightly later timestamp
    })

    // Get chat history (excluding the empty AI message we're about to fill)
    const chatHistory = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, currentChatId))
      .orderBy(messages.createdAt)

    // Prepare messages for AI (exclude the empty assistant message)
    const messagesForAI = [
      {
        role: "system" as const,
        content: chat[0].systemPrompt || "You are a helpful AI assistant.",
      },
      ...chatHistory
        .filter((msg) => msg.id !== aiMessageId) // Exclude the placeholder message
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content || "",
        })),
    ]

    // Stream AI response and update DB as chunks arrive
    let accumulatedContent = ""

    const result = await streamText({
      model: anthropic("claude-3-5-haiku-20241022"),
      messages: messagesForAI,
      onChunk: async ({ chunk }) => {
        // Update the database with accumulated content as chunks arrive
        if (chunk.type === "text-delta" && chunk.text) {
          accumulatedContent += chunk.text

          // Update the message in the database
          await db
            .update(messages)
            .set({
              content: accumulatedContent,
            })
            .where(eq(messages.id, aiMessageId))

          console.log(
            `Updated message ${aiMessageId} with chunk, total length: ${accumulatedContent.length}`
          )
        }
      },
    })

    return result.toTextStreamResponse({
      headers: {
        "X-Chat-Id": currentChatId.toString(),
        "X-Message-Id": aiMessageId.toString(),
      },
    })
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response("Internal server error", { status: 500 })
  }
}

export const ServerRoute = createServerFileRoute("/api/chat").methods({
  POST: ({ request }) => handleChatRequest(request),
})
