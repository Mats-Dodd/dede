import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { type FileTreeNode } from "@/lib/utils/file-tree-utils"

interface FileContextType {
  selectedFileNode: FileTreeNode | undefined
  setSelectedFileNode: (node: FileTreeNode | undefined) => void
  openFiles: FileTreeNode[]
  activeFilePath: string | undefined
  openFile: (node: FileTreeNode) => void
  closeFile: (filePath: string) => void
  setActiveFile: (filePath: string) => void
  updateOpenFilePaths: (
    oldPath: string,
    newPath: string,
    isDirectory: boolean
  ) => void
}

const FileContext = createContext<FileContextType | null>(null)

export function FileProvider({ children }: { children: ReactNode }) {
  const [selectedFileNode, setSelectedFileNode] = useState<
    FileTreeNode | undefined
  >()
  const [openFiles, setOpenFiles] = useState<FileTreeNode[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>()

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
        setSelectedFileNode: openFile, // Update legacy usage to open file
        openFiles,
        activeFilePath,
        openFile,
        closeFile,
        setActiveFile,
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
