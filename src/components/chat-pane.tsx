import { TabsContent } from "@/components/ui/tabs"
import { useChatContext } from "@/lib/chat-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState, useRef, useEffect } from "react"
import { Send, User, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message } from "@/db/schema"

interface ChatPaneProps {
  chatId: number
}

export default function ChatPane({ chatId }: ChatPaneProps) {
  const { openChats, sendMessage, getChatMessages } = useChatContext()
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const chat = openChats.find((c) => c.id === chatId)
  const messages = getChatMessages(chatId)

  // Debug messages
  useEffect(() => {
    console.log(`ChatPane for chat ${chatId} - messages:`, messages)
  }, [messages, chatId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !chat) return

    const userMessage = inputValue.trim()
    setInputValue("")
    setIsLoading(true)

    try {
      await sendMessage(chatId, userMessage)
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!chat) return null

  return (
    <TabsContent value={chatId.toString()} className="flex-1 mt-0 border-0">
      <div className="h-full flex flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground max-w-sm">
                <Bot className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <div className="text-sm">
                  Start a conversation by typing a message below.
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </div>
    </TabsContent>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"
  const isStreaming = !isUser && message.content === ""

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow",
          isUser ? "bg-background" : "bg-primary text-primary-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2">
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground ml-auto max-w-[80%]"
              : "bg-muted"
          )}
        >
          {isStreaming ? (
            <div className="flex space-x-1">
              <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce"></div>
            </div>
          ) : (
            <>
              {message.content}
              {!isUser &&
                message.content &&
                !message.content.endsWith(".") &&
                !message.content.endsWith("!") &&
                !message.content.endsWith("?") && (
                  <span className="inline-block w-1 h-4 ml-0.5 bg-current animate-pulse" />
                )}
            </>
          )}
        </div>
        <div
          className={cn(
            "text-xs text-muted-foreground",
            isUser && "text-right"
          )}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  )
}
