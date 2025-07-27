import { createContext, useContext, useState, type ReactNode } from "react"
import { type FileTreeNode } from "@/lib/file-tree-utils"

interface FileContextType {
  selectedFileNode: FileTreeNode | undefined
  setSelectedFileNode: (node: FileTreeNode | undefined) => void
  openFiles: FileTreeNode[]
  activeFileId: string | undefined
  openFile: (node: FileTreeNode) => void
  closeFile: (nodeId: string) => void
  setActiveFile: (nodeId: string) => void
}

const FileContext = createContext<FileContextType | null>(null)

export function FileProvider({ children }: { children: ReactNode }) {
  const [selectedFileNode, setSelectedFileNode] = useState<
    FileTreeNode | undefined
  >()
  const [openFiles, setOpenFiles] = useState<FileTreeNode[]>([])
  const [activeFileId, setActiveFileId] = useState<string | undefined>()

  const openFile = (node: FileTreeNode) => {
    if (node.fileSystemNode.type !== "file") return

    const nodeId = node.fileSystemNode.id.toString()

    // Don't add if already open
    if (openFiles.some((f) => f.fileSystemNode.id.toString() === nodeId)) {
      setActiveFileId(nodeId)
      setSelectedFileNode(node)
      return
    }

    // Add to open files and make it active
    setOpenFiles((prev) => [...prev, node])
    setActiveFileId(nodeId)
    setSelectedFileNode(node)
  }

  const closeFile = (nodeId: string) => {
    setOpenFiles((prev) =>
      prev.filter((f) => f.fileSystemNode.id.toString() !== nodeId)
    )

    // If closing the active file, switch to another open file or clear selection
    if (activeFileId === nodeId) {
      const remainingFiles = openFiles.filter(
        (f) => f.fileSystemNode.id.toString() !== nodeId
      )
      if (remainingFiles.length > 0) {
        const nextFile = remainingFiles[remainingFiles.length - 1]
        setActiveFileId(nextFile.fileSystemNode.id.toString())
        setSelectedFileNode(nextFile)
      } else {
        setActiveFileId(undefined)
        setSelectedFileNode(undefined)
      }
    }
  }

  const setActiveFile = (nodeId: string) => {
    const file = openFiles.find(
      (f) => f.fileSystemNode.id.toString() === nodeId
    )
    if (file) {
      setActiveFileId(nodeId)
      setSelectedFileNode(file)
    }
  }

  return (
    <FileContext.Provider
      value={{
        selectedFileNode,
        setSelectedFileNode: openFile, // Update legacy usage to open file
        openFiles,
        activeFileId,
        openFile,
        closeFile,
        setActiveFile,
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
