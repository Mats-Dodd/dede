import React, { useCallback, useRef } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useLiveQuery } from "@tanstack/react-db"
import { fileSystemNodeCollection, projectCollection } from "@/lib/collections"
import {
  createNewFileSystemNode,
  type FileTreeNode,
} from "@/lib/utils/file-tree-utils"
import { useFileContext } from "@/lib/file-context"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"

interface CreateFileOptions {
  projectId: number
  parentPath: string
  name: string
  type: "file" | "directory"
  content?: string
}

interface CreateFileResult {
  createFile: (options: CreateFileOptions) => Promise<void>
  isCreating: boolean
}

export function useCreateFileWithNavigation(): CreateFileResult {
  const navigate = useNavigate()
  const { setSelectedFileNode } = useFileContext()
  const isCreatingRef = useRef(false)
  const creationTrackingRef = useRef<{
    name: string
    path: string
    projectId: number
    type: string
    createdAfter: Date
  } | null>(null)

  const { data: session } = authClient.useSession()

  // Get all projects to access owner and shared user info
  const { data: projects = [] } = useLiveQuery(
    (q) => q.from({ projectCollection }),
    []
  )

  // Watch for newly created files to auto-select them
  const { data: allFiles = [] } = useLiveQuery(
    (q) => q.from({ fileSystemNodeCollection }),
    []
  )

  // Effect to detect when our newly created file appears
  const checkForNewFile = useCallback(() => {
    if (!creationTrackingRef.current) return

    const { name, path, projectId, type, createdAfter } =
      creationTrackingRef.current

    // Look for a file that matches our creation criteria
    const matchingFiles = allFiles.filter(
      (file) =>
        file.title === name &&
        file.path === path &&
        file.projectId === projectId &&
        file.type === type
    )

    // Try to find the most recently created matching file
    const newFile = matchingFiles
      .filter(
        (file) => file.createdAt && new Date(file.createdAt) >= createdAfter
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      )[0]

    if (newFile && newFile.type === "file") {
      // Wait a bit to ensure ElectricSQL has fully processed the sync
      setTimeout(() => {
        // Re-fetch the file to make sure we have the latest version
        const latestFile = allFiles.find(
          (f) =>
            f.title === name &&
            f.path === path &&
            f.projectId === projectId &&
            f.type === type
        )

        if (latestFile) {
          // Found our file! Select it and navigate
          const fileTreeNode: FileTreeNode = {
            id: latestFile.id.toString(),
            name: latestFile.title,
            path: latestFile.path,
            type: latestFile.type as "file" | "directory",
            fileSystemNode: latestFile,
            icon: undefined, // Will be set by the tree component
          }

          console.log(
            "📁 use-create-file-with-navigation calling setSelectedFileNode for:",
            fileTreeNode.fileSystemNode.id.toString(),
            "title:",
            fileTreeNode.fileSystemNode.title
          )
          setSelectedFileNode(fileTreeNode)

          // Navigate to the project page if not already there
          const currentPath = window.location.pathname
          const expectedPath = `/project/${projectId}`

          if (!currentPath.includes(expectedPath)) {
            navigate({
              to: "/project/$projectId",
              params: { projectId: projectId.toString() },
            })
          }

          toast.success(`📄 File '${name}' created and opened in editor`)

          // Clear tracking
          creationTrackingRef.current = null
          isCreatingRef.current = false
        }
      }, 100) // Reduced delay since we're being more lenient
    }
  }, [allFiles, setSelectedFileNode, navigate])

  // Check for new file whenever files change
  React.useEffect(() => {
    if (creationTrackingRef.current) {
      checkForNewFile()
    }
  }, [allFiles, checkForNewFile])

  const createFile = useCallback(
    async (options: CreateFileOptions) => {
      const { projectId, parentPath, name, type, content } = options

      if (!session?.user?.id) {
        toast.error("You must be logged in to create files")
        return
      }

      if (isCreatingRef.current) {
        toast.error("File creation already in progress")
        return
      }

      const project = projects.find((p) => p.id === projectId)
      if (!project) {
        toast.error("Project not found")
        return
      }

      isCreatingRef.current = true

      try {
        // Record what we're creating so we can detect it later
        const creationTime = new Date()
        const fullPath =
          parentPath === "/" ? `/${name}` : `${parentPath}/${name}`

        creationTrackingRef.current = {
          name,
          path: fullPath,
          projectId,
          type,
          createdAfter: creationTime,
        }

        // Create the new file system node
        const newNode = createNewFileSystemNode(
          projectId,
          parentPath,
          name,
          type,
          content
        )

        // Insert into collection with temporary ID
        fileSystemNodeCollection.insert({
          id: Math.floor(Math.random() * 100000), // Temporary ID
          ...newNode,
          userIds: [project.ownerId, ...project.sharedUserIds],
          createdAt: creationTime,
          updatedAt: creationTime,
        })

        // Show immediate feedback
        toast.success(
          `${type === "directory" ? "📁" : "📄"} ${
            type === "directory" ? "Folder" : "File"
          } '${name}' is being created...`
        )

        // Set a timeout as fallback in case sync detection fails
        setTimeout(() => {
          if (creationTrackingRef.current) {
            // Still waiting - clear tracking and show warning
            creationTrackingRef.current = null
            isCreatingRef.current = false
            toast.warning(
              "File created but auto-navigation timed out. Please select the file manually."
            )
          }
        }, 10000) // 10 second timeout
      } catch (error) {
        isCreatingRef.current = false
        creationTrackingRef.current = null
        console.error("Error creating file:", error)
        toast.error(
          `Failed to create ${type}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    },
    [session, projects, setSelectedFileNode, navigate]
  )

  return {
    createFile,
    isCreating: isCreatingRef.current,
  }
}
