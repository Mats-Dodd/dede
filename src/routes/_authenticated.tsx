import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { Outlet } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useLiveQuery } from "@tanstack/react-db"
import { projectCollection } from "@/lib/collections"
import { SidebarInset, SidebarProvider } from "@/components/app-sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { FileProvider } from "@/lib/file-context"
import { CommandPalette } from "@/components/command-palette"
import { useCommandPalette } from "@/lib/hooks/use-command-palette"
import {
  useMacKeyboardShortcuts,
  createMacShortcut,
} from "@/lib/hooks/use-mac-keyboard-shortcuts"

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  ssr: false,
})

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()

  const { data: projects, isLoading } = useLiveQuery((q) =>
    q.from({ projectCollection })
  )

  useEffect(() => {
    if (!isPending && !session) {
      navigate({
        href: "/login",
      })
    }
  }, [session, isPending, navigate])

  useEffect(() => {
    if (session && projects && !isLoading) {
      const hasDefault = projects.some((p) => p.name === "Default")
      if (!hasDefault) {
        projectCollection.insert({
          id: Math.floor(Math.random() * 100000),
          name: "Default",
          description: "Default project",
          ownerId: session.user.id,
          sharedUserIds: [],
          createdAt: new Date(),
        })
      }
    }
  }, [session, projects, isLoading])

  if (isPending) {
    return null
  }

  if (!session) {
    return null
  }

  return (
    <FileProvider>
      <SidebarProvider>
        <AuthenticatedContent />
      </SidebarProvider>
    </FileProvider>
  )
}

function AuthenticatedContent() {
  const { isOpen, openPalette, closePalette } = useCommandPalette()

  // Global keyboard shortcuts
  useMacKeyboardShortcuts([
    // Command palette shortcut (Cmd+P)
    {
      ...createMacShortcut("p"),
      handler: openPalette,
    },
  ])

  return (
    <>
      <CommandPalette isOpen={isOpen} onClose={closePalette} />
      <div className="min-h-screen flex w-full bg-muted/30">
        <AppSidebar />
        <SidebarInset className="flex flex-col">
          <main className="flex-1 px-4 py-4">
            <div className="floating-container-lg h-full">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </>
  )
}
