import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { useParams } from "@tanstack/react-router"
import { type FileTreeNode } from "@/lib/utils/file-tree-utils"
import { useSessionState } from "@/lib/hooks/use-session-state"
import { useValidateAndRestoreFiles } from "@/lib/session-state-utils"

interface FileContextType {
  selectedFileNode: FileTreeNode | undefined
  setSelectedFileNode: (node: FileTreeNode | undefined) => void
  openFiles: FileTreeNode[]
  activeFilePath: string | undefined
  openFile: (node: FileTreeNode) => void
  closeFile: (filePath: string) => void
  setActiveFile: (filePath: string) => void
  reorderOpenFiles: (fromIndex: number, toIndex: number) => void
  updateOpenFilePaths: (
    oldPath: string,
    newPath: string,
    isDirectory: boolean
  ) => void
}

const FileContext = createContext<FileContextType | null>(null)

export function FileProvider({ children }: { children: ReactNode }) {
  // Get project ID from route params
  const params = useParams({ strict: false }) as { projectId?: string }
  const projectId = params?.projectId
  const numericProjectId: number | undefined =
    projectId !== undefined ? Number(projectId) : undefined

  // Session state management
  const { currentState, saveSessionState } = useSessionState(
    numericProjectId || 0
  )
  const { validateAndRestoreFiles, availableFiles } =
    useValidateAndRestoreFiles(
      currentState?.openFileIds || [],
      numericProjectId || 0
    )

  const [selectedFileNode, setSelectedFileNode] = useState<
    FileTreeNode | undefined
  >()
  const [openFiles, setOpenFiles] = useState<FileTreeNode[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>()
  const [isRestoringSession, setIsRestoringSession] = useState(false)
  const [hasRestoredOnce, setHasRestoredOnce] = useState(false)

  // Reset restoration flag when project changes
  useEffect(() => {
    setHasRestoredOnce(false)
  }, [numericProjectId])

  // Restore session state on mount (only once per project)
  useEffect(() => {
    if (
      currentState &&
      currentState.openFileIds &&
      currentState.openFileIds.length > 0 &&
      numericProjectId &&
      !isRestoringSession &&
      !hasRestoredOnce &&
      availableFiles &&
      availableFiles.length > 0
    ) {
      setIsRestoringSession(true)

      const fileIdsToRestore =
        currentState.tabOrder && currentState.tabOrder.length > 0
          ? currentState.tabOrder
          : currentState.openFileIds

      const restoredFiles = validateAndRestoreFiles(fileIdsToRestore)

      if (restoredFiles.length > 0) {
        setOpenFiles(restoredFiles)

        // Restore active file if it still exists
        if (
          currentState.activeFilePath &&
          restoredFiles.some(
            (f) => f.fileSystemNode.path === currentState.activeFilePath
          )
        ) {
          setActiveFilePath(currentState.activeFilePath)
          const activeFile = restoredFiles.find(
            (f) => f.fileSystemNode.path === currentState.activeFilePath
          )
          if (activeFile) {
            setSelectedFileNode(activeFile)
          }
        }
      }
      setIsRestoringSession(false)
      setHasRestoredOnce(true)
    }
  }, [currentState, numericProjectId, hasRestoredOnce, availableFiles])

  // Save session state when openFiles or activeFilePath changes
  useEffect(() => {
    if (
      numericProjectId &&
      !isRestoringSession &&
      hasRestoredOnce &&
      (openFiles.length > 0 || activeFilePath)
    ) {
      const sessionData = {
        openFileIds: openFiles.map((f) => f.fileSystemNode.id),
        openFilePaths: openFiles.map((f) => f.fileSystemNode.path),
        activeFilePath,
        tabOrder: openFiles.map((f) => f.fileSystemNode.id),
      }
      saveSessionState(sessionData)
    }
  }, [
    openFiles,
    activeFilePath,
    saveSessionState,
    numericProjectId,
    isRestoringSession,
    hasRestoredOnce,
  ])

  const openFile = (node: FileTreeNode) => {
    if (node.fileSystemNode.type !== "file") return

    const filePath = node.fileSystemNode.path

    setOpenFiles((prev) => {
      // Check for existing file with same path (handles temp ID vs real ID case)
      const existingIndex = prev.findIndex(
        (f) => f.fileSystemNode.path === filePath
      )

      if (existingIndex >= 0) {
        // Replace existing file, preserving tab position
        const newFiles = [...prev]
        newFiles[existingIndex] = node

        setActiveFilePath(filePath)
        setSelectedFileNode(node)
        return newFiles
      }

      // Add to open files and make it active
      const newFiles = [...prev, node]

      setActiveFilePath(filePath)
      setSelectedFileNode(node)
      return newFiles
    })
  }

  const closeFile = (filePath: string) => {
    setOpenFiles((prev) => {
      const filtered = prev.filter((f) => f.fileSystemNode.path !== filePath)

      // If closing the active file, switch to another open file or clear selection
      if (activeFilePath === filePath) {
        if (filtered.length > 0) {
          const nextFile = filtered[filtered.length - 1]
          setActiveFilePath(nextFile.fileSystemNode.path)
          setSelectedFileNode(nextFile)
        } else {
          setActiveFilePath(undefined)
          setSelectedFileNode(undefined)
        }
      }

      return filtered
    })
  }

  const setActiveFile = (filePath: string) => {
    const file = openFiles.find((f) => f.fileSystemNode.path === filePath)
    if (file) {
      setActiveFilePath(filePath)
      setSelectedFileNode(file)
    }
  }

  const reorderOpenFiles = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      if (fromIndex < 0 || toIndex < 0) return
      if (fromIndex >= openFiles.length || toIndex >= openFiles.length) return

      setOpenFiles((prev) => {
        const newFiles = [...prev]
        const [movedFile] = newFiles.splice(fromIndex, 1)
        newFiles.splice(toIndex, 0, movedFile)
        return newFiles
      })
    },
    [openFiles.length]
  )

  const updateOpenFilePaths = useCallback(
    (oldPath: string, newPath: string, isDirectory: boolean) => {
      setOpenFiles((prev) => {
        const oldPrefix = oldPath.endsWith("/") ? oldPath : oldPath + "/"
        const newPrefix = newPath.endsWith("/") ? newPath : newPath + "/"

        return prev.map((file) => {
          const currentPath = file.fileSystemNode.path
          let updatedPath = currentPath

          if (isDirectory) {
            if (currentPath === oldPath) {
              updatedPath = newPath
            } else if (currentPath.startsWith(oldPrefix)) {
              updatedPath = currentPath.replace(oldPrefix, newPrefix)
            }
          } else {
            if (currentPath === oldPath) {
              updatedPath = newPath
            }
          }

          if (updatedPath !== currentPath) {
            // Extract the new filename from the new path
            const newName = updatedPath.split("/").pop() || ""
            return {
              ...file,
              name: newName,
              path: updatedPath,
              fileSystemNode: {
                ...file.fileSystemNode,
                path: updatedPath,
                title: newName,
              },
            }
          }
          return file
        })
      })

      setActiveFilePath((prev) => {
        if (!prev) return prev
        if (isDirectory) {
          const oldPrefix = oldPath.endsWith("/") ? oldPath : oldPath + "/"
          const newPrefix = newPath.endsWith("/") ? newPath : newPath + "/"
          if (prev === oldPath) return newPath
          if (prev.startsWith(oldPrefix))
            return prev.replace(oldPrefix, newPrefix)
          return prev
        }
        return prev === oldPath ? newPath : prev
      })
    },
    []
  )

  return (
    <FileContext.Provider
      value={{
        selectedFileNode,
        setSelectedFileNode: (node: FileTreeNode | undefined) => {
          if (node) openFile(node)
        },
        openFiles,
        activeFilePath,
        openFile,
        closeFile,
        setActiveFile,
        reorderOpenFiles,
        updateOpenFilePaths,
      }}
    >
      {children}
    </FileContext.Provider>
  )
}

export function useFileContext() {
  const context = useContext(FileContext)
  if (!context) {
    throw new Error("useFileContext must be used within a FileProvider")
  }
  return context
}
