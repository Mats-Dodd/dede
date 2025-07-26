import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { Outlet } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useLiveQuery } from "@tanstack/react-db"
import { projectCollection } from "@/lib/collections"
import { SidebarInset, SidebarProvider } from "@/components/app-sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { FileProvider } from "@/lib/file-context"
import Navbar from "@/components/navbar"

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
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <SidebarInset>
            <Navbar />
            <main className="flex-1 p-4">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </FileProvider>
  )
}
