import { useState, useEffect } from "react"
import ChatTabManager from "@/components/chat-tab-manager"
import { ChatProvider } from "@/lib/chat-context"

interface RightSidebarProps {
  onToggle: () => void
}

export function RightSidebar({ onToggle: _onToggle }: RightSidebarProps) {
  return (
    <main className="flex-1 px-4 py-4 h-full">
      <div className="floating-container-lg h-full">
        <ChatProvider>
          <ChatTabManager />
        </ChatProvider>
      </div>
    </main>
  )
}

export function useRightSidebar() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false
    const saved = localStorage.getItem("right-sidebar-open")
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    localStorage.setItem("right-sidebar-open", JSON.stringify(isOpen))
  }, [isOpen])

  const toggle = () => setIsOpen(!isOpen)

  return { isOpen, toggle, setIsOpen }
}
