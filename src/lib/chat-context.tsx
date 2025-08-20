import React, { createContext, useContext, useState, useCallback } from "react"

export interface ChatMessage {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

interface ChatContextType {
  openChats: Chat[]
  activeChatId: string | null
  setActiveChat: (chatId: string | null) => void
  openChat: (chat: Chat) => void
  closeChat: (chatId: string) => void
  createNewChat: () => Chat
  updateChatTitle: (chatId: string, title: string) => void
  addMessage: (
    chatId: string,
    message: Omit<ChatMessage, "id" | "timestamp">
  ) => void
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

let chatIdCounter = 1
let messageIdCounter = 1

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [openChats, setOpenChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const createNewChat = useCallback((): Chat => {
    const newChat: Chat = {
      id: `chat-${chatIdCounter++}`,
      title: `Chat ${chatIdCounter - 1}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    setOpenChats((prev) => {
      const updated = [...prev, newChat]
      return updated
    })
    setActiveChatId(newChat.id)

    return newChat
  }, [])

  const openChat = useCallback((chat: Chat) => {
    setOpenChats((prev) => {
      const exists = prev.find((c) => c.id === chat.id)
      if (exists) {
        return prev
      }
      return [...prev, chat]
    })
    setActiveChatId(chat.id)
  }, [])

  const closeChat = useCallback(
    (chatId: string) => {
      setOpenChats((prev) => {
        const filtered = prev.filter((c) => c.id !== chatId)

        // If closing the active chat, switch to another one
        if (chatId === activeChatId) {
          const index = prev.findIndex((c) => c.id === chatId)
          if (filtered.length > 0) {
            // Switch to the next chat, or previous if at the end
            const nextIndex =
              index < filtered.length ? index : filtered.length - 1
            setActiveChatId(filtered[nextIndex]?.id || null)
          } else {
            setActiveChatId(null)
          }
        }

        return filtered
      })
    },
    [activeChatId]
  )

  const setActiveChat = useCallback((chatId: string | null) => {
    setActiveChatId(chatId)
  }, [])

  const updateChatTitle = useCallback((chatId: string, title: string) => {
    setOpenChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId ? { ...chat, title, updatedAt: new Date() } : chat
      )
    )
  }, [])

  const addMessage = useCallback(
    (chatId: string, message: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMessage: ChatMessage = {
        ...message,
        id: `message-${messageIdCounter++}`,
        timestamp: new Date(),
      }

      setOpenChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                messages: [...chat.messages, newMessage],
                updatedAt: new Date(),
                // Auto-update title based on first user message
                title:
                  chat.messages.length === 0 && message.role === "user"
                    ? message.content.slice(0, 30) +
                      (message.content.length > 30 ? "..." : "")
                    : chat.title,
              }
            : chat
        )
      )
    },
    []
  )

  const reorderOpenChats = useCallback((fromIndex: number, toIndex: number) => {
    setOpenChats((prev) => {
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
    addMessage,
    reorderOpenChats,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
