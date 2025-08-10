import React from "react"
import { ChevronsUpDown, PanelLeftIcon } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { projectCollection } from "@/lib/collections"
import { useSidebar } from "@/components/app-sidebar"
import { useFileContext } from "@/lib/file-context"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

export default function Navbar() {
  const { toggleSidebar } = useSidebar()
  const { selectedFileNode, activeFilePath } = useFileContext()
  const navigate = useNavigate()
  const location = useLocation()

  const { data: projects } = useLiveQuery((q) => q.from({ projectCollection }))

  // Extract current project ID from route
  const currentProjectId = location.pathname.match(/\/project\/(\d+)/)?.[1]
  const selectedProject = projects?.find(
    (p) => p.id.toString() === currentProjectId
  )

  const handleProjectChange = (projectId: string) => {
    navigate({
      to: "/project/$projectId",
      params: { projectId },
    })
  }

  return (
    <header className="px-4 md:px-6">
      <div className="flex h-10 items-center justify-between gap-3">
        {/* Left side */}
        <div className="flex items-center gap-1.5">
          {/* Sidebar trigger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="size-6"
          >
            <PanelLeftIcon />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>

          {/* Breadcrumb with project selection */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem></BreadcrumbItem>
              {projects && projects.length > 0 && (
                <>
                  {/* <BreadcrumbSeparator> / </BreadcrumbSeparator> */}
                  <BreadcrumbItem>
                    <Select
                      value={currentProjectId || ""}
                      onValueChange={handleProjectChange}
                    >
                      <SelectPrimitive.SelectTrigger
                        aria-label="Select project"
                        asChild
                      >
                        <Button
                          variant="ghost"
                          className="focus-visible:bg-accent text-foreground h-8 px-2 focus-visible:ring-0"
                        >
                          <SelectValue placeholder="Select project">
                            {selectedProject?.name || "Select project"}
                          </SelectValue>
                          <ChevronsUpDown
                            size={14}
                            className="text-muted-foreground/80 ml-1"
                          />
                        </Button>
                      </SelectPrimitive.SelectTrigger>
                      <SelectContent className="[&_*[role=option]]:ps-2 [&_*[role=option]]:pe-8 [&_*[role=option]>span]:start-auto [&_*[role=option]>span]:end-2">
                        {projects.map((project) => (
                          <SelectItem
                            key={project.id}
                            value={project.id.toString()}
                          >
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </BreadcrumbItem>
                  {(() => {
                    const fallbackPath =
                      selectedFileNode?.fileSystemNode.type === "file"
                        ? selectedFileNode.path
                        : undefined
                    const pathForBreadcrumb = activeFilePath || fallbackPath
                    if (!pathForBreadcrumb) return null

                    const cleanPath = pathForBreadcrumb.startsWith("/")
                      ? pathForBreadcrumb.slice(1)
                      : pathForBreadcrumb
                    const pathSegments = cleanPath.split("/").filter(Boolean)

                    return pathSegments.map((segment, index) => (
                      <React.Fragment key={index}>
                        <BreadcrumbSeparator> / </BreadcrumbSeparator>
                        <BreadcrumbItem>
                          {index === pathSegments.length - 1 ? (
                            <BreadcrumbPage>{segment}</BreadcrumbPage>
                          ) : (
                            <span className="text-muted-foreground">
                              {segment}
                            </span>
                          )}
                        </BreadcrumbItem>
                      </React.Fragment>
                    ))
                  })()}
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
    </header>
  )
}
