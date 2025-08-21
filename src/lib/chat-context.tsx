import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { chatCollection, messageCollection } from "@/lib/collections"
import { authClient } from "@/lib/auth-client"
import type { Chat, Message } from "@/db/schema"

// Generate a random ID for messages
function generateMessageId(): number {
  return Math.floor(Math.random() * 100000000)
}

interface ChatContextType {
  openChats: Chat[]
  activeChatId: number | null
  setActiveChat: (chatId: number | null) => void
  openChat: (chat: Chat) => void
  closeChat: (chatId: number) => void
  createNewChat: (projectId?: number) => Promise<Chat>
  updateChatTitle: (chatId: number, title: string) => void
  sendMessage: (chatId: number, content: string) => Promise<void>
  getChatMessages: (chatId: number) => Message[]
  reorderOpenChats: (fromIndex: number, toIndex: number) => void
}

const ChatContext = createContext<ChatContextType | null>(null)

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider")
  }
  return context
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [openChatIds, setOpenChatIds] = useState<number[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)

  // Get current user session
  const { data: session } = authClient.useSession()

  // Get all chats and messages using live query
  const { data: allChats = [] } = useLiveQuery((q) =>
    q.from({ chatCollection })
  )
  const { data: allMessages = [] } = useLiveQuery((q) =>
    q.from({ messageCollection })
  )

  // Debug: Log collection state
  useEffect(() => {
    console.log("messageCollection size:", messageCollection.size)
    console.log("All messages from useLiveQuery:", allMessages)
    console.log("Messages count:", allMessages.length)

    // Check the raw collection data
    const rawMessages = messageCollection.currentStateAsChanges()
    console.log("Raw messages from collection.all():", rawMessages)
  }, [allMessages])

  // Test Electric sync directly
  useEffect(() => {
    const testElectricSync = async () => {
      try {
        // Check if we can fetch messages directly from the Electric endpoint
        const response = await fetch("/api/messages?table=messages&offset=-1", {
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          console.log("Direct Electric API response:", data)
          console.log("Number of messages from Electric:", data.length)
          if (data.length > 0) {
            console.log("Sample message from Electric:", data[0])
          }
        } else {
          console.error(
            "Failed to fetch from Electric:",
            response.status,
            await response.text()
          )
        }
      } catch (error) {
        console.error("Error testing Electric sync:", error)
      }
    }

    // Test on mount and when session changes
    if (session?.user?.id) {
      testElectricSync()
    }
  }, [session])

  // Filter to only open chats
  const openChats = allChats.filter((chat) => openChatIds.includes(chat.id))

  const createNewChat = useCallback(
    async (projectId?: number): Promise<Chat> => {
      // Create a temporary ID and timestamps following codebase pattern
      const tempId = Math.floor(Math.random() * 100000)
      const now = new Date()

      // Insert the new chat with all required fields
      const transaction = chatCollection.insert({
        id: tempId,
        userId: session?.user.id || "",
        title: "New Chat",
        projectId: projectId || null,
        systemPrompt: "You are a helpful AI assistant.",
        archived: false,
        createdAt: now,
        updatedAt: now,
      })

      // Get the created chat from the transaction
      const newChat = transaction.mutations[0].modified as Chat

      setOpenChatIds((prev) => [...prev, newChat.id])
      setActiveChatId(newChat.id)

      return newChat
    },
    [session]
  )

  const openChat = useCallback((chat: Chat) => {
    setOpenChatIds((prev) => {
      if (prev.includes(chat.id)) {
        return prev
      }
      return [...prev, chat.id]
    })
    setActiveChatId(chat.id)
  }, [])

  const closeChat = useCallback(
    (chatId: number) => {
      setOpenChatIds((prev) => {
        const filtered = prev.filter((id) => id !== chatId)

        // If closing the active chat, switch to another one
        if (chatId === activeChatId) {
          const index = prev.findIndex((id) => id === chatId)
          if (filtered.length > 0) {
            // Switch to the next chat, or previous if at the end
            const nextIndex =
              index < filtered.length ? index : filtered.length - 1
            setActiveChatId(filtered[nextIndex] || null)
          } else {
            setActiveChatId(null)
          }
        }

        return filtered
      })
    },
    [activeChatId]
  )

  const setActiveChat = useCallback((chatId: number | null) => {
    setActiveChatId(chatId)
  }, [])

  const updateChatTitle = useCallback(async (chatId: number, title: string) => {
    await chatCollection.update(chatId, (draft) => {
      draft.title = title
    })
  }, [])

  const sendMessage = useCallback(
    async (chatId: number, content: string) => {
      if (!session?.user?.id) {
        throw new Error("User not authenticated")
      }

      // Generate IDs for both user and AI messages
      const userMessageId = generateMessageId()
      const aiMessageId = generateMessageId()

      console.log("Sending message with IDs:", {
        userMessageId,
        aiMessageId,
        chatId,
      })

      try {
        // Call API to create messages and generate AI response
        // The server will create both messages in the database
        // Electric will sync them back to our collection
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userMessageId: userMessageId,
            aiMessageId: aiMessageId,
            chatId: chatId.toString(),
            content: content,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to send message")
        }

        console.log("Message sent successfully, waiting for stream...")

        // Consume the response stream
        // The server is updating the database as chunks arrive
        // Electric will sync those updates back to our collection
        const reader = response.body?.getReader()

        if (reader) {
          // Read through the stream to completion
          while (true) {
            const { done } = await reader.read()
            if (done) break
          }
        }

        console.log("Stream completed")

        // Check if messages appeared in collection after a delay
        setTimeout(() => {
          console.log("Checking collection after stream completion:")
          console.log("messageCollection size:", messageCollection.size)
          console.log(
            "User message in collection?",
            messageCollection.get(userMessageId)
          )
          console.log(
            "AI message in collection?",
            messageCollection.get(aiMessageId)
          )
        }, 1000)
      } catch (error) {
        console.error("Failed to send message:", error)
        throw error
      }
    },
    [session]
  )

  const getChatMessages = useCallback(
    (chatId: number): Message[] => {
      return allMessages
        .filter((msg: Message) => msg.chatId === chatId)
        .sort(
          (a: Message, b: Message) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
    },
    [allMessages]
  )

  const reorderOpenChats = useCallback((fromIndex: number, toIndex: number) => {
    setOpenChatIds((prev) => {
      const result = [...prev]
      const [removed] = result.splice(fromIndex, 1)
      result.splice(toIndex, 0, removed)
      return result
    })
  }, [])

  const value: ChatContextType = {
    openChats,
    activeChatId,
    setActiveChat,
    openChat,
    closeChat,
    createNewChat,
    updateChatTitle,
    sendMessage,
    getChatMessages,
    reorderOpenChats,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
