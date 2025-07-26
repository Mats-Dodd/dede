import {
  createFileRoute,
  useNavigate,
  Link,
  useLocation,
} from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Outlet } from "@tanstack/react-router"
import { authClient } from "@/lib/auth-client"
import { useLiveQuery } from "@tanstack/react-db"
import { projectCollection } from "@/lib/collections"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ProjectFileTree } from "@/components/project-file-tree"
import { PlusIcon } from "lucide-react"

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  ssr: false,
})

function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")

  // Extract project ID from current route
  const currentProjectId = location.pathname.match(/\/project\/(\d+)/)?.[1]
  const selectedProjectId = currentProjectId
    ? parseInt(currentProjectId, 10)
    : null

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

  const handleLogout = async () => {
    await authClient.signOut()
    navigate({ to: "/login" })
  }

  const handleCreateProject = () => {
    if (newProjectName.trim() && session) {
      projectCollection.insert({
        id: Math.floor(Math.random() * 100000),
        name: newProjectName.trim(),
        description: "",
        ownerId: session.user.id,
        sharedUserIds: [],
        createdAt: new Date(),
      })
      setNewProjectName("")
      setShowNewProjectForm(false)
    }
  }

  if (isPending) {
    return null
  }

  if (!session) {
    return null
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">Arbor Editor</h1>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center justify-between">
                Projects
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewProjectForm(!showNewProjectForm)}
                  className="h-6 w-6 p-0"
                >
                  <PlusIcon className="h-3 w-3" />
                </Button>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {showNewProjectForm && (
                  <div className="p-2 border rounded-md mb-2">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleCreateProject()
                      }
                      placeholder="Project name"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                    />
                    <div className="flex gap-1">
                      <Button onClick={handleCreateProject} size="sm">
                        Create
                      </Button>
                      <Button
                        onClick={() => setShowNewProjectForm(false)}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                <SidebarMenu>
                  {projects?.map((project) => (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={selectedProjectId === project.id}
                      >
                        <Link
                          to="/project/$projectId"
                          params={{ projectId: project.id.toString() }}
                        >
                          {project.name}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {selectedProjectId && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <ProjectFileTree projectId={selectedProjectId} />
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <span className="text-sm text-muted-foreground">
                    {session.user.email}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  Sign out
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold">
              TanStack DB / Electric Starter
            </h1>
          </header>
          <main className="flex-1 p-4">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
