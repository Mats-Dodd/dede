import { TabsContent } from "@/components/ui/tabs"
import { useChatContext, type ChatMessage } from "@/lib/chat-context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState, useRef, useEffect } from "react"
import { Send, User, Bot } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatPaneProps {
  chatId: string
}

export default function ChatPane({ chatId }: ChatPaneProps) {
  const { openChats, addMessage } = useChatContext()
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const chat = openChats.find((c) => c.id === chatId)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [chat?.messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !chat) return

    const userMessage = inputValue.trim()
    setInputValue("")
    setIsLoading(true)

    // Add user message
    addMessage(chatId, {
      content: userMessage,
      role: "user",
    })

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      addMessage(chatId, {
        content: `This is a simulated response to: "${userMessage}". In a real implementation, this would be connected to an AI service.`,
        role: "assistant",
      })
      setIsLoading(false)
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!chat) return null

  return (
    <TabsContent value={chatId} className="flex-1 mt-0 border-0">
      <div className="h-full flex flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4">
          {chat.messages.length === 0 ? (
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
              {chat.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <div className="flex space-x-1">
                        <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

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
          {message.content}
        </div>
        <div
          className={cn(
            "text-xs text-muted-foreground",
            isUser && "text-right"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  )
}
