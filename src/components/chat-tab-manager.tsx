import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useChatContext } from "@/lib/chat-context"
import ChatPane from "@/components/chat-pane"
import { useCallback, useState } from "react"
import { X, Plus, MessageSquare } from "lucide-react"
import {
  useMacKeyboardShortcuts,
  createMacShortcut,
} from "@/lib/hooks/use-mac-keyboard-shortcuts"
import { Button } from "@/components/ui/button"

export default function ChatTabManager() {
  const {
    openChats,
    activeChatId,
    setActiveChat,
    closeChat,
    createNewChat,
    reorderOpenChats,
  } = useChatContext()

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Chat navigation shortcuts (similar to tab navigation)
  useMacKeyboardShortcuts([
    // Navigate between chats with Cmd+Shift+Arrow keys
    {
      ...createMacShortcut("ArrowRight", { shiftKey: true }),
      handler: () => {
        if (openChats.length > 0 && activeChatId) {
          const currentIndex = openChats.findIndex(
            (chat) => chat.id === activeChatId
          )
          const nextIndex = (currentIndex + 1) % openChats.length
          setActiveChat(openChats[nextIndex].id)
        }
      },
    },
    {
      ...createMacShortcut("ArrowLeft", { shiftKey: true }),
      handler: () => {
        if (openChats.length > 0 && activeChatId) {
          const currentIndex = openChats.findIndex(
            (chat) => chat.id === activeChatId
          )
          const prevIndex =
            currentIndex === 0 ? openChats.length - 1 : currentIndex - 1
          setActiveChat(openChats[prevIndex].id)
        }
      },
    },
  ])

  const handleCloseTab = useCallback(
    (chatId: number, e: React.MouseEvent) => {
      e.stopPropagation()
      closeChat(chatId)
    },
    [closeChat]
  )

  const handleNewChat = useCallback(async () => {
    await createNewChat()
  }, [createNewChat])

  // Drag and drop handlers (exact same as tab-manager)
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverIndex(index)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDragLeave = useCallback(
    (e: React.DragEvent, index: number) => {
      if (dragOverIndex === index) {
        setDragOverIndex(null)
      }
    },
    [dragOverIndex]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault()

      if (draggedIndex !== null && draggedIndex !== dropIndex) {
        reorderOpenChats(draggedIndex, dropIndex)
      }

      setDraggedIndex(null)
      setDragOverIndex(null)
    },
    [draggedIndex, reorderOpenChats]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [])

  return (
    <div className="h-full flex flex-col">
      <Tabs
        value={activeChatId?.toString() || ""}
        onValueChange={(value) => setActiveChat(value ? parseInt(value) : null)}
        className="flex-1 flex flex-col"
      >
        <TabsList className="shrink-0">
          {openChats.length === 0 ? (
            <div className="flex items-center px-3 py-2">
              <Button
                onClick={handleNewChat}
                size="sm"
                variant="ghost"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </Button>
            </div>
          ) : (
            <>
              {openChats.map((chat, index) => {
                const isDragging = draggedIndex === index
                const isDragOver = dragOverIndex === index

                return (
                  <div
                    key={`tab-${chat.id}`}
                    className={`relative group transition-all duration-150 ${
                      isDragging
                        ? "opacity-50 cursor-grabbing scale-105"
                        : "cursor-grab"
                    } ${isDragOver ? "border-l-4 border-blue-500 pl-1" : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnter={handleDragEnter}
                    onDragLeave={(e) => handleDragLeave(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <TabsTrigger
                      value={chat.id.toString()}
                      className="pr-8 max-w-48"
                    >
                      <span className="truncate">{chat.title}</span>
                    </TabsTrigger>
                    <button
                      onClick={(e) => handleCloseTab(chat.id, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-data-[state=active]:opacity-100 hover:bg-muted rounded-sm p-0.5 transition-all duration-200 cursor-pointer z-10"
                      type="button"
                      aria-label={`Close ${chat.title}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
              <div className="ml-auto">
                <Button
                  onClick={handleNewChat}
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 mr-2"
                  aria-label="New chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          )}
        </TabsList>

        {openChats.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-muted-foreground max-w-md">
              <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <div className="text-lg font-medium mb-2">
                Start a conversation
              </div>
              <div className="text-sm">
                Click &ldquo;New Chat&rdquo; above to begin your AI
                conversation.
              </div>
            </div>
          </div>
        ) : (
          openChats.map((chat) => (
            <ChatPane key={`content-${chat.id}`} chatId={chat.id} />
          ))
        )}
      </Tabs>
    </div>
  )
}
