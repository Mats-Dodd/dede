import { useState, useCallback, useMemo } from "react"
import { useFileContext } from "@/lib/file-context"
import { fileSystemNodeCollection } from "@/lib/collections"
import { useLiveQuery, eq, and } from "@tanstack/react-db"
import { useParams } from "@tanstack/react-router"

export interface CommandPaletteFile {
  id: string
  name: string
  path: string
  title?: string | null
  type: string
  isRecent?: boolean
}

export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { openFile, openFiles } = useFileContext()
  const { projectId } = useParams({
    from: "/_authenticated/project/$projectId",
  })

  // Get all files for the current project
  const { data: allFiles = [] } = useLiveQuery((q) =>
    q
      .from({ file: fileSystemNodeCollection })
      .where(({ file }) =>
        and(
          eq(file.projectId, parseInt(projectId)),
          eq(file.type, "file"),
          eq(file.isDeleted, false)
        )
      )
  )

  // Get recently opened file IDs
  const recentFileIds = useMemo(
    () => openFiles.map((f) => f.fileSystemNode.id.toString()),
    [openFiles]
  )

  // Transform files into command palette format
  const files = useMemo((): CommandPaletteFile[] => {
    return allFiles.map((file) => ({
      id: file.id.toString(),
      name: file.name,
      path: file.path,
      title: file.title,
      type: file.type,
      isRecent: recentFileIds.includes(file.id.toString()),
    }))
  }, [allFiles, recentFileIds])

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) {
      // When no search query, show recent files first, then all files
      const recentFiles = files.filter((f) => f.isRecent)
      const otherFiles = files.filter((f) => !f.isRecent)
      return [...recentFiles, ...otherFiles]
    }

    // Fuzzy search implementation
    const query = searchQuery.toLowerCase()
    return files
      .map((file) => {
        const titleMatch = file.title?.toLowerCase().includes(query) ?? false
        const nameMatch = file.name.toLowerCase().includes(query)
        const pathMatch = file.path.toLowerCase().includes(query)

        // Calculate relevance score
        let score = 0
        if (titleMatch) score += 3
        if (nameMatch) score += 2
        if (pathMatch) score += 1
        if (file.isRecent) score += 1

        return { file, score, matches: titleMatch || nameMatch || pathMatch }
      })
      .filter(({ matches }) => matches)
      .sort((a, b) => b.score - a.score)
      .map(({ file }) => file)
  }, [files, searchQuery])

  const openPalette = useCallback(() => {
    setIsOpen(true)
    setSearchQuery("")
  }, [])

  const closePalette = useCallback(() => {
    setIsOpen(false)
    setSearchQuery("")
  }, [])

  const selectFile = useCallback(
    (file: CommandPaletteFile) => {
      const fileSystemNode = allFiles.find((f) => f.id.toString() === file.id)
      if (fileSystemNode) {
        // Create a FileTreeNode structure that openFile expects
        const fileTreeNode = {
          id: fileSystemNode.id.toString(),
          name: fileSystemNode.name,
          path: fileSystemNode.path,
          type: fileSystemNode.type as "file" | "directory",
          fileSystemNode: fileSystemNode,
        }
        openFile(fileTreeNode)
      }
      closePalette()
    },
    [allFiles, openFile, closePalette]
  )

  return {
    isOpen,
    searchQuery,
    setSearchQuery,
    filteredFiles,
    openPalette,
    closePalette,
    selectFile,
  }
}
